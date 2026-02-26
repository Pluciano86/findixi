// Traducción de descripción de comercio vía Edge Function translate-comercio
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";

const ENDPOINT = `${SUPABASE_URL}/functions/v1/translate-comercio`;
const cacheComercios = new Map(); // key: `${idComercio}:${lang}`
const isDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const normalizeLang = (lang) => (lang || "es").toLowerCase().split("-")[0];

export async function getComercioDescripcionI18n(idComercio, lang) {
  const normLang = normalizeLang(lang);
  if (normLang === "es") return null;

  const cacheKey = `${idComercio}:${normLang}`;
  if (cacheComercios.has(cacheKey)) return cacheComercios.get(cacheKey);

  const body = { idComercio, lang: normLang };
  if (isDev) console.log("[comercioI18n] payload", body);

  try {
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw new Error(await resp.text());
    const json = await resp.json();
    if (!json?.ok) throw new Error(json?.error || "Traducción de comercio fallida");

    const descripcion = json?.data?.descripcion ?? null;
    cacheComercios.set(cacheKey, descripcion);
    return descripcion;
  } catch (e) {
    console.warn("getComercioDescripcionI18n fallo, usando original", e);
    return null;
  }
}
