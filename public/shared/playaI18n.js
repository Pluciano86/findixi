// Traducción de descripción/acceso de playa vía Edge Function translate-playa
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";

const ENDPOINT = `${SUPABASE_URL}/functions/v1/translate-playa`;
const cachePlayas = new Map(); // key: `${idPlaya}:${lang}`
const isDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const normalizeLang = (lang) => (lang || "es").toLowerCase().split("-")[0];

export async function getPlayaI18n(idPlaya, lang) {
  const normLang = normalizeLang(lang);
  if (normLang === "es") return null;

  const cacheKey = `${idPlaya}:${normLang}`;
  if (cachePlayas.has(cacheKey)) return cachePlayas.get(cacheKey);

  const body = { idPlaya, lang: normLang };
  if (isDev) console.log("[playaI18n] payload", body);

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
    if (!json?.ok) throw new Error(json?.error || "Traducción de playa fallida");

    const data = {
      descripcion: json?.data?.descripcion ?? null,
      acceso: json?.data?.acceso ?? null,
    };
    cachePlayas.set(cacheKey, data);
    return data;
  } catch (e) {
    console.warn("getPlayaI18n fallo, usando original", e);
    return null;
  }
}
