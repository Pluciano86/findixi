// Edge Function: clover-create-order
// Crea una orden en Clover, genera Hosted Checkout y guarda la orden localmente.

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

const columnCache = new Map<string, Set<string> | null>();

async function getTableColumns(table: string, schema = "public"): Promise<Set<string> | null> {
  const key = `${schema}.${table}`;
  if (columnCache.has(key)) return columnCache.get(key)!;
  try {
    const { data, error } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", schema)
      .eq("table_name", table);
    if (error) {
      console.warn("[clover-create-order] No se pudo obtener columnas de", table, error.message);
      columnCache.set(key, null);
      return null;
    }
    const cols = new Set<string>();
    (data || []).forEach((r: any) => r?.column_name && cols.add(r.column_name));
    columnCache.set(key, cols);
    return cols;
  } catch (err) {
    console.warn("[clover-create-order] Error inesperado obteniendo columnas", err);
    columnCache.set(key, null);
    return null;
  }
}

async function resolveColumn(table: string, candidates: string[]) {
  const cols = await getTableColumns(table);
  if (cols) {
    for (const name of candidates) {
      if (cols.has(name)) return name;
    }
  }
  return candidates[0];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PICKUP_ORDER_TYPE_NAME = "Pickup (Findixi)";
const PICKUP_ORDER_TYPE_NAME_ALT = "Pick Up (Findixi)";
const PICKUP_ORDER_NOTE = "***** ORDEN FINDIXI PICKUP *****";

function normalizeName(value: string) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string) {
  return normalizeName(value).replace(/[^a-z0-9]/g, "");
}

function extractOrderTypeName(orderType: any) {
  return (
    orderType?.label ??
    orderType?.name ??
    orderType?.title ??
    orderType?.displayName ??
    orderType?.orderTypeName ??
    null
  );
}

function extractSystemOrderTypeId(systemType: any) {
  return (
    systemType?.id ??
    systemType?.systemOrderTypeId ??
    systemType?.systemOrderType ??
    systemType?.code ??
    null
  );
}

function isPickupSystemType(systemType: any) {
  const raw = [
    systemType?.id,
    systemType?.name,
    systemType?.label,
    systemType?.displayName,
    systemType?.type,
    systemType?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /pickup|pick\s*up|take\s*out|takeout|to-go|togo|carry\s*out/.test(raw);
}

function toArray(x: any) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.elements)) return x.elements;
  return [];
}

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

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader) return "";
  if (authHeader.toLowerCase().startsWith("bearer ")) return authHeader.slice(7).trim();
  return authHeader.trim();
}

async function getAuthUserId(req: Request): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.warn("[clover-create-order] No se pudo resolver auth user:", error.message);
      return null;
    }
    return data?.user?.id ?? null;
  } catch (err) {
    console.warn("[clover-create-order] Error resolviendo auth user:", err);
    return null;
  }
}

function needsReconnectResponse(message = "Clover token expirado, reconecta la cuenta") {
  return jsonResponse({ error: message, needs_reconnect: true }, 401);
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function toNumber(value: unknown) {
  const num = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(num) ? num : NaN;
}

function normalizeModifierIds(input: unknown): number[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((m) => (typeof m === "number" ? m : m?.idOpcionItem ?? m?.id))
      .map((m) => Number(m))
      .filter((m) => Number.isFinite(m) && m > 0);
  }
  return [];
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

async function cloverRequest(
  path: string,
  token: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const url = path.startsWith("http") ? new URL(path) : new URL(path, CLOVER_API_BASE);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(options.headers ?? {}),
  };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const resp = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers,
    body,
  });
  if (!resp.ok) {
    const raw = await resp.text();
    throw new CloverApiError(resp.status, url.pathname, raw);
  }
  if (resp.status === 204) return null;
  return await resp.json();
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ error: "Metodo no permitido" }, 405);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON invalido" }, 400);
  }

  const idComercio = Number(body?.idComercio ?? body?.id);
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    return jsonResponse({ error: "idComercio requerido" }, 400);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: "Supabase env missing" }, 500);
  if (!CLOVER_CLIENT_ID || !CLOVER_CLIENT_SECRET) return jsonResponse({ error: "Clover env missing" }, 500);

  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (!rawItems.length) return jsonResponse({ error: "items requerido" }, 400);

  const modeRaw = String(body?.mode ?? body?.order_type ?? "pickup").toLowerCase();
  const mode = modeRaw === "mesa" ? "mesa" : modeRaw === "pickup" ? "pickup" : "pickup";
  const mesaVal = body?.mesa ?? body?.table ?? null;
  const mesa = typeof mesaVal === "string" || typeof mesaVal === "number" ? String(mesaVal).trim() : null;
  const sourceRaw = String(body?.source ?? (mode === "mesa" ? "qr" : "app")).toLowerCase();
  const source = sourceRaw === "qr" || sourceRaw === "app" ? sourceRaw : (mode === "mesa" ? "qr" : "app");
  const authUserId = await getAuthUserId(req);
  const customer = body?.customer && typeof body.customer === "object" ? body.customer : null;
  const customerName = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim();
  const customerEmail = typeof customer?.email === "string" ? customer.email.trim() : null;
  const customerPhone = typeof customer?.phone === "string" ? customer.phone.trim() : null;

  const items = rawItems.map((item: any) => {
    const idProducto = Number(item?.idProducto ?? item?.id);
    const qty = Number(item?.qty ?? 1);
    const nota = typeof item?.nota === "string" ? item.nota.trim() : undefined;
    return {
      idProducto,
      qty,
      nota,
      modifiers: normalizeModifierIds(item?.modifiers ?? item?.mods),
    };
  });

  const invalidItem = items.find((item) => !Number.isFinite(item.idProducto) || item.idProducto <= 0 || !Number.isFinite(item.qty) || item.qty <= 0);
  if (invalidItem) return jsonResponse({ error: "items invalidos" }, 400);

  const idempotencyKey = typeof body?.idempotencyKey === "string" && body.idempotencyKey.trim()
    ? body.idempotencyKey.trim()
    : null;

  const orderLinkToken = crypto.randomUUID();

  if (idempotencyKey) {
    const { data: existingOrder, error: existingErr } = await supabase
      .from("ordenes")
      .select("id, status, checkout_url, clover_order_id, checkout_session_id, total")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingErr) return jsonResponse({ error: existingErr.message }, 500);
    if (existingOrder) {
      return jsonResponse({ ok: true, reused: true, order: existingOrder });
    }
  }

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

  {
    const expMs = expiresAt ? Date.parse(expiresAt) : NaN;
    const shouldRefresh = !expiresAt || Number.isNaN(expMs) || expMs - Date.now() < 120_000;
    if (shouldRefresh) {
      if (!refreshTokenVal) {
        return needsReconnectResponse();
      }
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
        return needsReconnectResponse();
      }
    }
  }

  const fetchCloverWithAutoRefresh = async (
    path: string,
    options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    try {
      return await cloverRequest(path, accessToken, options);
    } catch (err) {
      if (err instanceof CloverApiError && err.status === 401 && refreshTokenVal && !refreshedAfter401) {
        refreshedAfter401 = true;
        console.warn("[clover-create-order] 401 from Clover, refreshing token");
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
          console.warn("[clover-create-order] refresh after 401 failed", refreshErr);
          throw err;
        }
        return await cloverRequest(path, accessToken, options);
      }
      throw err;
    }
  };

  const ensurePickupOrderType = async () => {
    const desiredKeys = new Set([
      normalizeKey(PICKUP_ORDER_TYPE_NAME),
      normalizeKey(PICKUP_ORDER_TYPE_NAME_ALT),
    ]);

    const existingId = (conn as any)?.clover_order_type_id ?? null;
    const existingName = (conn as any)?.clover_order_type_name ?? null;
    if (existingId) {
      return { id: existingId, name: existingName ?? PICKUP_ORDER_TYPE_NAME };
    }

    const orderTypesResp = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/order_types?limit=200`);
    const orderTypes = toArray(orderTypesResp?.elements ?? orderTypesResp?.orderTypes ?? orderTypesResp);
    const nameKey =
      orderTypes.find((ot: any) => typeof ot?.label === "string")?.label !== undefined ? "label"
        : orderTypes.find((ot: any) => typeof ot?.name === "string")?.name !== undefined ? "name"
        : orderTypes.find((ot: any) => typeof ot?.title === "string")?.title !== undefined ? "title"
        : orderTypes.find((ot: any) => typeof ot?.displayName === "string")?.displayName !== undefined ? "displayName"
        : "label";

    const existing = orderTypes.find((ot: any) => {
      const label = extractOrderTypeName(ot);
      return label && desiredKeys.has(normalizeKey(label));
    });

    let orderTypeId = existing?.id ?? null;
    let orderTypeName = extractOrderTypeName(existing) ?? null;

    if (!orderTypeId) {
      let pickupSystemId: string | null = null;
      try {
        const systemResp = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/system_order_types`);
        const systemTypes = toArray(systemResp?.elements ?? systemResp?.systemOrderTypes ?? systemResp);
        const pickupSystem = systemTypes.find(isPickupSystemType);
        pickupSystemId = extractSystemOrderTypeId(pickupSystem);
      } catch (err) {
        console.warn("[clover-create-order] No se pudo leer system_order_types, creando order type sin systemOrderTypeId", err);
        pickupSystemId = null;
      }

      const payloadCandidates: Record<string, unknown>[] = [
        { [nameKey]: PICKUP_ORDER_TYPE_NAME, ...(pickupSystemId ? { systemOrderTypeId: pickupSystemId } : {}) },
        { label: PICKUP_ORDER_TYPE_NAME, ...(pickupSystemId ? { systemOrderTypeId: pickupSystemId } : {}) },
        { name: PICKUP_ORDER_TYPE_NAME, ...(pickupSystemId ? { systemOrderTypeId: pickupSystemId } : {}) },
        { [nameKey]: PICKUP_ORDER_TYPE_NAME },
        { label: PICKUP_ORDER_TYPE_NAME },
        { name: PICKUP_ORDER_TYPE_NAME },
      ];

      let created: any = null;
      let lastErr: unknown = null;
      for (const payload of payloadCandidates) {
        try {
          created = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/order_types`, {
            method: "POST",
            body: payload,
          });
          if (created?.id) break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!created?.id) {
        if (lastErr instanceof Error) throw lastErr;
        throw new Error("No se pudo crear order type Pickup (Findixi)");
      }
      orderTypeId = created.id;
      orderTypeName = extractOrderTypeName(created) ?? PICKUP_ORDER_TYPE_NAME;
    }

    const cols = await getTableColumns("clover_conexiones");
    const updatePayload: Record<string, unknown> = {};
    if (cols?.has("clover_order_type_id")) updatePayload.clover_order_type_id = orderTypeId;
    if (cols?.has("clover_order_type_name")) updatePayload.clover_order_type_name = orderTypeName;
    if (cols?.has("order_type_ready_at")) updatePayload.order_type_ready_at = new Date().toISOString();
    if (Object.keys(updatePayload).length) {
      await supabase.from("clover_conexiones").update(updatePayload).eq("idComercio", idComercio);
    }

    return { id: orderTypeId, name: orderTypeName };
  };

  const productIds = Array.from(new Set(items.map((item) => item.idProducto)));

  const { data: menus, error: menusErr } = await supabase
    .from("menus")
    .select("id")
    .eq("idComercio", idComercio);
  if (menusErr) return jsonResponse({ error: menusErr.message }, 500);
  const menuIds = (menus ?? []).map((m) => m.id);
  if (!menuIds.length) return jsonResponse({ error: "Comercio sin menus configurados" }, 400);

  const { data: products, error: prodErr } = await supabase
    .from("productos")
    .select("id, nombre, precio, clover_item_id, idMenu")
    .in("id", productIds)
    .in("idMenu", menuIds);
  if (prodErr) return jsonResponse({ error: prodErr.message }, 500);

  const productMap = new Map<number, any>();
  for (const p of products ?? []) productMap.set(p.id, p);

  const missingProducts = productIds.filter((id) => !productMap.has(id));
  if (missingProducts.length) {
    return jsonResponse({ error: "Productos no encontrados o no pertenecen al comercio", missingProducts }, 400);
  }

  const modifierIds = Array.from(new Set(items.flatMap((item) => item.modifiers)));
  const modifierMap = new Map<number, any>();
  const modifierByProduct = new Map<number, any[]>();
  const groupNameById = new Map<number, string>();

  if (modifierIds.length) {
    let groups: any[] = [];
    let groupIds: number[] = [];
    const groupToProduct = new Map<number, number>();
    {
      const resp = await supabase
        .from("producto_opcion_grupos")
        .select("id, idproducto, nombre")
        .in("idproducto", productIds);
      if (!resp.error) {
        groups = resp.data ?? [];
        groupIds = (groups ?? []).map((g) => g.id);
        for (const g of groups ?? []) {
          groupToProduct.set(g.id, g.idproducto);
          if (g.nombre) groupNameById.set(g.id, g.nombre);
        }
      } else {
        const msg = (resp.error?.message || "").toLowerCase();
        if (!(msg.includes("column") && msg.includes("idproducto") && msg.includes("does not exist"))) {
          return jsonResponse({ error: resp.error.message }, 500);
        }
        const fallback = await supabase
          .from("producto_opcion_grupos")
          .select("id, idProducto, nombre")
          .in("idProducto", productIds);
        if (fallback.error) return jsonResponse({ error: fallback.error.message }, 500);
        groups = fallback.data ?? [];
        groupIds = (groups ?? []).map((g) => g.id);
        for (const g of groups ?? []) {
          groupToProduct.set(g.id, g.idProducto);
          if (g.nombre) groupNameById.set(g.id, g.nombre);
        }
      }
    }

    if (!groupIds.length) {
      return jsonResponse({ error: "Los productos no tienen modificadores configurados" }, 400);
    }

    let modItems: any[] = [];
    {
      const resp = await supabase
        .from("producto_opcion_items")
        .select("id, clover_modifier_id, precio_extra, idgrupo, nombre")
        .in("id", modifierIds)
        .in("idgrupo", groupIds);
      if (!resp.error) {
        modItems = resp.data ?? [];
      } else {
        const msg = (resp.error?.message || "").toLowerCase();
        if (!(msg.includes("column") && msg.includes("idgrupo") && msg.includes("does not exist"))) {
          return jsonResponse({ error: resp.error.message }, 500);
        }
        const fallback = await supabase
          .from("producto_opcion_items")
          .select("id, clover_modifier_id, precio_extra, idGrupo, nombre")
          .in("id", modifierIds)
          .in("idGrupo", groupIds);
        if (fallback.error) return jsonResponse({ error: fallback.error.message }, 500);
        modItems = fallback.data ?? [];
      }
    }

    for (const m of modItems ?? []) {
      const productId = groupToProduct.get(m.idgrupo ?? m.idGrupo);
      if (!productId) continue;
      const groupId = m.idgrupo ?? m.idGrupo;
      modifierMap.set(m.id, {
        ...m,
        idProducto: productId,
        grupo_nombre: groupId ? groupNameById.get(groupId) : undefined,
      });
      const list = modifierByProduct.get(productId) ?? [];
      list.push(m);
      modifierByProduct.set(productId, list);
    }

    const missingModifiers = modifierIds.filter((id) => !modifierMap.has(id));
    if (missingModifiers.length) {
      return jsonResponse({ error: "Modificadores invalidos", missingModifiers }, 400);
    }
  }

  for (const item of items) {
    const product = productMap.get(item.idProducto);
    if (!product?.clover_item_id) {
      return jsonResponse({ error: "Producto sin clover_item_id", idProducto: item.idProducto }, 400);
    }
    for (const modId of item.modifiers) {
      const mod = modifierMap.get(modId);
      if (!mod || mod.idProducto !== item.idProducto) {
        return jsonResponse({ error: "Modificador no pertenece al producto", idProducto: item.idProducto, modId }, 400);
      }
      if (!mod.clover_modifier_id) {
        return jsonResponse({ error: "Modificador sin clover_modifier_id", modId }, 400);
      }
    }
  }

  let taxRows: any[] = [];
  {
    const resp = await supabase
      .from("clover_tax_rates")
      .select("id, clover_tax_rate_id, nombre, rate, is_default")
      .eq("idcomercio", idComercio);
    if (!resp.error) {
      taxRows = resp.data ?? [];
    } else {
      const msg = (resp.error?.message || "").toLowerCase();
      if (!(msg.includes("column") && msg.includes("idcomercio") && msg.includes("does not exist"))) {
        return jsonResponse({ error: resp.error.message }, 500);
      }
      const fallback = await supabase
        .from("clover_tax_rates")
        .select("id, clover_tax_rate_id, nombre, rate, is_default")
        .eq("idComercio", idComercio);
      if (fallback.error) return jsonResponse({ error: fallback.error.message }, 500);
      taxRows = fallback.data ?? [];
    }
  }

  const taxById = new Map<number, any>();
  for (const t of taxRows ?? []) taxById.set(t.id, t);
  const defaultTaxRates = (taxRows ?? []).filter((t) => Boolean(t.is_default) && Number.isFinite(Number(t.rate)));

  let productTaxRows: any[] = [];
  {
    const resp = await supabase
      .from("producto_tax_rates")
      .select("idproducto, idtaxrate")
      .in("idproducto", productIds);
    if (!resp.error) {
      productTaxRows = resp.data ?? [];
    } else {
      const msg = (resp.error?.message || "").toLowerCase();
      if (!(msg.includes("column") && msg.includes("idproducto") && msg.includes("does not exist"))) {
        return jsonResponse({ error: resp.error.message }, 500);
      }
      const fallback = await supabase
        .from("producto_tax_rates")
        .select("idProducto, idTaxRate")
        .in("idProducto", productIds);
      if (fallback.error) return jsonResponse({ error: fallback.error.message }, 500);
      productTaxRows = fallback.data ?? [];
    }
  }

  const productTaxMap = new Map<number, any[]>();
  for (const row of productTaxRows ?? []) {
    const rate = taxById.get(row.idtaxrate ?? row.idTaxRate);
    if (!rate) continue;
    const list = productTaxMap.get(row.idproducto ?? row.idProducto) ?? [];
    list.push(rate);
    productTaxMap.set(row.idproducto ?? row.idProducto, list);
  }

  const resolveTaxRates = (idProducto: number) => {
    const mapped = productTaxMap.get(idProducto) ?? [];
    if (mapped.length) return mapped;
    return defaultTaxRates;
  };

  const toCheckoutTaxRates = (rates: any[]) =>
    rates
      .map((r) => ({ name: r.nombre ?? "Tax", rate: Number(r.rate) }))
      .filter((r) => Number.isFinite(r.rate) && r.rate > 0);

  let pickupOrderType: { id: string; name?: string | null } | null = null;
  if (mode === "pickup") {
    try {
      pickupOrderType = await ensurePickupOrderType();
    } catch (err) {
      console.error("Error asegurando order type Pickup", err);
      return jsonResponse({
        error: "No se pudo configurar Pickup en Clover. Reintenta Sincronizar o reconecta Clover.",
        details: err instanceof Error ? err.message : String(err),
      }, 502);
    }
  }

  const toCloverTaxRates = (rates: any[]) =>
    rates
      .map((r) => ({
        id: r.clover_tax_rate_id ?? undefined,
        name: r.nombre ?? undefined,
        rate: Number(r.rate),
        isDefault: r.is_default ?? undefined,
      }))
      .filter((r) => Number.isFinite(r.rate) && r.rate > 0);

  const formatModifierNote = (mods: any[]) => {
    if (!mods.length) return "";
    const grouped = new Map<string, any[]>();
    for (const mod of mods) {
      const group = (mod.grupo_nombre ?? "Opciones").trim();
      const list = grouped.get(group) ?? [];
      list.push(mod);
      grouped.set(group, list);
    }
    const lines: string[] = [];
    for (const [group, list] of grouped) {
      const label = list.map((m) => {
        const extra = Number(m.precio_extra);
        const extraLabel = Number.isFinite(extra) && extra > 0 ? ` (+$${extra.toFixed(2)})` : "";
        return `${m.nombre ?? "Opcion"}${extraLabel}`;
      }).join(", ");
      lines.push(`${group}: ${label}`);
    }
    return lines.join("\n");
  };

  let checkoutLineItems: Array<{ name: string; price: number; unitQty: number; note?: string; taxRates?: Array<{ name: string; rate: number }> }> = [];
  let total = 0;
  try {
    checkoutLineItems = items.map((item) => {
      const product = productMap.get(item.idProducto);
      const basePrice = toNumber(product?.precio);
      if (!Number.isFinite(basePrice)) {
        throw new Error(`Precio invalido para producto ${item.idProducto}`);
      }
      const mods = item.modifiers.map((modId) => modifierMap.get(modId)).filter(Boolean);
      const modsExtra = mods.reduce((sum, mod) => sum + (toNumber(mod.precio_extra) || 0), 0);
      const unitPrice = basePrice + modsExtra;
      const taxRates = toCheckoutTaxRates(resolveTaxRates(item.idProducto));
      const modsNote = formatModifierNote(mods);
      const noteParts: string[] = [];
      if (mode === "pickup") noteParts.push(PICKUP_ORDER_NOTE);
      if (modsNote) noteParts.push(modsNote);
      if (item.nota) noteParts.push(`Nota: ${item.nota}`);
      const note = noteParts.length ? noteParts.join("\n") : undefined;
      return {
        name: product?.nombre ?? `Producto ${item.idProducto}`,
        price: toCents(unitPrice),
        unitQty: item.qty,
        note,
        ...(taxRates.length ? { taxRates } : {}),
      };
    });

    const totalCents = checkoutLineItems.reduce((sum, li) => sum + li.price * li.unitQty, 0);
    total = Number((totalCents / 100).toFixed(2));
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Precio invalido" }, 400);
  }

  let cloverOrderId: string | null = null;
  if (mode === "mesa") {
    try {
      const noteBase = mesa ? `Mesa ${mesa} - Findixi` : "Mesa - Findixi";
      const orderResp = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/orders`, {
        method: "POST",
        body: { state: "open", note: noteBase },
      });
      cloverOrderId = orderResp?.id ?? null;
    } catch (err) {
      console.error("Error creando orden Clover", err);
      if (err instanceof CloverApiError && err.status === 401) {
        return needsReconnectResponse();
      }
      if (err instanceof CloverApiError) {
        return jsonResponse({
          error: "No se pudo crear orden en Clover",
          status: err.status,
          raw: err.raw,
          url: err.url,
          baseUrl: CLOVER_API_BASE,
          merchantId,
        }, 502);
      }
      return jsonResponse({
        error: "No se pudo crear orden en Clover",
        details: err instanceof Error ? err.message : String(err),
      }, 502);
    }

    if (!cloverOrderId) return jsonResponse({ error: "Clover order id no recibido" }, 502);

    for (const item of items) {
      const product = productMap.get(item.idProducto);
      const taxRates = toCloverTaxRates(resolveTaxRates(item.idProducto));
      let lineResp;
      try {
        lineResp = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/orders/${cloverOrderId}/line_items`, {
          method: "POST",
          body: {
            item: { id: product.clover_item_id },
            unitQty: item.qty,
            note: item.nota ?? undefined,
            ...(taxRates.length ? { taxRates } : {}),
          },
        });
      } catch (err) {
        if (err instanceof CloverApiError && err.status === 401) {
          return needsReconnectResponse();
        }
        return jsonResponse({ error: "No se pudo crear line item en Clover" }, 502);
      }
      const lineItemId = lineResp?.id ?? lineResp?.lineItem?.id ?? null;
      if (!lineItemId) return jsonResponse({ error: "No se pudo crear line item en Clover" }, 502);

      for (const modId of item.modifiers) {
        const mod = modifierMap.get(modId);
        try {
          await fetchCloverWithAutoRefresh(
            `/v3/merchants/${merchantId}/orders/${cloverOrderId}/line_items/${lineItemId}/modifications`,
            { method: "POST", body: { modifier: { id: mod.clover_modifier_id } } },
          );
        } catch (err) {
          if (err instanceof CloverApiError && err.status === 401) {
            return needsReconnectResponse();
          }
          return jsonResponse({ error: "No se pudo crear modificador en Clover" }, 502);
        }
      }
    }
  }

  let checkoutUrl: string | null = null;
  let checkoutSessionId: string | null = null;
  let orderTypeWarning: string | null = null;
  if (mode === "pickup") {
    try {
      const checkoutPayload: Record<string, unknown> = {
        customer: body?.customer ?? {},
        shoppingCart: { lineItems: checkoutLineItems },
        tips: { enabled: body?.tipsEnabled !== false },
      };
      if (body?.redirectUrls && typeof body.redirectUrls === "object") {
        const redirectUrls: Record<string, string> = {};
        for (const [key, value] of Object.entries(body.redirectUrls)) {
          if (typeof value !== "string") continue;
          redirectUrls[key] = value.replace("{ORDER_TOKEN}", orderLinkToken);
        }
        checkoutPayload.redirectUrls = redirectUrls;
      }
      const checkoutResp = await fetchCloverWithAutoRefresh("/invoicingcheckoutservice/v1/checkouts", {
        method: "POST",
        headers: { "X-Clover-Merchant-Id": merchantId },
        body: checkoutPayload,
      });
      checkoutUrl = checkoutResp?.href ?? checkoutResp?.url ?? null;
      checkoutSessionId = checkoutResp?.checkoutSessionId ?? checkoutResp?.id ?? null;
      cloverOrderId = checkoutResp?.orderId ?? checkoutResp?.order?.id ?? cloverOrderId;

      if (cloverOrderId) {
        try {
          const updateBody: Record<string, unknown> = { note: PICKUP_ORDER_NOTE };
          if (pickupOrderType?.id) {
            updateBody.orderType = { id: pickupOrderType.id };
          }
          await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/orders/${cloverOrderId}`, {
            method: "POST",
            body: updateBody,
          });
        } catch (err) {
          console.warn("No se pudo actualizar la orden con Pickup/nota", err);
          orderTypeWarning = err instanceof Error ? err.message : String(err);
        }
      }
    } catch (err) {
      console.error("Error creando Hosted Checkout", err);
      if (err instanceof CloverApiError && err.status === 401) {
        return needsReconnectResponse();
      }
      if (err instanceof CloverApiError) {
        return jsonResponse({
          error: "No se pudo crear checkout en Clover",
          status: err.status,
          raw: err.raw,
          url: err.url,
          baseUrl: CLOVER_API_BASE,
          merchantId,
        }, 502);
      }
      return jsonResponse({
        error: "No se pudo crear checkout en Clover",
        details: err instanceof Error ? err.message : String(err),
      }, 502);
    }

    if (!checkoutUrl) return jsonResponse({ error: "checkout_url no recibido" }, 502);
  }

  const orderInsert: Record<string, unknown> = {
    idcomercio: idComercio,
    clover_merchant_id: merchantId,
    clover_order_id: cloverOrderId,
    checkout_session_id: checkoutSessionId,
    checkout_url: checkoutUrl,
    total,
    status: mode === "mesa" ? "sent" : "pending",
    idempotency_key: idempotencyKey,
    order_type: mode,
    mesa: mesa,
    source: source,
  };

  const orderCols = await getTableColumns("ordenes");
  if (orderCols) {
    if (orderCols.has("customer_email")) orderInsert.customer_email = customerEmail;
    if (orderCols.has("customer_phone")) orderInsert.customer_phone = customerPhone;
    if (orderCols.has("customer_name")) orderInsert.customer_name = customerName || null;
    if (orderCols.has("customer_user_id")) orderInsert.customer_user_id = authUserId;
    if (orderCols.has("order_link_token")) orderInsert.order_link_token = orderLinkToken;
    if (orderCols.has("order_link_expires_at")) orderInsert.order_link_expires_at = null;
  }

  const { data: orderRow, error: orderErr } = await supabase
    .from("ordenes")
    .insert(orderInsert)
    .select("id, status, checkout_url, clover_order_id, checkout_session_id, total")
    .single();

  if (orderErr) {
    if (orderErr.code === "23505" && idempotencyKey) {
      const { data: existingOrder, error: existingErr } = await supabase
        .from("ordenes")
        .select("id, status, checkout_url, clover_order_id, checkout_session_id, total")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existingErr) return jsonResponse({ error: existingErr.message }, 500);
      if (existingOrder) return jsonResponse({ ok: true, reused: true, order: existingOrder });
    }
    return jsonResponse({ error: orderErr.message }, 500);
  }

  const orderItemsPayload = items.map((item) => {
    const product = productMap.get(item.idProducto);
    const mods = item.modifiers.map((modId) => {
      const mod = modifierMap.get(modId);
      return {
        id: mod.id,
        clover_modifier_id: mod.clover_modifier_id,
        nombre: mod.nombre ?? null,
        precio_extra: mod.precio_extra ?? 0,
      };
    });
    const basePrice = toNumber(product?.precio);
    const modsExtra = mods.reduce((sum, mod) => sum + (toNumber(mod.precio_extra) || 0), 0);
    const unitPrice = Number.isFinite(basePrice) ? basePrice + modsExtra : 0;
    const modsWithGroup = mods.map((mod) => ({
      ...mod,
      grupo: mod.grupo_nombre ?? mod.grupo ?? null,
    }));
    return {
      idorden: orderRow.id,
      idproducto: item.idProducto,
      clover_item_id: product.clover_item_id,
      qty: item.qty,
      price_snapshot: unitPrice,
      modifiers: { items: modsWithGroup, nota: item.nota ?? null },
    };
  });

  const { error: itemsErr } = await supabase.from("orden_items").insert(orderItemsPayload);
  if (itemsErr) return jsonResponse({ error: itemsErr.message }, 500);

  return jsonResponse({
    ok: true,
    order: orderRow,
    checkout_url: checkoutUrl,
    clover_order_id: cloverOrderId,
    checkout_session_id: checkoutSessionId,
    order_link_token: orderLinkToken,
    order_type_warning: orderTypeWarning,
  });
}

Deno.serve(handler);
