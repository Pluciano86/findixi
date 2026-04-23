import { supabase } from '../shared/supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const idComercio = Number(params.get('idComercio') || params.get('id'));

const heroBannerImg = document.getElementById('heroBannerImg');
const heroOverlay = document.getElementById('heroOverlay');
const tiendaFixedBackground = document.getElementById('tiendaFixedBackground');
const tiendaFixedBackgroundOverlay = document.getElementById('tiendaFixedBackgroundOverlay');
const btnVolverPerfil = document.getElementById('btnVolverPerfil');
const estadoTienda = document.getElementById('estadoTienda');
const categoriaSection = document.getElementById('categoriaSection');
const categoriaButtons = document.getElementById('categoriaButtons');
const productosSection = document.getElementById('productosSection');
const productosGrid = document.getElementById('productosGrid');

const modalProducto = document.getElementById('modalProducto');
const modalProductoBackdrop = document.getElementById('modalProductoBackdrop');
const modalCerrar = document.getElementById('modalCerrar');
const modalImagenPrincipal = document.getElementById('modalImagenPrincipal');
const modalPrevImagen = document.getElementById('modalPrevImagen');
const modalNextImagen = document.getElementById('modalNextImagen');
const modalThumbs = document.getElementById('modalThumbs');
const modalNombre = document.getElementById('modalNombre');
const modalPrecio = document.getElementById('modalPrecio');
const modalDescripcion = document.getElementById('modalDescripcion');
const modalOpcionesSection = document.getElementById('modalOpcionesSection');
const modalOpciones = document.getElementById('modalOpciones');
const modalVariantesSection = document.getElementById('modalVariantesSection');
const modalVariantes = document.getElementById('modalVariantes');
const modalComprarBtn = document.getElementById('modalComprarBtn');

const DEFAULT_THEME = {
  colorboton: '#fb8500',
  colorbotontexto: '#ffffff',
  colorprecio: '#111827',
  colortitulo: '#111827',
  colortexto: '#374151',
  backgroundcolor: '#f8fafc',
  item_bg_color: '#ffffff',
  overlayoscuro: 20,
  portadaimagen: '',
  backgroundimagen: '',
};

const state = {
  comercio: null,
  storeMode: { tiendaFisica: true, tiendaOnline: false },
  theme: { ...DEFAULT_THEME },
  categories: [],
  products: [],
  selectedCategory: 'all',
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

function parseMoney(value) {
  const num = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : null;
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
  document.documentElement.style.setProperty('--tienda-color-btn', t.colorboton || DEFAULT_THEME.colorboton);
  document.documentElement.style.setProperty('--tienda-color-btn-text', t.colorbotontexto || DEFAULT_THEME.colorbotontexto);
  document.documentElement.style.setProperty('--tienda-color-price', t.colorprecio || DEFAULT_THEME.colorprecio);
  document.documentElement.style.setProperty('--tienda-color-title', t.colortitulo || DEFAULT_THEME.colortitulo);
  document.documentElement.style.setProperty('--tienda-color-text', t.colortexto || DEFAULT_THEME.colortexto);
  document.documentElement.style.setProperty('--tienda-background', t.backgroundcolor || DEFAULT_THEME.backgroundcolor);
  document.documentElement.style.setProperty('--tienda-item-bg', t.item_bg_color || DEFAULT_THEME.item_bg_color);

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
}

function setStatus(message, tone = 'neutral') {
  if (!estadoTienda) return;
  estadoTienda.textContent = message;
  estadoTienda.className = 'text-sm px-1';

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
  const { data, error } = await supabase
    .from('menu_tema')
    .select('colorboton,colorbotontexto,colorprecio,colortitulo,colortexto,backgroundcolor,item_bg_color,overlayoscuro,portadaimagen,backgroundimagen')
    .eq('idcomercio', idComercio)
    .maybeSingle();

  if (error) {
    console.warn('No se pudo cargar tema de tienda, usando default:', error?.message || error);
  }

  state.theme = { ...DEFAULT_THEME, ...(data || {}) };
}

async function fetchCategoriesFromMenus() {
  const { data, error } = await supabase
    .from('menus')
    .select('id,titulo,descripcion,orden,activo')
    .eq('idComercio', idComercio)
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.warn('No se pudieron cargar categorías (menus):', error?.message || error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function fetchProductsByMenuIds(menuIds = []) {
  const ids = (menuIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return [];

  let query = await supabase
    .from('productos')
    .select('*')
    .in('idMenu', ids)
    .eq('activo', true);

  if (!query.error) return Array.isArray(query.data) ? query.data : [];

  const errorText = String(query.error?.message || query.error?.details || '').toLowerCase();
  if (!errorText.includes('idmenu')) {
    console.warn('No se pudieron cargar productos por menu:', query.error);
    return [];
  }

  query = await supabase
    .from('productos')
    .select('*')
    .in('idmenu', ids)
    .eq('activo', true);

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
    .eq('idComercio', idComercio)
    .eq('activo', true);

  if (!lookup.error) return Array.isArray(lookup.data) ? lookup.data : [];

  const errTxt = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
  if (!errTxt.includes('idcomercio')) {
    return [];
  }

  lookup = await supabase
    .from('productos')
    .select('*')
    .eq('idcomercio', idComercio)
    .eq('activo', true);

  if (lookup.error) return [];
  return Array.isArray(lookup.data) ? lookup.data : [];
}

async function fetchShopifyProductsFallback() {
  let lookup = await supabase
    .from('shopify_productos')
    .select('*')
    .eq('idComercio', idComercio)
    .eq('activo', true);

  if (!lookup.error) return Array.isArray(lookup.data) ? lookup.data : [];

  const msg = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
  if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('shopify_productos')) {
    return [];
  }

  if (msg.includes('activo')) {
    lookup = await supabase
      .from('shopify_productos')
      .select('*')
      .eq('idComercio', idComercio);

    if (!lookup.error) return Array.isArray(lookup.data) ? lookup.data : [];
  }

  const fallbackMsg = String(lookup.error?.message || lookup.error?.details || '').toLowerCase();
  if (!fallbackMsg.includes('idcomercio')) {
    console.warn('Error cargando shopify_productos:', lookup.error);
    return [];
  }

  lookup = await supabase
    .from('shopify_productos')
    .select('*')
    .eq('idcomercio', idComercio)
    .eq('activo', true);

  if (lookup.error && String(lookup.error?.message || lookup.error?.details || '').toLowerCase().includes('activo')) {
    lookup = await supabase
      .from('shopify_productos')
      .select('*')
      .eq('idcomercio', idComercio);
  }

  if (lookup.error) return [];
  return Array.isArray(lookup.data) ? lookup.data : [];
}

function buildCategories(products = [], menus = []) {
  const menuCategories = (menus || []).map((menu) => ({
    id: `menu:${menu.id}`,
    name: String(menu.titulo || 'General').trim() || 'General',
    order: Number(menu.orden) || 0,
  }));

  const categoryMap = new Map(menuCategories.map((cat) => [cat.id, cat]));

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
  if (state.selectedCategory === 'all') return state.products;
  return state.products.filter((product) => product.categoryId === state.selectedCategory);
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
      <div id="${sliderId}" class="tienda-galeria-track hide-scrollbar flex overflow-x-auto">
        ${imagesHtml}
      </div>
      ${images.length > 1
        ? '<span class="absolute bottom-1 right-1 text-[11px] px-2 py-0.5 rounded-full bg-black/60 text-white">Desliza</span>'
        : ''}
    </div>
    <div class="p-3">
      <h3 class="text-sm leading-tight font-semibold text-[var(--tienda-color-title)] min-h-[2.5rem] line-clamp-2">${product.name}</h3>
      <p class="text-sm mt-1 font-semibold text-[var(--tienda-color-price)]">${product.priceLabel}</p>
    </div>
  `;

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

  categoriaSection?.classList.toggle('hidden', state.categories.length <= 1);
}

function renderProducts() {
  if (!productosGrid) return;

  productosGrid.innerHTML = '';
  const visibleProducts = getFilteredProducts();

  if (!visibleProducts.length) {
    productosSection?.classList.remove('hidden');
    setStatus('No hay productos para esta categoría todavía.', 'warning');
    return;
  }

  setStatus(`${visibleProducts.length} producto${visibleProducts.length === 1 ? '' : 's'} disponibles.`);

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
  modalPrecio.textContent = product.priceLabel;
  modalDescripcion.textContent = product.description || 'Sin descripción disponible.';

  renderVariantOptions(product.variants.options || []);
  renderVariantList(product.variants.variants || []);

  const canBuy = state.storeMode.tiendaOnline && product.isShopify && !!product.buyUrl;
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
  modalProducto.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  state.modalProductId = null;
}

function mountModalEvents() {
  modalCerrar?.addEventListener('click', closeProductModal);
  modalProductoBackdrop?.addEventListener('click', closeProductModal);

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

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalProducto.classList.contains('hidden')) {
      closeProductModal();
    }
  });
}

function bindBackLink() {
  if (!btnVolverPerfil) return;
  btnVolverPerfil.href = `../perfilComercio.html?id=${idComercio}`;
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

  state.products = sortProducts(normalized);
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
