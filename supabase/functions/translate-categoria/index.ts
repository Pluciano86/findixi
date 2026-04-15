// Supabase Edge Function: translate-categoria
// Traduce nombres de categorías desde español a varios idiomas.

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

const TARGET_LANGS: Record<string, string> = {
  en: 'English',
  zh: 'Chinese (Simplified)',
  fr: 'French',
  pt: 'Portuguese',
  de: 'German',
  it: 'Italian',
  ko: 'Korean',
  ja: 'Japanese',
};

const RESPONSE_KEYS = Object.freeze([
  'nombre_en',
  'nombre_zh',
  'nombre_fr',
  'nombre_pt',
  'nombre_de',
  'nombre_it',
  'nombre_ko',
  'nombre_ja',
]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function buildSystemMessage() {
  const targets = Object.entries(TARGET_LANGS)
    .map(([code, label]) => `- ${code}: ${label}`)
    .join('\n');

  return `
You are a professional taxonomy translator for local business categories.
Source language is Spanish (es).

Translate the category name into these target languages:
${targets}

Rules:
- Keep translations short and natural (1 to 5 words).
- Use category labels, not full sentences.
- Preserve proper names and brand names if any.
- Return only valid JSON.
- Use exactly these keys: ${RESPONSE_KEYS.join(', ')}.
`.trim();
}

function normalizeResponse(parsed: Record<string, unknown>, nombreEs: string) {
  const aliases: Record<string, string[]> = {
    nombre_en: ['nombre_en', 'en', 'english', 'name_en'],
    nombre_zh: ['nombre_zh', 'zh', 'chinese', 'name_zh', 'nombre_cn'],
    nombre_fr: ['nombre_fr', 'fr', 'french', 'name_fr'],
    nombre_pt: ['nombre_pt', 'pt', 'portuguese', 'name_pt'],
    nombre_de: ['nombre_de', 'de', 'german', 'name_de'],
    nombre_it: ['nombre_it', 'it', 'italian', 'name_it'],
    nombre_ko: ['nombre_ko', 'ko', 'korean', 'name_ko'],
    nombre_ja: ['nombre_ja', 'ja', 'japanese', 'name_ja'],
  };

  const normalizeKey = (key: string) =>
    String(key || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z_]/g, '');

  const parsedMap = new Map<string, string>();
  for (const [key, value] of Object.entries(parsed || {})) {
    const txt = cleanText(value);
    if (!txt) continue;
    parsedMap.set(normalizeKey(key), txt);
  }

  const out: Record<string, string> = {
    nombre: nombreEs,
    nombre_es: nombreEs,
  };

  for (const key of RESPONSE_KEYS) {
    const direct = cleanText(parsed[key]);
    if (direct) {
      out[key] = direct;
      continue;
    }

    const candidates = aliases[key] || [key];
    let resolved = '';
    for (const alias of candidates) {
      const match = parsedMap.get(normalizeKey(alias));
      if (match) {
        resolved = match;
        break;
      }
    }

    out[key] = resolved || nombreEs;
  }

  return out;
}

async function traducirNombre(nombreEs: string) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY no configurada en Supabase.');
  }

  const completion = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemMessage() },
        {
          role: 'user',
          content: JSON.stringify({
            nombre_es: nombreEs,
          }),
        },
      ],
    }),
  });

  if (!completion.ok) {
    const err = await completion.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const result = await completion.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI no devolvió contenido.');

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(content);
  } catch (_error) {
    throw new Error('No se pudo parsear la respuesta JSON de OpenAI.');
  }

  return normalizeResponse(parsed, nombreEs);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return responder({ ok: false, error: 'Use POST' }, 405);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch (_error) {
    return responder({ ok: false, error: 'JSON inválido' }, 400);
  }

  const nombreEs = cleanText(payload.nombre_es ?? payload.nombre);
  if (!nombreEs) {
    return responder({ ok: false, error: 'nombre_es es requerido' }, 400);
  }

  if (nombreEs.length > 120) {
    return responder({ ok: false, error: 'nombre_es demasiado largo' }, 400);
  }

  try {
    const data = await traducirNombre(nombreEs);
    return responder({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('translate-categoria error:', message);
    return responder({ ok: false, error: message }, 500);
  }
});
