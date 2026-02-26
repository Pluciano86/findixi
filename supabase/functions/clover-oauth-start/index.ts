// Edge Function: clover-oauth-start
// Inicia el flujo OAuth de Clover y redirige al usuario.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLOVER_CLIENT_ID = Deno.env.get("CLOVER_CLIENT_ID") ?? "";
const CLOVER_REDIRECT_URI = Deno.env.get("CLOVER_REDIRECT_URI") ?? "";
const CLOVER_BASE_URL = Deno.env.get("CLOVER_BASE_URL") ?? "https://sandbox.dev.clover.com";

const ALLOWED_RETURN_HOSTS = new Set([
  "comercio.enpe-erre.com",
  "admin.enpe-erre.com",
  "test.enpe-erre.com",
  "comercio.test.enpe-erre.com",
]);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toBase64Url(input: Uint8Array) {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isReturnToAllowed(urlStr: string | null): string | null {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (ALLOWED_RETURN_HOSTS.has(host)) return parsed.toString();
    // Permitir deploys en Netlify relacionados (p.e. previews) pero solo bajo dominio netlify.app
    if (host.endsWith(".netlify.app")) return parsed.toString();
    return null;
  } catch (_e) {
    return null;
  }
}

async function signState(payload: Record<string, unknown>) {
  const enc = new TextEncoder();
  const json = JSON.stringify(payload);
  const data = enc.encode(json);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SERVICE_ROLE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return `${toBase64Url(data)}.${toBase64Url(sig)}`;
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Supabase env vars missing" }), { status: 500, headers: corsHeaders });
  }
  if (!CLOVER_CLIENT_ID || !CLOVER_REDIRECT_URI) {
    return new Response(JSON.stringify({ error: "Clover client env vars missing" }), { status: 500, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const merchantId = url.searchParams.get("merchant_id");
  const idComercioRaw = url.searchParams.get("idComercio") || url.searchParams.get("id");
  const returnToRaw = url.searchParams.get("return_to");
  const returnTo = isReturnToAllowed(returnToRaw);

  let idComercio = Number(idComercioRaw);
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    // Intentar resolver por merchant_id si existe
    if (merchantId) {
      const { data: conn } = await supabase
        .from("clover_conexiones")
        .select("idComercio")
        .eq("clover_merchant_id", merchantId)
        .maybeSingle();
      if (conn?.idComercio) {
        idComercio = Number(conn.idComercio);
      }
    }
  }
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    const fallbackHost = returnTo ? new URL(returnTo).origin : "https://comercio.enpe-erre.com";
    const vincularUrl = `${fallbackHost}/vincularClover.html${merchantId ? `?merchant_id=${encodeURIComponent(merchantId)}` : ""}`;
    return new Response(
      JSON.stringify({
        error: "idComercio inválido",
        vincular_url: vincularUrl,
        hint: "Abre el vincular_url para asociar este merchant con un idComercio.",
      }),
      { status: 400, headers: corsHeaders },
    );
  }

  // Valida que exista el comercio
  const { data: comercio, error } = await supabase
    .from("Comercios")
    .select("id")
    .eq("id", idComercio)
    .maybeSingle();

  if (error || !comercio) {
    console.warn("clover-oauth-start comercio no encontrado", { idComercio, error });
    return new Response(JSON.stringify({ error: "Comercio no encontrado" }), { status: 404, headers: corsHeaders });
  }

  const nonce = crypto.randomUUID();
  const statePayload: Record<string, unknown> = { idComercio, nonce, ts: Date.now() };
  if (returnTo) statePayload.return_to = returnTo;
  if (merchantId) statePayload.merchant_id = merchantId;
  const state = await signState(statePayload);

  // Sandbox authorize endpoint (v2) + login handoff
  const base = CLOVER_BASE_URL;
  const authorizeUrl = new URL("/oauth/v2/authorize", base);
  authorizeUrl.searchParams.set("client_id", CLOVER_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", CLOVER_REDIRECT_URI);
  authorizeUrl.searchParams.set("state", state);

  const loginUrl = new URL("/login", base);
  loginUrl.searchParams.set("hardRedirect", "true");
  loginUrl.searchParams.set("webRedirectUrl", authorizeUrl.toString());

  return Response.redirect(loginUrl.toString(), 302);
}

Deno.serve(handler);
