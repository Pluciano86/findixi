import { supabase } from '../shared/supabaseClient.js';
import { t, getLang } from './i18n.js';
import { getEventoI18n } from '../shared/eventoI18n.js';
import { toHorizontalEventImage, withVersion } from '../shared/eventoImage.js';
import { getDrivingDistance, formatTiempo } from '../shared/osrmClient.js';
import { calcularDistanciaHaversineKm, calcularTiempoEnVehiculo } from '../shared/utils.js';

const params = new URLSearchParams(window.location.search);
const idEvento = Number(params.get('id'));

const BOLETERIA_BRAND = {
  prticket: {
    label: 'PRticket',
    logo: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/prtickets.png'
  },
  prtickets: {
    label: 'PRticket',
    logo: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/prtickets.png'
  },
  ticketera: {
    label: 'Ticketera',
    logo: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/ticketera.png'
  },
  pietix: {
    label: 'Pietix',
    logo: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/pietix.png'
  },
};

const loader = document.getElementById('loader');
const nombreEventoEl = document.getElementById('nombreEvento');
const categoriaEventoEl = document.getElementById('categoriaEvento');
const eventoImagenFrameEl = document.getElementById('eventoImagenFrame');
const proximaFechaLabelEl = document.getElementById('proximaFechaLabel');
const fechaPrincipalDiaEl = document.getElementById('fechaPrincipalDia');
const fechaPrincipalRestoEl = document.getElementById('fechaPrincipalResto');
const horaPrincipalEl = document.getElementById('horaPrincipal');
const municipioPrincipalEl = document.getElementById('municipioPrincipal');
const otrasFechasHintEl = document.getElementById('otrasFechasHint');
const otrosMunicipiosHintEl = document.getElementById('otrosMunicipiosHint');
const proximasFechasSectionEl = document.getElementById('proximasFechasSection');
const descripcionSectionEl = document.getElementById('descripcionSection');
const descripcionEventoEl = document.getElementById('descripcionEvento');
const toggleDescripcionEventoEl = document.getElementById('toggleDescripcionEvento');
const listaFechasEventoEl = document.getElementById('listaFechasEvento');
const boletosResumenEl = document.getElementById('boletosResumen');
const boletosPrecioEl = document.getElementById('boletosPrecio');
const boletosLinksEl = document.getElementById('boletosLinks');
const eventoImagenEl = document.getElementById('eventoImagen');
const eventoImagenBgEl = document.getElementById('eventoImagenBg');
const lugarEventoSectionEl = document.getElementById('lugarEventoSection');
const lugarEventoTextoEl = document.getElementById('lugarEventoTexto');
const direccionEventoTextoEl = document.getElementById('direccionEventoTexto');
const tiempoVehiculoEventoEl = document.getElementById('tiempoVehiculoEvento');
const btnEventoGoogleMapsEl = document.getElementById('btnEventoGoogleMaps');
const btnEventoWazeEl = document.getElementById('btnEventoWaze');
let userCoordsPromise = null;
let tiempoVehiculoRequestId = 0;

function scrollToProximasFechas() {
  if (!proximasFechasSectionEl) return;
  proximasFechasSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function makeHintClickable(node) {
  if (!node) return;
  if (node.dataset.scrollBound === 'true') return;
  node.dataset.scrollBound = 'true';
  node.setAttribute('role', 'button');
  node.setAttribute('tabindex', '0');
  node.classList.add('cursor-pointer', 'underline', 'underline-offset-2', 'hover:text-slate-500');
  node.addEventListener('click', scrollToProximasFechas);
  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToProximasFechas();
    }
  });
}

function scrollToImagenEvento() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setTiempoVehiculoEvento(texto = '', visible = true) {
  if (!tiempoVehiculoEventoEl) return;
  if (!visible) {
    tiempoVehiculoEventoEl.classList.add('hidden');
    return;
  }
  tiempoVehiculoEventoEl.innerHTML = `<i class="fas fa-car"></i> ${texto || t('area.noDisponible')}`;
  tiempoVehiculoEventoEl.classList.remove('hidden');
}

function formatearTiempoVehiculoEvento(minutosCrudos = null) {
  const minutos = Number(minutosCrudos);
  if (!Number.isFinite(minutos) || minutos <= 0) return t('area.noDisponible');

  const total = Math.max(1, Math.round(minutos));
  const lang = (getLang?.() || localStorage.getItem('lang') || 'es').toLowerCase().split('-')[0];

  if (lang !== 'es') {
    return `a ${formatTiempo(total * 60)}`;
  }

  if (total < 60) {
    return `a ${total} minuto${total === 1 ? '' : 's'}`;
  }

  const horas = Math.floor(total / 60);
  const minutosRestantes = total % 60;
  const horasTexto = `${horas} hora${horas === 1 ? '' : 's'}`;
  if (!minutosRestantes) return `a ${horasTexto}`;
  return `a ${horasTexto} y ${minutosRestantes} minuto${minutosRestantes === 1 ? '' : 's'}`;
}

function mostrarLoader() {
  loader?.classList.remove('hidden');
  loader?.classList.add('flex');
}

function ocultarLoader() {
  loader?.classList.add('hidden');
  loader?.classList.remove('flex');
}

function obtenerCoordenadasUsuario() {
  if (userCoordsPromise) return userCoordsPromise;
  userCoordsPromise = new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
  return userCoordsPromise;
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizarBoleteriaKey(value = '') {
  return normalizeText(value);
}

function capitalizarPalabra(texto = '') {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function estilizarFechaExtendida(fechaLocale = '') {
  if (!fechaLocale) return '';
  const [primeraParte, ...resto] = fechaLocale.split(', ');
  const primera = capitalizarPalabra(primeraParte);
  let restoTexto = resto.join(', ');

  if (restoTexto) {
    restoTexto = restoTexto.replace(/ de ([a-záéíóúñ]+)/gi, (_, palabra) => ` de ${capitalizarPalabra(palabra)}`);
    restoTexto = restoTexto.replace(/\sde\s(\d{4})$/i, ' $1');
  }

  return restoTexto ? `${primera}, ${restoTexto}` : primera;
}

function getLocale() {
  const lang = (getLang?.() || localStorage.getItem('lang') || document.documentElement.lang || 'es')
    .toLowerCase()
    .split('-')[0];
  const map = {
    es: 'es-PR',
    en: 'en-US',
    fr: 'fr-FR',
    de: 'de-DE',
    pt: 'pt-PT',
    it: 'it-IT',
    zh: 'zh-CN',
    ko: 'ko-KR',
    ja: 'ja-JP'
  };
  return map[lang] || 'es-PR';
}

function formatearFecha(fechaISO = '') {
  const [year, month, day] = String(fechaISO).split('-').map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) return t('area.sinFecha');
  const fecha = new Date(Date.UTC(year, month - 1, day));
  const base = fecha.toLocaleDateString(getLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
  return estilizarFechaExtendida(base);
}

function formatearHora(horaStr = '') {
  if (!horaStr) return '';
  const [hourPart, minutePart] = String(horaStr).split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  const fecha = new Date(Date.UTC(1970, 0, 1, hour, minute));
  return fecha.toLocaleTimeString(getLocale(), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

function obtenerPartesFecha(fechaISO = '') {
  const completa = formatearFecha(fechaISO);
  if (!completa || completa === t('area.sinFecha')) return null;
  const [weekday, resto] = completa.split(', ');
  return {
    weekday: weekday || completa,
    resto: resto || '',
  };
}

function sortFechas(a, b) {
  const keyA = `${a.fecha || ''} ${a.horainicio || ''}`;
  const keyB = `${b.fecha || ''} ${b.horainicio || ''}`;
  return keyA.localeCompare(keyB);
}

function getPrimarySourceKey(evento, boleterias = []) {
  const direct = normalizarBoleteriaKey(evento?.source || '');
  if (direct) return direct;
  const first = boleterias[0] || {};
  return normalizarBoleteriaKey(first.logo_key || first.source || '');
}

function applyEventImageStyle(sourceKey = '') {
  if (!eventoImagenEl || !eventoImagenBgEl) return;

  const source = normalizarBoleteriaKey(sourceKey);

  eventoImagenBgEl.style.objectFit = 'cover';
  eventoImagenBgEl.style.objectPosition = 'center center';
  eventoImagenBgEl.style.transform = 'scale(1.12)';
  eventoImagenBgEl.style.filter = 'blur(16px)';
  eventoImagenBgEl.style.opacity = '1';

  if (source === 'ticketera') {
    eventoImagenEl.style.objectFit = 'contain';
    eventoImagenEl.style.objectPosition = 'center center';
    eventoImagenEl.style.width = '100%';
    eventoImagenEl.style.height = 'auto';
    eventoImagenEl.style.maxWidth = 'none';
    eventoImagenEl.style.maxHeight = 'none';
    return;
  }

  if (source === 'prticket' || source === 'prtickets') {
    eventoImagenEl.style.objectFit = 'contain';
    eventoImagenEl.style.objectPosition = 'center center';
    eventoImagenEl.style.width = 'auto';
    eventoImagenEl.style.height = '100%';
    eventoImagenEl.style.maxWidth = 'none';
    eventoImagenEl.style.maxHeight = 'none';
    return;
  }

  if (source === 'pietix') {
    eventoImagenEl.style.objectFit = 'contain';
    eventoImagenEl.style.objectPosition = 'center center';
    eventoImagenEl.style.width = '100%';
    eventoImagenEl.style.height = '100%';
    eventoImagenEl.style.maxWidth = '100%';
    eventoImagenEl.style.maxHeight = '100%';
    return;
  }

  eventoImagenEl.style.objectFit = 'cover';
  eventoImagenEl.style.objectPosition = 'center center';
  eventoImagenEl.style.width = '100%';
  eventoImagenEl.style.height = '100%';
  eventoImagenEl.style.maxWidth = '100%';
  eventoImagenEl.style.maxHeight = '100%';
}

function normalizarMonto(texto = '') {
  const val = String(texto || '').trim();
  if (!val) return '';
  const sinSimbolo = val.replace(/^\s*\$\s*/, '');
  const esNumero = /^[\d,.]+$/.test(sinSimbolo);
  if (!val.startsWith('$') && esNumero) return `$${sinSimbolo}`;
  return val;
}

function costoParaVista(evento = {}) {
  if (evento.gratis) return t('eventos.gratis');
  const costoRaw = evento.costo != null ? String(evento.costo).trim() : '';
  if (!costoRaw) return '';
  const costoConSimbolo = /^[\d,.]+$/.test(costoRaw) && !costoRaw.startsWith('$')
    ? `$${costoRaw}`
    : costoRaw;

  if (costoConSimbolo.toLowerCase().startsWith('desde')) {
    return `desde ${normalizarMonto(costoConSimbolo.replace(/^desde\s*:?/i, '').trim())}`;
  }
  if (costoConSimbolo.toLowerCase().startsWith('costo')) {
    const sinLabel = costoConSimbolo.replace(/^costo\s*:?/i, '').trim();
    return normalizarMonto(sinLabel);
  }
  return normalizarMonto(costoConSimbolo);
}

function construirTextoGps(lugar = '', municipio = '', direccion = '') {
  const lugarLimpio = limpiarLugarMostrado(lugar, municipio, direccion);
  const direccionLimpia = limpiarDireccionMostrada(direccion, municipio, lugarLimpio);
  const partes = [lugarLimpio, municipio, direccionLimpia].map((item) => String(item || '').trim()).filter(Boolean);
  if (!partes.length) return '';
  return `${partes.join(', ')}, Puerto Rico`;
}

function esLugarGenerico(valor = '') {
  const norm = normalizeText(valor).replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return !norm || ['multiple location', 'multiple locations', 'multiple'].includes(norm);
}

function limpiarLugarMostrado(lugar = '', municipio = '', direccion = '') {
  const lugarTxt = String(lugar || '').trim();
  if (!esLugarGenerico(lugarTxt)) return lugarTxt;
  const direccionTxt = String(direccion || '').trim();
  if (direccionTxt && !esLugarGenerico(direccionTxt)) return direccionTxt;
  return String(municipio || '').trim();
}

function limpiarDireccionMostrada(direccion = '', municipio = '', lugar = '') {
  const direccionTxt = String(direccion || '').trim();
  if (!direccionTxt) return '';
  const norm = normalizeText(direccionTxt);
  if (norm.startsWith('. -') || norm === '.' || norm === '-' || norm.includes('multiple location')) return '';
  const municipioNorm = normalizeText(municipio || '');
  const lugarNorm = normalizeText(lugar || '');
  if (municipioNorm && norm.includes(municipioNorm) && lugarNorm && norm === lugarNorm) return '';
  return direccionTxt;
}

async function resolverCoordenadasEvento(municipioId, lugar, direccion) {
  if (!Number.isFinite(Number(municipioId)) || !lugar) return null;
  try {
    const { data, error } = await supabase
      .from('evento_localidades')
      .select('latitud,longitud,direccion_formateada,nombre')
      .eq('municipio_id', Number(municipioId))
      .ilike('nombre', `%${String(lugar).trim()}%`)
      .limit(5);

    if (error || !Array.isArray(data) || !data.length) return null;

    const direccionNorm = normalizeText(direccion || '');
    const match = data.find((row) => {
      const dirRow = normalizeText(row?.direccion_formateada || '');
      return direccionNorm && dirRow && (dirRow.includes(direccionNorm) || direccionNorm.includes(dirRow));
    }) || data[0];

    const lat = Number(match?.latitud);
    const lon = Number(match?.longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

async function calcularTiempoVehiculoEvento(destinoLat, destinoLon) {
  const requestId = ++tiempoVehiculoRequestId;
  if (!Number.isFinite(destinoLat) || !Number.isFinite(destinoLon)) {
    setTiempoVehiculoEvento('', false);
    return;
  }

  setTiempoVehiculoEvento(t('common.cargando'));
  const origen = await obtenerCoordenadasUsuario();
  if (requestId !== tiempoVehiculoRequestId) return;
  if (!origen || !Number.isFinite(origen.lat) || !Number.isFinite(origen.lon)) {
    setTiempoVehiculoEvento(t('area.noDisponible'));
    return;
  }

  let minutosEstimados = null;
  const osrm = await getDrivingDistance(
    { lat: origen.lat, lng: origen.lon },
    { lat: destinoLat, lng: destinoLon }
  );

  if (osrm?.duracion != null) {
    minutosEstimados = Math.round(osrm.duracion / 60);
  } else {
    const distanciaKm = calcularDistanciaHaversineKm(origen.lat, origen.lon, destinoLat, destinoLon);
    if (Number.isFinite(distanciaKm) && distanciaKm >= 0) {
      const fallback = calcularTiempoEnVehiculo(distanciaKm);
      minutosEstimados = fallback?.minutos ?? null;
    }
  }

  if (requestId !== tiempoVehiculoRequestId) return;
  setTiempoVehiculoEvento(formatearTiempoVehiculoEvento(minutosEstimados));
}

async function cargarEvento() {
  if (!Number.isFinite(idEvento) || idEvento <= 0) {
    nombreEventoEl.textContent = 'Evento no encontrado';
    descripcionEventoEl.textContent = 'No se recibió un identificador válido del evento.';
    return;
  }

  mostrarLoader();
  makeHintClickable(otrasFechasHintEl);
  makeHintClickable(otrosMunicipiosHintEl);

  try {
    const selectBase = `
        id,
        nombre,
        descripcion,
        costo,
        gratis,
        categoria,
        imagen,
        enlaceboletos,
        boletos_por_localidad,
        eventos_municipios (
          id,
          municipio_id,
          lugar,
          direccion,
          enlaceboletos,
          eventoFechas (id, fecha, horainicio, mismahora)
        )
      `;
    const selectConSource = `
        id,
        source,
        source_event_id,
        nombre,
        descripcion,
        costo,
        gratis,
        categoria,
        imagen,
        enlaceboletos,
        boletos_por_localidad,
        eventos_municipios (
          id,
          municipio_id,
          lugar,
          direccion,
          enlaceboletos,
          eventoFechas (id, fecha, horainicio, mismahora)
        )
      `;

    let eventoRaw = null;
    let eventoError = null;

    ({ data: eventoRaw, error: eventoError } = await supabase
      .from('eventos')
      .select(selectConSource)
      .eq('id', idEvento)
      .maybeSingle());

    const errorLower = [
      eventoError?.message,
      eventoError?.details,
      eventoError?.hint,
      eventoError?.code
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' | ');
    const fallbackPorSchema =
      errorLower.includes('source') ||
      errorLower.includes('source_event_id') ||
      errorLower.includes('schema cache') ||
      errorLower.includes('does not exist') ||
      errorLower.includes('could not find');

    if (eventoError && fallbackPorSchema) {
      console.warn('[perfilEvento] Fallback por esquema desactualizado:', eventoError);
      const { data: eventoBase, error: errorBase } = await supabase
        .from('eventos')
        .select(selectBase)
        .eq('id', idEvento)
        .maybeSingle();
      eventoRaw = eventoBase
        ? {
            ...eventoBase,
            source: '',
            source_event_id: '',
          }
        : null;
      eventoError = errorBase;
    }

    if (eventoError || !eventoRaw) {
      throw new Error(eventoError?.message || 'Evento no encontrado');
    }

    const municipioIds = Array.from(new Set(
      (eventoRaw.eventos_municipios || [])
        .map((sede) => Number(sede.municipio_id))
        .filter((value) => Number.isFinite(value) && value > 0)
    ));

    let municipioById = new Map();
    if (municipioIds.length) {
      const { data: municipiosRows } = await supabase
        .from('Municipios')
        .select('id,nombre')
        .in('id', municipioIds);
      municipioById = new Map((municipiosRows || []).map((item) => [Number(item.id), item.nombre || '']));
    }

    const fechas = [];
    for (const sede of eventoRaw.eventos_municipios || []) {
      const municipioNombre = municipioById.get(Number(sede.municipio_id)) || '';
      for (const item of sede.eventoFechas || []) {
        fechas.push({
          id: item.id,
          fecha: item.fecha,
          horainicio: item.horainicio,
          mismahora: item.mismahora ?? false,
          municipio_id: sede.municipio_id,
          municipioNombre,
          lugar: sede.lugar || '',
          direccion: sede.direccion || '',
          enlaceboletos: sede.enlaceboletos || ''
        });
      }
    }

    fechas.sort(sortFechas);

    const { data: categoriaData } = await supabase
      .from('categoriaEventos')
      .select('id,nombre,icono')
      .eq('id', eventoRaw.categoria)
      .maybeSingle();

    const { data: boleteriasData } = await supabase
      .from('eventos_boleterias')
      .select('source,source_display,logo_key,url_evento,prioridad,activo')
      .eq('evento_id', idEvento)
      .eq('activo', true)
      .order('prioridad', { ascending: true });

    const langNorm = (getLang?.() || localStorage.getItem('lang') || 'es').toLowerCase().split('-')[0];

    const eventoNormalizado = {
      ...eventoRaw,
      categoriaNombre: categoriaData?.nombre || '',
      categoriaIcono: categoriaData?.icono || '',
      fechas,
      eventoFechas: fechas,
      municipioIds,
      municipioNombre: municipioIds.length > 1
        ? t('evento.variosMunicipios')
        : (municipioById.get(municipioIds[0]) || ''),
      boleterias: (boleteriasData || []).map((item) => ({ ...item }))
    };

    const evento = langNorm !== 'es'
      ? await getEventoI18n(eventoNormalizado, langNorm).catch(() => eventoNormalizado)
      : eventoNormalizado;

    document.title = `${evento.nombre || 'Evento'} | Findixi`;
    nombreEventoEl.textContent = evento.nombre || 'Evento';

    const iconoCategoria = evento.categoriaIcono ? `<i class="fas ${evento.categoriaIcono}"></i>` : '';
    categoriaEventoEl.innerHTML = `${iconoCategoria}<span>${evento.categoriaNombre || ''}</span>`;

    const imagenEvento = withVersion(
      toHorizontalEventImage(evento.imagen) || 'https://placehold.co/1280x720?text=Evento',
      evento.id
    );
    eventoImagenEl.src = imagenEvento;
    eventoImagenBgEl.src = imagenEvento;
    eventoImagenEl.alt = evento.nombre || 'Evento';

    const sourceKey = getPrimarySourceKey(evento, evento.boleterias || []);
    applyEventImageStyle(sourceKey);

    const hoyISO = new Date().toISOString().slice(0, 10);
    const proxima = fechas.find((item) => item.fecha >= hoyISO) || fechas[0] || null;
    const fechaKey = (item, idx = 0) => `${item?.id || 0}|${item?.fecha || ''}|${item?.horainicio || ''}|${item?.municipio_id || ''}|${idx}`;
    let selectedFechaKey = proxima ? fechaKey(proxima, fechas.findIndex((it) => it === proxima)) : '';

    const actualizarLugarGpsDesdeFecha = async (fechaItem) => {
      if (!fechaItem) {
        lugarEventoSectionEl.classList.add('hidden');
        return;
      }
      lugarEventoSectionEl.classList.remove('hidden');
      const lugarTexto = limpiarLugarMostrado(fechaItem.lugar, fechaItem.municipioNombre, fechaItem.direccion) || t('area.noDisponible');
      const direccionTexto = limpiarDireccionMostrada(fechaItem.direccion, fechaItem.municipioNombre, lugarTexto);
      lugarEventoTextoEl.textContent = lugarTexto;
      direccionEventoTextoEl.textContent = '';
      direccionEventoTextoEl.classList.add('hidden');

      const coords = await resolverCoordenadasEvento(fechaItem.municipio_id, lugarTexto, direccionTexto || fechaItem.direccion);
      if (coords) {
        btnEventoGoogleMapsEl.href = `https://www.google.com/maps?q=${coords.lat},${coords.lon}`;
        btnEventoWazeEl.href = `https://waze.com/ul?ll=${coords.lat},${coords.lon}&navigate=yes`;
        await calcularTiempoVehiculoEvento(coords.lat, coords.lon);
      } else {
        const queryText = construirTextoGps(lugarTexto, fechaItem.municipioNombre, direccionTexto || fechaItem.direccion);
        const encoded = encodeURIComponent(queryText || `${evento.nombre || 'Evento'} Puerto Rico`);
        btnEventoGoogleMapsEl.href = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
        btnEventoWazeEl.href = `https://waze.com/ul?q=${encoded}&navigate=yes`;
        setTiempoVehiculoEvento('', false);
      }
    };

    const actualizarBloquePrincipal = async (fechaItem) => {
      if (!fechaItem) {
        fechaPrincipalDiaEl.textContent = t('area.sinFecha');
        fechaPrincipalRestoEl.textContent = '';
        horaPrincipalEl.textContent = t('area.noDisponible');
        municipioPrincipalEl.textContent = t('area.noDisponible');
        lugarEventoSectionEl.classList.add('hidden');
        return;
      }

      const fechaDetalle = obtenerPartesFecha(fechaItem.fecha);
      fechaPrincipalDiaEl.textContent = fechaDetalle?.weekday || t('area.sinFecha');
      fechaPrincipalRestoEl.textContent = fechaDetalle?.resto || '';
      horaPrincipalEl.textContent = formatearHora(fechaItem.horainicio) || t('area.noDisponible');
      municipioPrincipalEl.textContent = fechaItem.municipioNombre || evento.municipioNombre || t('evento.variosMunicipios');
      await actualizarLugarGpsDesdeFecha(fechaItem);
    };

    const municipiosUnicos = Array.from(new Set(fechas.map((item) => item.municipioNombre).filter(Boolean)));
    if (fechas.length > 1) {
      otrasFechasHintEl.textContent = t('evento.otrasFechasDisponibles');
      otrasFechasHintEl.classList.remove('hidden');
    }
    if (municipiosUnicos.length > 1) {
      otrosMunicipiosHintEl.textContent = t('evento.otrosMunicipiosDisponibles');
      otrosMunicipiosHintEl.classList.remove('hidden');
    }

    const descripcion = String(evento.descripcion || '').trim();
    if (!descripcion) {
      descripcionSectionEl.classList.add('hidden');
    } else {
      descripcionSectionEl.classList.remove('hidden');
      descripcionEventoEl.textContent = descripcion;
      let descripcionExpandida = false;
      toggleDescripcionEventoEl.addEventListener('click', () => {
        descripcionExpandida = !descripcionExpandida;
        descripcionEventoEl.classList.toggle('line-clamp-6', !descripcionExpandida);
        toggleDescripcionEventoEl.textContent = descripcionExpandida
          ? 'Ocultar información'
          : 'Ver toda la información';
      });
    }

    const renderSelectorFechas = () => {
      if (!fechas.length) {
        listaFechasEventoEl.innerHTML = `<li class="text-center text-slate-500">No hay fechas disponibles.</li>`;
        return;
      }

      listaFechasEventoEl.innerHTML = fechas
        .map((item, idx) => {
          const key = fechaKey(item, idx);
          const isActive = key === selectedFechaKey;
          const fechaDetalle = obtenerPartesFecha(item.fecha);
          const horaTxt = formatearHora(item.horainicio) || t('area.noDisponible');
          const municipioTxt = item.municipioNombre || t('area.noDisponible');
          const lugarTxt = limpiarLugarMostrado(item.lugar, item.municipioNombre, item.direccion) || t('area.noDisponible');
          return `
            <li>
              <button
                type="button"
                data-fecha-key="${key}"
                class="w-full rounded-xl border px-3 py-3 text-sm transition ${
                  isActive
                    ? 'border-[#23B4E9] bg-sky-50 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }">
                <div class="text-center">
                  <div class="text-red-700 font-semibold leading-tight text-lg">${fechaDetalle?.weekday || t('area.sinFecha')}</div>
                  <div class="text-red-600 font-semibold leading-tight text-xl">${fechaDetalle?.resto || ''}</div>
                </div>
                <div class="mt-2 rounded-lg border border-sky-100 bg-sky-50/70 px-2 py-2 text-center">
                  <div class="text-slate-700 font-semibold text-base leading-tight">${horaTxt}</div>
                  <div class="mt-1 flex items-center justify-center gap-1 font-medium" style="color:#23B4E9;">
                    <i class="fa-solid fa-map-pin"></i>
                    <span>${municipioTxt}</span>
                  </div>
                  <div class="mt-1 text-slate-600 font-medium leading-tight">${lugarTxt}</div>
                </div>
              </button>
            </li>
          `;
        })
        .join('');

      listaFechasEventoEl.querySelectorAll('button[data-fecha-key]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const key = btn.getAttribute('data-fecha-key');
          if (!key) return;
          selectedFechaKey = key;
          const index = fechas.findIndex((item, idx) => fechaKey(item, idx) === key);
          const fechaSeleccionada = index >= 0 ? fechas[index] : null;
          await actualizarBloquePrincipal(fechaSeleccionada);
          if (proximaFechaLabelEl) {
            proximaFechaLabelEl.textContent = '';
            proximaFechaLabelEl.classList.add('hidden');
          }
          scrollToImagenEvento();
          renderSelectorFechas();
        });
      });
    };

    await actualizarBloquePrincipal(proxima);
    renderSelectorFechas();

    const precioBoletos = costoParaVista(evento);
    if (precioBoletos) {
      boletosPrecioEl.textContent = `Boletos ${precioBoletos}`;
      boletosPrecioEl.classList.remove('hidden');
    } else {
      boletosPrecioEl.textContent = '';
      boletosPrecioEl.classList.add('hidden');
    }
    boletosResumenEl.textContent = 'disponibles en';

    const boleterias = (evento.boleterias || []).filter((item) => item.url_evento);
    if (!boleterias.length && evento.enlaceboletos) {
      boleterias.push({
        source: sourceKey || 'boleteria',
        source_display: 'Boletería',
        logo_key: sourceKey || 'boleteria',
        url_evento: evento.enlaceboletos,
      });
    }

    if (!boleterias.length) {
      boletosLinksEl.innerHTML = '<p class="text-slate-500 text-sm">No hay enlaces de boletos disponibles.</p>';
    } else {
      boletosLinksEl.innerHTML = boleterias
        .map((item) => {
          const key = normalizarBoleteriaKey(item.logo_key || item.source || '');
          const brand = BOLETERIA_BRAND[key];
          const label = item.source_display || brand?.label || item.source || 'Boletería';
          const logo = brand?.logo
            ? `<img src="${brand.logo}" alt="${label}" class="h-6 w-auto object-contain" loading="lazy" />`
            : `<i class="fa-solid fa-ticket text-slate-600 text-lg" aria-hidden="true"></i>`;

          return `
            <a href="${item.url_evento}" target="_blank" rel="noopener noreferrer"
               class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 hover:bg-slate-50 transition"
               aria-label="${label}">
              ${logo}
            </a>
          `;
        })
        .join('');
    }
  } catch (error) {
    console.error('Error cargando perfil de evento:', error);
    nombreEventoEl.textContent = 'No pudimos cargar este evento';
    descripcionEventoEl.textContent = 'Intenta nuevamente en unos segundos.';
    listaFechasEventoEl.innerHTML = '';
    boletosLinksEl.innerHTML = '';
    boletosResumenEl.textContent = '';
  } finally {
    ocultarLoader();
  }
}

document.addEventListener('DOMContentLoaded', cargarEvento);
