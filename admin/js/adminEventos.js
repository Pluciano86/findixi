import { supabase } from '../shared/supabaseClient.js';

const tablaEventos = document.getElementById('tablaEventos');
const listaEventosMobile = document.getElementById('listaEventosMobile');
const contadorEventos = document.getElementById('contadorEventos');

const filtroBusqueda = document.getElementById('filtroBusqueda');
const filtroMunicipio = document.getElementById('filtroMunicipio');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroActivo = document.getElementById('filtroActivo');

const btnNuevoEvento = document.getElementById('btnNuevoEvento');
const modal = document.getElementById('modalEvento');
const modalTitulo = document.getElementById('modalTitulo');
const btnCerrarModal = document.getElementById('btnCerrarModal');
const btnCancelarModal = document.getElementById('btnCancelarEvento');
const formEvento = document.getElementById('formEvento');

const inputNombre = document.getElementById('eventoNombre');
const inputDescripcion = document.getElementById('eventoDescripcion');
const selectCategoria = document.getElementById('eventoCategoria');
const inputCosto = document.getElementById('eventoCosto');
const checkGratis = document.getElementById('eventoGratis');
const inputBoletos = document.getElementById('eventoBoletos');
const checkBoletosGlobal = document.getElementById('boletosGlobal');
const inputImagen = document.getElementById('eventoImagen');
const checkActivo = document.getElementById('eventoActivo');
const imagenActual = document.getElementById('imagenActual');
const errorEvento = document.getElementById('errorEvento');
const eventoIdHidden = document.getElementById('eventoId');

const sedesContainer = document.getElementById('sedesContainer');
const btnAgregarSede = document.getElementById('btnAgregarSede');

const municipioMap = new Map();
const categoriaMap = new Map();

let eventos = [];
let eventoEnEdicion = null;
const sedesUI = [];
let municipioOptionsHtml = '<option value="">Selecciona...</option>';

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

function formatFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  const [year, month, day] = String(fecha).split('-').map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) return 'Sin fecha';
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  const base = dateObj.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
  return estilizarFechaExtendida(base);
}

function formatHora(hora) {
  if (!hora) return '';
  const [hourPart, minutePart] = String(hora).split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  const dateObj = new Date(Date.UTC(1970, 0, 1, hour, minute));
  const base = dateObj.toLocaleTimeString('es-ES', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });
  return base.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
}

function formatFechasListado(fechas) {
  if (!Array.isArray(fechas) || fechas.length === 0) return 'Sin fechas';
  return fechas
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((item) => {
      const fechaTexto = formatFecha(item.fecha);
      const horaTexto = formatHora(item.horainicio);
      const muniTexto = item.municipioNombre ? ` · ${item.municipioNombre}` : '';
      return `${fechaTexto}${horaTexto ? ` · ${horaTexto}` : ''}${muniTexto}`;
    })
    .join('<br />');
}

function obtenerProximaFechaEvento(fechas = []) {
  if (!Array.isArray(fechas) || fechas.length === 0) return null;
  const hoyISO = new Date().toISOString().slice(0, 10);
  const ordenadas = [...fechas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return ordenadas.find((item) => item.fecha >= hoyISO) || ordenadas[ordenadas.length - 1] || null;
}

function obtenerPartesFecha(fechaStr) {
  const completa = formatFecha(fechaStr);
  if (!completa || completa === 'Sin fecha') return null;
  const [weekday, resto] = completa.split(', ');
  return {
    weekday: weekday || completa,
    resto: resto || ''
  };
}

function construirOpcionesMunicipios() {
  municipioOptionsHtml = '<option value="">Selecciona...</option>';
  municipioMap.forEach((nombre, id) => {
    municipioOptionsHtml += `<option value="${id}">${nombre}</option>`;
  });
}

function crearSedeItem({ municipio_id = '', lugar = '', direccion = '', enlaceboletos = '', fechas = [] } = {}) {
  const sede = document.createElement('div');
  sede.className = 'border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3';

  sede.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <h4 class="text-sm font-semibold text-gray-700">Municipio</h4>
      <button type="button" class="btn-remover-sede text-red-600 text-xs hover:underline">Eliminar municipio</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div>
        <label class="block text-xs font-medium text-gray-600">Municipio *</label>
        <select class="sede-municipio mt-1 w-full border px-3 py-2 rounded">
          ${municipioOptionsHtml}
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600">Lugar *</label>
        <input type="text" class="sede-lugar mt-1 w-full border px-3 py-2 rounded" />
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600">Dirección *</label>
        <input type="text" class="sede-direccion mt-1 w-full border px-3 py-2 rounded" />
      </div>
    </div>
    <div class="sede-boletos-wrapper">
      <label class="block text-xs font-medium text-gray-600">Link boletos (opcional)</label>
      <input type="url" class="sede-boletos mt-1 w-full border px-3 py-2 rounded" />
    </div>
    <div class="flex flex-col md:flex-row gap-4 md:items-end md:justify-between border border-gray-200 rounded-lg p-3 bg-white">
      <div class="space-y-2 md:w-2/3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label class="text-xs font-semibold text-gray-600">Fecha</label>
            <input type="date" class="sede-fecha w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label class="text-xs font-semibold text-gray-600">Hora de inicio</label>
            <input type="time" class="sede-hora w-full border rounded px-3 py-2" />
          </div>
          <button type="button" class="sede-agregar-fecha bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800">
            Agregar fecha
          </button>
        </div>
        <label class="inline-flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" class="sede-misma-hora form-checkbox h-4 w-4 text-blue-600" />
          Usar la misma hora para todas las fechas
        </label>
      </div>
    </div>
    <div class="sede-lista-fechas hidden bg-white border border-gray-200 rounded-lg divide-y divide-gray-100"></div>
  `;

  const selectMunicipio = sede.querySelector('.sede-municipio');
  const inputLugar = sede.querySelector('.sede-lugar');
  const inputDireccion = sede.querySelector('.sede-direccion');
  const inputBoletosSede = sede.querySelector('.sede-boletos');
  const inputFecha = sede.querySelector('.sede-fecha');
  const inputHora = sede.querySelector('.sede-hora');
  const btnAgregarFecha = sede.querySelector('.sede-agregar-fecha');
  const checkMismaHora = sede.querySelector('.sede-misma-hora');
  const listadoFechas = sede.querySelector('.sede-lista-fechas');

  selectMunicipio.value = municipio_id ? String(municipio_id) : '';
  inputLugar.value = lugar || '';
  inputDireccion.value = direccion || '';
  inputBoletosSede.value = enlaceboletos || '';

  const fechasLocal = (fechas || []).map((item) => ({
    fecha: item.fecha,
    horainicio: item.horainicio || '',
    mismahora: item.mismahora ?? false
  }));

  let mismaHora = fechasLocal.length > 0 && fechasLocal.every((item) => item.mismahora === true);
  checkMismaHora.checked = mismaHora;
  if (mismaHora && fechasLocal[0]?.horainicio) {
    inputHora.value = fechasLocal[0].horainicio;
  }

  const renderFechasLocal = () => {
    if (fechasLocal.length === 0) {
      listadoFechas.innerHTML = '';
      listadoFechas.classList.add('hidden');
      return;
    }

    listadoFechas.classList.remove('hidden');
    listadoFechas.innerHTML = fechasLocal
      .map((item, index) => {
        const horaInput = mismaHora
          ? `<span class="text-sm text-gray-600">${formatHora(item.horainicio) || '--:--'}</span>`
          : `<input type="time" data-index="${index}" class="sede-hora-item border rounded px-3 py-1 w-28" value="${item.horainicio || ''}" />`;

        return `
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-white">
            <div>
              <p class="font-medium text-gray-800">${formatFecha(item.fecha)}</p>
              ${mismaHora ? '<p class="text-xs text-gray-500">Hora compartida</p>' : ''}
            </div>
            <div class="flex items-center gap-3">
              ${horaInput}
              <button type="button" data-remove="${index}" class="text-red-600 text-sm hover:underline">Eliminar</button>
            </div>
          </div>`;
      })
      .join('');

    listadoFechas.querySelectorAll('.sede-hora-item').forEach((input) => {
      input.addEventListener('change', (event) => {
        const idx = Number(event.target.dataset.index);
        if (!Number.isInteger(idx)) return;
        fechasLocal[idx].horainicio = event.target.value;
      });
    });

    listadoFechas.querySelectorAll('[data-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        const idx = Number(button.dataset.remove);
        if (!Number.isInteger(idx)) return;
        fechasLocal.splice(idx, 1);
        renderFechasLocal();
      });
    });
  };

  btnAgregarFecha.addEventListener('click', () => {
    const fecha = inputFecha.value;
    const hora = inputHora.value;

    if (!fecha) {
      alert('Selecciona una fecha.');
      return;
    }
    if (fechasLocal.some((item) => item.fecha === fecha)) {
      alert('La fecha ya fue añadida.');
      return;
    }

    if (checkMismaHora.checked) {
      if (!hora) {
        alert('Selecciona la hora que se usará en todas las fechas.');
        return;
      }
      fechasLocal.push({ fecha, horainicio: hora, mismahora: true });
      fechasLocal.forEach((item) => {
        item.horainicio = hora;
        item.mismahora = true;
      });
    } else {
      if (!hora) {
        alert('Define la hora de inicio para la fecha seleccionada.');
        return;
      }
      fechasLocal.push({ fecha, horainicio: hora, mismahora: false });
    }

    inputFecha.value = '';
    if (!checkMismaHora.checked) inputHora.value = '';
    renderFechasLocal();
  });

  checkMismaHora.addEventListener('change', () => {
    if (checkMismaHora.checked) {
      const hora = inputHora.value || fechasLocal[0]?.horainicio || '';
      if (!hora) {
        alert('Selecciona la hora que se usará en todas las fechas.');
        checkMismaHora.checked = false;
        return;
      }
      fechasLocal.forEach((item) => {
        item.horainicio = hora;
        item.mismahora = true;
      });
      mismaHora = true;
      inputHora.value = hora;
    } else {
      fechasLocal.forEach((item) => {
        item.mismahora = false;
      });
      mismaHora = false;
    }
    renderFechasLocal();
  });

  renderFechasLocal();

  return {
    element: sede,
    getData() {
      return {
        municipio_id: selectMunicipio.value ? Number(selectMunicipio.value) : null,
        lugar: inputLugar.value.trim(),
        direccion: inputDireccion.value.trim(),
        enlaceboletos: inputBoletosSede.value.trim(),
        fechas: fechasLocal.map((item) => ({
          fecha: item.fecha,
          horainicio: item.horainicio,
          mismahora: checkMismaHora.checked
        }))
      };
    }
  };
}

function limpiarSedesUI() {
  sedesUI.length = 0;
  sedesContainer.innerHTML = '';
}

function agregarSedeUI(data = {}) {
  const sedeUI = crearSedeItem(data);
  sedesUI.push(sedeUI);
  sedesContainer.appendChild(sedeUI.element);
  actualizarBotonesSede();
  actualizarModoBoletos();
}

function actualizarBotonesSede() {
  const removeButtons = sedesContainer.querySelectorAll('.btn-remover-sede');
  removeButtons.forEach((btn, index) => {
    btn.classList.toggle('hidden', removeButtons.length === 1);
    btn.onclick = () => {
      sedesUI.splice(index, 1);
      btn.closest('.border')?.remove();
      actualizarBotonesSede();
    };
  });
}

function cargarSedesDesdeEvento(sedes = []) {
  limpiarSedesUI();
  if (!Array.isArray(sedes) || sedes.length === 0) {
    agregarSedeUI();
    return;
  }
  sedes.forEach((sede) => {
    agregarSedeUI({
      municipio_id: sede.municipio_id,
      lugar: sede.lugar,
      direccion: sede.direccion,
      enlaceboletos: sede.enlaceboletos || '',
      fechas: sede.fechas || []
    });
  });
}

function actualizarModoBoletos() {
  const usarGlobal = Boolean(checkBoletosGlobal?.checked);
  if (inputBoletos) inputBoletos.disabled = !usarGlobal;
  sedesContainer.querySelectorAll('.sede-boletos-wrapper').forEach((wrapper) => {
    wrapper.classList.toggle('hidden', usarGlobal);
  });
  sedesContainer.querySelectorAll('.sede-boletos').forEach((input) => {
    input.disabled = usarGlobal;
  });
}

async function limpiarEventosExpirados() {
  const ahora = new Date();
  // Solo ejecuta la limpieza después de las 3 AM para evitar conflictos con eventos recientes
  if (ahora.getHours() < 3) return;

  const hoyISO = ahora.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('eventoFechas')
    .select('fecha, eventos_municipios ( event_id )');

  if (error) {
    console.warn('⚠️ No se pudieron revisar eventos expirados:', error);
    return;
  }

  // Agrupa la última fecha de cada evento
  const ultimaFechaPorEvento = new Map();
  (data ?? []).forEach((registro) => {
    const eventId = registro.eventos_municipios?.event_id;
    if (!eventId) return;
    const actual = ultimaFechaPorEvento.get(eventId);
    if (!actual || registro.fecha > actual) {
      ultimaFechaPorEvento.set(eventId, registro.fecha);
    }
  });

  // Filtra los eventos cuya última fecha ya pasó
  const eventosAEliminar = Array.from(ultimaFechaPorEvento.entries())
    .filter(([, fechaFinal]) => fechaFinal < hoyISO)
    .map(([id]) => id);

  if (eventosAEliminar.length === 0) return;

  try {
    // Elimina los eventos principales (cascada a sedes y fechas)
    const { error: errorEventos } = await supabase
      .from('eventos')
      .delete()
      .in('id', eventosAEliminar);

    if (errorEventos) {
      console.error('❌ Error eliminando eventos expirados:', errorEventos);
    } else {
      console.log(`🗑️ ${eventosAEliminar.length} eventos expirados eliminados correctamente`);
    }

  } catch (err) {
    console.error('💥 Error inesperado al limpiar eventos expirados:', err);
  }
}

async function cargarCatalogos() {
  const [municipiosResp, categoriasResp] = await Promise.all([
    supabase.from('Municipios').select('id, nombre').order('nombre'),
    supabase.from('categoriaEventos').select('id, nombre, icono').order('nombre')
  ]);

  municipioMap.clear();
  categoriaMap.clear();

  filtroMunicipio.innerHTML = '<option value="">Todos los municipios</option>';
  (municipiosResp.data ?? []).forEach((municipio) => {
    municipioMap.set(municipio.id, municipio.nombre);
    const option = `<option value="${municipio.id}">${municipio.nombre}</option>`;
    filtroMunicipio.insertAdjacentHTML('beforeend', option);
  });
  construirOpcionesMunicipios();
  document.querySelectorAll('.sede-municipio').forEach((select) => {
    const actual = select.value;
    select.innerHTML = municipioOptionsHtml;
    select.value = actual;
  });

  filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>';
  selectCategoria.innerHTML = '<option value="">Selecciona...</option>';
  (categoriasResp.data ?? []).forEach((categoria) => {
    categoriaMap.set(categoria.id, {
      nombre: categoria.nombre,
      icono: categoria.icono || ''
    });
    const option = `<option value="${categoria.id}">${categoria.nombre}</option>`;
    filtroCategoria.insertAdjacentHTML('beforeend', option);
    selectCategoria.insertAdjacentHTML('beforeend', option);
  });
}

function normalizarEvento(evento) {
  const categoriaInfo = categoriaMap.get(evento.categoria) || { nombre: '—', icono: '' };
  const sedes = (evento.eventos_municipios || []).map((sede) => {
    const municipioNombre = municipioMap.get(sede.municipio_id) || '—';
    const fechas = (sede.eventoFechas || []).map((item) => ({
      id: item.id,
      fecha: item.fecha,
      horainicio: item.horainicio,
      mismahora: item.mismahora ?? false,
      municipio_id: sede.municipio_id,
      municipioNombre,
      lugar: sede.lugar || '',
      direccion: sede.direccion || '',
      enlaceboletos: sede.enlaceboletos || '',
      evento_municipio_id: sede.id
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
      ? 'Varias Localidades'
      : (municipioMap.get(municipioIds[0]) || '—');
  const fechas = sedes.flatMap((sede) => sede.fechas || []);

  return {
    ...evento,
    sedes,
    municipioIds,
    municipioNombre,
    categoriaNombre: categoriaInfo.nombre,
    categoriaIcono: categoriaInfo.icono,
    fechas,
    boletos_por_localidad: Boolean(evento.boletos_por_localidad)
  };
}

function aplicarFiltros() {
  const texto = filtroBusqueda.value.trim().toLowerCase();
  const municipio = filtroMunicipio.value;
  const categoria = filtroCategoria.value;
  const activo = filtroActivo.value;

  let lista = [...eventos];

  if (texto) {
    lista = lista.filter((evento) => evento.nombre.toLowerCase().includes(texto));
  }
  if (municipio) {
    const muniId = Number(municipio);
    lista = lista.filter((evento) => (evento.municipioIds || []).includes(muniId));
  }
  if (categoria) {
    lista = lista.filter((evento) => String(evento.categoria) === categoria);
  }
  if (activo) {
    const flag = activo === 'true';
    lista = lista.filter((evento) => Boolean(evento.activo) === flag);
  }

  renderEventos(lista);
}

function renderEventos(lista) {
  tablaEventos.innerHTML = '';
  listaEventosMobile.innerHTML = '';
  contadorEventos.textContent = `Mostrando ${lista.length} evento${lista.length === 1 ? '' : 's'}`;

  lista.forEach((evento) => {
    const estadoBadge = `<span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${evento.activo ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}">${evento.activo ? 'Activo' : 'Inactivo'}</span>`;
    const proximaFecha = obtenerProximaFechaEvento(evento.fechas);
    const fechaDetalle = proximaFecha ? obtenerPartesFecha(proximaFecha.fecha) : null;
    const horaDestacada = proximaFecha?.horainicio ? formatHora(proximaFecha.horainicio) : '';
    const categoriaIconoHtml = evento.categoriaIcono ? `<i class="fas ${evento.categoriaIcono}"></i>` : '';
    const costoTexto = evento.gratis ? 'Gratis' : (evento.costo || 'No disponible');

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="px-4 py-3 font-medium text-gray-800">${evento.nombre}</td>
      <td class="px-4 py-3 text-gray-600">${evento.municipioNombre}</td>
      <td class="px-4 py-3 text-gray-600">${evento.categoriaNombre}</td>
      <td class="px-4 py-3 text-gray-600">${formatFechasListado(evento.fechas)}</td>
      <td class="px-4 py-3 text-center">${estadoBadge}</td>
      <td class="px-4 py-3 text-center space-x-2">
        <button data-accion="editar" data-id="${evento.id}" class="text-blue-600 hover:text-blue-800">Editar</button>
        <button data-accion="toggle" data-id="${evento.id}" class="text-yellow-600 hover:text-yellow-800">${evento.activo ? 'Desactivar' : 'Activar'}</button>
        <button data-accion="eliminar" data-id="${evento.id}" class="text-red-600 hover:text-red-800">Eliminar</button>
      </td>
    `;
    tablaEventos.appendChild(fila);

    const card = document.createElement('article');
    card.className = 'bg-white rounded-lg shadow p-4 flex flex-col justify-between';
    card.innerHTML = `
      <div class="space-y-3">
        <header class="flex items-start justify-between gap-3">
          <div class="flex-1 flex flex-col items-center text-center gap-2">
            <h3 class="flex items-center justify-center text-center text-lg font-bold text-gray-800 leading-snug line-clamp-2 h-12">${evento.nombre}</h3>
            <div class="flex items-center justify-center gap-1 text-sm text-orange-500">
              ${categoriaIconoHtml}
              <span>${evento.categoriaNombre}</span>
            </div>
          </div>
          ${estadoBadge}
        </header>
        <div class="space-y-2 text-sm">
          ${fechaDetalle ? `
            <div class="flex flex-col items-center justify-center gap-0 text-red-600 font-medium leading-tight">
              <span>${fechaDetalle.weekday}</span>
              <span>${fechaDetalle.resto}</span>
            </div>
          ` : `
            <div class="flex items-center justify-center gap-2 text-red-600 font-medium leading-tight">Sin fecha</div>
          `}
          ${horaDestacada ? `<div class="flex items-center justify-center gap-2 text-red-600">${horaDestacada}</div>` : ''}
          <div class="flex items-center justify-center gap-2 font-medium" style="color:#23B4E9;">
            <i class="fas fa-map-pin"></i>
            <span>${evento.municipioNombre}</span>
          </div>
          <div class="text-green-600 font-semibold">Costo: ${costoTexto}</div>
        </div>
        <div class="text-xs text-gray-500 leading-snug border-t border-gray-100 pt-2">${formatFechasListado(evento.fechas)}</div>
      </div>
      <footer class="flex flex-wrap gap-3 text-sm pt-3 border-t border-gray-100 mt-3">
        <button data-accion="editar" data-id="${evento.id}" class="text-blue-600 hover:text-blue-800">Editar</button>
        <button data-accion="toggle" data-id="${evento.id}" class="text-yellow-600 hover:text-yellow-800">${evento.activo ? 'Desactivar' : 'Activar'}</button>
        <button data-accion="eliminar" data-id="${evento.id}" class="text-red-600 hover:text-red-800">Eliminar</button>
      </footer>
    `;
    listaEventosMobile.appendChild(card);
  });
}

async function cargarEventos() {
  if (typeof mostrarLoader === 'function') await mostrarLoader();
  try {
    await limpiarEventosExpirados();

    const { data: eventosData, error: errorEventos } = await supabase
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
        created_at,
        eventos_municipios (
          id,
          municipio_id,
          lugar,
          direccion,
          enlaceboletos,
          eventoFechas (
            id,
            fecha,
            horainicio,
            mismahora
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (errorEventos) throw errorEventos;

    eventos = (eventosData ?? []).map((evento) => normalizarEvento(evento));
    aplicarFiltros();
  } catch (error) {
    console.error('Error cargando eventos:', error);
    alert('No se pudieron cargar los eventos.');
  } finally {
    if (typeof ocultarLoader === 'function') await ocultarLoader();
  }
}

function resetModal() {
  eventoEnEdicion = null;
  formEvento.reset();
  imagenActual.classList.add('hidden');
  imagenActual.innerHTML = '';
  errorEvento.classList.add('hidden');
  errorEvento.textContent = '';
  checkActivo.checked = true;
  checkGratis.checked = false;
  inputCosto.removeAttribute('readonly');
  if (checkBoletosGlobal) checkBoletosGlobal.checked = true;
  if (inputBoletos) inputBoletos.value = '';
  limpiarSedesUI();
  agregarSedeUI();
}

function abrirModal(evento = null) {
  resetModal();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modalTitulo.textContent = evento ? 'Editar evento' : 'Nuevo evento';

  if (evento) {
    eventoEnEdicion = evento;
    eventoIdHidden.value = evento.id;
    inputNombre.value = evento.nombre || '';
    inputDescripcion.value = evento.descripcion || '';
    selectCategoria.value = evento.categoria || '';
    inputBoletos.value = evento.enlaceboletos || '';
    checkGratis.checked = Boolean(evento.gratis);
    inputCosto.value = evento.gratis ? 'Libre de Costo' : (evento.costo || '');
    if (evento.gratis) inputCosto.setAttribute('readonly', true);
    checkActivo.checked = Boolean(evento.activo);
    if (checkBoletosGlobal) {
      checkBoletosGlobal.checked = !evento.boletos_por_localidad;
    }
    actualizarModoBoletos();

    if (evento.imagen) {
      imagenActual.classList.remove('hidden');
      imagenActual.innerHTML = `Imagen actual: <a href="${evento.imagen}" target="_blank" class="text-blue-600 underline">ver</a>`;
    }

    cargarSedesDesdeEvento(evento.sedes || []);
  }
}

function cerrarModal() {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  resetModal();
}

btnNuevoEvento.addEventListener('click', () => abrirModal());
btnCerrarModal.addEventListener('click', cerrarModal);
btnCancelarModal.addEventListener('click', cerrarModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) cerrarModal();
});
btnAgregarSede.addEventListener('click', () => agregarSedeUI());

checkGratis.addEventListener('change', () => {
  if (checkGratis.checked) {
    inputCosto.value = 'Libre de Costo';
    inputCosto.setAttribute('readonly', true);
  } else {
    inputCosto.value = '';
    inputCosto.removeAttribute('readonly');
  }
});
if (checkBoletosGlobal) {
  checkBoletosGlobal.addEventListener('change', actualizarModoBoletos);
}

[filtroBusqueda, filtroMunicipio, filtroCategoria, filtroActivo].forEach((control) => {
  const evento = control === filtroBusqueda ? 'input' : 'change';
  control.addEventListener(evento, aplicarFiltros);
});

function delegarAcciones(contenedor) {
  contenedor.addEventListener('click', async (event) => {
    const accion = event.target?.dataset?.accion;
    if (!accion) return;
    const id = Number(event.target.dataset.id);
    if (!id) return;

    if (accion === 'editar') {
      const eventoSeleccionado = eventos.find((item) => item.id === id);
      if (eventoSeleccionado) abrirModal(eventoSeleccionado);
    }

    if (accion === 'toggle') {
      await toggleActivo(id);
    }

    if (accion === 'eliminar') {
      await eliminarEvento(id);
    }
  });
}

delegarAcciones(tablaEventos);
delegarAcciones(listaEventosMobile);

async function toggleActivo(id) {
  const evento = eventos.find((item) => item.id === id);
  if (!evento) return;

  if (typeof mostrarLoader === 'function') await mostrarLoader();
  try {
    const { data, error } = await supabase
      .from('eventos')
      .update({ activo: !evento.activo })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    const actualizado = { ...evento, activo: data.activo };
    const idx = eventos.findIndex((item) => item.id === id);
    if (idx !== -1) eventos[idx] = actualizado;
    aplicarFiltros();
  } catch (error) {
    console.error('No se pudo actualizar el estado del evento:', error);
    alert('No se pudo actualizar el estado del evento.');
  } finally {
    if (typeof ocultarLoader === 'function') await ocultarLoader();
  }
}

async function eliminarEvento(id) {
  if (!confirm('¿Eliminar este evento y todas sus fechas asociadas?')) return;

  if (typeof mostrarLoader === 'function') await mostrarLoader();
  try {
    const { error } = await supabase.from('eventos').delete().eq('id', id);
    if (error) throw error;

    eventos = eventos.filter((item) => item.id !== id);
    aplicarFiltros();
  } catch (error) {
    console.error('No se pudo eliminar el evento:', error);
    alert('Ocurrió un error al eliminar el evento.');
  } finally {
    if (typeof ocultarLoader === 'function') await ocultarLoader();
  }
}

async function subirImagen(file) {
  if (!file) return null;
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const nombreArchivo = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase
    .storage
    .from('galeriaeventos')
    .upload(nombreArchivo, file, { cacheControl: '3600', upsert: true });

  if (error) throw error;

  return `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriaeventos/${nombreArchivo}`;
}

async function manejarSubmit(event) {
  event.preventDefault();
  errorEvento.classList.add('hidden');
  errorEvento.textContent = '';

  const sedesPayload = sedesUI.map((item) => item.getData());

  if (sedesPayload.length === 0) {
    errorEvento.textContent = 'Agrega al menos un municipio con fechas.';
    errorEvento.classList.remove('hidden');
    return;
  }

  const sedeIncompleta = sedesPayload.find((sede) => !sede.municipio_id || !sede.lugar || !sede.direccion);
  if (sedeIncompleta) {
    errorEvento.textContent = 'Completa municipio, lugar y dirección en cada sede.';
    errorEvento.classList.remove('hidden');
    return;
  }

  const sedeSinFechas = sedesPayload.find((sede) => !Array.isArray(sede.fechas) || sede.fechas.length === 0);
  if (sedeSinFechas) {
    errorEvento.textContent = 'Cada municipio debe tener al menos una fecha.';
    errorEvento.classList.remove('hidden');
    return;
  }

  const fechaSinHora = sedesPayload.some((sede) => sede.fechas.some((item) => !item.horainicio));
  if (fechaSinHora) {
    errorEvento.textContent = 'Todas las fechas deben tener una hora asignada.';
    errorEvento.classList.remove('hidden');
    return;
  }

  const boletosPorLocalidad = !checkBoletosGlobal?.checked;
  if (boletosPorLocalidad) {
    const sedeSinLink = sedesPayload.find((sede) => !sede.enlaceboletos);
    if (sedeSinLink) {
      errorEvento.textContent = 'Agrega el link de boletos en cada localidad.';
      errorEvento.classList.remove('hidden');
      return;
    }
  }

  const sedePrincipal = sedesPayload[0];
  const enlaceGlobal = checkBoletosGlobal?.checked ? inputBoletos.value.trim() : '';
  const payloadBase = {
    nombre: inputNombre.value.trim(),
    descripcion: inputDescripcion.value.trim(),
    costo: checkGratis.checked ? 'Libre de Costo' : inputCosto.value.trim(),
    gratis: checkGratis.checked,
    lugar: sedePrincipal.lugar,
    direccion: sedePrincipal.direccion,
    municipio_id: sedePrincipal.municipio_id,
    categoria: Number(selectCategoria.value),
    enlaceboletos: enlaceGlobal || null,
    boletos_por_localidad: boletosPorLocalidad,
    activo: checkActivo.checked
  };

  if (!payloadBase.nombre || !payloadBase.descripcion || !payloadBase.municipio_id || !payloadBase.categoria) {
    errorEvento.textContent = 'Completa los campos obligatorios del formulario.';
    errorEvento.classList.remove('hidden');
    return;
  }

  try {
    if (typeof mostrarLoader === 'function') await mostrarLoader();

    let imagenUrl = eventoEnEdicion?.imagen || null;
    if (inputImagen.files?.[0]) {
      imagenUrl = await subirImagen(inputImagen.files[0]);
    }
    if (!imagenUrl) {
      errorEvento.textContent = 'Debes seleccionar una imagen para el evento.';
      errorEvento.classList.remove('hidden');
      return;
    }

    if (eventoEnEdicion) {
      const { data: eventoActualizado, error: errorEventoUpdate } = await supabase
        .from('eventos')
        .update({ ...payloadBase, imagen: imagenUrl })
        .eq('id', eventoEnEdicion.id)
        .select('id, nombre, descripcion, costo, gratis, lugar, direccion, municipio_id, categoria, enlaceboletos, imagen, activo')
        .single();

      if (errorEventoUpdate) throw errorEventoUpdate;

      await supabase.from('eventos_municipios').delete().eq('event_id', eventoEnEdicion.id);

      for (const sede of sedesPayload) {
        const { data: sedeCreada, error: errorSede } = await supabase
          .from('eventos_municipios')
          .insert({
            event_id: eventoEnEdicion.id,
            municipio_id: sede.municipio_id,
            lugar: sede.lugar,
            direccion: sede.direccion,
            enlaceboletos: boletosPorLocalidad ? (sede.enlaceboletos || null) : null
          })
          .select('id')
          .single();

        if (errorSede || !sedeCreada?.id) throw errorSede || new Error('No se pudo crear el municipio del evento');

        const fechasInsert = sede.fechas.map((item) => ({
          evento_municipio_id: sedeCreada.id,
          fecha: item.fecha,
          horainicio: item.horainicio,
          mismahora: item.mismahora
        }));

        const { error: errorFechas } = await supabase.from('eventoFechas').insert(fechasInsert);
        if (errorFechas) throw errorFechas;
      }

      await cargarEventos();
    } else {
      const { data: eventoCreado, error: errorInsert } = await supabase
        .from('eventos')
        .insert({ ...payloadBase, imagen: imagenUrl })
        .select('id, nombre, descripcion, costo, gratis, lugar, direccion, municipio_id, categoria, enlaceboletos, imagen, activo')
        .single();

      if (errorInsert || !eventoCreado) throw errorInsert;

      try {
        for (const sede of sedesPayload) {
        const { data: sedeCreada, error: errorSede } = await supabase
          .from('eventos_municipios')
          .insert({
            event_id: eventoCreado.id,
            municipio_id: sede.municipio_id,
            lugar: sede.lugar,
            direccion: sede.direccion,
            enlaceboletos: boletosPorLocalidad ? (sede.enlaceboletos || null) : null
          })
          .select('id')
          .single();

          if (errorSede || !sedeCreada?.id) throw errorSede || new Error('No se pudo crear el municipio del evento');

          const fechasInsert = sede.fechas.map((item) => ({
            evento_municipio_id: sedeCreada.id,
            fecha: item.fecha,
            horainicio: item.horainicio,
            mismahora: item.mismahora
          }));

          const { error: errorFechas } = await supabase.from('eventoFechas').insert(fechasInsert);
          if (errorFechas) throw errorFechas;
        }
      } catch (errorInsertFechas) {
        await supabase.from('eventos').delete().eq('id', eventoCreado.id);
        throw errorInsertFechas;
      }

      await cargarEventos();
    }

    cerrarModal();
  } catch (error) {
    console.error('Error guardando evento:', error);
    errorEvento.textContent = error.message || 'No se pudo guardar el evento.';
    errorEvento.classList.remove('hidden');
  } finally {
    if (typeof ocultarLoader === 'function') await ocultarLoader();
  }
}

formEvento.addEventListener('submit', manejarSubmit);

Promise.resolve()
  .then(cargarCatalogos)
  .then(cargarEventos)
  .catch((error) => {
    console.error('Error inicializando módulo de eventos:', error);
  });
