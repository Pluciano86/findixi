// Edge Function: clover-sync-tax-rates
// Sincroniza tax rates de Clover y los mapea a productos locales.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLOVER_CLIENT_ID = Deno.env.get("CLOVER_CLIENT_ID") ?? "";
const CLOVER_CLIENT_SECRET = Deno.env.get("CLOVER_CLIENT_SECRET") ?? "";
const CLOVER_REDIRECT_URI = Deno.env.get("CLOVER_REDIRECT_URI") ?? "";
const CLOVER_OAUTH_BASE = Deno.env.get("CLOVER_OAUTH_BASE") ?? "https://sandbox.dev.clover.com";
const CLOVER_API_BASE = Deno.env.get("CLOVER_API_BASE") ?? "https://apisandbox.dev.clover.com";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeOauthApiBase(raw: string) {
  const fallback = "https://apisandbox.dev.clover.com";
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.pathname.startsWith("/auth-token")) {
      url.pathname = "/";
    }
    const host = url.host.toLowerCase();
    let mappedHost = host;
    if (host === "sandbox.dev.clover.com") mappedHost = "apisandbox.dev.clover.com";
    else if (host === "www.clover.com") mappedHost = "api.clover.com";
    else if (host === "www.eu.clover.com") mappedHost = "api.eu.clover.com";
    else if (host === "www.la.clover.com") mappedHost = "api.la.clover.com";
    url.host = mappedHost;
    url.pathname = "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

const OAUTH_API_BASE = normalizeOauthApiBase(CLOVER_OAUTH_BASE);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toArray(x: any) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.elements)) return x.elements;
  return [];
}

const columnExistsCache = new Map<string, Map<string, boolean>>();
async function hasColumn(table: string, column: string) {
  const cache = columnExistsCache.get(table) ?? new Map<string, boolean>();
  if (!columnExistsCache.has(table)) columnExistsCache.set(table, cache);
  if (cache.has(column)) return cache.get(column)!;
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) {
    cache.set(column, true);
    return true;
  }
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("column") && msg.includes("does not exist")) {
    cache.set(column, false);
    return false;
  }
  throw error;
}

class CloverApiError extends Error {
  status: number;
  raw: string;
  url: string;

  constructor(status: number, url: string, raw: string) {
    super(`Clover API ${url} -> ${status}: ${raw}`);
    this.status = status;
    this.raw = raw;
    this.url = url;
  }
}

async function refreshToken(refresh_token: string) {
  const tokenUrl = new URL("/oauth/v2/refresh", OAUTH_API_BASE);
  const payload = {
    refresh_token,
    client_id: CLOVER_CLIENT_ID,
  };
  const formBody = new URLSearchParams(payload).toString();
  const jsonBody = JSON.stringify(payload);
  const doRequest = async (contentType: string, body: string) => {
    const resp = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": contentType, "Accept": "application/json" },
      body,
    });
    const raw = await resp.text();
    return { resp, raw };
  };

  const first = await doRequest("application/json", jsonBody);
  if (first.resp.ok) return JSON.parse(first.raw);

  const shouldFallback =
    first.resp.status === 415 ||
    first.raw.toLowerCase().includes("code") && first.raw.toLowerCase().includes("must not be null");
  if (shouldFallback) {
    const second = await doRequest("application/x-www-form-urlencoded", formBody);
    if (second.resp.ok) return JSON.parse(second.raw);
    throw new Error(`Refresh token failed ${second.resp.status}: ${second.raw}`);
  }

  throw new Error(`Refresh token failed ${first.resp.status}: ${first.raw}`);
}

async function fetchClover(path: string, token: string) {
  const url = path.startsWith("http") ? new URL(path) : new URL(path, CLOVER_API_BASE);
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const raw = await resp.text();
    throw new CloverApiError(resp.status, url.pathname, raw);
  }
  return await resp.json();
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  const url = new URL(req.url);
  const idComercio = Number(url.searchParams.get("idComercio") || url.searchParams.get("id"));

  if (!Number.isFinite(idComercio) || idComercio <= 0) return jsonResponse({ error: "idComercio requerido" }, 400);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: "Supabase env missing" }, 500);
  if (!CLOVER_CLIENT_ID || !CLOVER_CLIENT_SECRET) return jsonResponse({ error: "Clover env missing" }, 500);

  const { data: conn, error: connErr } = await supabase
    .from("clover_conexiones")
    .select("*")
    .eq("idComercio", idComercio)
    .maybeSingle();

  if (connErr || !conn) return jsonResponse({ error: "Conexión Clover no encontrada para este comercio" }, 404);
  let accessToken: string = conn.access_token;
  let refreshTokenVal: string | null = conn.refresh_token ?? null;
  let expiresAt: string | null = conn.expires_at ?? null;
  const merchantId: string | null = conn.clover_merchant_id ?? null;
  let refreshedAfter401 = false;

  if (!merchantId) return jsonResponse({ error: "clover_merchant_id no guardado; vuelve a conectar Clover" }, 400);

  if (refreshTokenVal) {
    const expMs = expiresAt ? Date.parse(expiresAt) : NaN;
    const shouldRefresh = !expiresAt || Number.isNaN(expMs) || expMs - Date.now() < 120_000;
    if (shouldRefresh) {
      try {
        const tokenData = await refreshToken(refreshTokenVal);
        accessToken = tokenData.access_token ?? accessToken;
        refreshTokenVal = tokenData.refresh_token ?? refreshTokenVal;
        const expires_in = Number(tokenData.expires_in ?? tokenData.expires) || null;
        expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : expiresAt;
        await supabase.from("clover_conexiones").update({
          access_token: accessToken,
          refresh_token: refreshTokenVal,
          expires_at: expiresAt,
        }).eq("idComercio", idComercio);
      } catch (e) {
        console.warn("No se pudo refrescar token", e);
      }
    }
  }

  const fetchCloverWithAutoRefresh = async (path: string) => {
    try {
      return await fetchClover(path, accessToken);
    } catch (err) {
      if (err instanceof CloverApiError && err.status === 401 && refreshTokenVal && !refreshedAfter401) {
        refreshedAfter401 = true;
        console.warn("[clover-tax-rates] 401 from Clover, refreshing token");
        try {
          const tokenData = await refreshToken(refreshTokenVal);
          accessToken = tokenData.access_token ?? accessToken;
          refreshTokenVal = tokenData.refresh_token ?? refreshTokenVal;
          const expires_in = Number(tokenData.expires_in ?? tokenData.expires) || null;
          expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : expiresAt;
          await supabase.from("clover_conexiones").update({
            access_token: accessToken,
            refresh_token: refreshTokenVal,
            expires_at: expiresAt,
          }).eq("idComercio", idComercio);
        } catch (refreshErr) {
          console.warn("[clover-tax-rates] refresh after 401 failed", refreshErr);
          throw err;
        }
        return await fetchClover(path, accessToken);
      }
      throw err;
    }
  };

  const { data: menus, error: menusErr } = await supabase
    .from("menus")
    .select("id")
    .eq("idComercio", idComercio);
  if (menusErr) return jsonResponse({ error: menusErr.message }, 500);
  const menuIds = (menus ?? []).map((m) => m.id);

  const { data: productos, error: prodErr } = await supabase
    .from("productos")
    .select("id, clover_item_id, idMenu")
    .in("idMenu", menuIds);
  if (prodErr) return jsonResponse({ error: prodErr.message }, 500);
  const productByCloverId = new Map<string, number>();
  for (const p of productos ?? []) {
    if (p.clover_item_id) productByCloverId.set(p.clover_item_id, p.id);
  }

  const taxHasIdComercioLower = await hasColumn("clover_tax_rates", "idcomercio");
  const taxHasIdComercioCamel = taxHasIdComercioLower ? false : await hasColumn("clover_tax_rates", "idComercio");
  if (!taxHasIdComercioLower && !taxHasIdComercioCamel) {
    return jsonResponse({ error: "clover_tax_rates: falta columna idcomercio/idComercio" }, 500);
  }
  const taxIdComercioCol = taxHasIdComercioLower ? "idcomercio" : "idComercio";

  const ptrHasIdProductoLower = await hasColumn("producto_tax_rates", "idproducto");
  const ptrHasIdProductoCamel = ptrHasIdProductoLower ? false : await hasColumn("producto_tax_rates", "idProducto");
  if (!ptrHasIdProductoLower && !ptrHasIdProductoCamel) {
    return jsonResponse({ error: "producto_tax_rates: falta columna idproducto/idProducto" }, 500);
  }
  const ptrHasIdTaxRateLower = await hasColumn("producto_tax_rates", "idtaxrate");
  const ptrHasIdTaxRateCamel = ptrHasIdTaxRateLower ? false : await hasColumn("producto_tax_rates", "idTaxRate");
  if (!ptrHasIdTaxRateLower && !ptrHasIdTaxRateCamel) {
    return jsonResponse({ error: "producto_tax_rates: falta columna idtaxrate/idTaxRate" }, 500);
  }
  const ptrIdProductoCol = ptrHasIdProductoLower ? "idproducto" : "idProducto";
  const ptrIdTaxRateCol = ptrHasIdTaxRateLower ? "idtaxrate" : "idTaxRate";

  const taxRatesJson = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/tax_rates`);
  const taxRates = toArray(taxRatesJson?.elements ?? taxRatesJson?.taxRates ?? taxRatesJson);

  const taxPayload = taxRates.map((t: any) => {
    const rateNum = Number(t?.rate);
    return {
      [taxIdComercioCol]: idComercio,
      clover_tax_rate_id: t?.id ?? null,
      nombre: t?.name ?? null,
      rate: Number.isFinite(rateNum) ? rateNum : null,
      is_default: Boolean(t?.isDefault ?? t?.default ?? false),
      is_active: t?.isActive ?? t?.active ?? true,
    };
  }).filter((t: any) => t.clover_tax_rate_id);

  if (taxPayload.length) {
    const { error: upsertErr } = await supabase
      .from("clover_tax_rates")
      .upsert(taxPayload, { onConflict: `${taxIdComercioCol},clover_tax_rate_id` });
    if (upsertErr) return jsonResponse({ error: upsertErr.message }, 500);
  }

  const { data: taxRows, error: taxRowsErr } = await supabase
    .from("clover_tax_rates")
    .select("id, clover_tax_rate_id")
    .eq(taxIdComercioCol, idComercio);
  if (taxRowsErr) return jsonResponse({ error: taxRowsErr.message }, 500);
  const taxIdByClover = new Map<string, number>();
  for (const t of taxRows ?? []) taxIdByClover.set(t.clover_tax_rate_id, t.id);

  const joinRows: Array<Record<string, number>> = [];

  for (const tr of taxPayload) {
    const taxId = tr.clover_tax_rate_id as string;
    const taxRowId = taxIdByClover.get(taxId);
    if (!taxRowId) continue;
    const itemsJson = await fetchCloverWithAutoRefresh(
      `/v3/merchants/${merchantId}/tax_rates/${taxId}/items?limit=1000`,
    );
    const items = toArray(itemsJson?.elements ?? itemsJson?.items ?? itemsJson);
    for (const item of items) {
      const productId = item?.id ? productByCloverId.get(item.id) : undefined;
      if (productId) {
        const row: Record<string, number> = {};
        row[ptrIdProductoCol] = productId;
        row[ptrIdTaxRateCol] = taxRowId;
        joinRows.push(row);
      }
    }
  }

  const taxRateIds = (taxRows ?? []).map((t) => t.id);
  if (taxRateIds.length) {
    const { error: delErr } = await supabase
      .from("producto_tax_rates")
      .delete()
      .in(ptrIdTaxRateCol, taxRateIds);
    if (delErr) return jsonResponse({ error: delErr.message }, 500);
  }

  const chunkSize = 1000;
  for (let i = 0; i < joinRows.length; i += chunkSize) {
    const chunk = joinRows.slice(i, i + chunkSize);
    const { error: insertErr } = await supabase
      .from("producto_tax_rates")
      .insert(chunk);
    if (insertErr) return jsonResponse({ error: insertErr.message }, 500);
  }

  return jsonResponse({
    ok: true,
    taxRates: taxPayload.length,
    productMappings: joinRows.length,
  });
}

Deno.serve(handler);
