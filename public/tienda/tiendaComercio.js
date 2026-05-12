import { supabase } from '../shared/supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const idComercio = Number(params.get('idComercio') || params.get('id'));
const navSource = String(params.get('source') || '').trim().toLowerCase();
const requestedProductId = String(params.get('producto') || '').trim();
const returnToParam = String(params.get('returnTo') || '').trim();

const heroBannerImg = document.getElementById('heroBannerImg');
const heroOverlay = document.getElementById('heroOverlay');
const tiendaFixedBackground = document.getElementById('tiendaFixedBackground');
const tiendaFixedBackgroundOverlay = document.getElementById('tiendaFixedBackgroundOverlay');
const btnVolverPerfil = document.getElementById('btnVolverPerfil');
const estadoTienda = document.getElementById('estadoTienda');
const storeGreetingWrap = document.getElementById('storeGreetingWrap');
const storeGreetingText = document.getElementById('storeGreetingText');
const categoriaSection = document.getElementById('categoriaSection');
const categoriaButtons = document.getElementById('categoriaButtons');
const toggleHideSoldOut = document.getElementById('toggleHideSoldOut');
const productosSection = document.getElementById('productosSection');
const productosGrid = document.getElementById('productosGrid');

const modalProducto = document.getElementById('modalProducto');
const modalProductoBackdrop = document.getElementById('modalProductoBackdrop');
const modalProductoPanel = document.getElementById('modalProductoPanel');
const modalCerrar = document.getElementById('modalCerrar');
const modalImagenLink = document.getElementById('modalImagenLink');
const modalImagenPrincipal = document.getElementById('modalImagenPrincipal');
const modalPrevImagen = document.getElementById('modalPrevImagen');
const modalNextImagen = document.getElementById('modalNextImagen');
const modalThumbs = document.getElementById('modalThumbs');
const modalNombre = document.getElementById('modalNombre');
const modalPrecio = document.getElementById('modalPrecio');
const modalDescripcion = document.getElementById('modalDescripcion');
const modalOpcionesSection = document.getElementById('modalOpcionesSection');
const modalOpciones = document.getElementById('modalOpciones');
const modalTallasSection = document.getElementById('modalTallasSection');
const modalTallas = document.getElementById('modalTallas');
const modalVariantesSection = document.getElementById('modalVariantesSection');
const modalVariantes = document.getElementById('modalVariantes');
const modalComprarBtn = document.getElementById('modalComprarBtn');
const modalImagenExpandida = document.getElementById('modalImagenExpandida');
const modalImagenExpandidaBackdrop = document.getElementById('modalImagenExpandidaBackdrop');
const modalImagenExpandidaWrap = document.getElementById('modalImagenExpandidaWrap');
const modalImagenExpandidaCerrar = document.getElementById('modalImagenExpandidaCerrar');
const modalImagenExpandidaSrc = document.getElementById('modalImagenExpandidaSrc');

const DEFAULT_THEME = {
  colorboton: '#fb8500',
  colorbotontexto: '#ffffff',
  colorboton_idle_bg: '#ffffff',
  colorboton_idle_text: '#374151',
  colorprecio: '#111827',
  colortitulo: '#111827',
  colortexto: '#374151',
  backgroundcolor: '#f8fafc',
  item_bg_color: '#ffffff',
  overlayoscuro: 20,
  portadaimagen: '',
  backgroundimagen: '',
  productoAlign: 'left',
  boton_stroke_width: 1,
  boton_stroke_color: '#fb8500',
  boton_round: true,
  fontbuttonfamily: 'Kanit',
  fontbuttonurl: 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  colorsaludo: '#374151',
  fontsaludofamily: 'Kanit',
  fontsaludourl: 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  fontsaludo_size: 14,
  fonttitlefamily: 'Kanit',
  fonttitleurl: 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  fonttitle_size: 16,
  fontpricefamily: 'Kanit',
  fontpriceurl: 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  fontprice_size: 16,
  fontdescfamily: 'Kanit',
  fontdescurl: 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  fontdesc_size: 14,
  fontbodyfamily: 'Kanit',
  fontbodyurl: 'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700&display=swap',
  fontbody_size: 14,
  saludo_tienda: '',
};
const CARD_DOT_COUNT = 3;

function ensureFontLink(id, url) {
  const href = String(url || '').trim();
  if (!href || !/^https?:\/\//i.test(href)) return;
  const existing = document.getElementById(id);
  if (existing) {
    if (existing.getAttribute('href') !== href) existing.setAttribute('href', href);
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function resolveThemeFontFamily(value, fallback = "'Kanit', sans-serif") {
  const name = String(value || '').trim();
  if (!name) return fallback;
  return `'${name.replace(/'/g, "\\'")}', 'Kanit', sans-serif`;
}

const state = {
  comercio: null,
  storeMode: { tiendaFisica: true, tiendaOnline: false },
  theme: { ...DEFAULT_THEME },
  categories: [],
  products: [],
  selectedCategory: 'all',
  hideSoldOut: false,
  modalProductId: null,
  modalImageIndex: 0,
};

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

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function normalizeExternalUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function resolveSafeInternalReturnPath(rawValue = '') {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('/')) return '';
  if (/^\/\//.test(raw)) return '';
  if (/[\r\n]/.test(raw)) return '';
  return raw;
}

function parseMoney(value) {
  const num = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function parseBoolean(value, fallback = null) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['true', '1', 'si', 'sí', 'yes', 'on', 'agotado'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeOptionName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isDefaultOptionText(value) {
  const normalized = normalizeOptionName(value).replace(/\s+/g, ' ').trim();
  return normalized === 'default title'
    || normalized === 'titulo por defecto'
    || normalized === 'titulo predeterminado'
    || normalized === 'default'
    || normalized === 'title';
}

function isTitleLikeOptionName(value) {
  const normalized = normalizeOptionName(value);
  return normalized === 'title' || normalized === 'titulo';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseFontSizePx(value, fallback = 14) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(10, Math.min(40, n));
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  try {
    return new Intl.NumberFormat('es-PR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

function encodeStoragePath(path) {
  const clean = String(path || '')
    .trim()
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/galeriacomercios\//i, '')
    .replace(/^\/+/, '')
    .replace(/^public\//i, '')
    .replace(/^galeriacomercios\//i, '');

  return clean
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function toStorageUrl(path) {
  if (!path) return '';
  const raw = String(path).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const encoded = encodeStoragePath(raw);
  const pub = supabase.storage.from('galeriacomercios').getPublicUrl(encoded).data?.publicUrl || '';
  return pub || raw;
}

function parseImageSource(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap(parseImageSource);
  }

  if (typeof value === 'object') {
    const src = value.src || value.url || value.publicUrl || value.path || value.imagen;
    return src ? [toStorageUrl(src)] : [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    const asJson = parseJsonMaybe(trimmed, null);
    if (asJson) return parseImageSource(asJson);

    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((part) => toStorageUrl(part.trim()))
        .filter(Boolean);
    }

    return [toStorageUrl(trimmed)];
  }

  return [];
}

function resolveProductImages(product) {
  const candidates = [
    product?.imagenes,
    product?.images,
    product?.galeria,
    product?.shopify_images,
    product?.featured_image,
    product?.imagen,
    product?.image,
  ];

  const all = candidates.flatMap(parseImageSource).filter(Boolean);
  return Array.from(new Set(all));
}

function normalizeVariantOptionList(optionsRaw = []) {
  const options = Array.isArray(optionsRaw) ? optionsRaw : [];
  return options
    .map((option, index) => {
      if (typeof option === 'string') {
        return { name: `Opción ${index + 1}`, values: [option] };
      }
      const name = String(option?.name || option?.nombre || `Opción ${index + 1}`).trim();
      const valuesRaw = option?.values || option?.valores || [];
      const values = (Array.isArray(valuesRaw) ? valuesRaw : [valuesRaw])
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      return { name, values: Array.from(new Set(values)) };
    })
    .filter((option) => option.name);
}

function normalizeVariants(product) {
  const variantsRaw =
    parseJsonMaybe(product?.variantes, null)
    || parseJsonMaybe(product?.variants, null)
    || parseJsonMaybe(product?.shopify_variantes, null)
    || parseJsonMaybe(product?.shopify_variants, null)
    || null;

  let options = [];
  let variants = [];

  if (Array.isArray(variantsRaw)) {
    variants = variantsRaw;
  } else if (variantsRaw && typeof variantsRaw === 'object') {
    options = normalizeVariantOptionList(variantsRaw.options || variantsRaw.opciones || []);
    variants = Array.isArray(variantsRaw.variants) ? variantsRaw.variants : [];
  }

  const variantItems = variants
    .map((variant, index) => {
      const optionPairs = [];

      const selectedOptions = variant?.selectedOptions || variant?.selected_options || [];
      if (Array.isArray(selectedOptions) && selectedOptions.length) {
        selectedOptions.forEach((entry) => {
          const name = String(entry?.name || entry?.nombre || '').trim();
          const value = String(entry?.value || entry?.valor || '').trim();
          if (name && value) optionPairs.push({ name, value });
        });
      }

      const rawOptionList = Array.isArray(variant?.options) ? variant.options : [];
      if (!optionPairs.length && rawOptionList.length) {
        rawOptionList.forEach((value, i) => {
          const optionName = options[i]?.name || `Opción ${i + 1}`;
          const optionValue = String(value || '').trim();
          if (optionValue) optionPairs.push({ name: optionName, value: optionValue });
        });
      }

      ['option1', 'option2', 'option3'].forEach((key, idx) => {
        if (optionPairs.length >= idx + 1) return;
        const optionValue = String(variant?.[key] || '').trim();
        if (!optionValue) return;
        const optionName = options[idx]?.name || `Opción ${idx + 1}`;
        optionPairs.push({ name: optionName, value: optionValue });
      });

      const title = String(
        variant?.title
        || variant?.titulo
        || optionPairs.map((pair) => pair.value).filter(Boolean).join(' / ')
        || `Variante ${index + 1}`
      ).trim();

      const price =
        parseMoney(variant?.price)
        ?? parseMoney(variant?.precio)
        ?? parseMoney(variant?.price_amount)
        ?? null;

      const compareAtPrice =
        parseMoney(variant?.compare_at_price)
        ?? parseMoney(variant?.compareAtPrice)
        ?? parseMoney(variant?.precio_regular)
        ?? null;

      const availableRaw =
        variant?.available
        ?? variant?.availableForSale
        ?? variant?.activo
        ?? variant?.is_available;
      const available = typeof availableRaw === 'boolean'
        ? availableRaw
        : Number(variant?.inventory_quantity ?? variant?.inventario ?? 1) > 0;

      return {
        id: String(variant?.id || variant?.variant_id || `${product?.id || 'p'}-v-${index + 1}`),
        title,
        price,
        compareAtPrice,
        available,
        options: optionPairs,
      };
    })
    .filter((variant) => variant.title);

  if (!options.length && variantItems.length) {
    const optionMap = new Map();
    variantItems.forEach((variant) => {
      variant.options.forEach((pair) => {
        const key = pair.name;
        if (!optionMap.has(key)) optionMap.set(key, new Set());
        optionMap.get(key).add(pair.value);
      });
    });

    options = Array.from(optionMap.entries()).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  }

  return {
    options,
    variants: variantItems,
  };
}

function resolveProductCategoryInfo(product, menuMap) {
  const menuId = Number(product?.idMenu ?? product?.idmenu ?? product?.id_menu);
  if (Number.isFinite(menuId) && menuMap.has(menuId)) {
    const menu = menuMap.get(menuId);
    return {
      categoryId: `menu:${menuId}`,
      categoryName: menu?.titulo || 'General',
      categoryOrder: Number(menu?.orden) || 0,
    };
  }

  const rawName = String(
    product?.categoria
    || product?.category
    || product?.coleccion
    || product?.collection_title
    || product?.collection
    || ''
  ).trim();

  if (rawName) {
    return {
      categoryId: `raw:${slugify(rawName) || 'general'}`,
      categoryName: rawName,
      categoryOrder: 999,
    };
  }

  return {
    categoryId: 'uncategorized',
    categoryName: 'General',
    categoryOrder: 1000,
  };
}

function isShopifyProduct(product) {
  const source = String(
    product?.origen_catalogo
    || product?.origen
    || product?.source
    || product?.fuente
    || ''
  ).toLowerCase();

  const hasShopifyId = !!(product?.shopify_product_id || product?.shopify_id || product?.shopifyProductId);
  const buyCandidate = String(product?.enlace_compra || product?.url_compra || product?.buy_url || product?.product_url || '').toLowerCase();
  const looksShopifyUrl = /myshopify\.com|\/products\//.test(buyCandidate);

  return source.includes('shopify') || hasShopifyId || looksShopifyUrl;
}

function resolveBuyUrl(product) {
  const raw =
    product?.enlace_compra
    || product?.url_compra
    || product?.buy_url
    || product?.product_url
    || product?.url
    || '';
  return normalizeExternalUrl(raw);
}

function resolveProductPriceLabel(product, variantBundle) {
  const precioTexto = String(product?.precio_texto || '').trim();
  if (precioTexto) return precioTexto;

  const price = parseMoney(product?.precio);
  if (price !== null) return formatMoney(price);

  const variantPrices = (variantBundle?.variants || [])
    .map((variant) => variant.price)
    .filter((value) => Number.isFinite(value));

  if (variantPrices.length) {
    const min = Math.min(...variantPrices);
    const max = Math.max(...variantPrices);
    if (min === max) return formatMoney(min);
    return `${formatMoney(min)} - ${formatMoney(max)}`;
  }

  return 'Por confirmar';
}

function resolveProductAvailability(product, variantBundle, isShopify) {
  const raw = product || {};
  const variants = Array.isArray(variantBundle?.variants) ? variantBundle.variants : [];
  const variantAvailableCount = variants.filter((variant) => variant?.available).length;
  const variantsSoldOut = variants.length > 0 && variantAvailableCount === 0;

  const explicitSoldOut = [
    raw?.agotado,
    raw?.is_sold_out,
    raw?.sold_out,
    raw?.no_disponible,
    raw?.out_of_stock,
  ].some((value) => parseBoolean(value, false) === true);

  const explicitAvailable = [
    raw?.available,
    raw?.availableForSale,
    raw?.disponible,
    raw?.en_stock,
    raw?.in_stock,
    raw?.activo,
  ]
    .map((value) => parseBoolean(value, null))
    .find((value) => typeof value === 'boolean');

  const stockValue = [
    raw?.stock,
    raw?.inventario,
    raw?.inventory,
    raw?.inventory_quantity,
    raw?.quantity_available,
    raw?.cantidad,
  ]
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value));

  const soldOutByStock = Number.isFinite(stockValue) ? stockValue <= 0 : false;
  const soldOutByAvailable = explicitAvailable === false;
  const soldOut = explicitSoldOut || soldOutByAvailable || soldOutByStock || variantsSoldOut;

  const activeFlag = parseBoolean(raw?.activo, null);
  const hiddenInactive = activeFlag === false && !isShopify && !soldOut;

  return {
    soldOut,
    isVisible: !hiddenInactive,
  };
}

function toTimestamp(value) {
  if (!value) return 0;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function normalizeProduct(product, menuMap, fallbackOrigin = 'findixi') {
  const categoryInfo = resolveProductCategoryInfo(product, menuMap);
  const variants = normalizeVariants(product);
  const images = resolveProductImages(product);
  const buyUrl = resolveBuyUrl(product);
  const shopify = isShopifyProduct(product);
  const availability = resolveProductAvailability(product, variants, shopify);

  const name = String(product?.nombre || product?.title || product?.product_title || 'Producto sin nombre').trim();
  const description = String(
    product?.descripcion
    || product?.description
    || product?.body_html
    || product?.body
    || ''
  ).trim();

  const createdAt = toTimestamp(product?.shopify_updated_at || product?.created_at || product?.updated_at);

  return {
    id: String(product?.id || product?.shopify_product_id || `${name}-${Math.random().toString(16).slice(2)}`),
    name,
    description: stripHtml(description),
    images,
    variants,
    priceLabel: resolveProductPriceLabel(product, variants),
    buyUrl,
    isShopify: shopify,
    source: String(product?.origen_catalogo || product?.origen || fallbackOrigin || 'findixi').toLowerCase(),
    createdAt,
    order: Number(product?.orden) || 0,
    categoryId: categoryInfo.categoryId,
    categoryName: categoryInfo.categoryName,
    categoryOrder: categoryInfo.categoryOrder,
    soldOut: availability.soldOut,
    isVisible: availability.isVisible,
    raw: product,
  };
}

function sortProducts(list = []) {
  return [...list].sort((a, b) => {
    if (a.isShopify !== b.isShopify) return a.isShopify ? -1 : 1;
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });
}

function applyTheme() {
  const t = state.theme;
  const roundedButtons = parseBoolean(t.boton_round, true) !== false;
  document.documentElement.style.setProperty('--tienda-color-btn', t.colorboton || DEFAULT_THEME.colorboton);
  document.documentElement.style.setProperty('--tienda-color-btn-text', t.colorbotontexto || DEFAULT_THEME.colorbotontexto);
  document.documentElement.style.setProperty('--tienda-color-btn-idle-bg', t.colorboton_idle_bg || DEFAULT_THEME.colorboton_idle_bg);
  document.documentElement.style.setProperty('--tienda-color-btn-idle-text', t.colorboton_idle_text || DEFAULT_THEME.colorboton_idle_text);
  document.documentElement.style.setProperty('--tienda-cat-border-width', `${Math.max(0, Number(t.boton_stroke_width ?? DEFAULT_THEME.boton_stroke_width) || 0)}px`);
  document.documentElement.style.setProperty('--tienda-cat-border-color', t.boton_stroke_color || DEFAULT_THEME.boton_stroke_color);
  document.documentElement.style.setProperty('--tienda-cat-border-radius', roundedButtons ? '9999px' : '10px');
  document.documentElement.style.setProperty('--tienda-color-price', t.colorprecio || DEFAULT_THEME.colorprecio);
  document.documentElement.style.setProperty('--tienda-color-title', t.colortitulo || DEFAULT_THEME.colortitulo);
  document.documentElement.style.setProperty('--tienda-color-text', t.colortexto || DEFAULT_THEME.colortexto);
  document.documentElement.style.setProperty('--tienda-background', t.backgroundcolor || DEFAULT_THEME.backgroundcolor);
  document.documentElement.style.setProperty('--tienda-item-bg', t.item_bg_color || DEFAULT_THEME.item_bg_color);
  document.documentElement.style.setProperty('--tienda-font-button', resolveThemeFontFamily(t.fontbuttonfamily || t.fontdescfamily || t.fontbodyfamily, "'Kanit', sans-serif"));
  document.documentElement.style.setProperty('--tienda-font-title', resolveThemeFontFamily(t.fonttitlefamily, "'Kanit', sans-serif"));
  document.documentElement.style.setProperty('--tienda-font-price', resolveThemeFontFamily(t.fontpricefamily || t.fontbodyfamily, "'Kanit', sans-serif"));
  document.documentElement.style.setProperty('--tienda-font-desc', resolveThemeFontFamily(t.fontdescfamily || t.fontbodyfamily, "'Kanit', sans-serif"));
  document.documentElement.style.setProperty('--tienda-font-title-size', `${parseFontSizePx(t.fonttitle_size, 16)}px`);
  document.documentElement.style.setProperty('--tienda-font-price-size', `${parseFontSizePx(t.fontprice_size, 16)}px`);
  document.documentElement.style.setProperty('--tienda-font-desc-size', `${parseFontSizePx(t.fontdesc_size ?? t.fontbody_size, 14)}px`);
  document.documentElement.style.setProperty('--tienda-text-align', String(t.productoAlign || DEFAULT_THEME.productoAlign).toLowerCase() === 'center' ? 'center' : 'left');

  ensureFontLink('tienda-theme-font-button', t.fontbuttonurl || t.fontdescurl || t.fontbodyurl || DEFAULT_THEME.fontbuttonurl);
  ensureFontLink('tienda-theme-font-greeting', t.fontsaludourl || t.fontdescurl || t.fontbodyurl || DEFAULT_THEME.fontsaludourl);
  ensureFontLink('tienda-theme-font-title', t.fonttitleurl || DEFAULT_THEME.fonttitleurl);
  ensureFontLink('tienda-theme-font-price', t.fontpriceurl || t.fontbodyurl || DEFAULT_THEME.fontpriceurl);
  ensureFontLink('tienda-theme-font-desc', t.fontdescurl || t.fontbodyurl || DEFAULT_THEME.fontdescurl);

  if (storeGreetingText && storeGreetingWrap) {
    const greeting = String(t.saludo_tienda || '').trim();
    storeGreetingText.textContent = greeting;
    storeGreetingWrap.classList.toggle('hidden', !greeting);
    if (greeting) {
      storeGreetingText.style.fontFamily = resolveThemeFontFamily(t.fontsaludofamily || t.fontdescfamily || t.fontbodyfamily, "'Kanit', sans-serif");
      storeGreetingText.style.fontSize = `${parseFontSizePx(t.fontsaludo_size ?? t.fontdesc_size ?? t.fontbody_size, 14)}px`;
      storeGreetingText.style.color = t.colorsaludo || t.colortexto || DEFAULT_THEME.colorsaludo;
      storeGreetingText.style.textAlign = String(t.productoAlign || DEFAULT_THEME.productoAlign).toLowerCase() === 'center' ? 'center' : 'left';
    }
  }

  const heroSrc = toStorageUrl(t.portadaimagen || state.comercio?.portada || state.comercio?.logo || '');
  if (heroBannerImg) {
    heroBannerImg.src = heroSrc;
    heroBannerImg.classList.toggle('hidden', !heroSrc);
  }
  if (heroOverlay) {
    heroOverlay.style.backgroundColor = 'transparent';
    heroOverlay.classList.add('hidden');
  }

  const backgroundUrl = toStorageUrl(t.backgroundimagen || '');
  document.body.style.backgroundColor = t.backgroundcolor || DEFAULT_THEME.backgroundcolor;

  if (backgroundUrl) {
    if (tiendaFixedBackground) {
      tiendaFixedBackground.style.backgroundImage = `url(${backgroundUrl})`;
      tiendaFixedBackground.style.backgroundPosition = 'center center';
      tiendaFixedBackground.style.backgroundSize = 'contain';
      tiendaFixedBackground.style.backgroundRepeat = 'no-repeat';
      tiendaFixedBackground.classList.remove('hidden');
    }
    if (tiendaFixedBackgroundOverlay) {
      tiendaFixedBackgroundOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.40)';
      tiendaFixedBackgroundOverlay.classList.remove('hidden');
    }
    document.body.style.backgroundImage = '';
  } else {
    if (tiendaFixedBackground) {
      tiendaFixedBackground.style.backgroundImage = '';
      tiendaFixedBackground.classList.add('hidden');
    }
    if (tiendaFixedBackgroundOverlay) {
      tiendaFixedBackgroundOverlay.classList.add('hidden');
    }
    document.body.style.backgroundImage = '';
  }

  if (modalNombre) {
    modalNombre.style.fontFamily = resolveThemeFontFamily(t.fonttitlefamily, "'Kanit', sans-serif");
    modalNombre.style.fontSize = `${parseFontSizePx(t.fonttitle_size, 16)}px`;
    modalNombre.style.color = t.colortitulo || DEFAULT_THEME.colortitulo;
    modalNombre.style.textAlign = String(t.productoAlign || DEFAULT_THEME.productoAlign).toLowerCase() === 'center' ? 'center' : 'left';
  }
  if (modalPrecio) {
    modalPrecio.style.fontFamily = resolveThemeFontFamily(t.fontpricefamily || t.fontbodyfamily, "'Kanit', sans-serif");
    modalPrecio.style.fontSize = `${parseFontSizePx(t.fontprice_size, 16)}px`;
    modalPrecio.style.color = t.colorprecio || DEFAULT_THEME.colorprecio;
    modalPrecio.style.textAlign = String(t.productoAlign || DEFAULT_THEME.productoAlign).toLowerCase() === 'center' ? 'center' : 'left';
  }
  if (modalDescripcion) {
    modalDescripcion.style.fontFamily = resolveThemeFontFamily(t.fontdescfamily || t.fontbodyfamily, "'Kanit', sans-serif");
    modalDescripcion.style.fontSize = `${parseFontSizePx(t.fontdesc_size ?? t.fontbody_size, 14)}px`;
    modalDescripcion.style.color = t.colortexto || DEFAULT_THEME.colortexto;
    modalDescripcion.style.textAlign = String(t.productoAlign || DEFAULT_THEME.productoAlign).toLowerCase() === 'center' ? 'center' : 'left';
  }
}

function setStatus(message, tone = 'neutral') {
  if (!estadoTienda) return;
  const text = String(message || '').trim();
  estadoTienda.textContent = text;
  estadoTienda.className = 'text-sm px-1';
  estadoTienda.classList.toggle('hidden', !text);

  if (!text) return;

  if (tone === 'error') {
    estadoTienda.classList.add('text-red-600');
    return;
  }

  if (tone === 'warning') {
    estadoTienda.classList.add('text-amber-600');
    return;
  }

  estadoTienda.classList.add('text-gray-500');
}

async function fetchComercio() {
  const baseSelect = 'id,nombre,logo,portada,webpage,colorPrimario,colorSecundario,municipio';
  let lookup = await supabase
    .from('Comercios')
    .select(`${baseSelect},tiendaFisica,tiendaOnline`)
    .eq('id', idComercio)
    .maybeSingle();

  if (isMissingStoreColumnsError(lookup.error)) {
    lookup = await supabase
      .from('Comercios')
      .select(baseSelect)
      .eq('id', idComercio)
      .maybeSingle();
  }

  if (lookup.error || !lookup.data) {
    throw lookup.error || new Error('No se encontró el comercio.');
  }

  state.comercio = lookup.data;
  state.storeMode = resolveStoreMode(lookup.data);
}

async function fetchTheme() {
  const idColumns = ['idcomercio', 'idComercio'];
  let loadedTheme = null;
  let lastError = null;

  for (const idColumn of idColumns) {
    const lookup = await supabase
      .from('menu_tema')
      .select('*')
      .eq(idColumn, idComercio)
      .maybeSingle();

    if (!lookup.error) {
      loadedTheme = lookup.data || null;
      break;
    }

    lastError = lookup.error;
    const errText = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
    if (!errText.includes('column') && !errText.includes('does not exist')) {
      break;
    }
  }

  if (lastError && !loadedTheme) {
    console.warn('No se pudo cargar tema de tienda, usando default:', lastError?.message || lastError);
  }

  state.theme = { ...DEFAULT_THEME, ...(loadedTheme || {}) };
}

async function fetchCategoriesFromMenus() {
  const idColumns = ['idComercio', 'idcomercio'];
  for (const idColumn of idColumns) {
    const lookup = await supabase
      .from('menus')
      .select('id,titulo,descripcion,orden,activo')
      .eq(idColumn, idComercio)
      .eq('activo', true)
      .order('orden', { ascending: true })
      .order('id', { ascending: true });

    if (!lookup.error) return Array.isArray(lookup.data) ? lookup.data : [];

    const errText = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
    if (!errText.includes('column') && !errText.includes('does not exist')) {
      console.warn('No se pudieron cargar categorías (menus):', lookup.error?.message || lookup.error);
      return [];
    }
  }

  return [];
}

async function fetchProductsByMenuIds(menuIds = []) {
  const ids = (menuIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return [];

  let query = await supabase
    .from('productos')
    .select('*')
    .in('idMenu', ids);

  if (!query.error) return Array.isArray(query.data) ? query.data : [];

  const errorText = String(query.error?.message || query.error?.details || '').toLowerCase();
  if (!errorText.includes('idmenu')) {
    console.warn('No se pudieron cargar productos por menu:', query.error);
    return [];
  }

  query = await supabase
    .from('productos')
    .select('*')
    .in('idmenu', ids);

  if (query.error) {
    console.warn('No se pudieron cargar productos por idmenu fallback:', query.error);
    return [];
  }

  return Array.isArray(query.data) ? query.data : [];
}

async function fetchProductsDirectByCommerce() {
  let lookup = await supabase
    .from('productos')
    .select('*')
    .eq('idComercio', idComercio);

  if (!lookup.error) return Array.isArray(lookup.data) ? lookup.data : [];

  const errTxt = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
  if (!errTxt.includes('idcomercio')) {
    return [];
  }

  lookup = await supabase
    .from('productos')
    .select('*')
    .eq('idcomercio', idComercio);

  if (lookup.error) return [];
  return Array.isArray(lookup.data) ? lookup.data : [];
}

async function fetchShopifyProductsFallback() {
  let lookup = await supabase
    .from('shopify_productos')
    .select('*')
    .eq('idComercio', idComercio);

  if (!lookup.error) return Array.isArray(lookup.data) ? lookup.data : [];

  const msg = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
  if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('shopify_productos')) {
    return [];
  }

  const fallbackMsg = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
  if (!fallbackMsg.includes('idcomercio')) {
    console.warn('Error cargando shopify_productos:', lookup.error);
    return [];
  }

  lookup = await supabase
    .from('shopify_productos')
    .select('*')
    .eq('idcomercio', idComercio);

  if (lookup.error) return [];
  return Array.isArray(lookup.data) ? lookup.data : [];
}

function buildCategories(products = [], menus = []) {
  const productCountByCategory = new Map();
  (products || []).forEach((product) => {
    const key = String(product?.categoryId || '').trim();
    if (!key) return;
    productCountByCategory.set(key, (productCountByCategory.get(key) || 0) + 1);
  });

  const menuCategories = (menus || [])
    .map((menu) => ({
      id: `menu:${menu.id}`,
      name: String(menu.titulo || 'General').trim() || 'General',
      order: Number(menu.orden) || 0,
    }))
    .filter((category) => (productCountByCategory.get(category.id) || 0) > 0);

  const categoryMap = new Map(menuCategories.map((category) => [category.id, category]));

  products.forEach((product) => {
    if (!product?.categoryId || !product?.categoryName) return;
    if (!categoryMap.has(product.categoryId)) {
      categoryMap.set(product.categoryId, {
        id: product.categoryId,
        name: product.categoryName,
        order: Number(product.categoryOrder) || 1000,
      });
    }
  });

  const categories = Array.from(categoryMap.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  return [{ id: 'all', name: 'Todos', order: -1 }, ...categories];
}

function getFilteredProducts() {
  const byAvailability = state.hideSoldOut
    ? state.products.filter((product) => !product.soldOut)
    : state.products;
  if (state.selectedCategory === 'all') return byAvailability;
  return byAvailability.filter((product) => product.categoryId === state.selectedCategory);
}

function resolveDotIndex(slider, imageCount) {
  if (!slider || imageCount <= 1) return 0;
  const itemWidth = slider.clientWidth || slider.firstElementChild?.clientWidth || 1;
  const imageIndex = clamp(Math.round(slider.scrollLeft / itemWidth), 0, imageCount - 1);
  if (imageCount <= CARD_DOT_COUNT) return imageIndex;

  const ratio = imageIndex / Math.max(imageCount - 1, 1);
  return clamp(Math.round(ratio * (CARD_DOT_COUNT - 1)), 0, CARD_DOT_COUNT - 1);
}

function renderCardDots(slider, dots, imageCount) {
  if (!slider || !Array.isArray(dots) || !dots.length) return;
  const activeDot = resolveDotIndex(slider, imageCount);
  dots.forEach((dot, index) => {
    dot.classList.toggle('is-active', index === activeDot);
  });
}

function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'tienda-card rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition';
  card.dataset.productId = product.id;

  const images = product.images.length ? product.images : [
    'https://placehold.co/640x640?text=Producto'
  ];

  const sliderId = `slider-${slugify(String(product.id))}-${Math.random().toString(16).slice(2, 8)}`;

  const imagesHtml = images.map((src, idx) => `
    <img
      src="${src}"
      alt="${product.name} ${idx + 1}"
      class="w-full h-36 object-cover flex-shrink-0"
      loading="lazy"
    />
  `).join('');

  card.innerHTML = `
    <div class="relative bg-gray-100 border-b border-gray-100">
      <div id="${sliderId}" class="tienda-galeria-track hide-scrollbar flex overflow-x-auto" data-role="card-slider">
        ${imagesHtml}
      </div>
      ${product.soldOut ? '<span class="tienda-soldout-badge">AGOTADO</span>' : ''}
      ${images.length > 1
        ? `<div class="tienda-slider-dots absolute left-1/2 -translate-x-1/2 bottom-2 flex items-center gap-1.5">
            ${Array.from({ length: CARD_DOT_COUNT }).map((_, index) => `
              <span class="tienda-slider-dot ${index === 0 ? 'is-active' : ''}"></span>
            `).join('')}
          </div>`
        : ''}
    </div>
    <div class="p-3">
      <h3 class="tienda-card-title leading-tight font-semibold text-[var(--tienda-color-title)] min-h-[2.5rem] line-clamp-2">${product.name}</h3>
      <p class="tienda-card-price mt-1 font-semibold text-[var(--tienda-color-price)]">${product.priceLabel}</p>
    </div>
  `;

  const slider = card.querySelector('[data-role="card-slider"]');
  const dots = Array.from(card.querySelectorAll('.tienda-slider-dot'));
  if (slider && dots.length) {
    renderCardDots(slider, dots, images.length);
    slider.addEventListener('scroll', () => {
      renderCardDots(slider, dots, images.length);
    }, { passive: true });
    window.requestAnimationFrame(() => {
      renderCardDots(slider, dots, images.length);
    });
  }

  card.addEventListener('click', () => {
    openProductModal(product.id);
  });

  return card;
}

function renderCategories() {
  if (!categoriaButtons) return;

  categoriaButtons.innerHTML = '';

  state.categories.forEach((category) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tienda-categoria-btn px-4 py-2 rounded-full text-sm whitespace-nowrap transition';
    if (state.selectedCategory === category.id) btn.classList.add('is-active');
    btn.textContent = category.name;

    btn.addEventListener('click', () => {
      state.selectedCategory = category.id;
      renderCategories();
      renderProducts();
    });

    categoriaButtons.appendChild(btn);
  });

  const hasSoldOut = state.products.some((product) => product.soldOut);
  if (toggleHideSoldOut) {
    toggleHideSoldOut.classList.toggle('hidden', !hasSoldOut);
    toggleHideSoldOut.classList.toggle('is-active', state.hideSoldOut);
    toggleHideSoldOut.textContent = state.hideSoldOut ? 'Mostrar agotados' : 'Ocultar agotados';
  }

  categoriaButtons.classList.toggle('hidden', state.categories.length <= 1);
  const shouldHideSection = state.categories.length <= 1 && !hasSoldOut;
  categoriaSection?.classList.toggle('hidden', shouldHideSection);
}

function renderProducts() {
  if (!productosGrid) return;

  productosGrid.innerHTML = '';
  const visibleProducts = getFilteredProducts();

  if (!visibleProducts.length) {
    productosSection?.classList.remove('hidden');
    const message = state.hideSoldOut
      ? 'No hay productos disponibles para esta categoría.'
      : 'No hay productos para esta categoría todavía.';
    setStatus(message, 'warning');
    return;
  }

  setStatus('');

  visibleProducts.forEach((product) => {
    productosGrid.appendChild(createProductCard(product));
  });

  productosSection?.classList.remove('hidden');
}

function getModalProduct() {
  return state.products.find((product) => product.id === state.modalProductId) || null;
}

function updateModalImage() {
  const product = getModalProduct();
  if (!product) return;

  const images = product.images.length ? product.images : ['https://placehold.co/800x800?text=Producto'];
  const index = Math.min(Math.max(state.modalImageIndex, 0), images.length - 1);
  state.modalImageIndex = index;

  modalImagenPrincipal.src = images[index];
  if (modalImagenLink) modalImagenLink.dataset.imageSrc = images[index];
  modalPrevImagen.classList.toggle('hidden', images.length <= 1);
  modalNextImagen.classList.toggle('hidden', images.length <= 1);

  modalThumbs.innerHTML = '';
  if (images.length > 1) {
    modalThumbs.classList.remove('hidden');
    modalThumbs.classList.add('flex');

    images.forEach((src, idx) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = `border rounded-lg overflow-hidden w-16 h-16 flex-shrink-0 ${idx === index ? 'ring-2 ring-[#fb8500]' : 'opacity-80'}`;
      thumb.innerHTML = `<img src="${src}" alt="Miniatura ${idx + 1}" class="w-full h-full object-cover"/>`;
      thumb.addEventListener('click', () => {
        state.modalImageIndex = idx;
        updateModalImage();
      });
      modalThumbs.appendChild(thumb);
    });
  } else {
    modalThumbs.classList.add('hidden');
    modalThumbs.classList.remove('flex');
  }
}

function openExpandedImageModal(imageSrc = '', imageAlt = 'Imagen de producto') {
  if (!modalImagenExpandida || !modalImagenExpandidaSrc || !imageSrc) return;
  modalImagenExpandidaSrc.src = imageSrc;
  modalImagenExpandidaSrc.alt = imageAlt || 'Imagen de producto';
  modalImagenExpandida.classList.remove('hidden');
}

function closeExpandedImageModal() {
  if (!modalImagenExpandida || !modalImagenExpandidaSrc) return;
  modalImagenExpandida.classList.add('hidden');
  modalImagenExpandidaSrc.src = '';
}

function renderVariantOptions(options = []) {
  modalOpciones.innerHTML = '';

  if (!options.length) {
    modalOpcionesSection.classList.add('hidden');
    return;
  }

  options.forEach((option) => {
    const row = document.createElement('div');
    row.className = 'text-sm text-gray-700';
    const values = Array.isArray(option.values) ? option.values.join(' · ') : '';
    row.innerHTML = `<span class="font-semibold">${option.name}:</span> ${values || 'Sin valores'}`;
    modalOpciones.appendChild(row);
  });

  modalOpcionesSection.classList.remove('hidden');
}

function sanitizeVariantBundle(variantBundle = {}) {
  const sourceOptions = Array.isArray(variantBundle?.options) ? variantBundle.options : [];
  const sourceVariants = Array.isArray(variantBundle?.variants) ? variantBundle.variants : [];

  const options = sourceOptions
    .map((option) => {
      const name = String(option?.name || '').trim();
      const valuesRaw = Array.isArray(option?.values) ? option.values : [];
      const values = valuesRaw
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .filter((value) => !(isTitleLikeOptionName(name) && isDefaultOptionText(value)));

      if (!name || !values.length) return null;
      if (isTitleLikeOptionName(name) && values.every(isDefaultOptionText)) return null;
      return { name, values: Array.from(new Set(values)) };
    })
    .filter(Boolean);

  const variants = sourceVariants
    .map((variant) => {
      const optionPairs = (Array.isArray(variant?.options) ? variant.options : [])
        .map((pair) => ({
          name: String(pair?.name || '').trim(),
          value: String(pair?.value || '').trim(),
        }))
        .filter((pair) => pair.name && pair.value)
        .filter((pair) => !(isTitleLikeOptionName(pair.name) && isDefaultOptionText(pair.value)));

      const title = String(variant?.title || '').trim();
      const titleLooksDefault = !title || isDefaultOptionText(title);

      if (titleLooksDefault && !optionPairs.length) return null;

      return {
        ...variant,
        title: titleLooksDefault ? optionPairs.map((pair) => pair.value).join(' / ') : title,
        options: optionPairs,
      };
    })
    .filter((variant) => variant && variant.title);

  return { options, variants };
}

function getSizeOptionName(variantBundle = {}) {
  const optionList = Array.isArray(variantBundle?.options) ? variantBundle.options : [];
  const direct = optionList
    .map((option) => String(option?.name || '').trim())
    .find((name) => {
      const normalized = normalizeOptionName(name);
      return normalized === 'size'
        || normalized === 'talla'
        || normalized === 'tamano'
        || normalized.includes('talla')
        || normalized.includes('tamano')
        || normalized.includes('size');
    });
  if (direct) return direct;

  const fromPairs = (Array.isArray(variantBundle?.variants) ? variantBundle.variants : [])
    .flatMap((variant) => Array.isArray(variant?.options) ? variant.options : [])
    .map((pair) => String(pair?.name || '').trim())
    .find((name) => {
      const normalized = normalizeOptionName(name);
      return normalized === 'size'
        || normalized === 'talla'
        || normalized === 'tamano'
        || normalized.includes('talla')
        || normalized.includes('tamano')
        || normalized.includes('size');
    });
  return fromPairs || '';
}

function getVariantSizeValue(variant = {}, sizeOptionName = '') {
  const options = Array.isArray(variant?.options) ? variant.options : [];
  const exact = options.find((pair) => normalizeOptionName(pair?.name) === normalizeOptionName(sizeOptionName));
  if (exact?.value) return String(exact.value).trim();

  const fallback = options.find((pair) => {
    const normalized = normalizeOptionName(pair?.name);
    return normalized === 'size'
      || normalized === 'talla'
      || normalized === 'tamano'
      || normalized.includes('talla')
      || normalized.includes('tamano')
      || normalized.includes('size');
  });
  return fallback?.value ? String(fallback.value).trim() : '';
}

function resolveSizeOrder(label = '') {
  const normalized = normalizeOptionName(label).replace(/\s+/g, '');
  const ordered = ['xxs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl'];
  const idx = ordered.indexOf(normalized);
  return idx >= 0 ? idx : 999;
}

function updateModalPrice(product) {
  if (!modalPrecio || !product) return;
  const basePrice = product.priceLabel;
  modalPrecio.textContent = product.soldOut ? `${basePrice} · AGOTADO` : basePrice;
}

function renderSizeBlocks(variantBundle = {}) {
  if (!modalTallas || !modalTallasSection) return false;
  modalTallas.innerHTML = '';

  const variants = Array.isArray(variantBundle?.variants) ? variantBundle.variants : [];
  if (!variants.length) {
    modalTallasSection.classList.add('hidden');
    return false;
  }

  const sizeOptionName = getSizeOptionName(variantBundle);
  if (!sizeOptionName) {
    modalTallasSection.classList.add('hidden');
    return false;
  }

  const bySize = new Map();
  variants.forEach((variant) => {
    const sizeLabel = getVariantSizeValue(variant, sizeOptionName);
    if (!sizeLabel) return;
    const key = normalizeOptionName(sizeLabel);
    const existing = bySize.get(key);
    if (!existing) {
      bySize.set(key, { ...variant, sizeLabel });
      return;
    }
    if (variant.available && !existing.available) {
      bySize.set(key, { ...variant, sizeLabel });
      return;
    }
    const existingPrice = Number.isFinite(existing.price) ? existing.price : Number.POSITIVE_INFINITY;
    const currentPrice = Number.isFinite(variant.price) ? variant.price : Number.POSITIVE_INFINITY;
    if (currentPrice < existingPrice) {
      bySize.set(key, { ...variant, sizeLabel });
    }
  });

  const sizes = Array.from(bySize.values()).sort((a, b) => {
    const orderA = resolveSizeOrder(a.sizeLabel);
    const orderB = resolveSizeOrder(b.sizeLabel);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.sizeLabel).localeCompare(String(b.sizeLabel), 'es', { sensitivity: 'base' });
  });

  if (!sizes.length) {
    modalTallasSection.classList.add('hidden');
    return false;
  }

  sizes.forEach((variantSize) => {
    const block = document.createElement('div');
    const unavailable = !variantSize.available;
    block.className = 'tienda-size-chip';
    if (unavailable) block.classList.add('is-disabled');

    const label = escapeHtml(String(variantSize.sizeLabel || variantSize.title || '').trim());
    const price = Number.isFinite(variantSize.price) ? formatMoney(variantSize.price) : 'Por confirmar';
    block.innerHTML = `
      <span class="block text-sm font-semibold leading-tight">${label}</span>
      <span class="block text-[11px] mt-0.5 ${unavailable ? 'text-gray-400' : 'text-gray-600'}">${price}</span>
    `;

    modalTallas.appendChild(block);
  });

  modalTallasSection.classList.remove('hidden');
  return true;
}

function renderVariantList(variants = []) {
  modalVariantes.innerHTML = '';

  if (!variants.length) {
    modalVariantesSection.classList.add('hidden');
    return;
  }

  variants.forEach((variant) => {
    const row = document.createElement('div');
    row.className = 'rounded-xl border border-gray-200 px-3 py-2';

    const priceLine = variant.price !== null
      ? formatMoney(variant.price)
      : 'Precio por confirmar';

    const compareLine = Number.isFinite(variant.compareAtPrice)
      ? ` <span class="text-xs text-gray-400 line-through ml-1">${formatMoney(variant.compareAtPrice)}</span>`
      : '';

    const optionsLine = variant.options?.length
      ? `<p class="text-xs text-gray-500 mt-1">${variant.options.map((pair) => `${pair.name}: ${pair.value}`).join(' · ')}</p>`
      : '';

    row.innerHTML = `
      <p class="text-sm font-semibold text-gray-800">${variant.title}</p>
      <p class="text-sm text-[var(--tienda-color-price)] font-semibold">${priceLine}${compareLine}</p>
      ${optionsLine}
      <p class="text-xs mt-1 ${variant.available ? 'text-emerald-600' : 'text-red-500'}">${variant.available ? 'Disponible' : 'Agotado'}</p>
    `;

    modalVariantes.appendChild(row);
  });

  modalVariantesSection.classList.remove('hidden');
}

function openProductModal(productId) {
  state.modalProductId = productId;
  state.modalImageIndex = 0;

  const product = getModalProduct();
  if (!product) return;

  modalNombre.textContent = product.name;
  const hasDescription = String(product.description || '').trim().length > 0;
  modalDescripcion.textContent = hasDescription ? product.description : '';
  modalDescripcion.classList.toggle('hidden', !hasDescription);

  const cleanVariantBundle = sanitizeVariantBundle(product?.variants || {});
  const variants = cleanVariantBundle.variants || [];
  if (!variants.length) {
    renderVariantOptions([]);
    renderVariantList([]);
    if (modalTallas) modalTallas.innerHTML = '';
    modalTallasSection?.classList.add('hidden');
  } else {
    const hasSizes = renderSizeBlocks(cleanVariantBundle);
    renderVariantOptions(hasSizes ? [] : (cleanVariantBundle.options || []));
    renderVariantList(hasSizes ? [] : variants);
  }
  updateModalPrice(product);

  const canBuy = state.storeMode.tiendaOnline && product.isShopify && !!product.buyUrl && !product.soldOut;
  if (canBuy) {
    modalComprarBtn.href = product.buyUrl;
    modalComprarBtn.classList.remove('hidden');
  } else {
    modalComprarBtn.classList.add('hidden');
    modalComprarBtn.removeAttribute('href');
  }

  updateModalImage();
  modalProducto.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeProductModal() {
  closeExpandedImageModal();
  modalProducto.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  state.modalProductId = null;
}

function mountModalEvents() {
  modalCerrar?.addEventListener('click', closeProductModal);
  modalProductoBackdrop?.addEventListener('click', closeProductModal);
  modalProducto?.addEventListener('click', (event) => {
    if (modalProducto.classList.contains('hidden')) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const panel = modalProductoPanel || modalProducto.querySelector('.tienda-modal-panel');
    if (panel && panel.contains(target)) return;
    closeProductModal();
  });

  modalPrevImagen?.addEventListener('click', () => {
    const product = getModalProduct();
    if (!product || product.images.length <= 1) return;
    state.modalImageIndex = (state.modalImageIndex - 1 + product.images.length) % product.images.length;
    updateModalImage();
  });

  modalNextImagen?.addEventListener('click', () => {
    const product = getModalProduct();
    if (!product || product.images.length <= 1) return;
    state.modalImageIndex = (state.modalImageIndex + 1) % product.images.length;
    updateModalImage();
  });

  modalImagenLink?.addEventListener('click', () => {
    const src = modalImagenLink.dataset.imageSrc || modalImagenPrincipal?.src || '';
    if (!src) return;
    openExpandedImageModal(src, modalImagenPrincipal?.alt || 'Imagen de producto');
  });
  modalImagenExpandidaCerrar?.addEventListener('click', closeExpandedImageModal);
  modalImagenExpandidaBackdrop?.addEventListener('click', closeExpandedImageModal);
  modalImagenExpandidaWrap?.addEventListener('click', (event) => {
    if (event.target === modalImagenExpandidaWrap) closeExpandedImageModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (modalImagenExpandida && !modalImagenExpandida.classList.contains('hidden')) {
      closeExpandedImageModal();
      return;
    }
    if (!modalProducto.classList.contains('hidden')) {
      closeProductModal();
    }
  });

  toggleHideSoldOut?.addEventListener('click', () => {
    state.hideSoldOut = !state.hideSoldOut;
    renderCategories();
    renderProducts();
  });
}

function bindBackLink() {
  if (!btnVolverPerfil) return;
  const defaultListHref = '../listadoComercios.html';
  const safeReturnTo = resolveSafeInternalReturnPath(returnToParam);
  const fallbackHref = navSource === 'listado'
    ? (safeReturnTo || defaultListHref)
    : `../perfilComercio.html?id=${idComercio}`;
  btnVolverPerfil.href = fallbackHref;

  btnVolverPerfil.addEventListener('click', (event) => {
    const hasHistory = window.history.length > 1;
    let cameFromPerfil = false;
    let cameFromListado = false;

    try {
      if (document.referrer) {
        const refUrl = new URL(document.referrer);
        cameFromPerfil = refUrl.origin === window.location.origin
          && /\/perfilComercio\.html$/i.test(refUrl.pathname);
        cameFromListado = refUrl.origin === window.location.origin
          && /\/listadoComercios\.html$/i.test(refUrl.pathname);
      }
    } catch (_) {
      cameFromPerfil = false;
      cameFromListado = false;
    }

    // Si vino del perfil, volver en historial evita crear una nueva entrada de perfil.
    if (navSource === 'perfil' && hasHistory && cameFromPerfil) {
      event.preventDefault();
      window.history.back();
      return;
    }

    // Si vino del listado por búsqueda, volver al historial/listado en vez de ir al perfil.
    if (navSource === 'listado') {
      event.preventDefault();
      if (hasHistory && cameFromListado) {
        window.history.back();
        return;
      }
      window.location.href = safeReturnTo || defaultListHref;
    }
  });
}

function openRequestedProductModalIfAny() {
  if (!requestedProductId || !Array.isArray(state.products) || !state.products.length) return;

  const requestedNorm = String(requestedProductId).trim();
  const byExact = state.products.find((product) => String(product?.id || '').trim() === requestedNorm);
  if (byExact?.id) {
    openProductModal(byExact.id);
    return;
  }

  const requestedNum = Number(requestedNorm);
  if (!Number.isFinite(requestedNum)) return;
  const byNumeric = state.products.find((product) => Number(product?.id) === requestedNum);
  if (byNumeric?.id) {
    openProductModal(byNumeric.id);
  }
}

async function loadStoreData() {
  await fetchComercio();
  await fetchTheme();

  const menus = await fetchCategoriesFromMenus();
  const menuMap = new Map((menus || []).map((menu) => [Number(menu.id), menu]));

  let productsRaw = await fetchProductsByMenuIds(Array.from(menuMap.keys()));

  if (!productsRaw.length) {
    const directProducts = await fetchProductsDirectByCommerce();
    if (directProducts.length) {
      productsRaw = directProducts;
    }
  }

  if (!productsRaw.length) {
    const shopifyProducts = await fetchShopifyProductsFallback();
    if (shopifyProducts.length) {
      productsRaw = shopifyProducts;
    }
  }

  const originHint = productsRaw.some((product) => isShopifyProduct(product)) ? 'shopify' : 'findixi';
  const normalized = productsRaw.map((product) => normalizeProduct(product, menuMap, originHint));
  const visible = normalized.filter((product) => product.isVisible !== false);

  state.products = sortProducts(visible);
  state.categories = buildCategories(state.products, menus);

  if (!state.categories.some((cat) => cat.id === state.selectedCategory)) {
    state.selectedCategory = 'all';
  }
}

async function init() {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    setStatus('ID de comercio inválido.', 'error');
    return;
  }

  bindBackLink();
  mountModalEvents();

  try {
    setStatus('Cargando tienda...');
    await loadStoreData();
    applyTheme();
    renderCategories();
    renderProducts();
    openRequestedProductModalIfAny();

    if (!state.products.length) {
      const noShopifyMsg = !state.storeMode.tiendaOnline
        ? 'Este comercio no tiene tienda online activa. Puedes publicar productos desde Findixi (sin botón de compra).'
        : 'Aún no hay productos publicados para esta tienda.';
      setStatus(noShopifyMsg, 'warning');
    }
  } catch (error) {
    console.error('Error cargando tienda:', error);
    setStatus('No se pudo cargar la tienda. Intenta nuevamente.', 'error');
  }
}

init();
