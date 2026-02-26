// adminEspeciales.js
import { supabase } from '../shared/supabaseClient.js';
import { resolverPlanComercio } from '../shared/planes.js';

const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sabado'];
let tipoActual = 'almuerzo';
let diaSeleccionado = null;
const idComercio = new URLSearchParams(window.location.search).get('id');
const planBadge = document.getElementById('planBadge');
const btnCambiarPlan = document.getElementById('btnCambiarPlan');

// Elementos DOM
const contenedorDias = document.getElementById('contenedorDias');
const contenedorFrecuentes = document.getElementById('contenedorFrecuentes');
const btnAlmuerzo = document.getElementById('btnAlmuerzo');
const btnHappy = document.getElementById('btnHappy');
const modal = document.getElementById('modalEditarEspecial');
const form = document.getElementById('formEditarEspecial');
const cerrarModal = document.getElementById('cerrarModal');
const imgPreview = document.getElementById('editarImagenActual');

const inputId = document.getElementById('editarIdEspecial');
const inputNombre = document.getElementById('editarNombre');
const inputDescripcion = document.getElementById('editarDescripcion');
const inputPrecio = document.getElementById('editarPrecio');
const inputPermanente = document.getElementById('editarPermanente');
const inputFrecuente = document.getElementById('guardarComoFrecuente');
const inputNuevaImagen = document.getElementById('editarNuevaImagen');
const selectFrecuentes = document.getElementById('selectFrecuentes');

inputNuevaImagen.addEventListener('change', () => {
  const file = inputNuevaImagen.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      imgPreview.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
});

btnAlmuerzo.addEventListener('click', () => {
  tipoActual = 'almuerzo';
  actualizarBotones();
  cargarEspeciales();
});

btnHappy.addEventListener('click', () => {
  tipoActual = 'happyhour';
  actualizarBotones();
  cargarEspeciales();
});

function actualizarBotones() {
  btnAlmuerzo.classList.toggle('bg-blue-600', tipoActual === 'almuerzo');
  btnAlmuerzo.classList.toggle('text-white', tipoActual === 'almuerzo');
  btnAlmuerzo.classList.toggle('bg-gray-200', tipoActual !== 'almuerzo');
  btnAlmuerzo.classList.toggle('text-gray-700', tipoActual !== 'almuerzo');
  btnHappy.classList.toggle('bg-blue-600', tipoActual === 'happyhour');
  btnHappy.classList.toggle('text-white', tipoActual === 'happyhour');
  btnHappy.classList.toggle('bg-gray-200', tipoActual !== 'happyhour');
  btnHappy.classList.toggle('text-gray-700', tipoActual !== 'happyhour');
}
function mostrarOverlayPlan() {
  const existente = document.getElementById('planOverlay');
  if (existente) return;
  const overlay = document.createElement('div');
  overlay.id = 'planOverlay';
  overlay.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-3">
      <h2 class="text-xl font-semibold text-gray-900">Especiales disponibles en Findixi Plus</h2>
      <p class="text-sm text-gray-600">Actualiza tu plan para administrar almuerzos y happy hours.</p>
      <a href="../paquetes.html?id=${idComercio}" class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
        Cambiar Plan
      </a>
    </div>
  `;
  document.body.appendChild(overlay);
}

function comercioVerificado(comercio = {}) {
  const estadoPropiedad = String(comercio?.estado_propiedad || '').toLowerCase();
  const estadoVerificacion = String(comercio?.estado_verificacion || '').toLowerCase();
  const propietarioVerificado = comercio?.propietario_verificado === true;
  const verificacionOk = ['otp_verificado', 'sms_verificado', 'messenger_verificado', 'manual_aprobado'].includes(
    estadoVerificacion
  );
  return estadoPropiedad === 'verificado' && (propietarioVerificado || verificacionOk);
}

async function cargarPlan() {
  if (!idComercio) return true;
  const { data, error } = await supabase
    .from('Comercios')
    .select('plan_id, plan_nivel, plan_nombre, permite_especiales, estado_propiedad, estado_verificacion, propietario_verificado')
    .eq('id', idComercio)
    .maybeSingle();

  if (error) {
    console.warn('No se pudo cargar plan del comercio:', error?.message || error);
    return true;
  }

  const planInfo = resolverPlanComercio(data || {});
  const verificado = comercioVerificado(data || {});
  if (planBadge) planBadge.textContent = `${planInfo.nombre} (Nivel ${planInfo.nivel})`;
  if (btnCambiarPlan) btnCambiarPlan.href = `../paquetes.html?id=${idComercio}`;

  if (!planInfo.permite_especiales) {
    if (!verificado) {
      const existente = document.getElementById('planOverlay');
      if (!existente) {
        const overlay = document.createElement('div');
        overlay.id = 'planOverlay';
        overlay.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
        overlay.innerHTML = `
          <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center space-y-3">
            <h2 class="text-xl font-semibold text-gray-900">Propiedad pendiente de verificación</h2>
            <p class="text-sm text-gray-600">Los especiales se habilitan cuando el comercio completa su verificación.</p>
            <a href="../paquetes.html?id=${idComercio}" class="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
              Ver estado del comercio
            </a>
          </div>
        `;
        document.body.appendChild(overlay);
      }
      return false;
    }
    mostrarOverlayPlan();
    return false;
  }
  return true;
}

async function init() {
  const planOk = await cargarPlan();
  actualizarBotones();
  if (planOk) cargarEspeciales();
}

init();

async function cargarEspeciales() {
  contenedorDias.innerHTML = '';
  contenedorFrecuentes.innerHTML = '';
  selectFrecuentes.innerHTML = '<option value="">-- Elige una opción frecuente --</option>';

const { data: frecuentes } = await supabase
  .from('especialesDia')
  .select('*')
  .eq('idcomercio', idComercio)
  .eq('tipo', tipoActual)
  .eq('frecuente', true);

if (frecuentes?.length) {
  frecuentes.forEach(e => {
    const option = document.createElement('option');
    option.value = JSON.stringify(e);
    option.textContent = e.nombre;
    selectFrecuentes.appendChild(option);
  });
}

  // 🔄 Limpieza automática de especiales expirados
  const hoy = new Date().getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

  // 1. Buscar especiales a eliminar (no frecuentes, no permanentes, no del día de hoy)
  const { data: especialesAEliminar, error: fetchError } = await supabase
    .from('especialesDia')
    .select('id, imagen')
    .eq('idcomercio', idComercio)
    .eq('tipo', tipoActual)
    .eq('permanente', false)
    .eq('frecuente', false)
    .neq('diasemana', hoy);

  if (fetchError) {
    console.error('Error buscando especiales a eliminar:', fetchError);
  } else {
    const idsAEliminar = especialesAEliminar.map(e => e.id);
    const imagenesAEliminar = especialesAEliminar
  .filter(e => !e.frecuente && !e.permanente) // aseguramos que no borre las imágenes de frecuentes
  .map(e => e.imagen)
  .filter(Boolean);

if (imagenesAEliminar.length) {
  const { error: deleteImgError } = await supabase
    .storage
    .from('galeriacomercios')
    .remove(imagenesAEliminar);

  if (deleteImgError) console.warn('Error eliminando imágenes del bucket', deleteImgError);
}

    // 1B. Eliminar los especiales de la tabla
    if (idsAEliminar.length) {
      const { error: deleteError } = await supabase
        .from('especialesDia')
        .delete()
        .in('id', idsAEliminar);

      if (deleteError) console.error('Error eliminando especiales expirados:', deleteError);
    }
  }

  // 2. Marcar frecuentes de días pasados como inactivos
  const { error: updateFrecuentesError } = await supabase
    .from('especialesDia')
    .update({ activo: false })
    .eq('idcomercio', idComercio)
    .eq('tipo', tipoActual)
    .eq('frecuente', true)
    .neq('diasemana', hoy);

  if (updateFrecuentesError) {
    console.error('Error actualizando frecuentes expirados:', updateFrecuentesError);
  }

  // 🔁 Mostrar especiales por día
  for (let i = 0; i < dias.length; i++) {
    const { data: especiales } = await supabase
      .from('especialesDia')
      .select('*')
      .eq('idcomercio', idComercio)
      .eq('tipo', tipoActual)
      .eq('diasemana', i)
      .eq('activo', true);

    const seccion = document.createElement('section');
    seccion.className = 'bg-white p-4 rounded shadow mb-4';

    const titulo = document.createElement('div');
    titulo.className = 'flex items-center justify-between mb-2';
    titulo.innerHTML = `
      <h3 class="text-lg font-bold">${dias[i]}</h3>
      <button class="text-sm bg-green-600 text-white px-3 py-1 rounded btn-abrir-modal" data-dia="${i}">Añadir</button>
    `;

    const lista = document.createElement('div');
    if (!especiales?.length) {
      lista.innerHTML = `<p class="text-gray-500 text-sm">No hay especiales para este día.</p>`;
    } else {
      for (const e of especiales) {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'bg-gray-50 border rounded p-3 mb-2 shadow-sm cursor-pointer hover:bg-gray-100 transition';
        const urlImagen = e.imagen
          ? `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${encodeURIComponent(e.imagen)}`
          : 'https://via.placeholder.com/100x100.png?text=Especial';

        tarjeta.innerHTML = `
  <div class="flex gap-4 items-start">
    <img src="${urlImagen}" alt="Especial" class="w-20 h-20 rounded object-cover">
    <div class="flex-1">
      <h4 class="font-semibold">${e.nombre}</h4>
      <p class="text-sm text-gray-600">${e.descripcion || ''}</p>
      <p class="text-sm font-bold mt-1">$${e.precio?.toFixed(2) || '0.00'}</p>
    </div>
  </div>
  <div class="flex justify-between items-center mt-3 text-sm text-gray-600">
    <div class="flex gap-3 mt-2 text-sm text-gray-600 acciones-especiales">
  <label><input type="checkbox" class="chk-permanente" data-id="${e.id}" ${e.permanente ? 'checked' : ''}> Permanente</label>
  <label><input type="checkbox" class="chk-frecuente" data-id="${e.id}" ${e.frecuente ? 'checked' : ''}> Frecuente</label>
  <button class="text-red-500 btn-eliminar-especial" data-id="${e.id}">❌ Eliminar</button>
  <button class="text-yellow-600 btn-editar-especial" data-id="${e.id}">✏️ Editar</button>
</div>
  </div>
`;
        
        lista.appendChild(tarjeta);
      }
    }

    seccion.appendChild(titulo);
    seccion.appendChild(lista);
    contenedorDias.appendChild(seccion);
  }
}

function abrirModalNuevo() {
  form.reset();
  inputId.value = '';
  imgPreview.src = '';
  modal.classList.remove('hidden');
}

export async function abrirModal(especial) {
  inputId.value = especial.id;
  inputNombre.value = especial.nombre || '';
  inputDescripcion.value = especial.descripcion || '';
  inputPrecio.value = especial.precio?.toFixed(2) || '';
  inputPermanente.checked = !!especial.permanente;
  inputFrecuente.checked = !!especial.frecuente;
  inputNuevaImagen.value = '';
  selectFrecuentes.value = '';

  const urlImagen = especial.imagen
    ? `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${encodeURIComponent(especial.imagen)}`
    : 'https://via.placeholder.com/100x100.png?text=Especial';

  imgPreview.src = urlImagen;
  imgPreview.classList.remove('hidden');
  modal.classList.remove('hidden');
}

selectFrecuentes.addEventListener('change', (e) => {
  const data = e.target.value;
  if (!data) return;
  const especialOriginal = JSON.parse(data);

  // Llenar el formulario pero como si fuera un nuevo especial
  inputId.value = ''; // <--- IMPORTANTE: no hay ID = es nuevo
  inputNombre.value = especialOriginal.nombre || '';
  inputDescripcion.value = especialOriginal.descripcion || '';
  inputPrecio.value = especialOriginal.precio?.toFixed(2) || '';
  inputPermanente.checked = false;
  inputFrecuente.checked = false;
  inputNuevaImagen.value = '';
  imgPreview.src = especialOriginal.imagen
    ? `https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/${encodeURIComponent(especialOriginal.imagen)}`
    : 'https://via.placeholder.com/100x100.png?text=Especial';
  imgPreview.classList.remove('hidden');
  modal.classList.remove('hidden');
});

cerrarModal.addEventListener('click', () => {
  modal.classList.add('hidden');
  form.reset();
  imgPreview.src = '';
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.classList.contains('btn-abrir-modal')) {
    diaSeleccionado = parseInt(e.target.dataset.dia);
    abrirModalNuevo();
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = inputId.value;
  const nombre = inputNombre.value;
  const descripcion = inputDescripcion.value;
  const precio = parseFloat(inputPrecio.value) || 0;
  const permanente = inputPermanente.checked;
  const frecuente = inputFrecuente.checked;
  const nuevaImagen = inputNuevaImagen.files[0];
  const imagenActual = imgPreview.src.includes('galeriacomercios') ? decodeURIComponent(imgPreview.src.split('/galeriacomercios/')[1]) : null;
  let imagenFinal = imagenActual;

  // Si hay imagen nueva, subirla y usarla
  if (nuevaImagen) {
    const nombreArchivo = `especiales/${Date.now()}_${nuevaImagen.name}`;
    const { error: uploadError } = await supabase.storage
      .from('galeriacomercios')
      .upload(nombreArchivo, nuevaImagen, { upsert: true });
    if (uploadError) return alert('Error subiendo nueva imagen');
    imagenFinal = nombreArchivo;
  }

  if (!id) {
    // 🔹 Nuevo registro
    const { error: insertError } = await supabase.from('especialesDia').insert({
      idcomercio: idComercio,
      nombre,
      descripcion,
      precio,
      permanente,
      frecuente,
      activo: true,
      diasemana: diaSeleccionado,
      tipo: tipoActual,
      imagen: imagenFinal
    });

    if (insertError) {
      alert('Error al guardar especial');
      console.error(insertError);
    } else {
      alert('Especial creado');
      modal.classList.add('hidden');
      await cargarEspeciales();
    }
  } else {
    // 🔄 Actualización existente
    const { error: updateError } = await supabase.from('especialesDia').update({
      nombre,
      descripcion,
      precio,
      permanente,
      frecuente,
      ...(imagenFinal && { imagen: imagenFinal })
    }).eq('id', id);

    if (updateError) {
      alert('Error al guardar cambios');
      console.error(updateError);
    } else {
      alert('Especial actualizado');
      modal.classList.add('hidden');
      await cargarEspeciales();
    }
  }
});

document.addEventListener('click', async (e) => {
  if (e.target && e.target.classList.contains('btn-eliminar-especial')) {
    e.stopPropagation();
    const id = e.target.dataset.id;

    const confirmar = confirm('¿Deseas eliminar este especial?');
    if (!confirmar) return;

    const { data: especial } = await supabase
      .from('especialesDia')
      .select('imagen')
      .eq('id', id)
      .single();

    if (especial?.imagen) {
      await supabase.storage
        .from('galeriacomercios')
        .remove([especial.imagen]);
    }

    const { error: deleteError } = await supabase
      .from('especialesDia')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert('Error al eliminar especial');
      console.error(deleteError);
    } else {
      alert('Especial eliminado');
      await cargarEspeciales();
    }
  }
});

document.addEventListener('click', async (e) => {
  if (e.target && e.target.classList.contains('btn-editar-especial')) {
    e.stopPropagation();
    const id = e.target.dataset.id;

    const { data: especial, error } = await supabase
      .from('especialesDia')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error cargando especial:', error);
      return alert('No se pudo cargar el especial');
    }

    diaSeleccionado = especial.diasemana;
    abrirModal(especial);
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.classList.contains('chk-permanente')) {
    const id = e.target.dataset.id;
    const permanente = e.target.checked;

    const { error } = await supabase
      .from('especialesDia')
      .update({ permanente })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando permanente:', error);
      alert('Error actualizando campo Permanente');
    }
  }

  if (e.target.classList.contains('chk-frecuente')) {
    const id = e.target.dataset.id;
    const frecuente = e.target.checked;

    const { error } = await supabase
      .from('especialesDia')
      .update({ frecuente })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando frecuente:', error);
      alert('Error actualizando campo Frecuente');
    }
  }
});
