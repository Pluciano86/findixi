// public/js/cercaDeMi.js
import { supabase } from '../shared/supabaseClient.js';
import { t, getLang } from './i18n.js';
import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';
import { fetchCercanosParaCoordenadas } from './buscarComerciosListado.js';
import { mostrarPopupUbicacionDenegada, showPopupFavoritosVacios } from './popups.js';
import { requireAuthSilent, showAuthModal, ACTION_MESSAGES } from './authGuard.js';
import { showPopup as showPopupManager } from './popupManager.js';

const FALLBACK_USER_IMG = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const USER_MARKER_Z_INDEX = 10000;

function getNavCopy() {
  const lang = String(getLang() || 'es').toLowerCase().split('-')[0];
  if (lang === 'es') {
    return {
      openGps: 'Abrir GPS',
      title: 'Elegir navegación',
      body: '¿Con qué app deseas abrir la ruta?',
      google: 'Google Maps',
      waze: 'Waze',
      cancel: 'Cancelar',
    };
  }
  return {
    openGps: 'Open GPS',
    title: 'Choose navigation',
    body: 'Which app do you want to use for directions?',
    google: 'Google Maps',
    waze: 'Waze',
    cancel: 'Cancel',
  };
}

function openWithFallback(nativeUrl, webUrl) {
  let hidden = false;
  const markHidden = () => {
    hidden = true;
  };
  const cleanup = () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', markHidden);
  };
  const onVisibility = () => {
    if (document.hidden) {
      hidden = true;
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', markHidden);

  try {
    window.location.href = nativeUrl;
  } catch (_) {
    window.open(webUrl, '_blank', 'noopener');
    cleanup();
    return;
  }

  setTimeout(() => {
    cleanup();
    if (!hidden) {
      window.open(webUrl, '_blank', 'noopener');
    }
  }, 900);
}

function showNavigationPicker({ lat, lon }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const copy = getNavCopy();
  const destination = `${lat},${lon}`;
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const googleNative = isIOS
    ? `comgooglemaps://?daddr=${destination}&directionsmode=driving`
    : `google.navigation:q=${destination}&mode=d`;
  const googleWeb = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  const wazeNative = `waze://?ll=${lat},${lon}&navigate=yes`;
  const wazeWeb = `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;

  showPopupManager({
    title: copy.title,
    message: copy.body,
    buttons: [
      {
        text: copy.cancel,
      },
      {
        text: copy.google,
        primary: true,
        onClick: () => openWithFallback(googleNative, googleWeb),
      },
      {
        text: copy.waze,
        primary: true,
        onClick: () => openWithFallback(wazeNative, wazeWeb),
      },
    ],
  });
}

function attachGpsAction(cardNode, comercio = {}) {
  const lat = Number(comercio.latitud ?? comercio.lat ?? comercio.latitude);
  const lon = Number(comercio.longitud ?? comercio.lon ?? comercio.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const hasGpsButton = cardNode.querySelector('[data-map-nav-action="true"]');
  if (hasGpsButton) return;

  const timeRow = Array.from(cardNode.querySelectorAll('div')).find((el) =>
    el.querySelector('i.fa-car, i.fas.fa-car')
  );
  if (!timeRow || !timeRow.parentElement) return;

  const copy = getNavCopy();
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.mapNavAction = 'true';
  button.className =
    'gps-open-btn mx-auto -mt-2 mb-3 inline-flex items-center justify-center gap-1 rounded-full border border-[#a8dcee] bg-[#edf9fd] px-3 py-1 text-sm font-medium text-[#3ea6c4] hover:bg-[#dff4fb] transition';
  button.innerHTML = `<i class="fas fa-location-arrow text-[#3ea6c4]"></i> ${copy.openGps}`;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showNavigationPicker({ lat, lon });
  });

  timeRow.insertAdjacentElement('afterend', button);
}

function crearIconoUsuario(src, headingDeg = null) {
  const safeSrc = typeof src === 'string' && src.trim() ? src.trim() : FALLBACK_USER_IMG;
  const hasHeading = Number.isFinite(headingDeg);
  const pointer = hasHeading
    ? `
      <div style="
        position:absolute;
        inset:0;
        transform: rotate(${headingDeg}deg);
        transform-origin: 50% 50%;
        pointer-events:none;
      ">
        <div style="
          position:absolute;
          left:50%;
          top:-6px;
          transform: translateX(-50%);
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-bottom:12px solid #2563eb;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));
        "></div>
      </div>
    `
    : '';

  return L.divIcon({
    className: 'user-marker',
    html: `
      <div style="
        position: relative;
        width: 48px;
        height: 48px;
        overflow: visible;
      ">
        ${pointer}
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid white;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          background: white;
        ">
          <img src="${safeSrc}"
               style="width:100%;height:100%;object-fit:cover;"
               onerror="this.onerror=null;this.src='${FALLBACK_USER_IMG}'" />
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -40],
  });
}

async function obtenerImagenUsuario(idUsuario) {
  if (userIconSrc) return userIconSrc;
  if (!idUsuario) {
    userIconSrc = FALLBACK_USER_IMG;
    return userIconSrc;
  }

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('imagen')
      .eq('id', idUsuario)
      .single();

    const imagenPerfil = typeof data?.imagen === 'string' ? data.imagen.trim() : '';
    if (error || !imagenPerfil) {
      userIconSrc = FALLBACK_USER_IMG;
      return userIconSrc;
    }

    userIconSrc = imagenPerfil;
    return userIconSrc;
  } catch (err) {
    userIconSrc = FALLBACK_USER_IMG;
    return userIconSrc;
  }
}
const PLACEHOLDER_LOGO =
  'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/imgLogoNoDisponible.jpg';

const CATEGORY_COLORS = {
  1: '#2563eb',
  2: '#16a34a',
  3: '#f97316',
  4: '#ec4899',
  5: '#9333ea',
  6: '#facc15',
  7: '#0ea5e9',
};

let map, markersLayer, userMarker;
let userLat = null;
let userLon = null;
let userAccuracyCircle = null;
let geoWatchId = null;
let mapInteractionsBound = false;
let followControlAdded = false;
let siguiendoUsuario = true;
let ultimaPosicion = null;
let userIconSrc = null;
let userHeadingDeg = null;
let lastHeadingApplied = null;



const $radio = document.getElementById('radioKm');
const $radioLabel = document.getElementById('radioKmLabel');
const $btnCentrarme = document.getElementById('btnCentrarme');
const $btnRecargar = document.getElementById('btnRecargar');
const $loader = document.getElementById('loader');
const $search = document.getElementById('searchNombre');
const $filtroAbierto = document.getElementById('filtroAbierto');
const $filtroActivos = document.getElementById('filtroActivos');
const $filtroFavoritos = document.getElementById('filtroFavoritos');
const $filtroCategoria = document.getElementById('filtroCategoria');
const $btnToggleFiltros = document.getElementById('btnToggleFiltros');
const $panelFiltros = document.getElementById('panelFiltros');
const $categoriaRow = document.getElementById('categoriaFiltrosRow');
const $geoFallbackPanel = document.getElementById('geoFallbackPanel');
const $geoFallbackStatus = document.getElementById('geoFallbackStatus');
const $fallbackMunicipioSelect = document.getElementById('fallbackMunicipioSelect');
const $btnFallbackApplyMunicipio = document.getElementById('btnFallbackApplyMunicipio');
const $btnFallbackRetryGeo = document.getElementById('btnFallbackRetryGeo');

let comerciosOriginales = [];
let searchDebounceId = null;
let favoritosUsuarioIds = new Set();
let favoritosPromise = null;
let selectedCategoryKeys = new Set();
let municipiosFallback = [];
let geoFallbackReady = false;



let selectedCategory = null;

// 🧩 Relación entre IDs y claves de categorías
const CATEGORY_ID_TO_KEY = {
  1: 'restaurantes',
  2: 'coffee-shops',
  3: 'panaderias',
  4: 'food-trucks',
  5: 'bares',
  6: 'dispensarios',
};

// 🔧 Utilidades para normalizar y obtener categorías de los comercios
const _toArray = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
const _norm = (s) => typeof s === 'string' ? s.trim().toLowerCase() : '';

function _keysFromNames(c) {
  const names = [
    c.categoria,
    c.categoria_nombre,
    c.categoriaPrincipal,
    ...(c.categoriasNombre || []),
  ].map(_norm).filter(Boolean);

  const keys = new Set();
  names.forEach(n => {
    CATEGORY_FILTERS.forEach(f => {
      const hit =
        n.includes(f.label.toLowerCase()) ||
        (f.matchers || []).some(m => n.includes(m.toLowerCase()));
      if (hit) keys.add(f.key);
    });
  });
  return keys;
}

function _keysFromIds(c) {
  const ids = _toArray(c.idCategoria);
  const keys = new Set();
  ids.forEach(id => {
    const num = Number(id);
    if (Number.isFinite(num) && CATEGORY_ID_TO_KEY[num]) {
      keys.add(CATEGORY_ID_TO_KEY[num]);
    }
  });
  return keys;
}

// 🔹 Obtiene todas las claves de categoría que aplican a un comercio
function getCategoryKeysFromComercio(c) {
  const keys = _keysFromNames(c);
  if (keys.size === 0) {
    _keysFromIds(c).forEach(k => keys.add(k));
  }
  return Array.from(keys);
}

// 🔹 Comprueba si el comercio coincide con las categorías seleccionadas
function comercioCoincideCategorias(comercio) {
  // Si no hay categorías seleccionadas, mostrar todo
  if (!selectedCategoryKeys.size) return true;

  // Normaliza los nombres de categoría del comercio
  const nombres = [
    comercio.categoria,
    comercio.categoria_nombre,
    comercio.categoriaNombre,
    comercio.categoriaPrincipal,
  ]
    .filter(Boolean)
    .map((x) => x.toLowerCase());

  // Compara con las categorías seleccionadas
  for (const catKey of selectedCategoryKeys) {
    const cat = CATEGORY_FILTERS.find((f) => f.key === catKey);
    if (!cat) continue;

    // Si alguna palabra clave de esa categoría aparece en el comercio, lo muestra
    const tieneCoincidencia = cat.matchers.some((matcher) =>
      nombres.some((n) => n.includes(matcher.toLowerCase()))
    );

    if (tieneCoincidencia) return true;
  }

  return false;
}

/*
// 🎯 Renderiza los botones de categorías
function renderCategoryButtons() {
  if (!$categoriaRow) return;
  $categoriaRow.innerHTML = '';

  // 🧩 Activar todas las categorías al inicio (solo la primera vez)
  if (selectedCategoryKeys.size === 0) {
    CATEGORY_FILTERS.forEach(cat => selectedCategoryKeys.add(cat.key));
  }

  const container = document.createElement('div');
  container.className = 'flex flex-wrap justify-center gap-3 mb-4 relative z-10';

  CATEGORY_FILTERS.forEach(cat => {
    const isActive = selectedCategoryKeys.has(cat.key);

    // 🔢 Conteo de comercios por categoría (según coincidencia flexible)
    const count = (comerciosOriginales || []).filter(c =>
      getCategoryKeysFromComercio(c).includes(cat.key)
    ).length;

    const btn = document.createElement('button');
    btn.dataset.key = cat.key;
    btn.className = `
      relative category-btn flex flex-col items-center justify-center w-16 text-[11px] font-light
      focus:outline-none transition-transform transform hover:scale-105 overflow-visible
    `;

    btn.innerHTML = `
      <div class="relative w-12 h-12 rounded-full overflow-visible shadow border-2 ${
        isActive ? 'border-[#3ea6c4]' : 'border-gray-300'
      } flex items-center justify-center">
        <img
          src="${cat.image}"
          alt="${cat.label}"
          class="w-full h-full object-cover rounded-full ${
            isActive ? 'opacity-100' : 'opacity-60 grayscale'
          }"
        />
        <div class="absolute -top-[0.12rem] -right-[5px] ${
          count > 0 ? 'bg-red-400 text-white' : 'bg-gray-300 text-gray-600'
        } text-[9px] font-light rounded-full w-4 h-4 flex items-center justify-center shadow-md ring-2 ring-white z-20">
          ${count}
        </div>
      </div>
      <span class="mt-1 text-[11px] ${
        isActive ? 'text-[#3ea6c4]' : 'text-gray-500'
      } block text-center">
        ${cat.label}
      </span>
    `;

    btn.addEventListener('click', () => {
      if (selectedCategoryKeys.has(cat.key)) {
        selectedCategoryKeys.delete(cat.key);
      } else {
        selectedCategoryKeys.add(cat.key);
      }

      renderCategoryButtons();
      aplicarFiltros();
    });

    container.appendChild(btn);
  });

  // 📊 Texto de cantidad seleccionada (centrado debajo)
  const info = document.createElement('div');
  info.className = 'text-center text-[12px] text-gray-500 w-full mt-2';
  const total = selectedCategoryKeys.size;
  info.textContent = `${total} ${
    total === 1 ? 'Categoría seleccionada' : 'Categorías seleccionadas para mostrar.'
  }`;

  // ✅ Contenedor principal
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center w-full';
  wrapper.appendChild(container);
  wrapper.appendChild(info);

  $categoriaRow.innerHTML = '';
  $categoriaRow.appendChild(wrapper);
} */

// 📍 Filtra comercios según categoría visual
function filtrarPorCategoria(comercio) {
  if (!selectedCategory) return true;

  const nombreCategoria = (comercio.categoria || comercio.categoria_nombre || '').toLowerCase();
  const key = selectedCategory.toLowerCase();

  switch (key) {
    case 'restaurantes':
      return nombreCategoria.includes('restaurante');
    case 'food-trucks':
      return nombreCategoria.includes('food') || nombreCategoria.includes('truck');
    case 'coffee-shops':
      return nombreCategoria.includes('coffee') || nombreCategoria.includes('café');
    case 'panaderias':
      return nombreCategoria.includes('panader');
    case 'bares':
      return nombreCategoria.includes('bar');
    case 'dispensarios':
      return nombreCategoria.includes('dispens');
    default:
      return true;
  }
}

function toggleLoader(show) {
  if (!$loader) return;
  $loader.classList.toggle('hidden', !show);
  $loader.classList.toggle('flex', show);
}

function togglePanelFiltros() {
  if (!$panelFiltros || !$btnToggleFiltros) return;
  const estabaOculto = $panelFiltros.classList.toggle('hidden');
  $btnToggleFiltros.setAttribute('aria-expanded', String(!estabaOculto));
  $btnToggleFiltros.classList.toggle('bg-gray-100', estabaOculto);
  $btnToggleFiltros.classList.toggle('bg-gray-200', !estabaOculto);
}

function stopGeoWatch() {
  if (geoWatchId === null || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(geoWatchId);
  geoWatchId = null;
}

function setGeoFallbackStatus(message = '', tone = 'info') {
  if (!$geoFallbackStatus) return;
  const text = String(message || '').trim();
  if (!text) {
    $geoFallbackStatus.textContent = '';
    $geoFallbackStatus.classList.add('hidden');
    $geoFallbackStatus.classList.remove('text-amber-900', 'text-red-700', 'text-green-700');
    return;
  }

  $geoFallbackStatus.textContent = text;
  $geoFallbackStatus.classList.remove('hidden', 'text-amber-900', 'text-red-700', 'text-green-700');
  if (tone === 'error') {
    $geoFallbackStatus.classList.add('text-red-700');
  } else if (tone === 'success') {
    $geoFallbackStatus.classList.add('text-green-700');
  } else {
    $geoFallbackStatus.classList.add('text-amber-900');
  }
}

function hideGeoFallbackPanel() {
  if (!$geoFallbackPanel) return;
  $geoFallbackPanel.classList.add('hidden');
  setGeoFallbackStatus('');
}

function showGeoFallbackPanel(errorCode = null) {
  if (!$geoFallbackPanel) return;
  $geoFallbackPanel.classList.remove('hidden');

  if (errorCode === 1) {
    setGeoFallbackStatus(t('cerca.geoFallbackPermissionDenied'), 'error');
  } else if (errorCode === 3) {
    setGeoFallbackStatus(t('cerca.geoFallbackTimeout'), 'error');
  } else if (errorCode === 2) {
    setGeoFallbackStatus(t('cerca.geoFallbackPositionUnavailable'), 'error');
  } else {
    setGeoFallbackStatus(t('cerca.geoFallbackUnknownError'), 'error');
  }
}

async function cargarMunicipiosFallback({ force = false } = {}) {
  if (!$fallbackMunicipioSelect) return;
  if (geoFallbackReady && !force) return;
  const selectedBefore = String($fallbackMunicipioSelect.value || '').trim();

  try {
    const { data, error } = await supabase
      .from('Municipios')
      .select('id, nombre, latitud, longitud')
      .order('nombre');

    if (error) throw error;

    municipiosFallback = (Array.isArray(data) ? data : []).filter((item) => {
      const lat = Number(item?.latitud);
      const lon = Number(item?.longitud);
      return typeof item?.nombre === 'string' && item.nombre.trim() && Number.isFinite(lat) && Number.isFinite(lon);
    });

    $fallbackMunicipioSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = t('cerca.geoFallbackMunicipioPlaceholder');
    $fallbackMunicipioSelect.appendChild(placeholder);

    municipiosFallback.forEach((municipio) => {
      const option = document.createElement('option');
      option.value = municipio.nombre;
      option.textContent = municipio.nombre;
      $fallbackMunicipioSelect.appendChild(option);
    });

    if (selectedBefore) {
      const hasSelected = municipiosFallback.some(
        (item) => String(item?.nombre || '').trim() === selectedBefore
      );
      if (hasSelected) {
        $fallbackMunicipioSelect.value = selectedBefore;
      }
    }

    geoFallbackReady = true;
  } catch (err) {
    console.error('⚠️ No se pudo cargar la lista de municipios para fallback:', err?.message || err);
    setGeoFallbackStatus(t('cerca.geoFallbackMunicipiosError'), 'error');
  }
}

function getCoordsFromMunicipioNombre(nombre = '') {
  const municipio = municipiosFallback.find(
    (item) => String(item?.nombre || '').trim().toLowerCase() === String(nombre || '').trim().toLowerCase()
  );
  if (!municipio) return null;
  const lat = Number(municipio.latitud);
  const lon = Number(municipio.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, nombre: municipio.nombre };
}

async function applyFallbackMunicipio() {
  const municipioNombre = String($fallbackMunicipioSelect?.value || '').trim();
  if (!municipioNombre) {
    setGeoFallbackStatus(t('cerca.geoFallbackSelectMunicipioRequired'), 'error');
    return;
  }

  const coords = getCoordsFromMunicipioNombre(municipioNombre);
  if (!coords) {
    setGeoFallbackStatus(t('cerca.geoFallbackMunicipioNoCoords'), 'error');
    return;
  }

  stopGeoWatch();
  siguiendoUsuario = false;
  map._userMovedManually = true;
  map._firstFix = false;
  map._comerciosCargados = false;

  if (userMarker) {
    userMarker.remove();
    userMarker = null;
  }
  if (userAccuracyCircle) {
    userAccuracyCircle.remove();
    userAccuracyCircle = null;
  }

  userLat = coords.lat;
  userLon = coords.lon;
  map.setView([coords.lat, coords.lon], 12, { animate: true });
  await loadNearby();

  setGeoFallbackStatus(t('cerca.geoFallbackLoadedMunicipio', { municipio: coords.nombre }), 'success');
}

async function cargarCategoriasDropdown() {
  if (!$filtroCategoria) return;
  $filtroCategoria.innerHTML = `<option value="">${t('cerca.categoriasTodas')}</option>`;
  try {
    const { data, error } = await supabase
      .from('Categorias')
      .select('id, nombre, nombre_es, nombre_en, nombre_zh, nombre_fr, nombre_pt, nombre_de, nombre_it, nombre_ko, nombre_ja')
      .order('nombre');
    if (error) throw error;
    const lang = (getLang() || 'es').toLowerCase().split('-')[0];
    const nombreKey = `nombre_${lang}`;
    data?.forEach((categoria) => {
      if (categoria?.id == null) return;
      const traducido = categoria?.[nombreKey];
      const nombreFinal = traducido || categoria.nombre || `${t('cerca.categoriasTodas')} ${categoria.id}`;
      const option = document.createElement('option');
      option.value = categoria.id;
      option.textContent = nombreFinal;
      $filtroCategoria.appendChild(option);
    });
  } catch (err) {
    console.error('⚠️ No se pudieron cargar las categorías:', err?.message || err);
  }
}

function normalizarTextoPlano(valor) {
  if (valor == null) return '';
  return String(valor)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const CATEGORY_FILTERS = [
  {
    key: 'restaurantes',
    label: 'Restaurantes',
    image:
      'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/categorias/RESTAURANTES.jpg',
    matchers: ['restaurante', 'restaurantes'],
  },
  {
    key: 'food-trucks',
    label: 'Food Trucks',
    image:
      'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/categorias/FOOD%20TRUCK.jpg',
    matchers: ['food truck', 'food trucks'],
  },
  {
    key: 'coffee-shops',
    label: 'Coffee Shops',
    image:
      'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/categorias/COFFE%20SHOP.jpg',
    matchers: ['coffee shop', 'coffee shops', 'café', 'cafe'],
  },
  {
    key: 'panaderias',
    label: 'Panaderías',
    image:
      'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/categorias/panaderias.jpg',
    matchers: ['panaderia', 'panaderías', 'panaderia'],
  },
  {
    key: 'bares',
    label: 'Bares',
    image:
      'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/categorias/Bares.jpg',
    matchers: ['bar', 'bares'],
  },
  {
    key: 'dispensarios',
    label: 'Dispensarios',
    image:
      'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/categorias/Dispensario.jpg',
    matchers: ['dispensario', 'dispensarios'],
  },
];

const CATEGORY_FILTERS_MAP = CATEGORY_FILTERS.reduce((acc, filter) => {
  acc[filter.key] = {
    ...filter,
    normalizedMatchers: filter.matchers.map(normalizarTextoPlano),
  };
  return acc;
}, {});

function descomponerValoresMultiples(valor) {
  if (Array.isArray(valor)) return valor;
  if (valor === null || valor === undefined) return [];

  if (typeof valor === 'string') {
    const trimmed = valor.trim();
    if (!trimmed) return [];
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      const contenido = trimmed.slice(1, -1);
      if (!contenido) return [];
      return contenido.split(',').map(item => item.trim()).filter(Boolean);
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [trimmed];
  }

  return [valor];
}

function normalizarId(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }
  const texto = String(valor).trim();
  if (!texto) return null;
  const num = Number(texto);
  if (!Number.isNaN(num) && Number.isFinite(num)) return num;
  return texto.toLowerCase();
}

function setTieneId(conjunto, valor) {
  if (!conjunto || conjunto.size === 0) return false;
  const key = normalizarId(valor);
  if (key === null || key === '') return false;
  if (conjunto.has(key)) return true;
  if (typeof key === 'number') return conjunto.has(String(key));
  const num = Number(key);
  return !Number.isNaN(num) && conjunto.has(num);
}

function extraerIdsCategoria(comercio = {}) {
  const ids = new Set();

  const agregarId = (valor) => {
    const key = normalizarId(valor);
    if (key !== null && key !== '') {
      ids.add(key);
    }
  };

  descomponerValoresMultiples(comercio.idCategoria).forEach(agregarId);
  descomponerValoresMultiples(comercio.categoriasId).forEach(agregarId);

  if (Array.isArray(comercio.categorias)) {
    comercio.categorias.forEach(item => {
      if (item === null || item === undefined) return;
      if (typeof item === 'number' || typeof item === 'string') {
        agregarId(item);
      } else if (typeof item === 'object') {
        if ('idCategoria' in item) agregarId(item.idCategoria);
        if ('id' in item) agregarId(item.id);
      }
    });
  }

  return Array.from(ids);
}

function obtenerCategoriasNormalizadas(comercio = {}) {
  const etiquetas = new Set();

  const agregar = (valor) => {
    if (typeof valor !== 'string') return;
    const limpio = normalizarTextoPlano(valor);
    if (limpio) etiquetas.add(limpio);
  };

  [
    comercio.categoria,
    comercio.nombreCategoria,
    comercio.categoriaNombre,
    comercio.categoriaPrincipal,
  ].forEach(agregar);

  if (Array.isArray(comercio.categoriasNombre)) {
    comercio.categoriasNombre.forEach(agregar);
  }

  if (Array.isArray(comercio.categorias)) {
    comercio.categorias.forEach(cat => {
      if (typeof cat === 'string') agregar(cat);
      else if (typeof cat?.nombre === 'string') agregar(cat.nombre);
    });
  }

  return Array.from(etiquetas);
}

function obtenerCategoriasOriginales(comercio = {}) {
  const etiquetas = new Set();

  const agregar = (valor) => {
    if (typeof valor !== 'string') return;
    const limpio = valor.trim();
    if (limpio) etiquetas.add(limpio);
  };

  [
    comercio.categoria,
    comercio.nombreCategoria,
    comercio.categoriaNombre,
    comercio.categoriaPrincipal,
  ].forEach(agregar);

  if (Array.isArray(comercio.categoriasNombre)) {
    comercio.categoriasNombre.forEach(agregar);
  }

  if (Array.isArray(comercio.categorias)) {
    comercio.categorias.forEach(cat => {
      if (typeof cat === 'string') agregar(cat);
      else if (typeof cat?.nombre === 'string') agregar(cat.nombre);
    });
  }

  return Array.from(etiquetas);
}

function aplicarFiltros() {
  if (!Array.isArray(comerciosOriginales) || !comerciosOriginales.length) {
    markersLayer?.clearLayers();
    return;
  }

  let resultado = [...comerciosOriginales];

  // 🔍 Búsqueda por nombre o descripción
  const termino = normalizarTextoPlano($search?.value || '');
  if (termino) {
    resultado = resultado.filter(c => {
      const nombre = normalizarTextoPlano(c.nombre || '');
      const descripcion = normalizarTextoPlano(c.descripcion || '');
      return nombre.includes(termino) || descripcion.includes(termino);
    });
  }

  // 🎯 Nuevo filtro por categoría visual (botones)
  if (selectedCategory) {
    resultado = resultado.filter(filtrarPorCategoria);
  }

  // 🟩 Abierto ahora
  if ($filtroAbierto?.checked) {
    resultado = resultado.filter(c => c.abiertoAhora === true || c.abierto === true);
  }

  // 💜 Mis favoritos
  if ($filtroFavoritos?.checked && favoritosUsuarioIds.size > 0) {
    resultado = resultado.filter(c => setTieneId(favoritosUsuarioIds, c.id));
  }

  // ⚙️ (Si decides mantenerlo más adelante)
  if ($filtroActivos?.checked) {
    resultado = resultado.filter(c => c.activo === true || c.activoEnPeErre === true);
  }

  // 🗺️ Renderizar resultados en el mapa
  renderMarkers(resultado);
}

async function obtenerIdUsuarioActual() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session?.user?.id || null;
  } catch (err) {
    console.warn('⚠️ No se pudo obtener la sesión del usuario actual:', err?.message || err);
    return null;
  }
}

async function obtenerFavoritosUsuarioIds() {
  if (favoritosPromise) {
    try {
      const ids = await favoritosPromise;
      favoritosUsuarioIds = ids;
      return favoritosUsuarioIds;
    } catch (err) {
      favoritosPromise = null;
    }
  }

  favoritosPromise = (async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData?.session?.user?.id;
      if (!userId) return new Set();

      const { data, error } = await supabase
        .from('favoritosusuarios')
        .select('idcomercio')
        .eq('idusuario', userId);

      if (error) throw error;

      const ids = Array.isArray(data)
        ? data
            .map(reg => reg?.idcomercio)
            .filter(id => id !== null && id !== undefined)
        : [];

      const set = new Set();
      ids.forEach(id => {
        const num = Number(id);
        if (!Number.isNaN(num) && Number.isFinite(num)) {
          set.add(num);
          set.add(String(num));
        } else if (typeof id === 'string') {
          const limpio = id.trim();
          if (limpio) set.add(limpio);
        }
      });

      return set;
    } catch (err) {
      console.warn('⚠️ No se pudieron cargar favoritos del usuario:', err?.message || err);
      return new Set();
    }
  })();

  favoritosUsuarioIds = await favoritosPromise;
  return favoritosUsuarioIds;
}

function initMap() {
  // ✅ Crear mapa base (sin rotación CSS)
  map = L.map('map', {
    maxZoom: 22,     // 🔥 permite acercar más de lo normal
    minZoom: 6,
    zoomControl: true,
  }).setView([18.2208, -66.5901], 15); // Zoom inicial

  // ✅ Capa de mapa (Carto Voyager o OpenStreetMap)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 22,
    attribution:
      '&copy; <a href="https://carto.com/">CartoDB</a> | &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  }).addTo(map);

  // ✅ Capa para los marcadores
  markersLayer = L.layerGroup().addTo(map);

}

function updateRadioLabel() {
  if ($radio && $radioLabel) $radioLabel.textContent = `${$radio.value} mi`;
}

function getComercioColor(comercio) {
  if (comercio.color_hex && /^#([0-9a-f]{6})$/i.test(comercio.color_hex)) {
    return comercio.color_hex;
  }
  if (comercio.idCategoria && CATEGORY_COLORS[comercio.idCategoria]) {
    return CATEGORY_COLORS[comercio.idCategoria];
  }
  return '#2563eb';
}


function createComercioIcon(comercio) {
  const logoURL =
    comercio.logo && comercio.logo.trim() !== '' ? comercio.logo.trim() : PLACEHOLDER_LOGO;

  return L.divIcon({
    className: 'comercio-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 50px;
        background: white;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid ${getComercioColor(comercio)};
        box-shadow: 0 3px 8px rgba(0,0,0,0.25);
      ">
        <img
          src="${logoURL}"
          alt="Logo ${comercio.nombre}"
          style="width:100%;height:100%;object-fit:cover;"
          onerror="this.onerror=null;this.src='${PLACEHOLDER_LOGO}'"
        />
      </div>
      <div style="width:2px;height:10px;background:${getComercioColor(
        comercio
      )};margin:0 auto;border-radius:1px;"></div>
    `,
    iconSize: [50, 60],
    iconAnchor: [25, 60],
    popupAnchor: [0, -60],
  });
}

/* -------------------------- ENRIQUECEDORES -------------------------- */

async function renderMarkers(comercios = []) {
  markersLayer.clearLayers();
  if (!Array.isArray(comercios) || !comercios.length) return;

  comercios.forEach((comercio) => {
    const lat = Number(comercio.latitud ?? comercio.lat ?? comercio.latitude);
    const lon = Number(comercio.longitud ?? comercio.lon ?? comercio.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const marker = L.marker([lat, lon], {
      icon: createComercioIcon(comercio),
    });

    const cardFactory = comercio.activo === true ? cardComercio : cardComercioNoActivo;
    const cardNode = cardFactory({
      ...comercio,
      abierto: Boolean(comercio.abierto ?? comercio.abiertoAhora ?? comercio.abierto_ahora),
      tiempoVehiculo: comercio.tiempoVehiculo || comercio.tiempoTexto,
      pueblo: comercio.municipio || comercio.pueblo || '',
    });
    attachGpsAction(cardNode, comercio);

    cardNode.querySelector('div[class*="text-[#3ea6c4]"]')?.remove();
    cardNode.querySelector('.municipio-info')?.remove();

    const municipioTexto = typeof comercio.municipio === 'string' ? comercio.municipio.trim() : '';
    if (municipioTexto) {
      const municipioEl = document.createElement('div');
      municipioEl.className =
        'flex items-center gap-1 justify-center text-[#3ea6c4] text-sm font-medium municipio-info';
      municipioEl.innerHTML = `<i class="fas fa-map-pin"></i> ${municipioTexto}`;

      const anchorNombre = cardNode.querySelector('a[href*="perfilComercio.html"]');
      if (anchorNombre) {
        anchorNombre.insertAdjacentElement('afterend', municipioEl);
      } else {
        cardNode.insertBefore(municipioEl, cardNode.firstChild);
      }
    }

    const wrapper = document.createElement('div');
    wrapper.style.width = '340px';
    wrapper.appendChild(cardNode);

    marker.bindPopup(wrapper, {
      maxWidth: 360,
      className: 'popup-card--clean',
      autoPan: true,
      keepInView: true,
    });

    marker.on('popupopen', (e) => {
      const popupEl = e.popup._contentNode;
      if (!popupEl) return;
      const telButtons = popupEl.querySelectorAll('a[href^="tel:"], button[href^="tel:"]');
      telButtons.forEach((btn) => {
        btn.style.color = '#ffffff';
        btn.style.backgroundColor = '#dc2626';
        btn.style.border = 'none';
      });
      const telIcons = popupEl.querySelectorAll('a[href^="tel:"] i, a[href^="tel:"] span');
      telIcons.forEach((icon) => (icon.style.color = '#ffffff'));
    });

    markersLayer.addLayer(marker);
  });
}

/* ------------------------------ CARGA ------------------------------ */

async function loadNearby() {
  if (typeof userLat !== 'number' || typeof userLon !== 'number') return;

  const radioMiles = Number($radio?.value ?? 5) || 5;
  const radioKm = Math.max(0.5, radioMiles) * 1.60934;
  toggleLoader(true);

  const abiertoAhoraFiltro = $filtroAbierto?.checked ? true : null;
  const categoriaSeleccionada = ($filtroCategoria?.value ?? '').trim();
  const categoriaOpcional = categoriaSeleccionada ? Number(categoriaSeleccionada) || null : null;
  const incluirInactivos = false; // solo mostrar inactivos si se habilita explícitamente un filtro futuro

  try {
    const lista = await fetchCercanosParaCoordenadas({
      latitud: userLat,
      longitud: userLon,
      radioKm,
      categoriaOpcional,
      abiertoAhora: abiertoAhoraFiltro,
      incluirInactivos,
    });

    const favoritosIds = await obtenerFavoritosUsuarioIds();

    const listaConFavoritos = lista.map((c) => {
      const esFavorito = favoritosIds.has(c.id) || favoritosIds.has(String(c.id));
      return { ...c, favorito: esFavorito };
    });

    comerciosOriginales = listaConFavoritos;
    aplicarFiltros();
  } catch (err) {
    console.error('❌ Error al cargar comercios cercanos:', err);
  } finally {
    toggleLoader(false);
  }
}

async function locateUser() {
  if (!map) return;
  if (!navigator.geolocation) {
    showGeoFallbackPanel();
    setGeoFallbackStatus(t('cerca.geoFallbackNoSupport'), 'error');
    cargarMunicipiosFallback();
    return;
  }
  if (geoWatchId !== null) {
    map._userMovedManually = false;
    siguiendoUsuario = true;
    if (typeof userLat === 'number' && typeof userLon === 'number') {
      map.setView([userLat, userLon], Math.max(15, map.getZoom() || 13), { animate: true });
    }
    return;
  }
  toggleLoader(true);

  const idUsuario = await obtenerIdUsuarioActual();
  const iconoUsuarioSrc = await obtenerImagenUsuario(idUsuario);
  const iconoUsuario = crearIconoUsuario(iconoUsuarioSrc, userHeadingDeg);

  siguiendoUsuario = true;
  ultimaPosicion = null;

  // marca si el usuario tocó el mapa (para no re-centrar a la fuerza)
  map._userMovedManually = false;

  // si el usuario mueve o hace zoom, pausamos seguimiento automático
  if (!mapInteractionsBound) {
    map.on('dragstart zoomstart', (e) => {
      // Solo desactivar seguimiento si fue una interacción del usuario
      if (e && e.originalEvent) {
        map._userMovedManually = true;
        siguiendoUsuario = false;
      }
    });
    mapInteractionsBound = true;
  }

  // util distancia (metros)
  const getDistanceMeters = (p1, p2) => {
    const R = 6371e3, toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(p2.lat - p1.lat);
    const dLon = toRad(p2.lon - p1.lon);
    const a = Math.sin(dLat/2)**2 +
      Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const actualizarUbicacion = async (pos) => {
    try {
      userLat = pos.coords.latitude;
      userLon = pos.coords.longitude;
      if (!map || !Number.isFinite(userLat) || !Number.isFinite(userLon)) return;
      hideGeoFallbackPanel();

      // velocidad → mph
      const speed = pos.coords.speed || 0; // m/s
      const mph = speed * 2.23694;

      // distancia recorrida desde la última lectura
      const ahora = { lat: userLat, lon: userLon };
      const dist = ultimaPosicion ? getDistanceMeters(ultimaPosicion, ahora) : Infinity;
      ultimaPosicion = ahora;

      // heading (grados) si está disponible
      const headingRaw = pos.coords.heading;
      if (Number.isFinite(headingRaw)) {
        userHeadingDeg = headingRaw;
      }

      // crea/mueve el pin del usuario
      if (userMarker) {
        userMarker.setLatLng([userLat, userLon]);
        userMarker.setZIndexOffset(USER_MARKER_Z_INDEX);
        if (Number.isFinite(userHeadingDeg)) {
          if (lastHeadingApplied === null || Math.abs(userHeadingDeg - lastHeadingApplied) >= 5) {
            userMarker.setIcon(crearIconoUsuario(userIconSrc, userHeadingDeg));
            lastHeadingApplied = userHeadingDeg;
          }
        }
      } else {
        userMarker = L.marker([userLat, userLon], { icon: crearIconoUsuario(userIconSrc, userHeadingDeg) }).addTo(map);
        userMarker.setZIndexOffset(USER_MARKER_Z_INDEX);
        if (Number.isFinite(userHeadingDeg)) {
          lastHeadingApplied = userHeadingDeg;
        }
      }

      // 1) primera fijación: mostrar vista amplia (13) para ver varias cuadras/comercios
      if (!map._firstFix) {
        map._firstFix = true;
        map.setView([userLat, userLon], 13, { animate: true });
      } else {
        // 2) si aún no recorrió 3 m, no cambiamos el zoom (solo seguimos el pin)
        if (dist >= 3) {
          // 3) calcular zoom según velocidad
          let zoomDeseado = (mph > 45) ? 13 : (mph >= 20 ? 15 : 20);

          // si el usuario acercó más, no lo alejamos
          const zActual = map.getZoom();
          if (zActual > zoomDeseado) zoomDeseado = zActual;

          // re-centrar solo si seguimos al usuario y no movió el mapa manualmente
          if (siguiendoUsuario && !map._userMovedManually) {
            map.setView([userLat, userLon], zoomDeseado, { animate: true });
          }
        } else {
          // menos de 3 m: mantener zoom actual; si seguimos, solo centrar suavemente
          if (siguiendoUsuario && !map._userMovedManually) {
            map.panTo([userLat, userLon], { animate: true });
          }
        }
      }

      // cargar comercios la primera vez
      if (!map._comerciosCargados) {
        await loadNearby();
        map._comerciosCargados = true;
      }

      // elimina círculo de precisión si existiera
      if (userAccuracyCircle) {
        userAccuracyCircle.remove();
        userAccuracyCircle = null;
      }

      // debug
      // console.log(`📍 ${userLat.toFixed(5)}, ${userLon.toFixed(5)} | ${mph.toFixed(1)} mph | dist ${Math.round(dist)} m`);
    } catch (err) {
      console.error('⚠️ Error actualizando ubicación:', err);
    } finally {
      toggleLoader(false);
    }
  };

  const handleError = (err) => {
    console.warn('⚠️ Error en seguimiento de ubicación:', err.message);
    const errorCode = Number(err?.code);
    if (err && err.code === err.PERMISSION_DENIED) {
      mostrarPopupUbicacionDenegada();
      stopGeoWatch();
    }
    showGeoFallbackPanel(errorCode);
    cargarMunicipiosFallback();
    toggleLoader(false);
  };

  // seguimiento continuo
  geoWatchId = navigator.geolocation.watchPosition(actualizarUbicacion, handleError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });

  // botón para re-centrar (reactiva seguimiento y respeta zoom por velocidad)
  if (!followControlAdded) {
    const btnSeguir = L.control({ position: 'bottomright' });
    btnSeguir.onAdd = () => {
      const btn = L.DomUtil.create('button', 'seguir-usuario-btn');
      btn.innerHTML = '<i class="fas fa-location-arrow"></i>';
      btn.title = 'Volver a centrar en tu ubicación';
      btn.style.cssText = `
        background: white;
        border: none;
        border-radius: 50%;
        width: 44px;
        height: 44px;
        font-size: 18px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      `;
      btn.onclick = () => {
        map._userMovedManually = false;
        siguiendoUsuario = true;
        if (typeof userLat === 'number' && typeof userLon === 'number') {
          map.setView([userLat, userLon], Math.max(15, map.getZoom() || 13), { animate: true });
        }
      };
      return btn;
    };
    btnSeguir.addTo(map);
    followControlAdded = true;
  }
}

/* ------------------------------ INIT ------------------------------ */

(function init() {
  initMap();
  updateRadioLabel();
  cargarCategoriasDropdown();
  cargarMunicipiosFallback();

  $radio?.addEventListener('input', updateRadioLabel);
  $radio?.addEventListener('change', () => loadNearby());
  $btnCentrarme?.addEventListener('click', locateUser);
  $btnRecargar?.addEventListener('click', () => loadNearby());
  $btnFallbackApplyMunicipio?.addEventListener('click', () => applyFallbackMunicipio());
  $btnFallbackRetryGeo?.addEventListener('click', () => {
    stopGeoWatch();
    setGeoFallbackStatus(t('cerca.geoFallbackRetrying'), 'info');
    locateUser();
  });
  $btnToggleFiltros?.addEventListener('click', togglePanelFiltros);
  $filtroCategoria?.addEventListener('change', () => loadNearby());
  window.addEventListener('lang:changed', () => {
    cargarCategoriasDropdown();
    cargarMunicipiosFallback({ force: true });
  });

  if ($search) {
    $search.addEventListener('input', () => {
      if (searchDebounceId) clearTimeout(searchDebounceId);
      searchDebounceId = setTimeout(aplicarFiltros, 200);
    });
  }

  [$filtroAbierto, $filtroActivos, $filtroFavoritos].forEach(toggle => {
    if (toggle === $filtroFavoritos) {
      toggle?.addEventListener('change', async (e) => {
        if (e.target.checked) {
          const user = await requireAuthSilent('favoriteCommerce');
          if (!user) {
            e.target.checked = false;
            showAuthModal(ACTION_MESSAGES.favoriteCommerce, 'favoriteCommerce');
            aplicarFiltros();
            return;
          }
          const favoritosIds = await obtenerFavoritosUsuarioIds();
          if (!favoritosIds || favoritosIds.size === 0) {
            showPopupFavoritosVacios("comercio");
            desactivarSwitchFavoritos();
            aplicarFiltros();
            return;
          }
        }
        aplicarFiltros();
      });
    } else {
      toggle?.addEventListener('change', aplicarFiltros);
    }
  });

 // renderCategoryButtons();

  locateUser();
})();

// Asegurar color blanco en popup al abrirlo
map?.on('popupopen', () => {
  document
    .querySelectorAll('.leaflet-popup-content .card-comercio a[href^="tel:"]')
    .forEach(el => (el.style.color = 'white'));
});
function desactivarSwitchFavoritos() {
  if ($filtroFavoritos) {
    $filtroFavoritos.checked = false;
  }
}
