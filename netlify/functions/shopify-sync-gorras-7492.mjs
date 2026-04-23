const DEFAULTS = {
  comercioId: 7492,
  menuTitle: 'Gorras',
  shopBaseUrl: 'https://woodbrandpr.com',
  collectionHandle: 'all-caps-hub',
  requestTimeoutMs: 25000,
  chunkSize: 50,
};

function envText(key, fallback = '') {
  const value = String(process.env[key] || '').trim();
  return value || String(fallback).trim();
}

function envNumber(key, fallback) {
  const raw = envText(key, String(fallback));
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value, fallback = 0) {
  const n = Number.parseFloat(String(value ?? '').replace(/,/g, '.'));
  return Number.isFinite(n) ? n : fallback;
}

function parseIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildJsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function buildRuntimeConfig() {
  return {
    supabaseUrl: envText('SUPABASE_URL'),
    supabaseServiceRoleKey: envText('SUPABASE_SERVICE_ROLE_KEY'),
    comercioId: envNumber('SHOPIFY_SYNC_COMERCIO_ID', DEFAULTS.comercioId),
    menuTitle: envText('SHOPIFY_SYNC_MENU_TITLE', DEFAULTS.menuTitle),
    shopBaseUrl: envText('SHOPIFY_SYNC_STORE_URL', DEFAULTS.shopBaseUrl).replace(/\/$/, ''),
    collectionHandle: envText('SHOPIFY_SYNC_COLLECTION_HANDLE', DEFAULTS.collectionHandle),
    timeoutMs: envNumber('SHOPIFY_SYNC_TIMEOUT_MS', DEFAULTS.requestTimeoutMs),
    chunkSize: Math.max(1, envNumber('SHOPIFY_SYNC_CHUNK_SIZE', DEFAULTS.chunkSize)),
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULTS.requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseRest(config, path, init = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Supabase REST error (${response.status}) on ${path}: ${detail}`);
  }

  return body;
}

async function resolveMenu(config) {
  const rows = await supabaseRest(
    config,
    `menus?select=id,titulo,idComercio,activo&idComercio=eq.${config.comercioId}&order=orden.asc&order=id.asc`
  );

  const list = Array.isArray(rows) ? rows : [];
  const target = list.find((row) => normalizeText(row?.titulo) === normalizeText(config.menuTitle));

  if (!target?.id) {
    throw new Error(`No se encontró la categoría "${config.menuTitle}" para el comercio ${config.comercioId}.`);
  }

  return {
    id: Number(target.id),
    titulo: String(target.titulo || config.menuTitle),
  };
}

async function fetchShopifyCollectionProducts(config) {
  const shopifyUrl = `${config.shopBaseUrl}/collections/${encodeURIComponent(config.collectionHandle)}/products.json?limit=250`;

  const response = await fetchWithTimeout(shopifyUrl, { method: 'GET' }, config.timeoutMs);
  if (!response.ok) {
    throw new Error(`No se pudo consultar Shopify (${response.status}) en ${shopifyUrl}`);
  }

  const payload = await response.json();
  const products = Array.isArray(payload?.products) ? payload.products : [];
  return products;
}

function normalizeShopifyProduct(source, index, config, menuId) {
  const variants = Array.isArray(source?.variants) ? source.variants : [];
  const options = Array.isArray(source?.options) ? source.options : [];
  const images = Array.isArray(source?.images)
    ? source.images
        .slice()
        .sort((a, b) => (Number(a?.position) || 0) - (Number(b?.position) || 0))
        .map((img) => String(img?.src || '').trim())
        .filter(Boolean)
    : [];

  const firstVariant = variants[0] || null;
  const available = variants.length ? variants.some((variant) => Boolean(variant?.available)) : true;

  return {
    idMenu: menuId,
    nombre: String(source?.title || 'Producto').trim() || 'Producto',
    descripcion: stripHtml(source?.body_html || ''),
    precio: toNumber(firstVariant?.price, 0),
    precio_texto: null,
    orden: index + 1,
    activo: available,
    origen_catalogo: 'shopify',
    enlace_compra: source?.handle ? `${config.shopBaseUrl}/products/${encodeURIComponent(String(source.handle))}` : null,
    shopify_product_id: source?.id == null ? null : String(source.id),
    shopify_handle: source?.handle ? String(source.handle) : null,
    shopify_updated_at: parseIso(source?.updated_at),
    imagenes: images,
    variantes: {
      options: options.map((option) => ({
        name: String(option?.name || '').trim(),
        values: Array.isArray(option?.values) ? option.values.map((v) => String(v || '').trim()).filter(Boolean) : [],
      })),
      variants: variants.map((variant) => ({
        id: variant?.id == null ? null : String(variant.id),
        title: String(variant?.title || '').trim(),
        option1: variant?.option1 ?? null,
        option2: variant?.option2 ?? null,
        option3: variant?.option3 ?? null,
        price: toNumber(variant?.price, 0),
        compare_at_price: variant?.compare_at_price == null ? null : toNumber(variant?.compare_at_price, 0),
        available: Boolean(variant?.available),
        sku: variant?.sku ?? null,
      })),
    },
  };
}

function chunkArray(items, chunkSize) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function syncProducts(config, menuId, sourceProducts) {
  const normalized = sourceProducts
    .map((item, idx) => normalizeShopifyProduct(item, idx, config, menuId))
    .filter((item) => item.shopify_product_id);

  const currentRows = await supabaseRest(
    config,
    `productos?select=id,shopify_product_id,activo&idMenu=eq.${menuId}&origen_catalogo=eq.shopify&shopify_product_id=not.is.null`
  );
  const existing = Array.isArray(currentRows) ? currentRows : [];

  const existingByShopifyId = new Map(
    existing
      .map((row) => [String(row?.shopify_product_id || ''), Number(row?.id)])
      .filter(([shopifyId, id]) => shopifyId && Number.isFinite(id) && id > 0)
  );

  const incomingIds = new Set(normalized.map((row) => row.shopify_product_id));

  const toInsert = [];
  const toUpdate = [];

  normalized.forEach((payload) => {
    const currentId = existingByShopifyId.get(payload.shopify_product_id);
    if (currentId) {
      toUpdate.push({ id: currentId, payload });
      return;
    }
    toInsert.push(payload);
  });

  let inserted = 0;
  let updated = 0;

  const insertChunks = chunkArray(toInsert, config.chunkSize);
  for (const chunk of insertChunks) {
    await supabaseRest(config, 'productos', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(chunk),
    });
    inserted += chunk.length;
  }

  for (const row of toUpdate) {
    await supabaseRest(config, `productos?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row.payload),
    });
    updated += 1;
  }

  const staleIds = existing
    .filter((row) => {
      const sid = String(row?.shopify_product_id || '');
      return sid && !incomingIds.has(sid);
    })
    .map((row) => Number(row?.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  let deactivated = 0;
  const staleChunks = chunkArray(staleIds, config.chunkSize);
  for (const chunk of staleChunks) {
    const idList = chunk.join(',');
    await supabaseRest(config, `productos?id=in.(${idList})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ activo: false }),
    });
    deactivated += chunk.length;
  }

  const inactiveByAvailability = normalized.filter((row) => row.activo === false).length;

  return {
    sourceProducts: sourceProducts.length,
    normalizedProducts: normalized.length,
    inserted,
    updated,
    deactivated,
    inactiveByAvailability,
  };
}

export default async function handler(_req) {
  const cfg = buildRuntimeConfig();

  if (!cfg.supabaseUrl || !cfg.supabaseServiceRoleKey) {
    return buildJsonResponse(500, {
      ok: false,
      error: 'Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno.',
    });
  }

  try {
    const menu = await resolveMenu(cfg);
    const sourceProducts = await fetchShopifyCollectionProducts(cfg);
    const sync = await syncProducts(cfg, menu.id, sourceProducts);

    return buildJsonResponse(200, {
      ok: true,
      schedule: config.schedule,
      comercioId: cfg.comercioId,
      menuId: menu.id,
      menuTitulo: menu.titulo,
      collectionHandle: cfg.collectionHandle,
      ranAt: new Date().toISOString(),
      ...sync,
    });
  } catch (error) {
    console.error('[shopify-sync-gorras-7492] error', error);
    return buildJsonResponse(500, {
      ok: false,
      error: 'No se pudo ejecutar la sincronización diaria de Shopify.',
      detalle: error?.message || String(error),
    });
  }
}

export const config = {
  // UTC: 08:00 = 04:00 AM Puerto Rico (AST, UTC-4)
  schedule: '0 8 * * *',
};
