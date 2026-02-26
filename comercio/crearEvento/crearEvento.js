import { supabase } from '../shared/supabaseClient.js';

const form = document.getElementById('formCrearEvento');
const sedesContainer = document.getElementById('sedesContainer');
const btnAgregarSede = document.getElementById('btnAgregarSede');
const categoriaSelect = document.getElementById('categoria');
const gratisCheckbox = document.getElementById('gratis');
const costoInput = document.getElementById('costo');
const checkBoletosGlobal = document.getElementById('boletosGlobal');
const inputBoletosGlobal = document.getElementById('enlaceBoletos');

const sedesUI = [];
let municipioOptionsHtml = '<option value="">Selecciona un municipio</option>';

function formatFecha(fechaStr) {
  try {
    const fecha = new Date(`${fechaStr}T00:00:00`);
    return fecha.toLocaleDateString('es-PR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return fechaStr;
  }
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
    <div class="sede-lista-fechas hidden bg-white border border-gray-200 rounded-lg divide-y divide-gray-200"></div>
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
          ? `<span class="text-sm text-gray-600">${item.horainicio || '--:--'}</span>`
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
      alert('Selecciona una fecha válida.');
      return;
    }

    if (fechasLocal.some((item) => item.fecha === fecha)) {
      alert('Esa fecha ya fue agregada.');
      return;
    }

    if (checkMismaHora.checked) {
      if (!hora) {
        alert('Selecciona la hora que deseas aplicar a todas las fechas.');
        return;
      }
      fechasLocal.push({ fecha, horainicio: hora, mismahora: true });
      fechasLocal.forEach((item) => {
        item.horainicio = hora;
        item.mismahora = true;
      });
    } else {
      if (!hora) {
        alert('Selecciona la hora de inicio para esa fecha.');
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
        alert('Selecciona una hora para aplicar a todas las fechas.');
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

function actualizarModoBoletos() {
  const usarGlobal = Boolean(checkBoletosGlobal?.checked);
  if (inputBoletosGlobal) inputBoletosGlobal.disabled = !usarGlobal;
  sedesContainer.querySelectorAll('.sede-boletos-wrapper').forEach((wrapper) => {
    wrapper.classList.toggle('hidden', usarGlobal);
  });
  sedesContainer.querySelectorAll('.sede-boletos').forEach((input) => {
    input.disabled = usarGlobal;
  });
}

async function cargarSelects() {
  const [{ data: municipios }, { data: categorias }] = await Promise.all([
    supabase.from('Municipios').select('id, nombre').order('nombre'),
    supabase.from('categoriaEventos').select('id, nombre').order('nombre')
  ]);

  municipioOptionsHtml = '<option value="">Selecciona un municipio</option>';
  (municipios || []).forEach((m) => {
    municipioOptionsHtml += `<option value="${m.id}">${m.nombre}</option>`;
  });

  categorias?.forEach((c) => {
    categoriaSelect.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.nombre}</option>`);
  });

  limpiarSedesUI();
  agregarSedeUI();
}

cargarSelects().catch((error) => {
  console.error('Error cargando catálogos de eventos:', error);
});

btnAgregarSede.addEventListener('click', () => agregarSedeUI());

gratisCheckbox.addEventListener('change', () => {
  if (gratisCheckbox.checked) {
    costoInput.value = 'Libre de Costo';
    costoInput.setAttribute('readonly', true);
  } else {
    costoInput.value = '';
    costoInput.removeAttribute('readonly');
  }
});
if (checkBoletosGlobal) {
  checkBoletosGlobal.addEventListener('change', actualizarModoBoletos);
}

async function subirImagenEvento(file) {
  if (!file) throw new Error('Debes seleccionar una imagen del evento.');
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const nombreArchivo = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('galeriaeventos')
    .upload(nombreArchivo, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message || 'No se pudo subir la imagen');
  }

  return `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriaeventos/${nombreArchivo}`;
}

async function eliminarEventoFallido(eventoId) {
  try {
    await supabase.from('eventos').delete().eq('id', eventoId);
  } catch (error) {
    console.error('No se pudo revertir el evento creado tras un fallo:', error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const sedesPayload = sedesUI.map((item) => item.getData());

  if (sedesPayload.length === 0) {
    alert('Agrega al menos un municipio con fechas.');
    return;
  }

  const sedeIncompleta = sedesPayload.find((sede) => !sede.municipio_id || !sede.lugar || !sede.direccion);
  if (sedeIncompleta) {
    alert('Completa municipio, lugar y dirección en cada sede.');
    return;
  }

  const sedeSinFechas = sedesPayload.find((sede) => !Array.isArray(sede.fechas) || sede.fechas.length === 0);
  if (sedeSinFechas) {
    alert('Cada municipio debe tener al menos una fecha.');
    return;
  }

  const fechaSinHora = sedesPayload.some((sede) => sede.fechas.some((item) => !item.horainicio));
  if (fechaSinHora) {
    alert('Asegúrate de que todas las fechas tengan una hora de inicio definida.');
    return;
  }

  const boletosPorLocalidad = !checkBoletosGlobal?.checked;
  if (boletosPorLocalidad) {
    const sedeSinLink = sedesPayload.find((sede) => !sede.enlaceboletos);
    if (sedeSinLink) {
      alert('Agrega el link de boletos en cada localidad.');
      return;
    }
  }

  const formData = new FormData(form);
  const imagenFile = formData.get('imagen');

  try {
    if (typeof mostrarLoader === 'function') await mostrarLoader();

    const imagenUrl = await subirImagenEvento(imagenFile);
    const sedePrincipal = sedesPayload[0];

    const enlaceGlobal = checkBoletosGlobal?.checked ? formData.get('enlaceBoletos')?.trim() : '';
    const eventoPayload = {
      nombre: formData.get('nombre')?.trim(),
      descripcion: formData.get('descripcion')?.trim(),
      costo: gratisCheckbox.checked ? 'Libre de Costo' : formData.get('costo')?.trim(),
      gratis: gratisCheckbox.checked,
      lugar: sedePrincipal.lugar,
      direccion: sedePrincipal.direccion,
      municipio_id: sedePrincipal.municipio_id,
      categoria: Number(formData.get('categoria')),
      enlaceboletos: enlaceGlobal || null,
      boletos_por_localidad: boletosPorLocalidad,
      imagen: imagenUrl,
      activo: true
    };

    const { data: eventoCreado, error: errorEvento } = await supabase
      .from('eventos')
      .insert([eventoPayload])
      .select('id')
      .single();

    if (errorEvento || !eventoCreado?.id) {
      throw new Error(errorEvento?.message || 'No se pudo crear el evento');
    }

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

        const fechasPayload = sede.fechas.map((item) => ({
          evento_municipio_id: sedeCreada.id,
          fecha: item.fecha,
          horainicio: item.horainicio,
          mismahora: item.mismahora
        }));

        const { error: errorFechas } = await supabase
          .from('eventoFechas')
          .insert(fechasPayload);

        if (errorFechas) throw errorFechas;
      }
    } catch (errorInsertFechas) {
      await eliminarEventoFallido(eventoCreado.id);
      throw errorInsertFechas;
    }

    alert('Evento creado exitosamente.');
    form.reset();
    limpiarSedesUI();
    agregarSedeUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    console.error('Error al crear evento:', error);
    alert(error.message || 'Ocurrió un error al crear el evento.');
  } finally {
    if (typeof ocultarLoader === 'function') await ocultarLoader();
  }
});
