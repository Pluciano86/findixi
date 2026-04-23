import {
  buildHeaders,
  createSupabaseAdmin,
  jsonResponse,
  parseBody,
  requireAuthUser,
} from './otpShared.js';

const SHOPIFY_LIMIT = 250;
const SHOPIFY_MAX_PAGES = 30;
const ALLOWED_APP_ADMIN_ROLES = new Set(['admin', 'superadmin', 'app_admin', 'app_superadmin', 'owner', 'app_owner']);

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
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseMissingColumn(error) {
  const detail = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  const patterns = [
    /column\s+"([a-zA-Z0-9_]+)"\s+does not exist/i,
    /Could not find the '([a-zA-Z0-9_]+)' column/i,
    /'([a-zA-Z0-9_]+)' column/i,
  ];
  for (const pattern of patterns) {
    const match = detail.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function toRoleText(value) {
  return String(value || '').trim().toLowerCase();
}

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const detail = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  if (code === '42703' || code.startsWith('pgrst')) return true;
  return detail.includes('does not exist') || detail.includes('column');
}

function isMissingRelationError(error) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return message.includes('relation') && (message.includes('does not exist') || message.includes('not found'));
}

function normalizeShopBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

async function fetchShopifyPages({ baseUrl, path, key, timeoutMs = 25000 }) {
  const rows = [];
  const seenSince = new Set();
  let sinceId = null;

  for (let page = 0; page < SHOPIFY_MAX_PAGES; page += 1) {
    const url = new URL(path, `${baseUrl}/`);
    url.searchParams.set('limit', String(SHOPIFY_LIMIT));
    if (sinceId) url.searchParams.set('since_id', String(sinceId));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

    let payload;
    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Shopify respondió ${response.status} en ${url.pathname}`);
      }
      payload = await response.json();
    } finally {
      clearTimeout(timer);
    }

    const batch = Array.isArray(payload?.[key]) ? payload[key] : [];
    rows.push(...batch);

    if (batch.length < SHOPIFY_LIMIT) break;

    const lastId = Number(batch[batch.length - 1]?.id);
    if (!Number.isFinite(lastId) || lastId <= 0) break;
    if (seenSince.has(lastId)) break;

    seenSince.add(lastId);
    sinceId = lastId;
  }

  return rows;
}

function normalizeVariants(source = {}) {
  const options = Array.isArray(source?.options) ? source.options : [];
  const variants = Array.isArray(source?.variants) ? source.variants : [];

  return {
    options: options.map((option) => ({
      name: String(option?.name || '').trim(),
      values: Array.isArray(option?.values)
        ? option.values.map((value) => String(value || '').trim()).filter(Boolean)
        : [],
    })),
    variants: variants.map((variant) => ({
      id: variant?.id == null ? null : String(variant.id),
      title: String(variant?.title || '').trim(),
      option1: variant?.option1 ?? null,
      option2: variant?.option2 ?? null,
      option3: variant?.option3 ?? null,
      price: toNumber(variant?.price, 0),
      compare_at_price: variant?.compare_at_price == null ? null : toNumber(variant?.compare_at_price, 0),
      available: !!variant?.available,
      sku: variant?.sku ?? null,
    })),
  };
}

function normalizeImages(source = {}) {
  const images = Array.isArray(source?.images) ? source.images : [];
  return images
    .slice()
    .sort((a, b) => (Number(a?.position) || 0) - (Number(b?.position) || 0))
    .map((image) => String(image?.src || '').trim())
    .filter(Boolean);
}

function buildProductPayload(product, { shopBaseUrl, menuId, order }) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const firstVariant = variants[0] || null;
  const available = variants.length ? variants.some((entry) => !!entry?.available) : true;

  const handle = String(product?.handle || '').trim();
  const buyUrl = handle ? `${shopBaseUrl}/products/${encodeURIComponent(handle)}` : null;

  return {
    nombre: String(product?.title || 'Producto').trim() || 'Producto',
    descripcion: stripHtml(product?.body_html || ''),
    precio: toNumber(firstVariant?.price, 0),
    precio_texto: null,
    orden: order,
    activo: available,
    idMenu: menuId,
    idmenu: menuId,
    origen_catalogo: 'shopify',
    enlace_compra: buyUrl,
    shopify_product_id: product?.id == null ? null : String(product.id),
    shopify_handle: handle || null,
    shopify_updated_at: parseIso(product?.updated_at),
    imagenes: normalizeImages(product),
    variantes: normalizeVariants(product),
  };
}

async function saveWithColumnFallback({ supabaseAdmin, table, payload, mode, id = null }) {
  const data = { ...(payload || {}) };

  for (let i = 0; i < 20; i += 1) {
    const query = mode === 'insert'
      ? supabaseAdmin.from(table).insert(data).select('id').maybeSingle()
      : supabaseAdmin.from(table).update(data).eq('id', id).select('id').maybeSingle();

    const result = await query;
    if (!result.error) return { error: null, data: result.data || null };

    const missing = parseMissingColumn(result.error);
    if (!missing || !Object.prototype.hasOwnProperty.call(data, missing)) {
      return { error: result.error, data: null };
    }

    delete data[missing];
  }

  return {
    error: new Error(`No se pudo guardar en ${table} por columnas incompatibles.`),
    data: null,
  };
}

async function fetchComercioMenus(supabaseAdmin, idComercio) {
  const columns = ['idComercio', 'idcomercio'];
  let lastError = null;

  for (const col of columns) {
    const lookup = await supabaseAdmin
      .from('menus')
      .select('id,titulo,orden,activo')
      .eq(col, idComercio)
      .order('orden', { ascending: true })
      .order('id', { ascending: true });

    if (!lookup.error) {
      return {
        rows: Array.isArray(lookup.data) ? lookup.data : [],
        commerceColumn: col,
      };
    }

    lastError = lookup.error;
    if (!isMissingColumnError(lookup.error)) throw lookup.error;
  }

  if (lastError) throw lastError;
  return { rows: [], commerceColumn: 'idComercio' };
}

async function ensureMenuByTitle({ supabaseAdmin, menusState, idComercio, title }) {
  const wantedKey = normalizeText(title);
  const existing = menusState.rows.find((row) => normalizeText(row?.titulo) === wantedKey);
  if (existing?.id) return { id: Number(existing.id), created: false };

  const maxOrder = menusState.rows.reduce((max, row) => Math.max(max, Number(row?.orden) || 0), 0);
  const payload = {
    titulo: String(title || 'General').trim() || 'General',
    descripcion: null,
    orden: maxOrder + 1,
    activo: true,
    idComercio: idComercio,
    idcomercio: idComercio,
  };

  const save = await saveWithColumnFallback({
    supabaseAdmin,
    table: 'menus',
    payload,
    mode: 'insert',
  });

  if (save.error || !save.data?.id) {
    throw save.error || new Error(`No se pudo crear la categoría ${title}.`);
  }

  const row = {
    id: Number(save.data.id),
    titulo: payload.titulo,
    orden: payload.orden,
    activo: true,
  };
  menusState.rows.push(row);

  return { id: Number(row.id), created: true };
}

async function fetchCommerceProductsByMenus(supabaseAdmin, menuIds = []) {
  if (!menuIds.length) return { rows: [], menuColumn: 'idMenu' };

  const candidates = ['idMenu', 'idmenu'];
  let lastError = null;

  for (const column of candidates) {
    const lookup = await supabaseAdmin
      .from('productos')
      .select('id,shopify_product_id,activo')
      .in(column, menuIds);

    if (!lookup.error) {
      return {
        rows: Array.isArray(lookup.data) ? lookup.data : [],
        menuColumn: column,
      };
    }

    lastError = lookup.error;
    if (!isMissingColumnError(lookup.error)) throw lookup.error;
  }

  if (lastError) throw lastError;
  return { rows: [], menuColumn: 'idMenu' };
}

async function resolveUserAppRole(supabaseAdmin, user) {
  const metaRole = toRoleText(user?.user_metadata?.rol_app || user?.app_metadata?.rol_app || user?.role);
  if (metaRole && ALLOWED_APP_ADMIN_ROLES.has(metaRole)) return metaRole;

  const roleColumns = ['rol_app', 'rol', 'role'];
  for (const column of roleColumns) {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select(column)
      .eq('id', user?.id)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error)) return metaRole;
      if (isMissingColumnError(error)) continue;
      throw error;
    }

    const resolvedRole = toRoleText(data?.[column]);
    if (resolvedRole) return resolvedRole;
    return metaRole;
  }

  return metaRole;
}

async function canManageCommerce(supabaseAdmin, { idComercio, user }) {
  const userId = String(user?.id || '').trim();
  if (!userId) return { ok: false, reason: 'forbidden' };

  const appRole = await resolveUserAppRole(supabaseAdmin, user);
  if (ALLOWED_APP_ADMIN_ROLES.has(appRole)) {
    const { data: comercio, error: comercioError } = await supabaseAdmin
      .from('Comercios')
      .select('id,nombre,webpage,owner_user_id')
      .eq('id', idComercio)
      .maybeSingle();
    if (comercioError) throw comercioError;
    if (!comercio) return { ok: false, reason: 'not_found' };
    return { ok: true, comercio };
  }

  const { data: comercio, error: comercioError } = await supabaseAdmin
    .from('Comercios')
    .select('id,nombre,webpage,owner_user_id')
    .eq('id', idComercio)
    .maybeSingle();

  if (comercioError) throw comercioError;
  if (!comercio) return { ok: false, reason: 'not_found' };

  if (comercio.owner_user_id && comercio.owner_user_id === userId) {
    return { ok: true, comercio };
  }

  const { data: relation, error: relationError } = await supabaseAdmin
    .from('UsuarioComercios')
    .select('rol')
    .eq('idUsuario', userId)
    .eq('idComercio', idComercio)
    .limit(1)
    .maybeSingle();

  if (relationError) throw relationError;
  const role = toRoleText(relation?.rol);
  if (!role.includes('admin')) return { ok: false, reason: 'forbidden' };

  return { ok: true, comercio };
}

async function syncShopifyStore({ supabaseAdmin, idComercio, shopBaseUrl }) {
  const collections = await fetchShopifyPages({
    baseUrl: shopBaseUrl,
    path: '/collections.json',
    key: 'collections',
  });

  const productsById = new Map();
  const collectionByProductId = new Map();

  for (let i = 0; i < collections.length; i += 1) {
    const collection = collections[i];
    const handle = String(collection?.handle || '').trim();
    if (!handle) continue;

    const products = await fetchShopifyPages({
      baseUrl: shopBaseUrl,
      path: `/collections/${encodeURIComponent(handle)}/products.json`,
      key: 'products',
    });

    products.forEach((product) => {
      const sid = product?.id == null ? '' : String(product.id);
      if (!sid) return;

      if (!productsById.has(sid)) {
        productsById.set(sid, product);
      }

      if (!collectionByProductId.has(sid)) {
        collectionByProductId.set(sid, {
          title: String(collection?.title || '').trim() || 'General',
          index: i,
        });
      }
    });
  }

  const allProducts = await fetchShopifyPages({
    baseUrl: shopBaseUrl,
    path: '/products.json',
    key: 'products',
  });

  allProducts.forEach((product) => {
    const sid = product?.id == null ? '' : String(product.id);
    if (!sid) return;
    productsById.set(sid, product);
  });

  const menuState = await fetchComercioMenus(supabaseAdmin, idComercio);
  const createdMenuTitles = [];
  const menuIdByLabel = new Map();

  const labels = new Set();
  for (const product of productsById.values()) {
    const sid = product?.id == null ? '' : String(product.id);
    const fromCollection = collectionByProductId.get(sid)?.title || '';
    const fromProductType = String(product?.product_type || '').trim();
    const label = fromCollection || fromProductType || 'General';
    labels.add(label);
  }

  for (const label of labels) {
    const ensured = await ensureMenuByTitle({
      supabaseAdmin,
      menusState: menuState,
      idComercio,
      title: label,
    });
    menuIdByLabel.set(normalizeText(label), ensured.id);
    if (ensured.created) createdMenuTitles.push(label);
  }

  const orderByMenuId = new Map();
  const incoming = [];

  for (const product of productsById.values()) {
    const sid = product?.id == null ? '' : String(product.id);
    if (!sid) continue;

    const fromCollection = collectionByProductId.get(sid)?.title || '';
    const fromProductType = String(product?.product_type || '').trim();
    const label = fromCollection || fromProductType || 'General';
    const menuId = Number(menuIdByLabel.get(normalizeText(label)) || 0);
    if (!Number.isFinite(menuId) || menuId <= 0) continue;

    const nextOrder = (orderByMenuId.get(menuId) || 0) + 1;
    orderByMenuId.set(menuId, nextOrder);

    incoming.push(buildProductPayload(product, {
      shopBaseUrl,
      menuId,
      order: nextOrder,
    }));
  }

  const menuIds = menuState.rows
    .map((row) => Number(row?.id))
    .filter((id) => Number.isFinite(id) && id > 0);

  const currentProducts = await fetchCommerceProductsByMenus(supabaseAdmin, menuIds);
  const existingShopifyRows = currentProducts.rows
    .filter((row) => String(row?.shopify_product_id || '').trim())
    .map((row) => ({
      id: Number(row.id),
      shopify_product_id: String(row.shopify_product_id),
      activo: row.activo !== false,
    }))
    .filter((row) => Number.isFinite(row.id) && row.id > 0);

  const existingByShopifyId = new Map(existingShopifyRows.map((row) => [row.shopify_product_id, row]));
  const incomingIds = new Set(incoming.map((row) => row.shopify_product_id).filter(Boolean));

  let inserted = 0;
  let updated = 0;

  for (const payload of incoming) {
    const sid = String(payload.shopify_product_id || '');
    const previous = existingByShopifyId.get(sid);

    if (previous?.id) {
      const save = await saveWithColumnFallback({
        supabaseAdmin,
        table: 'productos',
        payload,
        mode: 'update',
        id: previous.id,
      });
      if (save.error) throw save.error;
      updated += 1;
      continue;
    }

    const save = await saveWithColumnFallback({
      supabaseAdmin,
      table: 'productos',
      payload,
      mode: 'insert',
    });
    if (save.error) throw save.error;
    inserted += 1;
  }

  let deactivated = 0;
  for (const row of existingShopifyRows) {
    if (incomingIds.has(row.shopify_product_id)) continue;

    const save = await saveWithColumnFallback({
      supabaseAdmin,
      table: 'productos',
      payload: { activo: false },
      mode: 'update',
      id: row.id,
    });
    if (save.error) throw save.error;
    deactivated += 1;
  }

  const inactiveByAvailability = incoming.filter((item) => item.activo === false).length;

  return {
    sourceCollections: collections.length,
    sourceProducts: allProducts.length,
    normalizedProducts: incoming.length,
    inserted,
    updated,
    deactivated,
    inactiveByAvailability,
    createdMenus: createdMenuTitles,
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: buildHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido. Usa POST.' });
  }

  const body = parseBody(event);
  if (body === null) return jsonResponse(400, { error: 'Body inválido.' });

  const idComercio = Number(body?.idComercio || body?.id_comercio || 0);
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    return jsonResponse(400, { error: 'idComercio inválido.' });
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const user = await requireAuthUser(event, supabaseAdmin);
    if (!user) return jsonResponse(401, { error: 'No autorizado.' });

    const permission = await canManageCommerce(supabaseAdmin, { idComercio, user });
    if (!permission.ok) {
      if (permission.reason === 'not_found') return jsonResponse(404, { error: 'Comercio no encontrado.' });
      return jsonResponse(403, { error: 'No tienes permisos para sincronizar esta tienda.' });
    }

    const requestedUrl = normalizeShopBaseUrl(body?.shopBaseUrl || body?.shop_base_url || '');
    const webpageUrl = normalizeShopBaseUrl(permission.comercio?.webpage || '');
    const fallbackEnvUrl = normalizeShopBaseUrl(process.env.SHOPIFY_SYNC_STORE_URL || '');
    const shopBaseUrl = requestedUrl || webpageUrl || fallbackEnvUrl;

    if (!shopBaseUrl) {
      return jsonResponse(400, {
        error: 'No se pudo resolver la URL de Shopify. Configura Comercios.webpage o envía shopBaseUrl.',
      });
    }

    const stats = await syncShopifyStore({
      supabaseAdmin,
      idComercio,
      shopBaseUrl,
    });

    return jsonResponse(200, {
      ok: true,
      idComercio,
      shopBaseUrl,
      ranAt: new Date().toISOString(),
      ...stats,
    });
  } catch (error) {
    console.error('[shopify-sync-store] error', error);
    return jsonResponse(500, {
      error: 'No se pudo sincronizar Shopify para esta tienda.',
      detalle: error?.message || String(error),
    });
  }
};
