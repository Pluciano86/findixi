import { supabase } from '../shared/supabaseClient.js';
import { getLang, t, interpolate } from './i18n.js';
import { calcularTiempoEnVehiculo } from '../shared/utils.js';
import { getDrivingDistance } from '../shared/osrmClient.js';
import { cardComercio } from './CardComercio.js';
import { cardComercioNoActivo } from './CardComercioNoActivo.js';
import { mostrarCargando, mostrarError } from './mensajesUI.js';
import { createGlobalBannerElement, destroyCarousel } from './bannerCarousel.js';
import { detectarMunicipioUsuario } from './detectarMunicipio.js';
import { mostrarPopupUbicacionDenegada, showPopupFavoritosVacios } from './popups.js';
import { requireAuthSilent, showAuthModal, ACTION_MESSAGES } from './authGuard.js';
import { resolverPlanComercio } from '../shared/planes.js';

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
const distanciasRealesCache = new Map();
let refinamientoEnCurso = false;
let sugerenciasMostradas = false;

function normalizarTexto(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

async function obtenerIdsComerciosPorProductos(textoRaw) {
  const termino = typeof textoRaw === 'string' ? textoRaw.trim() : '';
  if (termino.length < 3) return [];

  try {
    const { data: productos, error } = await supabase
      .from('productos')
      .select('idMenu')
      .ilike('nombre', `%${termino}%`);
    if (error) {
      console.error('Error buscando productos por texto:', error);
      return [];
    }

    const idMenus = Array.isArray(productos)
      ? [...new Set(productos.map((p) => p?.idMenu).filter((id) => id != null))]
      : [];
    if (idMenus.length === 0) return [];

    const { data: menus, error: errMenus } = await supabase
      .from('menus')
      .select('idComercio')
      .in('id', idMenus);
    if (errMenus) {
      console.error('Error buscando menús relacionados:', errMenus);
      return [];
    }

    const idsComercios = Array.isArray(menus)
      ? menus
          .map((m) => (m?.idComercio != null ? Number(m.idComercio) : null))
          .filter((id) => Number.isFinite(id))
      : [];
    return [...new Set(idsComercios)];
  } catch (error) {
    console.error('Error obteniendo comercios por productos:', error);
    return [];
  }
}

async function obtenerIdsComerciosPorMenus(textoRaw) {
  const termino = typeof textoRaw === 'string' ? textoRaw.trim() : '';
  if (termino.length < 3) return [];

  try {
    const { data, error } = await supabase
      .from('menus')
      .select('idComercio')
      .ilike('titulo', `%${termino}%`);
    if (error) {
      console.error('Error buscando menús por texto:', error);
      return [];
    }
    const ids = Array.isArray(data)
      ? data
          .map((item) => (item?.idComercio != null ? Number(item.idComercio) : null))
          .filter((id) => Number.isFinite(id))
      : [];
    return [...new Set(ids)];
  } catch (error) {
    console.error('Error obteniendo comercios por menús:', error);
    return [];
  }
}

function formatearTextoLargo(minutosTotales) {
  if (!Number.isFinite(minutosTotales) || minutosTotales < 0) return 'N/D';

  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;

  if (horas > 0 && minutos > 0) {
    return `a ${horas} hora${horas > 1 ? 's' : ''} ${minutos} minuto${minutos > 1 ? 's' : ''}`;
  }

  if (horas > 0) {
    return `a ${horas} hora${horas > 1 ? 's' : ''}`;
  }

  return `a ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
}

function obtenerIdCategoriaDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('idCategoria');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

const idCategoriaDesdeURL = obtenerIdCategoriaDesdeURL();

const estado = {
  categoria: '',
  categoriaObj: null,
  categoriaSlug: '',
  subcategorias: [],
  subcategoriaSeleccionadaId: '',
  filtros: {
    textoBusqueda: '',
    municipio: '',
    municipioDetectado: '',
    categoria: '',
    subcategoria: '',
    orden: 'az',
    abiertoAhora: false,
    favoritos: false,
    destacadosPrimero: true,
    comerciosPorPlato: [],
    comerciosPorMenus: [],
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

if (typeof window !== 'undefined') {
  window.__estadoListadoComercios = estado;
}

// Re-render categorías / textos cuando cambia el idioma
window.addEventListener('lang:changed', () => {
  estado.categoria = getCategoriaLabelPorIdioma();
  actualizarEtiquetaSubcategoria(estado.categoria);
  renderSubcategoriasDropdown();
  const base = estado.comerciosFiltrados.length ? estado.comerciosFiltrados : estado.lista;
  renderListado(base, { omitRefinamiento: true, skipFilter: true });
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

function getElement(id) {
  return document.getElementById(id);
}

async function actualizarBusquedaPorTexto(texto) {
  const termino = typeof texto === 'string' ? texto.trim() : '';
  estado.filtros.textoBusqueda = termino;

  if (termino.length < 3) {
    estado.filtros.comerciosPorPlato = [];
    estado.filtros.comerciosPorMenus = [];
    return;
  }

  const [idsPorProductos, idsPorMenus] = await Promise.all([
    obtenerIdsComerciosPorProductos(termino),
    obtenerIdsComerciosPorMenus(termino),
  ]);

  estado.filtros.comerciosPorPlato = idsPorProductos;
  estado.filtros.comerciosPorMenus = idsPorMenus;
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

function getCategoriaLabelPorIdioma() {
  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es').toLowerCase();
  const col = `nombre_${lang}`;
  const c = estado.categoriaObj || {};
  return c[col] || c.nombre_es || c.nombre || estado.categoria || '';
}

function actualizarEtiquetaSubcategoria(nombreCategoria) {
  const label = document.querySelector('label[for="filtro-subcategoria"]');
  if (!label) return;
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

function renderSubcategoriasDropdown(subs = estado.subcategorias) {
  const select = getElement('filtro-subcategoria');
  if (!select) return;
  const current = select.value || estado.filtros.subcategoria || '';
  select.innerHTML = `<option value="">${t('listado.todas')}</option>`;

  const lang = (localStorage.getItem('lang') || document.documentElement.lang || 'es').toLowerCase();
  const col = `nombre_${lang}`;

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
}

function normalizarComercio(record, referencia = obtenerReferenciaUsuarioParaCalculos()) {
  // 🔥 1. Usar SIEMPRE la ubicación REAL del usuario si existe
  const refUsuario = obtenerReferenciaUsuarioParaCalculos();
  const ref = refUsuario || referencia; // preferencia a usuario real

  // 🔥 2. Calcular distancia usando SIEMPRE la referencia correcta
  const distanciaKm = calcularDistanciaConFallback(record, ref);

  const tiempoCalculado =
    Number.isFinite(distanciaKm) && distanciaKm >= 0
      ? calcularTiempoEnVehiculo(distanciaKm)
      : { texto: 'N/D', minutos: null };

  const minutosTotales = Number.isFinite(tiempoCalculado.minutos)
    ? tiempoCalculado.minutos
    : null;

  const textoLargo = formatearTextoLargo(minutosTotales);
  const abiertoDesdeRPC = record.abierto_ahora;
  const abiertoBool = typeof abiertoDesdeRPC === 'boolean'
    ? abiertoDesdeRPC
    : Boolean(abiertoDesdeRPC);

  return {
    ...record,
    id: record.id,
    nombre: record.nombre ?? 'Sin nombre',
    telefono: record.telefono ?? '',
    pueblo: record.municipio ?? record.pueblo ?? '',
    municipio: record.municipio ?? record.pueblo ?? '',
    latitud: Number(record.latitud),
    longitud: Number(record.longitud),
    distanciaKm: Number.isFinite(distanciaKm) ? distanciaKm : null,
    minutosEstimados: minutosTotales,
    abierto: abiertoBool,
    abiertoAhora: abiertoBool,
    abierto_ahora: abiertoBool,
    raw: record,
  };
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
    const distanciaKm = calcularDistanciaHaversine(lat, lon, Number(comercio.latitud), Number(comercio.longitud));
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
  const textoBusqueda = (filtros.textoBusqueda || '').trim();
  const usandoBusquedaTexto = textoBusqueda.length > 0;
  const municipioFiltro =
    estado.municipioSeleccionadoManualmente && filtros.municipio
      ? filtros.municipio.trim()
      : estado.usarMunicipioDetectado && filtros.municipioDetectado
      ? filtros.municipioDetectado.trim()
      : null;
  const coords =
    !usandoBusquedaTexto && estado.tienePermisoUbicacion && estado.coordsUsuario
      ? estado.coordsUsuario
      : { lat: null, lon: null };

  return {
    p_texto: usandoBusquedaTexto ? textoBusqueda : null,
    p_municipio: usandoBusquedaTexto ? null : municipioFiltro,
    p_categoria: filtros.categoria ? Number(filtros.categoria) || null : null,
    p_subcategoria: filtros.subcategoria ? Number(filtros.subcategoria) || null : null,
    p_activo: null,
    p_latitud: usandoBusquedaTexto ? null : Number.isFinite(coords.lat) ? coords.lat : null,
    p_longitud: usandoBusquedaTexto ? null : Number.isFinite(coords.lon) ? coords.lon : null,
    p_radio: usandoBusquedaTexto ? null : null,
    p_limit: LIMITE_POR_PAGINA,
    p_offset: estado.offset,
    p_abierto_ahora: filtros.abiertoAhora ? true : null,
  };
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
      .select('id, nombreSucursal, sucursal, esSucursal, es_sucursal')
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

function ordenarLocalmente(lista) {
  let resultado = Array.isArray(lista) ? [...lista] : [];
  const { orden, favoritos, destacadosPrimero, abiertoAhora } = estado.filtros;

  if (abiertoAhora) {
    resultado = resultado.filter((c) => c.abierto_ahora === true);
  }

  if (favoritos) {
    resultado = resultado.filter((c) => c.favorito === true);
  }

  const ordenarGrupo = (grupo) => {
    const copia = [...grupo];
    if (orden === 'az') {
      copia.sort((a, b) => a.nombre.localeCompare(b.nombre));
    } else if (orden === 'recientes') {
      copia.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    } else {
      copia.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
    }
    return copia;
  };

  if (destacadosPrimero) {
    const activos = ordenarGrupo(resultado.filter((c) => c.activo === true));
    const inactivos = ordenarGrupo(resultado.filter((c) => c.activo !== true));
    resultado = [...activos, ...inactivos];
  } else {
    resultado = ordenarGrupo(resultado);
  }

  return resultado;
}

function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const R = 6371;
  const φ1 = lat1 * rad;
  const φ2 = lat2 * rad;
  const Δφ = (lat2 - lat1) * rad;
  const Δλ = (lon2 - lon1) * rad;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calcularDistanciaConFallback(record, referencia) {
  const latRef = Number(referencia?.lat);
  const lonRef = Number(referencia?.lon);
  const latComercio = Number(record.latitud);
  const lonComercio = Number(record.longitud);

  if (
    Number.isFinite(latRef) &&
    Number.isFinite(lonRef) &&
    Number.isFinite(latComercio) &&
    Number.isFinite(lonComercio)
  ) {
    return calcularDistanciaHaversine(latRef, lonRef, latComercio, lonComercio);
  }

  return null;
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
    const categoriaLabel = estado.categoria || t('listado.titulo');
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
        'bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full hover:bg-blue-200 transition-all';
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
      estado.filtros.subcategoria = valor;
      estado.subcategoriaSeleccionadaId = valor;
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

  if (!contenedorListado) {
    console.error('⚠️ No se encontró el contenedor principal del listado.');
    return;
  }

  if (!contenedorListado.dataset.layoutOriginal) {
    contenedorListado.dataset.layoutOriginal = contenedorListado.className;
  }

  await cargarNombreCategoria();
  await cargarMunicipios();
  if (idCategoriaDesdeURL != null) {
    await cargarSubcategorias(idCategoriaDesdeURL);
  }

  registrarEventos();
  setOrden(estado.filtros.orden);
  await obtenerCoordenadasUsuario();
  await asegurarMunicipioInicial();
  await cargarComercios({ append: false, mostrarLoader: true });
}
