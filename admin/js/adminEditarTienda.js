import { supabase } from '../shared/supabaseClient.js';
import { getAppBaseUrl } from '../shared/runtimeConfig.js';

const params = new URLSearchParams(window.location.search);
const rawIdComercio = params.get('id') || params.get('idComercio') || params.get('idcomercio') || '';
const idComercio = Number.parseInt(rawIdComercio, 10);

const storeSubtitle = document.getElementById('storeSubtitle');
const btnBackEditComercio = document.getElementById('btnBackEditComercio');
const storeModeBanner = document.getElementById('storeModeBanner');
const btnPreviewStore = document.getElementById('btnPreviewStore');
const btnOpenLegacyEditor = document.getElementById('btnOpenLegacyEditor');
const btnSaveStoreVisual = document.getElementById('btnSaveStoreVisual');
const storeVisualStatus = document.getElementById('storeVisualStatus');
const storeBannerPreview = document.getElementById('storeBannerPreview');
const storeBannerPreviewEmpty = document.getElementById('storeBannerPreviewEmpty');
const storeBannerPath = document.getElementById('storeBannerPath');
const storeBannerFile = document.getElementById('storeBannerFile');
const btnClearStoreBanner = document.getElementById('btnClearStoreBanner');
const storeBackgroundPreview = document.getElementById('storeBackgroundPreview');
const storeBackgroundPreviewEmpty = document.getElementById('storeBackgroundPreviewEmpty');
const storeBackgroundPath = document.getElementById('storeBackgroundPath');
const storeBackgroundFile = document.getElementById('storeBackgroundFile');
const btnClearStoreBackground = document.getElementById('btnClearStoreBackground');

const btnNewCategory = document.getElementById('btnNewCategory');
const categoriesList = document.getElementById('categoriesList');

const btnNewProduct = document.getElementById('btnNewProduct');
const btnSyncProducts = document.getElementById('btnSyncProducts');
const productFilterSearch = document.getElementById('productFilterSearch');
const productsAccordion = document.getElementById('productsAccordion');

const categoryModal = document.getElementById('categoryModal');
const categoryModalTitle = document.getElementById('categoryModalTitle');
const categoryIdInput = document.getElementById('categoryId');
const categoryTitleInput = document.getElementById('categoryTitle');
const categoryDescriptionInput = document.getElementById('categoryDescription');
const categoryOrderInput = document.getElementById('categoryOrder');
const categoryActiveInput = document.getElementById('categoryActive');
const btnSaveCategory = document.getElementById('btnSaveCategory');

const productModal = document.getElementById('productModal');
const productModalTitle = document.getElementById('productModalTitle');
const productIdInput = document.getElementById('productId');
const productCategoryInput = document.getElementById('productCategory');
const productOriginInput = document.getElementById('productOrigin');
const productNameInput = document.getElementById('productName');
const productBuyUrlInput = document.getElementById('productBuyUrl');
const productDescriptionInput = document.getElementById('productDescription');
const productPriceInput = document.getElementById('productPrice');
const productPriceTextInput = document.getElementById('productPriceText');
const productOrderInput = document.getElementById('productOrder');
const productShopifyIdInput = document.getElementById('productShopifyId');
const productShopifyHandleInput = document.getElementById('productShopifyHandle');
const productShopifyUpdatedAtInput = document.getElementById('productShopifyUpdatedAt');
const productImagesTextInput = document.getElementById('productImagesText');
const productImagesFilesInput = document.getElementById('productImagesFiles');
const productVariantsJsonInput = document.getElementById('productVariantsJson');
const productActiveInput = document.getElementById('productActive');
const btnSaveProduct = document.getElementById('btnSaveProduct');

const BUCKET = 'galeriacomercios';
const DEFAULT_PRODUCTS_VISIBLE = 9;
const LOAD_MORE_STEP = 3;

const state = {
  comercio: null,
  categories: [],
  products: [],
  ui: {
    search: '',
    productVisibleByGroup: {},
    expandedGroupKey: null,
    accordionInitialized: false,
  },
  isStoreCategory: false,
  storeMode: {
    tiendaFisica: true,
    tiendaOnline: false,
  },
  storeVisual: {
    portadaimagen: '',
    backgroundimagen: '',
    idColumn: 'idcomercio',
  },
  columns: {
    menuCommerceColumn: 'idComercio',
    productMenuColumn: 'idMenu',
    productCommerceColumn: null,
  },
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isStoreCategoryByName(name) {
  const normalized = normalizeText(name);
  if (!normalized) return false;
  if (normalized.includes('ropa y accesorios')) return true;
  if (normalized.includes('ropa') && normalized.includes('accesor')) return true;
  return false;
}

function isStoreCategoryMeta(meta = {}) {
  const tipoPerfil = normalizeText(meta?.tipo_perfil);
  if (tipoPerfil === 'tienda') return true;
  return isStoreCategoryByName(meta?.nombre);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseJsonMaybe(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toIsoNow() {
  return new Date().toISOString().replace(/[.:]/g, '-');
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number.parseFloat(String(value).replace(/,/g, '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Por confirmar';

  try {
    return new Intl.NumberFormat('es-PR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function isMissingColumnError(error) {
  const code = String(error?.code || '').toLowerCase();
  const details = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  if (code === '42703' || code.startsWith('pgrst')) return true;
  return details.includes('does not exist') || details.includes('column');
}

function extractMissingColumnName(error) {
  const details = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  const patterns = [
    /column\s+"([a-zA-Z0-9_]+)"\s+does not exist/i,
    /Could not find the '([a-zA-Z0-9_]+)' column/i,
    /'([a-zA-Z0-9_]+)' column/i,
  ];

  for (const pattern of patterns) {
    const match = details.match(pattern);
    if (match?.[1]) return match[1];
  }

  return '';
}

function isMissingStoreColumnsError(error) {
  if (!error) return false;
  const code = String(error.code || '').toLowerCase();
  const detail = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  if (!/tiendafisica|tiendaonline/.test(detail)) return false;
  return code === '42703' || code.startsWith('pgrst') || code === '400' || code === '';
}

function resolveStoreMode(comercio = {}) {
  const hasFisica = typeof comercio?.tiendaFisica === 'boolean';
  const hasOnline = typeof comercio?.tiendaOnline === 'boolean';
  const tiendaFisica = hasFisica ? comercio.tiendaFisica : true;
  const tiendaOnline = hasOnline ? comercio.tiendaOnline : false;
  return {
    tiendaFisica: tiendaFisica !== false,
    tiendaOnline: tiendaOnline === true,
  };
}

function toStoragePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    const marker = '/storage/v1/object/public/galeriacomercios/';
    const idx = raw.toLowerCase().indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(raw.slice(idx + marker.length)).replace(/^\/+/, '');
    }
    return '';
  }

  return raw
    .replace(/^public\//i, '')
    .replace(/^galeriacomercios\//i, '')
    .replace(/^\/+/, '');
}

function toStorageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const clean = raw
    .replace(/^public\//i, '')
    .replace(/^galeriacomercios\//i, '')
    .replace(/^\/+/, '');

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(clean).data?.publicUrl || '';
  return publicUrl || raw;
}

function parseImageSource(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap(parseImageSource);
  }

  if (typeof value === 'object') {
    const src = value.src || value.url || value.publicUrl || value.path || value.imagen;
    return src ? [String(src).trim()] : [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    const asJson = parseJsonMaybe(trimmed, null);
    if (asJson) return parseImageSource(asJson);

    if (trimmed.includes(',')) {
      return trimmed.split(',').map((part) => part.trim()).filter(Boolean);
    }

    return [trimmed];
  }

  return [];
}

function resolveProductImages(product = {}) {
  const candidates = [
    product?.imagenes,
    product?.images,
    product?.galeria,
    product?.shopify_images,
    product?.featured_image,
    product?.imagen,
    product?.image,
  ];

  const all = candidates.flatMap(parseImageSource).map((item) => String(item || '').trim()).filter(Boolean);
  return Array.from(new Set(all));
}

function parseVariantsObject(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') return parseJsonMaybe(value, null);
  return null;
}

function getCategoryById(categoryId) {
  const id = Number(categoryId);
  if (!Number.isFinite(id)) return null;
  return state.categories.find((category) => Number(category.id) === id) || null;
}

function getProductCategoryId(product = {}) {
  const value = product?.[state.columns.productMenuColumn] ?? product?.idMenu ?? product?.idmenu;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getProductPriceLabel(product = {}) {
  const textPrice = String(product?.precio_texto || '').trim();
  if (textPrice) return textPrice;

  const numericPrice = parseNumber(product?.precio, null);
  if (numericPrice !== null) return formatMoney(numericPrice);

  return 'Por confirmar';
}

function buildLinks() {
  const adminBase = getAppBaseUrl('admin');
  const comercioBase = getAppBaseUrl('comercio');
  const publicBase = getAppBaseUrl('public');

  if (btnBackEditComercio) {
    btnBackEditComercio.href = `${adminBase}/editarComercio.html?id=${encodeURIComponent(idComercio)}`;
  }

  if (btnPreviewStore) {
    btnPreviewStore.href = `${publicBase}/tienda/tiendaComercio.html?idComercio=${encodeURIComponent(idComercio)}`;
  }

  if (btnOpenLegacyEditor) {
    btnOpenLegacyEditor.href = `${comercioBase}/adminMenuComercio.html?id=${encodeURIComponent(idComercio)}&desde=admin_tienda`;
  }
}

function showBanner(message, tone = 'neutral') {
  if (!storeModeBanner) return;

  storeModeBanner.classList.remove('hidden');
  storeModeBanner.textContent = message;
  storeModeBanner.className = 'mt-4 p-3 rounded-lg border text-sm';

  if (tone === 'error') {
    storeModeBanner.classList.add('bg-red-50', 'text-red-700', 'border-red-200');
    return;
  }
  if (tone === 'warning') {
    storeModeBanner.classList.add('bg-amber-50', 'text-amber-700', 'border-amber-200');
    return;
  }
  if (tone === 'success') {
    storeModeBanner.classList.add('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    return;
  }

  storeModeBanner.classList.add('bg-slate-100', 'text-slate-700', 'border-slate-200');
}

function showTransientMessage(message) {
  showBanner(message, 'success');
  window.setTimeout(() => {
    const modeTxt = `Modo tienda: ${state.storeMode.tiendaFisica ? 'Física' : ''}${state.storeMode.tiendaFisica && state.storeMode.tiendaOnline ? ' + ' : ''}${state.storeMode.tiendaOnline ? 'Online' : ''}`;
    showBanner(modeTxt, 'neutral');
  }, 2000);
}

function setSyncButtonBusy(isBusy, text = 'Sincronizar Productos') {
  if (!btnSyncProducts) return;
  btnSyncProducts.disabled = !!isBusy;
  btnSyncProducts.classList.toggle('opacity-70', !!isBusy);
  btnSyncProducts.classList.toggle('cursor-not-allowed', !!isBusy);
  btnSyncProducts.textContent = text;
}

function buildSyncSummary(sync = {}) {
  const inserted = Number(sync?.inserted || 0);
  const updated = Number(sync?.updated || 0);
  const deactivated = Number(sync?.deactivated || 0);
  const normalized = Number(sync?.normalizedProducts || 0);
  const inactive = Number(sync?.inactiveByAvailability || 0);
  const createdMenus = Array.isArray(sync?.createdMenus) ? sync.createdMenus.length : 0;

  return [
    `Sync completado: ${normalized} productos.`,
    `Nuevos ${inserted}.`,
    `Actualizados ${updated}.`,
    `Desactivados ${deactivated}.`,
    `No disponibles ${inactive}.`,
    `Categorías creadas ${createdMenus}.`,
  ].join(' ');
}

function resolveShopifyBaseUrlFromComercio() {
  const raw = String(state.comercio?.webpage || '').trim();
  if (!raw) return '';

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

async function getAccessTokenOrThrow() {
  const auth = await supabase.auth.getSession();
  if (auth.error) throw auth.error;
  const token = String(auth.data?.session?.access_token || '').trim();
  if (!token) throw new Error('Tu sesión expiró. Inicia sesión nuevamente en Admin.');
  return token;
}

function getShopifySyncEndpointCandidates() {
  const host = String(window.location.hostname || '').toLowerCase();
  const port = String(window.location.port || '');
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
  const customBase = String(window.FINDIXI_FUNCTIONS_BASE_URL || '').trim().replace(/\/+$/, '');
  const urls = [];

  if (customBase) {
    urls.push(`${customBase}/api/shopify-sync-store`);
    urls.push(`${customBase}/.netlify/functions/shopify-sync-store`);
  }

  if (isLocal && port !== '8888') {
    urls.push('http://localhost:8888/api/shopify-sync-store');
    urls.push('http://localhost:8888/.netlify/functions/shopify-sync-store');
  }

  urls.push('/api/shopify-sync-store');
  urls.push('/.netlify/functions/shopify-sync-store');

  return [...new Set(urls)];
}

async function callShopifySyncEndpoint({ token, payload }) {
  const candidates = getShopifySyncEndpointCandidates();
  let lastError = null;

  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (response.ok) return data || {};

      const detail = data?.error || data?.detalle || `Error ${response.status}`;
      const canTryNext = response.status === 404 || response.status === 405;
      if (!canTryNext) {
        throw new Error(String(detail || 'No se pudo sincronizar productos.'));
      }

      lastError = new Error(`Endpoint ${endpoint} respondió ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No se encontró un endpoint disponible para sincronizar productos.');
}

async function handleSyncProducts() {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    alert('ID de comercio inválido para sincronizar.');
    return;
  }

  const ok = window.confirm(
    'Esto sincronizará toda la tienda desde Shopify (todos los productos y categorías por colección). ¿Continuar?'
  );
  if (!ok) return;

  setSyncButtonBusy(true, 'Sincronizando...');
  showBanner('Sincronizando productos desde Shopify...', 'neutral');

  try {
    const token = await getAccessTokenOrThrow();
    const shopBaseUrl = resolveShopifyBaseUrlFromComercio();
    const payload = await callShopifySyncEndpoint({
      token,
      payload: {
        idComercio,
        shopBaseUrl: shopBaseUrl || null,
      },
    });

    await loadData();
    showBanner(buildSyncSummary(payload || {}), 'success');
  } catch (error) {
    console.error('Error sincronizando Shopify:', error);
    showBanner(`No se pudo sincronizar: ${error?.message || String(error)}`, 'error');
    alert(error?.message || 'No se pudo sincronizar productos desde Shopify.');
  } finally {
    setSyncButtonBusy(false, 'Sincronizar Productos');
  }
}

function setStoreVisualStatus(message, tone = 'neutral') {
  if (!storeVisualStatus) return;

  storeVisualStatus.textContent = String(message || '');
  storeVisualStatus.className = 'text-xs mt-2';

  if (tone === 'error') {
    storeVisualStatus.classList.add('text-red-600');
    return;
  }
  if (tone === 'warning') {
    storeVisualStatus.classList.add('text-amber-600');
    return;
  }
  if (tone === 'success') {
    storeVisualStatus.classList.add('text-emerald-600');
    return;
  }

  storeVisualStatus.classList.add('text-slate-500');
}

function revokePreviewObjectUrl(previewEl) {
  if (!previewEl) return;
  const url = String(previewEl.dataset.objectUrl || '').trim();
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch (_error) {
      // Ignorar.
    }
  }
  previewEl.dataset.objectUrl = '';
}

function renderStoreVisualPreviews() {
  const bannerPath = String(state.storeVisual?.portadaimagen || '').trim();
  const backgroundPath = String(state.storeVisual?.backgroundimagen || '').trim();

  if (storeBannerPreview) {
    revokePreviewObjectUrl(storeBannerPreview);
    const src = bannerPath ? toStorageUrl(bannerPath) : '';
    if (src) {
      storeBannerPreview.src = src;
      storeBannerPreview.classList.remove('hidden');
      storeBannerPreviewEmpty?.classList.add('hidden');
    } else {
      storeBannerPreview.removeAttribute('src');
      storeBannerPreview.classList.add('hidden');
      storeBannerPreviewEmpty?.classList.remove('hidden');
    }
  }
  if (storeBannerPath) {
    storeBannerPath.textContent = bannerPath ? `Ruta actual: ${bannerPath}` : 'Sin banner guardado.';
  }

  if (storeBackgroundPreview) {
    revokePreviewObjectUrl(storeBackgroundPreview);
    const src = backgroundPath ? toStorageUrl(backgroundPath) : '';
    if (src) {
      storeBackgroundPreview.src = src;
      storeBackgroundPreview.classList.remove('hidden');
      storeBackgroundPreviewEmpty?.classList.add('hidden');
    } else {
      storeBackgroundPreview.removeAttribute('src');
      storeBackgroundPreview.classList.add('hidden');
      storeBackgroundPreviewEmpty?.classList.remove('hidden');
    }
  }
  if (storeBackgroundPath) {
    storeBackgroundPath.textContent = backgroundPath ? `Ruta actual: ${backgroundPath}` : 'Sin fondo guardado.';
  }
}

function previewStoreVisualFile(kind = 'banner') {
  const isBanner = kind === 'banner';
  const input = isBanner ? storeBannerFile : storeBackgroundFile;
  const preview = isBanner ? storeBannerPreview : storeBackgroundPreview;
  const empty = isBanner ? storeBannerPreviewEmpty : storeBackgroundPreviewEmpty;
  const pathEl = isBanner ? storeBannerPath : storeBackgroundPath;
  const file = input?.files?.[0];

  if (!preview || !empty || !pathEl || !file) return;

  revokePreviewObjectUrl(preview);
  const objectUrl = URL.createObjectURL(file);
  preview.dataset.objectUrl = objectUrl;
  preview.src = objectUrl;
  preview.classList.remove('hidden');
  empty.classList.add('hidden');
  pathEl.textContent = `Archivo listo para guardar: ${file.name}`;
}

async function fetchStoreVisualTheme() {
  const candidates = ['idcomercio', 'idComercio'];
  let lastError = null;

  for (const idColumn of candidates) {
    const lookup = await supabase
      .from('menu_tema')
      .select('portadaimagen,backgroundimagen')
      .eq(idColumn, idComercio)
      .maybeSingle();

    if (!lookup.error) {
      state.storeVisual = {
        ...state.storeVisual,
        idColumn,
        portadaimagen: String(lookup.data?.portadaimagen || '').trim(),
        backgroundimagen: String(lookup.data?.backgroundimagen || '').trim(),
      };
      return;
    }

    if (isMissingColumnError(lookup.error)) {
      lastError = lookup.error;
      continue;
    }

    const msg = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
    if (msg.includes('menu_tema') && (msg.includes('does not exist') || msg.includes('relation'))) {
      setStoreVisualStatus('No se encontró la tabla menu_tema para guardar visual de tienda.', 'warning');
      return;
    }

    lastError = lookup.error;
    break;
  }

  if (lastError) {
    console.warn('No se pudo cargar visual de tienda:', lastError);
    setStoreVisualStatus('No se pudo cargar el banner/fondo actual.', 'warning');
  }
}

async function uploadStoreVisualAsset(file, prefix, baseName) {
  if (!file) return '';

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    throw new Error(`Formato no permitido: ${file.name}. Usa JPG, PNG o WEBP.`);
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`La imagen ${file.name} supera 10MB.`);
  }

  const ext = String(file.name.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${prefix}/${idComercio}/${baseName}.${ext}`;

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '0',
    });

  if (upload.error) throw upload.error;
  return filename;
}

async function upsertStoreVisualTheme(payloadFields = {}) {
  const candidates = Array.from(new Set([
    state.storeVisual.idColumn,
    'idcomercio',
    'idComercio',
  ].filter(Boolean)));
  let lastError = null;

  for (const idColumn of candidates) {
    const payload = {
      [idColumn]: idComercio,
      ...payloadFields,
    };

    const upsertRes = await supabase
      .from('menu_tema')
      .upsert(payload, { onConflict: idColumn, defaultToNull: false })
      .select('portadaimagen,backgroundimagen');

    if (!upsertRes.error) {
      state.storeVisual.idColumn = idColumn;
      return;
    }

    if (isMissingColumnError(upsertRes.error)) {
      lastError = upsertRes.error;
      continue;
    }

    const msg = `${upsertRes.error?.message || ''} ${upsertRes.error?.details || ''}`.toLowerCase();
    const isConflictStrategyIssue = msg.includes('on conflict') || msg.includes('constraint');
    if (!isConflictStrategyIssue) {
      lastError = upsertRes.error;
      continue;
    }

    const updateRes = await supabase
      .from('menu_tema')
      .update(payloadFields)
      .eq(idColumn, idComercio)
      .select('portadaimagen');

    if (!updateRes.error && Array.isArray(updateRes.data) && updateRes.data.length > 0) {
      state.storeVisual.idColumn = idColumn;
      return;
    }

    if (updateRes.error && !isMissingColumnError(updateRes.error)) {
      lastError = updateRes.error;
      continue;
    }

    const insertRes = await supabase
      .from('menu_tema')
      .insert(payload)
      .select('portadaimagen');

    if (!insertRes.error) {
      state.storeVisual.idColumn = idColumn;
      return;
    }

    if (!isMissingColumnError(insertRes.error)) {
      lastError = insertRes.error;
    } else {
      lastError = insertRes.error;
    }
  }

  throw lastError || new Error('No se pudo guardar visual de tienda en menu_tema.');
}

async function handleSaveStoreVisual() {
  if (!btnSaveStoreVisual) return;

  btnSaveStoreVisual.disabled = true;
  btnSaveStoreVisual.classList.add('opacity-70', 'cursor-not-allowed');
  setStoreVisualStatus('Guardando visual de tienda...', 'neutral');

  try {
    const bannerFile = storeBannerFile?.files?.[0] || null;
    const backgroundFile = storeBackgroundFile?.files?.[0] || null;

    let nextBannerPath = String(state.storeVisual.portadaimagen || '').trim();
    let nextBackgroundPath = String(state.storeVisual.backgroundimagen || '').trim();

    if (bannerFile) {
      nextBannerPath = await uploadStoreVisualAsset(bannerFile, 'menus/portada', 'tienda-banner');
    }
    if (backgroundFile) {
      nextBackgroundPath = await uploadStoreVisualAsset(backgroundFile, 'menus/background', 'tienda-background');
    }

    await upsertStoreVisualTheme({
      portadaimagen: nextBannerPath || '',
      backgroundimagen: nextBackgroundPath || '',
    });

    state.storeVisual.portadaimagen = nextBannerPath || '';
    state.storeVisual.backgroundimagen = nextBackgroundPath || '';
    if (storeBannerFile) storeBannerFile.value = '';
    if (storeBackgroundFile) storeBackgroundFile.value = '';
    renderStoreVisualPreviews();
    setStoreVisualStatus('Banner y fondo guardados correctamente.', 'success');
  } catch (error) {
    console.error('Error guardando visual de tienda:', error);
    setStoreVisualStatus('No se pudo guardar el banner/fondo. Revisa la consola.', 'error');
  } finally {
    btnSaveStoreVisual.disabled = false;
    btnSaveStoreVisual.classList.remove('opacity-70', 'cursor-not-allowed');
  }
}

function bindStoreVisualActions() {
  storeBannerFile?.addEventListener('change', () => {
    previewStoreVisualFile('banner');
  });

  storeBackgroundFile?.addEventListener('change', () => {
    previewStoreVisualFile('background');
  });

  btnClearStoreBanner?.addEventListener('click', () => {
    state.storeVisual.portadaimagen = '';
    if (storeBannerFile) storeBannerFile.value = '';
    renderStoreVisualPreviews();
    setStoreVisualStatus('Banner marcado para remover. Presiona "Guardar visual".', 'warning');
  });

  btnClearStoreBackground?.addEventListener('click', () => {
    state.storeVisual.backgroundimagen = '';
    if (storeBackgroundFile) storeBackgroundFile.value = '';
    renderStoreVisualPreviews();
    setStoreVisualStatus('Fondo marcado para remover. Presiona "Guardar visual".', 'warning');
  });

  btnSaveStoreVisual?.addEventListener('click', () => {
    void handleSaveStoreVisual();
  });
}

async function fetchComercio() {
  const baseSelect = 'id,nombre,categoria,webpage,tiendaFisica,tiendaOnline';
  let lookup = await supabase
    .from('Comercios')
    .select(baseSelect)
    .eq('id', idComercio)
    .maybeSingle();

  if (isMissingStoreColumnsError(lookup.error)) {
    lookup = await supabase
      .from('Comercios')
      .select('id,nombre,categoria,webpage')
      .eq('id', idComercio)
      .maybeSingle();
  }

  if (lookup.error || !lookup.data) {
    throw lookup.error || new Error('No se pudo cargar el comercio.');
  }

  state.comercio = lookup.data;
  state.storeMode = resolveStoreMode(lookup.data);
}

async function fetchStoreProfileFromCategories() {
  const rel = await supabase
    .from('ComercioCategorias')
    .select('idCategoria')
    .eq('idComercio', idComercio);

  if (rel.error || !Array.isArray(rel.data) || !rel.data.length) {
    state.isStoreCategory = isStoreCategoryByName(state.comercio?.categoria);
    return;
  }

  const ids = Array.from(new Set(rel.data.map((item) => Number(item?.idCategoria)).filter((id) => Number.isFinite(id) && id > 0)));
  if (!ids.length) {
    state.isStoreCategory = isStoreCategoryByName(state.comercio?.categoria);
    return;
  }

  let cats = await supabase
    .from('Categorias')
    .select('id,nombre,tipo_perfil')
    .in('id', ids);

  if (cats.error && /tipo_perfil/i.test(String(cats.error?.message || cats.error?.details || ''))) {
    cats = await supabase
      .from('Categorias')
      .select('id,nombre')
      .in('id', ids);
  }

  if (cats.error) {
    state.isStoreCategory = isStoreCategoryByName(state.comercio?.categoria);
    return;
  }

  const list = Array.isArray(cats.data) ? cats.data : [];
  state.isStoreCategory = list.some(isStoreCategoryMeta) || isStoreCategoryByName(state.comercio?.categoria);
}

async function fetchCategories() {
  const columns = ['idComercio', 'idcomercio'];

  for (const column of columns) {
    const lookup = await supabase
      .from('menus')
      .select('id,titulo,descripcion,orden,activo')
      .eq(column, idComercio)
      .order('orden', { ascending: true })
      .order('id', { ascending: true });

    if (!lookup.error) {
      state.columns.menuCommerceColumn = column;
      state.categories = Array.isArray(lookup.data) ? lookup.data : [];
      return;
    }

    if (!isMissingColumnError(lookup.error)) {
      throw lookup.error;
    }
  }

  state.categories = [];
}

async function tryFetchProductsByMenuColumn(menuIds = [], menuColumn = 'idMenu') {
  if (!menuIds.length) return { data: [], error: null, column: menuColumn };

  const lookup = await supabase
    .from('productos')
    .select('*')
    .in(menuColumn, menuIds)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  return {
    data: Array.isArray(lookup.data) ? lookup.data : [],
    error: lookup.error || null,
    column: menuColumn,
  };
}

async function fetchProductsByCategories(menuIds = []) {
  const candidates = ['idMenu', 'idmenu'];

  for (const column of candidates) {
    const result = await tryFetchProductsByMenuColumn(menuIds, column);

    if (!result.error) {
      state.columns.productMenuColumn = column;
      return result.data;
    }

    if (!isMissingColumnError(result.error)) {
      throw result.error;
    }
  }

  return [];
}

async function fetchProductsByCommerceFallback() {
  const candidates = ['idComercio', 'idcomercio'];

  for (const column of candidates) {
    const lookup = await supabase
      .from('productos')
      .select('*')
      .eq(column, idComercio)
      .order('orden', { ascending: true })
      .order('id', { ascending: true });

    if (!lookup.error) {
      state.columns.productCommerceColumn = column;
      return Array.isArray(lookup.data) ? lookup.data : [];
    }

    if (!isMissingColumnError(lookup.error)) {
      throw lookup.error;
    }
  }

  return [];
}

function mergeProducts(a = [], b = []) {
  const map = new Map();

  [...a, ...b].forEach((row) => {
    const key = String(row?.id || `tmp-${Math.random().toString(16).slice(2)}`);
    if (!map.has(key)) map.set(key, row);
  });

  return Array.from(map.values());
}

function sortCategories(list = []) {
  return [...list].sort((x, y) => {
    const ox = Number(x?.orden) || 0;
    const oy = Number(y?.orden) || 0;
    if (ox !== oy) return ox - oy;
    return String(x?.titulo || '').localeCompare(String(y?.titulo || ''), 'es', { sensitivity: 'base' });
  });
}

function sortProducts(list = []) {
  return [...list].sort((x, y) => {
    const ox = Number(x?.orden) || 0;
    const oy = Number(y?.orden) || 0;
    if (ox !== oy) return ox - oy;
    return String(x?.nombre || '').localeCompare(String(y?.nombre || ''), 'es', { sensitivity: 'base' });
  });
}

function renderHeader() {
  if (!storeSubtitle) return;

  const nombre = state.comercio?.nombre || `Comercio #${idComercio}`;
  storeSubtitle.textContent = `${nombre} · Gestiona categorías y productos para tiendaComercio.`;

  const modeTxt = `Modo tienda: ${state.storeMode.tiendaFisica ? 'Física' : ''}${state.storeMode.tiendaFisica && state.storeMode.tiendaOnline ? ' + ' : ''}${state.storeMode.tiendaOnline ? 'Online' : ''}`;

  if (!state.isStoreCategory) {
    showBanner(`${modeTxt}. Aviso: este comercio no está en categoría de tienda; activa "Ropa y Accesorios" (tipo perfil tienda).`, 'warning');
    return;
  }

  showBanner(modeTxt, 'neutral');
}

function ensureCategorySelectOptions() {
  const options = state.categories.map((category) => {
    const id = Number(category.id);
    const title = String(category.titulo || 'Categoría').trim();
    return `<option value="${id}">${escapeHtml(title)}</option>`;
  }).join('');

  if (productCategoryInput) {
    productCategoryInput.innerHTML = options || '<option value="">Sin categorías</option>';
  }
}

function renderCategories() {
  if (!categoriesList) return;

  const sorted = sortCategories(state.categories);

  if (!sorted.length) {
    categoriesList.innerHTML = '<p class="text-sm text-slate-500">Aún no hay categorías. Crea una para comenzar.</p>';
    ensureCategorySelectOptions();
    return;
  }

  const byMenuId = new Map();
  state.products.forEach((product) => {
    const catId = getProductCategoryId(product);
    if (!Number.isFinite(catId)) return;
    byMenuId.set(catId, (byMenuId.get(catId) || 0) + 1);
  });

  categoriesList.innerHTML = sorted.map((category) => {
    const id = Number(category.id);
    const title = String(category.titulo || 'Categoría').trim();
    const descripcion = String(category.descripcion || '').trim();
    const orden = Number(category.orden) || 0;
    const activos = category.activo === false ? 'Inactiva' : 'Activa';
    const total = byMenuId.get(id) || 0;

    return `
      <article class="border border-slate-200 rounded-xl p-3 bg-slate-50">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="text-sm font-semibold text-slate-800">${escapeHtml(title)}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Orden ${orden} · ${activos} · ${total} producto${total === 1 ? '' : 's'}</p>
          </div>
          <div class="flex items-center gap-1">
            <button type="button" data-action="edit-category" data-id="${id}" class="px-2 py-1 text-xs rounded-md border border-slate-300 text-slate-700 hover:bg-white">Editar</button>
            <button type="button" data-action="delete-category" data-id="${id}" class="px-2 py-1 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50">Eliminar</button>
          </div>
        </div>
        ${descripcion ? `<p class="text-xs text-slate-600 mt-2">${escapeHtml(descripcion)}</p>` : ''}
      </article>
    `;
  }).join('');

  ensureCategorySelectOptions();
}

function buildProductGroups() {
  const term = normalizeText(state.ui.search);
  const products = sortProducts(state.products).filter((product) => {
    if (!term) return true;
    const catId = getProductCategoryId(product);
    const haystack = normalizeText([
      product?.nombre,
      product?.descripcion,
      product?.precio_texto,
      getCategoryById(catId)?.titulo,
    ].filter(Boolean).join(' '));
    return haystack.includes(term);
  });

  const grouped = new Map();
  products.forEach((product) => {
    const catId = getProductCategoryId(product);
    const key = Number.isFinite(catId) ? `cat:${catId}` : 'cat:uncategorized';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(product);
  });

  const groups = [];
  const knownKeys = new Set();
  sortCategories(state.categories).forEach((category) => {
    const catId = Number(category.id);
    const key = `cat:${catId}`;
    knownKeys.add(key);
    const items = grouped.get(key) || [];
    if (!items.length) return;
    groups.push({
      key,
      title: String(category.titulo || 'Categoría').trim() || 'Categoría',
      items,
    });
  });

  const orphanKeys = Array.from(grouped.keys())
    .filter((key) => key !== 'cat:uncategorized' && !knownKeys.has(key))
    .sort((a, b) => Number(a.replace('cat:', '')) - Number(b.replace('cat:', '')));

  orphanKeys.forEach((key) => {
    const catId = Number(key.replace('cat:', ''));
    const items = grouped.get(key) || [];
    if (!items.length) return;
    groups.push({
      key,
      title: `Categoría ${Number.isFinite(catId) ? catId : ''}`.trim(),
      items,
    });
  });

  const uncategorized = grouped.get('cat:uncategorized') || [];
  if (uncategorized.length) {
    groups.push({
      key: 'cat:uncategorized',
      title: 'Sin categoría',
      items: uncategorized,
    });
  }

  return groups;
}

function ensureProductAccordionState(groups = []) {
  const validKeys = new Set(groups.map((group) => group.key));

  Object.keys(state.ui.productVisibleByGroup || {}).forEach((key) => {
    if (!validKeys.has(key)) delete state.ui.productVisibleByGroup[key];
  });

  groups.forEach((group) => {
    if (!Number.isFinite(Number(state.ui.productVisibleByGroup[group.key]))) {
      state.ui.productVisibleByGroup[group.key] = DEFAULT_PRODUCTS_VISIBLE;
    }
  });

  if (!groups.length) {
    state.ui.expandedGroupKey = null;
    return;
  }

  if (!state.ui.accordionInitialized && !state.ui.expandedGroupKey) {
    state.ui.expandedGroupKey = groups[0].key;
    state.ui.accordionInitialized = true;
    return;
  }

  if (state.ui.expandedGroupKey && !validKeys.has(state.ui.expandedGroupKey)) {
    state.ui.expandedGroupKey = groups[0].key;
  }
}

function renderProductTile(product) {
  const id = Number(product.id);
  const images = resolveProductImages(product);
  const firstImage = toStorageUrl(images[0] || '');
  const name = String(product?.nombre || 'Producto').trim() || 'Producto';
  const price = getProductPriceLabel(product);

  return `
    <article
      data-action="edit-product"
      data-id="${id}"
      class="relative rounded-lg border border-slate-200 bg-white p-1 shadow-sm cursor-pointer hover:border-slate-300"
      title="Editar producto"
    >
      <button
        type="button"
        data-action="delete-product"
        data-id="${id}"
        class="absolute top-1 right-1 z-10 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/95 border border-red-200 text-red-600 text-[11px]"
        title="Eliminar producto"
      >
        &times;
      </button>

      <div class="aspect-square rounded-md overflow-hidden bg-slate-100">
        ${firstImage
          ? `<img src="${escapeHtml(firstImage)}" alt="${escapeHtml(name)}" class="w-full h-full object-cover" loading="lazy" />`
          : '<div class="w-full h-full flex items-center justify-center text-[10px] text-slate-400">Sin imagen</div>'
        }
      </div>

      <p class="mt-1 text-[11px] leading-tight text-slate-800 text-center min-h-[2rem]" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
        ${escapeHtml(name)}
      </p>
      <p class="text-[11px] font-semibold text-slate-900 text-center">${escapeHtml(price)}</p>
    </article>
  `;
}

function renderProducts() {
  if (!productsAccordion) return;

  const groups = buildProductGroups();
  if (!groups.length) {
    productsAccordion.innerHTML = '<p class="text-sm text-slate-500">No hay productos para el filtro actual.</p>';
    return;
  }

  ensureProductAccordionState(groups);

  productsAccordion.innerHTML = groups.map((group) => {
    const expanded = state.ui.expandedGroupKey === group.key;
    const visible = Number(state.ui.productVisibleByGroup[group.key]) || DEFAULT_PRODUCTS_VISIBLE;
    const visibleItems = group.items.slice(0, visible);
    const remaining = Math.max(group.items.length - visibleItems.length, 0);

    return `
      <article class="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
        <button
          type="button"
          data-action="toggle-group"
          data-group-key="${escapeHtml(group.key)}"
          class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left bg-white border-b border-slate-200"
        >
          <span class="text-sm font-semibold text-slate-800">${escapeHtml(group.title)}</span>
          <span class="inline-flex items-center gap-2 text-xs text-slate-500">
            <span>${group.items.length}</span>
            <i class="fas fa-chevron-${expanded ? 'up' : 'down'}"></i>
          </span>
        </button>

        <div class="${expanded ? 'block' : 'hidden'} px-2.5 py-2.5">
          <div class="grid grid-cols-3 gap-2">
            ${visibleItems.map((item) => renderProductTile(item)).join('')}
          </div>
          ${remaining > 0
            ? `<div class="mt-3 flex justify-center">
                <button
                  type="button"
                  data-action="load-more"
                  data-group-key="${escapeHtml(group.key)}"
                  class="px-3 py-1.5 rounded-full border border-slate-300 text-slate-700 text-xs bg-white hover:bg-slate-100"
                >
                  Ver ${LOAD_MORE_STEP} más (${remaining} restantes)
                </button>
              </div>`
            : ''
          }
        </div>
      </article>
    `;
  }).join('');
}

function closeModal(which) {
  if (which === 'category' && categoryModal) {
    categoryModal.classList.add('hidden');
    return;
  }
  if (which === 'product' && productModal) {
    productModal.classList.add('hidden');
  }
}

function openModal(which) {
  if (which === 'category' && categoryModal) {
    categoryModal.classList.remove('hidden');
    return;
  }
  if (which === 'product' && productModal) {
    productModal.classList.remove('hidden');
  }
}

function bindModalClosers() {
  document.querySelectorAll('[data-modal-close]').forEach((node) => {
    node.addEventListener('click', (event) => {
      const target = event.currentTarget;
      const which = target?.getAttribute('data-modal-close');
      if (!which) return;
      closeModal(which);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (categoryModal && !categoryModal.classList.contains('hidden')) closeModal('category');
    if (productModal && !productModal.classList.contains('hidden')) closeModal('product');
  });
}

function resetCategoryModal() {
  if (categoryModalTitle) categoryModalTitle.textContent = 'Nueva Categoría';
  if (categoryIdInput) categoryIdInput.value = '';
  if (categoryTitleInput) categoryTitleInput.value = '';
  if (categoryDescriptionInput) categoryDescriptionInput.value = '';
  if (categoryOrderInput) {
    const maxOrder = state.categories.reduce((max, item) => Math.max(max, Number(item?.orden) || 0), 0);
    categoryOrderInput.value = String(maxOrder + 1 || 1);
  }
  if (categoryActiveInput) categoryActiveInput.checked = true;
}

function openCategoryCreateModal() {
  resetCategoryModal();
  openModal('category');
}

function openCategoryEditModal(categoryId) {
  const row = state.categories.find((category) => Number(category.id) === Number(categoryId));
  if (!row) return;

  if (categoryModalTitle) categoryModalTitle.textContent = 'Editar Categoría';
  if (categoryIdInput) categoryIdInput.value = String(row.id);
  if (categoryTitleInput) categoryTitleInput.value = String(row.titulo || '');
  if (categoryDescriptionInput) categoryDescriptionInput.value = String(row.descripcion || '');
  if (categoryOrderInput) categoryOrderInput.value = String(Number(row.orden) || 1);
  if (categoryActiveInput) categoryActiveInput.checked = row.activo !== false;

  openModal('category');
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDatetimeLocalValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function resetProductModal() {
  if (productModalTitle) productModalTitle.textContent = 'Nuevo Producto';
  if (productIdInput) productIdInput.value = '';

  ensureCategorySelectOptions();
  if (productCategoryInput) {
    const first = state.categories[0];
    productCategoryInput.value = first ? String(first.id) : '';
  }

  if (productOriginInput) productOriginInput.value = 'findixi';
  if (productNameInput) productNameInput.value = '';
  if (productBuyUrlInput) productBuyUrlInput.value = '';
  if (productDescriptionInput) productDescriptionInput.value = '';
  if (productPriceInput) productPriceInput.value = '';
  if (productPriceTextInput) productPriceTextInput.value = '';

  if (productOrderInput) {
    const maxOrder = state.products.reduce((max, item) => Math.max(max, Number(item?.orden) || 0), 0);
    productOrderInput.value = String(maxOrder + 1 || 1);
  }

  if (productShopifyIdInput) productShopifyIdInput.value = '';
  if (productShopifyHandleInput) productShopifyHandleInput.value = '';
  if (productShopifyUpdatedAtInput) productShopifyUpdatedAtInput.value = '';

  if (productImagesTextInput) productImagesTextInput.value = '';
  if (productImagesFilesInput) productImagesFilesInput.value = '';
  if (productVariantsJsonInput) productVariantsJsonInput.value = '';
  if (productActiveInput) productActiveInput.checked = true;
}

function openProductCreateModal() {
  if (!state.categories.length) {
    alert('Primero crea al menos una categoría para poder añadir productos.');
    return;
  }
  resetProductModal();
  openModal('product');
}

function stringifyVariantsPretty(value) {
  const parsed = parseVariantsObject(value);
  if (!parsed) return '';

  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return '';
  }
}

function openProductEditModal(productId) {
  const row = state.products.find((product) => Number(product.id) === Number(productId));
  if (!row) return;

  if (productModalTitle) productModalTitle.textContent = 'Editar Producto';
  if (productIdInput) productIdInput.value = String(row.id);

  ensureCategorySelectOptions();
  if (productCategoryInput) {
    const currentCategory = getProductCategoryId(row);
    productCategoryInput.value = Number.isFinite(currentCategory) ? String(currentCategory) : String(state.categories[0]?.id || '');
  }

  if (productOriginInput) {
    const origin = String(row?.origen_catalogo || row?.origen || 'findixi').toLowerCase();
    productOriginInput.value = ['findixi', 'shopify', 'externo'].includes(origin) ? origin : 'findixi';
  }

  if (productNameInput) productNameInput.value = String(row?.nombre || '');
  if (productBuyUrlInput) {
    productBuyUrlInput.value = String(row?.enlace_compra || row?.url_compra || row?.buy_url || row?.product_url || '');
  }
  if (productDescriptionInput) productDescriptionInput.value = String(row?.descripcion || '');

  if (productPriceInput) {
    const price = parseNumber(row?.precio, null);
    productPriceInput.value = price === null ? '' : String(price);
  }
  if (productPriceTextInput) productPriceTextInput.value = String(row?.precio_texto || '');

  if (productOrderInput) productOrderInput.value = String(Number(row?.orden) || 1);

  if (productShopifyIdInput) {
    productShopifyIdInput.value = String(row?.shopify_product_id || row?.shopify_id || '');
  }
  if (productShopifyHandleInput) {
    productShopifyHandleInput.value = String(row?.shopify_handle || row?.handle || '');
  }
  if (productShopifyUpdatedAtInput) {
    productShopifyUpdatedAtInput.value = toDatetimeLocalValue(row?.shopify_updated_at || row?.updated_at);
  }

  if (productImagesTextInput) {
    const images = resolveProductImages(row);
    productImagesTextInput.value = images.join('\n');
  }

  if (productImagesFilesInput) productImagesFilesInput.value = '';

  if (productVariantsJsonInput) {
    productVariantsJsonInput.value = stringifyVariantsPretty(row?.variantes || row?.variants || row?.shopify_variantes || row?.shopify_variants);
  }

  if (productActiveInput) productActiveInput.checked = row?.activo !== false;

  openModal('product');
}

async function saveWithColumnFallback({ table, payload, mode, id = null }) {
  const data = { ...(payload || {}) };
  const dropped = [];

  for (let i = 0; i < 16; i += 1) {
    const query = mode === 'insert'
      ? supabase.from(table).insert(data).select().maybeSingle()
      : supabase.from(table).update(data).eq('id', id).select().maybeSingle();

    const result = await query;
    if (!result.error) {
      return {
        data: result.data || null,
        error: null,
        dropped,
      };
    }

    const missing = extractMissingColumnName(result.error);
    if (!missing || !Object.prototype.hasOwnProperty.call(data, missing)) {
      return {
        data: null,
        error: result.error,
        dropped,
      };
    }

    delete data[missing];
    dropped.push(missing);
  }

  return {
    data: null,
    error: new Error('No se pudo guardar por columnas incompatibles.'),
    dropped,
  };
}

async function uploadProductImages(files = [], productName = '') {
  const rows = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    if (!file) continue;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      throw new Error(`Formato no permitido: ${file.name}. Usa JPG, PNG o WEBP.`);
    }

    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`La imagen ${file.name} supera 8MB.`);
    }

    const ext = String(file.name.split('.').pop() || 'jpg').toLowerCase();
    const filename = `productos/${idComercio}/${toIsoNow()}-${slugify(productName || 'producto') || 'producto'}-${i + 1}.${ext}`;

    const upload = await supabase.storage
      .from(BUCKET)
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (upload.error) {
      throw upload.error;
    }

    rows.push(filename);
  }

  return rows;
}

function normalizeImageListFromTextarea(value) {
  return Array.from(new Set(
    String(value || '')
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter(Boolean)
  ));
}

function buildProductPayload() {
  const categoryId = Number.parseInt(productCategoryInput?.value || '', 10);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    throw new Error('Selecciona una categoría válida.');
  }

  const name = String(productNameInput?.value || '').trim();
  if (!name) {
    throw new Error('El nombre del producto es requerido.');
  }

  const rawVariants = String(productVariantsJsonInput?.value || '').trim();
  let variants = null;
  if (rawVariants) {
    try {
      variants = JSON.parse(rawVariants);
    } catch {
      throw new Error('El JSON de variantes no es válido.');
    }
  }

  const numericPrice = parseNumber(productPriceInput?.value, null);
  const priceText = String(productPriceTextInput?.value || '').trim();

  const payload = {
    nombre: name,
    descripcion: String(productDescriptionInput?.value || '').trim(),
    precio: numericPrice !== null ? numericPrice : 0,
    precio_texto: priceText || null,
    orden: Number.parseInt(productOrderInput?.value || '', 10) || 1,
    activo: !!productActiveInput?.checked,
    idMenu: categoryId,
    idmenu: categoryId,
    idComercio: idComercio,
    idcomercio: idComercio,
    origen_catalogo: String(productOriginInput?.value || 'findixi').toLowerCase(),
    enlace_compra: String(productBuyUrlInput?.value || '').trim() || null,
    shopify_product_id: String(productShopifyIdInput?.value || '').trim() || null,
    shopify_handle: String(productShopifyHandleInput?.value || '').trim() || null,
    shopify_updated_at: fromDatetimeLocalValue(productShopifyUpdatedAtInput?.value),
  };

  if (variants !== null) {
    payload.variantes = JSON.stringify(variants);
  } else {
    payload.variantes = null;
  }

  return payload;
}

async function handleSaveCategory() {
  const title = String(categoryTitleInput?.value || '').trim();
  if (!title) {
    alert('El título de la categoría es requerido.');
    return;
  }

  const order = Number.parseInt(categoryOrderInput?.value || '', 10) || 1;
  const payload = {
    titulo: title,
    descripcion: String(categoryDescriptionInput?.value || '').trim() || null,
    orden: order,
    activo: !!categoryActiveInput?.checked,
    idComercio: idComercio,
    idcomercio: idComercio,
  };

  const categoryId = Number.parseInt(categoryIdInput?.value || '', 10);
  const mode = Number.isFinite(categoryId) && categoryId > 0 ? 'update' : 'insert';

  const result = await saveWithColumnFallback({
    table: 'menus',
    payload,
    mode,
    id: mode === 'update' ? categoryId : null,
  });

  if (result.error) {
    console.error('Error guardando categoría:', result.error);
    alert('No se pudo guardar la categoría. Revisa la consola para más detalle.');
    return;
  }

  closeModal('category');
  await loadData();
  showTransientMessage(mode === 'update' ? 'Categoría actualizada.' : 'Categoría creada.');
}

async function categoryHasProducts(categoryId) {
  const id = Number(categoryId);
  if (!Number.isFinite(id)) return false;

  const byMenu = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq(state.columns.productMenuColumn || 'idMenu', id);

  if (!byMenu.error) return (byMenu.count || 0) > 0;

  if (!isMissingColumnError(byMenu.error)) {
    throw byMenu.error;
  }

  const fallbackColumn = (state.columns.productMenuColumn || 'idMenu') === 'idMenu' ? 'idmenu' : 'idMenu';
  const fallback = await supabase
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq(fallbackColumn, id);

  if (fallback.error) throw fallback.error;

  return (fallback.count || 0) > 0;
}

async function handleDeleteCategory(categoryId) {
  const row = state.categories.find((category) => Number(category.id) === Number(categoryId));
  if (!row) return;

  const hasProducts = await categoryHasProducts(categoryId);
  if (hasProducts) {
    alert('No puedes eliminar esta categoría porque tiene productos asociados.');
    return;
  }

  const ok = window.confirm(`¿Eliminar la categoría "${row.titulo || 'Categoría'}"?`);
  if (!ok) return;

  const del = await supabase.from('menus').delete().eq('id', row.id);
  if (del.error) {
    console.error('Error eliminando categoría:', del.error);
    alert('No se pudo eliminar la categoría.');
    return;
  }

  await loadData();
  showTransientMessage('Categoría eliminada.');
}

async function handleSaveProduct() {
  let payload;
  try {
    payload = buildProductPayload();
  } catch (error) {
    alert(error?.message || 'Formulario de producto inválido.');
    return;
  }

  const productId = Number.parseInt(productIdInput?.value || '', 10);
  const mode = Number.isFinite(productId) && productId > 0 ? 'update' : 'insert';

  let save = await saveWithColumnFallback({
    table: 'productos',
    payload,
    mode,
    id: mode === 'update' ? productId : null,
  });

  if (save.error) {
    const text = `${save.error?.message || ''} ${save.error?.details || ''}`.toLowerCase();
    if (text.includes('idmenu')) {
      const retryPayload = { ...payload };
      delete retryPayload.idMenu;
      retryPayload.idmenu = Number(payload.idmenu);
      save = await saveWithColumnFallback({
        table: 'productos',
        payload: retryPayload,
        mode,
        id: mode === 'update' ? productId : null,
      });
    }
  }

  if (save.error) {
    console.error('Error guardando producto:', save.error);
    alert('No se pudo guardar el producto. Revisa la consola para más detalle.');
    return;
  }

  const savedId = Number(save.data?.id || productId);
  const existingImages = normalizeImageListFromTextarea(productImagesTextInput?.value || '');

  let uploaded = [];
  const files = Array.from(productImagesFilesInput?.files || []);

  if (files.length) {
    try {
      uploaded = await uploadProductImages(files, payload.nombre);
    } catch (error) {
      console.error('Error subiendo imágenes:', error);
      alert(error?.message || 'No se pudieron subir las imágenes del producto.');
      return;
    }
  }

  const mergedImages = Array.from(new Set([...existingImages, ...uploaded]));
  if (mergedImages.length) {
    const patch = {
      imagenes: JSON.stringify(mergedImages),
      imagen: mergedImages[0] || null,
    };

    const patchRes = await saveWithColumnFallback({
      table: 'productos',
      payload: patch,
      mode: 'update',
      id: savedId,
    });

    if (patchRes.error) {
      console.error('Error guardando imágenes del producto:', patchRes.error);
      alert('El producto se guardó, pero no se pudo guardar la galería de imágenes.');
    }
  }

  closeModal('product');
  await loadData();
  showTransientMessage(mode === 'update' ? 'Producto actualizado.' : 'Producto creado.');
}

async function removeProductStorageImages(product = {}) {
  const images = resolveProductImages(product);
  if (!images.length) return;

  const paths = Array.from(new Set(images.map(toStoragePath).filter(Boolean)));
  if (!paths.length) return;

  const result = await supabase.storage.from(BUCKET).remove(paths);
  if (result.error) {
    console.warn('No se pudieron eliminar algunas imágenes del storage:', result.error);
  }
}

async function handleDeleteProduct(productId) {
  const row = state.products.find((product) => Number(product.id) === Number(productId));
  if (!row) return;

  const ok = window.confirm(`¿Eliminar el producto "${row.nombre || 'Producto'}"?`);
  if (!ok) return;

  const del = await supabase.from('productos').delete().eq('id', row.id);
  if (del.error) {
    console.error('Error eliminando producto:', del.error);
    alert('No se pudo eliminar el producto.');
    return;
  }

  await removeProductStorageImages(row);
  await loadData();
  showTransientMessage('Producto eliminado.');
}

function bindCategoryActions() {
  categoriesList?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute('data-action');
    const id = Number.parseInt(target.getAttribute('data-id') || '', 10);
    if (!action || !Number.isFinite(id)) return;

    if (action === 'edit-category') {
      openCategoryEditModal(id);
      return;
    }

    if (action === 'delete-category') {
      try {
        await handleDeleteCategory(id);
      } catch (error) {
        console.error('Error eliminando categoría:', error);
        alert('No se pudo eliminar la categoría.');
      }
    }
  });
}

function bindProductActions() {
  productsAccordion?.addEventListener('click', async (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof HTMLElement)) return;

    const actionEl = rawTarget.closest('[data-action]');
    if (!(actionEl instanceof HTMLElement)) return;

    const action = actionEl.getAttribute('data-action');
    if (!action) return;

    if (action === 'toggle-group') {
      const key = String(actionEl.getAttribute('data-group-key') || '').trim();
      if (!key) return;
      state.ui.expandedGroupKey = state.ui.expandedGroupKey === key ? null : key;
      renderProducts();
      return;
    }

    if (action === 'load-more') {
      const key = String(actionEl.getAttribute('data-group-key') || '').trim();
      if (!key) return;
      const current = Number(state.ui.productVisibleByGroup[key]) || DEFAULT_PRODUCTS_VISIBLE;
      state.ui.productVisibleByGroup[key] = current + LOAD_MORE_STEP;
      state.ui.expandedGroupKey = key;
      renderProducts();
      return;
    }

    const id = Number.parseInt(String(actionEl.getAttribute('data-id') || ''), 10);
    if (!Number.isFinite(id)) return;

    if (action === 'edit-product') {
      openProductEditModal(id);
      return;
    }

    if (action === 'delete-product') {
      try {
        await handleDeleteProduct(id);
      } catch (error) {
        console.error('Error eliminando producto:', error);
        alert('No se pudo eliminar el producto.');
      }
    }
  });
}

function bindFilterControls() {
  productFilterSearch?.addEventListener('input', () => {
    state.ui.search = productFilterSearch.value || '';
    renderProducts();
  });
}

function bindTopActions() {
  btnNewCategory?.addEventListener('click', openCategoryCreateModal);
  btnNewProduct?.addEventListener('click', openProductCreateModal);
  btnSyncProducts?.addEventListener('click', () => {
    void handleSyncProducts();
  });

  btnSaveCategory?.addEventListener('click', () => {
    void handleSaveCategory();
  });

  btnSaveProduct?.addEventListener('click', () => {
    void handleSaveProduct();
  });
}

async function loadData() {
  await fetchComercio();
  await fetchStoreProfileFromCategories();
  await fetchStoreVisualTheme();

  await fetchCategories();
  const menuIds = state.categories.map((category) => Number(category.id)).filter((id) => Number.isFinite(id) && id > 0);

  let products = [];
  if (menuIds.length) {
    products = await fetchProductsByCategories(menuIds);
  }

  if (!products.length) {
    const direct = await fetchProductsByCommerceFallback();
    products = mergeProducts(products, direct);
  }

  state.products = sortProducts(products);
  renderHeader();
  renderStoreVisualPreviews();
  if (!storeVisualStatus?.textContent) {
    setStoreVisualStatus('Cambia banner/fondo y guarda para reflejarlo en tiendaComercio.', 'neutral');
  }
  renderCategories();
  renderProducts();
}

async function init() {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    alert('ID de comercio inválido.');
    window.location.assign('./adminComercios.html');
    return;
  }

  buildLinks();
  bindModalClosers();
  bindStoreVisualActions();
  bindTopActions();
  bindCategoryActions();
  bindProductActions();
  bindFilterControls();

  try {
    await loadData();
  } catch (error) {
    console.error('Error inicializando editarTienda:', error);
    showBanner('No se pudo cargar editarTienda. Revisa consola y esquema de tablas.', 'error');
  }
}

init();
