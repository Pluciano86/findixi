// Edge Function: clover-webhook
// Recibe webhooks de Clover y asigna Order Type Pickup (Findixi) a la orden pagada.

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLOVER_CLIENT_ID = Deno.env.get("CLOVER_CLIENT_ID") ?? "";
const CLOVER_CLIENT_SECRET = Deno.env.get("CLOVER_CLIENT_SECRET") ?? "";
const CLOVER_OAUTH_BASE = Deno.env.get("CLOVER_OAUTH_BASE") ?? "https://sandbox.dev.clover.com";
const CLOVER_API_BASE = Deno.env.get("CLOVER_API_BASE") ?? "https://apisandbox.dev.clover.com";
const CLOVER_WEBHOOK_SECRET = Deno.env.get("CLOVER_WEBHOOK_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-findixi-secret",
};

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

function isFailedPaymentStatus(statusRaw: unknown) {
  const status = String(statusRaw ?? "").toLowerCase();
  if (!status) return false;
  return (
    status.includes("declin") ||
    status.includes("fail") ||
    status.includes("cancel") ||
    status.includes("void") ||
    status.includes("error")
  );
}

function extractPaymentsArray(order: any) {
  return toArray(order?.payments?.elements ?? order?.payments ?? []);
}

async function setLocalOrderPaid(idComercio: number, cloverOrderId: string) {
  const updatePayload = {
    status: "paid",
    updated_at: new Date().toISOString(),
  };
  const activeLikeStatuses = ["pending", "sent", "open", "confirmed", "paid"];

  const tryDirectUpdate = async (idCol: "idcomercio" | "idComercio") => {
    const resp = await supabase
      .from("ordenes")
      .update(updatePayload)
      .eq(idCol, idComercio)
      .eq("clover_order_id", cloverOrderId)
      .in("status", activeLikeStatuses)
      .select("id");
    return resp;
  };

  let resp = await tryDirectUpdate("idcomercio");
  if (!resp.error && (resp.data?.length ?? 0) > 0) {
    return { updated: true, method: "direct:idcomercio", localOrderId: resp.data?.[0]?.id ?? null };
  }

  const maybeMissingSnakeCase = (resp.error?.message || "").toLowerCase().includes("idcomercio") &&
    (resp.error?.message || "").toLowerCase().includes("does not exist");
  if (resp.error && !maybeMissingSnakeCase) {
    console.warn("[clover-webhook] No se pudo actualizar orden local (directo snake_case)", resp.error);
  }

  resp = await tryDirectUpdate("idComercio");
  if (!resp.error && (resp.data?.length ?? 0) > 0) {
    return { updated: true, method: "direct:idComercio", localOrderId: resp.data?.[0]?.id ?? null };
  }

  if (resp.error) {
    console.warn("[clover-webhook] No se pudo actualizar orden local (directo camelCase)", resp.error);
  }

  // Fallback controlado:
  // si no hubo match por clover_order_id, intentamos la orden pickup más reciente sin clover_order_id.
  const fallbackStatuses = ["pending", "sent", "open", "confirmed"];
  const selectRecent = async (idCol: "idcomercio" | "idComercio") =>
    await supabase
      .from("ordenes")
      .select("id, clover_order_id, created_at, status")
      .eq(idCol, idComercio)
      .eq("order_type", "pickup")
      .in("status", fallbackStatuses)
      .order("created_at", { ascending: false })
      .limit(20);

  let recent = await selectRecent("idcomercio");
  if (recent.error) {
    const msg = (recent.error.message || "").toLowerCase();
    if (msg.includes("idcomercio") && msg.includes("does not exist")) {
      recent = await selectRecent("idComercio");
    }
  }

  if (recent.error) {
    console.warn("[clover-webhook] No se pudieron leer ordenes recientes para fallback", recent.error);
    return { updated: false, method: "fallback:error_recent", localOrderId: null };
  }

  const now = Date.now();
  const candidates = (recent.data || []).filter((row: any) => {
    const createdAtMs = row?.created_at ? Date.parse(row.created_at) : NaN;
    if (!Number.isFinite(createdAtMs)) return false;
    const ageMinutes = (now - createdAtMs) / 60000;
    const hasCloverId = Boolean(row?.clover_order_id);
    return ageMinutes <= 90 && !hasCloverId;
  });

  if (candidates.length === 0) {
    console.warn("[clover-webhook] Fallback sin candidatos; no se actualiza estado local", {
      cloverOrderId,
    });
    return { updated: false, method: "fallback:no_candidates", localOrderId: null };
  }

  if (candidates.length > 1) {
    console.warn("[clover-webhook] Fallback ambiguo; se tomará el más reciente", {
      cloverOrderId,
      candidates: candidates.length,
      selectedId: candidates[0]?.id ?? null,
    });
  }

  const targetLocalId = candidates[0].id;
  const patched = await supabase
    .from("ordenes")
    .update(updatePayload)
    .eq("id", targetLocalId)
    .select("id");

  if (patched.error) {
    console.warn("[clover-webhook] No se pudo actualizar fallback de orden local", patched.error);
    return {
      updated: false,
      method: "fallback:patch_error",
      localOrderId: targetLocalId,
      error: patched.error?.message ?? null,
    };
  }

  // Intento best-effort de enlazar clover_order_id (si no viola constraints).
  const bindCloverId = await supabase
    .from("ordenes")
    .update({ clover_order_id: cloverOrderId })
    .eq("id", targetLocalId)
    .is("clover_order_id", null)
    .select("id");
  if (bindCloverId.error) {
    console.warn("[clover-webhook] No se pudo enlazar clover_order_id en fallback", bindCloverId.error);
  }

  console.log("[clover-webhook] Orden local actualizada por fallback", {
    localOrderId: targetLocalId,
    cloverOrderId,
  });
  return {
    updated: true,
    method: "fallback:recent_pending",
    localOrderId: targetLocalId,
    cloverIdBound: !bindCloverId.error,
  };
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
    (first.raw.toLowerCase().includes("code") && first.raw.toLowerCase().includes("must not be null"));
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
  const url = new URL(req.url);

  let body: any = null;
  let rawText = "";
  const contentType = req.headers.get("content-type") ?? "";
  if (req.method === "POST") {
    try {
      rawText = await req.text();
      if (rawText) {
        try {
          body = JSON.parse(rawText);
        } catch {
          const params = new URLSearchParams(rawText);
          if ([...params.keys()].length) {
            body = Object.fromEntries(params.entries());
          } else {
            body = rawText;
          }
        }
      }
    } catch (err) {
      console.warn("[clover-webhook] No se pudo leer body", err);
      body = null;
    }
  }
  if (Array.isArray(body) && body.length === 1) body = body[0];

  const providedSecret =
    req.headers.get("x-findixi-secret") ??
    url.searchParams.get("secret") ??
    body?.secret ??
    "";

  const verificationCode =
    body?.verificationCode ??
    body?.verification_code ??
    body?.verification_code_id ??
    url.searchParams.get("verificationCode") ??
    url.searchParams.get("verification_code") ??
    null;

  if (verificationCode) {
    console.log("[clover-webhook] verificationCode:", verificationCode);
    return jsonResponse({ ok: true, verificationCode });
  }

  if (CLOVER_WEBHOOK_SECRET) {
    if (providedSecret !== CLOVER_WEBHOOK_SECRET) {
      console.warn("[clover-webhook] Secret inválido", {
        hasSecret: Boolean(providedSecret),
        secretMatch: false,
      });
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  if (req.method !== "POST") return jsonResponse({ error: "Metodo no permitido" }, 405);

  const bodyKeys = body && typeof body === "object" ? Object.keys(body) : [];
  const eventType =
    body?.type ??
    body?.eventType ??
    body?.event?.type ??
    body?.event?.eventType ??
    body?.event?.name ??
    null;
  const merchantKeys = Array.isArray(body?.merchants) && body.merchants.length
    ? Object.keys(body.merchants[0] ?? {})
    : body?.merchants && typeof body.merchants === "object"
    ? Object.keys(body.merchants)
    : [];
  const merchantCount = Array.isArray(body?.merchants)
    ? body.merchants.length
    : body?.merchants && typeof body.merchants === "object"
    ? Object.keys(body.merchants).length
    : 0;
  let merchantSample: unknown = null;
  if (body?.merchants && typeof body.merchants === "object") {
    if (Array.isArray(body.merchants) && body.merchants.length) merchantSample = body.merchants[0];
    else if (!Array.isArray(body.merchants) && merchantKeys.length) merchantSample = body.merchants[merchantKeys[0]];
  }
  console.log("[clover-webhook] incoming", {
    merchantId: body?.merchant_id ?? body?.merchantId ?? body?.merchant?.id ?? null,
    objectId: body?.object_id ?? body?.objectId ?? body?.id ?? body?.data?.id ?? null,
    eventType,
    hasSecret: Boolean(providedSecret),
    contentType,
    bodyKeys,
    merchantCount,
    merchantKeys,
    merchantSampleKeys: merchantSample && typeof merchantSample === "object" ? Object.keys(merchantSample as Record<string, unknown>) : [],
    merchantSampleSnippet: merchantSample ? JSON.stringify(merchantSample).slice(0, 500) : undefined,
    rawSnippet: typeof body === "string" ? body.slice(0, 500) : undefined,
  });

  const extractEventsFromMerchants = (merchants: any) => {
    const events: Array<{ merchantId: string | null; objectId: string | null; eventType: string | null }> = [];
    if (Array.isArray(merchants)) {
      for (const m of merchants) {
        const mId = m?.merchantId ?? m?.merchant_id ?? m?.id ?? m?.merchant?.id ?? null;
        const mEvents = Array.isArray(m?.events) ? m.events : Array.isArray(m?.event) ? m.event : null;
        if (mEvents && mEvents.length) {
          for (const e of mEvents) {
            events.push({
              merchantId: mId,
              objectId: e?.objectId ?? e?.object_id ?? e?.id ?? null,
              eventType: e?.type ?? e?.eventType ?? e?.event?.type ?? null,
            });
          }
        } else if (m?.objectId || m?.object_id || m?.id) {
          events.push({
            merchantId: mId,
            objectId: m?.objectId ?? m?.object_id ?? m?.id ?? null,
            eventType: m?.type ?? m?.eventType ?? null,
          });
        }
      }
      return events;
    }

    if (merchants && typeof merchants === "object") {
      const extractFromNode = (
        merchantId: string,
        node: unknown,
        depth: number,
        hint?: string,
      ) => {
        if (!node || depth > 4) return;
        if (Array.isArray(node)) {
          for (const item of node) {
            if (typeof item === "string") {
              events.push({ merchantId, objectId: item, eventType: hint ?? null });
              continue;
            }
            if (item && typeof item === "object") {
              const obj = item as Record<string, unknown>;
              const objectId = (obj.objectId ?? obj.object_id ?? obj.id ?? obj.paymentId ?? obj.orderId) as string | undefined;
              events.push({
                merchantId,
                objectId: objectId ?? null,
                eventType: (obj.type ?? obj.eventType ?? hint ?? null) as string | null,
              });
              extractFromNode(merchantId, obj, depth + 1, hint);
            }
          }
          return;
        }
        if (node && typeof node === "object") {
          const obj = node as Record<string, unknown>;
          const objectId = (obj.objectId ?? obj.object_id ?? obj.id ?? obj.paymentId ?? obj.orderId) as string | undefined;
          if (objectId) {
            events.push({ merchantId, objectId, eventType: (obj.type ?? obj.eventType ?? hint ?? null) as string | null });
          }
          for (const [k, v] of Object.entries(obj)) {
            if (["events", "payments", "orders", "payment", "order"].includes(k)) {
              extractFromNode(merchantId, v, depth + 1, k.toUpperCase());
            } else if (["created", "updated", "deleted"].includes(k)) {
              extractFromNode(merchantId, v, depth + 1, `${hint ?? "EVENT"}_${k.toUpperCase()}`);
            } else if (depth < 2) {
              extractFromNode(merchantId, v, depth + 1, hint);
            }
          }
        }
      };

      for (const [mId, updates] of Object.entries(merchants)) {
        const merchantId = String(mId);
        extractFromNode(merchantId, updates, 0);
      }
    }
    return events;
  };

  const merchantEvents = extractEventsFromMerchants(body?.merchants);
  const fallbackMerchantId =
    body?.merchant_id ??
    body?.merchantId ??
    body?.merchant?.id ??
    body?.event?.merchantId ??
    body?.event?.merchant_id ??
    (merchantEvents[0]?.merchantId ?? null) ??
    (merchantCount === 1 ? merchantKeys[0] : null);
  if (!fallbackMerchantId) return jsonResponse({ error: "merchantId requerido" }, 400);
  const merchantId = fallbackMerchantId;

  const objectId =
    body?.object_id ??
    body?.objectId ??
    body?.payment_id ??
    body?.paymentId ??
    body?.id ??
    body?.data?.id ??
    (merchantEvents[0]?.objectId ?? null);

  const normalizeObjectId = (raw: string | null) => {
    if (!raw) return null;
    const str = String(raw);
    if (str.includes(":")) return str.split(":")[1] || str;
    if (str.includes("/")) return str.split("/").pop() || str;
    return str;
  };

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return jsonResponse({ error: "Supabase env missing" }, 500);
  if (!CLOVER_CLIENT_ID || !CLOVER_CLIENT_SECRET) return jsonResponse({ error: "Clover env missing" }, 500);

  const { data: conn, error: connErr } = await supabase
    .from("clover_conexiones")
    .select("idComercio, access_token, refresh_token, expires_at, clover_order_type_id, clover_order_type_name")
    .eq("clover_merchant_id", fallbackMerchantId)
    .maybeSingle();

  if (connErr) return jsonResponse({ error: connErr.message }, 500);
  if (!conn) return jsonResponse({ error: "Comercio no encontrado" }, 404);

  let accessToken: string | null = conn.access_token ?? null;
  let refreshTokenVal: string | null = conn.refresh_token ?? null;
  let expiresAt: string | null = conn.expires_at ?? null;
  if (!accessToken) return jsonResponse({ error: "access_token no disponible" }, 401);

  let refreshedAfter401 = false;

  const expMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const shouldRefresh = !expiresAt || Number.isNaN(expMs) || expMs - Date.now() < 120_000;
  if (shouldRefresh && refreshTokenVal) {
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
      }).eq("idComercio", conn.idComercio);
    } catch (e) {
      console.warn("[clover-webhook] No se pudo refrescar token", e);
    }
  }

  const fetchCloverWithAutoRefresh = async (
    path: string,
    options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    try {
      return await cloverRequest(path, accessToken!, options);
    } catch (err) {
      if (err instanceof CloverApiError && err.status === 401 && refreshTokenVal && !refreshedAfter401) {
        refreshedAfter401 = true;
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
          }).eq("idComercio", conn.idComercio);
        } catch (refreshErr) {
          console.warn("[clover-webhook] refresh after 401 failed", refreshErr);
          throw err;
        }
        return await cloverRequest(path, accessToken!, options);
      }
      throw err;
    }
  };

  const ensurePickupOrderType = async () => {
    const desiredKeys = new Set([
      normalizeKey(PICKUP_ORDER_TYPE_NAME),
      normalizeKey(PICKUP_ORDER_TYPE_NAME_ALT),
    ]);

    if (conn?.clover_order_type_id) {
      return { id: conn.clover_order_type_id, name: conn?.clover_order_type_name ?? PICKUP_ORDER_TYPE_NAME };
    }

    const orderTypesResp = await fetchCloverWithAutoRefresh(`/v3/merchants/${merchantId}/order_types?limit=200`);
    const orderTypes = toArray(orderTypesResp?.elements ?? orderTypesResp?.orderTypes ?? orderTypesResp);
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
        console.warn("[clover-webhook] No se pudo leer system_order_types", err);
        pickupSystemId = null;
      }

      const payloadCandidates: Record<string, unknown>[] = [
        { label: PICKUP_ORDER_TYPE_NAME, ...(pickupSystemId ? { systemOrderTypeId: pickupSystemId } : {}) },
        { name: PICKUP_ORDER_TYPE_NAME, ...(pickupSystemId ? { systemOrderTypeId: pickupSystemId } : {}) },
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

    await supabase.from("clover_conexiones").update({
      clover_order_type_id: orderTypeId,
      clover_order_type_name: orderTypeName,
      order_type_ready_at: new Date().toISOString(),
    }).eq("idComercio", conn.idComercio);

    return { id: orderTypeId, name: orderTypeName };
  };

  if (!objectId) {
    return jsonResponse({ ok: true, ignored: true, reason: "No objectId" });
  }

  const paymentId = normalizeObjectId(objectId);

  let targetOrderId: string | null = null;
  let paymentLookupStatus: string | null = null;
  let resolvedFromPayment = false;

  if (paymentId) {
    try {
      const payment = await fetchCloverWithAutoRefresh(
        `/v3/merchants/${fallbackMerchantId}/payments/${paymentId}?expand=order`,
      );
      paymentLookupStatus = String(
        payment?.result ?? payment?.status ?? payment?.state ?? payment?.paymentResult ?? "",
      );

      if (isFailedPaymentStatus(paymentLookupStatus)) {
        return jsonResponse({
          ok: true,
          ignored: true,
          reason: "Payment not successful",
          paymentId,
          paymentStatus: paymentLookupStatus,
        });
      }

      targetOrderId = payment?.order?.id ?? payment?.orderId ?? payment?.order_id ?? null;
      if (targetOrderId) resolvedFromPayment = true;
    } catch (err) {
      if (!(err instanceof CloverApiError && err.status === 404)) {
        console.warn("[clover-webhook] No se pudo leer payment", err);
      }
    }
  }

  // Si no tenemos orderId por payment, intentamos tratar objectId como orderId,
  // pero SOLO si la orden ya tiene al menos un pago registrado en Clover.
  if (!targetOrderId && paymentId) {
    try {
      const order = await fetchCloverWithAutoRefresh(
        `/v3/merchants/${fallbackMerchantId}/orders/${paymentId}?expand=payments`,
      );
      const orderIdCandidate = order?.id ?? paymentId;
      const payments = extractPaymentsArray(order);
      if (payments.length > 0) {
        targetOrderId = orderIdCandidate;
      } else {
        return jsonResponse({
          ok: true,
          ignored: true,
          reason: "Order has no payments yet",
          orderId: orderIdCandidate,
          paymentId,
          eventType: eventType ?? merchantEvents[0]?.eventType ?? null,
        });
      }
    } catch (err) {
      if (err instanceof CloverApiError && err.status === 404) {
        return jsonResponse({ ok: true, ignored: true, reason: "Object not found in Clover", paymentId });
      }
      console.warn("[clover-webhook] No se pudo leer order para fallback de payment/order id", err);
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: "Cannot resolve paid order",
        paymentId,
        eventType: eventType ?? merchantEvents[0]?.eventType ?? null,
      });
    }
  }

  let pickupOrderType: { id: string; name: string } | null = null;
  try {
    pickupOrderType = await ensurePickupOrderType();
  } catch (err) {
    return jsonResponse({
      error: "No se pudo asegurar order type Pickup",
      details: err instanceof Error ? err.message : String(err),
    }, 500);
  }

  if (!pickupOrderType?.id) {
    return jsonResponse({ ok: true, ignored: true, reason: "No pickup order type" });
  }

  if (!targetOrderId) {
    return jsonResponse({ ok: true, ignored: true, reason: "No orderId" });
  }

  try {
    await fetchCloverWithAutoRefresh(`/v3/merchants/${fallbackMerchantId}/orders/${targetOrderId}`, {
      method: "POST",
      body: { orderType: { id: pickupOrderType.id } },
    });
  } catch (err) {
    if (err instanceof CloverApiError && err.status === 404) {
      return jsonResponse({ ok: true, ignored: true, reason: "Order not found" });
    }
    return jsonResponse({
      error: "No se pudo asignar order type",
      details: err instanceof Error ? err.message : String(err),
    }, 502);
  }

  const localUpdate = await setLocalOrderPaid(Number(conn.idComercio), targetOrderId);

  return jsonResponse({
    ok: true,
    merchantId: fallbackMerchantId,
    paymentId,
    orderId: targetOrderId,
    orderTypeId: pickupOrderType.id,
    usedFallback: !resolvedFromPayment,
    eventType: eventType ?? merchantEvents[0]?.eventType ?? null,
    paymentStatus: paymentLookupStatus,
    localUpdate,
  });
}

Deno.serve(handler);
