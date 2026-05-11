import { supabase } from '../shared/supabaseClient.js';
import { formatTiempo } from '../shared/osrmClient.js';
import { formatearTelefonoDisplay, formatearTelefonoHref } from '../shared/utils.js';
import { calcularTiemposParaLista } from './calcularTiemposParaLista.js';
import { mostrarCercanosComida } from './cercanosComida.js';
import { mostrarPlayasCercanas } from './playasCercanas.js';
import { showPopup } from './popups.js';
import { resolverPlanComercio } from '../shared/planes.js';
import { mostrarLugaresCercanos } from './lugaresCercanos.js';
import { QR_REDIMIR_URL } from '../shared/runtimeConfig.js';
import { bindTrackedAnchor, trackAnalyticsEvent } from '../shared/analyticsTracker.js';
import { initPerfilServicios } from './perfilServicios.js';

const idComercio = new URLSearchParams(window.location.search).get('id');
let latUsuario = null;
let lonUsuario = null;
let comercioActual = null;
const CUPON_PLACEHOLDER = 'https://placehold.co/600x400?text=Cup%C3%B3n';
const PUBLIC_BUCKET_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios';
const DEFAULT_LOGO = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png';
const SHARE_ICON_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/send.svg';
const LIKE_OFF_ICON_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/nolikeit.svg';
const LODEHOY_AUDIO_PREF_KEY = 'lodehoy_audio_enabled';
const PRODUCT_PLACEHOLDER_URL = 'https://placehold.co/320x320?text=Producto';
const ROPA_ACCESORIOS_NOMBRES = new Set([
  'ropa y accesorios',
  'ropa & accesorios',
  'tienda de ropa y accesorios',
]);
const USER_AGENT = String(window.navigator?.userAgent || '').toLowerCase();
const IS_IOS_DEVICE = /iphone|ipad|ipod/.test(USER_AGENT)
  || (String(window.navigator?.platform || '').toLowerCase() === 'macintel' && Number(window.navigator?.maxTouchPoints || 0) > 1);
const isLocalEnv = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const LOGIN_URL = isLocalEnv ? '/public/logearse.html' : '/logearse.html';
let perfilUsuarioCache = null;
let perfilAutoplayUnlocked = false;
let perfilVideoObserver = null;
let perfilUnlockHandlersBound = false;
let perfilPlaybackEventsBound = false;
let perfilAudioEnabled = true;
let perfilPostActionsBound = false;

const obtenerUsuarioActual = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      window.location.href = LOGIN_URL;
      return null;
    }
    return data.user;
  } catch (err) {
    console.error('Error obteniendo usuario actual:', err);
    window.location.href = LOGIN_URL;
    return null;
  }
};

const getUserSinRedir = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  } catch (_) {
    return null;
  }
};

const obtenerPerfilUsuario = async (userId) => {
  if (perfilUsuarioCache && perfilUsuarioCache.id === userId) {
    return perfilUsuarioCache;
  }
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, telefono, imagen')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error obteniendo perfil del usuario:', error);
      return null;
    }
    perfilUsuarioCache = data;
    return data;
  } catch (err) {
    console.error('Error inesperado obteniendo perfil del usuario:', err);
    return null;
  }
};

const procesarGuardadoCupon = async ({
  cupon,
  btnGuardar,
  acciones,
  estadoRow,
  disponiblesTotal,
  guardadosMap,
  totalesMap
}) => {
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  const user = await getUserSinRedir();
  if (!user) {
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cupón';
    const currentPath = `${window.location.pathname}${window.location.search}`;
    window.location.href = `${LOGIN_URL}?redirect=${encodeURIComponent(currentPath)}`;
    return;
  }

  let perfil = await obtenerPerfilUsuario(user.id);
  if (!perfil) {
    alert('No pudimos validar tu perfil. Intenta nuevamente.');
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cupón';
    return;
  }

  perfil = perfilUsuarioCache || perfil;

  try {
    const codigoqr = crypto.randomUUID();
    const qrUrl = `${QR_REDIMIR_URL}?qr=${codigoqr}`;
    console.log('Generando QR para cupón:', cupon.id, codigoqr, qrUrl);
    const telefonoFormateado = perfil.telefono
      ? perfil.telefono.startsWith('+1')
        ? perfil.telefono
        : `+1${perfil.telefono}`
      : null;
    const { error: insertError } = await supabase
      .from('cuponesUsuarios')
      .insert({
        idCupon: cupon.id,
        idUsuario: user.id,
        codigoqr,
        redimido: false,
        fechaGuardado: new Date().toISOString(),
        telefonoUsuario: telefonoFormateado
      });

    if (insertError) {
      if (insertError.code === '23505') {
        alert('Ya guardaste este cupón.');
      } else {
        console.error('❌ Error guardando cupón:', insertError);
        alert('Ocurrió un error al guardar el cupón.');
      }
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar cupón';
      return;
    }

    guardadosMap.set(cupon.id, { redimido: false, codigoqr });
    totalesMap.set(cupon.id, (totalesMap.get(cupon.id) || 0) + 1);
    btnGuardar.remove();
    const estado = document.createElement('span');
    estado.className = 'inline-flex items-center px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full';
    estado.textContent = 'Ya guardado';
    acciones.appendChild(estado);
    if (estadoRow) {
      const nuevosUsados = totalesMap.get(cupon.id) || 0;
      estadoRow.innerHTML = `<span>Disponibles: ${Math.max(disponiblesTotal - nuevosUsados, 0)} de ${disponiblesTotal}</span>`;
    }
  } catch (error) {
    console.error('🛑 Error inesperado guardando cupón:', error);
    alert('No se pudo guardar el cupón. Intenta nuevamente.');
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar cupón';
  }
};

const formatearFechaLegible = (fecha) => {
  if (!fecha) return '--';
  const date = new Date(fecha);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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

function parseMoney(value) {
  const number = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
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

function isMissingColumnError(error, expectedColumn = '') {
  if (!error) return false;
  const code = String(error.code || '').toLowerCase();
  const detail = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  if (expectedColumn && !detail.includes(expectedColumn.toLowerCase())) {
    return false;
  }
  return code === '42703' || code.startsWith('pgrst') || detail.includes('does not exist');
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

function normalizeExternalUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function formatWebLabel(url) {
  return String(url || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
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

function buildStoragePublicUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const encoded = encodeStoragePath(path);
  return encoded ? `${PUBLIC_BUCKET_BASE}/${encoded}` : '';
}

function isRopaAccesoriosName(name) {
  const normalized = normalizeText(name);
  if (!normalized) return false;
  if (ROPA_ACCESORIOS_NOMBRES.has(normalized)) return true;
  return normalized.includes('ropa') && normalized.includes('accesor');
}

function isStoreProfileCategory(categoria = {}) {
  const tipoPerfil = normalizeText(categoria?.tipo_perfil);
  if (tipoPerfil === 'tienda') return true;
  return isRopaAccesoriosName(categoria?.nombre);
}

async function fetchCategoriasComercioMeta(comercio = {}) {
  const ids = Array.from(
    new Set(
      (Array.isArray(comercio?.ComercioCategorias) ? comercio.ComercioCategorias : [])
        .map((rel) => Number(rel?.idCategoria))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (!ids.length) return [];

  let query = await supabase
    .from('Categorias')
    .select('id,nombre,tipo_perfil')
    .in('id', ids);

  if (query.error && /tipo_perfil/i.test(String(query.error.message || query.error.details || ''))) {
    query = await supabase
      .from('Categorias')
      .select('id,nombre')
      .in('id', ids);
  }

  if (query.error) {
    console.warn('No se pudieron cargar categorías del comercio para grid tienda:', query.error);
    return [];
  }

  return Array.isArray(query.data) ? query.data : [];
}

async function shouldRenderStoreGrid(comercio = {}) {
  const categorias = await fetchCategoriasComercioMeta(comercio);
  if (categorias.length) {
    return categorias.some(isStoreProfileCategory);
  }
  return isRopaAccesoriosName(comercio?.categoria);
}

async function fetchMenusComercioTienda(comercioId) {
  const id = Number(comercioId);
  if (!Number.isFinite(id) || id <= 0) return [];

  const commerceColumns = ['idComercio', 'idcomercio'];
  for (const commerceColumn of commerceColumns) {
    const result = await supabase
      .from('menus')
      .select('id,titulo,orden,activo')
      .eq(commerceColumn, id)
      .order('orden', { ascending: true })
      .order('id', { ascending: true });

    if (!result.error) {
      const list = Array.isArray(result.data) ? result.data : [];
      return list.filter((menu) => menu?.activo !== false);
    }

    if (!isMissingColumnError(result.error, commerceColumn)) {
      console.warn('Error cargando menús de tienda:', result.error);
      return [];
    }
  }

  return [];
}

async function fetchProductosTiendaByMenuIds(menuIds = []) {
  const ids = (Array.isArray(menuIds) ? menuIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!ids.length) return [];

  const menuColumns = ['idMenu', 'idmenu'];
  for (const menuColumn of menuColumns) {
    const result = await supabase
      .from('productos')
      .select('*')
      .in(menuColumn, ids)
      .order('id', { ascending: false })
      .limit(120);

    if (!result.error) {
      const list = Array.isArray(result.data) ? result.data : [];
      return list.filter((producto) => producto?.activo !== false);
    }

    if (!isMissingColumnError(result.error, menuColumn)) {
      console.warn('Error cargando productos por menú para grid tienda:', result.error);
      return [];
    }
  }

  return [];
}

async function fetchProductosTiendaByComercioFallback(comercioId) {
  const id = Number(comercioId);
  if (!Number.isFinite(id) || id <= 0) return [];

  const commerceColumns = ['idComercio', 'idcomercio'];
  for (const commerceColumn of commerceColumns) {
    const result = await supabase
      .from('productos')
      .select('*')
      .eq(commerceColumn, id)
      .order('id', { ascending: false })
      .limit(120);

    if (!result.error) {
      const list = Array.isArray(result.data) ? result.data : [];
      return list.filter((producto) => producto?.activo !== false);
    }

    if (!isMissingColumnError(result.error, commerceColumn)) {
      console.warn('Error cargando productos fallback por comercio:', result.error);
      return [];
    }
  }

  return [];
}

function parseProductImageSource(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseProductImageSource);
  if (typeof value === 'object') {
    const src = value.src || value.url || value.path || value.imagen;
    return src ? [String(src).trim()] : [];
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    const parsed = parseJsonMaybe(raw, null);
    if (parsed) return parseProductImageSource(parsed);
    if (raw.includes(',')) {
      return raw.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [raw];
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

  const images = candidates
    .flatMap(parseProductImageSource)
    .map((img) => buildStoragePublicUrl(img))
    .filter(Boolean);

  return Array.from(new Set(images));
}

function resolveProductPriceLabel(product = {}) {
  const textPrice = String(product?.precio_texto || '').trim();
  if (textPrice) return textPrice;

  const numberPrice = parseMoney(product?.precio);
  if (numberPrice !== null) return formatMoney(numberPrice);

  const variantsRaw =
    parseJsonMaybe(product?.variantes, null)
    || parseJsonMaybe(product?.variants, null)
    || parseJsonMaybe(product?.shopify_variantes, null)
    || parseJsonMaybe(product?.shopify_variants, null)
    || null;

  const variants = Array.isArray(variantsRaw)
    ? variantsRaw
    : Array.isArray(variantsRaw?.variants)
      ? variantsRaw.variants
      : [];

  const prices = variants
    .map((variant) => parseMoney(variant?.price ?? variant?.precio))
    .filter((value) => Number.isFinite(value));

  if (prices.length) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
  }

  return 'Por confirmar';
}

function resolveProductTimestamp(product = {}) {
  const dateRaw = product?.shopify_updated_at || product?.created_at || product?.updated_at || null;
  if (!dateRaw) return 0;
  const date = new Date(dateRaw);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortProductsForGrid(products = []) {
  return [...products].sort((a, b) => {
    const tDiff = resolveProductTimestamp(b) - resolveProductTimestamp(a);
    if (tDiff !== 0) return tDiff;
    const idA = Number(a?.id) || 0;
    const idB = Number(b?.id) || 0;
    if (idA !== idB) return idB - idA;
    return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es', { sensitivity: 'base' });
  });
}

function renderStoreProductsGrid(products = [], comercio = {}) {
  const section = document.getElementById('seccionProductosTienda');
  const grid = document.getElementById('gridProductosTienda');
  const btn = document.getElementById('btnVerMasProductosTienda');
  if (!section || !grid || !btn) return;

  const list = sortProductsForGrid(products).slice(0, 9);
  if (!list.length) {
    section.classList.add('hidden');
    return;
  }

  const tiendaHref = `tienda/tiendaComercio.html?idComercio=${encodeURIComponent(idComercio)}&source=perfil`;
  btn.setAttribute('href', tiendaHref);
  bindTrackedAnchor(btn, {
    idComercio,
    eventName: 'click_store_view_more',
    source: 'web',
    municipio: comercio?.municipio || null,
    dedupeKey: `perfil:store_more:${idComercio}`,
    dedupeMs: 1200,
  });

  grid.innerHTML = list.map((product) => {
    const image = resolveProductImages(product)[0] || PRODUCT_PLACEHOLDER_URL;
    const name = String(product?.nombre || 'Producto').trim() || 'Producto';
    const price = resolveProductPriceLabel(product);
    const href = `${tiendaHref}&producto=${encodeURIComponent(product?.id || '')}`;

    return `
      <a
        href="${href}"
        class="block rounded-lg border border-gray-100 overflow-hidden bg-white shadow-sm"
        data-tienda-product-id="${escapeHtml(product?.id)}"
      >
        <div class="w-full aspect-square bg-gray-100">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" class="w-full h-full object-cover" loading="lazy" />
        </div>
        <div class="px-1.5 py-1.5 text-center">
          <p class="text-[11px] leading-tight text-[#424242] font-medium min-h-[1.8rem]" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(name)}</p>
          <p class="text-[14px] leading-tight text-[#fb8500] font-semibold mt-0.5">${escapeHtml(price)}</p>
        </div>
      </a>
    `;
  }).join('');

  grid.querySelectorAll('[data-tienda-product-id]').forEach((item) => {
    const productId = item.getAttribute('data-tienda-product-id');
    bindTrackedAnchor(item, {
      idComercio,
      eventName: 'click_store_grid_product',
      source: 'web',
      municipio: comercio?.municipio || null,
      dedupeKey: `perfil:store_grid:${idComercio}:${productId}`,
      dedupeMs: 1200,
    });
  });

  section.classList.remove('hidden');
}

async function cargarGridProductosTienda(comercio = {}) {
  try {
    const section = document.getElementById('seccionProductosTienda');
    if (section) section.classList.add('hidden');

    const shouldRender = await shouldRenderStoreGrid(comercio);
    if (!shouldRender) return;

    const menus = await fetchMenusComercioTienda(idComercio);
    const menuIds = menus.map((menu) => Number(menu?.id)).filter((id) => Number.isFinite(id) && id > 0);

    let products = [];
    if (menuIds.length) {
      products = await fetchProductosTiendaByMenuIds(menuIds);
    }
    if (!products.length) {
      products = await fetchProductosTiendaByComercioFallback(idComercio);
    }
    if (!products.length) return;

    renderStoreProductsGrid(products, comercio);
  } catch (error) {
    console.error('Error cargando grid de tienda en perfilComercio:', error);
  }
}

function formatHoraPR(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-PR', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
  }).format(date);
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function resolvePerfilVideoClipRange(video) {
  const duration = toFiniteNumber(video?.duration, 0);
  const startRaw = toFiniteNumber(video?.dataset?.clipStart, 0);
  const endRaw = toFiniteNumber(video?.dataset?.clipEnd, duration);

  const safeStart = Math.max(0, startRaw);
  let safeEnd = endRaw > safeStart ? endRaw : duration;
  if (duration > 0) {
    safeEnd = Math.min(duration, safeEnd);
  }
  if (!Number.isFinite(safeEnd) || safeEnd <= safeStart) {
    safeEnd = duration > safeStart ? duration : safeStart + 0.1;
  }
  return { start: safeStart, end: safeEnd };
}

function isElementAtLeastHalfVisible(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
  const overlapW = Math.max(0, Math.min(rect.right, viewportW) - Math.max(rect.left, 0));
  const overlapH = Math.max(0, Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0));
  const visibleArea = overlapW * overlapH;
  const totalArea = rect.width * rect.height;
  if (!totalArea) return false;
  return (visibleArea / totalArea) >= 0.5;
}

function getMediaOrientation(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return 'landscape';
  }
  return h > w ? 'portrait' : 'landscape';
}

function applyFeedMediaLayout(mediaEl, orientation = 'landscape') {
  if (!(mediaEl instanceof HTMLElement)) return;
  const frame = mediaEl.closest('.lodehoy-media-frame');
  if (!frame) return;

  const isPortrait = orientation === 'portrait';
  frame.classList.toggle('lodehoy-media-frame--portrait', isPortrait);
  frame.classList.toggle('lodehoy-media-frame--landscape', !isPortrait);
  mediaEl.classList.toggle('lodehoy-media-fit-cover', isPortrait);
  mediaEl.classList.toggle('lodehoy-media-fit-contain', !isPortrait);

  if (isPortrait) {
    mediaEl.classList.add('h-full');
    mediaEl.classList.remove('h-auto');
  } else {
    mediaEl.classList.add('h-auto');
    mediaEl.classList.remove('h-full');
  }
}

function resolveAndApplyFeedMediaOrientation(mediaEl) {
  if (mediaEl instanceof HTMLImageElement) {
    const applyFromImage = () => {
      const orientation = getMediaOrientation(mediaEl.naturalWidth, mediaEl.naturalHeight);
      applyFeedMediaLayout(mediaEl, orientation);
    };

    if (mediaEl.complete && mediaEl.naturalWidth > 0) {
      applyFromImage();
    } else {
      mediaEl.addEventListener('load', applyFromImage, { once: true });
    }
    return;
  }

  if (mediaEl instanceof HTMLVideoElement) {
    const applyFromVideo = () => {
      const orientation = getMediaOrientation(mediaEl.videoWidth, mediaEl.videoHeight);
      applyFeedMediaLayout(mediaEl, orientation);
    };

    if (mediaEl.readyState >= 1 && mediaEl.videoWidth > 0) {
      applyFromVideo();
    } else {
      mediaEl.addEventListener('loadedmetadata', applyFromVideo, { once: true });
    }
  }
}

function setupPerfilPostMediaLayout() {
  const scroller = document.getElementById('publicacionesPerfilScroller');
  if (!scroller) return;
  const mediaList = scroller.querySelectorAll('[data-role="perfil-post-media"]');
  mediaList.forEach((mediaEl) => {
    applyFeedMediaLayout(mediaEl, 'landscape');
    resolveAndApplyFeedMediaOrientation(mediaEl);
  });
}

function getComercioLogoUrl(logo) {
  if (!logo) return DEFAULT_LOGO;
  if (/^https?:\/\//i.test(logo)) return logo;
  return buildStoragePublicUrl(logo) || DEFAULT_LOGO;
}

function getPerfilVideos() {
  const scroller = document.getElementById('publicacionesPerfilScroller');
  if (!scroller) return [];
  return Array.from(scroller.querySelectorAll('video[data-perfil-video="1"]'));
}

function readPerfilAudioPreference() {
  try {
    const raw = localStorage.getItem(LODEHOY_AUDIO_PREF_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch (_error) {}
  return true;
}

function savePerfilAudioPreference() {
  try {
    localStorage.setItem(LODEHOY_AUDIO_PREF_KEY, perfilAudioEnabled ? '1' : '0');
  } catch (_error) {}
}

function updatePerfilAudioButtons() {
  const buttons = document.querySelectorAll('[data-action="toggle-audio-perfil"]');
  buttons.forEach((button) => {
    const icon = button.querySelector('i');
    if (icon) {
      icon.className = perfilAudioEnabled
        ? 'fa-solid fa-volume-high text-[12px] text-emerald-700'
        : 'fa-solid fa-volume-xmark text-[12px] text-gray-700';
    }
    button.setAttribute('aria-pressed', perfilAudioEnabled ? 'true' : 'false');
    button.setAttribute('aria-label', perfilAudioEnabled ? 'Silenciar videos' : 'Activar audio de videos');
    button.classList.toggle('ring-1', perfilAudioEnabled);
    button.classList.toggle('ring-emerald-200', perfilAudioEnabled);
  });
}

function getPerfilVideoAudioControls(videoId) {
  if (!videoId) return { button: null, badge: null };
  return {
    button: document.querySelector(`button[data-action="toggle-audio-perfil"][data-video-id="${videoId}"]`),
    badge: document.querySelector(`[data-role="perfil-video-no-audio"][data-video-id="${videoId}"]`),
  };
}

function inferPerfilVideoAudio(video) {
  if (!(video instanceof HTMLVideoElement)) return { known: false, hasAudio: true };

  if (typeof video.mozHasAudio === 'boolean') {
    return { known: true, hasAudio: video.mozHasAudio };
  }

  const tracks = video.audioTracks;
  if (tracks && typeof tracks.length === 'number') {
    if (tracks.length > 0) {
      return { known: true, hasAudio: true };
    }
    if (!IS_IOS_DEVICE) {
      return { known: true, hasAudio: false };
    }
  }

  if (typeof video.webkitAudioDecodedByteCount === 'number') {
    if (video.webkitAudioDecodedByteCount > 0) {
      return { known: true, hasAudio: true };
    }
  }

  return { known: false, hasAudio: true };
}

function applyPerfilVideoAudioUI(video, { known, hasAudio }) {
  const videoId = String(video?.dataset?.postId || '').trim();
  if (!videoId) return;
  video.dataset.hasAudio = known ? (hasAudio ? '1' : '0') : 'unknown';

  const { button, badge } = getPerfilVideoAudioControls(videoId);
  if (!button && !badge) return;

  if (known && !hasAudio) {
    button?.classList.add('hidden');
    badge?.classList.remove('hidden');
    video.muted = true;
    video.defaultMuted = true;
    return;
  }

  button?.classList.remove('hidden');
  badge?.classList.add('hidden');
}

function schedulePerfilVideoAudioProbe(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  if (video.dataset.audioProbeScheduled === '1') return;
  video.dataset.audioProbeScheduled = '1';

  const runProbe = () => {
    const first = inferPerfilVideoAudio(video);
    applyPerfilVideoAudioUI(video, first);

    if (first.known) return;

    window.setTimeout(() => {
      const later = inferPerfilVideoAudio(video);
      applyPerfilVideoAudioUI(video, later);
    }, 1200);
  };

  if (video.readyState >= 1) {
    runProbe();
  } else {
    video.addEventListener('loadedmetadata', runProbe, { once: true });
  }
}

function applyPerfilAudioStateToVisibleVideos() {
  getPerfilVideos().forEach((video) => {
    const isNoAudio = video.dataset.hasAudio === '0';
    video.muted = isNoAudio ? true : !perfilAudioEnabled;
    video.defaultMuted = isNoAudio ? true : !perfilAudioEnabled;
    if (isElementAtLeastHalfVisible(video)) {
      void playPerfilVideo(video);
    }
  });
}

function bindPerfilPostActions() {
  if (perfilPostActionsBound) return;
  const scroller = document.getElementById('publicacionesPerfilScroller');
  if (!scroller) return;
  perfilPostActionsBound = true;

  scroller.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');
    if (action !== 'toggle-audio-perfil') return;

    perfilAutoplayUnlocked = true;
    perfilAudioEnabled = !perfilAudioEnabled;
    savePerfilAudioPreference();
    updatePerfilAudioButtons();
    applyPerfilAudioStateToVisibleVideos();
  });
}

function pausePerfilVideo(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  video.loop = false;
  video.pause();
}

function bindPerfilVideoClipLoop(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  if (video.dataset.clipLoopBound === '1') return;
  video.dataset.clipLoopBound = '1';
  video.loop = false;

  const ensureWindow = () => {
    const { start, end } = resolvePerfilVideoClipRange(video);
    if (video.currentTime < start || video.currentTime > end) {
      video.currentTime = start;
    }
  };

  video.addEventListener('loadedmetadata', ensureWindow);
  video.addEventListener('timeupdate', () => {
    const { start, end } = resolvePerfilVideoClipRange(video);
    if (video.currentTime >= end - 0.04) {
      video.currentTime = start;
      if (!video.paused) {
        void video.play().catch(() => {});
      }
    }
  });
}

async function playPerfilVideo(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  schedulePerfilVideoAudioProbe(video);
  bindPerfilVideoClipLoop(video);
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.autoplay = true;
  video.loop = false;

  const clip = resolvePerfilVideoClipRange(video);
  if (video.currentTime < clip.start || video.currentTime > clip.end) {
    video.currentTime = clip.start;
  }

  const isNoAudio = video.dataset.hasAudio === '0';
  video.muted = isNoAudio ? true : !perfilAudioEnabled;
  video.defaultMuted = isNoAudio ? true : !perfilAudioEnabled;
  try {
    await video.play();
  } catch (_error) {
    if (!perfilAutoplayUnlocked || perfilAudioEnabled) {
      // Fallback iOS/navegadores que bloquean autoplay con audio.
      video.muted = true;
      video.defaultMuted = true;
      try {
        await video.play();
      } catch (_errorMuted) {}
    }
  }
}

function syncPerfilViewportVideoPlayback() {
  getPerfilVideos().forEach((video) => {
    if (isElementAtLeastHalfVisible(video)) {
      void playPerfilVideo(video);
    } else {
      pausePerfilVideo(video);
    }
  });
}

function setupPerfilVideoObserver() {
  if (perfilVideoObserver) {
    perfilVideoObserver.disconnect();
    perfilVideoObserver = null;
  }

  const videos = getPerfilVideos();
  if (!videos.length) return;

  if ('IntersectionObserver' in window) {
    perfilVideoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;
        if (entry.intersectionRatio >= 0.5) {
          void playPerfilVideo(video);
        } else {
          pausePerfilVideo(video);
        }
      });
    }, {
      threshold: [0, 0.5, 1],
    });

    videos.forEach((video) => perfilVideoObserver.observe(video));
  }

  syncPerfilViewportVideoPlayback();
}

function retryVisiblePerfilVideosPlayback() {
  getPerfilVideos().forEach((video) => {
    if (isElementAtLeastHalfVisible(video)) {
      void playPerfilVideo(video);
    }
  });
}

function registerPerfilAutoplayUnlockHandlers() {
  if (perfilUnlockHandlersBound) return;
  perfilUnlockHandlersBound = true;

  const unlock = () => {
    perfilAutoplayUnlocked = true;
    perfilAudioEnabled = true;
    savePerfilAudioPreference();
    updatePerfilAudioButtons();
    applyPerfilAudioStateToVisibleVideos();
    retryVisiblePerfilVideosPlayback();
  };

  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('scroll', unlock, { once: true, passive: true });
  document.addEventListener('pointerdown', unlock, { once: true, passive: true });
}

function bindPerfilPlaybackEvents() {
  if (perfilPlaybackEventsBound) return;
  perfilPlaybackEventsBound = true;

  window.addEventListener('scroll', syncPerfilViewportVideoPlayback, { passive: true });
  window.addEventListener('resize', syncPerfilViewportVideoPlayback);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      getPerfilVideos().forEach((video) => pausePerfilVideo(video));
      return;
    }
    syncPerfilViewportVideoPlayback();
  });
}

function renderPublicacionesPerfil(publicaciones = [], comercioData = {}) {
  const section = document.getElementById('seccionPublicacionesPerfil');
  const scroller = document.getElementById('publicacionesPerfilScroller');
  const tituloSeccion = document.getElementById('tituloPublicacionesPerfil');
  if (!section || !scroller) return;
  perfilAudioEnabled = readPerfilAudioPreference();

  const nombreComercioRaw = String(comercioData.nombre || '').trim();
  if (tituloSeccion) {
    tituloSeccion.textContent = nombreComercioRaw
      ? `Lo de Hoy en ${nombreComercioRaw}`
      : 'Lo de Hoy';
  }

  if (!publicaciones.length) {
    scroller.innerHTML = '';
    if (perfilVideoObserver) {
      perfilVideoObserver.disconnect();
      perfilVideoObserver = null;
    }
    section.classList.add('hidden');
    return;
  }

  const nombreComercio = escapeHtml(comercioData.nombre || 'Comercio');
  const municipio = escapeHtml(comercioData.municipio || 'Puerto Rico');
  const logoUrlSafe = escapeHtml(getComercioLogoUrl(comercioData.logo));
  const profileUrlSafe = escapeHtml(`${window.location.origin}${isLocalEnv ? '/public' : ''}/perfilComercio.html?id=${Number(comercioData.id || 0)}`);

  scroller.innerHTML = publicaciones.map((row) => {
    const mediaUrl = escapeHtml(buildStoragePublicUrl(row.media_path));
    const titulo = escapeHtml(String(row.titulo || '').trim());
    const texto = escapeHtml(String(row.texto || '').trim());
    const hora = escapeHtml(formatHoraPR(row.created_at));
    const mediaTipo = String(row.media_tipo || '').toLowerCase();
    const clipStart = Number.isFinite(Number(row.clip_start_sec)) ? Number(row.clip_start_sec) : 0;
    const clipEnd = Number.isFinite(Number(row.clip_end_sec)) ? Number(row.clip_end_sec) : '';
    const hasAudioAttr = row.media_has_audio === true
      ? '1'
      : (row.media_has_audio === false && !IS_IOS_DEVICE ? '0' : 'unknown');
    const mediaHtml = mediaTipo === 'video'
      ? `<video class="lodehoy-media-content cursor-zoom-in" src="${mediaUrl}" controls autoplay muted playsinline webkit-playsinline preload="metadata" data-role="perfil-post-media" data-perfil-video="1" data-post-id="${row.id}" data-has-audio="${hasAudioAttr}" data-clip-start="${clipStart}" data-clip-end="${clipEnd}"></video>`
      : `<img class="lodehoy-media-content cursor-zoom-in" src="${mediaUrl}" alt="Publicación del comercio" loading="lazy" data-role="perfil-post-media">`;

    return `
      <article class="min-w-[92%] snap-center rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <header class="px-3 py-3 flex items-center gap-3">
          <button
            type="button"
            class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full"
            aria-label="Favorito del comercio"
          >
            <i class="fa-regular fa-heart text-2xl text-[#1f2937]"></i>
          </button>
          <a
            href="${profileUrlSafe}"
            class="min-w-0 flex-1 flex items-center gap-3 hover:opacity-90 transition"
            aria-label="Ver perfil de ${nombreComercio}"
          >
            <img src="${logoUrlSafe}" alt="${nombreComercio}" class="w-11 h-11 rounded-full object-cover border border-gray-200">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 truncate">${nombreComercio}</p>
              <p class="text-xs text-gray-500 truncate">${municipio}</p>
            </div>
          </a>
          <div class="ml-auto flex items-center gap-2">
            <button
              type="button"
              class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full"
              aria-label="Me gusta del comercio"
            >
              <img src="${escapeHtml(LIKE_OFF_ICON_URL)}" alt="Me gusta inactivo" class="w-8 h-8">
            </button>
            <button
              type="button"
              class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full"
              aria-label="Compartir publicación"
            >
              <img src="${escapeHtml(SHARE_ICON_URL)}" alt="Compartir" class="w-8 h-8">
            </button>
          </div>
        </header>
        <div class="lodehoy-media-frame lodehoy-media-frame--landscape bg-gray-100 flex items-center justify-center overflow-hidden relative">
          ${mediaHtml}
          ${mediaTipo === 'video' ? `
            <div class="absolute right-2 bottom-2 z-10 flex items-center gap-2">
              <span data-role="perfil-video-no-audio" data-video-id="${row.id}" class="hidden px-2 py-0.5 rounded-full bg-white/95 text-[10px] font-semibold text-gray-700 shadow-sm">
                Video sin Audio
              </span>
              <button
                type="button"
                data-action="toggle-audio-perfil"
                data-video-id="${row.id}"
                class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/95 shadow-sm border border-gray-100"
                aria-label="${perfilAudioEnabled ? 'Silenciar videos' : 'Activar audio de videos'}"
                aria-pressed="${perfilAudioEnabled ? 'true' : 'false'}"
              >
                <i class="${perfilAudioEnabled ? 'fa-solid fa-volume-high text-[12px] text-emerald-700' : 'fa-solid fa-volume-xmark text-[12px] text-gray-700'}"></i>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="px-3 py-3 border-t border-gray-100 space-y-2">
          ${titulo ? `
            <p class="text-[18px] leading-tight font-semibold text-gray-900 text-center" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${titulo}
            </p>
          ` : ''}
          ${texto ? `
            <p class="text-[16px] leading-snug font-normal text-gray-700 text-center line-clamp-3">
              ${texto}
            </p>
          ` : ''}
          <p class="text-[13px] leading-tight font-normal text-gray-500 text-center">
            Publicado: ${hora || '—'}
          </p>
        </div>
      </article>
    `;
  }).join('');

  setupPerfilPostMediaLayout();
  bindPerfilPostActions();
  updatePerfilAudioButtons();
  setupPerfilVideoObserver();
  registerPerfilAutoplayUnlockHandlers();
  bindPerfilPlaybackEvents();
  getPerfilVideos().forEach((video) => {
    bindPerfilVideoClipLoop(video);
    const hasAudioAttr = String(video.dataset.hasAudio || '').trim();
    const knownAudio = hasAudioAttr === '1' || hasAudioAttr === '0';
    const hasAudio = hasAudioAttr !== '0';
    applyPerfilVideoAudioUI(video, { known: knownAudio, hasAudio });
    if (!knownAudio) {
      schedulePerfilVideoAudioProbe(video);
    }
  });
  section.classList.remove('hidden');
}

async function cargarPublicacionesPerfil(idComercioValue, comercioData = {}) {
  const section = document.getElementById('seccionPublicacionesPerfil');
  const scroller = document.getElementById('publicacionesPerfilScroller');
  if (!section || !scroller) return;

  const nowIso = new Date().toISOString();
  let data = null;
  let error = null;

  const attempts = [
    'id,idcomercio,titulo,texto,media_path,media_tipo,media_has_audio,created_at,expira_en,clip_start_sec,clip_end_sec',
    'id,idcomercio,titulo,texto,media_path,media_tipo,created_at,expira_en,clip_start_sec,clip_end_sec',
    'id,idcomercio,titulo,texto,media_path,media_tipo,media_has_audio,created_at,expira_en',
    'id,idcomercio,titulo,texto,media_path,media_tipo,created_at,expira_en',
    'id,idcomercio,texto,media_path,media_tipo,created_at,expira_en',
  ];

  for (const columns of attempts) {
    const response = await supabase
      .from('publicaciones_hoy')
      .select(columns)
      .eq('idcomercio', idComercioValue)
      .gt('expira_en', nowIso)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!response.error) {
      data = response.data || [];
      error = null;
      break;
    }

    error = response.error;
    const message = String(response.error.message || '').toLowerCase();
    if (
      !message.includes('titulo')
      && !message.includes('media_has_audio')
      && !message.includes('clip_start_sec')
      && !message.includes('clip_end_sec')
    ) {
      break;
    }
  }

  if (error) {
    console.warn('No se pudieron cargar publicaciones para perfil del comercio:', error);
    scroller.innerHTML = '';
    section.classList.add('hidden');
    return;
  }

  renderPublicacionesPerfil(data || [], comercioData);
}

async function cargarCuponesComercio(idComercio) {
  const seccion = document.getElementById('seccionCupones');
  const contenedor = document.getElementById('cuponContainer');
  const mensaje = document.getElementById('cuponMensaje');
  const indicador = document.getElementById('cuponIndicador');
  if (!seccion || !contenedor || !mensaje) return;

  contenedor.innerHTML = '';
  mensaje.classList.add('hidden');
  seccion.classList.add('hidden');
  indicador?.classList.add('hidden');

  const ahoraISO = new Date().toISOString();
  console.log('🔎 Buscando cupones del comercio', { idComercio, ahoraISO });

  const { data: cuponesRaw, error } = await supabase
    .from('cupones')
    .select('*')
    .eq('idComercio', idComercio)
    .order('fechainicio', { ascending: false });

if (error) {
  console.error('❌ Error cargando cupones del comercio:', error);
  return;
}

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const cupones = (cuponesRaw || []).filter((cupon) => {
    const activo = cupon.activo !== false;
    const fechaFinValor = cupon.fechaFin || cupon.fechafin || null;
    const vigente = !fechaFinValor ? true : new Date(fechaFinValor).getTime() >= hoy.getTime();
    return activo && vigente;
  });

  console.log('📦 Cupones filtrados:', cupones.length);

  if (!cupones.length) {
    if ((cuponesRaw || []).length) {
      console.warn('⚠️ Se encontraron cupones pero fueron filtrados por activo/fecha.', cuponesRaw);
    } else {
      console.log('ℹ️ No hay cupones en la tabla para este comercio.');
    }
    mensaje.textContent = 'No hay cupones disponibles en este momento.';
    mensaje.classList.remove('hidden');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  console.log('Cupones del comercio:', cupones);
  console.log('Usuario actual (cupones):', user?.id);

  const cuponIds = cupones.map((c) => c.id);
  const guardadosMap = new Map();
  const totalesMap = new Map();

  if (cuponIds.length) {
    const { data: totalesData, error: totalesError } = await supabase
      .from('cuponesUsuarios')
      .select('idCupon')
      .in('idCupon', cuponIds);

    if (totalesError) {
      console.error('❌ Error obteniendo uso de cupones:', totalesError);
    } else {
      (totalesData || []).forEach((row) => {
        totalesMap.set(row.idCupon, (totalesMap.get(row.idCupon) || 0) + 1);
      });
    }
  }

  if (user && cuponIds.length) {
    const { data: guardadosData, error: guardadosError } = await supabase
      .from('cuponesUsuarios')
      .select('idCupon, codigoqr, redimido, fechaRedimido')
      .eq('idUsuario', user.id)
      .in('idCupon', cuponIds);

    if (guardadosError) {
      console.error('❌ Error consultando cupones guardados del usuario:', guardadosError);
    } else {
      (guardadosData || []).forEach((row) => {
        guardadosMap.set(row.idCupon, row);
      });
    }
  }

  contenedor.innerHTML = '';

  cupones.forEach((cupon, index) => {
    const card = document.createElement('div');
    card.className =
      'border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col justify-between bg-white min-w-[260px] max-w-[260px] h-[420px] snap-center flex-shrink-0';

    const topContent = document.createElement('div');
    topContent.className = 'flex flex-col gap-4 flex-1';
    card.appendChild(topContent);

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'relative rounded-xl overflow-hidden h-48 md:h-40';
    const img = document.createElement('img');
    img.src = cupon.imagen || CUPON_PLACEHOLDER;
    img.alt = cupon.titulo || 'Cupón';
    img.loading = 'lazy';
    img.className = 'w-full h-full object-cover';
    imgWrapper.appendChild(img);
    topContent.appendChild(imgWrapper);

    const tituloEl = document.createElement('h3');
    tituloEl.className = 'text-lg font-semibold text-[#424242] leading-tight';
    tituloEl.textContent = cupon.titulo || 'Cupón';
    topContent.appendChild(tituloEl);

    if (cupon.descripcion) {
      const descWrapper = document.createElement('div');
      descWrapper.className = 'min-h-[60px] flex items-center';
      const descEl = document.createElement('p');
      descEl.className = 'text-sm text-gray-600 leading-snug line-clamp-3';
      descEl.textContent = cupon.descripcion;
      descWrapper.appendChild(descEl);
      topContent.appendChild(descWrapper);
    }

    if (cupon.descuento != null) {
      const desc = document.createElement('p');
      desc.className = 'text-sm font-medium text-green-600';
      desc.textContent = `Descuento: ${cupon.descuento}%`;
      topContent.appendChild(desc);
    }

    const disponiblesTotal = cupon.cantidadDisponible ?? 0;
    const usados = totalesMap.get(cupon.id) || 0;
    const agotado = disponiblesTotal > 0 && usados >= disponiblesTotal;

    let estadoRow = null;
    if (disponiblesTotal > 0) {
      estadoRow = document.createElement('div');
      estadoRow.className = 'flex items-center justify-between text-xs text-gray-500';
      estadoRow.innerHTML = `<span>Disponibles: ${Math.max(disponiblesTotal - usados, 0)} de ${disponiblesTotal}</span>`;
      topContent.appendChild(estadoRow);
    }

    const footer = document.createElement('div');
    footer.className = 'flex flex-col gap-2 pt-2 border-t border-gray-100 w-full';
    card.appendChild(footer);

    const fechasEl = document.createElement('p');
    fechasEl.className = 'text-xs text-gray-500';
    const fechaFinLegible = formatearFechaLegible(cupon.fechaFin || cupon.fechafin);
    fechasEl.textContent = `Válido hasta el ${fechaFinLegible}`;
    footer.appendChild(fechasEl);

    const acciones = document.createElement('div');
    acciones.className = 'flex flex-col gap-2 w-full';

    const guardado = guardadosMap.get(cupon.id);
    console.log('Guardado encontrado:', cupon.id, guardado);

    if (guardado) {
      const estado = document.createElement('span');
      estado.className = guardado.redimido
        ? 'inline-flex items-center px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full'
        : 'inline-flex items-center px-3 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full';
      estado.textContent = guardado.redimido ? 'Redimido' : 'Ya guardado';
      acciones.appendChild(estado);
    } else if (agotado) {
      const agotadoEl = document.createElement('span');
      agotadoEl.className = 'inline-flex items-center px-3 py-1 bg-red-100 text-red-600 text-xs font-semibold rounded-full';
      agotadoEl.textContent = 'Agotado';
      acciones.appendChild(agotadoEl);
    } else {
      const btnGuardar = document.createElement('button');
      btnGuardar.type = 'button';
      btnGuardar.className = 'px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition w-full';
      btnGuardar.textContent = 'Guardar cupón';
      btnGuardar.addEventListener('click', () =>
        procesarGuardadoCupon({
          cupon,
          btnGuardar,
          acciones,
          estadoRow,
          disponiblesTotal,
          guardadosMap,
          totalesMap
        })
      );
      acciones.appendChild(btnGuardar);
    }

    footer.appendChild(acciones);
    contenedor.appendChild(card);
  });

  if (cupones.length > 1) {
    if (indicador) {
      indicador.textContent = `${cupones.length} cupones disponibles`;
      indicador.classList.remove('hidden');
    }
  } else {
    indicador?.classList.add('hidden');
  }

  seccion.classList.remove('hidden');
}

async function mostrarSucursales(idComercio, nombreComercio) {
  const { data: relaciones, error: errorRelaciones } = await supabase
    .from('ComercioSucursales')
    .select('comercio_id, sucursal_id')
    .or(`comercio_id.eq.${idComercio},sucursal_id.eq.${idComercio}`);

  if (errorRelaciones) {
    console.error('Error consultando relaciones de sucursales:', errorRelaciones);
    return;
  }

  if (!relaciones || relaciones.length === 0) return;

  const idsRelacionados = relaciones.flatMap(r => [r.comercio_id, r.sucursal_id]);
  const idsUnicos = [...new Set(idsRelacionados.filter(id => id !== parseInt(idComercio)))];

  const { data: sucursales, error: errorSucursales } = await supabase
    .from('Comercios')
    .select('id, nombre, nombreSucursal')
    .in('id', idsUnicos);

  if (errorSucursales) {
    console.error('Error consultando sucursales:', errorSucursales);
    return;
  }

  if (!sucursales || sucursales.length === 0) return;

  const contenedor = document.getElementById('listaSucursales');
  const wrapper = document.getElementById('sucursalesContainer');
  if (!contenedor || !wrapper) return;

  sucursales.forEach(sucursal => {
    const btn = document.createElement('button');
    btn.textContent = sucursal.nombreSucursal || sucursal.nombre;
    btn.className = 'px-3 py-2 m-1 bg-red-600 text-white rounded-full text-base font-medium hover:bg-red-700 transition';
    btn.onclick = () => window.location.href = `perfilComercio.html?id=${sucursal.id}`;
    contenedor.appendChild(btn);
  });

  const titulo = document.getElementById('tituloSucursales');
  if (titulo) titulo.textContent = `Otras Sucursales de ${nombreComercio}`;

  wrapper.classList.remove('hidden');
}

export async function obtenerComercioPorID(idComercio) {
  const { data, error } = await supabase
    .from('Comercios')
    .select(`
      *,
      ComercioCategorias ( idCategoria )
    `)
    .eq('id', idComercio)
    .single();

  if (error || !data) {
    console.error('Error cargando comercio:', error);
    return null;
  }

  const planInfo = resolverPlanComercio(data || {});
  if (!planInfo.permite_perfil) {
    showPopup(`
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Perfil en construcción</h3>
      <p class="text-sm text-gray-600">Este comercio aún está en el plan básico de Findixi. Muy pronto podrás ver su perfil completo.</p>
    `);
    setTimeout(() => {
      window.location.href = 'listadoComercios.html';
    }, 1600);
    return null;
  }

  const storeMode = resolveStoreMode(data);
  window.__PERFIL_COMERCIO_STORE_MODE__ = storeMode;

  document.getElementById('nombreComercio').textContent = data.nombre;
  if (data.nombreSucursal) {
    document.getElementById('nombreSucursal').textContent = data.nombreSucursal;
  }
  const tiendaOnlineInfoEl = document.getElementById('tiendaOnlineInfo');
  const tiendaOnlineWebEl = document.getElementById('tiendaOnlineWeb');
  const tiendaOnlineWebTextEl = document.getElementById('tiendaOnlineWebText');
  const tiendaFisicaInfoEl = document.getElementById('tiendaFisicaInfo');

  if (storeMode.tiendaOnline) {
    const webpageRaw = String(data.webpage || '').trim();
    const webpageHref = normalizeExternalUrl(webpageRaw);
    const webpageLabel = formatWebLabel(webpageRaw);

    if (tiendaOnlineWebEl) {
      if (webpageHref) {
        if (tiendaOnlineWebTextEl) tiendaOnlineWebTextEl.textContent = webpageLabel || webpageHref;
        tiendaOnlineWebEl.setAttribute('href', webpageHref);
        bindTrackedAnchor(tiendaOnlineWebEl, {
          idComercio,
          eventName: 'click_webpage',
          source: 'web',
          municipio: data.municipio || null,
          dedupeKey: `perfil:webpage_text:${idComercio}`,
          dedupeMs: 1500,
        });
      } else {
        if (tiendaOnlineWebTextEl) tiendaOnlineWebTextEl.textContent = 'Web no disponible';
        tiendaOnlineWebEl.removeAttribute('href');
      }
    }
    tiendaOnlineInfoEl?.classList.remove('hidden');
  } else {
    tiendaOnlineInfoEl?.classList.add('hidden');
  }

  const direccionTexto = String(data.direccion || '').trim();
  const direccionEl = document.getElementById('direccionComercio');
  const textoDireccionEl = document.getElementById('textoDireccion');
  if (storeMode.tiendaFisica) {
    tiendaFisicaInfoEl?.classList.remove('hidden');
    if (textoDireccionEl) textoDireccionEl.textContent = direccionTexto || 'Dirección no disponible';
    direccionEl?.removeAttribute('href');
    direccionEl?.classList.remove('hidden');
  } else {
    tiendaFisicaInfoEl?.classList.add('hidden');
    direccionEl?.classList.add('hidden');
  }

  // ✅ Mostrar teléfono solo si NO es categoría Jangueo (id 11)
  const esJangueo = data.ComercioCategorias?.some((c) => c.idCategoria === 11);
  const telefonoElemento = document.getElementById('telefonoComercio');

  if (!esJangueo && data.telefono) {
    const telefonoDisplay = formatearTelefonoDisplay(data.telefono);
    const telefonoHref = formatearTelefonoHref(data.telefono);
    telefonoElemento.innerHTML = `<i class="fa-solid fa-phone text-xl"></i> ${telefonoDisplay}`;
    if (telefonoHref) {
      telefonoElemento.href = telefonoHref;
      bindTrackedAnchor(telefonoElemento, {
        idComercio,
        eventName: 'click_call',
        source: 'web',
        municipio: data.municipio || null,
        dedupeKey: `perfil:call:${idComercio}`,
        dedupeMs: 1500,
        navigateAfterTrack: true,
        navigationDelayMs: 220,
      });
    } else {
      telefonoElemento.removeAttribute('href');
    }
  } else if (telefonoElemento) {
    telefonoElemento.classList.add('hidden');
  }

  document.getElementById('nombreCercanosComida').textContent = data.nombre;

  if (data.whatsapp) {
    const el = document.getElementById('linkWhatsapp');
    el?.setAttribute('href', data.whatsapp);
    bindTrackedAnchor(el, {
      idComercio,
      eventName: 'click_whatsapp',
      source: 'web',
      municipio: data.municipio || null,
      dedupeKey: `perfil:whatsapp:${idComercio}`,
      dedupeMs: 1500,
    });
  }
  if (data.facebook) {
    const el = document.getElementById('linkFacebook');
    el?.setAttribute('href', data.facebook);
    bindTrackedAnchor(el, {
      idComercio,
      eventName: 'click_facebook',
      source: 'web',
      municipio: data.municipio || null,
      dedupeKey: `perfil:facebook:${idComercio}`,
      dedupeMs: 1500,
    });
  }
  if (data.instagram) {
    const el = document.getElementById('linkInstagram');
    el?.setAttribute('href', data.instagram);
    bindTrackedAnchor(el, {
      idComercio,
      eventName: 'click_instagram',
      source: 'web',
      municipio: data.municipio || null,
      dedupeKey: `perfil:instagram:${idComercio}`,
      dedupeMs: 1500,
    });
  }
  if (data.tiktok) {
    const el = document.getElementById('linkTikTok');
    el?.setAttribute('href', data.tiktok);
    bindTrackedAnchor(el, {
      idComercio,
      eventName: 'click_tiktok',
      source: 'web',
      municipio: data.municipio || null,
      dedupeKey: `perfil:tiktok:${idComercio}`,
      dedupeMs: 1500,
    });
  }
  if (data.webpage) {
    const el = document.getElementById('linkWeb');
    const webpageHref = normalizeExternalUrl(data.webpage);
    if (webpageHref) {
      el?.setAttribute('href', webpageHref);
    }
    bindTrackedAnchor(el, {
      idComercio,
      eventName: 'click_webpage',
      source: 'web',
      municipio: data.municipio || null,
      dedupeKey: `perfil:webpage:${idComercio}`,
      dedupeMs: 1500,
    });
  }
  if (data.email) document.getElementById('linkEmail')?.setAttribute('href', `mailto:${data.email}`);

  void cargarGridProductosTienda(data);

  let logoPerfilUrl = data.logo || '';
  const { data: imagenLogo } = await supabase
    .from('imagenesComercios')
    .select('imagen')
    .eq('idComercio', idComercio)
    .eq('logo', true)
    .maybeSingle();

  if (imagenLogo?.imagen) {
    const url = supabase.storage.from('galeriacomercios').getPublicUrl(imagenLogo.imagen).data.publicUrl;
    document.getElementById('logoComercio').src = url;
    logoPerfilUrl = url;
  } else if (logoPerfilUrl) {
    document.getElementById('logoComercio').src = getComercioLogoUrl(logoPerfilUrl);
    logoPerfilUrl = getComercioLogoUrl(logoPerfilUrl);
  }

  const mapasContainer = document.getElementById('mapasContainer');
  const tiempoVehiculoEl = document.getElementById('tiempoVehiculo');
  if (storeMode.tiendaFisica && latUsuario && lonUsuario && data.latitud && data.longitud) {
    tiendaFisicaInfoEl?.classList.remove('hidden');
    mapasContainer?.classList.remove('hidden');
    tiempoVehiculoEl?.classList.remove('hidden');
    const [conTiempo] = await calcularTiemposParaLista([data], {
      lat: latUsuario,
      lon: lonUsuario
    });

    if (conTiempo?.tiempoVehiculo) {
      tiempoVehiculoEl.innerHTML = `<i class="fas fa-car"></i> ${conTiempo.tiempoVehiculo}`;
    } else {
      tiempoVehiculoEl?.classList.add('hidden');
    }

    const googleMapsURL = `https://www.google.com/maps/search/?api=1&query=${data.latitud},${data.longitud}`;
    const wazeURL = `https://waze.com/ul?ll=${data.latitud},${data.longitud}&navigate=yes`;

    document.getElementById('btnGoogleMaps').href = googleMapsURL;
    document.getElementById('btnWaze').href = wazeURL;
    bindTrackedAnchor(document.getElementById('btnGoogleMaps'), {
      idComercio,
      eventName: 'click_google_maps',
      source: 'web',
      municipio: data.municipio || null,
      dedupeKey: `perfil:gmap:${idComercio}`,
      dedupeMs: 1500,
    });
    bindTrackedAnchor(document.getElementById('btnWaze'), {
      idComercio,
      eventName: 'click_waze',
      source: 'web',
      municipio: data.municipio || null,
      dedupeKey: `perfil:waze:${idComercio}`,
      dedupeMs: 1500,
    });
  } else {
    mapasContainer?.classList.add('hidden');
    tiempoVehiculoEl?.classList.add('hidden');
  }

  if (data.tieneSucursales) await mostrarSucursales(idComercio, data.nombre);

  await cargarCuponesComercio(idComercio);
  await cargarPublicacionesPerfil(idComercio, {
    id: idComercio,
    nombre: data.nombre,
    municipio: data.municipio,
    logo: logoPerfilUrl || DEFAULT_LOGO,
  });
  await initPerfilServicios({
    idComercio,
    comercio: data,
  });

  comercioActual = data;
  void trackAnalyticsEvent({
    idComercio,
    eventName: 'view_profile',
    source: 'web',
    municipio: data.municipio || null,
    dedupeKey: `perfil:view:${idComercio}`,
    dedupeMs: 30000,
  });
  return data;
}

navigator.geolocation.getCurrentPosition(
  async (pos) => {
    latUsuario = pos.coords.latitude;
    lonUsuario = pos.coords.longitude;
    const comercio = await obtenerComercioPorID(idComercio);
    if (comercio) {
      mostrarCercanosComida(comercio);
      mostrarPlayasCercanas(comercio);
      mostrarLugaresCercanos(comercio);
    }
  },
  async () => {
    console.warn('❗ Usuario no permitió ubicación.');
    const comercio = await obtenerComercioPorID(idComercio);
    if (comercio) {
      mostrarCercanosComida(comercio);
      mostrarPlayasCercanas(comercio);
      mostrarLugaresCercanos(comercio);
    }
  }
);

window.addEventListener('lang:changed', () => {
  if (!comercioActual || comercioActual.minutosCrudos == null) return;
  const tiempo = formatTiempo(comercioActual.minutosCrudos * 60);
  document.getElementById('tiempoVehiculo').innerHTML = `<i class="fas fa-car"></i> ${tiempo}`;
});
