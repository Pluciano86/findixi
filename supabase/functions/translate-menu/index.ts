// Supabase Edge Function: translate-menu
// Traduce título/descr. de un menú y nombre/descr. de sus productos.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const SUPPORTED_LANGS = ["es", "en", "fr", "de", "pt", "it", "zh", "ko", "ja"];
const LANG_LABELS: Record<string, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  zh: "Chinese (Simplified)",
  ko: "Korean",
  ja: "Japanese",
};
// Lista fija de términos gastronómicos que NO se traducen (editar aquí si hace falta)
const TERMINOS_GASTRONOMICOS_NO_TRADUCIR = [
  "mofongo",
  "empanadilla",
  "empanadas",
  "pastelillo",
  "arepas",
  "alcapurria",
  "chimichurri",
  "tostones",
  "asopao",
  "arroz mamposteao",
  "picoletos",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY: la función no podrá leer/escribir traducciones.");
}
if (!OPENAI_API_KEY) {
  console.warn("⚠️ Falta OPENAI_API_KEY: no se podrán generar traducciones nuevas.");
}

type MenuBase = {
  id: number;
  idComercio: number | null;
  titulo: string | null;
  descripcion: string | null;
  no_traducir?: boolean | null;
};

type ProductoBase = {
  id: number;
  idMenu: number;
  nombre: string | null;
  descripcion: string | null;
  no_traducir_nombre?: boolean | null;
  no_traducir_descripcion?: boolean | null;
};

type MenuTraduccion = {
  idmenu: number;
  lang: string;
  titulo: string | null;
  descripcion: string | null;
};

type ProductoTraduccion = {
  idproducto: number;
  lang: string;
  nombre: string | null;
  descripcion: string | null;
};

function responder(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const normalizeLang = (lang: string | null | undefined) => (lang || "es").toLowerCase().split("-")[0];

async function obtenerMenu(idMenu: number): Promise<MenuBase | null> {
  const { data, error } = await supabase
    .from("menus")
    .select("id, idComercio, titulo, descripcion, no_traducir")
    .eq("id", idMenu)
    .maybeSingle();
  if (error) throw error;
  return (data as MenuBase | null) ?? null;
}

async function obtenerProducto(idProducto: number): Promise<ProductoBase | null> {
  const { data, error } = await supabase
    .from("productos")
    .select("id, idMenu, nombre, descripcion, no_traducir_nombre, no_traducir_descripcion")
    .eq("id", idProducto)
    .maybeSingle();
  if (error) throw error;
  return (data as ProductoBase | null) ?? null;
}

async function obtenerProductos(idMenu: number): Promise<ProductoBase[]> {
  const { data, error } = await supabase
    .from("productos")
    .select("id, idMenu, nombre, descripcion, no_traducir_nombre, no_traducir_descripcion")
    .eq("idMenu", idMenu);
  if (error) throw error;
  return (data as ProductoBase[]) ?? [];
}

async function obtenerGlosario(idComercio?: number | null): Promise<string[]> {
  if (!Number.isFinite(idComercio)) return [];
  const { data, error } = await supabase
    .from("comercio_i18n_glosario")
    .select("termino")
    .eq("idComercio", idComercio)
    .order("termino", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: { termino: string }) => row.termino);
}

function buildProtectedTerms(glosario: string[]): string[] {
  const merged = [...TERMINOS_GASTRONOMICOS_NO_TRADUCIR, ...glosario];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of merged) {
    const normalized = String(term || "").trim();
    const key = normalized.toLowerCase();
    if (!normalized) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

async function buscarCacheMenu(idMenu: number, lang: string): Promise<MenuTraduccion | null> {
  const { data, error } = await supabase
    .from("menus_traducciones")
    .select("idmenu, lang, titulo, descripcion")
    .eq("idmenu", idMenu)
    .eq("lang", lang)
    .maybeSingle();
  if (error) throw error;
  return (data as MenuTraduccion | null) ?? null;
}

async function buscarCacheProductos(ids: number[], lang: string): Promise<Map<number, ProductoTraduccion>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("productos_traducciones")
    .select("idproducto, lang, nombre, descripcion")
    .in("idproducto", ids)
    .eq("lang", lang);
  if (error) throw error;
  const map = new Map<number, ProductoTraduccion>();
  (data as ProductoTraduccion[] | null)?.forEach((row) => map.set(row.idproducto, row));
  return map;
}

async function buscarCacheProducto(idProducto: number, lang: string): Promise<ProductoTraduccion | null> {
  const { data, error } = await supabase
    .from("productos_traducciones")
    .select("idproducto, lang, nombre, descripcion")
    .eq("idproducto", idProducto)
    .eq("lang", lang)
    .maybeSingle();
  if (error) throw error;
  return (data as ProductoTraduccion | null) ?? null;
}

async function guardarMenuTraduccion(trad: MenuTraduccion) {
  const { error } = await supabase.from("menus_traducciones").upsert(trad, { onConflict: "idmenu,lang" });
  if (error) throw error;
}

async function guardarProductosTraducciones(trads: ProductoTraduccion[]) {
  if (trads.length === 0) return;
  const { error } = await supabase.from("productos_traducciones").upsert(trads, { onConflict: "idproducto,lang" });
  if (error) throw error;
}

function buildSystemMessage(protectedTerms: string[], lang: string): string {
  const protectedList = protectedTerms.length > 0 ? protectedTerms.join(", ") : TERMINOS_GASTRONOMICOS_NO_TRADUCIR.join(", ");
  const targetLabel = LANG_LABELS[lang] ?? lang;
  return `
You are a professional food menu translator.
Target language: ${targetLabel} (${lang}).

Do NOT translate cultural food names such as:
${protectedList}.

Keep these terms EXACTLY as written.
Do not translate, paraphrase, pluralize, or localize them.

Translate every non-empty value to the target language.
Never keep source-language text unless it is a protected term.
If target language is not English, do not output English text.

Translate naturally and keep a promotional tone.
Return JSON with the same keys provided in the user content.
`.trim();
}

async function traducirCampos(payload: Record<string, string>, lang: string, protectedTerms: string[]) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no configurada");

  const messages = [
    { role: "system", content: buildSystemMessage(protectedTerms, lang) },
    { role: "user", content: JSON.stringify(payload) },
  ];

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!completion.ok) {
    const errTxt = await completion.text();
    throw new Error(`OpenAI error: ${errTxt}`);
  }

  const result = await completion.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI no devolvió contenido");

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content);
  } catch (_e) {
    throw new Error("No se pudo parsear la respuesta de OpenAI");
  }
  return normalizeTranslationResult(parsed, payload);
}

function buildPayload(obj: Record<string, unknown>, campos: string[]) {
  const out: Record<string, string> = {};
  campos.forEach((k) => {
    const val = obj[k];
    if (val != null && String(val).trim()) out[k] = String(val);
  });
  return out;
}

function normalizeTranslationResult(
  parsed: Record<string, unknown>,
  payload: Record<string, string>,
): Record<string, string> {
  const aliasMap: Record<string, string[]> = {
    titulo: ["titulo", "título", "title", "titre", "titolo", "titel"],
    descripcion: ["descripcion", "descripción", "description", "desc", "descricao", "descrição", "descrizione", "beschreibung"],
    nombre: ["nombre", "name", "nome", "nom"],
  };
  const normalizeKey = (key: string) =>
    String(key || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");

  const parsedNormalized = new Map<string, string>();
  const parsedStringValues: string[] = [];
  for (const [rawKey, rawValue] of Object.entries(parsed)) {
    if (typeof rawValue !== "string") continue;
    const trimmed = rawValue.trim();
    if (!trimmed) continue;
    const normalizedKey = normalizeKey(rawKey);
    if (!parsedNormalized.has(normalizedKey)) parsedNormalized.set(normalizedKey, trimmed);
    parsedStringValues.push(trimmed);
  }

  const normalized: Record<string, string> = {};
  for (const key of Object.keys(payload)) {
    const direct = parsed[key];

    if (typeof direct === "string" && direct.trim()) {
      normalized[key] = direct.trim();
      continue;
    }

    const aliases = aliasMap[key] || [key];
    let resolved: string | null = null;
    for (const alias of aliases) {
      const hit = parsedNormalized.get(normalizeKey(alias));
      if (hit) {
        resolved = hit;
        break;
      }
    }
    if (resolved) {
      normalized[key] = resolved;
      continue;
    }

    if (Object.keys(payload).length === 1 && parsedStringValues.length === 1) {
      normalized[key] = parsedStringValues[0];
      continue;
    }

    normalized[key] = payload[key];
  }
  return normalized;
}

function normalizeCompareText(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function isLikelyUntranslated(base: string | null | undefined, translated: string | null | undefined): boolean {
  const baseNorm = normalizeCompareText(base);
  if (!baseNorm) return false;
  const translatedNorm = normalizeCompareText(translated);
  if (!translatedNorm) return true;
  return baseNorm === translatedNorm;
}

function hasText(value: string | null | undefined): boolean {
  return normalizeCompareText(value).length > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return responder({ ok: false, error: "Use POST" }, 405);
  }

  let payload: {
    idMenu?: number;
    idProducto?: number;
    lang?: string;
    type?: string;
    entity?: string;
    fields?: string[];
    mode?: string;
  };
  try {
    payload = await req.json();
  } catch (_e) {
    return responder({ ok: false, error: "JSON inválido" }, 400);
  }

  const tipo = (payload.type || "menu").toLowerCase();

  if (tipo === "invalidate") {
    const entity = String(payload.entity || "").toLowerCase();
    const mode = String(payload.mode || "nullify").toLowerCase();
    const fields = Array.isArray(payload.fields) ? payload.fields.map((f) => String(f || "").toLowerCase()) : [];

    try {
      if (entity === "menu") {
        const idMenu = Number(payload.idMenu);
        if (!Number.isFinite(idMenu) || idMenu <= 0) {
          return responder({ ok: false, error: "idMenu requerido para invalidación de menú" }, 400);
        }

        if (mode === "delete") {
          const { error } = await supabase.from("menus_traducciones").delete().eq("idmenu", idMenu);
          if (error) throw error;
          return responder({ ok: true, entity: "menu", mode: "delete", idMenu });
        }

        const patch: Record<string, null> = {};
        if (fields.includes("titulo")) patch.titulo = null;
        if (fields.includes("descripcion")) patch.descripcion = null;
        if (Object.keys(patch).length === 0) return responder({ ok: true, entity: "menu", mode: "noop", idMenu });

        const { error } = await supabase.from("menus_traducciones").update(patch).eq("idmenu", idMenu);
        if (error) throw error;
        return responder({ ok: true, entity: "menu", mode: "nullify", idMenu, fields: Object.keys(patch) });
      }

      if (entity === "producto") {
        const idProducto = Number(payload.idProducto);
        if (!Number.isFinite(idProducto) || idProducto <= 0) {
          return responder({ ok: false, error: "idProducto requerido para invalidación de producto" }, 400);
        }

        if (mode === "delete") {
          const { error } = await supabase.from("productos_traducciones").delete().eq("idproducto", idProducto);
          if (error) throw error;
          return responder({ ok: true, entity: "producto", mode: "delete", idProducto });
        }

        const patch: Record<string, null> = {};
        if (fields.includes("nombre")) patch.nombre = null;
        if (fields.includes("descripcion")) patch.descripcion = null;
        if (Object.keys(patch).length === 0) return responder({ ok: true, entity: "producto", mode: "noop", idProducto });

        const { error } = await supabase.from("productos_traducciones").update(patch).eq("idproducto", idProducto);
        if (error) throw error;
        return responder({ ok: true, entity: "producto", mode: "nullify", idProducto, fields: Object.keys(patch) });
      }

      return responder({ ok: false, error: "Entidad no soportada para invalidación" }, 400);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error("translate-menu invalidate error:", errMsg);
      return responder({ ok: false, error: errMsg }, 500);
    }
  }

  const lang = normalizeLang(payload.lang);
  if (!SUPPORTED_LANGS.includes(lang)) return responder({ ok: false, error: `Idioma no soportado: ${lang}` }, 400);

  // Traducción de un producto individual
  if (tipo === "producto") {
    const idProducto = Number(payload.idProducto);
    if (!Number.isFinite(idProducto) || idProducto <= 0) {
      return responder({ ok: false, error: "idProducto requerido" }, 400);
    }

    try {
      const prodBase = await obtenerProducto(idProducto);
      if (!prodBase) return responder({ ok: false, error: "Producto no encontrado" }, 404);

      const menuBase = await obtenerMenu(prodBase.idMenu);
      const glosario = await obtenerGlosario(menuBase?.idComercio);
      const protectedTerms = buildProtectedTerms(glosario);

      const cacheProd = await buscarCacheProducto(idProducto, lang);
      const cacheProdEn = lang !== "en" ? await buscarCacheProducto(idProducto, "en") : null;
      const cacheProdLooksOriginal =
        !prodBase.no_traducir_nombre && isLikelyUntranslated(prodBase.nombre, cacheProd?.nombre) ||
        !prodBase.no_traducir_descripcion && isLikelyUntranslated(prodBase.descripcion, cacheProd?.descripcion);
      const cacheProdLooksEnglish =
        lang !== "en" &&
        cacheProd &&
        cacheProdEn &&
        (
          (
            !prodBase.no_traducir_nombre &&
            hasText(cacheProd.nombre) &&
            normalizeCompareText(cacheProd.nombre) === normalizeCompareText(cacheProdEn.nombre)
          ) ||
          (
            !prodBase.no_traducir_descripcion &&
            hasText(cacheProd.descripcion) &&
            normalizeCompareText(cacheProd.descripcion) === normalizeCompareText(cacheProdEn.descripcion)
          )
        );

      if (cacheProd && !cacheProdLooksOriginal && !cacheProdLooksEnglish) {
        return responder({
          ok: true,
          source: "cache",
          data: {
            ...prodBase,
            nombre: cacheProd.nombre,
            descripcion: cacheProd.descripcion,
          },
        });
      }

      const payloadProd = buildPayload(
        prodBase as Record<string, unknown>,
        prodBase.no_traducir_descripcion ? [] : ["descripcion"],
      );
      if (!prodBase.no_traducir_nombre) payloadProd.nombre = prodBase.nombre ?? "";
      else if (prodBase.nombre) payloadProd.nombre = prodBase.nombre;

      const traducido = await traducirCampos(payloadProd, lang, protectedTerms);
      const merged: ProductoBase = {
        ...prodBase,
        nombre: prodBase.no_traducir_nombre ? prodBase.nombre : traducido.nombre ?? prodBase.nombre,
        descripcion: prodBase.no_traducir_descripcion ? prodBase.descripcion : traducido.descripcion ?? prodBase.descripcion,
      };

      await guardarProductosTraducciones([
        {
          idproducto: idProducto,
          lang,
          nombre: merged.nombre ?? null,
          descripcion: merged.descripcion ?? null,
        },
      ]);

      return responder({ ok: true, source: "translated", data: merged });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("translate-menu producto error:", errMsg);
    return responder({ ok: false, error: errMsg }, 500);
  }
  }

  // Traducción de menú + productos
  const idMenu = Number(payload.idMenu);
  if (!Number.isFinite(idMenu) || idMenu <= 0) return responder({ ok: false, error: "idMenu requerido" }, 400);

  try {
    const menuBase = await obtenerMenu(idMenu);
    if (!menuBase) return responder({ ok: false, error: "Menú no encontrado" }, 404);

    const productosBase = await obtenerProductos(idMenu);

    if (lang === "es") {
      return responder({
        ok: true,
        source: "original",
        data: { menu: menuBase, productos: productosBase },
      });
    }

    const glosario = await obtenerGlosario(menuBase.idComercio);
    const protectedTerms = buildProtectedTerms(glosario);

    const menuCache = await buscarCacheMenu(idMenu, lang);
    const productosCache = await buscarCacheProductos(productosBase.map((p) => p.id), lang);
    const menuCacheEn = lang !== "en" ? await buscarCacheMenu(idMenu, "en") : null;
    const productosCacheEn = lang !== "en" ? await buscarCacheProductos(productosBase.map((p) => p.id), "en") : new Map();

    const traduccionesProductos: ProductoTraduccion[] = [];
    const productosTraducidos: ProductoBase[] = [];

    const productosFaltantes = productosBase.filter((p) => {
      const cached = productosCache.get(p.id);
      if (!cached) return true;
      const nameNeedsRefresh = !p.no_traducir_nombre && isLikelyUntranslated(p.nombre, cached.nombre);
      const descNeedsRefresh = !p.no_traducir_descripcion && isLikelyUntranslated(p.descripcion, cached.descripcion);
      const enCached = productosCacheEn.get(p.id);
      const looksEnglish =
        lang !== "en" &&
        enCached &&
        (
          (
            !p.no_traducir_nombre &&
            hasText(cached.nombre) &&
            normalizeCompareText(cached.nombre) === normalizeCompareText(enCached.nombre)
          ) ||
          (
            !p.no_traducir_descripcion &&
            hasText(cached.descripcion) &&
            normalizeCompareText(cached.descripcion) === normalizeCompareText(enCached.descripcion)
          )
        );
      return nameNeedsRefresh || descNeedsRefresh || looksEnglish;
    });

    if (productosFaltantes.length > 0) {
      for (const producto of productosFaltantes) {
        const payloadProd = buildPayload(
          producto as Record<string, unknown>,
          producto.no_traducir_descripcion ? [] : ["descripcion"],
        );
        // respetar flag no_traducir_nombre
        if (!producto.no_traducir_nombre) {
          payloadProd.nombre = producto.nombre ?? "";
        } else if (producto.nombre) {
          payloadProd.nombre = producto.nombre; // mantener original, sin pedir traducción
        }

        const traducido = await traducirCampos(payloadProd, lang, protectedTerms);
        traduccionesProductos.push({
          idproducto: producto.id,
          lang,
          nombre: producto.no_traducir_nombre ? producto.nombre ?? null : traducido.nombre ?? null,
          descripcion: producto.no_traducir_descripcion ? producto.descripcion ?? null : traducido.descripcion ?? null,
        });
        productosTraducidos.push({
          ...producto,
          nombre: producto.no_traducir_nombre ? producto.nombre : traducido.nombre ?? producto.nombre,
          descripcion: producto.no_traducir_descripcion ? producto.descripcion : traducido.descripcion ?? producto.descripcion,
        });
      }
      await guardarProductosTraducciones(traduccionesProductos);
    }

    const productosTraducidosMap = new Map(productosTraducidos.map((pt) => [pt.id, pt]));
    const productosFinal = productosBase.map((p) => {
      const recienTraducido = productosTraducidosMap.get(p.id);
      if (recienTraducido) return recienTraducido;

      const cached = productosCache.get(p.id);
      if (cached) {
        return {
          ...p,
          nombre: p.no_traducir_nombre ? p.nombre : cached.nombre,
          descripcion: p.no_traducir_descripcion ? p.descripcion : cached.descripcion,
        };
      }
      return p;
    });

    let menuFinal: MenuBase = menuBase;
    const menuLooksEnglish =
      lang !== "en" &&
      menuCache &&
      menuCacheEn &&
      (
        (
          !menuBase.no_traducir &&
          hasText(menuCache.titulo) &&
          normalizeCompareText(menuCache.titulo) === normalizeCompareText(menuCacheEn.titulo)
        ) ||
        (
          hasText(menuCache.descripcion) &&
          normalizeCompareText(menuCache.descripcion) === normalizeCompareText(menuCacheEn.descripcion)
        )
      );
    const menuNeedsRefresh =
      !menuCache ||
      (!menuBase.no_traducir && isLikelyUntranslated(menuBase.titulo, menuCache.titulo)) ||
      isLikelyUntranslated(menuBase.descripcion, menuCache.descripcion) ||
      menuLooksEnglish;

    if (menuCache && !menuNeedsRefresh) {
      menuFinal = { ...menuBase, titulo: menuCache.titulo, descripcion: menuCache.descripcion };
    } else {
      const payloadMenu = buildPayload(menuBase as Record<string, unknown>, ["descripcion"]);
      // respetar flag no_traducir en menús
      if (!menuBase.no_traducir) {
        payloadMenu.titulo = menuBase.titulo ?? "";
      } else if (menuBase.titulo) {
        payloadMenu.titulo = menuBase.titulo; // mantener original
      }

      const traducido = await traducirCampos(payloadMenu, lang, protectedTerms);
      menuFinal = {
        ...menuBase,
        titulo: menuBase.no_traducir ? menuBase.titulo : traducido.titulo ?? menuBase.titulo,
        descripcion: traducido.descripcion ?? menuBase.descripcion,
      };
      await guardarMenuTraduccion({
        idmenu: idMenu,
        lang,
        titulo: menuFinal.titulo ?? null,
        descripcion: menuFinal.descripcion ?? null,
      });
    }

    return responder({
      ok: true,
      source: menuCache && !menuNeedsRefresh ? "cache" : "translated",
      data: { menu: menuFinal, productos: productosFinal },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("translate-menu error:", errMsg);
    return responder({ ok: false, error: errMsg }, 500);
  }
});
