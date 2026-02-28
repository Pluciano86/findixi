import { calcularDistanciaHaversineKm, calcularTiempoEnVehiculo } from '../utils/distance.js';

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizarTextoListado(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function formatearTiempoVehiculoLargo(minutosTotales) {
  if (!Number.isFinite(minutosTotales) || minutosTotales < 0) return 'N/D';

  const total = Math.round(minutosTotales);
  const horas = Math.floor(total / 60);
  const minutos = total % 60;

  if (horas > 0 && minutos > 0) {
    return `a ${horas} hora${horas > 1 ? 's' : ''} ${minutos} minuto${minutos > 1 ? 's' : ''}`;
  }
  if (horas > 0) {
    return `a ${horas} hora${horas > 1 ? 's' : ''}`;
  }
  return `a ${minutos} minuto${minutos !== 1 ? 's' : ''}`;
}

export function calcularDistanciaListadoConFallback(record, referencia) {
  const latRef = toFiniteNumber(referencia?.lat);
  const lonRef = toFiniteNumber(referencia?.lon);
  const latComercio = toFiniteNumber(record?.latitud);
  const lonComercio = toFiniteNumber(record?.longitud);

  if (
    Number.isFinite(latRef) &&
    Number.isFinite(lonRef) &&
    Number.isFinite(latComercio) &&
    Number.isFinite(lonComercio)
  ) {
    return calcularDistanciaHaversineKm(latRef, lonRef, latComercio, lonComercio);
  }

  const distanceRaw = toFiniteNumber(record?.distanciaKm);
  return Number.isFinite(distanceRaw) ? distanceRaw : null;
}

export function buildListadoComerciosRpcPayload(options = {}) {
  const {
    textoBusqueda = '',
    municipio = '',
    municipioDetectado = '',
    municipioSeleccionadoManualmente = true,
    usarMunicipioDetectado = false,
    categoria = null,
    subcategoria = null,
    abiertoAhora = false,
    coordsUsuario = null,
    tienePermisoUbicacion = false,
    limit = 25,
    offset = 0,
  } = options;

  const texto = String(textoBusqueda || '').trim();
  const usandoBusquedaTexto = texto.length > 0;
  const municipioManual = String(municipio || '').trim();
  const municipioAuto = String(municipioDetectado || '').trim();

  const municipioFiltro =
    municipioSeleccionadoManualmente && municipioManual
      ? municipioManual
      : usarMunicipioDetectado && municipioAuto
        ? municipioAuto
        : null;

  const lat = toFiniteNumber(coordsUsuario?.lat);
  const lon = toFiniteNumber(coordsUsuario?.lon);
  const puedeUsarCoords = !usandoBusquedaTexto && Boolean(tienePermisoUbicacion) && Number.isFinite(lat) && Number.isFinite(lon);

  return {
    p_texto: usandoBusquedaTexto ? texto : null,
    p_municipio: usandoBusquedaTexto ? null : municipioFiltro,
    p_categoria: toFiniteNumber(categoria),
    p_subcategoria: toFiniteNumber(subcategoria),
    p_activo: null,
    p_latitud: puedeUsarCoords ? lat : null,
    p_longitud: puedeUsarCoords ? lon : null,
    p_radio: null,
    p_limit: Math.max(1, Number(limit) || 25),
    p_offset: Math.max(0, Number(offset) || 0),
    p_abierto_ahora: abiertoAhora === true ? true : null,
  };
}

export function normalizarComercioListadoDesdeRpc(record, options = {}) {
  const referencia = options?.referencia || null;
  const distanciaKm = calcularDistanciaListadoConFallback(record, referencia);
  const tiempo = Number.isFinite(distanciaKm) ? calcularTiempoEnVehiculo(distanciaKm) : { minutos: null };
  const minutosTotales = Number.isFinite(tiempo?.minutos) ? tiempo.minutos : null;
  const tiempoTexto = formatearTiempoVehiculoLargo(minutosTotales);
  const abiertoRaw = record?.abierto_ahora;
  const abiertoBool = typeof abiertoRaw === 'boolean' ? abiertoRaw : Boolean(abiertoRaw);

  return {
    ...record,
    id: Number(record?.id),
    nombre: record?.nombre ?? 'Sin nombre',
    telefono: record?.telefono ?? '',
    pueblo: record?.municipio ?? record?.pueblo ?? '',
    municipio: record?.municipio ?? record?.pueblo ?? '',
    latitud: toFiniteNumber(record?.latitud),
    longitud: toFiniteNumber(record?.longitud),
    distanciaKm: Number.isFinite(distanciaKm) ? distanciaKm : null,
    minutosEstimados: minutosTotales,
    minutosCrudos: minutosTotales,
    tiempoVehiculo: tiempoTexto,
    tiempoTexto,
    abierto: abiertoBool,
    abiertoAhora: abiertoBool,
    abierto_ahora: abiertoBool,
    raw: record,
  };
}

function compareByOrder(a, b, orden, referencia) {
  if (orden === 'az') {
    return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es');
  }

  if (orden === 'recientes') {
    return Number(b?.id || 0) - Number(a?.id || 0);
  }

  const distanciaA = calcularDistanciaListadoConFallback(a, referencia);
  const distanciaB = calcularDistanciaListadoConFallback(b, referencia);
  if (distanciaA == null && distanciaB == null) {
    return String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es');
  }
  if (distanciaA == null) return 1;
  if (distanciaB == null) return -1;
  return distanciaA - distanciaB;
}

export function ordenarYFiltrarListadoComercios(lista = [], options = {}) {
  const {
    orden = 'az',
    favoritos = false,
    destacadosPrimero = true,
    abiertoAhora = false,
    favoritosSet = null,
    referencia = null,
  } = options;

  let resultado = Array.isArray(lista) ? [...lista] : [];

  if (abiertoAhora) {
    resultado = resultado.filter(
      (c) => c?.abierto_ahora === true || c?.abiertoAhora === true || c?.abierto === true
    );
  }

  if (favoritos) {
    resultado = resultado.filter((c) => {
      if (c?.favorito === true) return true;
      if (!favoritosSet) return false;
      return favoritosSet.has(c?.id) || favoritosSet.has(String(c?.id));
    });
  }

  const ordenarGrupo = (grupo) =>
    [...grupo].sort((a, b) => compareByOrder(a, b, orden, referencia));

  if (!destacadosPrimero) {
    return ordenarGrupo(resultado);
  }

  const activos = ordenarGrupo(resultado.filter((c) => c?.activo === true));
  const inactivos = ordenarGrupo(resultado.filter((c) => c?.activo !== true));
  return [...activos, ...inactivos];
}
