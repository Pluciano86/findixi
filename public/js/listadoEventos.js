// listadoEventos.js
import { supabase } from '../shared/supabaseClient.js';
import { mostrarMensajeVacio, mostrarError, mostrarCargando } from './mensajesUI.js';
import { createGlobalBannerElement, destroyCarousel } from './bannerCarousel.js';
import { t, getLang } from './i18n.js';
import { toHorizontalEventImage, withVersion } from '../shared/eventoImage.js';
import { EVENT_IMAGE_FOCUS_OVERRIDES } from '../shared/eventoImageFocusOverrides.js';

const lista = document.getElementById('listaEventos');
const filtroMunicipio = document.getElementById('filtroMunicipio');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroOrden = document.getElementById('filtroOrden');
const busquedaNombre = document.getElementById('busquedaNombre');

const btnHoy = document.getElementById('btnHoy');
const btnSemana = document.getElementById('btnSemana');
const btnMes = document.getElementById('btnMes');
const btnGratis = document.getElementById('btnGratis');
const filtroBoleteriasEl = document.getElementById('filtroBoleterias');

// Estado
let eventos = [];
let municipios = {};
let categorias = {};
let filtroHoy = false;
let filtroSemana = false;
let filtroMes = false;
let filtroGratis = false;
let filtroBoleteriasSeleccionadas = new Set();
let boleteriasDisponibles = [];
let renderVersion = 0;
const focusDetectCache = new Map();
const boleteriasByEventoId = new Map();

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

const cleanupCarousels = (container) => {
  if (!container) return;
  container
    .querySelectorAll(`[data-banner-carousel="true"]`)
    .forEach(destroyCarousel);
};

async function renderTopBannerEventos() {
  const filtrosSection = document.querySelector('section.p-4');
  if (!filtrosSection) return;

  let topContainer = document.querySelector('[data-banner-slot="top-eventos"]');
  if (!topContainer) {
    topContainer = document.createElement('div');
    topContainer.dataset.bannerSlot = 'top-eventos';
    filtrosSection.parentNode?.insertBefore(topContainer, filtrosSection);
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

function ordenarFechas(fechas = []) {
  return [...fechas].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function eventoExpirado(evento) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const ultFecha = evento.fechas?.length ? evento.fechas[evento.fechas.length - 1].fecha : null;
  return ultFecha && ultFecha < hoyISO;
}

function obtenerProximaFecha(evento) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const ordenadas = ordenarFechas(evento.fechas);
  return ordenadas.find((item) => item.fecha >= hoyISO) || ordenadas[ordenadas.length - 1] || null;
}

function obtenerProximaFechaDesdeLista(fechas = []) {
  const hoyISO = new Date().toISOString().slice(0, 10);
  const ordenadas = ordenarFechas(fechas);
  return ordenadas.find((item) => item.fecha >= hoyISO) || ordenadas[0] || null;
}

function crearFechaLocal(fechaISO = '') {
  const [year, month, day] = String(fechaISO).split('-').map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) return null;
  return new Date(year, month - 1, day);
}

function fechaEsHoy(fechaISO = '') {
  const fecha = crearFechaLocal(fechaISO);
  if (!fecha) return false;
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

function fechaEstaEnSemanaActual(fechaISO = '') {
  const fecha = crearFechaLocal(fechaISO);
  if (!fecha) return false;

  const hoy = new Date();
  const inicioSemana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - hoy.getDay());
  const finSemana = new Date(inicioSemana.getFullYear(), inicioSemana.getMonth(), inicioSemana.getDate() + 6);

  inicioSemana.setHours(0, 0, 0, 0);
  finSemana.setHours(23, 59, 59, 999);

  return fecha >= inicioSemana && fecha <= finSemana;
}

function fechaEstaEnMesActual(fechaISO = '') {
  const fecha = crearFechaLocal(fechaISO);
  if (!fecha) return false;
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth()
  );
}

function filtrarFechasPorMunicipio(fechas = [], municipioId = null) {
  if (!municipioId) return Array.isArray(fechas) ? fechas : [];
  return (Array.isArray(fechas) ? fechas : []).filter((item) => Number(item.municipio_id) === Number(municipioId));
}

function filtrarFechasPorPeriodo(fechas = []) {
  const base = Array.isArray(fechas) ? fechas : [];
  if (filtroHoy) return base.filter((item) => fechaEsHoy(item.fecha));
  if (filtroSemana) return base.filter((item) => fechaEstaEnSemanaActual(item.fecha));
  if (filtroMes) return base.filter((item) => fechaEstaEnMesActual(item.fecha));
  return base;
}

function obtenerFechasVisibles(evento, municipioId = null, fallbackBase = false) {
  const base = filtrarFechasPorMunicipio(evento?.fechas || [], municipioId);
  const filtradas = filtrarFechasPorPeriodo(base);
  if (fallbackBase && filtradas.length === 0) return base;
  return filtradas;
}

function normalizarBoleteriaKey(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getBoleteriaLabel(key = '') {
  const brand = BOLETERIA_BRAND[key];
  if (brand?.label) return brand.label;
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Boletería';
}

function getBoleteriaSortRank(key = '') {
  const order = ['prticket', 'prtickets', 'ticketera', 'pietix'];
  const idx = order.indexOf(key);
  return idx >= 0 ? idx : 999;
}

function getBoleteriasDeEvento(eventoId) {
  const list = boleteriasByEventoId.get(Number(eventoId)) || [];
  const unique = [];
  const seen = new Set();
  for (const item of list) {
    const key = normalizarBoleteriaKey(item.logo_key || item.source || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function getBoleteriaKeysDeEvento(eventoId) {
  return getBoleteriasDeEvento(eventoId)
    .map((item) => normalizarBoleteriaKey(item.logo_key || item.source || ''))
    .filter(Boolean);
}

function actualizarBoleteriasDisponibles() {
  const keys = new Set();
  for (const [, items] of boleteriasByEventoId) {
    for (const item of items || []) {
      const key = normalizarBoleteriaKey(item.logo_key || item.source || '');
      if (key) keys.add(key);
    }
  }
  boleteriasDisponibles = Array.from(keys).sort((a, b) => {
    const rank = getBoleteriaSortRank(a) - getBoleteriaSortRank(b);
    if (rank !== 0) return rank;
    return getBoleteriaLabel(a).localeCompare(getBoleteriaLabel(b));
  });

  const nextSelected = new Set();
  for (const key of filtroBoleteriasSeleccionadas) {
    if (keys.has(key)) nextSelected.add(key);
  }
  filtroBoleteriasSeleccionadas = nextSelected;
}

function renderFiltroBoleterias() {
  if (!filtroBoleteriasEl) return;
  if (!boleteriasDisponibles.length) {
    filtroBoleteriasEl.innerHTML = '';
    return;
  }

  filtroBoleteriasEl.innerHTML = boleteriasDisponibles
    .map((key) => {
      const checked = filtroBoleteriasSeleccionadas.has(key);
      const brand = BOLETERIA_BRAND[key];
      const label = getBoleteriaLabel(key);
      const logoHtml = brand?.logo
        ? `<img src="${brand.logo}" alt="${label}" class="h-4 w-auto object-contain" loading="lazy" />`
        : `<i class="fa-solid fa-ticket text-[11px]"></i>`;

      return `
        <label class="inline-flex w-full items-center justify-center rounded-full h-9 cursor-pointer transition ${
          checked
            ? 'border-2 border-[#23B4E9] bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-200'
            : 'border-transparent bg-transparent text-slate-600'
        }">
          <input type="checkbox" data-boleteria-key="${key}" class="sr-only" ${checked ? 'checked' : ''} />
          ${logoHtml}
        </label>
      `;
    })
    .join('');

  filtroBoleteriasEl.querySelectorAll('input[data-boleteria-key]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const key = normalizarBoleteriaKey(e.target?.getAttribute('data-boleteria-key') || '');
      if (!key) return;
      if (e.target.checked) filtroBoleteriasSeleccionadas.add(key);
      else filtroBoleteriasSeleccionadas.delete(key);
      renderFiltroBoleterias();
      renderizarEventos();
    });
  });
}

function renderBoleteriasInline(eventoId) {
  const items = getBoleteriasDeEvento(eventoId);
  if (!items.length) return `<span class="text-gray-400">${t('area.noDisponible')}</span>`;
  return items
    .map((item) => {
      const key = normalizarBoleteriaKey(item.logo_key || item.source || '');
      const brand = BOLETERIA_BRAND[key];
      const label = item.source_display || item.source || 'Boletería';
      if (brand?.logo) {
        return `<img src="${brand.logo}" alt="${brand.label}" title="${brand.label}" class="h-4 sm:h-5 w-auto object-contain" loading="lazy" />`;
      }
      return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-[2px] text-[11px] font-semibold text-slate-700">${label}</span>`;
    })
    .join('');
}

async function cargarEventos() {
  mostrarCargando(lista);

  const baseSelect = `
      id,
      nombre,
      descripcion,
      costo,
      gratis,
      boletos_por_localidad,
      categoria,
      enlaceboletos,
      imagen,
      activo,
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
      image_crop_mode,
      image_focus_x,
      image_focus_y,
      image_zoom,
      image_focus_confidence,
      image_focus_source,
      nombre,
      descripcion,
      costo,
      gratis,
      boletos_por_localidad,
      categoria,
      enlaceboletos,
      imagen,
      activo,
      eventos_municipios (
        id,
        municipio_id,
        lugar,
        direccion,
        enlaceboletos,
        eventoFechas (id, fecha, horainicio, mismahora)
      )
    `;

  let data = null;
  let error = null;

  ({ data, error } = await supabase.from('eventos').select(selectConSource).eq('activo', true));

  const schemaColumns = [
    'source',
    'source_event_id',
    'image_crop_mode',
    'image_focus_x',
    'image_focus_y',
    'image_zoom',
    'image_focus_confidence',
    'image_focus_source',
  ];
  const errorLower = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' | ');
  const pareceErrorDeSchema =
    errorLower.includes('schema cache') ||
    errorLower.includes('does not exist') ||
    errorLower.includes('could not find');
  const mencionaColumnaNueva = schemaColumns.some((name) => errorLower.includes(name));
  const fallaPorColumnaNueva = Boolean(error) && (mencionaColumnaNueva || pareceErrorDeSchema);

  if (fallaPorColumnaNueva) {
    console.warn('[listadoEventos] Fallback por esquema desactualizado (columnas de imagen/source):', error);
    ({ data, error } = await supabase.from('eventos').select(baseSelect).eq('activo', true));
    if (!error && Array.isArray(data)) {
      data = data.map((item) => ({
        ...item,
        source: '',
        source_event_id: '',
        image_crop_mode: '',
        image_focus_x: null,
        image_focus_y: null,
        image_zoom: null,
        image_focus_confidence: null,
        image_focus_source: '',
      }));
    }
  }

  if (error) {
    console.error('Error cargando eventos:', error);
    mostrarError(lista, t('eventos.errorCargar'), '🎭');
    return;
  }

  boleteriasByEventoId.clear();
  if (Array.isArray(data) && data.length) {
    const ids = data.map((item) => Number(item.id)).filter((id) => Number.isFinite(id));
    if (ids.length) {
      const { data: boleteriasData, error: boleteriasError } = await supabase
        .from('eventos_boleterias')
        .select('evento_id, source, source_display, logo_key, prioridad, activo')
        .in('evento_id', ids)
        .eq('activo', true)
        .order('prioridad', { ascending: true });
      if (boleteriasError) {
        console.warn('[listadoEventos] No se pudieron cargar boleterias para tarjetas:', boleteriasError);
      } else {
        for (const row of boleteriasData || []) {
          const eventoId = Number(row.evento_id);
          if (!Number.isFinite(eventoId)) continue;
          const list = boleteriasByEventoId.get(eventoId) || [];
          list.push(row);
          boleteriasByEventoId.set(eventoId, list);
        }
      }
    }
  }

  actualizarBoleteriasDisponibles();
  renderFiltroBoleterias();

  const hoyISO = new Date().toISOString().slice(0, 10);

  eventos = (data ?? [])
    .map((evento) => {
      const sedes = (evento.eventos_municipios || []).map((sede) => {
        const municipioNombre = municipios[sede.municipio_id] || '';
        const fechas = (sede.eventoFechas || []).map((item) => ({
          id: item.id,
          fecha: item.fecha,
          horainicio: item.horainicio,
          mismahora: item.mismahora ?? false,
          municipio_id: sede.municipio_id,
          municipioNombre,
          lugar: sede.lugar || '',
          direccion: sede.direccion || '',
          enlaceboletos: sede.enlaceboletos || ''
        }));
        return {
          id: sede.id,
          municipio_id: sede.municipio_id,
          municipioNombre,
          lugar: sede.lugar || '',
          direccion: sede.direccion || '',
          enlaceboletos: sede.enlaceboletos || '',
          fechas
        };
      });

      const municipioIds = Array.from(new Set(sedes.map((sede) => sede.municipio_id).filter(Boolean)));
      const municipioNombre =
        municipioIds.length > 1
          ? t('evento.variosMunicipios')
          : (municipios[municipioIds[0]] || '');

      const fechasOrdenadas = ordenarFechas(sedes.flatMap((sede) => sede.fechas || []));
      const ultimaFecha = fechasOrdenadas.length
        ? fechasOrdenadas[fechasOrdenadas.length - 1].fecha
        : null;
      const categoriaInfo = categorias[evento.categoria] || {};
      const eventoNormalizado = {
        ...evento,
        sedes,
        municipioIds,
        municipioNombre,
        categoriaNombre: categoriaInfo.nombre || '',
        categoriaIcono: categoriaInfo.icono || '',
        fechas: fechasOrdenadas,
        eventoFechas: fechasOrdenadas,
        ultimaFecha,
        boletos_por_localidad: Boolean(evento.boletos_por_localidad),
        imagen: toHorizontalEventImage(evento.imagen)
      };
      return eventoNormalizado;
    })
    .filter((evento) => !isBlockedNonEventEntry(evento))
    .filter((evento) => !evento.ultimaFecha || evento.ultimaFecha >= hoyISO);

  await renderizarEventos();
}

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function isBlockedNonEventEntry(evento = {}) {
  const rawText = [
    evento?.nombre || '',
    evento?.descripcion || '',
    evento?.lugar || '',
    evento?.direccion || '',
    evento?.categoriaNombre || '',
  ].join(' ');
  const text = normalizarTexto(String(rawText || ''))
    .replace(/[^a-z0-9\s/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return false;

  const rentalMarkers = ['alquiler', 'alquila', 'alquilar', 'renta', 'rent', 'rental'];
  if (rentalMarkers.some((marker) => new RegExp(`\\b${marker}\\b`, 'i').test(text))) {
    return true;
  }

  const saleMarkers = ['venta', 'vende'];
  const hasSale = saleMarkers.some((marker) => new RegExp(`\\b${marker}\\b`, 'i').test(text)) || /\bfor sale\b/i.test(text);
  if (!hasSale) return false;

  const ticketSaleAllow = [
    'venta de boletos',
    'venta de boleto',
    'venta de entradas',
    'venta de entrada',
    'ticket sale'
  ];
  if (ticketSaleAllow.some((marker) => text.includes(marker))) {
    return false;
  }

  const productMarkers = [
    'gazebo', 'gazebos', 'salon', 'actividades', 'carpa', 'carpas', 'silla', 'sillas', 'mesa', 'mesas',
    'inflable', 'inflables', 'articulo', 'articulos', 'producto', 'productos', 'mercancia', 'merchandise',
    'equipo', 'equipos'
  ];
  if (productMarkers.some((marker) => new RegExp(`\\b${marker}\\b`, 'i').test(text))) {
    return true;
  }
  return /^\s*venta\b/i.test(text);
}

function normalizarNombreFocus(valor = '') {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getDefaultFocusForRatio(ratio = 1) {
  if (ratio < 0.85) return { x: 0.5, y: 0.33, zoom: 1.16 };
  if (ratio < 1.1) return { x: 0.5, y: 0.36, zoom: 1.14 };
  if (ratio < 1.4) return { x: 0.5, y: 0.42, zoom: 1.1 };
  return { x: 0.5, y: 0.48, zoom: 1.04 };
}

function getManualFocusOverride(evento, imageUrl = '') {
  const bySourceEventId = EVENT_IMAGE_FOCUS_OVERRIDES?.bySourceEventId || {};
  const byEventName = EVENT_IMAGE_FOCUS_OVERRIDES?.byEventName || {};
  const byImageIncludes = EVENT_IMAGE_FOCUS_OVERRIDES?.byImageIncludes || [];
  const sourceEventId = String(evento?.source_event_id || '').trim().toLowerCase();
  const sourceEventIdNoSpaces = sourceEventId.replace(/\s+/g, '');
  const sourceEventIdSlug = sourceEventId
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const eventNameNorm = normalizarNombreFocus(evento?.nombre || '');
  const imageLower = String(imageUrl || '').toLowerCase();

  if (sourceEventId && bySourceEventId[sourceEventId]) {
    return bySourceEventId[sourceEventId];
  }

  if (sourceEventIdNoSpaces && bySourceEventId[sourceEventIdNoSpaces]) {
    return bySourceEventId[sourceEventIdNoSpaces];
  }

  if (sourceEventIdSlug && bySourceEventId[sourceEventIdSlug]) {
    return bySourceEventId[sourceEventIdSlug];
  }

  if (eventNameNorm && byEventName[eventNameNorm]) {
    return byEventName[eventNameNorm];
  }

  if (eventNameNorm) {
    for (const [key, value] of Object.entries(byEventName)) {
      if (!key) continue;
      const keyNorm = normalizarNombreFocus(key);
      if (keyNorm && (eventNameNorm.includes(keyNorm) || keyNorm.includes(eventNameNorm))) {
        return value;
      }
    }
  }

  for (const item of byImageIncludes) {
    const match = String(item?.match || '').toLowerCase().trim();
    if (match && imageLower.includes(match)) {
      return item;
    }
  }

  return null;
}

async function detectSmartFocus(imageUrl = '') {
  const key = String(imageUrl || '').trim();
  if (!key) return { x: 0.5, y: 0.45, zoom: 1.12 };
  if (focusDetectCache.has(key)) return focusDetectCache.get(key);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      const width = Number(img.naturalWidth || 0);
      const height = Number(img.naturalHeight || 0);
      if (!width || !height) {
        resolve({ x: 0.5, y: 0.45, zoom: 1.12 });
        return;
      }

      const ratio = width / height;
      const fallback = getDefaultFocusForRatio(ratio);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(fallback);
        return;
      }

      const sampleW = 140;
      const sampleH = Math.max(72, Math.round(sampleW * (height / width)));
      canvas.width = sampleW;
      canvas.height = sampleH;

      try {
        ctx.drawImage(img, 0, 0, sampleW, sampleH);
        const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
        const data = imageData.data;
        const lum = new Float32Array(sampleW * sampleH);
        let k = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          lum[k++] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }

        let sumEnergy = 0;
        let sumX = 0;
        let sumY = 0;
        for (let y = 1; y < sampleH - 1; y++) {
          for (let x = 1; x < sampleW - 1; x++) {
            const idx = y * sampleW + x;
            const l = lum[idx];
            const gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
            const gy = Math.abs(lum[idx + sampleW] - lum[idx - sampleW]);
            const diag = Math.abs(lum[idx + sampleW + 1] - lum[idx - sampleW - 1]);
            const contrast = Math.abs(l - ((lum[idx - 1] + lum[idx + 1] + lum[idx - sampleW] + lum[idx + sampleW]) / 4));

            let energy = gx * 0.9 + gy * 1.0 + diag * 0.5 + contrast * 1.1;
            if (y < sampleH * 0.42) energy *= 1.08;
            if (y > sampleH * 0.86) energy *= 0.9;

            if (energy <= 0.1) continue;
            const weighted = Math.pow(energy, 1.15);
            sumEnergy += weighted;
            sumX += weighted * x;
            sumY += weighted * y;
          }
        }

        if (sumEnergy <= 0) {
          resolve(fallback);
          return;
        }

        const fx = clamp(sumX / sumEnergy / (sampleW - 1), 0.14, 0.86);
        const fyRaw = sumY / sumEnergy / (sampleH - 1);
        const fy = clamp(fyRaw, 0.16, 0.82);
        const zoom = fallback.zoom;
        resolve({ x: fx, y: fy, zoom });
      } catch (err) {
        resolve(fallback);
      }
    };

    img.onerror = () => resolve({ x: 0.5, y: 0.45, zoom: 1.12 });
    img.src = key;
  });

  focusDetectCache.set(key, promise);
  return promise;
}

function aplicarFocusEnImagen(imgMain, focus) {
  if (!imgMain || !focus) return;
  const x = clamp(Number(focus.x ?? 0.5), 0, 1);
  const y = clamp(Number(focus.y ?? 0.5), 0, 1);
  const zoom = clamp(Number(focus.zoom ?? 1.08), 1.0, 1.4);
  imgMain.style.height = '100%';
  imgMain.style.width = '100%';
  imgMain.style.maxWidth = '100%';
  imgMain.style.objectFit = 'cover';
  imgMain.style.objectPosition = `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
  imgMain.style.transform = `scale(${zoom.toFixed(3)})`;
  imgMain.style.transformOrigin = 'center';
}

function parseNumeric(value, fallback = null) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getEventoImagePresentation(evento) {
  const modeRaw = String(evento?.image_crop_mode || '').toLowerCase().trim();
  const mode = modeRaw === 'contain_blur' ? 'contain_blur' : 'cover';
  const x = parseNumeric(evento?.image_focus_x, 0.5);
  const y = parseNumeric(evento?.image_focus_y, mode === 'contain_blur' ? 0.5 : 0.26);
  const zoom = parseNumeric(evento?.image_zoom, mode === 'contain_blur' ? 1.0 : 1.08);
  return {
    mode,
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    zoom: mode === 'contain_blur' ? clamp(zoom, 1.0, 1.12) : clamp(zoom, 1.0, 1.4),
  };
}

function getPrimarySourceKey(evento) {
  const direct = normalizarBoleteriaKey(evento?.source || '');
  if (direct) return direct;
  const boleterias = getBoleteriasDeEvento(evento?.id);
  const first = boleterias[0];
  return normalizarBoleteriaKey(first?.logo_key || first?.source || '');
}

function detectImageShapeHint(imageUrl = '') {
  const value = String(imageUrl || '').toLowerCase();
  if (!value) return 'unknown';
  if (/(1210x450|1200x450|banner|landscape|16x9|16_9)/.test(value)) return 'ultra_wide';
  if (/(1920x1080|1280x720|1280x768|wide|horizontal|cover)/.test(value)) return 'wide';
  if (/(1080x1080|square|1x1)/.test(value)) return 'square';
  if (/(1080x1350|1080x1920|portrait|poster|flyer|4x5|3x4)/.test(value)) return 'portrait';
  return 'unknown';
}

function getCardImageLayout(evento, imageUrl) {
  const source = getPrimarySourceKey(evento);
  const shape = detectImageShapeHint(imageUrl);
  const baseRatio = '7 / 4';

  // Ticketera: centrar tomando como referencia el ancho.
  if (source === 'ticketera') {
    return { aspectRatio: baseRatio, fitMode: 'width', forceBlurBg: true, shape };
  }

  // PRticket: centrar tomando como referencia la altura.
  if (source === 'prticket' || source === 'prtickets') {
    return { aspectRatio: baseRatio, fitMode: 'height', forceBlurBg: true, shape };
  }

  // Pietix: mantener layout 7:4.
  if (source === 'pietix') {
    // Siempre adaptada sin recorte para no cortar textos del arte.
    return { aspectRatio: baseRatio, fitMode: 'contain', forceBlurBg: true, shape };
  }

  if (shape === 'portrait' || shape === 'square') {
    return { aspectRatio: baseRatio, fitMode: 'contain', forceBlurBg: true, shape };
  }
  return { aspectRatio: baseRatio, fitMode: 'cover', forceBlurBg: false, shape };
}

function aplicarEstiloImagenTarjeta(contenedor, imageUrl, evento) {
  if (!contenedor || !imageUrl) return;
  const frame = contenedor.querySelector('[data-event-image-frame="true"]');
  const imgMain = contenedor.querySelector('[data-event-main-image="true"]');
  const imgBg = contenedor.querySelector('[data-event-bg-image="true"]');
  if (!imgMain || !imgBg || !frame) return;

  const presentation = getEventoImagePresentation(evento);
  const layout = getCardImageLayout(evento, imageUrl);
  frame.style.aspectRatio = layout.aspectRatio;

  const applyBlurBg = () => {
    imgBg.style.objectFit = 'cover';
    imgBg.style.objectPosition = 'center center';
    imgBg.style.transform = 'scale(1.12)';
    imgBg.style.filter = 'blur(16px)';
    imgBg.style.opacity = '1';
  };

  const applyCoverBg = () => {
    imgBg.style.objectFit = 'cover';
    imgBg.style.objectPosition = 'center center';
    imgBg.style.transform = 'scale(1.10)';
    imgBg.style.filter = 'blur(16px)';
    imgBg.style.opacity = '1';
  };

  const applyAxisFit = (axis = 'width') => {
    const zoom = clamp(presentation.zoom, 1.0, 1.04);
    imgMain.style.display = 'block';
    imgMain.style.objectFit = 'contain';
    imgMain.style.objectPosition = 'center center';
    imgMain.style.transformOrigin = 'center';
    imgMain.style.transform = `scale(${zoom.toFixed(3)})`;
    imgMain.style.maxWidth = 'none';
    imgMain.style.maxHeight = 'none';

    if (axis === 'height') {
      imgMain.style.width = 'auto';
      imgMain.style.height = '100%';
    } else {
      imgMain.style.width = '100%';
      imgMain.style.height = 'auto';
    }
  };

  if (layout.fitMode === 'width') {
    applyAxisFit('width');
    applyBlurBg();
    return;
  }

  if (layout.fitMode === 'height') {
    applyAxisFit('height');
    applyBlurBg();
    return;
  }

  const useContainBlur =
    layout.fitMode === 'contain' ||
    presentation.mode === 'contain_blur' ||
    layout.forceBlurBg ||
    layout.shape === 'portrait' ||
    layout.shape === 'square';

  if (useContainBlur) {
    const containZoom = layout.forceBlurBg
      ? clamp(presentation.zoom, 1.0, 1.03)
      : clamp(presentation.zoom, 1.0, 1.08);
    imgMain.style.height = '100%';
    imgMain.style.width = '100%';
    imgMain.style.maxWidth = '100%';
    imgMain.style.objectFit = 'contain';
    imgMain.style.objectPosition = `${(presentation.x * 100).toFixed(2)}% ${(presentation.y * 100).toFixed(2)}%`;
    imgMain.style.transform = `scale(${containZoom.toFixed(3)})`;
    imgMain.style.transformOrigin = 'center';
    applyBlurBg();
    return;
  }

  applyCoverBg();

  const presetFocus = { x: presentation.x, y: presentation.y, zoom: presentation.zoom };
  aplicarFocusEnImagen(imgMain, presetFocus);

  const manual = getManualFocusOverride(evento, imageUrl);
  if (manual) {
    aplicarFocusEnImagen(imgMain, manual);
    return;
  }
  detectSmartFocus(imageUrl).then((autoFocus) => {
    aplicarFocusEnImagen(imgMain, autoFocus);
  });
}

async function renderizarEventos() {
  const currentRender = ++renderVersion;
  await renderTopBannerEventos();
  if (currentRender !== renderVersion) return;

  lista.className = 'flex flex-col gap-4 px-4 md:px-6';
  cleanupCarousels(lista);
  lista.innerHTML = '';

  const texto = normalizarTexto(busquedaNombre.value.trim());
  const muni = filtroMunicipio.value;
  const cat = filtroCategoria.value;
  const orden = filtroOrden.value;
  const muniId = muni ? Number(muni) : null;
  const hayFiltroPeriodo = filtroHoy || filtroSemana || filtroMes;

  let filtrados = eventos.filter((evento) => {
    const matchTexto = !texto || normalizarTexto(evento.nombre).includes(texto);
    const matchMuni = !muni || (evento.municipioIds || []).includes(Number(muni));
    const matchCat = !cat || evento.categoria == cat;
    const eventoBoleterias = getBoleteriaKeysDeEvento(evento.id);
    const matchBoleteria =
      filtroBoleteriasSeleccionadas.size === 0 ||
      eventoBoleterias.some((key) => filtroBoleteriasSeleccionadas.has(key));
    const fechasEvaluacion = obtenerFechasVisibles(evento, muniId);
    const matchFiltro = hayFiltroPeriodo ? fechasEvaluacion.length > 0 : true;

    if (filtroGratis) {
      return matchTexto && matchMuni && matchCat && matchBoleteria && matchFiltro && evento.gratis === true;
    }

    return matchTexto && matchMuni && matchCat && matchBoleteria && matchFiltro;
  });

  if (orden === 'fechaAsc') {
    filtrados.sort((a, b) => {
      const fa = obtenerProximaFechaDesdeLista(obtenerFechasVisibles(a, muniId, true))?.fecha || '9999-12-31';
      const fb = obtenerProximaFechaDesdeLista(obtenerFechasVisibles(b, muniId, true))?.fecha || '9999-12-31';
      return fa.localeCompare(fb);
    });
  } else if (orden === 'fechaDesc') {
    filtrados.sort((a, b) => {
      const fa = obtenerProximaFechaDesdeLista(obtenerFechasVisibles(a, muniId, true))?.fecha || '0000-01-01';
      const fb = obtenerProximaFechaDesdeLista(obtenerFechasVisibles(b, muniId, true))?.fecha || '0000-01-01';
      return fb.localeCompare(fa);
    });
  } else if (orden === 'alfabetico') {
    filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  // Sin resultados
  if (filtrados.length === 0) {
    mostrarMensajeVacio(lista, t('evento.sinResultados'), '🗓️');
    const bannerFinal = await crearBannerElemento('banner-bottom');
    if (currentRender !== renderVersion) return;
    if (bannerFinal) lista.appendChild(bannerFinal);
    return;
  }

  const fragment = document.createDocumentFragment();
  let cartasEnFila = 0;
  let totalFilas = 0;

  for (let i = 0; i < filtrados.length; i++) {
    const evento = filtrados[i];
    const fechasTarjeta = ordenarFechas(obtenerFechasVisibles(evento, muniId, true));
    const proxima = obtenerProximaFechaDesdeLista(fechasTarjeta) || obtenerProximaFecha(evento);
    const totalFechas = fechasTarjeta.length;
    const mostrarMasFechas = totalFechas > 1;
    const fechaDetalle = proxima ? obtenerPartesFecha(proxima.fecha) : null;
    const horaTexto = proxima?.horainicio ? formatearHora(proxima.horainicio) : '';
    const municipioPrincipal = proxima?.municipioNombre || evento.municipioNombre || '';
    const municipiosConFecha = Array.from(
      new Set(
        fechasTarjeta
          .map((item) => item?.municipioNombre || '')
          .filter(Boolean)
      )
    );
    const mostrarMasLocalidades = municipiosConFecha.length > 1;
    const textoOtrasFechas = (() => {
      const valor = t('evento.otrasFechasDisponibles');
      return valor === 'evento.otrasFechasDisponibles' ? t('evento.variasFechas') : valor;
    })();
    const textoOtrosMunicipios = (() => {
      const valor = t('evento.otrosMunicipiosDisponibles');
      return valor === 'evento.otrosMunicipiosDisponibles' ? t('evento.variosMunicipios') : valor;
    })();
    const iconoCategoria = evento.categoriaIcono ? `<i class="fas ${evento.categoriaIcono}"></i>` : '';
    const nombreClass = (evento.nombre || '').length > 25 ? 'text-base' : 'text-lg';
    const imagenEvento = withVersion(
      toHorizontalEventImage(evento.imagen) || 'https://placehold.co/1280x720?text=Evento',
      evento.id
    );
    const costoRaw = evento.costo != null ? String(evento.costo).trim() : '';
    const costoConSimbolo = /^[\d,.]+$/.test(costoRaw) && !costoRaw.startsWith('$')
      ? `$${costoRaw}`
      : costoRaw;
    const normalizarMonto = (texto) => {
      const val = String(texto || '').trim();
      const sinSimbolo = val.replace(/^\s*\$\s*/, '');
      const esNumero = /^[\d,.]+$/.test(sinSimbolo);
      if (!val.startsWith('$') && esNumero) return `$${sinSimbolo}`;
      return val;
    };
    const precioBoletos = (() => {
      if (evento.gratis) return t('eventos.gratis');
      if (!costoConSimbolo) return '';
      if (costoConSimbolo.toLowerCase().startsWith('desde')) {
        return `desde ${normalizarMonto(costoConSimbolo.replace(/^desde\s*:?/i, '').trim())}`;
      }
      if (costoConSimbolo.toLowerCase().startsWith('costo')) {
        const sinLabel = costoConSimbolo.replace(/^costo\s*:?/i, '').trim();
        return normalizarMonto(sinLabel);
      }
      return normalizarMonto(costoConSimbolo);
    })();
    const boletosLinea = precioBoletos
      ? `Boletos ${precioBoletos} disponibles en`
      : 'Boletos disponibles en';
    const boleteriasInline = renderBoleteriasInline(evento.id);
    const fechaBloque = fechaDetalle
      ? `
          <div class="text-red-700 font-semibold leading-tight">${fechaDetalle.weekday}</div>
          <div class="text-red-600 leading-tight">${fechaDetalle.resto}</div>
          ${mostrarMasFechas ? `<div class="text-[10px] leading-none text-gray-400 mt-1">${textoOtrasFechas}</div>` : ''}
        `
      : `<div class="text-red-600 font-medium leading-tight">${t('evento.sinFecha')}</div>`;

    const horaBloque = horaTexto
      ? `<div class="text-slate-700 font-semibold leading-tight">${horaTexto}</div>`
      : `<div class="text-slate-500 leading-tight">${t('area.noDisponible')}</div>`;

    const div = document.createElement('div');
    div.className = 'bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden cursor-pointer flex flex-col border border-slate-200';
    div.innerHTML = `
      <div data-event-image-frame="true" class="w-full overflow-hidden bg-gray-200 relative" style="aspect-ratio: 7 / 4;">
        <img src="${imagenEvento}" data-event-bg-image="true" class="absolute inset-0 w-full h-full object-cover blur-xl scale-110" alt="" aria-hidden="true" />
        <div class="relative z-10 w-full h-full flex items-center justify-center overflow-hidden">
          <img src="${imagenEvento}" data-event-main-image="true" class="w-full h-full object-cover" alt="${evento.nombre}" loading="lazy" />
        </div>
      </div>
      <div class="p-3 flex flex-col gap-2">
        <div class="flex justify-center">
          <h3 class="leading-tight ${nombreClass} font-bold line-clamp-2 text-center">${evento.nombre}</h3>
        </div>
        <div class="flex items-center justify-center gap-1 text-orange-500 min-w-0">
          ${iconoCategoria}
          <span class="truncate font-medium">${evento.categoriaNombre || ''}</span>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm">
          <div class="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <div class="text-center">
              ${fechaBloque}
            </div>
            <div class="text-slate-300 font-semibold pt-1">|</div>
            <div class="text-center">
              ${horaBloque}
              <div class="mt-1 flex items-center justify-center gap-1 font-medium" style="color:#23B4E9;">
                <i class="fa-solid fa-map-pin"></i>
                <span>${municipioPrincipal || t('evento.variosMunicipios')}</span>
              </div>
              ${mostrarMasLocalidades ? `<div class="text-[10px] leading-none text-gray-400 mt-1">${textoOtrosMunicipios}</div>` : ''}
            </div>
          </div>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div class="flex items-center justify-center gap-2 text-sm text-slate-700">
            <span>${boletosLinea}</span>
            <span class="inline-flex items-center justify-center gap-2 min-w-0">${boleteriasInline}</span>
          </div>
        </div>
      </div>
    `;
    aplicarEstiloImagenTarjeta(div, imagenEvento, evento);
    div.addEventListener('click', () => {
      window.location.href = `perfilEvento.html?id=${encodeURIComponent(evento.id)}`;
    });
    fragment.appendChild(div);
    cartasEnFila += 1;

    const esUltimaCarta = i === filtrados.length - 1;
    const filaCompleta = cartasEnFila === 1 || esUltimaCarta;

    if (filaCompleta) {
      totalFilas += 1;
      cartasEnFila = 0;

      const debeInsertarIntermedio = totalFilas % 4 === 0 && !esUltimaCarta;
      if (debeInsertarIntermedio) {
        const bannerIntermedio = await crearBannerElemento('banner-inline');
        if (currentRender !== renderVersion) return;
        if (bannerIntermedio) fragment.appendChild(bannerIntermedio);
      }
    }
  }

  const debeAgregarFinal = totalFilas === 0 || totalFilas % 4 !== 0;
  if (debeAgregarFinal) {
    const bannerFinal = await crearBannerElemento('banner-bottom');
    if (currentRender !== renderVersion) return;
    if (bannerFinal) fragment.appendChild(bannerFinal);
  }

  lista.appendChild(fragment);
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

function resolveLocale(langValue) {
  const lang = (langValue || 'es').toLowerCase().split('-')[0];
  const map = {
    es: 'es-PR',
    en: 'en-US',
    fr: 'fr-FR',
    pt: 'pt-PT',
    de: 'de-DE',
    it: 'it-IT',
    zh: 'zh-CN',
    ko: 'ko-KR',
    ja: 'ja-JP'
  };
  return map[lang] || 'es-PR';
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return t('evento.sinFecha');
  const [year, month, day] = fechaStr.split('-').map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) return t('evento.sinFecha');
  const fecha = new Date(Date.UTC(year, month - 1, day));
  const base = fecha.toLocaleDateString(resolveLocale(getLang()), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
  return estilizarFechaExtendida(base);
}

function formatearHora(horaStr) {
  if (!horaStr) return '';
  const [hourPart, minutePart] = horaStr.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  const fecha = new Date(Date.UTC(1970, 0, 1, hour, minute));
  const base = fecha.toLocaleTimeString(resolveLocale(getLang()), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });
  return base.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
}

function obtenerPartesFecha(fechaStr) {
  const completa = formatearFecha(fechaStr);
  if (!completa || completa === t('evento.sinFecha')) return null;
  const [weekday, resto] = completa.split(', ');
  return {
    weekday: weekday || completa,
    resto: resto || ''
  };
}

async function cargarFiltros() {
  const { data: muni } = await supabase.from('Municipios').select('id, nombre').order('nombre');
  municipios = {};
  muni?.forEach(m => {
    municipios[m.id] = m.nombre;
    filtroMunicipio.innerHTML += `<option value="${m.id}">${m.nombre}</option>`;
  });

  await cargarCategorias();
}

async function cargarCategorias() {
  const lang = (getLang() || 'es').toLowerCase().split('-')[0];
  const nombreColumna = `nombre_${lang}`;
  const { data: cat } = await supabase
    .from('categoriaEventos')
    .select(`id, nombre, ${nombreColumna}, icono`)
    .order('nombre');

  categorias = {};
  const label = t('eventos.todasCategorias');
  filtroCategoria.innerHTML = `<option value="">${label}</option>`;
  cat?.forEach((c) => {
    const nombreTraducido = c[nombreColumna] || c.nombre;
    categorias[c.id] = { nombre: nombreTraducido || '', icono: c.icono || '' };
    filtroCategoria.innerHTML += `<option value="${c.id}">${nombreTraducido}</option>`;
  });
}

// Listeners
[filtroMunicipio, filtroCategoria, filtroOrden, busquedaNombre].forEach(input => {
  input.addEventListener('input', renderizarEventos);
});

btnHoy.addEventListener('change', (e) => {
  filtroHoy = e.target.checked;
  if (filtroHoy) {
    filtroSemana = false;
    btnSemana.checked = false;
    filtroMes = false;
    btnMes.checked = false;
  }
  renderizarEventos();
});

btnSemana.addEventListener('change', (e) => {
  filtroSemana = e.target.checked;
  if (filtroSemana) {
    filtroHoy = false;
    btnHoy.checked = false;
    filtroMes = false;
    btnMes.checked = false;
  }
  renderizarEventos();
});

btnMes.addEventListener('change', (e) => {
  filtroMes = e.target.checked;
  if (filtroMes) {
    filtroHoy = false;
    btnHoy.checked = false;
    filtroSemana = false;
    btnSemana.checked = false;
  }
  renderizarEventos();
});

btnGratis.addEventListener('change', (e) => {
  filtroGratis = e.target.checked;
  renderizarEventos();
});

window.addEventListener('lang:changed', () => {
  cargarCategorias();
  renderizarEventos();
});

(async function init() {
  if (typeof mostrarLoader === 'function') {
    await mostrarLoader();
  }

  try {
    await cargarFiltros();
    await cargarEventos();
  } finally {
    if (typeof ocultarLoader === 'function') {
      await ocultarLoader();
    }
  }
})();
