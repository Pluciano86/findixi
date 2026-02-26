import { supabase } from '../shared/supabaseClient.js';
import { resolvePath } from '../shared/pathResolver.js';
import { getPublicBase } from '../shared/utils.js';

const params = new URLSearchParams(window.location.search);
const idPlaya = params.get('id');

const elementos = {
  form: document.getElementById('formPlaya'),
  btnGuardar: document.getElementById('btnGuardar'),
  btnCancelar: document.getElementById('btnCancelar'),
  btnCancelarSecundario: document.getElementById('btnCancelarSecundario'),
  mensaje: document.getElementById('mensajeSistema'),
  previewImagen: document.getElementById('previewImagen'),
  inputImagen: document.getElementById('inputImagen'),
  nombre: document.getElementById('nombre'),
  municipio: document.getElementById('municipio'),
  costa: document.getElementById('costa'),
  direccion: document.getElementById('direccion'),
  latitud: document.getElementById('latitud'),
  longitud: document.getElementById('longitud'),
  descripcion: document.getElementById('descripcion'),
  acceso: document.getElementById('acceso'),
  nadar: document.getElementById('nadar'),
  surfear: document.getElementById('surfear'),
  snorkeling: document.getElementById('snorkeling'),
  bote: document.getElementById('bote'),
  activo: document.getElementById('activo'),
};

const PLACEHOLDER_IMAGEN = resolvePath('./img/default-playa.jpg');
const BUCKET_PLAYAS = 'galeriaplayas';
const CARPETA_IMAGENES = 'imagenes';
const PUBLIC_STORAGE_PREFIX = `${getPublicBase('')}/`;

let municipiosDisponibles = [];
let imagenNuevaFile = null;
let imagenActualPath = '';
let eventosInicializados = false;
let previewTemporalUrl = null;

function mostrarError(mensaje) {
  mostrarMensaje('error', mensaje, { persistente: true });
}

function ocultarMensaje() {
  if (!elementos.mensaje) return;
  elementos.mensaje.classList.add('hidden');
  elementos.mensaje.textContent = '';
}

function mostrarMensaje(tipo, mensaje, opciones = {}) {
  const { persistente = tipo === 'error', duracion = 5000 } = opciones;
  if (!elementos.mensaje) {
    if (tipo === 'error') {
      console.error(mensaje);
    } else {
      console.info(mensaje);
    }
    return;
  }

  const clasesBase = 'max-w-4xl mx-auto mb-4 px-4 py-3 rounded border text-sm';
  let clasesColor = '';
  switch (tipo) {
    case 'success':
      clasesColor = 'bg-emerald-50 border-emerald-400 text-emerald-700';
      break;
    case 'info':
      clasesColor = 'bg-sky-50 border-sky-400 text-sky-700';
      break;
    case 'error':
    default:
      clasesColor = 'bg-red-50 border-red-400 text-red-700';
      break;
  }

  elementos.mensaje.className = `${clasesBase} ${clasesColor}`;
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

function formatoCosta(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'boolean') return valor ? 'Costa' : 'Interior';
  if (typeof valor === 'number') return valor ? 'Costa' : 'Interior';
  return String(valor);
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

  if (!limpio.startsWith(`${BUCKET_PLAYAS}/`)) {
    return null;
  }

  return limpio.slice(BUCKET_PLAYAS.length + 1);
}

async function eliminarImagenAnterior(path) {
  const relativo = obtenerRutaRelativa(path);
  if (!relativo) return;

  const { error } = await supabase.storage
    .from(BUCKET_PLAYAS)
    .remove([relativo]);

  if (error) {
    console.warn('No se pudo eliminar la imagen anterior:', error);
  }
}

function obtenerMunicipioPorId(id) {
  return municipiosDisponibles.find((mun) => String(mun.id) === String(id));
}

function resolverDatosMunicipioSeleccionado() {
  const idSeleccionado = elementos.municipio?.value || '';

  if (!idSeleccionado) {
    return { idMunicipio: null, municipioNombre: null, costaValor: null };
  }

  const municipio = obtenerMunicipioPorId(idSeleccionado);
  if (!municipio) {
    return { idMunicipio: null, municipioNombre: null, costaValor: null };
  }

  // Obtener texto de costa (ej. 'Costa Norte', 'Interior', etc.)
  const costaFormateada = formatoCosta(municipio.costa);

  // Guardar internamente el valor por si se necesita al guardar
  elementos.costaValor = municipio.costa;

  // Devuelve los valores necesarios para actualizar la playa
  return {
    idMunicipio: municipio.id,
    municipioNombre: municipio.nombre,
    costaValor: municipio.costa,
    costaTexto: costaFormateada,
  };
}

async function cargarMunicipios() {
  const { data, error } = await supabase
    .from('Municipios')
    .select('id, nombre, costa')
    .eq('costa', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error cargando municipios:', error);
    mostrarError('No fue posible cargar los municipios costeros.');
    deshabilitarFormulario();
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function cargarPlaya() {
  const { data, error } = await supabase
    .from('playas')
    .select('id, nombre, municipio, idMunicipio, costa, direccion, descripcion, acceso, latitud, longitud, imagen, nadar, surfear, snorkeling, bote, activo')
    .eq('id', idPlaya)
    .maybeSingle();

  if (error || !data) {
    console.error('Error cargando playa:', error);
    mostrarError('No fue posible cargar la información de la playa.');
    deshabilitarFormulario();
    return null;
  }

  return data;
}

function asignarValoresIniciales(playa) {
  imagenActualPath = playa.imagen || '';
  elementos.previewImagen.src = obtenerUrlImagen(imagenActualPath);

  elementos.nombre.value = playa.nombre || '';
  elementos.direccion.value = playa.direccion || '';
  elementos.descripcion.value = playa.descripcion || '';
  elementos.acceso.value = playa.acceso || '';
  elementos.latitud.value = playa.latitud ?? '';
  elementos.longitud.value = playa.longitud ?? '';
  elementos.nadar.checked = Boolean(playa.nadar);
  elementos.surfear.checked = Boolean(playa.surfear);
  elementos.snorkeling.checked = Boolean(playa.snorkeling);
  elementos.bote.checked = Boolean(playa.bote);
  elementos.activo.checked = playa.activo !== false;

  if (playa.idMunicipio) {
    elementos.municipio.value = String(playa.idMunicipio);
  } else if (playa.municipio) {
    const municipioEncontrado = municipiosDisponibles.find((m) => m.nombre === playa.municipio);
    if (municipioEncontrado) {
      elementos.municipio.value = String(municipioEncontrado.id);
    }
  }

  if (elementos.municipio.value) {
    resolverDatosMunicipioSeleccionado();
  } else {
    elementos.costa.value = formatoCosta(playa.costa);
  }
}

function validarFormulario() {
  const nombre = elementos.nombre.value.trim();
  if (!nombre) {
    mostrarMensaje('error', 'El nombre de la playa es obligatorio.', { persistente: false, duracion: 4000 });
    elementos.nombre.focus();
    return false;
  }

  if (!elementos.municipio.value) {
    mostrarMensaje('error', 'Selecciona un municipio costero.', { persistente: false, duracion: 4000 });
    elementos.municipio.focus();
    return false;
  }

  const descripcion = elementos.descripcion.value.trim();
  if (!descripcion) {
    mostrarMensaje('error', 'La descripción es obligatoria.', { persistente: false, duracion: 4000 });
    elementos.descripcion.focus();
    return false;
  }

  const latitud = elementos.latitud.value.trim();
  if (latitud && Number.isNaN(Number(latitud))) {
    mostrarMensaje('error', 'La latitud debe ser un número válido.', { persistente: false, duracion: 4000 });
    elementos.latitud.focus();
    return false;
  }

  const longitud = elementos.longitud.value.trim();
  if (longitud && Number.isNaN(Number(longitud))) {
    mostrarMensaje('error', 'La longitud debe ser un número válido.', { persistente: false, duracion: 4000 });
    elementos.longitud.focus();
    return false;
  }

  return true;
}

async function subirNuevaImagen() {
  if (!imagenNuevaFile) return null;

  const extension = imagenNuevaFile.name.split('.').pop()?.toLowerCase() || 'jpg';
  const nombreArchivo = `${CARPETA_IMAGENES}/${idPlaya}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_PLAYAS)
    .upload(nombreArchivo, imagenNuevaFile, { upsert: false });

  if (error) {
    console.error('Error subiendo imagen:', error);
    mostrarMensaje('error', 'No fue posible subir la nueva imagen.');
    return null;
  }

  const { data } = supabase.storage
    .from(BUCKET_PLAYAS)
    .getPublicUrl(nombreArchivo);

  const publicUrl = data?.publicUrl || null;

  if (!publicUrl) {
    mostrarMensaje('error', 'No se pudo obtener la URL pública de la nueva imagen.');
    await supabase.storage.from(BUCKET_PLAYAS).remove([nombreArchivo]);
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

  const { idMunicipio, municipioNombre, costaValor } = resolverDatosMunicipioSeleccionado();

  // === 🔹 Normalizar la costa antes de guardar ===
  let costaNormalizada = (
  typeof costaValor === 'string'
    ? costaValor
    : (costaValor ? 'Sur' : '')
).toLowerCase();

  if (costaNormalizada.includes('sur')) costaNormalizada = 'Sur';
  else if (costaNormalizada.includes('norte')) costaNormalizada = 'Norte';
  else if (costaNormalizada.includes('oeste')) costaNormalizada = 'Oeste';
  else if (costaNormalizada.includes('este')) costaNormalizada = 'Este';
  else if (costaNormalizada.includes('metro')) costaNormalizada = 'Metro';
  else if (costaNormalizada.includes('centro')) costaNormalizada = 'Centro';
  else if (costaNormalizada.includes('isla')) costaNormalizada = 'Islas Municipio';
  else costaNormalizada = 'Centro'; // Valor por defecto seguro

  // === 🔹 Construir payload como antes ===
  const payload = {
    nombre: elementos.nombre.value.trim(),
    descripcion: elementos.descripcion.value.trim(),
    direccion: elementos.direccion.value.trim(),
    acceso: elementos.acceso.value.trim(),
    latitud: elementos.latitud.value ? Number(elementos.latitud.value) : null,
    longitud: elementos.longitud.value ? Number(elementos.longitud.value) : null,
    nadar: elementos.nadar.checked,
    surfear: elementos.surfear.checked,
    snorkeling: elementos.snorkeling.checked,
    bote: elementos.bote.checked,
    activo: elementos.activo.checked,
    idMunicipio: idMunicipio ?? null,
    municipio: municipioNombre ?? null,
    costa: costaNormalizada, // 👈 corregido aquí
  };

  elementos.btnGuardar.disabled = true;
  elementos.btnGuardar.classList.add('opacity-60', 'cursor-wait');

  const imagenAnterior = imagenActualPath;
  let resultadoUpload = null;

  try {
    resultadoUpload = await subirNuevaImagen();
    if (resultadoUpload?.publicUrl) {
      payload.imagen = resultadoUpload.publicUrl;
    }

    const { error } = await supabase
      .from('playas')
      .update(payload)
      .eq('id', idPlaya);

    if (error) {
      console.error('Error actualizando playa:', error);
      mostrarMensaje('error', 'No se pudieron guardar los cambios. Inténtalo nuevamente.', { persistente: true });
      if (previewTemporalUrl) {
        URL.revokeObjectURL(previewTemporalUrl);
        previewTemporalUrl = null;
      }
      if (resultadoUpload?.publicUrl) {
        elementos.previewImagen.src = obtenerUrlImagen(imagenAnterior);
      }
      if (resultadoUpload?.storagePath) {
        await supabase.storage.from(BUCKET_PLAYAS).remove([resultadoUpload.storagePath]);
      }
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

    mostrarMensaje('success', 'Los cambios se guardaron correctamente.', { persistente: false, duracion: 1200 });

    setTimeout(() => {
      window.location.href = resolvePath('adminPlayas.html');
    }, 1200);
  } finally {
    elementos.btnGuardar.disabled = false;
    elementos.btnGuardar.classList.remove('opacity-60', 'cursor-wait');
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

  if (elementos.municipio) {
    elementos.municipio.addEventListener('change', resolverDatosMunicipioSeleccionado);
  }

  elementos.form?.addEventListener('submit', guardarCambios);

  const cancelar = () => {
    window.location.href = resolvePath('adminPlayas.html');
  };

  elementos.btnCancelar?.addEventListener('click', cancelar);
  elementos.btnCancelarSecundario?.addEventListener('click', cancelar);
}

async function inicializarPagina() {
  inicializarEventos();

  if (!idPlaya) {
    mostrarMensaje('error', 'No se indicó la playa a editar.', { persistente: true });
    deshabilitarFormulario();
    return;
  }

  municipiosDisponibles = await cargarMunicipios();

  if (elementos.municipio && municipiosDisponibles.length) {
    municipiosDisponibles.forEach((mun) => {
      const option = document.createElement('option');
      option.value = mun.id;
      option.textContent = mun.nombre;
      elementos.municipio.appendChild(option);
    });
  }

  const playa = await cargarPlaya();
  if (!playa) {
    deshabilitarFormulario();
    return;
  }

  asignarValoresIniciales(playa);
}

document.addEventListener('DOMContentLoaded', inicializarPagina);
