import { supabase } from '../shared/supabaseClient.js';
import { getLang, t, interpolate } from './i18n.js';
import { calcularTiempoEnVehiculo, getPublicBase } from '../shared/utils.js';
import { getDrivingDistance } from '../shared/osrmClient.js';
import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';
import { mostrarCargando, mostrarError } from './mensajesUI.js';
import { createGlobalBannerElement, destroyCarousel } from './bannerCarousel.js';
import { detectarMunicipioUsuario } from './detectarMunicipio.js';
import { mostrarPopupUbicacionDenegada, showPopupFavoritosVacios } from './popups.js';
import { requireAuthSilent, showAuthModal, ACTION_MESSAGES } from './authGuard.js';
import { resolverPlanComercio } from '../shared/planes.js';
import {
  buildListadoComerciosRpcPayload,
  calcularDistanciaListadoConFallback,
  formatearTiempoVehiculoLargo,
  normalizarComercioListadoDesdeRpc,
  normalizarTextoListado,
  ordenarYFiltrarListadoComercios,
} from '../shared/pkg/listado/comercios.js';

const EMOJIS_CATEGORIA = {
  "Restaurantes": "🍽️",
  "Coffee Shops": "☕",
  "Jangueo": "🍻",
  "Antojitos Dulces": "🍰",
  "Food Trucks": "🚚",
  "Dispensarios": "🚬",
  "Panadería": "🥖",
  "Bares": "🍸",
  "Playgrounds": "🛝",
};


const LIMITE_POR_PAGINA = 25;
const RADIO_DEFAULT_KM = 50;
const COORDS_FALLBACK = { lat: 18.2208, lon: -66.5901 };
const PRODUCTOS_GRID_MAX = 12;
const PRODUCT_PLACEHOLDER_URL = 'https://placehold.co/480x480?text=Producto';
const DEFAULT_LOGO_URL = getPublicBase('findixi/iconoPerfil.png');
const productSearchCache = new Map();
const distanciasRealesCache = new Map();
let refinamientoEnCurso = false;
let sugerenciasMostradas = false;

function normalizarTexto(value) {
  return normalizarTextoListado(value);
}

function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function resolveAppBase() {
  const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  return isLocal ? '/public/' : '/';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isMissingColumnErrorLite(error, expectedColumn = '') {
  if (!error) return false;
  const code = String(error.code || '').toLowerCase();
  const detail = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  if (expectedColumn && !detail.includes(expectedColumn.toLowerCase())) return false;
  return code === '42703' || code.startsWith('pgrst') || detail.includes('does not exist');
}

const TOKEN_FIXUPS = {
  balnco: 'blanco',
  blnco: 'blanco',
  blaco: 'blanco',
  vestdo: 'vestido',
  trage: 'traje',
  whte: 'white',
  drss: 'dress',
  skrt: 'skirt',
};

const TOKEN_ALIAS_GROUPS = [
  ['dress', 'vestido', 'traje', 'gown'],
  ['short', 'corto', 'mini'],
  ['long', 'largo', 'maxi'],
  ['shirt', 'camisa', 'blusa', 'top'],
  ['pants', 'pantalon', 'jeans'],
  ['skirt', 'falda'],
  ['jacket', 'chaqueta', 'abrigo'],
  ['black', 'negro'],
  ['white', 'blanco', 'ivory'],
  ['cream', 'crema', 'offwhite', 'off-white'],
  ['blue', 'azul', 'navy'],
  ['red', 'rojo', 'wine', 'burgundy'],
  ['green', 'verde', 'olive'],
  ['pink', 'rosa'],
  ['beige', 'khaki', 'camel'],
  ['heels', 'tacones', 'heels'],
  ['shoes', 'zapatos', 'tenis', 'sneakers'],
  ['bag', 'cartera', 'bolso', 'purse'],
  ['set', 'conjunto', 'matching'],
];
const ROPA_ACCESORIOS_NOMBRES = new Set([
  'ropa y accesorios',
  'ropa & accesorios',
  'tienda de ropa y accesorios',
  'clothing and accessories',
  'clothing & accessories',
]);

function expandSearchTerms(rawText = '') {
  const normalizedQuery = normalizarTexto(rawText || '');
  const baseTokens = normalizedQuery
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  const corrected = baseTokens.map((token) => TOKEN_FIXUPS[token] || token);
  const out = new Set(corrected);

  corrected.forEach((token) => {
    TOKEN_ALIAS_GROUPS.forEach((group) => {
      if (group.includes(token)) {
        group.forEach((value) => out.add(value));
      }
    });
  });

  return Array.from(out).slice(0, 8);
}

function buildMandatoryTokenGroups(rawText = '') {
  const normalizedQuery = normalizarTexto(rawText || '');
  const baseTokens = normalizedQuery
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  const correctedTokens = baseTokens.map((token) => TOKEN_FIXUPS[token] || token);
  return correctedTokens.map((token) => {
    const group = TOKEN_ALIAS_GROUPS.find((entry) => entry.includes(token));
    return group ? Array.from(new Set(group)) : [token];
  });
}

function isRopaAccesoriosCategory(slug = '', nombreCategoria = '') {
  const normalizedSlug = normalizarTexto(String(slug || '').replace(/[_-]+/g, ' '));
  const normalizedName = normalizarTexto(nombreCategoria || '');
  const slugMatch =
    normalizedSlug.includes('ropa') && normalizedSlug.includes('accesor');
  const nameMatch =
    ROPA_ACCESORIOS_NOMBRES.has(normalizedName) ||
    (normalizedName.includes('ropa') && normalizedName.includes('accesor')) ||
    (normalizedName.includes('clothing') && normalizedName.includes('accessor'));
  return slugMatch || nameMatch;
}

function getCategoriaLabelParaResumen(total = 0) {
  const categoriaLabel = estado.categoria || t('listado.titulo');
  if (!isRopaAccesoriosCategory(estado.categoriaSlug, categoriaLabel)) return categoriaLabel;
  const lang = String(getLang() || '').toLowerCase();
  if (lang.startsWith('en')) return total === 1 ? 'Store' : 'Stores';
  return total === 1 ? 'Tienda' : 'Tiendas';
}

function parseProductImageSource(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseProductImageSource);
  if (typeof value === 'object') {
    const src = value.src || value.url || value.path || value.publicUrl || value.imagen;
    return src ? [String(src).trim()] : [];
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return parseProductImageSource(parsed);
    } catch (_) {
      return [trimmed];
    }
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
  const list = candidates
    .flatMap(parseProductImageSource)
    .map((src) => String(src || '').trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

function parseMoney(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch (_) {
    return `$${n.toFixed(2)}`;
  }
}

function resolveProductPriceLabel(product = {}) {
  const textPrice = String(product?.precio_texto || '').trim();
  if (textPrice) return textPrice;
  const numberPrice = parseMoney(product?.precio);
  if (numberPrice !== null) return formatMoney(numberPrice);
  return '';
}

function resolveLogoUrl(logoValue = '') {
  const raw = String(logoValue || '').trim();
  if (!raw) return DEFAULT_LOGO_URL;
  if (/^https?:\/\//i.test(raw)) return raw;
  return getPublicBase(`galeriacomercios/${raw.replace(/^\/+/, '')}`);
}

function buildTextSearchExpression(searchTerms = []) {
  const terms = (searchTerms || []).map((term) => String(term || '').trim()).filter(Boolean);
  if (!terms.length) return '';
  const clauses = [];
  terms.forEach((term) => {
    clauses.push(`nombre.ilike.%${term}%`);
    clauses.push(`descripcion.ilike.%${term}%`);
  });
  return clauses.join(',');
}

async function obtenerIdsComerciosPorMenus(textoRaw) {
  const termino = typeof textoRaw === 'string' ? textoRaw.trim() : '';
  if (termino.length < 3) return [];

  const terms = expandSearchTerms(termino);
  const effectiveTerms = terms.length ? terms : [normalizarTexto(termino)];
  const orExpression = effectiveTerms.map((term) => `titulo.ilike.%${term}%`).join(',');

  try {
    const idColumns = ['idComercio', 'idcomercio'];
    for (const idColumn of idColumns) {
      const { data, error } = await supabase
        .from('menus')
        .select(idColumn)
        .or(orExpression);
      if (error) {
        if (isMissingColumnErrorLite(error, idColumn)) continue;
        console.error('Error buscando menús por texto:', error);
        return [];
      }
      const ids = Array.isArray(data)
        ? data
            .map((item) => (item?.[idColumn] != null ? Number(item[idColumn]) : null))
            .filter((id) => Number.isFinite(id))
        : [];
      return [...new Set(ids)];
    }
    return [];
  } catch (error) {
    console.error('Error obteniendo comercios por menús:', error);
    return [];
  }
}

function formatearTextoLargo(minutosTotales) {
  return formatearTiempoVehiculoLargo(minutosTotales);
}

function obtenerIdCategoriaDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('idCategoria');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function obtenerModoScopeAllDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const raw = String(params.get('scope') || '').trim().toLowerCase();
  return raw === 'all';
}

const idCategoriaDesdeURL = obtenerIdCategoriaDesdeURL();
const abrirListadoCompleto = obtenerModoScopeAllDesdeURL();

function obtenerEtiquetaListadoCompleto() {
  return t('home.quickComercios');
}

function estaEnModoCategoriaFija() {
  return idCategoriaDesdeURL != null;
}

function syncFiltroLabelsHeight() {
  const labels = Array.from(document.querySelectorAll('.filtro-label-sync'));
  if (!labels.length) return;

  labels.forEach((label) => {
    label.style.minHeight = '';
  });

  const maxHeight = labels.reduce((max, label) => Math.max(max, label.offsetHeight), 0);
  if (!maxHeight) return;

  labels.forEach((label) => {
    label.style.minHeight = `${maxHeight}px`;
  });
}

function syncToggleLabelsHeight() {
  const labels = Array.from(document.querySelectorAll('.toggle-label-sync'));
  if (!labels.length) return;

  labels.forEach((label) => {
    label.style.minHeight = '';
  });

  const maxHeight = labels.reduce((max, label) => Math.max(max, label.offsetHeight), 0);
  if (!maxHeight) return;

  labels.forEach((label) => {
    label.style.minHeight = `${maxHeight}px`;
  });
}

const estado = {
  categoria: '',
  categoriaObj: null,
  categoriaSlug: '',
  categorias: [],
  subcategorias: [],
  subcategoriaSeleccionadaId: '',
  filtros: {
    textoBusqueda: '',
    municipio: '',
    municipioDetectado: '',
    categoria: '',
    subcategoria: '',
    orden: 'ubicacion',
    abiertoAhora: false,
    favoritos: false,
    destacadosPrimero: true,
    comerciosPorPlato: [],
    comerciosPorMenus: [],
    productosRelacionados: [],
  },
  coordsUsuario: null,
  tienePermisoUbicacion: false,
  ordenSeleccionManual: false,
  favoritosUsuarioSet: new Set(),
  lista: [],
  offset: 0,
  ultimoFetchCount: 0,
  municipioSeleccionadoManualmente: false,
  usarMunicipioDetectado: true,
  comerciosBase: [],
  comerciosFiltrados: [],
};

if (idCategoriaDesdeURL != null) {
  estado.filtros.categoria = String(idCategoriaDesdeURL);
}

if (abrirListadoCompleto) {
  estado.filtros.categoria = '';
  estado.filtros.municipio = '';
  estado.filtros.municipioDetectado = '';
  estado.usarMunicipioDetectado = false;
  estado.filtros.subcategoria = '';
  estado.subcategoriaSeleccionadaId = '';
}

if (typeof window !== 'undefined') {
  window.__estadoListadoComercios = estado;
}

// Re-render categorías / textos cuando cambia el idioma
window.addEventListener('lang:changed', () => {
  estado.categoria = !estaEnModoCategoriaFija()
    ? obtenerEtiquetaListadoCompleto()
    : getCategoriaLabelPorIdioma();
  actualizarEtiquetaSubcategoria(estado.categoria);
  if (!estaEnModoCategoriaFija()) {
    if (estado.filtros.categoria) {
      aplicarCategoriaSeleccionadaUI(estado.filtros.categoria);
    } else {
      const titulo = getElement('tituloCategoria');
      if (titulo) {
        titulo.setAttribute('data-i18n', 'home.quickComercios');
        titulo.textContent = obtenerEtiquetaListadoCompleto();
      }
      aplicarModoListadoCompletoUI();
    }
    renderSubcategoriasDropdown();
  }
  if (estaEnModoCategoriaFija()) {
    renderSubcategoriasDropdown();
  }
  const base = estado.comerciosFiltrados.length ? estado.comerciosFiltrados : estado.lista;
  renderListado(base, { omitRefinamiento: true, skipFilter: true });
  requestAnimationFrame(syncFiltroLabelsHeight);
  requestAnimationFrame(syncToggleLabelsHeight);
});

window.addEventListener('resize', () => {
  requestAnimationFrame(syncFiltroLabelsHeight);
  requestAnimationFrame(syncToggleLabelsHeight);
});

function setOrden(valor) {
  estado.filtros.orden = valor;
  const select = getElement('filtro-orden');
  if (select && select.value !== valor) {
    select.value = valor;
  }
}

function desactivarSwitchFavoritos() {
  const el = getElement('filtro-favoritos');
  if (el) {
    el.checked = false;
  }
  estado.filtros.favoritos = false;
}

function obtenerReferenciaUsuarioParaCalculos() {
  if (!estado.tienePermisoUbicacion) return null;
  const lat = Number(estado.coordsUsuario?.lat);
  const lon = Number(estado.coordsUsuario?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }
  return null;
}

let contenedorListado = null;
let filtrosDiv = null;
let bannerFinalContainer = null;
let verMasContainer = null;
let mensajesContainer = null;
let searchProductsSection = null;
let searchProductsTitle = null;
let searchProductsGrid = null;

function getElement(id) {
  return document.getElementById(id);
}

function resolveSearchText(key) {
  const lang = getLang();
  const dict = {
    es: {
      title: 'Productos relacionados',
      subtitle: 'coincidencias',
      view: 'Ver tienda',
      noPrice: 'Ver detalles',
    },
    en: {
      title: 'Related products',
      subtitle: 'matches',
      view: 'View store',
      noPrice: 'View details',
    },
  };
  const pack = dict[lang] || dict.es;
  return pack[key] || dict.es[key] || '';
}

function ensureSearchProductsDom() {
  if (!searchProductsSection) searchProductsSection = getElement('searchProductsSection');
  if (!searchProductsTitle) searchProductsTitle = getElement('searchProductsTitle');
  if (!searchProductsGrid) searchProductsGrid = getElement('searchProductsGrid');
}

function hideSearchProductsGrid() {
  ensureSearchProductsDom();
  if (!searchProductsSection || !searchProductsGrid) return;
  searchProductsGrid.innerHTML = '';
  if (searchProductsTitle) searchProductsTitle.textContent = '';
  searchProductsSection.classList.add('hidden');
}

function toProductImageUrl(raw = '') {
  const src = String(raw || '').trim();
  if (!src) return PRODUCT_PLACEHOLDER_URL;
  if (/^https?:\/\//i.test(src)) return src;
  return getPublicBase(`galeriacomercios/${src.replace(/^\/+/, '')}`);
}

function buildComercioLookup() {
  const map = new Map();
  const source = [
    ...(Array.isArray(estado.comerciosFiltrados) ? estado.comerciosFiltrados : []),
    ...(Array.isArray(estado.lista) ? estado.lista : []),
    ...(Array.isArray(estado.comerciosBase) ? estado.comerciosBase : []),
  ];

  source.forEach((comercio) => {
    const id = Number(comercio?.id);
    if (!Number.isFinite(id)) return;
    if (map.has(id)) return;
    map.set(id, {
      id,
      nombre: String(comercio?.nombre || 'Comercio').trim() || 'Comercio',
      logo: resolveLogoUrl(comercio?.logo || comercio?.logo_url || ''),
    });
  });

  return map;
}

function scoreProductMatch(product = {}, searchQuery = '', searchTerms = []) {
  const name = normalizarTexto(product?.nombre || product?.title || '');
  const desc = normalizarTexto(product?.descripcion || product?.description || '');
  const full = `${name} ${desc}`.trim();
  const phrase = normalizarTexto(searchQuery);
  if (!full || !phrase) return 0;

  let score = 0;
  if (name.includes(phrase)) score += 55;
  else if (full.includes(phrase)) score += 28;

  searchTerms.forEach((term) => {
    if (!term || term.length < 2) return;
    if (name.includes(term)) score += 14;
    else if (desc.includes(term)) score += 7;
    else if (full.includes(term)) score += 4;
  });

  const tokens = phrase.split(/\s+/).filter(Boolean);
  if (tokens.length && name.startsWith(tokens[0])) score += 8;
  return score;
}

function matchesMandatoryGroups(product = {}, mandatoryGroups = []) {
  if (!Array.isArray(mandatoryGroups) || !mandatoryGroups.length) return true;
  const name = normalizarTexto(product?.nombre || product?.title || '');
  const desc = normalizarTexto(product?.descripcion || product?.description || '');
  const full = `${name} ${desc}`.trim();
  if (!full) return false;

  return mandatoryGroups.every((group) => {
    if (!Array.isArray(group) || !group.length) return true;
    return group.some((alias) => alias && full.includes(alias));
  });
}

async function fetchMenusByCommerceIds(comercioIds = []) {
  const ids = Array.from(new Set((comercioIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0))).slice(0, 450);
  if (!ids.length) return [];

  const idColumns = ['idComercio', 'idcomercio'];
  for (const column of idColumns) {
    const result = await supabase
      .from('menus')
      .select(`id,${column}`)
      .in(column, ids);

    if (!result.error) {
      return Array.isArray(result.data) ? result.data : [];
    }
    if (!isMissingColumnErrorLite(result.error, column)) {
      console.warn('Error cargando menús por comercio en búsqueda de productos:', result.error);
      return [];
    }
  }

  return [];
}

async function queryProductosPorColumna({
  column,
  ids = [],
  orExpression = '',
  nameOnlyExpression = '',
} = {}) {
  if (!column || !ids.length || !orExpression) return [];

  let result = await supabase
    .from('productos')
    .select('*')
    .in(column, ids)
    .or(orExpression)
    .order('id', { ascending: false })
    .limit(220);

  if (!result.error) {
    return Array.isArray(result.data) ? result.data : [];
  }

  const errorText = String(result.error?.message || result.error?.details || '').toLowerCase();
  if (errorText.includes('descripcion') && nameOnlyExpression) {
    result = await supabase
      .from('productos')
      .select('*')
      .in(column, ids)
      .or(nameOnlyExpression)
      .order('id', { ascending: false })
      .limit(220);
    if (!result.error) return Array.isArray(result.data) ? result.data : [];
  }

  if (!isMissingColumnErrorLite(result.error, column)) {
    console.warn('Error buscando productos por columna', column, result.error);
  }
  return [];
}

async function buscarProductosRelacionados(searchQuery = '') {
  const raw = String(searchQuery || '').trim();
  if (raw.length < 3) return [];

  const normalized = normalizarTexto(raw);
  if (!normalized) return [];
  if (productSearchCache.has(normalized)) return productSearchCache.get(normalized);

  const searchTerms = expandSearchTerms(normalized);
  const mandatoryGroups = buildMandatoryTokenGroups(normalized);
  const effectiveTerms = searchTerms.length ? searchTerms : [normalized];
  const nameOnlyExpression = effectiveTerms.map((term) => `nombre.ilike.%${term}%`).join(',');
  const orExpression = buildTextSearchExpression(effectiveTerms) || nameOnlyExpression;

  const contextComercioIds = Array.from(new Set((estado.comerciosBase || [])
    .map((c) => Number(c?.id))
    .filter((id) => Number.isFinite(id) && id > 0)));
  const menus = await fetchMenusByCommerceIds(contextComercioIds);
  const menuIdToComercio = new Map();
  const menuIds = [];
  menus.forEach((menu) => {
    const menuId = Number(menu?.id);
    const comercioId = Number(menu?.idComercio ?? menu?.idcomercio);
    if (!Number.isFinite(menuId)) return;
    menuIds.push(menuId);
    if (Number.isFinite(comercioId)) {
      menuIdToComercio.set(menuId, comercioId);
    }
  });

  const rows = [];
  const seenRowIds = new Set();

  const pushRows = (list = []) => {
    list.forEach((row) => {
      const rowId = row?.id ?? `${row?.nombre || ''}-${row?.idMenu || row?.idmenu || ''}`;
      const key = String(rowId);
      if (seenRowIds.has(key)) return;
      seenRowIds.add(key);
      rows.push(row);
    });
  };

  if (menuIds.length) {
    const listByMenu = await queryProductosPorColumna({
      column: 'idMenu',
      ids: menuIds,
      orExpression,
      nameOnlyExpression,
    });
    pushRows(listByMenu);

    const listByMenuFallback = await queryProductosPorColumna({
      column: 'idmenu',
      ids: menuIds,
      orExpression,
      nameOnlyExpression,
    });
    pushRows(listByMenuFallback);
  }

  if (contextComercioIds.length) {
    const listByComercio = await queryProductosPorColumna({
      column: 'idComercio',
      ids: contextComercioIds,
      orExpression,
      nameOnlyExpression,
    });
    pushRows(listByComercio);

    const listByComercioFallback = await queryProductosPorColumna({
      column: 'idcomercio',
      ids: contextComercioIds,
      orExpression,
      nameOnlyExpression,
    });
    pushRows(listByComercioFallback);
  }

  if (!rows.length) {
    let globalLookup = await supabase
      .from('productos')
      .select('*')
      .or(orExpression)
      .order('id', { ascending: false })
      .limit(180);

    if (globalLookup.error) {
      const errText = String(globalLookup.error?.message || globalLookup.error?.details || '').toLowerCase();
      if (errText.includes('descripcion')) {
        globalLookup = await supabase
          .from('productos')
          .select('*')
          .or(nameOnlyExpression)
          .order('id', { ascending: false })
          .limit(180);
      }
    }

    if (!globalLookup.error) {
      pushRows(Array.isArray(globalLookup.data) ? globalLookup.data : []);
    }
  }

  const missingMenuIds = Array.from(new Set(rows
    .map((row) => Number(row?.idMenu ?? row?.idmenu))
    .filter((id) => Number.isFinite(id) && !menuIdToComercio.has(id)))).slice(0, 400);

  if (missingMenuIds.length) {
    const menuCommerceCols = ['idComercio', 'idcomercio'];
    for (const commerceCol of menuCommerceCols) {
      const menusLookup = await supabase
        .from('menus')
        .select(`id,${commerceCol}`)
        .in('id', missingMenuIds);
      if (menusLookup.error) {
        if (isMissingColumnErrorLite(menusLookup.error, commerceCol)) continue;
        break;
      }
      (Array.isArray(menusLookup.data) ? menusLookup.data : []).forEach((menu) => {
        const menuId = Number(menu?.id);
        const commerceId = Number(menu?.[commerceCol]);
        if (Number.isFinite(menuId) && Number.isFinite(commerceId)) {
          menuIdToComercio.set(menuId, commerceId);
        }
      });
      break;
    }
  }

  const normalizedProducts = rows
    .map((product) => {
      const directId = Number(product?.idComercio ?? product?.idcomercio);
      const menuId = Number(product?.idMenu ?? product?.idmenu);
      const idComercio = Number.isFinite(directId)
        ? directId
        : (Number.isFinite(menuId) ? menuIdToComercio.get(menuId) : null);

      if (!Number.isFinite(idComercio)) return null;
      if (product?.activo === false) return null;
      if (!matchesMandatoryGroups(product, mandatoryGroups)) return null;

      const score = scoreProductMatch(product, normalized, effectiveTerms);
      if (score <= 0) return null;

      const images = resolveProductImages(product);
      return {
        ...product,
        idComercio,
        score,
        image: toProductImageUrl(images[0] || ''),
        priceLabel: resolveProductPriceLabel(product),
        name: String(product?.nombre || product?.title || 'Producto').trim() || 'Producto',
        description: String(product?.descripcion || product?.description || '').trim(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.id || 0) - Number(a.id || 0);
    });

  const top = normalizedProducts.slice(0, 40);
  productSearchCache.set(normalized, top);
  return top;
}

function renderProductosRelacionados() {
  ensureSearchProductsDom();
  if (!searchProductsSection || !searchProductsGrid) return;

  const textoBusqueda = String(estado.filtros.textoBusqueda || '').trim();
  const products = Array.isArray(estado.filtros.productosRelacionados)
    ? estado.filtros.productosRelacionados
    : [];

  if (textoBusqueda.length < 3 || !products.length) {
    hideSearchProductsGrid();
    return;
  }

  const comercioLookup = buildComercioLookup();
  const visibleProducts = products
    .map((product) => {
      const idComercio = Number(product?.idComercio);
      if (!Number.isFinite(idComercio)) return null;
      const comercio = comercioLookup.get(idComercio);
      if (!comercio) return null;
      return { product, comercio };
    })
    .filter(Boolean)
    .slice(0, PRODUCTOS_GRID_MAX);

  if (!visibleProducts.length) {
    hideSearchProductsGrid();
    return;
  }

  const title = `${resolveSearchText('title')} (${visibleProducts.length} ${resolveSearchText('subtitle')})`;
  if (searchProductsTitle) searchProductsTitle.textContent = title;

  const returnTo = encodeURIComponent(
    `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`
  );

  searchProductsGrid.innerHTML = visibleProducts.map(({ product, comercio }) => {
    const productId = encodeURIComponent(String(product?.id ?? ''));
    const href = `${resolveAppBase()}tienda/tiendaComercio.html?idComercio=${encodeURIComponent(comercio.id)}&source=listado&producto=${productId}&returnTo=${returnTo}`;
    const price = escapeHtml(product.priceLabel || resolveSearchText('noPrice'));
    return `
      <a href="${href}" class="search-product-card">
        <div class="w-full aspect-square bg-gray-100">
          <img src="${escapeHtml(product.image || PRODUCT_PLACEHOLDER_URL)}" alt="${escapeHtml(product.name)}" class="w-full h-full object-cover" loading="lazy" />
        </div>
        <div class="px-1.5 py-1.5 text-center">
          <div class="flex items-center justify-center gap-1.5 mb-1">
            <img src="${escapeHtml(comercio.logo)}" alt="Logo ${escapeHtml(comercio.nombre)}" class="search-product-store-logo" loading="lazy" />
            <p class="text-[11px] leading-tight text-gray-500 font-medium" style="display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;">
              ${escapeHtml(comercio.nombre)}
            </p>
          </div>
          <p class="text-[11px] leading-tight text-[#424242] font-medium min-h-[1.8rem]" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            ${escapeHtml(product.name)}
          </p>
          <p class="text-[14px] leading-tight text-[#fb8500] font-semibold mt-0.5">${price}</p>
        </div>
      </a>
    `;
  }).join('');

  searchProductsSection.classList.remove('hidden');
}

async function actualizarBusquedaPorTexto(texto) {
  const termino = typeof texto === 'string' ? texto.trim() : '';
  estado.filtros.textoBusqueda = termino;

  if (termino.length < 3) {
    estado.filtros.comerciosPorPlato = [];
    estado.filtros.comerciosPorMenus = [];
    estado.filtros.productosRelacionados = [];
    return;
  }

  const [productosRelacionados, idsPorMenus] = await Promise.all([
    buscarProductosRelacionados(termino),
    obtenerIdsComerciosPorMenus(termino),
  ]);

  const idsPorProductos = Array.from(new Set((productosRelacionados || [])
    .map((product) => Number(product?.idComercio))
    .filter((id) => Number.isFinite(id))));

  estado.filtros.comerciosPorPlato = idsPorProductos;
  estado.filtros.comerciosPorMenus = idsPorMenus;
  estado.filtros.productosRelacionados = productosRelacionados;
}

function cleanupCarousels(container) {
  if (!container) return;
  container.querySelectorAll('[data-banner-carousel="true"]').forEach(destroyCarousel);
}

function resetSugerencias() {
  sugerenciasMostradas = false;
  document.querySelectorAll('.bloque-sugerencias').forEach((nodo) => nodo.remove());
}

async function renderTopBanner() {
  const seccionFiltros = document.querySelector('section.p-4');
  if (!seccionFiltros) return;

  let topContainer = document.querySelector('[data-banner-slot="top-app"]');
  if (!topContainer) {
    topContainer = document.createElement('div');
    topContainer.dataset.bannerSlot = 'top-app';
    seccionFiltros.parentNode?.insertBefore(topContainer, seccionFiltros);
  } else {
    cleanupCarousels(topContainer);
    topContainer.innerHTML = '';
  }

  const banner = await createGlobalBannerElement({ intervalMs: 8000, slotName: 'banner-top' });
  if (banner) {
    topContainer.appendChild(banner);
    topContainer.classList.remove('hidden');
  } else {
    topContainer.classList.add('hidden');
  }
}

async function crearBannerElemento(slotName = 'banner-inline') {
  try {
    return await createGlobalBannerElement({ intervalMs: 8000, slotName });
  } catch (error) {
    console.error('Error creando banner global:', error);
    return null;
  }
}

async function renderBannerInferior() {
  if (!bannerFinalContainer) {
    bannerFinalContainer = document.createElement('div');
    bannerFinalContainer.id = 'bannerFinalListado';
    contenedorListado?.parentNode?.appendChild(bannerFinalContainer);
  }
  cleanupCarousels(bannerFinalContainer);
  bannerFinalContainer.innerHTML = '';
  const banner = await crearBannerElemento('banner-bottom');
  if (banner) {
    bannerFinalContainer.appendChild(banner);
  }
}

async function cargarNombreCategoria() {
  if (idCategoriaDesdeURL == null) return;
  try {
    const lang = getLang();
    const colMap = {
      es: 'nombre_es',
      en: 'nombre_en',
      zh: 'nombre_zh',
      fr: 'nombre_fr',
      pt: 'nombre_pt',
      de: 'nombre_de',
      it: 'nombre_it',
      ko: 'nombre_ko',
      ja: 'nombre_ja',
    };
    const col = colMap[lang] || 'nombre_es';

    const { data, error } = await supabase
      .from('Categorias')
      .select(`id, nombre, slug, icono, nombre_es, nombre_en, nombre_zh, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_ko, nombre_ja, ${col}`)
      .eq('id', idCategoriaDesdeURL)
      .single();
    if (error || !data) return;

    const titulo = getElement('tituloCategoria');
    const icono = getElement('iconoCategoria');
    const input = getElement('filtro-nombre');
    const nombreCat = data[col] || data.nombre_es || data.nombre;

    if (titulo) titulo.textContent = nombreCat;
    if (icono && data.icono) {
      if (data.icono.startsWith('<i')) {
        icono.innerHTML = data.icono;
      } else {
        icono.innerHTML = `<i class="fas ${data.icono}"></i>`;
      }
    }
    if (input) {
      input.placeholder = interpolate(t('listado.buscarEn'), { categoria: nombreCat });
    }

    actualizarEtiquetaSubcategoria(nombreCat);
    estado.categoria = nombreCat || '';
    estado.categoriaSlug = data.slug || '';
    estado.categoriaObj = data;
  } catch (err) {
    console.error('Error cargando categoría:', err);
  }
}

function aplicarModoListadoCompletoUI() {
  if (estaEnModoCategoriaFija()) return;

  estado.categoria = obtenerEtiquetaListadoCompleto();

  const titulo = getElement('tituloCategoria');
  if (titulo) {
    titulo.setAttribute('data-i18n', 'home.quickComercios');
    titulo.textContent = estado.categoria;
  }

  const input = getElement('filtro-nombre');
  if (input) {
    input.placeholder = interpolate(t('listado.buscarEn'), { categoria: estado.categoria });
  }

  actualizarEtiquetaSubcategoria(estado.categoria);
}

function getCategoriaLabelPorIdioma() {
  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es').toLowerCase();
  const col = `nombre_${lang}`;
  const c = estado.categoriaObj || {};
  return c[col] || c.nombre_es || c.nombre || estado.categoria || '';
}

function obtenerCategoriaDesdeEstadoPorId(idCategoria) {
  const idNum = Number(idCategoria);
  if (!Number.isFinite(idNum)) return null;
  return (estado.categorias || []).find((cat) => Number(cat?.id) === idNum) || null;
}

function aplicarCategoriaSeleccionadaUI(idCategoria) {
  if (estaEnModoCategoriaFija()) return;

  const titulo = getElement('tituloCategoria');
  const icono = getElement('iconoCategoria');
  const input = getElement('filtro-nombre');
  const categoria = obtenerCategoriaDesdeEstadoPorId(idCategoria);

  if (!categoria) {
    estado.categoriaObj = null;
    estado.categoriaSlug = '';
    aplicarModoListadoCompletoUI();
    if (icono) {
      icono.innerHTML = '<i class="fas fa-utensils"></i>';
    }
    return;
  }

  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es').toLowerCase();
  const col = `nombre_${lang}`;
  const nombreCat = categoria?.[col] || categoria?.nombre_es || categoria?.nombre || t('home.quickComercios');

  estado.categoriaObj = categoria;
  estado.categoriaSlug = categoria.slug || '';
  estado.categoria = nombreCat;

  if (titulo) {
    titulo.removeAttribute('data-i18n');
    titulo.textContent = nombreCat;
  }
  if (icono && categoria.icono) {
    if (categoria.icono.startsWith('<i')) {
      icono.innerHTML = categoria.icono;
    } else {
      icono.innerHTML = `<i class="fas ${categoria.icono}"></i>`;
    }
  }
  if (input) {
    input.placeholder = interpolate(t('listado.buscarEn'), { categoria: nombreCat });
  }
}

function actualizarEtiquetaSubcategoria(nombreCategoria) {
  const label = document.querySelector('label[for="filtro-subcategoria"]');
  if (!label) return;
  if (!estaEnModoCategoriaFija()) {
    label.textContent = t('listadoLugares.categorias');
    return;
  }
  const slug = (estado.categoriaSlug || '').toLowerCase();
  if (slug === 'restaurantes' || slug === 'food_trucks') {
    label.textContent = t('listado.tipoDeComida');
  } else if (nombreCategoria) {
    label.textContent = interpolate(t('listado.tipoDe'), { categoria: nombreCategoria });
  } else {
    label.textContent = interpolate(t('listado.tipoDe'), { categoria: t('listado.titulo') });
  }
}

async function cargarMunicipios() {
  const select = getElement('filtro-municipio');
  if (!select) return;
  try {
    const { data, error } = await supabase.from('Municipios').select('id, nombre').order('nombre');
    if (error) throw error;
    data?.forEach((m) => {
      const option = document.createElement('option');
      option.value = m.nombre;
      option.textContent = m.nombre;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Error cargando municipios:', err);
  }
}

async function cargarSubcategorias(idCategoria) {
  const select = getElement('filtro-subcategoria');
  if (!select || !idCategoria) return;
  try {
    const { data, error } = await supabase
      .from('subCategoria')
      .select(`
        id,
        nombre,
        nombre_es,
        nombre_en,
        nombre_fr,
        nombre_pt,
        nombre_de,
        nombre_it,
        nombre_zh,
        nombre_ko,
        nombre_ja
      `)
      .eq('idCategoria', idCategoria);
    if (error) throw error;
    estado.subcategorias = Array.isArray(data) ? data : [];
    renderSubcategoriasDropdown();
  } catch (err) {
    console.error('Error cargando subcategorías:', err);
  }
}

async function cargarCategoriasParaFiltro() {
  const select = getElement('filtro-subcategoria');
  if (!select || estaEnModoCategoriaFija()) return;
  try {
    const { data, error } = await supabase
      .from('Categorias')
      .select('id, nombre, slug, icono, nombre_es, nombre_en, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_zh, nombre_ko, nombre_ja')
      .order('nombre');
    if (error) throw error;
    estado.categorias = Array.isArray(data) ? data : [];
    renderSubcategoriasDropdown();
  } catch (err) {
    console.error('Error cargando categorías para filtro:', err);
  }
}

function renderSubcategoriasDropdown(subs = estado.subcategorias) {
  const select = getElement('filtro-subcategoria');
  if (!select) return;
  const current = select.value || estado.subcategoriaSeleccionadaId || estado.filtros.subcategoria || '';
  const optionAll = !estaEnModoCategoriaFija() ? t('eventos.todasCategorias') : t('listado.todas');
  select.innerHTML = `<option value="">${optionAll}</option>`;

  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es').toLowerCase();
  const col = `nombre_${lang}`;
  if (estaEnModoCategoriaFija()) {
    subs.forEach((sub) => {
      const option = document.createElement('option');
      option.value = sub.id;
      const label = sub?.[col] || sub?.nombre_es || sub?.nombre || '';
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = current;
    estado.filtros.subcategoria = select.value;
    estado.subcategoriaSeleccionadaId = select.value;
  } else {
    (estado.categorias || []).forEach((cat) => {
      const option = document.createElement('option');
      option.value = String(cat.id);
      const label = cat?.[col] || cat?.nombre_es || cat?.nombre || '';
      option.textContent = label;
      select.appendChild(option);
    });
    const categoriaActual = estado.filtros.categoria || '';
    select.value = categoriaActual || '';
  }
}

function normalizarComercio(record, referencia = obtenerReferenciaUsuarioParaCalculos()) {
  const refUsuario = obtenerReferenciaUsuarioParaCalculos();
  const ref = refUsuario || referencia;
  return normalizarComercioListadoDesdeRpc(record, { referencia: ref });
}

function obtenerCategoriaLabelTarjeta(comercio = {}) {
  const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    if (typeof value === 'string') {
      const txt = value.trim();
      if (!txt) return [];
      if (
        (txt.startsWith('{') && txt.endsWith('}')) ||
        (txt.startsWith('[') && txt.endsWith(']'))
      ) {
        const inner = txt.slice(1, -1).trim();
        if (!inner) return [];
        return inner.split(',').map((v) => v.trim()).filter(Boolean);
      }
      if (txt.includes(',')) return txt.split(',').map((v) => v.trim()).filter(Boolean);
      return [txt];
    }
    return [value];
  };

  const parseNumeric = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const categoriaIds = new Set();
  toArray(comercio?.idCategoria).forEach((id) => {
    const num = parseNumeric(id);
    if (num != null) categoriaIds.add(num);
  });
  toArray(comercio?.categoriasId).forEach((id) => {
    const num = parseNumeric(id);
    if (num != null) categoriaIds.add(num);
  });

  if (Array.isArray(comercio?.ComercioCategorias)) {
    comercio.ComercioCategorias.forEach((rel) => {
      const maybeId = rel?.idCategoria ?? rel?.idcategoria ?? rel?.id_categoria ?? rel?.categoria?.id;
      const num = parseNumeric(maybeId);
      if (num != null) categoriaIds.add(num);
    });
  }

  if (categoriaIds.size > 0 && Array.isArray(estado.categorias) && estado.categorias.length > 0) {
    const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es').toLowerCase();
    const col = `nombre_${lang}`;
    const labels = Array.from(categoriaIds)
      .map((id) => estado.categorias.find((cat) => Number(cat?.id) === id))
      .filter(Boolean)
      .map((cat) => (cat?.[col] || cat?.nombre_es || cat?.nombre || '').trim())
      .filter(Boolean);
    if (labels.length > 0) {
      return Array.from(new Set(labels)).join(', ');
    }
  }

  const candidates = [
    comercio?.categoriaDisplay,
    comercio?.categoria_nombre,
    comercio?.categoriaNombre,
    comercio?.categoriaPrincipal,
    comercio?.categoria,
    Array.isArray(comercio?.categoriaNombres) ? comercio.categoriaNombres.join(', ') : '',
    Array.isArray(comercio?.categoriasNombre) ? comercio.categoriasNombre.join(', ') : '',
    Array.isArray(comercio?.categorias) ? comercio.categorias.join(', ') : '',
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const text = candidate.trim();
    if (!text) continue;
    return text;
  }
  return '';
}

function insertarCategoriaBajoNombre(cardNode, comercio = {}) {
  if (estaEnModoCategoriaFija()) return;
  if (!cardNode) return;

  const categoria = obtenerCategoriaLabelTarjeta(comercio);
  if (!categoria) return;

  cardNode.querySelector('.comercio-categoria-card')?.remove();

  const nombreContainer =
    cardNode.querySelector('a > div.relative.h-12.w-full') ||
    cardNode.querySelector('div.relative.h-12.w-full') ||
    cardNode.querySelector('h3')?.closest('div.relative');
  if (!nombreContainer) return;

  const categoriaEl = document.createElement('p');
  categoriaEl.className =
    'comercio-categoria-card -mt-1 mb-1 px-2 text-center text-[12px] font-medium text-[#6b7280] leading-tight truncate';
  categoriaEl.textContent = categoria;

  nombreContainer.insertAdjacentElement('afterend', categoriaEl);
}

async function obtenerFavoritosSet() {
  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user?.id) return new Set();

    const { data, error } = await supabase
      .from('favoritosusuarios')
      .select('idcomercio')
      .eq('idusuario', user.id);
    if (error) throw error;

    const favoritosSet = new Set();
    data?.forEach((registro) => {
      const id = registro?.idcomercio;
      if (id == null) return;
      favoritosSet.add(id);
      favoritosSet.add(String(id));
    });
    return favoritosSet;
  } catch (error) {
    console.warn('⚠️ No se pudieron cargar favoritos del usuario:', error?.message || error);
    return new Set();
  }
}

async function obtenerCoordenadasUsuario() {
  if (typeof navigator === 'undefined' || !navigator?.geolocation) {
    return estado.coordsUsuario || null;
  }
  try {
    const coords = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          }),
        (error) => {
          if (error && error.code === error.PERMISSION_DENIED) {
            mostrarPopupUbicacionDenegada();
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
    if (coords) {
      estado.coordsUsuario = coords;
      estado.tienePermisoUbicacion = true;
      if (!estado.ordenSeleccionManual) {
        setOrden('ubicacion');
      }
      return coords;
    }
  } catch (error) {
    console.warn('⚠️ No se pudo obtener la ubicación del usuario:', error?.message || error);
  }
  estado.tienePermisoUbicacion = false;
  estado.coordsUsuario = null;
  if (!estado.ordenSeleccionManual) {
    setOrden('az');
  }
  return estado.coordsUsuario || null;
}

async function solicitarUbicacionForzada() {
  if (typeof navigator === 'undefined' || !navigator?.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        estado.coordsUsuario = coords;
        estado.tienePermisoUbicacion = true;
        resolve(coords);
      },
      () => {
        estado.tienePermisoUbicacion = false;
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function recalcularDistancias(lat, lon) {
  if (!Array.isArray(estado.lista) || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
  estado.lista = estado.lista.map((comercio) => {
    const distanciaKm = calcularDistanciaListadoConFallback(comercio, { lat, lon });
    const tiempoData =
      Number.isFinite(distanciaKm) && distanciaKm >= 0 ? calcularTiempoEnVehiculo(distanciaKm) : { texto: 'N/D', minutos: null };
    const tiempoTexto = formatearTextoLargo(
      Number.isFinite(tiempoData.minutos) ? tiempoData.minutos : null
    );
    return {
      ...comercio,
      distanciaKm: Number.isFinite(distanciaKm) ? distanciaKm : null,
      tiempoVehiculo: tiempoTexto,
      tiempoTexto,
      minutosCrudos: Number.isFinite(tiempoData.minutos) ? tiempoData.minutos : null,
    };
  });
}

async function ordenarYRenderizar(modo) {
  setOrden(modo);
  await renderListado();
}

async function asegurarOrdenCercania({ forzarPopup = false } = {}) {
  if (
    estado.tienePermisoUbicacion &&
    Number.isFinite(estado.coordsUsuario?.lat) &&
    Number.isFinite(estado.coordsUsuario?.lon)
  ) {
    return true;
  }

  if (typeof navigator === 'undefined' || !navigator?.geolocation) {
    return false;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        estado.coordsUsuario = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };
        estado.tienePermisoUbicacion = true;
        setOrden('ubicacion');
        resolve(true);
      },
      (error) => {
        if (error && error.code === error.PERMISSION_DENIED) {
          mostrarPopupUbicacionDenegada(forzarPopup);
        }
        estado.tienePermisoUbicacion = false;
        estado.coordsUsuario = null;
        setOrden('az');
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

async function asegurarMunicipioInicial() {
  if (estado.filtros.municipio?.trim()) return;
  const lat = Number(estado.coordsUsuario?.lat);
  const lon = Number(estado.coordsUsuario?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  try {
    const municipioDetectado = await detectarMunicipioUsuario({ lat, lon });
    if (!municipioDetectado) return;

    estado.filtros.municipio = municipioDetectado;
    estado.filtros.municipioDetectado = municipioDetectado;
    estado.municipioSeleccionadoManualmente = false;
    estado.usarMunicipioDetectado = true;
    try {
      localStorage.setItem('municipioUsuario', municipioDetectado);
    } catch (_) {
      /* noop */
    }

    const select = getElement('filtro-municipio');
    if (select) {
      const existe = Array.from(select.options || []).some((opt) => opt.value === municipioDetectado);
      if (!existe) {
        const option = document.createElement('option');
        option.value = municipioDetectado;
        option.textContent = municipioDetectado;
        select.appendChild(option);
      }
      select.value = municipioDetectado;
    }
  } catch (error) {
    console.warn('⚠️ No se pudo asignar municipio inicial:', error?.message || error);
  }
}

function construirPayloadRPC() {
  const filtros = estado.filtros;
  return buildListadoComerciosRpcPayload({
    textoBusqueda: filtros.textoBusqueda,
    municipio: filtros.municipio,
    municipioDetectado: filtros.municipioDetectado,
    municipioSeleccionadoManualmente: estado.municipioSeleccionadoManualmente,
    usarMunicipioDetectado: estado.usarMunicipioDetectado,
    categoria: filtros.categoria,
    subcategoria: filtros.subcategoria,
    abiertoAhora: filtros.abiertoAhora,
    coordsUsuario: estado.coordsUsuario,
    tienePermisoUbicacion: estado.tienePermisoUbicacion,
    limit: LIMITE_POR_PAGINA,
    offset: estado.offset,
  });
}

async function ejecutarRPC(payload, referenciaDistancia = obtenerReferenciaUsuarioParaCalculos()) {
  const { data, error } = await supabase.rpc('buscar_comercios_filtrados', payload);
  if (error) throw error;
  return (data || []).map((record) => normalizarComercio(record, referenciaDistancia));
}

async function enriquecerSucursales(lista = []) {
  const ids = Array.from(
    new Set(
      (lista || [])
        .map((c) => c?.id)
        .filter((id) => id !== null && id !== undefined && id !== '')
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    )
  );
  if (ids.length === 0) return lista;

  let data = null;
  try {
    const { data: rows, error } = await supabase
      .from('Comercios')
      .select('id, nombreSucursal, tieneSucursales')
      .in('id', ids);
    if (error) throw error;
    data = rows;
  } catch (err) {
    const { data: fallback, error: fallbackError } = await supabase
      .from('Comercios')
      .select('id, nombreSucursal')
      .in('id', ids);
    if (fallbackError) {
      console.warn('⚠️ No se pudo enriquecer sucursales:', fallbackError);
      return lista;
    }
    data = fallback;
  }

  if (!Array.isArray(data) || data.length === 0) return lista;

  const map = new Map(data.map((row) => [String(row.id), row]));
  return (lista || []).map((comercio) => {
    const extra = map.get(String(comercio?.id));
    if (!extra) return comercio;

    const merged = { ...comercio };
    if (typeof extra.nombreSucursal === 'string' && extra.nombreSucursal.trim() !== '') {
      merged.nombreSucursal = extra.nombreSucursal.trim();
    }
    if (extra.sucursal !== undefined) merged.sucursal = extra.sucursal;
    if (extra.esSucursal !== undefined) merged.esSucursal = extra.esSucursal;
    if (extra.es_sucursal !== undefined) merged.es_sucursal = extra.es_sucursal;

    const tieneFlag =
      merged.sucursal !== undefined ||
      merged.esSucursal !== undefined ||
      merged.es_sucursal !== undefined;
    if (!tieneFlag && merged.nombreSucursal) {
      merged.sucursal = true;
    }

    return merged;
  });
}

async function enriquecerCategoriasComercios(lista = []) {
  const ids = Array.from(
    new Set(
      (lista || [])
        .map((c) => Number(c?.id))
        .filter((id) => Number.isFinite(id))
    )
  );
  if (!ids.length) return lista;

  let relaciones = [];
  try {
    const { data, error } = await supabase
      .from('ComercioCategorias')
      .select(`
        idComercio,
        idCategoria,
        categoria:Categorias (
          id,
          nombre,
          nombre_es,
          nombre_en,
          nombre_fr,
          nombre_pt,
          nombre_de,
          nombre_it,
          nombre_zh,
          nombre_ko,
          nombre_ja
        )
      `)
      .in('idComercio', ids);
    if (error) throw error;
    relaciones = Array.isArray(data) ? data : [];
  } catch (err) {
    try {
      const { data, error } = await supabase
        .from('ComercioCategorias')
        .select('idcomercio,idcategoria')
        .in('idcomercio', ids);
      if (error) throw error;
      relaciones = Array.isArray(data) ? data : [];
    } catch (fallbackErr) {
      console.warn('⚠️ No se pudieron enriquecer categorías de comercios:', fallbackErr?.message || fallbackErr);
      return lista;
    }
  }

  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es').toLowerCase();
  const col = `nombre_${lang}`;
  const categoriasMap = new Map((estado.categorias || []).map((cat) => [Number(cat?.id), cat]));
  const porComercio = new Map();

  relaciones.forEach((rel) => {
    const comercioId = Number(rel?.idComercio ?? rel?.idcomercio);
    const categoriaId = Number(rel?.idCategoria ?? rel?.idcategoria ?? rel?.id_categoria ?? rel?.categoria?.id);
    if (!Number.isFinite(comercioId) || !Number.isFinite(categoriaId)) return;

    const categoriaRel = rel?.categoria || categoriasMap.get(categoriaId) || null;
    const nombre =
      (categoriaRel?.[col] || categoriaRel?.nombre_es || categoriaRel?.nombre || '').trim();

    const current = porComercio.get(comercioId) || { ids: new Set(), nombres: new Set() };
    current.ids.add(categoriaId);
    if (nombre) current.nombres.add(nombre);
    porComercio.set(comercioId, current);
  });

  return (lista || []).map((comercio) => {
    const comercioId = Number(comercio?.id);
    const catInfo = porComercio.get(comercioId);
    if (!catInfo) return comercio;

    const categoriaIds = Array.from(catInfo.ids);
    const categoriaNombres = Array.from(catInfo.nombres);
    const categoriaDisplay = categoriaNombres.join(', ');

    return {
      ...comercio,
      categoriaIds,
      categoriaNombres,
      categoriasNombre: categoriaNombres,
      categoriaDisplay: categoriaDisplay || comercio?.categoriaDisplay || '',
      idCategoria: categoriaIds,
    };
  });
}

function ordenarLocalmente(lista) {
  const referencia = obtenerReferenciaUsuarioParaCalculos();
  return ordenarYFiltrarListadoComercios(lista, {
    orden: estado.filtros.orden,
    favoritos: estado.filtros.favoritos,
    destacadosPrimero: estado.filtros.destacadosPrimero,
    abiertoAhora: estado.filtros.abiertoAhora,
    favoritosSet: estado.favoritosUsuarioSet,
    referencia,
  });
}

function ensureMensajesContainer() {
  const existente = document.getElementById('mensajesContainer');
  if (existente) {
    mensajesContainer = existente;
  }
  if (!mensajesContainer) {
    mensajesContainer = document.createElement('div');
    mensajesContainer.id = 'mensajesContainer';
    mensajesContainer.className = 'text-center mb-6';
  }
  if (!mensajesContainer.parentNode && contenedorListado?.parentNode) {
    contenedorListado.parentNode.insertBefore(mensajesContainer, contenedorListado);
  }
  if (mensajesContainer) {
    mensajesContainer.innerHTML = '';
  }
  return mensajesContainer;
}

function limpiarMensajesPrevios() {
  const existente = document.getElementById('mensajesContainer');
  if (existente) existente.remove();
  mensajesContainer = null;
}

async function renderListado(lista = estado.lista, { omitRefinamiento = false, skipFilter = false } = {}) {
  resetSugerencias();
  await renderTopBanner();

  filtrosDiv = filtrosDiv || getElement('filtros-activos');
  if (filtrosDiv) {
    filtrosDiv.innerHTML = '';
    filtrosDiv.className = 'text-center mt-3';
    document.querySelectorAll('#filtros-activos .bg-gray-100').forEach((el) => el.remove());
  }

  contenedorListado.className = contenedorListado?.dataset?.layoutOriginal || contenedorListado.className;
  cleanupCarousels(contenedorListado);
  contenedorListado.innerHTML = '';

  const listaOrdenada = ordenarLocalmente(lista);
  console.log('[main] renderizado final:', listaOrdenada.length, 'tarjetas');

  let filtrados = skipFilter ? [...lista] : [...listaOrdenada];

  const textoBusquedaRaw = estado.filtros.textoBusqueda?.trim() || '';
  const hayBusquedaNombre = textoBusquedaRaw.length >= 3;
  const textoNormalizado = hayBusquedaNombre ? normalizarTexto(textoBusquedaRaw) : '';
  const idsPorProductos = Array.isArray(estado.filtros.comerciosPorPlato)
    ? estado.filtros.comerciosPorPlato
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    : [];
  const idsPorMenus = Array.isArray(estado.filtros.comerciosPorMenus)
    ? estado.filtros.comerciosPorMenus
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    : [];

  if (!skipFilter && hayBusquedaNombre) {
    const idsPorNombre = filtrados
      .filter((c) => {
        const nombre = normalizarTexto(c.nombre || '');
        return nombre.includes(textoNormalizado);
      })
      .map((c) => c.id);
    const idsCombinados = new Set([...idsPorNombre, ...idsPorProductos, ...idsPorMenus]);
    filtrados = filtrados.filter((c) => idsCombinados.has(c.id));
  } else if (!skipFilter && (idsPorProductos.length > 0 || idsPorMenus.length > 0)) {
    const idsSet = new Set([...idsPorProductos, ...idsPorMenus]);
    filtrados = filtrados.filter((c) => idsSet.has(c.id));
  }

  const hayBusquedaPlato = idsPorProductos.length > 0 || idsPorMenus.length > 0;

  if (!skipFilter && estado.filtros.municipio && !hayBusquedaNombre && !hayBusquedaPlato) {
    filtrados = filtrados.filter((c) => c.pueblo === estado.filtros.municipio);
  }

  if (!skipFilter && estado.filtros.subcategoria) {
    const subcategoriaFiltro = Number(estado.filtros.subcategoria);
    if (Number.isFinite(subcategoriaFiltro)) {
      filtrados = filtrados.filter(
        (c) =>
          Array.isArray(c.subcategoriaIds) && c.subcategoriaIds.includes(subcategoriaFiltro)
      );
    }
  }

  if (!skipFilter && estado.filtros.abiertoAhora) {
    filtrados = filtrados.filter((c) => c.abierto === true || c.abiertoAhora === true);
  }

  if (!skipFilter && estado.filtros.favoritos) {
    filtrados = filtrados.filter((c) => c.favorito === true);
  }

  estado.comerciosFiltrados = filtrados;
  renderProductosRelacionados();
  const categoriaNombre = getCategoriaLabelPorIdioma() || t('listado.titulo');
  estado.categoria = categoriaNombre;
  const total = filtrados.length;
  const municipioActivo = estado.filtros.municipio || '';
  const hayComerciosEnMunicipio = municipioActivo
    ? listaOrdenada.some(
        (c) => normalizarTexto(c.pueblo || '') === normalizarTexto(municipioActivo || '')
      )
    : listaOrdenada.length > 0;

  if (total === 0) {
    await mostrarMensajeSinResultados({
      categoriaNombre,
      municipioActivo,
      textoBusqueda: hayBusquedaNombre ? textoBusquedaRaw : '',
      hayComerciosEnMunicipio,
    });
    await renderBannerInferior();
    renderVerMasButton(false);
    return;
  }

  limpiarMensajesPrevios();

  let municipioUsuario = '';
  try {
    municipioUsuario = localStorage.getItem('municipioUsuario') || '';
  } catch (_) {
    municipioUsuario = '';
  }

  const esUbicacionActual =
    municipioActivo &&
    municipioUsuario &&
    municipioActivo.toLowerCase() === municipioUsuario.toLowerCase();

  const textoResultados = (() => {
    const categoriaLabel = getCategoriaLabelParaResumen(total);
    return interpolate(t('listado.resultadosSinMunicipio'), {
      n: total,
      categoria: categoriaLabel,
    });
  })();

  const resumenEl = getElement('textoResultadosListado');
  if (resumenEl) resumenEl.textContent = textoResultados;
  const searchInput = getElement('filtro-nombre');
  if (searchInput) {
    const categoriaLabel = estado.categoria || t('listado.titulo');
    searchInput.placeholder = interpolate(t('listado.buscarEn'), { categoria: categoriaLabel });
  }

  // Luego de la primera carga, no seguir aplicando municipio detectado automáticamente
  if (estado.usarMunicipioDetectado) {
    estado.usarMunicipioDetectado = false;
  }

  const wrapChip = document.getElementById('chipMunicipioWrap');
  if (wrapChip) {
    wrapChip.innerHTML = '';
    if (municipioActivo && !hayBusquedaNombre) {
      const btnEliminar = document.createElement('button');
      btnEliminar.innerHTML = `✕ ${municipioActivo}`;
      btnEliminar.className =
        'bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full hover:bg-blue-200 transition-all';
      btnEliminar.addEventListener('click', () => {
        estado.filtros.municipio = '';
        estado.municipioSeleccionadoManualmente = false;
        const selectMunicipio = getElement('filtro-municipio');
        if (selectMunicipio) selectMunicipio.value = '';
        cargarComercios({ append: false });
      });
      wrapChip.appendChild(btnEliminar);
    }
  }

    const fragment = document.createDocumentFragment();
  let cartasEnFila = 0;
  let totalFilas = 0;

    for (let i = 0; i < filtrados.length; i++) {
      const comercio = filtrados[i];
    const card = comercio.activo === true
      ? cardComercio(comercio)
      : cardComercioNoActivo(comercio);
    insertarCategoriaBajoNombre(card, comercio);
    card.dataset.comercioId = comercio.id;
    const infoNodes = card.querySelectorAll('.flex.justify-center.items-center.gap-1');
    // limpiar cualquier string previo de tiempo, se renderiza dentro de la card con i18n
    fragment.appendChild(card);
    cartasEnFila += 1;

      const esUltimaCarta = i === filtrados.length - 1;
    const filaCompleta = cartasEnFila === 2 || esUltimaCarta;

    if (filaCompleta) {
      totalFilas += 1;
      cartasEnFila = 0;

      const debeInsertarIntermedio = totalFilas % 4 === 0 && !esUltimaCarta;
      if (debeInsertarIntermedio) {
        const bannerIntermedio = await crearBannerElemento('banner-inline');
        if (bannerIntermedio) fragment.appendChild(bannerIntermedio);
      }
    }
  }

  contenedorListado.appendChild(fragment);
  renderVerMasButton(estado.ultimoFetchCount === LIMITE_POR_PAGINA);
  await renderBannerInferior();
  if (!omitRefinamiento) {
    refinarDistanciasReales(filtrados);
  }
}

async function mostrarMensajeSinResultados({
  categoriaNombre,
  municipioActivo,
  textoBusqueda = '',
  hayComerciosEnMunicipio = false,
}) {
  document.querySelectorAll('.mensaje-no-resultados, .sugerencias-cercanas').forEach((el) => el.remove());

  const categoria = categoriaNombre || 'Comercios';
  const mensajesNode = ensureMensajesContainer();
  if (!mensajesNode) return;

    const esBusquedaManual =
    Boolean(municipioActivo) && municipioActivo !== estado.filtros.municipioDetectado;
  const textoBusquedaLimpio = typeof textoBusqueda === 'string' ? textoBusqueda.trim() : '';
  const tieneBusquedaTexto = textoBusquedaLimpio.length > 0;

  let mensajePrincipal = '';
  if (tieneBusquedaTexto) {
    mensajePrincipal = `No se encontraron ${categoria.toLowerCase()} con \"${textoBusquedaLimpio}\".`;
  } else {
    mensajePrincipal = esBusquedaManual
      ? `No se encontraron ${categoria.toLowerCase()} en el municipio seleccionado.`
      : `No se encontraron ${categoria.toLowerCase()} en tu ubicación actual.`;
  }

  const mensajeBase = document.createElement('div');
  mensajeBase.className = 'mensaje-no-resultados text-center mt-6 mb-4 px-4';
  mensajeBase.innerHTML = `<p class="text-gray-700 font-medium mb-3">${mensajePrincipal}</p>`;
  mensajesNode.appendChild(mensajeBase);

  // Botón de limpiar municipio se omite en el mensaje de no resultados para evitar duplicar textos.

  const debeUsarMunicipio = Boolean(municipioActivo) && !hayComerciosEnMunicipio;
  const encabezadoSugerencia = hayComerciosEnMunicipio
    ? `Te podría interesar estos ${categoria.toLowerCase()} cerca de ti.`
    : `${categoria} cerca de ${municipioActivo || 'tu zona'}:`;
  const subtextoSugerencia = hayComerciosEnMunicipio
    ? ''
    : 'Mostrando resultados cercanos...';

  await mostrarSugerenciasCercanas({
    categoria,
    municipioActivo,
    esBusquedaManual: debeUsarMunicipio ? esBusquedaManual : false,
    encabezado: encabezadoSugerencia,
    subtexto: subtextoSugerencia,
  });
  sugerenciasMostradas = true;
}

async function obtenerCoordsMunicipio(nombre) {
  try {
    const { data, error } = await supabase
      .from('Municipios')
      .select('latitud, longitud')
      .eq('nombre', nombre)
      .maybeSingle();
    if (error) throw error;
    if (data?.latitud != null && data?.longitud != null) {
      return { lat: data.latitud, lon: data.longitud };
    }
  } catch (err) {
    console.warn('⚠️ No se pudieron cargar coordenadas del municipio:', err?.message || err);
  }
  return null;
}

export async function fetchCercanosParaCoordenadas({
  latitud,
  longitud,
  radioKm = 10,
  categoriaOpcional = null,
  abiertoAhora = null,
  incluirInactivos = false,
} = {}) {
  const lat = Number(latitud);
  const lon = Number(longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

  const payload = {
    p_texto: null,
    p_municipio: null,
    p_categoria:
      categoriaOpcional !== null && categoriaOpcional !== undefined
        ? Number(categoriaOpcional)
        : null,
    p_subcategoria: null,
    p_activo: incluirInactivos ? null : true,
    p_latitud: lat,
    p_longitud: lon,
    p_radio: Number.isFinite(radioKm) ? radioKm : 10,
    p_limit: 30,
    p_offset: 0,
    p_abierto_ahora: typeof abiertoAhora === 'boolean' ? abiertoAhora : null,
  };

  try {
    const { data, error } = await supabase.rpc('buscar_comercios_filtrados', payload);
    if (error) throw error;
    const referencia = { lat, lon };
    const normalizados = (Array.isArray(data) ? data : []).map((record) =>
      normalizarComercio(record, referencia)
    );
    return normalizados.filter((c) => resolverPlanComercio(c).aparece_en_cercanos);
  } catch (error) {
    console.error('❌ Error en fetchCercanosParaCoordenadas:', error);
    return [];
  }
}

async function obtenerCercanosReferencia(referencia, { limit = 10, radioKm = 15 } = {}) {
  if (
    !referencia ||
    !Number.isFinite(referencia?.lat) ||
    !Number.isFinite(referencia?.lon)
  ) {
    return [];
  }

  const abiertoAhora = estado.filtros.abiertoAhora ? true : null;
  return fetchCercanosParaCoordenadas({
    latitud: referencia.lat,
    longitud: referencia.lon,
    radioKm,
    limite: limit,
    categoriaOpcional: estado.filtros.categoria ? Number(estado.filtros.categoria) : null,
    abiertoAhora,
  });
}

async function mostrarSugerenciasCercanas({
  categoria,
  municipioActivo,
  esBusquedaManual,
  encabezado,
  subtexto,
}) {
  if (sugerenciasMostradas) return;
  if (document.querySelector('.bloque-sugerencias')) return;
  try {
    const coordsUsuario = await obtenerCoordenadasUsuario();
    let referenciaBusqueda = coordsUsuario || obtenerReferenciaUsuarioParaCalculos();

    if (esBusquedaManual && municipioActivo) {
      const coordsMunicipio = await obtenerCoordsMunicipio(municipioActivo);
      if (coordsMunicipio) {
        referenciaBusqueda = coordsMunicipio;
      }
    }

    if (
      !referenciaBusqueda ||
      !Number.isFinite(referenciaBusqueda?.lat) ||
      !Number.isFinite(referenciaBusqueda?.lon)
    ) {
      return;
    }

    const cercanos = await obtenerCercanosReferencia(referenciaBusqueda, { limit: 10, radioKm: 15 });
    if (cercanos.length > 0) {
      const etiquetaMunicipio = municipioActivo || 'tu ubicación';
      const bloque = document.createElement('div');
      bloque.className = 'bloque-sugerencias sugerencias-cercanas text-center mt-8 mb-4';
      const heading = encabezado
        ? `<h3 class="text-lg font-semibold text-gray-800 mb-1">${encabezado}</h3>`
        : `
        <h3 class="text-lg font-semibold text-gray-800 mb-1">
          ${categoria} cerca de <span class="text-[#3ea6c4]">${etiquetaMunicipio}</span>:
        </h3>`;
      const helper = subtexto
        ? `<p class="text-sm text-gray-600 italic mb-4">${subtexto}</p>`
        : '<p class="text-sm text-gray-600 italic mb-4">Mostrando resultados cercanos...</p>';
      bloque.innerHTML = `${heading}${helper}`;
      mensajesContainer?.appendChild(bloque);
      sugerenciasMostradas = true;

      cercanos.slice(0, 10).forEach((comercio) => {
        const card = comercio.activo === true
          ? cardComercio(comercio)
          : cardComercioNoActivo(comercio);
        insertarCategoriaBajoNombre(card, comercio);
        card.dataset.comercioId = comercio.id;
        const infoNodes = card.querySelectorAll('.flex.justify-center.items-center.gap-1');
        if (infoNodes.length) {
          const tiempoNode = infoNodes[infoNodes.length - 1];
          tiempoNode.dataset.tiempoAuto = 'true';
          tiempoNode.innerHTML = `
            <i class="fas fa-car"></i>
            ${comercio.tiempoVehiculo || comercio.tiempoTexto || 'N/D'}
          `;
        }
        contenedorListado.appendChild(card);
      });
    } else {
      const sinCercanos = document.createElement('p');
      sinCercanos.className = 'text-gray-600 mt-4 italic';
      sinCercanos.textContent = `Tampoco se encontraron ${categoria.toLowerCase()} cercanos a ${
        municipioActivo || 'tu ubicación'
      }.`;
      mensajesContainer?.appendChild(sinCercanos);
    }
  } catch (error) {
    console.error('❌ Error mostrando comercios cercanos:', error);
  }
}

function renderVerMasButton(debeMostrar) {
  if (!verMasContainer) {
    verMasContainer = document.createElement('div');
    verMasContainer.id = 'verMasResultados';
    verMasContainer.className = 'w-full flex justify-center my-6';
    contenedorListado?.parentNode?.appendChild(verMasContainer);
  }
  verMasContainer.innerHTML = '';
  if (!debeMostrar) {
    verMasContainer.classList.add('hidden');
    return;
  }
  verMasContainer.classList.remove('hidden');
  const boton = document.createElement('button');
  boton.className =
    'px-4 py-2 rounded-full bg-[#023047] text-white text-sm font-semibold shadow hover:bg-[#023047] transition';
  boton.textContent = '🔽 Ver siguientes';
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    boton.textContent = 'Cargando...';
    try {
      await cargarComercios({ append: true, mostrarLoader: false });
    } finally {
      boton.disabled = false;
      boton.textContent = '🔽 Ver siguientes';
    }
  });
  verMasContainer.appendChild(boton);
}

async function cargarComercios({ append = false, mostrarLoader = true } = {}) {
  if (!append) {
    estado.offset = 0;
    if (mostrarLoader && contenedorListado) {
      const emoji = EMOJIS_CATEGORIA[estado.categoria] || "🍽️";
      mostrarCargando(contenedorListado, 'Cargando comercios...', emoji);
    }
  }

  const payload = construirPayloadRPC();
  try {
    const [datos, favoritosSet] = await Promise.all([ejecutarRPC(payload), obtenerFavoritosSet()]);

    // Si hay búsqueda por texto, reforzar resultados con los comercios que coincidan por productos/menús
    const textoBusqueda = (estado.filtros.textoBusqueda || '').trim();
    const hayBusquedaNombre = textoBusqueda.length >= 3;
    let datosRefuerzo = [];
    if (hayBusquedaNombre) {
      const idsExtra = new Set([
        ...(estado.filtros.comerciosPorPlato || []),
        ...(estado.filtros.comerciosPorMenus || []),
      ]
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id)));

      // Solo pedir refuerzo si hay ids que puedan no venir por texto
      if (idsExtra.size > 0) {
        const payloadRefuerzo = {
          ...payload,
          p_texto: null,
          p_municipio: null,
          p_latitud: null,
          p_longitud: null,
          p_radio: null,
          p_limit: 200,
          p_offset: 0,
        };
        const refuerzo = await ejecutarRPC(payloadRefuerzo);
        datosRefuerzo = refuerzo.filter((c) => idsExtra.has(Number(c.id)));
      }
    }

    // Dedupe por id
    const baseMap = new Map();
    [...datos, ...datosRefuerzo].forEach((c) => {
      if (!baseMap.has(c.id)) baseMap.set(c.id, c);
    });
    let base = Array.from(baseMap.values());
    base = await enriquecerSucursales(base);
    base = await enriquecerCategoriasComercios(base);

    const datosConFavoritos = base.map((comercio) => {
      const esFavorito =
        comercio.favorito === true ||
        favoritosSet.has(comercio.id) ||
        favoritosSet.has(String(comercio.id));
      if (comercio.favorito === esFavorito) return comercio;
      return { ...comercio, favorito: esFavorito };
    });
    const resultado = datosConFavoritos;
    estado.ultimoFetchCount = datosConFavoritos.length;
    if (append) {
      estado.comerciosBase = [...estado.comerciosBase, ...datosConFavoritos];
      estado.lista = [...estado.comerciosBase];
      estado.offset += datosConFavoritos.length;
    } else {
      estado.comerciosBase = datosConFavoritos;
      estado.lista = [...estado.comerciosBase];
      estado.offset = datosConFavoritos.length;
    }
    await renderListado(estado.lista, { omitRefinamiento: false });
  } catch (error) {
    console.error('❌ Error cargando comercios:', error);
    if (!append && contenedorListado) {
      mostrarError(contenedorListado, 'No pudimos cargar los comercios.', '⚠️');
    }
  }
}

function actualizarTarjetaDOM(id, { tiempoTexto }) {
  const card = contenedorListado?.querySelector(`[data-comercio-id="${id}"]`);
  if (!card) return;
  const infoNodes = card.querySelectorAll('.flex.justify-center.items-center.gap-1');
  if (!infoNodes.length) return;
  const tiempoNode = infoNodes[infoNodes.length - 1];
  tiempoNode.dataset.tiempoAuto = 'true';
  tiempoNode.innerHTML = `
    <i class="fas fa-car"></i>
    ${tiempoTexto || 'N/D'}
  `;
}

async function refinarDistanciasReales(lista) {
  if (refinamientoEnCurso) return;
  const coords = estado.coordsUsuario;
  if (!Number.isFinite(coords?.lat) || !Number.isFinite(coords?.lon)) return;
  const visibles = Array.isArray(lista) ? lista.slice(0, 10) : [];
  if (!visibles.length) return;

  refinamientoEnCurso = true;
  let requiereReorden = false;

  for (const comercio of visibles) {
    const cache = distanciasRealesCache.get(comercio.id);
    let refinado = cache;

    if (!refinado) {
      try {
        const resultado = await getDrivingDistance(
          { lat: coords.lat, lng: coords.lon },
          { lat: comercio.latitud, lng: comercio.longitud }
        );
        if (resultado?.duracion != null && resultado?.distancia != null) {
          const distanciaKm = resultado.distancia / 1000;
          const minutosTotales = Math.round(resultado.duracion / 60);
          refinado = {
            distanciaKm,
            tiempoTexto: formatearTextoLargo(minutosTotales),
            minutos: minutosTotales,
          };
          distanciasRealesCache.set(comercio.id, refinado);
        }
      } catch (error) {
        console.warn('⚠️ OSRM falló para comercio', comercio.id, error?.message || error);
      }
    }

    if (!refinado) continue;

    const distanciaOriginal = comercio.distanciaKm;
    comercio.distanciaKm = refinado.distanciaKm;
    comercio.tiempoVehiculo = refinado.tiempoTexto;
    comercio.tiempoTexto = refinado.tiempoTexto;
    comercio.minutosCrudos = refinado.minutos;
    actualizarTarjetaDOM(comercio.id, refinado);

    if (
      Number.isFinite(distanciaOriginal) &&
      Number.isFinite(refinado.distanciaKm) &&
      distanciaOriginal > 0
    ) {
      const diferencia = Math.abs(refinado.distanciaKm - distanciaOriginal) / distanciaOriginal;
      if (diferencia > 0.15) {
        requiereReorden = true;
      }
    }
  }

  refinamientoEnCurso = false;

  if (requiereReorden) {
    estado.lista = ordenarLocalmente(
      estado.lista.map((comercio) => {
        const refinado = distanciasRealesCache.get(comercio.id);
        if (refinado) {
          return {
            ...comercio,
            distanciaKm: refinado.distanciaKm,
            tiempoVehiculo: refinado.tiempoTexto,
            tiempoTexto: refinado.tiempoTexto,
            minutosCrudos: refinado.minutos,
          };
        }
        return comercio;
      })
    );
    await renderListado(estado.lista, { omitRefinamiento: true });
  }
}

function registrarEventos() {
  const mapaEventos = [
    ['filtro-nombre', 'input', (valor) => (estado.filtros.textoBusqueda = valor.trim())],
    ['filtro-municipio', 'change', (valor) => {
      estado.filtros.municipio = valor;
      estado.municipioSeleccionadoManualmente = Boolean(valor);
    }],
    ['filtro-subcategoria', 'change', (valor) => {
      if (estaEnModoCategoriaFija()) {
        estado.filtros.subcategoria = valor;
        estado.subcategoriaSeleccionadaId = valor;
      } else {
        const categoriaId = String(valor || '').trim();
        if (categoriaId) {
          const destino = `listadoComercios.html?idCategoria=${encodeURIComponent(categoriaId)}`;
          window.location.href = destino;
          return false;
        }
        estado.filtros.categoria = '';
        estado.filtros.subcategoria = '';
        estado.subcategoriaSeleccionadaId = '';
        aplicarCategoriaSeleccionadaUI('');
      }
    }],
    ['filtro-orden', 'change', (valor) => (estado.filtros.orden = valor)],
    ['filtro-abierto', 'change', (_, checked) => (estado.filtros.abiertoAhora = checked)],
    [
      'filtro-favoritos',
      'change',
      async (_, checked, elemento) => {
        if (checked) {
          const user = await requireAuthSilent('favoriteCommerce');
          if (!user) {
            desactivarSwitchFavoritos();
            showAuthModal(ACTION_MESSAGES.favoriteCommerce, 'favoriteCommerce');
            return false;
          }
          const favoritosSet = await obtenerFavoritosSet();
          estado.favoritosUsuarioSet = favoritosSet;
          if (!favoritosSet || favoritosSet.size === 0) {
            desactivarSwitchFavoritos();
            showPopupFavoritosVacios("comercio");
            return false;
          }
        }
        estado.filtros.favoritos = checked;
        return true;
      },
    ],
    ['filtro-destacados', 'change', (_, checked) => (estado.filtros.destacadosPrimero = checked)],
  ];

  const dispararBusquedaDebounce = debounce(async (valor) => {
    await actualizarBusquedaPorTexto(typeof valor === 'string' ? valor.trim() : '');
    resetSugerencias();
    await cargarComercios({ append: false });
  }, 350);

  mapaEventos.forEach(([id, evento, asignador]) => {
    const elemento = getElement(id);
    if (!elemento) return;
    elemento.addEventListener(evento, async (e) => {
      const target = e.target;
      const valor = target.value ?? '';
      const checked = target.checked ?? false;
      if (id === 'filtro-orden') {
        estado.ordenSeleccionManual = true;
        if (String(valor) === 'ubicacion') {
          const coords = await solicitarUbicacionForzada();
          if (coords) {
            recalcularDistancias(coords.lat, coords.lon);
            await ordenarYRenderizar('ubicacion');
          } else {
            setOrden('az');
            await ordenarYRenderizar('az');
          }
          return;
        }
        setOrden(valor || 'az');
      } else {
        const seguir = await asignador(valor, checked, target);
        if (seguir === false) {
          return;
        }
      }

      if (id === 'filtro-nombre') {
        await dispararBusquedaDebounce(valor);
        return;
      }

      resetSugerencias();

      const requiereRPC = ['filtro-nombre', 'filtro-municipio', 'filtro-subcategoria', 'filtro-abierto'].includes(
        id
      );
      if (requiereRPC) {
        await cargarComercios({ append: false });
      } else {
        await renderListado();
      }
    });
  });

  const filtroPlato = getElement('filtro-plato');
  if (filtroPlato) {
    filtroPlato.addEventListener('input', async (e) => {
      const valor = e.target.value.trim();
      if (valor.length < 3) {
        estado.filtros.comerciosPorPlato = [];
        await renderListado();
        return;
      }

      const { data: productos, error } = await supabase
        .from('productos')
        .select('idMenu')
        .ilike('nombre', `%${valor}%`);
      if (error) {
        console.error('Error buscando productos:', error);
        return;
      }
      if (!productos?.length) {
        estado.filtros.comerciosPorPlato = [];
        await renderListado();
        return;
      }

      const idMenus = productos.map((p) => p.idMenu);
      const { data: menus, error: errMenus } = await supabase
        .from('menus')
        .select('idComercio')
        .in('id', idMenus);
      if (errMenus) {
        console.error('Error buscando menús:', errMenus);
        return;
      }

      estado.filtros.comerciosPorPlato = [...new Set(menus?.map((m) => m.idComercio) || [])];
      await renderListado();
    });
  }
}

export async function iniciarBusquedaComercios() {
  contenedorListado = getElement('app');
  filtrosDiv = getElement('filtros-activos');
  searchProductsSection = getElement('searchProductsSection');
  searchProductsTitle = getElement('searchProductsTitle');
  searchProductsGrid = getElement('searchProductsGrid');

  if (!contenedorListado) {
    console.error('⚠️ No se encontró el contenedor principal del listado.');
    return;
  }

  if (!contenedorListado.dataset.layoutOriginal) {
    contenedorListado.dataset.layoutOriginal = contenedorListado.className;
  }

  hideSearchProductsGrid();

  await cargarNombreCategoria();
  aplicarModoListadoCompletoUI();
  await cargarMunicipios();
  if (idCategoriaDesdeURL != null) {
    await cargarSubcategorias(idCategoriaDesdeURL);
  } else {
    await cargarCategoriasParaFiltro();
  }
  syncFiltroLabelsHeight();
  syncToggleLabelsHeight();

  registrarEventos();
  setOrden(estado.filtros.orden);
  await obtenerCoordenadasUsuario();
  if (estaEnModoCategoriaFija()) {
    await asegurarMunicipioInicial();
  }
  await cargarComercios({ append: false, mostrarLoader: true });
}
