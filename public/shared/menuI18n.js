// Traducción de productos de menú vía Edge Function translate-menu
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";

const ENDPOINT = `${SUPABASE_URL}/functions/v1/translate-menu`;
const cacheProductos = new Map(); // key: `${idProducto}:${lang}`
const cacheMenus = new Map(); // key: `${idMenu}:${lang}` -> { menu, productos? }
const cacheMenusFull = new Map(); // key: `${idMenu}:${lang}:full` -> { menu, productos }
const isDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const normalizeLang = (lang) => (lang || "es").toLowerCase().split("-")[0];

export async function getProductoI18n(producto, lang) {
  const normLang = normalizeLang(lang);
  if (normLang === "es") return producto;

  const cacheKey = `${producto.id}:${normLang}`;
  if (cacheProductos.has(cacheKey)) {
    return mergeProducto(producto, cacheProductos.get(cacheKey));
  }

  const body = {
    type: "producto",
    idProducto: producto.id,
    idMenu: producto.idMenu,
    lang: normLang,
  };
  if (isDev) console.log("[menuI18n] payload producto", body);

  try {
    console.log("[menuI18n] anon startsWith eyJ:", SUPABASE_ANON_KEY?.startsWith("eyJ"));
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const raw = await resp.text();
      console.error("[menuI18n] translate-menu ERROR", resp.status, raw);
      throw new Error(raw || `HTTP ${resp.status}`);
    }

    // Log de éxito con payload crudo para depurar
    console.log("[menuI18n] translate-menu OK", await resp.clone().text());
    const json = await resp.json();
    if (!json?.ok) {
      console.error("[menuI18n] translate-menu json error", json);
      throw new Error(json?.error || "Traducción fallida");
    }

    cacheProductos.set(cacheKey, json.data || {});
    return mergeProducto(producto, json.data || {});
  } catch (e) {
    console.warn("getProductoI18n fallo, usando original", e);
    return producto;
  }
}

export async function getMenuI18n(idMenu, lang, options = { includeProductos: false }) {
  const normLang = normalizeLang(lang);
  if (normLang === "es") return null; // sin cambios

  const includeProductos = !!options.includeProductos;
  const cacheKey = `${idMenu}:${normLang}`;
  const fullKey = `${idMenu}:${normLang}:full`;

  if (includeProductos && cacheMenusFull.has(fullKey)) return cacheMenusFull.get(fullKey);
  if (!includeProductos && cacheMenus.has(cacheKey)) return cacheMenus.get(cacheKey);

  const body = { type: "menu", idMenu, lang: normLang };
  if (isDev) console.log("[menuI18n] payload menu", body);

  try {
    console.log("[menuI18n] anon startsWith eyJ:", SUPABASE_ANON_KEY?.startsWith("eyJ"));
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
    if (!json?.ok) throw new Error(json?.error || "Traducción de menú fallida");

    const data = json.data || null;
    if (data?.menu) {
      cacheMenus.set(cacheKey, { menu: data.menu });
    }
    if (data?.productos && includeProductos) {
      cacheMenusFull.set(fullKey, data);
    }
    return includeProductos ? data : data?.menu ? { menu: data.menu } : null;
  } catch (e) {
    console.warn("getMenuI18n fallo, usando original", e);
    return null;
  }
}

function mergeProducto(original, traduccion) {
  const merged = { ...original };
  if (!original.no_traducir_nombre && traduccion.nombre) {
    merged.nombre = traduccion.nombre;
  }
  if (!original.no_traducir_descripcion && traduccion.descripcion != null) {
    merged.descripcion = traduccion.descripcion;
  }
  return merged;
}
