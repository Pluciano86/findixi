// Supabase Edge Function: translate-evento
// Traduce campos largos de un evento y los cachea en public.eventos_traducciones.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const SUPPORTED_LANGS = ["es", "en", "fr", "de", "pt", "it", "zh", "ko", "ja"];
const TERMINOS_GASTRONOMICOS_NO_TRADUCIR = [
  "mofongo",
  "empanadillas",
  "empanadilla",
  "empanadas",
  "pastelillos",
  "pastelillo",
  "arepas",
  "arepa",
  "alcapurrias",
  "alcapurria",
  "chimichurri",
  "tostones",
  "toston",
  "asopao",
  "mamposteao",
  "sorullitos",
  "picoletos",
];
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}
if (!OPENAI_API_KEY) {
  console.warn("⚠️ Falta OPENAI_API_KEY: no se podrá traducir.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type EventoBase = {
  id: number;
  idComercio?: number | null;
  nombre: string | null;
  descripcion: string | null;
  lugar: string | null;
  direccion: string | null;
  costo: string | null;
};

type Traduccion = {
  idevento: number;
  lang: string;
  nombre?: string | null;
  descripcion?: string | null;
  lugar?: string | null;
  direccion?: string | null;
  costo?: string | null;
};

const normalizeLang = (lang: string | null | undefined) => (lang || "es").toLowerCase().split("-")[0];

async function obtenerEvento(idevento: number): Promise<EventoBase | null> {
  const { data, error } = await supabase
    .from("eventos")
    .select("id, idComercio, nombre, descripcion, lugar, direccion, costo")
    .eq("id", idevento)
    .maybeSingle();

  if (error) throw error;
  return (data as EventoBase | null) ?? null;
}

async function buscarCache(idevento: number, lang: string): Promise<Traduccion | null> {
  const { data, error } = await supabase
    .from("eventos_traducciones")
    .select("idevento, lang, nombre, descripcion, lugar, direccion, costo")
    .eq("idevento", idevento)
    .eq("lang", lang)
    .maybeSingle();

  if (error) throw error;
  return (data as Traduccion | null) ?? null;
}

async function guardarCache(traduccion: Traduccion) {
  const { error } = await supabase
    .from("eventos_traducciones")
    .upsert(traduccion, { onConflict: "idevento,lang" });

  if (error) throw error;
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

async function traducirConOpenAI(campos: Partial<EventoBase>, lang: string, protectedTerms: string[]): Promise<Traduccion> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no configurada");
  }

  const payload: Record<string, string> = {};
  (["nombre", "descripcion", "lugar", "direccion", "costo"] as const).forEach((k) => {
    const valor = campos[k];
    if (valor != null && String(valor).trim().length > 0) {
      payload[k] = String(valor);
    }
  });

  const protectedList = protectedTerms.length > 0 ? protectedTerms.join(", ") : TERMINOS_GASTRONOMICOS_NO_TRADUCIR.join(", ");
  const reglasNoTraducir = `
Do NOT translate cultural food names such as:
${protectedList}.

Keep these terms EXACTLY as written.
Do not translate, paraphrase, pluralize, or localize them.
`.trim();
  const messages = [
    {
      role: "system",
      content: `
You are a professional food menu and event description translator.
Target language: ${lang}.
${reglasNoTraducir}
Translate the text naturally while strictly respecting these rules.
Keep proper nouns unchanged. Keep promotional tone. Do not add new information.
Return JSON with keys: nombre, descripcion, lugar, direccion, costo.
      `.trim(),
    },
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

  return {
    idevento: 0,
    lang,
    nombre: parsed.nombre ?? null,
    descripcion: parsed.descripcion ?? null,
    lugar: parsed.lugar ?? null,
    direccion: parsed.direccion ?? null,
    costo: parsed.costo ?? null,
  };
}

function responder(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return responder({ ok: false, error: "Use POST" }, 405);
  }

  let payload: { idEvento?: number; lang?: string };
  try {
    payload = await req.json();
  } catch (_e) {
    return responder({ ok: false, error: "JSON inválido" }, 400);
  }

  const idevento = Number(payload.idEvento);
  const lang = normalizeLang(payload.lang);

  if (!Number.isFinite(idevento) || idevento <= 0) {
    return responder({ ok: false, error: "idEvento requerido" }, 400);
  }

  if (!SUPPORTED_LANGS.includes(lang)) {
    return responder({ ok: false, error: `Idioma no soportado: ${lang}` }, 400);
  }

  try {
    const eventoBase = await obtenerEvento(idevento);
    if (!eventoBase) return responder({ ok: false, error: "Evento no encontrado" }, 404);

    if (lang === "es") {
      return responder({ ok: true, source: "original", data: eventoBase });
    }

    const glosario = await obtenerGlosario(eventoBase.idComercio);
    const protectedTerms = buildProtectedTerms(glosario);

    const cache = await buscarCache(idevento, lang);
    if (cache) return responder({ ok: true, source: "cache", data: cache });

    const traduccion = await traducirConOpenAI(eventoBase, lang, protectedTerms);
    traduccion.idevento = idevento;
    await guardarCache(traduccion);

    return responder({ ok: true, source: "translated", data: traduccion });
  } catch (error) {
    console.error("💥 translate-evento error:", error);
    return responder({ ok: false, error: String(error) }, 500);
  }
});
