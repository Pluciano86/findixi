// Supabase Edge Function: translate-comercio
// Traduce la descripcion de un comercio y la cachea en public.comercios_traducciones.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const SUPPORTED_LANGS = ["es", "en", "fr", "de", "pt", "it", "zh", "ko", "ja"];
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

type ComercioBase = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
};

type ComercioTraduccion = {
  idcomercio: number;
  lang: string;
  descripcion: string | null;
};

const normalizeLang = (lang: string | null | undefined) => (lang || "es").toLowerCase().split("-")[0];

function responder(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function obtenerComercio(idComercio: number): Promise<ComercioBase | null> {
  const { data, error } = await supabase
    .from("Comercios")
    .select("id, nombre, descripcion")
    .eq("id", idComercio)
    .maybeSingle();
  if (error) throw error;
  return (data as ComercioBase | null) ?? null;
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

async function buscarCache(idComercio: number, lang: string): Promise<ComercioTraduccion | null> {
  const { data, error } = await supabase
    .from("comercios_traducciones")
    .select("idcomercio, lang, descripcion")
    .eq("idcomercio", idComercio)
    .eq("lang", lang)
    .maybeSingle();
  if (error) throw error;
  return (data as ComercioTraduccion | null) ?? null;
}

async function guardarCache(trad: ComercioTraduccion) {
  const { error } = await supabase
    .from("comercios_traducciones")
    .upsert(trad, { onConflict: "idcomercio,lang" });
  if (error) throw error;
}

function buildSystemMessage(protectedTerms: string[], lang: string): string {
  const protectedList = protectedTerms.length > 0 ? protectedTerms.join(", ") : TERMINOS_GASTRONOMICOS_NO_TRADUCIR.join(", ");
  return `
You are a professional translator for restaurant descriptions.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return responder({ ok: false, error: "Use POST" }, 405);
  }

  let payload: { idComercio?: number; lang?: string };
  try {
    payload = await req.json();
  } catch (_e) {
    return responder({ ok: false, error: "JSON inválido" }, 400);
  }

  const idComercio = Number(payload.idComercio);
  const lang = normalizeLang(payload.lang);

  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    return responder({ ok: false, error: "idComercio requerido" }, 400);
  }

  if (!SUPPORTED_LANGS.includes(lang)) {
    return responder({ ok: false, error: `Idioma no soportado: ${lang}` }, 400);
  }

  try {
    const comercioBase = await obtenerComercio(idComercio);
    if (!comercioBase) return responder({ ok: false, error: "Comercio no encontrado" }, 404);

    if (lang === "es") {
      return responder({ ok: true, source: "original", data: comercioBase });
    }

    const cache = await buscarCache(idComercio, lang);
    if (cache) return responder({ ok: true, source: "cache", data: cache });

    const glosario = await obtenerGlosario(idComercio);
    const protectedTerms = buildProtectedTerms(glosario);

    const payloadDesc: Record<string, string> = {};
    if (comercioBase.descripcion != null && String(comercioBase.descripcion).trim()) {
      payloadDesc.descripcion = String(comercioBase.descripcion);
    }

    const traducido = await traducirCampos(payloadDesc, lang, protectedTerms);
    const descripcion = traducido.descripcion ?? comercioBase.descripcion ?? null;

    await guardarCache({
      idcomercio: idComercio,
      lang,
      descripcion: descripcion ?? null,
    });

    return responder({
      ok: true,
      source: "translated",
      data: { idcomercio: idComercio, lang, descripcion },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("translate-comercio error:", errMsg);
    return responder({ ok: false, error: errMsg }, 500);
  }
});
