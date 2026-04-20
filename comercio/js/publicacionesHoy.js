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
const MAX_CLIP_SECONDS = 12;
const MIN_CLIP_SECONDS = 0.5;
const TRIM_RECORDING_TIMESLICE_MS = 200;

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
const videoClipEditor = document.getElementById('videoClipEditor');
const clipStartRange = document.getElementById('clipStartRange');
const clipDurationRange = document.getElementById('clipDurationRange');
const clipStartValue = document.getElementById('clipStartValue');
const clipDurationValue = document.getElementById('clipDurationValue');
const clipResumen = document.getElementById('clipResumen');

const params = new URLSearchParams(window.location.search);
const idComercio = Number(params.get('id') || 0);

let currentUser = null;
let selectedFileMeta = null;
let previewObjectUrl = null;
let publicacionesActivas = [];
let likesCountByComercio = new Map();
let selectedClip = {
  enabled: false,
  startSec: 0,
  durationSec: MAX_CLIP_SECONDS,
  endSec: MAX_CLIP_SECONDS,
  sourceDurationSec: 0,
};

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatSeconds(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0.0s';
  return `${num.toFixed(1)}s`;
}

function isVideoMeta(meta) {
  return String(meta?.media_tipo || '') === 'video';
}

function normalizeMimeType(mime) {
  return String(mime || '').toLowerCase().trim();
}

function getExtensionFromMime(mime, fallback = 'mp4') {
  const clean = normalizeMimeType(mime);
  if (clean === 'video/mp4') return 'mp4';
  if (clean === 'video/quicktime') return 'mov';
  if (clean === 'video/x-m4v') return 'm4v';
  if (clean === 'video/webm') return 'webm';
  return fallback;
}

function getTrimOutputMime(preferredMime = '') {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  const preferred = normalizeMimeType(preferredMime);
  const candidates = [
    preferred,
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
  ].filter(Boolean);

  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime) && ALLOWED_MIME.has(mime)) || '';
}

function canPhysicallyTrimVideo() {
  return typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && (
      typeof HTMLMediaElement !== 'undefined'
      && (typeof HTMLMediaElement.prototype.captureStream === 'function'
        || typeof HTMLMediaElement.prototype.mozCaptureStream === 'function')
    );
}

function getClipWindow() {
  const start = Number(selectedClip.startSec || 0);
  const duration = Number(selectedClip.durationSec || 0);
  const sourceDuration = Number(selectedClip.sourceDurationSec || 0);
  const minDuration = sourceDuration > 0 ? Math.min(MIN_CLIP_SECONDS, sourceDuration) : MIN_CLIP_SECONDS;
  const safeStart = Number.isFinite(start) ? Math.max(0, start) : 0;
  const safeDuration = Number.isFinite(duration) ? Math.max(minDuration, duration) : minDuration;
  const maxEnd = Number.isFinite(sourceDuration) && sourceDuration > 0 ? sourceDuration : safeStart + safeDuration;
  const end = Math.min(maxEnd, safeStart + safeDuration);
  return { start, end, duration: Math.max(0, end - safeStart), sourceDuration };
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

function resetClipEditor() {
  selectedClip = {
    enabled: false,
    startSec: 0,
    durationSec: MAX_CLIP_SECONDS,
    endSec: MAX_CLIP_SECONDS,
    sourceDurationSec: 0,
  };
  videoClipEditor?.classList.add('hidden');
}

function updateClipEditorUI() {
  if (!selectedClip.enabled) {
    videoClipEditor?.classList.add('hidden');
    return;
  }

  const sourceDuration = Math.max(0, Number(selectedClip.sourceDurationSec || 0));
  if (!sourceDuration) {
    videoClipEditor?.classList.add('hidden');
    return;
  }

  videoClipEditor?.classList.remove('hidden');

  const minDuration = Math.min(MIN_CLIP_SECONDS, sourceDuration);
  const maxDuration = clamp(sourceDuration, minDuration, MAX_CLIP_SECONDS);
  let durationSec = clamp(Number(selectedClip.durationSec || maxDuration), minDuration, maxDuration);
  const maxStart = Math.max(0, sourceDuration - durationSec);
  let startSec = clamp(Number(selectedClip.startSec || 0), 0, maxStart);
  const endSec = Math.min(sourceDuration, startSec + durationSec);

  selectedClip.startSec = startSec;
  selectedClip.durationSec = durationSec;
  selectedClip.endSec = endSec;

  if (clipStartRange) {
    clipStartRange.min = '0';
    clipStartRange.max = String(maxStart);
    clipStartRange.step = '0.1';
    clipStartRange.value = String(startSec);
  }

  if (clipDurationRange) {
    clipDurationRange.min = String(minDuration);
    clipDurationRange.max = String(maxDuration);
    clipDurationRange.step = '0.1';
    clipDurationRange.value = String(durationSec);
  }

  if (clipStartValue) clipStartValue.textContent = formatSeconds(startSec);
  if (clipDurationValue) clipDurationValue.textContent = formatSeconds(durationSec);
  if (clipResumen) {
    clipResumen.textContent = `Fragmento: ${formatSeconds(startSec)} a ${formatSeconds(endSec)} (duración ${formatSeconds(endSec - startSec)}).`;
  }
}

function syncPreviewVideoClipWindow() {
  const previewVideo = previewMedia?.querySelector('video');
  if (!(previewVideo instanceof HTMLVideoElement)) return;

  const { start, end } = getClipWindow();
  previewVideo.dataset.clipStart = String(start);
  previewVideo.dataset.clipEnd = String(end);

  if (!previewVideo.dataset.clipBound) {
    previewVideo.dataset.clipBound = '1';
    previewVideo.addEventListener('timeupdate', () => {
      const clipStart = Number(previewVideo.dataset.clipStart || 0);
      const clipEnd = Number(previewVideo.dataset.clipEnd || 0);
      if (!Number.isFinite(clipEnd) || clipEnd <= clipStart) return;
      if (previewVideo.currentTime >= clipEnd - 0.04) {
        previewVideo.currentTime = clipStart;
        if (!previewVideo.paused) {
          void previewVideo.play().catch(() => {});
        }
      }
    });
  }

  if (previewVideo.currentTime < start || previewVideo.currentTime > end) {
    previewVideo.currentTime = start;
  }
}

function setupClipEditorForVideo(videoDuration) {
  const safeDuration = Number(videoDuration || 0);
  if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
    resetClipEditor();
    return;
  }

  selectedClip.enabled = true;
  selectedClip.sourceDurationSec = safeDuration;
  selectedClip.durationSec = Math.min(MAX_CLIP_SECONDS, safeDuration);
  selectedClip.startSec = 0;
  selectedClip.endSec = selectedClip.durationSec;

  updateClipEditorUI();
}

function clearPreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  selectedFileMeta = null;
  resetClipEditor();
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

function getMediaMetadata(file) {
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
        resolve({ width, height, durationSec: null, hasAudio: null });
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
      const durationSec = Number(video.duration || 0);
      let hasAudio = null;
      if (typeof video.mozHasAudio === 'boolean') {
        hasAudio = video.mozHasAudio;
      } else if (video.audioTracks && typeof video.audioTracks.length === 'number') {
        hasAudio = video.audioTracks.length > 0;
      }
      URL.revokeObjectURL(objectUrl);
      video.remove();
      if (!width || !height || !Number.isFinite(durationSec) || durationSec <= 0) {
        reject(new Error('No se pudo leer el tamaño del video.'));
        return;
      }
      resolve({ width, height, durationSec, hasAudio });
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

  const meta = await getMediaMetadata(file);

  return {
    mime: file.type,
    media_tipo: String(file.type || '').startsWith('video/') ? 'video' : 'image',
    width: meta.width,
    height: meta.height,
    durationSec: Number.isFinite(meta.durationSec) ? meta.durationSec : null,
    hasAudio: typeof meta.hasAudio === 'boolean' ? meta.hasAudio : null,
  };
}

function renderPreview(file, meta) {
  if (!previewMedia) return;
  clearPreview();

  previewObjectUrl = URL.createObjectURL(file);
  selectedFileMeta = meta;

  if (meta.media_tipo === 'video') {
    setupClipEditorForVideo(meta.durationSec);
    previewMedia.innerHTML = `
      <video src="${previewObjectUrl}" class="publicacion-media-content" controls playsinline muted preload="metadata"></video>
    `;
    syncPreviewVideoClipWindow();
    return;
  }

  resetClipEditor();
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

function getClipPayload(meta) {
  if (!isVideoMeta(meta)) {
    return { clip_start_sec: null, clip_end_sec: null, media_has_audio: null };
  }

  const sourceDuration = Number(meta?.durationSec || selectedClip.sourceDurationSec || 0);
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
    return {
      clip_start_sec: 0,
      clip_end_sec: null,
      media_has_audio: typeof meta?.hasAudio === 'boolean' ? meta.hasAudio : null,
    };
  }

  const { start, end } = getClipWindow();
  const minDuration = Math.min(MIN_CLIP_SECONDS, sourceDuration);
  const safeStart = clamp(start, 0, Math.max(0, sourceDuration - minDuration));
  const safeEnd = clamp(end, safeStart + minDuration, sourceDuration);

  return {
    clip_start_sec: Number(safeStart.toFixed(3)),
    clip_end_sec: Number(safeEnd.toFixed(3)),
    media_has_audio: typeof meta?.hasAudio === 'boolean' ? meta.hasAudio : null,
  };
}

function waitForEvent(target, eventName, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(`Timeout esperando ${eventName}.`));
    }, timeoutMs);

    const onOk = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };
    const onErr = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(`Error esperando ${eventName}.`));
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(eventName, onOk);
      target.removeEventListener('error', onErr);
    };

    target.addEventListener(eventName, onOk, { once: true });
    target.addEventListener('error', onErr, { once: true });
  });
}

async function trimVideoFilePhysically(file, meta) {
  if (!isVideoMeta(meta) || !selectedClip.enabled) {
    return { file, meta, clippedPhysically: false, message: '' };
  }

  const sourceDuration = Number(meta.durationSec || selectedClip.sourceDurationSec || 0);
  const { start, end, duration } = getClipWindow();
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0 || duration <= 0) {
    return { file, meta, clippedPhysically: false, message: '' };
  }

  // Si el clip cubre todo el video, evitamos trabajo extra.
  if (start <= 0.05 && end >= sourceDuration - 0.05) {
    return { file, meta, clippedPhysically: false, message: '' };
  }

  if (!canPhysicallyTrimVideo()) {
    return {
      file,
      meta,
      clippedPhysically: false,
      message: 'El dispositivo no soporta recorte físico; se aplicará recorte al reproducir.',
    };
  }

  const outputMime = getTrimOutputMime(meta.mime || file.type);
  if (!outputMime) {
    return {
      file,
      meta,
      clippedPhysically: false,
      message: 'No hay formato compatible para recorte físico en este navegador; se aplicará recorte al reproducir.',
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = false;
  video.defaultMuted = false;
  video.volume = 0;
  video.src = objectUrl;

  let stream = null;
  let recorder = null;
  let stopTimer = null;

  try {
    await waitForEvent(video, 'loadedmetadata', 18000);

    const capture = video.captureStream?.bind(video) || video.mozCaptureStream?.bind(video);
    if (!capture) {
      return {
        file,
        meta,
        clippedPhysically: false,
        message: 'captureStream no está disponible; se aplicará recorte al reproducir.',
      };
    }

    stream = capture();
    if (!stream) {
      return {
        file,
        meta,
        clippedPhysically: false,
        message: 'No se pudo abrir el stream de recorte; se aplicará recorte al reproducir.',
      };
    }

    const chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: outputMime });
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const stopPromise = new Promise((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
    });

    const safeStart = clamp(start, 0, Math.max(0, sourceDuration - MIN_CLIP_SECONDS));
    const safeEnd = clamp(end, safeStart + Math.min(MIN_CLIP_SECONDS, sourceDuration), sourceDuration);

    video.currentTime = safeStart;
    await waitForEvent(video, 'seeked', 12000).catch(() => {});

    const finalizeStop = () => {
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      video.pause();
    };

    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= safeEnd - 0.03) {
        finalizeStop();
      }
    });
    video.addEventListener('ended', finalizeStop, { once: true });

    recorder.start(TRIM_RECORDING_TIMESLICE_MS);
    try {
      await video.play();
    } catch (_playErr) {
      video.muted = true;
      video.defaultMuted = true;
      await video.play();
    }

    stopTimer = window.setTimeout(() => {
      finalizeStop();
    }, Math.ceil((safeEnd - safeStart + 0.4) * 1000));

    await stopPromise;

    const blobType = normalizeMimeType(outputMime) || normalizeMimeType(chunks[0]?.type) || normalizeMimeType(file.type);
    const clippedBlob = new Blob(chunks, { type: blobType || file.type });
    if (!clippedBlob.size) {
      return {
        file,
        meta,
        clippedPhysically: false,
        message: 'No se pudo generar el clip físico; se aplicará recorte al reproducir.',
      };
    }

    const baseName = String(file.name || 'video')
      .replace(/\.[^.]+$/, '')
      .replace(/\s+/g, '_');
    const ext = getExtensionFromMime(blobType || file.type, normalizeFileExtension(file));
    const clippedFile = new File([clippedBlob], `${baseName}-clip.${ext}`, {
      type: blobType || file.type,
      lastModified: Date.now(),
    });

    const clippedMeta = await validateAndPrepareFile(clippedFile);

    return {
      file: clippedFile,
      meta: clippedMeta,
      clippedPhysically: true,
      message: 'Video recortado y comprimido. Subiendo publicación...',
    };
  } catch (error) {
    console.warn('Recorte físico no disponible, usando recorte lógico:', error?.message || error);
    return {
      file,
      meta,
      clippedPhysically: false,
      message: 'No se pudo recortar físicamente; se aplicará recorte al reproducir.',
    };
  } finally {
    if (stopTimer) window.clearTimeout(stopTimer);
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } catch (_error) {}
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    URL.revokeObjectURL(objectUrl);
    video.remove();
  }
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
  let data = null;
  let error = null;

  const withClip = await supabase
    .from('publicaciones_hoy')
    .select('id,texto,media_path,media_tipo,created_at,expira_en,clip_start_sec,clip_end_sec')
    .eq('idcomercio', idComercio)
    .gt('expira_en', nowIso)
    .order('created_at', { ascending: false });

  if (!withClip.error) {
    data = withClip.data;
  } else {
    const maybeMissingCol = String(withClip.error.message || '').toLowerCase();
    if (maybeMissingCol.includes('clip_start_sec') || maybeMissingCol.includes('clip_end_sec')) {
      const fallback = await supabase
        .from('publicaciones_hoy')
        .select('id,texto,media_path,media_tipo,created_at,expira_en')
        .eq('idcomercio', idComercio)
        .gt('expira_en', nowIso)
        .order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    } else {
      error = withClip.error;
    }
  }

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
    const baseMeta = selectedFileMeta || await validateAndPrepareFile(file);

    btnPublicar.disabled = true;
    btnPublicar.classList.add('opacity-60', 'cursor-not-allowed');
    setEstadoGuardado('Preparando publicación...');

    const trimResult = await trimVideoFilePhysically(file, baseMeta);
    if (trimResult.message) {
      setEstadoGuardado(trimResult.message);
    } else {
      setEstadoGuardado('Subiendo publicación...');
    }

    const fileToUpload = trimResult.file;
    const meta = trimResult.meta;
    const clipPayload = trimResult.clippedPhysically
      ? { clip_start_sec: null, clip_end_sec: null, media_has_audio: typeof meta?.hasAudio === 'boolean' ? meta.hasAudio : null }
      : getClipPayload(meta);

    const ext = normalizeFileExtension(fileToUpload);
    const storagePath = `publicaciones-hoy/${idComercio}/${Date.now()}-${randomSuffix()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: meta.mime || fileToUpload.type,
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
      ...clipPayload,
    };

    let insertError = null;
    {
      const withClip = await supabase
        .from('publicaciones_hoy')
        .insert(payload);

      if (!withClip.error) {
        insertError = null;
      } else {
        const msg = String(withClip.error.message || '').toLowerCase();
        if (msg.includes('clip_start_sec') || msg.includes('clip_end_sec') || msg.includes('media_has_audio')) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.clip_start_sec;
          delete fallbackPayload.clip_end_sec;
          delete fallbackPayload.media_has_audio;
          const fallback = await supabase
            .from('publicaciones_hoy')
            .insert(fallbackPayload);
          insertError = fallback.error;
        } else {
          insertError = withClip.error;
        }
      }
    }

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

  clipStartRange?.addEventListener('input', () => {
    if (!selectedClip.enabled) return;
    selectedClip.startSec = Number(clipStartRange.value || 0);
    updateClipEditorUI();
    syncPreviewVideoClipWindow();
  });

  clipDurationRange?.addEventListener('input', () => {
    if (!selectedClip.enabled) return;
    selectedClip.durationSec = Number(clipDurationRange.value || MAX_CLIP_SECONDS);
    updateClipEditorUI();
    syncPreviewVideoClipWindow();
  });

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
  resetClipEditor();

  const hasAccess = await validateAccessOrRedirect();
  if (!hasAccess) return;

  await loadPublicacionesActivas();
}

void init();
