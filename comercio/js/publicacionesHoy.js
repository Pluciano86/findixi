import { supabase } from '../shared/supabaseClient.js';

const BUCKET_NAME = 'galeriacomercios';
const PUBLIC_BUCKET_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios';
const LODEHOY_LIKES_TABLE = 'lodehoy_likes_comercio';
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
]);
const MAX_FILE_SIZE_MB = 45;

const formPublicacion = document.getElementById('formPublicacion');
const inputArchivo = document.getElementById('inputArchivo');
const inputTexto = document.getElementById('inputTexto');
const contadorTexto = document.getElementById('contadorTexto');
const previewMedia = document.getElementById('previewMedia');
const btnPublicar = document.getElementById('btnPublicar');
const estadoGuardado = document.getElementById('estadoGuardado');
const estadoAcceso = document.getElementById('estadoAcceso');
const estadoLista = document.getElementById('estadoLista');
const estadoListaVacia = document.getElementById('estadoListaVacia');
const listaPublicacionesComercio = document.getElementById('listaPublicacionesComercio');
const btnRecargar = document.getElementById('btnRecargar');
const subtituloComercio = document.getElementById('subtituloComercio');

const params = new URLSearchParams(window.location.search);
const idComercio = Number(params.get('id') || 0);

let currentUser = null;
let selectedFileMeta = null;
let previewObjectUrl = null;
let publicacionesActivas = [];
let likesCountByComercio = new Map();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setEstadoAcceso(message, isError = false) {
  if (!estadoAcceso) return;
  estadoAcceso.textContent = message;
  estadoAcceso.classList.remove('hidden', 'text-red-600', 'text-emerald-700', 'text-gray-600');
  estadoAcceso.classList.add(isError ? 'text-red-600' : 'text-emerald-700');
}

function setEstadoGuardado(message, isError = false) {
  if (!estadoGuardado) return;
  estadoGuardado.textContent = message || '';
  estadoGuardado.classList.remove('text-red-600', 'text-gray-500', 'text-emerald-700');
  if (!message) return;
  estadoGuardado.classList.add(isError ? 'text-red-600' : 'text-emerald-700');
}

function setEstadoLista(message, isError = false) {
  if (!estadoLista) return;
  estadoLista.textContent = message;
  estadoLista.classList.remove('hidden', 'text-red-600', 'text-gray-500');
  estadoLista.classList.add(isError ? 'text-red-600' : 'text-gray-500');
}

function setListaVacia(visible) {
  estadoListaVacia?.classList.toggle('hidden', !visible);
}

function updateContadorTexto() {
  if (!contadorTexto || !inputTexto) return;
  contadorTexto.textContent = `${inputTexto.value.length} / 280`;
}

function clearPreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  selectedFileMeta = null;
  if (!previewMedia) return;
  previewMedia.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 text-xs px-3 text-center">Selecciona un archivo para ver la vista previa.</div>';
}

function buildStoragePublicUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;

  const clean = String(path)
    .trim()
    .replace(/^\/+/, '')
    .replace(/^public\//i, '')
    .replace(/^galeriacomercios\//i, '');

  const encoded = clean
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');

  return `${PUBLIC_BUCKET_BASE}/${encoded}`;
}

function normalizeFileExtension(file) {
  const extFromName = String(file.name || '')
    .split('.')
    .pop()
    .toLowerCase();

  if (extFromName) return extFromName.replace(/[^a-z0-9]/g, '');

  if (file.type === 'video/mp4') return 'mp4';
  if (file.type === 'video/quicktime') return 'mov';
  if (file.type === 'video/x-m4v') return 'm4v';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'image/png') return 'png';
  return 'jpg';
}

function randomSuffix() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getMediaDimensions(file) {
  const isVideo = String(file.type || '').startsWith('video/');

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);

    if (!isVideo) {
      const img = new Image();
      img.onload = () => {
        const width = Number(img.naturalWidth || 0);
        const height = Number(img.naturalHeight || 0);
        URL.revokeObjectURL(objectUrl);
        if (!width || !height) {
          reject(new Error('No se pudo leer el tamaño de la imagen.'));
          return;
        }
        resolve({ width, height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('La imagen no es válida.'));
      };
      img.src = objectUrl;
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const width = Number(video.videoWidth || 0);
      const height = Number(video.videoHeight || 0);
      URL.revokeObjectURL(objectUrl);
      video.remove();
      if (!width || !height) {
        reject(new Error('No se pudo leer el tamaño del video.'));
        return;
      }
      resolve({ width, height });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
      reject(new Error('El video no es válido.'));
    };
    video.src = objectUrl;
  });
}

async function validateAndPrepareFile(file) {
  if (!file) {
    throw new Error('Selecciona un archivo para publicar.');
  }

  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('Formato no permitido. Usa JPG, PNG, GIF, MP4 o MOV.');
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_SIZE_MB) {
    throw new Error(`El archivo supera ${MAX_FILE_SIZE_MB}MB.`);
  }

  const dims = await getMediaDimensions(file);

  return {
    mime: file.type,
    media_tipo: String(file.type || '').startsWith('video/') ? 'video' : 'image',
    width: dims.width,
    height: dims.height,
  };
}

function renderPreview(file, meta) {
  if (!previewMedia) return;
  clearPreview();

  previewObjectUrl = URL.createObjectURL(file);
  selectedFileMeta = meta;

  if (meta.media_tipo === 'video') {
    previewMedia.innerHTML = `
      <video src="${previewObjectUrl}" class="publicacion-media-content" controls playsinline muted preload="metadata"></video>
    `;
    return;
  }

  previewMedia.innerHTML = `
    <img src="${previewObjectUrl}" alt="Vista previa" class="publicacion-media-content" />
  `;
}

async function validateAccessOrRedirect() {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    window.location.href = './index.html';
    return false;
  }

  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  currentUser = userResp?.user || null;
  if (userErr || !currentUser) {
    window.location.href = './login.html';
    return false;
  }

  const relResp = await supabase
    .from('UsuarioComercios')
    .select('idComercio')
    .eq('idUsuario', currentUser.id)
    .eq('idComercio', idComercio)
    .limit(1);

  let hasAccess = Array.isArray(relResp.data) && relResp.data.length > 0;

  if (!hasAccess) {
    const ownerResp = await supabase
      .from('Comercios')
      .select('id')
      .eq('id', idComercio)
      .eq('owner_user_id', currentUser.id)
      .maybeSingle();

    hasAccess = !ownerResp.error && !!ownerResp.data;
  }

  if (!hasAccess) {
    alert('No tienes acceso a este comercio.');
    window.location.href = './index.html';
    return false;
  }

  const comercioResp = await supabase
    .from('Comercios')
    .select('id,nombre')
    .eq('id', idComercio)
    .maybeSingle();

  if (comercioResp.data?.nombre && subtituloComercio) {
    subtituloComercio.textContent = `Gestiona las publicaciones de ${comercioResp.data.nombre} para Lo de Hoy.`;
  }

  setEstadoAcceso('Acceso validado para este comercio.');
  return true;
}

function renderListaPublicaciones() {
  if (!listaPublicacionesComercio) return;

  if (!publicacionesActivas.length) {
    listaPublicacionesComercio.innerHTML = '';
    setListaVacia(true);
    return;
  }

  setListaVacia(false);
  const likeCount = Number(likesCountByComercio.get(idComercio) || 0);

  listaPublicacionesComercio.innerHTML = publicacionesActivas.map((row) => {
    const text = String(row.texto || '').trim();
    const safeText = escapeHtml(text);
    const mediaUrl = buildStoragePublicUrl(row.media_path);
    const safeMediaUrl = escapeHtml(mediaUrl);
    const fecha = new Intl.DateTimeFormat('es-PR', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Puerto_Rico',
    }).format(new Date(row.created_at));
    const safeFecha = escapeHtml(fecha);

    const mediaHtml = row.media_tipo === 'video'
      ? `<video class="publicacion-media-content" src="${safeMediaUrl}" controls playsinline preload="metadata"></video>`
      : `<img class="publicacion-media-content" src="${safeMediaUrl}" alt="Publicación" loading="lazy">`;

    return `
      <article class="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div class="publicacion-media-frame bg-gray-100 flex items-center justify-center overflow-hidden">${mediaHtml}</div>
        <div class="p-3 space-y-2">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs text-gray-500">${safeFecha}</p>
            <span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-700">
              <i class="fa-solid fa-heart text-[11px]"></i>
              ${likeCount} Me Gusta
            </span>
          </div>
          <p class="text-sm text-gray-800 ${text ? '' : 'italic text-gray-500'}" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
            ${safeText || 'Sin texto en esta publicación.'}
          </p>
          <div class="flex items-center justify-end">
            <button type="button" data-action="delete" data-id="${row.id}" class="px-3 py-1.5 rounded-lg text-sm bg-red-50 border border-red-100 text-red-700 hover:bg-red-100">
              <i class="fa-solid fa-trash mr-1"></i>
              Eliminar
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

async function loadLikesCount() {
  const { count, error } = await supabase
    .from(LODEHOY_LIKES_TABLE)
    .select('idcomercio', { count: 'exact', head: true })
    .eq('idcomercio', idComercio);

  if (error) {
    if (error.code !== '42P01') {
      console.warn('No se pudo cargar el conteo de Me Gusta:', error.message || error);
    }
    likesCountByComercio.set(idComercio, 0);
    return;
  }

  likesCountByComercio.set(idComercio, toNumber(count) || 0);
}

async function loadPublicacionesActivas() {
  setEstadoLista('Cargando publicaciones...');

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('publicaciones_hoy')
    .select('id,texto,media_path,media_tipo,created_at,expira_en')
    .eq('idcomercio', idComercio)
    .gt('expira_en', nowIso)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error cargando publicaciones del comercio:', error);
    const msg = String(error.message || '').toLowerCase().includes('publicaciones_hoy')
      ? 'Falta aplicar la migración de Lo de Hoy en Supabase.'
      : 'No se pudieron cargar las publicaciones.';
    setEstadoLista(msg, true);
    setListaVacia(false);
    listaPublicacionesComercio.innerHTML = '';
    return;
  }

  publicacionesActivas = data || [];
  await loadLikesCount();
  estadoLista?.classList.add('hidden');
  renderListaPublicaciones();
}

async function deletePublicacion(postId) {
  const id = Number(postId);
  if (!Number.isFinite(id) || id <= 0) return;

  const row = publicacionesActivas.find((item) => Number(item.id) === id);
  if (!row) return;

  const ok = confirm('¿Eliminar esta publicación?');
  if (!ok) return;

  setEstadoGuardado('Eliminando publicación...');

  const { error: deleteError } = await supabase
    .from('publicaciones_hoy')
    .delete()
    .eq('id', id)
    .eq('idcomercio', idComercio);

  if (deleteError) {
    console.error('Error eliminando publicación:', deleteError);
    setEstadoGuardado('No se pudo eliminar la publicación.', true);
    return;
  }

  if (row.media_path) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([String(row.media_path)]);

    if (storageError) {
      console.warn('La publicación se eliminó, pero el archivo no pudo borrarse del bucket:', storageError);
    }
  }

  setEstadoGuardado('Publicación eliminada.');
  await loadPublicacionesActivas();
}

async function handleSubmit(event) {
  event.preventDefault();

  const file = inputArchivo?.files?.[0];
  const text = String(inputTexto?.value || '').trim();

  try {
    const meta = selectedFileMeta || await validateAndPrepareFile(file);

    btnPublicar.disabled = true;
    btnPublicar.classList.add('opacity-60', 'cursor-not-allowed');
    setEstadoGuardado('Subiendo publicación...');

    const ext = normalizeFileExtension(file);
    const storagePath = `publicaciones-hoy/${idComercio}/${Date.now()}-${randomSuffix()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: meta.mime,
      });

    if (uploadError) {
      throw new Error(uploadError.message || 'No se pudo subir el archivo al bucket.');
    }

    const payload = {
      idcomercio: idComercio,
      texto: text,
      media_path: storagePath,
      media_tipo: meta.media_tipo,
      media_mime: meta.mime,
      media_ancho: meta.width,
      media_alto: meta.height,
    };

    const { error: insertError } = await supabase
      .from('publicaciones_hoy')
      .insert(payload);

    if (insertError) {
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      throw new Error(insertError.message || 'No se pudo guardar la publicación.');
    }

    setEstadoGuardado('Publicación creada correctamente.');

    formPublicacion.reset();
    clearPreview();
    updateContadorTexto();
    await loadPublicacionesActivas();
  } catch (error) {
    console.error('Error creando publicación:', error);
    setEstadoGuardado(error.message || 'No se pudo crear la publicación.', true);
  } finally {
    btnPublicar.disabled = false;
    btnPublicar.classList.remove('opacity-60', 'cursor-not-allowed');
  }
}

function bindEvents() {
  inputTexto?.addEventListener('input', updateContadorTexto);

  inputArchivo?.addEventListener('change', async () => {
    const file = inputArchivo.files?.[0];
    if (!file) {
      clearPreview();
      return;
    }

    try {
      setEstadoGuardado('Validando archivo...');
      const meta = await validateAndPrepareFile(file);
      renderPreview(file, meta);
      setEstadoGuardado('Archivo listo para publicar.');
    } catch (error) {
      inputArchivo.value = '';
      clearPreview();
      setEstadoGuardado(error.message || 'Archivo no válido.', true);
    }
  });

  formPublicacion?.addEventListener('submit', handleSubmit);

  btnRecargar?.addEventListener('click', () => {
    void loadPublicacionesActivas();
  });

  listaPublicacionesComercio?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action="delete"]');
    if (!btn) return;
    void deletePublicacion(btn.getAttribute('data-id'));
  });
}

async function init() {
  bindEvents();
  updateContadorTexto();

  const hasAccess = await validateAccessOrRedirect();
  if (!hasAccess) return;

  await loadPublicacionesActivas();
}

void init();
