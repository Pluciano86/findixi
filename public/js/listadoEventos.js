// listadoEventos.js
import { supabase } from '../shared/supabaseClient.js';
import { mostrarMensajeVacio, mostrarError, mostrarCargando } from './mensajesUI.js';
import { createGlobalBannerElement, destroyCarousel } from './bannerCarousel.js';
import { t, getLang } from './i18n.js';
import { abrirModal } from './modalEventos.js';
import { toHorizontalEventImage, withVersion } from '../shared/eventoImage.js';

const lista = document.getElementById('listaEventos');
const filtroMunicipio = document.getElementById('filtroMunicipio');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroOrden = document.getElementById('filtroOrden');
const busquedaNombre = document.getElementById('busquedaNombre');

const btnHoy = document.getElementById('btnHoy');
const btnSemana = document.getElementById('btnSemana');
const btnMes = document.getElementById('btnMes');
const btnGratis = document.getElementById('btnGratis');

// Estado
let eventos = [];
let municipios = {};
let categorias = {};
let filtroHoy = false;
let filtroSemana = false;
let filtroMes = false;
let filtroGratis = false;
let renderVersion = 0;

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

async function cargarEventos() {
  mostrarCargando(lista);

  const { data, error } = await supabase
    .from('eventos')
    .select(`
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
    `)
    .eq('activo', true);

  if (error) {
    console.error('Error cargando eventos:', error);
    mostrarError(lista, t('eventos.errorCargar'), '🎭');
    return;
  }

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
    .filter((evento) => !evento.ultimaFecha || evento.ultimaFecha >= hoyISO);

  await renderizarEventos();
}

function normalizarTexto(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function aplicarEstiloImagenTarjeta(contenedor, imageUrl) {
  if (!contenedor || !imageUrl) return;
  const imgMain = contenedor.querySelector('[data-event-main-image="true"]');
  if (!imgMain) return;

  // Ajuste por alto: la imagen llena altura y el ancho se adapta.
  imgMain.style.height = '100%';
  imgMain.style.width = 'auto';
  imgMain.style.maxWidth = 'none';
  imgMain.style.objectFit = 'contain';
  imgMain.style.objectPosition = 'center';
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
    const fechasEvaluacion = obtenerFechasVisibles(evento, muniId);
    const matchFiltro = hayFiltroPeriodo ? fechasEvaluacion.length > 0 : true;

    if (filtroGratis) {
      return matchTexto && matchMuni && matchCat && matchFiltro && evento.gratis === true;
    }

    return matchTexto && matchMuni && matchCat && matchFiltro;
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
    const costoTexto = evento.gratis
      ? t('eventos.gratis')
      : costoConSimbolo
        ? (costoConSimbolo.toLowerCase().startsWith('desde')
          ? `${t('evento.desde')} ${normalizarMonto(costoConSimbolo.replace(/^desde\s*:?/i, '').trim())}`
          : (costoConSimbolo.toLowerCase().startsWith('costo')
            ? costoConSimbolo
            : t('evento.costoLabel', { costo: normalizarMonto(costoConSimbolo) })))
        : t('evento.costoNoDisponible');
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
      <div class="aspect-[21/8] w-full overflow-hidden bg-gray-200 relative">
        <img src="${imagenEvento}" class="absolute inset-0 w-full h-full object-cover blur-xl scale-110" alt="" aria-hidden="true" />
        <div class="relative z-10 w-full h-full flex items-center justify-center overflow-hidden">
          <img src="${imagenEvento}" data-event-main-image="true" class="w-full h-full object-cover" alt="${evento.nombre}" loading="lazy" />
        </div>
      </div>
      <div class="p-3 flex flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <h3 class="leading-tight ${nombreClass} font-bold line-clamp-2">${evento.nombre}</h3>
          <div class="shrink-0 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">${costoTexto}</div>
        </div>
        <div class="flex items-center gap-1 text-sm text-orange-500">
          ${iconoCategoria}
          <span>${evento.categoriaNombre || ''}</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div class="rounded-lg border border-red-100 bg-red-50/70 px-2 py-2 text-center">
            ${fechaBloque}
          </div>
          <div class="rounded-lg border border-sky-100 bg-sky-50/70 px-2 py-2 text-center">
            ${horaBloque}
            <div class="mt-1 flex items-center justify-center gap-1 font-medium" style="color:#23B4E9;">
              <i class="fa-solid fa-map-pin"></i>
              <span>${municipioPrincipal || t('evento.variosMunicipios')}</span>
            </div>
            ${mostrarMasLocalidades ? `<div class="text-[10px] leading-none text-gray-400 mt-1">${textoOtrosMunicipios}</div>` : ''}
          </div>
        </div>
      </div>
    `;
    aplicarEstiloImagenTarjeta(div, imagenEvento);
    div.addEventListener('click', () => abrirModal(evento));
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
