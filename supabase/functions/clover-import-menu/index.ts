// Edge Function: clover-import-menu
// Importa categorías, items y modificadores desde Clover y los sincroniza con las tablas de menú.

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

function fromBase64Url(str: string) {
  const pad = str.length % 4 === 0 ? 0 : 4 - (str.length % 4);
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadBytes = fromBase64Url(parts[1]);
    const json = new TextDecoder().decode(payloadBytes);
    return JSON.parse(json);
  } catch (_e) {
    return null;
  }
}

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

const PICKUP_ORDER_TYPE_NAME = "Pickup (Findixi)";
const PICKUP_ORDER_TYPE_NAME_ALT = "Pick Up (Findixi)";

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

async function cloverRequest(
  path: string,
  token: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const base =
    path.startsWith("/oauth/v2/token") ? OAUTH_API_BASE
      : path.startsWith("/v3/") ? CLOVER_API_BASE
      : CLOVER_API_BASE;
  const url = path.startsWith("http") ? new URL(path) : new URL(path, base);
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
  const url = new URL(req.url);
  const idComercio = Number(url.searchParams.get("idComercio") || url.searchParams.get("id"));

  if (!Number.isFinite(idComercio) || idComercio <= 0) return jsonResponse({ error: "idComercio requerido" }, 400);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: "Supabase env missing" }, 500);
  if (!CLOVER_CLIENT_ID || !CLOVER_CLIENT_SECRET) return jsonResponse({ error: "Clover env missing" }, 500);
  console.log("[clover-import] CLOVER_API_BASE =", CLOVER_API_BASE);

  // Obtener conexión Clover
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
  console.log("[clover-import] oauthBaseUsed=", CLOVER_OAUTH_BASE, "apiBaseUsed=", CLOVER_API_BASE, "merchantId=", merchantId);

  // Refresh token si expiró, está por expirar (<2 min) o no hay expires_at
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

  const fetchCloverWithAutoRefresh = async (
    path: string,
    options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    try {
      return await cloverRequest(path, accessToken, options);
    } catch (err) {
      if (err instanceof CloverApiError && err.status === 401 && refreshTokenVal && !refreshedAfter401) {
        refreshedAfter401 = true;
        console.warn("[clover-import] 401 from Clover, refreshing token");
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
          console.warn("[clover-import] refresh after 401 failed", refreshErr);
          throw err;
        }
        try {
          return await cloverRequest(path, accessToken, options);
        } catch (retryErr) {
          if (retryErr instanceof CloverApiError && retryErr.status === 401) {
            throw retryErr;
          }
          throw retryErr;
        }
      }
      throw err;
    }
  };

  const ensurePickupOrderType = async () => {
    const desiredKeys = new Set([
      normalizeKey(PICKUP_ORDER_TYPE_NAME),
      normalizeKey(PICKUP_ORDER_TYPE_NAME_ALT),
    ]);

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
        console.warn("[clover-import] No se pudo leer system_order_types, creando order type sin systemOrderTypeId", err);
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

    const updatePayload: Record<string, unknown> = {};
    if (await hasColumn("clover_conexiones", "clover_order_type_id")) {
      updatePayload.clover_order_type_id = orderTypeId;
    }
    if (await hasColumn("clover_conexiones", "clover_order_type_name")) {
      updatePayload.clover_order_type_name = orderTypeName;
    }
    if (await hasColumn("clover_conexiones", "order_type_ready_at")) {
      updatePayload.order_type_ready_at = new Date().toISOString();
    }
    if (Object.keys(updatePayload).length) {
      await supabase.from("clover_conexiones").update(updatePayload).eq("idComercio", idComercio);
    }

    return { id: orderTypeId, name: orderTypeName };
  };

  try {
    const pickupOrderType = await ensurePickupOrderType();
    console.log("[clover-import] Fetching categories & items", { merchantId, idComercio });
    const catsJson = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/categories`);
    const categories: any[] = toArray(catsJson?.elements ?? catsJson?.categories ?? catsJson);

    const itemsJson = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/items?limit=1000&expand=modifierGroups,categories`);
    console.log("[clover-import] items keys:", Object.keys(itemsJson));
    console.log("[clover-import] items count:", (itemsJson?.elements?.length ?? itemsJson?.items?.length ?? 0));
    const itemsForModifiers: any[] = toArray(itemsJson?.elements ?? itemsJson?.items ?? itemsJson);

    const modGroupsJson = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/modifier_groups?limit=500`);
    const modifierGroups: any[] = toArray(modGroupsJson?.elements ?? modGroupsJson?.modifierGroups ?? modGroupsJson);

    // 1) Upsert categorías -> menus
    const menuPayload = categories.map((c) => ({
      idComercio,
      clover_category_id: c?.id ?? null,
      clover_merchant_id: merchantId,
      titulo: c?.name ?? "Sin título",
      descripcion: c?.description ?? null,
      orden: Number(c?.sortOrder ?? c?.sequence) || 0,
      activo: true,
    })).filter((m) => m.clover_category_id);

    if (menuPayload.length) {
      const { error: menuErr } = await supabase
        .from("menus")
        .upsert(menuPayload, { onConflict: "clover_category_id,clover_merchant_id" });
      if (menuErr) throw menuErr;
    }

    // Map clover_category_id -> menu id
    const catIds = menuPayload.map((m) => m.clover_category_id);
    const { data: menusRows } = await supabase
      .from("menus")
      .select("id, clover_category_id")
      .eq("idComercio", idComercio)
      .in("clover_category_id", catIds);
    const menuMap = new Map<string, number>();
    (menusRows || []).forEach((row: any) => {
      if (row.clover_category_id) menuMap.set(row.clover_category_id, row.id);
    });

    // 2) Productos (por categoría)
    const itemsById = new Map<string, any>();
    const itemsByCategory = new Map<string, any[]>();
    for (const cat of categories) {
      const categoryId = cat?.id;
      if (!categoryId) continue;
      const catItemsJson = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/categories/${categoryId}/items`);
      const catItems: any[] = toArray(catItemsJson?.elements ?? catItemsJson?.items ?? catItemsJson);
      itemsByCategory.set(categoryId, catItems);
      for (const item of catItems) {
        if (item?.id) itemsById.set(item.id, item);
      }
    }

    const itemIds = Array.from(itemsById.keys());
    const { data: existingProducts } = await supabase
      .from("productos")
      .select("id, clover_item_id, imagen, orden")
      .eq("clover_merchant_id", merchantId)
      .in("clover_item_id", itemIds.length ? itemIds : ["__none__"]);
    const existingMap = new Map<string, { id: number; imagen: string | null; orden: number | null }>();
    (existingProducts || []).forEach((p: any) => existingMap.set(p.clover_item_id, { id: p.id, imagen: p.imagen, orden: p.orden }));

    const productoPayload = [] as any[];
    let sampleLogged = false;
    for (const [categoryId, catItems] of itemsByCategory) {
      const idMenu = menuMap.get(categoryId);
      for (const item of catItems) {
        if (!sampleLogged) {
          console.log("[clover-import] sample item:", JSON.stringify(item).slice(0, 800));
          sampleLogged = true;
        }
        console.log("[clover-import] resolved idMenu:", idMenu, "itemId:", item?.id);
        if (!idMenu) continue; // sin categoría -> no se importa
        const itemId = item?.id;
        if (!itemId) continue;
        const prev = existingMap.get(itemId) || null;
        const rawPrice = item?.price ?? item?.priceWithVat;
        let itemResolved: any = item;
        if (rawPrice == null) {
          itemResolved = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/items/${itemId}`);
        }
        const precioCents = Number(itemResolved?.price ?? itemResolved?.priceWithVat ?? 0);
        const disponible = itemResolved?.isDeleted === true ? false : true;

        productoPayload.push({
          idMenu,
          clover_item_id: itemId,
          clover_merchant_id: merchantId,
          nombre: itemResolved?.name ?? "Sin nombre",
          descripcion: itemResolved?.description ?? null,
          precio: precioCents ? precioCents / 100 : 0,
          orden: Number(itemResolved?.sortOrder ?? itemResolved?.sequence ?? prev?.orden ?? 0) || 0,
          activo: true,
          disponible_clover: disponible,
          imagen: prev?.imagen ?? null,
        });
      }
    }

    if (productoPayload.length) {
      const { error: prodErr } = await supabase
        .from("productos")
        .upsert(productoPayload, { onConflict: "clover_item_id,clover_merchant_id" });
      if (prodErr) throw prodErr;
    }

    // Map producto clover -> producto.id
    const { data: prodRows } = await supabase
      .from("productos")
      .select("id, clover_item_id")
      .eq("clover_merchant_id", merchantId)
      .in("clover_item_id", itemIds.length ? itemIds : ["__none__"]);
    const prodMap = new Map<string, number>();
    (prodRows || []).forEach((p: any) => prodMap.set(p.clover_item_id, p.id));

    // 3) Grupos de modificadores
    const modifierMap = new Map<string, any>();
    modifierGroups.forEach((g) => modifierMap.set(g.id, g));

    const grupoPayload: any[] = [];
    const grupoHasIdProductoLower = await hasColumn("producto_opcion_grupos", "idproducto");
    const grupoHasIdProductoCamel = grupoHasIdProductoLower ? false : await hasColumn("producto_opcion_grupos", "idProducto");
    if (!grupoHasIdProductoLower && !grupoHasIdProductoCamel) {
      throw new Error("producto_opcion_grupos: falta columna idproducto/idProducto");
    }
    const grupoHasIdComercioLower = await hasColumn("producto_opcion_grupos", "idcomercio");
    const grupoHasIdComercioCamel = grupoHasIdComercioLower ? false : await hasColumn("producto_opcion_grupos", "idComercio");
    const grupoIdProductoCol = grupoHasIdProductoLower ? "idproducto" : "idProducto";
    const grupoIdComercioCol = grupoHasIdComercioLower ? "idcomercio" : "idComercio";
    const grupoHasMinSel = await hasColumn("producto_opcion_grupos", "min_sel");
    const grupoHasMaxSel = await hasColumn("producto_opcion_grupos", "max_sel");
    const grupoHasActivo = await hasColumn("producto_opcion_grupos", "activo");
    const gruposPorItem: Map<string, string[]> = new Map();

    for (const item of itemsForModifiers) {
      const productoId = prodMap.get(item.id);
      if (!productoId) continue;
      const groups = item?.modifierGroups ?? item?.modifier_groups ?? [];
      console.log("[clover-import] groups keys:", groups && Object.keys(groups || {}));
      const groupIds = toArray(groups).map((g: any) => g?.id).filter(Boolean);
      gruposPorItem.set(item.id, groupIds);
      for (const gid of groupIds) {
        const g = modifierMap.get(gid) ?? { id: gid };
        const minSel = Number(g?.minRequired ?? 0) || 0;
        const maxSel = Number(g?.maxAllowed ?? 0) || 0;
        const row: any = {
          clover_modifier_group_id: gid,
          clover_merchant_id: merchantId,
          nombre: g?.name ?? g?.label ?? "Opciones",
          orden: Number(g?.sortOrder ?? g?.sequence ?? 0) || 0,
          requerido: minSel > 0,
        };
        row[grupoIdProductoCol] = productoId;
        if (grupoHasIdComercioLower || grupoHasIdComercioCamel) row[grupoIdComercioCol] = idComercio;
        if (grupoHasMinSel) row.min_sel = minSel;
        if (grupoHasMaxSel) row.max_sel = maxSel;
        if (grupoHasActivo) row.activo = true;
        grupoPayload.push(row);
      }
    }

    if (grupoPayload.length) {
      const { error: grpErr } = await supabase
        .from("producto_opcion_grupos")
        .upsert(grupoPayload, { onConflict: `${grupoIdProductoCol},clover_modifier_group_id` });
      if (grpErr) throw grpErr;
    }

    // Map grupo Clover -> id grupo local por producto
    const { data: grpRows } = await supabase
      .from("producto_opcion_grupos")
      .select(`id, ${grupoIdProductoCol}, clover_modifier_group_id`)
      .eq("clover_merchant_id", merchantId);
    const grpMap = new Map<string, number>(); // key `${productoId}:${cloverGid}`
    (grpRows || []).forEach((g: any) => grpMap.set(`${g[grupoIdProductoCol]}:${g.clover_modifier_group_id}`, g.id));

    // 4) Modifiers
    const modifierPayload: any[] = [];
    const itemHasIdGrupoLower = await hasColumn("producto_opcion_items", "idgrupo");
    const itemHasIdGrupoCamel = itemHasIdGrupoLower ? false : await hasColumn("producto_opcion_items", "idGrupo");
    if (!itemHasIdGrupoLower && !itemHasIdGrupoCamel) {
      throw new Error("producto_opcion_items: falta columna idgrupo/idGrupo");
    }
    const itemHasIdProductoLower = await hasColumn("producto_opcion_items", "idproducto");
    const itemHasIdProductoCamel = itemHasIdProductoLower ? false : await hasColumn("producto_opcion_items", "idProducto");
    const itemHasIdComercioLower = await hasColumn("producto_opcion_items", "idcomercio");
    const itemHasIdComercioCamel = itemHasIdComercioLower ? false : await hasColumn("producto_opcion_items", "idComercio");
    const itemIdGrupoCol = itemHasIdGrupoLower ? "idgrupo" : "idGrupo";
    const itemIdProductoCol = itemHasIdProductoLower ? "idproducto" : "idProducto";
    const itemIdComercioCol = itemHasIdComercioLower ? "idcomercio" : "idComercio";
    const itemHasActivo = await hasColumn("producto_opcion_items", "activo");
    const itemHasMerchant = await hasColumn("producto_opcion_items", "clover_merchant_id");
    for (const g of modifierGroups) {
      if (!g?.id) continue;
      const modsJson = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/modifier_groups/${g.id}/modifiers?limit=500`);
      const mods: any[] = toArray(modsJson?.elements ?? modsJson?.modifiers ?? modsJson);
      for (const item of itemsForModifiers) {
        const productoId = prodMap.get(item.id);
        if (!productoId) continue;
        const groupIds = gruposPorItem.get(item.id) || [];
        if (!groupIds.includes(g.id)) continue;
        const idGrupo = grpMap.get(`${productoId}:${g.id}`);
        if (!idGrupo) continue;
        mods.forEach((m) => {
          const row: any = {
            clover_modifier_id: m.id,
            nombre: m.name ?? "Opción",
            precio_extra: Number(m.price ?? m.priceWithVat ?? 0) / 100,
            orden: Number(m.sortOrder ?? m.sequence ?? 0) || 0,
          };
          row[itemIdGrupoCol] = idGrupo;
          if (itemHasIdProductoLower || itemHasIdProductoCamel) row[itemIdProductoCol] = productoId;
          if (itemHasIdComercioLower || itemHasIdComercioCamel) row[itemIdComercioCol] = idComercio;
          if (itemHasActivo) row.activo = m.isDeleted === true ? false : true;
          if (itemHasMerchant) row.clover_merchant_id = merchantId;
          modifierPayload.push(row);
        });
      }
    }

    if (modifierPayload.length) {
      const { error: modErr } = await supabase
        .from("producto_opcion_items")
        .upsert(modifierPayload, { onConflict: `${itemIdGrupoCol},clover_modifier_id` });
      if (modErr) throw modErr;
    }

    await supabase.from("clover_conexiones").update({ last_imported_at: new Date().toISOString() }).eq("idComercio", idComercio);

    return jsonResponse({
      ok: true,
      menus: menuPayload.length,
      productos: productoPayload.length,
      opciones: modifierPayload.length,
      pickupOrderType,
    });
  } catch (err) {
    console.error("[clover-import] error", err);
    if (err instanceof CloverApiError) {
      const tokenPayload = accessToken ? decodeJwtPayload(accessToken) : null;
      if (err.status === 401) {
        return jsonResponse({
          needs_reconnect: true,
          baseUrlUsed: CLOVER_API_BASE,
          merchantId,
          status: err.status,
          raw: err.raw,
          url: err.url,
          token_info: tokenPayload
            ? {
              iss: tokenPayload?.iss,
              merchant_uuid: tokenPayload?.merchant_uuid ?? tokenPayload?.merchantId,
              app_uuid: tokenPayload?.app_uuid,
              permission_bitmap: tokenPayload?.permission_bitmap,
              exp: tokenPayload?.exp,
              iat: tokenPayload?.iat,
            }
            : null,
        }, 401);
      }
      return jsonResponse({
        baseUrlUsed: CLOVER_API_BASE,
        merchantId,
        status: err.status,
        raw: err.raw,
      }, err.status || 500);
    }
    const details = err && typeof err === "object"
      ? {
        name: (err as any).name,
        message: (err as any).message,
        stack: (err as any).stack,
        code: (err as any).code,
        hint: (err as any).hint,
        details: (err as any).details,
      }
      : { message: String(err) };
    return jsonResponse({ error: "import_failed", details }, 500);
  }
}

Deno.serve(handler);
