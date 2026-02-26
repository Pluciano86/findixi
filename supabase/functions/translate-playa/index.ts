// Supabase Edge Function: translate-playa
// Traduce la descripcion y acceso de una playa y la cachea en public.playas_traducciones.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const SUPPORTED_LANGS = ["es", "en", "fr", "de", "pt", "it", "zh", "ko", "ja"];

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

type PlayaBase = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
  acceso: string | null;
};

type PlayaTraduccion = {
  idplaya: number;
  lang: string;
  descripcion: string | null;
  acceso: string | null;
};

const normalizeLang = (lang: string | null | undefined) => (lang || "es").toLowerCase().split("-")[0];

function responder(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function obtenerPlaya(idPlaya: number): Promise<PlayaBase | null> {
  const { data, error } = await supabase
    .from("playas")
    .select("id, nombre, descripcion, acceso")
    .eq("id", idPlaya)
    .maybeSingle();
  if (error) throw error;
  return (data as PlayaBase | null) ?? null;
}

async function buscarCache(idPlaya: number, lang: string): Promise<PlayaTraduccion | null> {
  const { data, error } = await supabase
    .from("playas_traducciones")
    .select("idplaya, lang, descripcion, acceso")
    .eq("idplaya", idPlaya)
    .eq("lang", lang)
    .maybeSingle();
  if (error) throw error;
  return (data as PlayaTraduccion | null) ?? null;
}

async function guardarCache(trad: PlayaTraduccion) {
  const { error } = await supabase
    .from("playas_traducciones")
    .upsert(trad, { onConflict: "idplaya,lang" });
  if (error) throw error;
}

function buildSystemMessage(lang: string): string {
  return `
You are a professional translator for beach descriptions and access info.
Target language: ${lang}.

Return JSON with the same keys provided in the user content.
`.trim();
}

async function traducirCampos(payload: Record<string, string>, lang: string) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no configurada");

  const messages = [
    { role: "system", content: buildSystemMessage(lang) },
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

  let payload: { idPlaya?: number; lang?: string };
  try {
    payload = await req.json();
  } catch (_e) {
    return responder({ ok: false, error: "JSON inválido" }, 400);
  }

  const idPlaya = Number(payload.idPlaya);
  const lang = normalizeLang(payload.lang);

  if (!Number.isFinite(idPlaya) || idPlaya <= 0) {
    return responder({ ok: false, error: "idPlaya requerido" }, 400);
  }

  if (!SUPPORTED_LANGS.includes(lang)) {
    return responder({ ok: false, error: `Idioma no soportado: ${lang}` }, 400);
  }

  try {
    const playaBase = await obtenerPlaya(idPlaya);
    if (!playaBase) return responder({ ok: false, error: "Playa no encontrada" }, 404);

    if (lang === "es") {
      return responder({ ok: true, source: "original", data: playaBase });
    }

    const cache = await buscarCache(idPlaya, lang);
    if (cache) return responder({ ok: true, source: "cache", data: cache });

    const payloadDesc: Record<string, string> = {};
    if (playaBase.descripcion != null && String(playaBase.descripcion).trim()) {
      payloadDesc.descripcion = String(playaBase.descripcion);
    }
    if (playaBase.acceso != null && String(playaBase.acceso).trim()) {
      payloadDesc.acceso = String(playaBase.acceso);
    }

    const traducido = await traducirCampos(payloadDesc, lang);
    const descripcion = traducido.descripcion ?? playaBase.descripcion ?? null;
    const acceso = traducido.acceso ?? playaBase.acceso ?? null;

    await guardarCache({
      idplaya: idPlaya,
      lang,
      descripcion: descripcion ?? null,
      acceso: acceso ?? null,
    });

    return responder({
      ok: true,
      source: "translated",
      data: { idplaya: idPlaya, lang, descripcion, acceso },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error("translate-playa error:", errMsg);
    return responder({ ok: false, error: errMsg }, 500);
  }
});
