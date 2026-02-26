// Supabase Edge Function: translate-menu
// Traduce título/descr. de un menú y nombre/descr. de sus productos.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const SUPPORTED_LANGS = ["es", "en", "fr", "de", "pt", "it", "zh", "ko", "ja"];
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
  return `
You are a professional food menu translator.
Target language: ${lang}.

Do NOT translate cultural food names such as:
${protectedList}.

Keep these terms EXACTLY as written.
Do not translate, paraphrase, pluralize, or localize them.

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

  let parsed: Record<string, string> = {};
  try {
    parsed = JSON.parse(content);
  } catch (_e) {
    throw new Error("No se pudo parsear la respuesta de OpenAI");
  }
  return parsed;
}

function buildPayload(obj: Record<string, unknown>, campos: string[]) {
  const out: Record<string, string> = {};
  campos.forEach((k) => {
    const val = obj[k];
    if (val != null && String(val).trim()) out[k] = String(val);
  });
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return responder({ ok: false, error: "Use POST" }, 405);
  }

  let payload: { idMenu?: number; idProducto?: number; lang?: string; type?: string };
  try {
    payload = await req.json();
  } catch (_e) {
    return responder({ ok: false, error: "JSON inválido" }, 400);
  }

  const lang = normalizeLang(payload.lang);
  if (!SUPPORTED_LANGS.includes(lang)) return responder({ ok: false, error: `Idioma no soportado: ${lang}` }, 400);

  const tipo = (payload.type || "menu").toLowerCase();

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
      if (cacheProd) {
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

      const payloadProd = buildPayload(prodBase as Record<string, unknown>, ["descripcion"]);
      if (!prodBase.no_traducir_nombre) payloadProd.nombre = prodBase.nombre ?? "";
      else if (prodBase.nombre) payloadProd.nombre = prodBase.nombre;

      const traducido = await traducirCampos(payloadProd, lang, protectedTerms);
      const merged: ProductoBase = {
        ...prodBase,
        nombre: prodBase.no_traducir_nombre ? prodBase.nombre : traducido.nombre ?? prodBase.nombre,
        descripcion: traducido.descripcion ?? prodBase.descripcion,
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

    const traduccionesProductos: ProductoTraduccion[] = [];
    const productosTraducidos: ProductoBase[] = [];

    const productosFaltantes = productosBase.filter((p) => !productosCache.has(p.id));

    if (productosFaltantes.length > 0) {
      for (const producto of productosFaltantes) {
        const payloadProd = buildPayload(producto as Record<string, unknown>, ["descripcion"]);
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
          descripcion: traducido.descripcion ?? null,
        });
        productosTraducidos.push({
          ...producto,
          nombre: producto.no_traducir_nombre ? producto.nombre : traducido.nombre ?? producto.nombre,
          descripcion: traducido.descripcion ?? producto.descripcion,
        });
      }
      await guardarProductosTraducciones(traduccionesProductos);
    }

    const productosFinal = productosBase.map((p) => {
      const cached = productosCache.get(p.id);
      if (cached) {
        return { ...p, nombre: cached.nombre, descripcion: cached.descripcion };
      }
      const nuevo = productosTraducidos.find((pt) => pt.id === p.id);
      return nuevo ?? p;
    });

    let menuFinal: MenuBase = menuBase;
    if (menuCache) {
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
      source: menuCache ? "cache" : "translated",
      data: { menu: menuFinal, productos: productosFinal },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("translate-menu error:", errMsg);
    return responder({ ok: false, error: errMsg }, 500);
  }
});
