import { supabase } from '../shared/supabaseClient.js';
import { resolvePath } from '../shared/pathResolver.js';
import { getPublicBase } from '../shared/utils.js';

const params = new URLSearchParams(window.location.search);
const idLugar = params.get('id');

const elementos = {
  form: document.getElementById('formLugar'),
  btnGuardar: document.getElementById('btnGuardar'),
  btnCancelar: document.getElementById('btnCancelar'),
  btnCancelarSecundario: document.getElementById('btnCancelarSecundario'),
  mensaje: document.getElementById('mensajeSistema'),
  previewImagen: document.getElementById('previewImagen'),
  inputImagen: document.getElementById('inputImagen'),
  nombre: document.getElementById('nombre'),
  municipio: document.getElementById('municipio'),
  direccion: document.getElementById('direccion'),
  descripcion: document.getElementById('descripcion'),
  latitud: document.getElementById('latitud'),
  longitud: document.getElementById('longitud'),
  precioEntrada: document.getElementById('precioEntrada'),
  gratis: document.getElementById('gratis'),
  telefono: document.getElementById('telefono'),
  web: document.getElementById('web'),
  facebook: document.getElementById('facebook'),
  instagram: document.getElementById('instagram'),
  tiktok: document.getElementById('tiktok'),
  activo: document.getElementById('activo'),
  abiertoSiempre: document.getElementById('abiertoSiempre'),
  cerradoTemporalmente: document.getElementById('cerradoTemporalmente'),
  categoriasContainer:
    document.getElementById('categoriasContainer') ||
    document.getElementById('opcionesCategorias'),
  horariosContainer:
    document.getElementById('tablaHorariosLugares') ||
    document.getElementById('horariosContainer'),
};

const PLACEHOLDER_IMAGEN = resolvePath('img/default-lugar.jpg');
const BUCKET_LUGARES = 'galerialugares';
const CARPETA_IMAGENES = 'imagenes';
const PUBLIC_STORAGE_PREFIX = `${getPublicBase('')}/`;
const DIAS = [
  { db: 1, label: 'Lunes' },
  { db: 2, label: 'Martes' },
  { db: 3, label: 'Miércoles' },
  { db: 4, label: 'Jueves' },
  { db: 5, label: 'Viernes' },
  { db: 6, label: 'Sábado' },
  { db: 0, label: 'Domingo' },
];

let categoriasDisponibles = [];
let categoriasSeleccionadas = new Set();
let horariosLugares = new Map();
let imagenActualPath = '';
let imagenNuevaFile = null;
let previewTemporalUrl = null;
let eventosInicializados = false;

function mostrarMensaje(tipo, mensaje, { persistente = tipo === 'error', duracion = 5000 } = {}) {
  if (!elementos.mensaje) {
    if (tipo === 'error') {
      console.error(mensaje);
    } else {
      console.info(mensaje);
    }
    return;
  }

  const clasesBase = 'max-w-4xl mx-auto mb-4 px-4 py-3 rounded border text-sm';
  const colores = {
    success: 'bg-emerald-50 border-emerald-400 text-emerald-700',
    info: 'bg-sky-50 border-sky-400 text-sky-700',
    error: 'bg-red-50 border-red-400 text-red-700',
  };
  elementos.mensaje.className = `${clasesBase} ${colores[tipo] || colores.info}`;
  elementos.mensaje.textContent = mensaje;
  elementos.mensaje.classList.remove('hidden');

  if (!persistente) {
    setTimeout(() => {
      if (elementos.mensaje) {
        elementos.mensaje.classList.add('hidden');
      }
    }, duracion);
  }
}

function ocultarMensaje() {
  if (!elementos.mensaje) return;
  elementos.mensaje.classList.add('hidden');
  elementos.mensaje.textContent = '';
}

function deshabilitarFormulario() {
  if (!elementos.form) return;
  const controles = elementos.form.querySelectorAll('input, textarea, select, button');
  controles.forEach((control) => {
    if (control === elementos.btnCancelar || control === elementos.btnCancelarSecundario) return;
    control.disabled = true;
    control.classList.add('opacity-60', 'cursor-not-allowed');
  });
  if (elementos.btnGuardar) {
    elementos.btnGuardar.disabled = true;
    elementos.btnGuardar.classList.add('opacity-60', 'cursor-not-allowed');
  }
}

function obtenerUrlImagen(path) {
  if (!path) return PLACEHOLDER_IMAGEN;
  if (/^https?:\/\//i.test(path)) return path;
  return getPublicBase(path);
}

function obtenerRutaRelativa(path) {
  if (!path) return null;
  let limpio = path.trim();
  if (!limpio || limpio === PLACEHOLDER_IMAGEN) return null;
  if (limpio.startsWith(PUBLIC_STORAGE_PREFIX)) {
    limpio = limpio.slice(PUBLIC_STORAGE_PREFIX.length);
  }
  limpio = limpio.replace(/^public\//i, '');
  if (!limpio.startsWith(`${BUCKET_LUGARES}/`)) return null;
  return limpio.slice(BUCKET_LUGARES.length + 1);
}

function toggleInputsHorario(aperturaInput, cierreInput, checked) {
  if (checked) {
    aperturaInput.value = '';
    cierreInput.value = '';
  }
  aperturaInput.disabled = checked;
  cierreInput.disabled = checked;
  aperturaInput.classList.toggle('bg-gray-100', checked);
  cierreInput.classList.toggle('bg-gray-100', checked);
}

async function eliminarImagenAnterior(path) {
  const relativo = obtenerRutaRelativa(path);
  if (!relativo) return;
  const { error } = await supabase.storage.from(BUCKET_LUGARES).remove([relativo]);
  if (error) {
    console.warn('No se pudo eliminar la imagen anterior:', error);
  }
}

async function cargarCategorias() {
  const { data, error } = await supabase
    .from('categoriaLugares')
    .select('id, nombre')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error cargando categoría de lugares:', error);
    mostrarMensaje('error', 'No fue posible cargar las categorías de lugares.', { persistente: true });
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function actualizarChipsCategorias() {
  const wrapper = document.getElementById('categoriasSeleccionadas');
  if (!wrapper) return;

  wrapper.innerHTML = '';

  categoriasSeleccionadas.forEach((id) => {
    const categoria = categoriasDisponibles.find((cat) => Number(cat.id) === Number(id));
    const nombre = categoria?.nombre || `ID ${id}`;

    const chip = document.createElement('span');
    chip.className = 'inline-flex items-center bg-blue-100 text-blue-600 rounded-full px-3 py-1 text-sm m-1';
    chip.innerHTML = `
      ${nombre}
      <button type="button" data-id="${id}" class="ml-2 text-blue-600 hover:text-blue-800 font-semibold">&times;</button>
    `;

    chip.querySelector('button').addEventListener('click', () => {
      categoriasSeleccionadas.delete(id);
      const checkbox = document.getElementById(`categoria-${id}`);
      if (checkbox) checkbox.checked = false;
      actualizarChipsCategorias();
    });

    wrapper.appendChild(chip);
  });
}

function renderCategorias() {
  if (!elementos.categoriasContainer) return;

  elementos.categoriasContainer.innerHTML = '';

  categoriasDisponibles.forEach((categoria) => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 text-sm text-gray-700';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = categoria.id;
    checkbox.id = `categoria-${categoria.id}`;
    checkbox.className = 'rounded text-blue-600 focus:ring-blue-500';
    if (categoriasSeleccionadas.has(Number(categoria.id))) {
      checkbox.checked = true;
    }

    checkbox.addEventListener('change', () => {
      const numericId = Number(checkbox.value);
      if (checkbox.checked) {
        categoriasSeleccionadas.add(numericId);
      } else {
        categoriasSeleccionadas.delete(numericId);
      }
      actualizarChipsCategorias();
    });

    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);
    label.className = 'cursor-pointer select-none';
    label.textContent = categoria.nombre;

    div.appendChild(checkbox);
    div.appendChild(label);
    elementos.categoriasContainer.appendChild(div);
  });

  actualizarChipsCategorias();
}

async function cargarRelacionesCategorias() {
  const { data, error } = await supabase
    .from('lugarCategoria')
    .select('idCategoria')
    .eq('idLugar', idLugar);

  if (error) {
    console.error('Error cargando categorías asignadas:', error);
    return;
  }

  categoriasSeleccionadas = new Set(
    (data || [])
      .map((rel) => Number(rel.idCategoria))
      .filter((id) => Number.isFinite(id))
  );
}

async function sincronizarCategorias() {
  const seleccionadas = Array.from(categoriasSeleccionadas);

  const { data: existentes, error: errorExistentes } = await supabase
    .from('lugarCategoria')
    .select('id, idCategoria')
    .eq('idLugar', idLugar);

  if (errorExistentes) {
    console.error('Error leyendo categorías existentes:', errorExistentes);
    throw errorExistentes;
  }

  const existentesSet = new Set(
    (existentes || [])
      .map((rel) => Number(rel.idCategoria))
      .filter((id) => Number.isFinite(id))
  );

  const porInsertar = seleccionadas
    .filter((id) => !existentesSet.has(id))
    .map((idCategoria) => ({ idLugar, idCategoria }));

  const porEliminar = (existentes || [])
    .filter((rel) => !seleccionadas.includes(Number(rel.idCategoria)));

  if (porEliminar.length) {
    const idsEliminar = porEliminar.map((rel) => rel.id);
    const { error } = await supabase
      .from('lugarCategoria')
      .delete()
      .in('id', idsEliminar);
    if (error) throw error;
  }

  if (porInsertar.length) {
    const { error } = await supabase
      .from('lugarCategoria')
      .insert(porInsertar);
    if (error) throw error;
  }
}

async function cargarHorarios() {
  const { data, error } = await supabase
    .from('horariosLugares')
    .select('diaSemana, apertura, cierre, cerrado')
    .eq('idLugar', idLugar);

  if (error) {
    console.error('Error cargando horarios:', error);
    mostrarMensaje('error', 'No fue posible cargar los horarios del lugar.', { persistente: true });
    return;
  }

  horariosLugares = new Map();
  (data || []).forEach((h) => {
    horariosLugares.set(Number(h.diaSemana), {
      apertura: h.apertura ? h.apertura.slice(0, 5) : '',
      cierre: h.cierre ? h.cierre.slice(0, 5) : '',
      cerrado: Boolean(h.cerrado),
    });
  });
}

function renderHorarios() {
  if (!elementos.horariosContainer) return;

  elementos.horariosContainer.innerHTML = '';

  DIAS.forEach(({ db, label }) => {
    const registro = horariosLugares.get(db) || { apertura: '', cierre: '', cerrado: false };

    const row = document.createElement('div');
    row.className = 'flex items-center gap-4 bg-white rounded p-3 shadow';
    row.dataset.dia = String(db);

    row.innerHTML = `
      <label class="w-24 font-semibold text-gray-700">${label}</label>
      <input type="time" id="apertura-${db}" class="border rounded p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value="${registro.apertura || ''}">
      <input type="time" id="cierre-${db}" class="border rounded p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value="${registro.cierre || ''}">
      <label class="ml-4 flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" id="cerrado-${db}" class="rounded text-blue-600 focus:ring-blue-500" ${registro.cerrado ? 'checked' : ''}>
        Cerrado
      </label>
    `;

    const checkbox = row.querySelector(`#cerrado-${db}`);
    const aperturaInput = row.querySelector(`#apertura-${db}`);
    const cierreInput = row.querySelector(`#cierre-${db}`);

    toggleInputsHorario(aperturaInput, cierreInput, registro.cerrado);
    checkbox.addEventListener('change', () =>
      toggleInputsHorario(aperturaInput, cierreInput, checkbox.checked)
    );

    elementos.horariosContainer.appendChild(row);
  });
}

function obtenerHorariosDelFormulario() {
  if (!elementos.horariosContainer) return [];

  const filas = Array.from(elementos.horariosContainer.querySelectorAll('[data-dia]'));

  return filas.map((fila) => {
    const dia = Number(fila.dataset.dia);
    const aperturaInput = document.getElementById(`apertura-${dia}`);
    const cierreInput = document.getElementById(`cierre-${dia}`);
    const checkbox = document.getElementById(`cerrado-${dia}`);

    const cerrado = checkbox?.checked || false;
    const apertura = cerrado ? null : (aperturaInput?.value || null);
    const cierre = cerrado ? null : (cierreInput?.value || null);

    return {
      idLugar,
      diaSemana: dia,
      apertura,
      cierre,
      cerrado,
    };
  });
}

function asignarValoresIniciales(lugar) {
  imagenActualPath = lugar.imagen || '';
  if (elementos.previewImagen) {
    elementos.previewImagen.src = obtenerUrlImagen(imagenActualPath);
  }

  if (elementos.nombre) elementos.nombre.value = lugar.nombre || '';
  if (elementos.municipio) elementos.municipio.value = lugar.municipio || '';
  if (elementos.direccion) elementos.direccion.value = lugar.direccion || '';
  if (elementos.descripcion) elementos.descripcion.value = lugar.descripcion || '';
  if (elementos.latitud) elementos.latitud.value = lugar.latitud ?? '';
  if (elementos.longitud) elementos.longitud.value = lugar.longitud ?? '';
  if (elementos.precioEntrada) elementos.precioEntrada.value = lugar.precioEntrada ?? '';
  if (elementos.telefono) elementos.telefono.value = lugar.telefono ?? '';
  if (elementos.web) elementos.web.value = lugar.web ?? '';
  if (elementos.facebook) elementos.facebook.value = lugar.facebook ?? '';
  if (elementos.instagram) elementos.instagram.value = lugar.instagram ?? '';
  if (elementos.tiktok) elementos.tiktok.value = lugar.tiktok ?? '';

  if (elementos.gratis) elementos.gratis.checked = Boolean(lugar.gratis);
  if (elementos.activo) elementos.activo.checked = lugar.activo !== false;
  if (elementos.abiertoSiempre) elementos.abiertoSiempre.checked = Boolean(lugar.abiertoSiempre);
  if (elementos.cerradoTemporalmente) elementos.cerradoTemporalmente.checked = Boolean(lugar.cerradoTemporalmente);
}

function validarFormulario() {
  if (!elementos.nombre?.value.trim()) {
    mostrarMensaje('error', 'El nombre del lugar es obligatorio.', { persistente: false, duracion: 4000 });
    elementos.nombre?.focus();
    return false;
  }

  if (!elementos.descripcion?.value.trim()) {
    mostrarMensaje('error', 'La descripción es obligatoria.', { persistente: false, duracion: 4000 });
    elementos.descripcion?.focus();
    return false;
  }

  const latitud = elementos.latitud?.value.trim();
  if (latitud && Number.isNaN(Number(latitud))) {
    mostrarMensaje('error', 'La latitud debe ser un número válido.', { persistente: false, duracion: 4000 });
    elementos.latitud?.focus();
    return false;
  }

  const longitud = elementos.longitud?.value.trim();
  if (longitud && Number.isNaN(Number(longitud))) {
    mostrarMensaje('error', 'La longitud debe ser un número válido.', { persistente: false, duracion: 4000 });
    elementos.longitud?.focus();
    return false;
  }

  return true;
}

async function subirNuevaImagen() {
  if (!imagenNuevaFile) return null;

  const extension = imagenNuevaFile.name.split('.').pop()?.toLowerCase() || 'jpg';
  const nombreArchivo = `${CARPETA_IMAGENES}/${idLugar}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_LUGARES)
    .upload(nombreArchivo, imagenNuevaFile, { upsert: false });

  if (error) {
    console.error('Error subiendo imagen:', error);
    mostrarMensaje('error', 'No fue posible subir la nueva imagen.');
    return null;
  }

  const { data } = supabase.storage
    .from(BUCKET_LUGARES)
    .getPublicUrl(nombreArchivo);

  const publicUrl = data?.publicUrl || null;

  if (!publicUrl) {
    mostrarMensaje('error', 'No se pudo obtener la URL pública de la nueva imagen.');
    await supabase.storage.from(BUCKET_LUGARES).remove([nombreArchivo]);
    return null;
  }

  return {
    publicUrl,
    storagePath: nombreArchivo,
  };
}

async function guardarCambios(event) {
  event.preventDefault();
  ocultarMensaje();

  if (!validarFormulario()) return;

  const payload = {
    nombre: elementos.nombre?.value.trim() || null,
    municipio: elementos.municipio?.value.trim() || null,
    direccion: elementos.direccion?.value.trim() || null,
    descripcion: elementos.descripcion?.value.trim() || null,
    latitud: elementos.latitud?.value ? Number(elementos.latitud.value) : null,
    longitud: elementos.longitud?.value ? Number(elementos.longitud.value) : null,
    precioEntrada: elementos.precioEntrada?.value || null,
    telefono: elementos.telefono?.value.trim() || null,
    web: elementos.web?.value.trim() || null,
    facebook: elementos.facebook?.value.trim() || null,
    instagram: elementos.instagram?.value.trim() || null,
    tiktok: elementos.tiktok?.value.trim() || null,
    gratis: elementos.gratis?.checked || false,
    activo: elementos.activo?.checked ?? true,
    abiertoSiempre: elementos.abiertoSiempre?.checked || false,
    cerradoTemporalmente: elementos.cerradoTemporalmente?.checked || false,
  };

  if (elementos.btnGuardar) {
    elementos.btnGuardar.disabled = true;
    elementos.btnGuardar.classList.add('opacity-60', 'cursor-wait');
  }

  const imagenAnterior = imagenActualPath;
  let resultadoUpload = null;

  try {
    resultadoUpload = await subirNuevaImagen();
    if (resultadoUpload?.publicUrl) {
      payload.imagen = resultadoUpload.publicUrl;
    }

    const { error: errorLugar } = await supabase
      .from('LugaresTuristicos')
      .update(payload)
      .eq('id', idLugar);

    if (errorLugar) {
      console.error('Error actualizando lugar:', errorLugar);
      mostrarMensaje('error', 'No se pudieron guardar los cambios. Inténtalo nuevamente.', { persistente: true });
      if (resultadoUpload?.publicUrl) {
        elementos.previewImagen.src = obtenerUrlImagen(imagenAnterior);
      }
      if (resultadoUpload?.storagePath) {
        await supabase.storage.from(BUCKET_LUGARES).remove([resultadoUpload.storagePath]);
      }
      return;
    }

    try {
      await sincronizarCategorias();
    } catch (errCat) {
      console.error('Error sincronizando categorías:', errCat);
      mostrarMensaje('error', 'Hubo un problema actualizando las categorías.', { persistente: true });
      return;
    }

    try {
      const horarios = obtenerHorariosDelFormulario();
      for (const horario of horarios) {
        const { data: existente, error: errorExistente } = await supabase
          .from('horariosLugares')
          .select('id')
          .eq('idLugar', horario.idLugar)
          .eq('diaSemana', horario.diaSemana)
          .maybeSingle();

        if (errorExistente) throw errorExistente;

        if (existente?.id) {
          const { error: errorUpdate } = await supabase
            .from('horariosLugares')
            .update({
              apertura: horario.apertura,
              cierre: horario.cierre,
              cerrado: horario.cerrado,
            })
            .eq('id', existente.id);
          if (errorUpdate) throw errorUpdate;
        } else {
          const { error: errorInsert } = await supabase
            .from('horariosLugares')
            .insert([horario]);
          if (errorInsert) throw errorInsert;
        }
      }
    } catch (errHorario) {
      console.error('Error procesando horarios:', errHorario);
      mostrarMensaje('error', 'No se pudieron actualizar los horarios.', { persistente: true });
      return;
    }

    if (resultadoUpload?.publicUrl) {
      imagenActualPath = resultadoUpload.publicUrl;
      elementos.previewImagen.src = resultadoUpload.publicUrl;
      imagenNuevaFile = null;
      if (elementos.inputImagen) {
        elementos.inputImagen.value = '';
      }
      if (previewTemporalUrl) {
        URL.revokeObjectURL(previewTemporalUrl);
        previewTemporalUrl = null;
      }
      if (imagenAnterior && imagenAnterior !== resultadoUpload.publicUrl) {
        await eliminarImagenAnterior(imagenAnterior);
      }
    }

    mostrarMensaje('success', 'Cambios guardados correctamente ✅', { persistente: false, duracion: 1200 });
    setTimeout(() => {
      window.location.href = resolvePath('adminLugares.html');
    }, 1200);
  } finally {
    if (elementos.btnGuardar) {
      elementos.btnGuardar.disabled = false;
      elementos.btnGuardar.classList.remove('opacity-60', 'cursor-wait');
    }
  }
}

function inicializarEventos() {
  if (eventosInicializados) return;
  eventosInicializados = true;

  if (elementos.inputImagen) {
    elementos.inputImagen.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      imagenNuevaFile = file;
      if (previewTemporalUrl) {
        URL.revokeObjectURL(previewTemporalUrl);
      }
      previewTemporalUrl = URL.createObjectURL(file);
      elementos.previewImagen.src = previewTemporalUrl;
    });
  }

  elementos.form?.addEventListener('submit', guardarCambios);

  const cancelar = () => {
    window.location.href = resolvePath('adminLugares.html');
  };

  elementos.btnCancelar?.addEventListener('click', cancelar);
  elementos.btnCancelarSecundario?.addEventListener('click', cancelar);
}

async function cargarLugar() {
  const { data, error } = await supabase
    .from('LugaresTuristicos')
    .select(`
      id,
      nombre,
      municipio,
      descripcion,
      direccion,
      latitud,
      longitud,
      precioEntrada,
      telefono,
      web,
      facebook,
      instagram,
      tiktok,
      gratis,
      activo,
      abiertoSiempre,
      cerradoTemporalmente,
      imagen
    `)
    .eq('id', idLugar)
    .maybeSingle();

  if (error || !data) {
    console.error('Error cargando lugar:', error);
    mostrarMensaje('error', 'No fue posible cargar la información del lugar solicitado.', { persistente: true });
    deshabilitarFormulario();
    return null;
  }

  return data;
}

async function inicializarPagina() {
  inicializarEventos();

  if (!idLugar) {
    mostrarMensaje('error', 'No se indicó el lugar a editar.', { persistente: true });
    deshabilitarFormulario();
    return;
  }

  categoriasDisponibles = await cargarCategorias();
  await cargarRelacionesCategorias();
  renderCategorias();

  await cargarHorarios();
  renderHorarios();

  const lugar = await cargarLugar();
  if (!lugar) return;

  asignarValoresIniciales(lugar);
}

document.addEventListener('DOMContentLoaded', inicializarPagina);
