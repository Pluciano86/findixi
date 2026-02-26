import { supabase, idComercio as idComercioDesdeQuery } from '../shared/supabaseClient.js';

const form = document.getElementById('formCrearCupon');
const btnGuardar = document.getElementById('btnGuardarCupon');
const mensajeEl = document.getElementById('mensajeResultado');
const selectComercio = document.getElementById('selectComercio');
const buscarComercioEl = document.getElementById('buscarComercio');

const tituloEl = document.getElementById('titulo');
const descripcionEl = document.getElementById('descripcion');
const descuentoEl = document.getElementById('descuento');
const fechaInicioEl = document.getElementById('fechaInicio');
const fechaFinEl = document.getElementById('fechaFin');
const codigoSecretoEl = document.getElementById('codigoSecreto');
const inputImagenEl = document.getElementById('inputImagenCupon');

let comerciosCatalogo = [];

// === Renderizar comercios ===
function renderComercios(filtro = '') {
  if (!selectComercio) return;
  const filtroLower = filtro.trim().toLowerCase();
  selectComercio.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Selecciona un comercio';
  selectComercio.appendChild(placeholder);

  comerciosCatalogo
    .filter((c) => !filtroLower || c.nombreBusqueda.includes(filtroLower))
    .forEach((comercio) => {
      const opt = document.createElement('option');
      opt.value = comercio.id;
      opt.textContent = comercio.label;
      selectComercio.appendChild(opt);
    });
}

// === Cargar comercios ===
async function cargarComercios() {
  if (!selectComercio) return;

  selectComercio.innerHTML = '<option value="">Cargando comercios...</option>';

  const { data, error } = await supabase
    .from('Comercios')
    .select('id, nombre, nombreSucursal')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('❌ Error cargando comercios para cupones:', error);
    selectComercio.innerHTML = '<option value="">No se pudieron cargar los comercios</option>';
    return;
  }

  comerciosCatalogo = (data || []).map((c) => {
    const label = c.nombreSucursal
      ? `${c.nombre} — ${c.nombreSucursal}`
      : c.nombre;
    return {
      id: c.id,
      label,
      nombreBusqueda: label.toLowerCase()
    };
  });

  const idPreferido =
    idComercioDesdeQuery ||
    localStorage.getItem('admin:idComercioSeleccionado') ||
    '';
  renderComercios(buscarComercioEl?.value || '');

  if (idPreferido) {
    const coincide = comerciosCatalogo.some((c) => String(c.id) === String(idPreferido));
    if (!coincide) {
      const opt = document.createElement('option');
      opt.value = idPreferido;
      opt.textContent = `Comercio #${idPreferido}`;
      selectComercio.appendChild(opt);
    }
    selectComercio.value = idPreferido;
  }
}

// === Obtener comercio seleccionado ===
function obtenerIdComercio() {
  const seleccionado = selectComercio?.value || '';
  if (seleccionado) {
    localStorage.setItem('admin:idComercioSeleccionado', seleccionado);
    return Number(seleccionado);
  }

  const desdeStorage = localStorage.getItem('admin:idComercioSeleccionado');
  if (desdeStorage) {
    selectComercio.value = desdeStorage;
    return Number(desdeStorage);
  }

  console.error('❌ No se seleccionó comercio para el cupón.');
  return NaN;
}

// === Subir imagen al bucket "cupones" ===
async function subirImagenCupon(idComercio, file) {
  const ext = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const ruta = `${idComercio}/${fileName}`;

  console.log('Archivo seleccionado:', file.name, 'Ruta destino:', ruta);

  const { error: uploadError } = await supabase.storage
    .from('cupones')
    .upload(ruta, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg'
    });

  if (uploadError) {
    console.error('❌ Error subiendo imagen del cupón:', uploadError);
    throw uploadError;
  }

  const { data: publicData } = supabase.storage
    .from('cupones')
    .getPublicUrl(ruta);

  const publicUrl = publicData?.publicUrl ?? null;
  console.log('URL pública imagen:', publicUrl);
  return publicUrl;
}

// === Validar fechas ===
function validarFechas(inicio, fin) {
  if (!inicio || !fin) return true;
  const inicioDate = new Date(inicio);
  const finDate = new Date(fin);
  if (Number.isNaN(inicioDate.getTime()) || Number.isNaN(finDate.getTime())) return true;
  return finDate >= inicioDate;
}

// === Listeners de búsqueda y selección ===
buscarComercioEl?.addEventListener('input', (e) => {
  renderComercios(e.target.value || '');
});

selectComercio?.addEventListener('change', () => {
  if (selectComercio.value) {
    localStorage.setItem('admin:idComercioSeleccionado', selectComercio.value);
  }
});

// === Guardar cupón ===
btnGuardar?.addEventListener('click', async () => {
  const idComercio = obtenerIdComercio();
  if (!idComercio) {
    alert('Selecciona el comercio al que pertenece este cupón.');
    return;
  }

  const titulo = tituloEl.value.trim();
  const descripcion = descripcionEl.value.trim();
  const descuento = descuentoEl.value.trim() || null;
  const fechaInicio = fechaInicioEl.value || null;
  const fechaFin = fechaFinEl.value || null;
  const codigoSecreto = codigoSecretoEl.value.trim();
  const file = inputImagenEl.files?.[0] ?? null;

  if (!titulo || !codigoSecreto) {
    alert('El título y el código secreto son obligatorios.');
    return;
  }

  if (!validarFechas(fechaInicio, fechaFin)) {
    alert('La fecha final no puede ser menor que la inicial.');
    return;
  }

  btnGuardar.disabled = true;
  mensajeEl.textContent = 'Guardando cupón...';
  mensajeEl.className = 'mt-4 text-sm text-blue-600';

  let imagenUrl = null;

  try {
    if (file) {
      imagenUrl = await subirImagenCupon(idComercio, file);
    }

    // Convertir variables al formato de la tabla (minúsculas)
    const fechainicio = fechaInicio;
    const fechafin = fechaFin;
    const codigosecreto = codigoSecreto;

    const payload = {
      idComercio,
      titulo,
      descripcion: descripcion || null,
      descuento: descuento ?? null,
      fechainicio,
      fechafin,
      activo: true,
      codigosecreto,
      imagen: imagenUrl
    };

    console.log('Insertando cupón con payload:', payload);

    const { error: insertError } = await supabase
      .from('cupones')
      .insert(payload);

    if (insertError) {
      console.error('❌ Error insertando cupón:', insertError);
      throw insertError;
    }

    mensajeEl.textContent = '✅ Cupón creado exitosamente.';
    mensajeEl.className = 'mt-4 text-sm text-green-600';
    form.reset();

    if (selectComercio.value) {
      selectComercio.value = String(idComercio);
    }
  } catch (error) {
    console.error('🛑 Error general creando cupón:', error);
    mensajeEl.textContent = 'Error creando el cupón. Revisa la consola para más detalles.';
    mensajeEl.className = 'mt-4 text-sm text-red-600';
  } finally {
    btnGuardar.disabled = false;
  }
});

// === Inicializar ===
cargarComercios();