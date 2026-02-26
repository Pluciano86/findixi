// Helper para traducciones on-demand de eventos.
// Busca primero en eventos_traducciones, si no existe llama a la Edge Function translate-evento.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";

const SUPPORTED_LANGS = ["es", "en", "fr", "de", "pt", "it", "zh", "ko", "ja"];
const translationCache = new Map(); // key: `${id}:${lang}` -> traducción parcial
const pending = new Map(); // evita llamadas duplicadas concurrentes

// Siempre derive del SUPABASE_URL que usa el cliente (Live Server / Netlify)
const ENDPOINT = `${SUPABASE_URL}/functions/v1/translate-evento`;

const normalizeLang = (lang) => (lang || "es").toLowerCase().split("-")[0];
const cacheKey = (id, lang) => `${id}:${lang}`;

export function mergeEventoConTraduccion(evento, traduccion) {
  if (!traduccion) return evento;
  return {
    ...evento,
    nombre: traduccion.nombre ?? evento.nombre,
    descripcion: traduccion.descripcion ?? evento.descripcion,
    lugar: traduccion.lugar ?? evento.lugar,
    direccion: traduccion.direccion ?? evento.direccion,
    costo: traduccion.costo ?? evento.costo,
  };
}

function recordar(traduccion) {
  if (!traduccion?.idevento || !traduccion?.lang) return;
  translationCache.set(cacheKey(traduccion.idevento, traduccion.lang), traduccion);
}

export async function preloadEventoTraducciones(eventIds = [], lang = "es") {
  const langNorm = normalizeLang(lang);
  if (langNorm === "es" || !Array.isArray(eventIds) || eventIds.length === 0) return;

  const faltantes = eventIds.filter(
    (id) => !translationCache.has(cacheKey(id, langNorm)) && !pending.has(cacheKey(id, langNorm))
  );
  if (!faltantes.length) return;

  const { data, error } = await supabase
    .from("eventos_traducciones")
    .select("idevento, lang, nombre, descripcion, lugar, direccion, costo")
    .eq("lang", langNorm)
    .in("idevento", faltantes);

  if (error) {
    console.warn("No se pudieron precargar traducciones:", error.message);
    return;
  }

  data?.forEach(recordar);
}

async function fetchDesdeFuncion(idevento, lang) {
  const resp = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ idEvento: idevento, lang }),
  });

  if (!resp.ok) {
    throw new Error(await resp.text());
  }

  const payload = await resp.json().catch(() => ({}));
  const data = payload?.data || payload?.translation || null;
  return data ? { ...data, idevento, lang } : null;
}

export async function getEventoI18n(evento, lang = "es") {
  if (!evento?.id) return evento;

  const langNorm = normalizeLang(lang);
  if (!SUPPORTED_LANGS.includes(langNorm) || langNorm === "es") {
    return evento;
  }

  const key = cacheKey(evento.id, langNorm);
  if (translationCache.has(key)) {
    return mergeEventoConTraduccion(evento, translationCache.get(key));
  }

  if (pending.has(key)) {
    const traduccion = await pending.get(key).catch(() => null);
    return mergeEventoConTraduccion(evento, traduccion);
  }

  const prom = (async () => {
    // 1) Buscar en la tabla (cache persistente)
    const { data, error } = await supabase
      .from("eventos_traducciones")
      .select("idevento, lang, nombre, descripcion, lugar, direccion, costo")
      .eq("idevento", evento.id)
      .eq("lang", langNorm)
      .maybeSingle();

    if (error) console.warn("Error leyendo cache eventos_traducciones:", error.message);

    if (data) {
      recordar(data);
      return data;
    }

    // 2) No existe → llamar Edge Function (traduce y cachea en BD)
    const desdeFuncion = await fetchDesdeFuncion(evento.id, langNorm);
    if (desdeFuncion) recordar(desdeFuncion);
    return desdeFuncion;
  })()
    .catch((err) => {
      console.warn("Fallo getEventoI18n:", err?.message || err);
      return null;
    })
    .finally(() => pending.delete(key));

  pending.set(key, prom);
  const traduccion = await prom;
  return mergeEventoConTraduccion(evento, traduccion);
}
