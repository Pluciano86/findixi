// Supabase Edge Function: glosario-terminos
// CRUD de términos "no traducir" por comercio.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_TOKEN = Deno.env.get("ADMIN_GLOSARIO_TOKEN") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

type GlosarioRow = { termino: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function unauthorized() {
  return json({ ok: false, error: "Unauthorized" }, 401);
}

function parseIdComercio(input: unknown): number | null {
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function sanitizeTerminos(terminos: unknown): string[] {
  if (!Array.isArray(terminos)) return [];

  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const raw of terminos) {
    const value = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
    if (!value) continue;
    if (value.length > 40) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    cleaned.push(value);
  }

  return cleaned;
}

async function obtenerLista(supabase: ReturnType<typeof createClient>, idComercio: number): Promise<string[]> {
  const { data, error } = await supabase
    .from("comercio_i18n_glosario")
    .select("termino")
    .eq("idComercio", idComercio)
    .order("termino", { ascending: true });

  if (error) throw error;
  return (data as GlosarioRow[]).map((row) => row.termino);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!ADMIN_TOKEN) {
    console.error("ADMIN_GLOSARIO_TOKEN no configurado");
    return json({ ok: false, error: "Server configuration error" }, 500);
  }

  const providedToken = req.headers.get("x-admin-token");
  if (!providedToken || providedToken !== ADMIN_TOKEN) {
    return unauthorized();
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados");
    return json({ ok: false, error: "Server configuration error" }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const id = parseIdComercio(url.searchParams.get("idComercio"));
      if (!id) return json({ ok: false, error: "idComercio requerido" }, 400);

      const lista = await obtenerLista(supabase, id);
      return json({ ok: true, data: lista });
    }

    if (req.method === "POST") {
      let payload: { idComercio?: unknown; terminos?: unknown };
      try {
        payload = await req.json();
      } catch (_e) {
        return json({ ok: false, error: "JSON inválido" }, 400);
      }

      const id = parseIdComercio(payload.idComercio);
      if (!id) return json({ ok: false, error: "idComercio requerido" }, 400);

      const terminos = sanitizeTerminos(payload.terminos);
      if (terminos.length > 0) {
        const rows = terminos.map((termino) => ({ idComercio: id, termino }));
        const { error } = await supabase
          .from("comercio_i18n_glosario")
          .upsert(rows, { onConflict: "idComercio,termino" });

        if (error) throw error;
      }

      const lista = await obtenerLista(supabase, id);
      return json({ ok: true, data: lista });
    }

    if (req.method === "DELETE") {
      let payload: { idComercio?: unknown; termino?: unknown };
      try {
        payload = await req.json();
      } catch (_e) {
        return json({ ok: false, error: "JSON inválido" }, 400);
      }

      const id = parseIdComercio(payload.idComercio);
      const termino = typeof payload.termino === "string" ? payload.termino.trim() : "";

      if (!id || !termino) {
        return json({ ok: false, error: "idComercio y termino requeridos" }, 400);
      }

      if (termino.length > 40) {
        return json({ ok: false, error: "termino excede 40 caracteres" }, 400);
      }

      const { error } = await supabase
        .from("comercio_i18n_glosario")
        .delete()
        .eq("idComercio", id)
        .eq("termino", termino);

      if (error) throw error;

      const lista = await obtenerLista(supabase, id);
      return json({ ok: true, data: lista });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("glosario-terminos error:", error);
    return json({ ok: false, error: "Internal Server Error" }, 500);
  }
});
