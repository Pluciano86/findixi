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
const MAX_FILE_SIZE_MB = 50;
const MAX_CLIP_SECONDS = 30;
const MIN_CLIP_SECONDS = 1;
const TRIM_RECORDING_TIMESLICE_MS = 200;
const TARGET_AUDIO_BITRATE = 96000;
const MIN_VIDEO_BITRATE = 320000;
const USER_AGENT = String(window.navigator?.userAgent || '').toLowerCase();
const IS_IOS_DEVICE = /iphone|ipad|ipod/.test(USER_AGENT)
  || (String(window.navigator?.platform || '').toLowerCase() === 'macintel' && Number(window.navigator?.maxTouchPoints || 0) > 1);

const formPublicacion = document.getElementById('formPublicacion');
const inputArchivo = document.getElementById('inputArchivo');
const inputTitulo = document.getElementById('inputTitulo');
const contadorTitulo = document.getElementById('contadorTitulo');
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
const clipTimeline = document.getElementById('clipTimeline');
const clipTimelineWindow = document.getElementById('clipTimelineWindow');
const clipHandleStart = document.getElementById('clipHandleStart');
const clipHandleEnd = document.getElementById('clipHandleEnd');
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
let editingPostId = null;
let clipDragState = null;
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

function getFileSizeMb(file) {
  return Number(file?.size || 0) / (1024 * 1024);
}

function getClipDurations(sourceDuration) {
  const safeSourceDuration = Math.max(0, Number(sourceDuration || 0));
  const minDuration = safeSourceDuration > 0
    ? Math.min(MIN_CLIP_SECONDS, safeSourceDuration)
    : MIN_CLIP_SECONDS;
  const maxDuration = safeSourceDuration > 0
    ? clamp(safeSourceDuration, minDuration, MAX_CLIP_SECONDS)
    : MAX_CLIP_SECONDS;
  return { minDuration, maxDuration };
}

function getTimelineClientXToSec(clientX) {
  if (!clipTimeline) return 0;
  const rect = clipTimeline.getBoundingClientRect();
  const width = Number(rect.width || 0);
  if (!width) return 0;
  const ratio = clamp((clientX - rect.left) / width, 0, 1);
  const sourceDuration = Math.max(0, Number(selectedClip.sourceDurationSec || 0));
  return ratio * sourceDuration;
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
  if (IS_IOS_DEVICE) return false;
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
  const { minDuration } = getClipDurations(sourceDuration);
  const safeStart = Number.isFinite(start) ? Math.max(0, start) : 0;
  const safeDuration = Number.isFinite(duration) ? Math.max(minDuration, duration) : minDuration;
  const maxEnd = Number.isFinite(sourceDuration) && sourceDuration > 0 ? sourceDuration : safeStart + safeDuration;
  const end = Math.min(maxEnd, safeStart + safeDuration);
  return { start: safeStart, end, duration: Math.max(0, end - safeStart), sourceDuration };
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

function updateContadorTitulo() {
  if (!contadorTitulo || !inputTitulo) return;
  contadorTitulo.textContent = `${inputTitulo.value.length} / 50`;
}

function clearClipDragState() {
  clipDragState = null;
  clipTimelineWindow?.classList.remove('cursor-grabbing');
  clipTimelineWindow?.classList.add('cursor-grab');
}

function updateClipWindow(startSec, durationSec) {
  const sourceDuration = Math.max(0, Number(selectedClip.sourceDurationSec || 0));
  const { minDuration, maxDuration } = getClipDurations(sourceDuration);
  const safeDuration = clamp(Number(durationSec || 0), minDuration, maxDuration);
  const maxStart = Math.max(0, sourceDuration - safeDuration);
  const safeStart = clamp(Number(startSec || 0), 0, maxStart);

  selectedClip.startSec = safeStart;
  selectedClip.durationSec = safeDuration;
  selectedClip.endSec = Math.min(sourceDuration, safeStart + safeDuration);
}

function updateClipEditorUI() {
  const sourceDuration = Math.max(0, Number(selectedClip.sourceDurationSec || 0));
  if (!selectedClip.enabled || !sourceDuration) {
    videoClipEditor?.classList.add('hidden');
    clearClipDragState();
    return;
  }

  videoClipEditor?.classList.remove('hidden');

  updateClipWindow(selectedClip.startSec, selectedClip.durationSec);
  const { startSec, durationSec, endSec } = selectedClip;

  if (clipStartValue) clipStartValue.textContent = formatSeconds(startSec);
  if (clipDurationValue) clipDurationValue.textContent = formatSeconds(durationSec);
  if (clipResumen) {
    clipResumen.textContent = `Fragmento: ${formatSeconds(startSec)} a ${formatSeconds(endSec)} (duración ${formatSeconds(endSec - startSec)}).`;
  }

  const startPct = clamp((startSec / sourceDuration) * 100, 0, 100);
  const endPct = clamp((endSec / sourceDuration) * 100, 0, 100);
  const widthPct = Math.max(0, endPct - startPct);

  if (clipTimelineWindow) {
    clipTimelineWindow.style.left = `${startPct}%`;
    clipTimelineWindow.style.width = `${widthPct}%`;
  }
  if (clipHandleStart) {
    clipHandleStart.style.left = `${startPct}%`;
  }
  if (clipHandleEnd) {
    clipHandleEnd.style.left = `${endPct}%`;
  }
}

function syncClipFromPointer(event) {
  if (!clipDragState) return;

  const sourceDuration = Math.max(0, Number(selectedClip.sourceDurationSec || 0));
  if (!sourceDuration) return;
  const { minDuration } = getClipDurations(sourceDuration);
  const pointerSec = getTimelineClientXToSec(event.clientX);

  if (clipDragState.mode === 'move') {
    const duration = Number(clipDragState.durationSec || selectedClip.durationSec || MAX_CLIP_SECONDS);
    const maxStart = Math.max(0, sourceDuration - duration);
    const nextStart = clamp(pointerSec - clipDragState.offsetSec, 0, maxStart);
    updateClipWindow(nextStart, duration);
    return;
  }

  if (clipDragState.mode === 'start') {
    const endFixed = Number(clipDragState.endSec || selectedClip.endSec || 0);
    const minStart = Math.max(0, endFixed - MAX_CLIP_SECONDS);
    const maxStart = Math.max(0, endFixed - minDuration);
    const nextStart = clamp(pointerSec, minStart, maxStart);
    updateClipWindow(nextStart, endFixed - nextStart);
    return;
  }

  if (clipDragState.mode === 'end') {
    const startFixed = Number(clipDragState.startSec || selectedClip.startSec || 0);
    const minEnd = startFixed + minDuration;
    const maxEnd = Math.min(sourceDuration, startFixed + MAX_CLIP_SECONDS);
    const nextEnd = clamp(pointerSec, minEnd, maxEnd);
    updateClipWindow(startFixed, nextEnd - startFixed);
  }
}

function handleClipPointerMove(event) {
  if (!clipDragState || event.pointerId !== clipDragState.pointerId) return;
  event.preventDefault();
  syncClipFromPointer(event);
  updateClipEditorUI();
  syncPreviewVideoClipWindow();
}

function handleClipPointerUp(event) {
  if (!clipDragState || event.pointerId !== clipDragState.pointerId) return;
  event.preventDefault();
  clearClipDragState();
  window.removeEventListener('pointermove', handleClipPointerMove);
  window.removeEventListener('pointerup', handleClipPointerUp);
  window.removeEventListener('pointercancel', handleClipPointerUp);
  syncPreviewVideoClipWindow();
}

function startClipDrag(mode, event) {
  if (!selectedClip.enabled) return;
  const sourceDuration = Math.max(0, Number(selectedClip.sourceDurationSec || 0));
  if (!sourceDuration) return;

  const pointerSec = getTimelineClientXToSec(event.clientX);
  const durationSec = Number(selectedClip.durationSec || MAX_CLIP_SECONDS);
  clipDragState = {
    mode,
    pointerId: event.pointerId,
    startSec: Number(selectedClip.startSec || 0),
    endSec: Number(selectedClip.endSec || 0),
    durationSec,
    offsetSec: clamp(pointerSec - Number(selectedClip.startSec || 0), 0, durationSec),
  };

  clipTimelineWindow?.classList.remove('cursor-grab');
  clipTimelineWindow?.classList.add('cursor-grabbing');
  window.addEventListener('pointermove', handleClipPointerMove, { passive: false });
  window.addEventListener('pointerup', handleClipPointerUp, { passive: false });
  window.addEventListener('pointercancel', handleClipPointerUp, { passive: false });
}

function handleClipTimelinePointerDown(event) {
  if (!selectedClip.enabled) return;
  if (event.button !== 0) return;
  event.preventDefault();

  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('[data-handle="start"]')) {
    startClipDrag('start', event);
    return;
  }
  if (target?.closest('[data-handle="end"]')) {
    startClipDrag('end', event);
    return;
  }
  if (target?.closest('#clipTimelineWindow')) {
    startClipDrag('move', event);
    return;
  }

  const sourceDuration = Math.max(0, Number(selectedClip.sourceDurationSec || 0));
  const durationSec = Number(selectedClip.durationSec || MAX_CLIP_SECONDS);
  const pointerSec = getTimelineClientXToSec(event.clientX);
  const nextStart = clamp(pointerSec - (durationSec / 2), 0, Math.max(0, sourceDuration - durationSec));
  updateClipWindow(nextStart, durationSec);
  updateClipEditorUI();
  syncPreviewVideoClipWindow();
  startClipDrag('move', event);
}

function resetClipEditor() {
  clearClipDragState();
  window.removeEventListener('pointermove', handleClipPointerMove);
  window.removeEventListener('pointerup', handleClipPointerUp);
  window.removeEventListener('pointercancel', handleClipPointerUp);
  selectedClip = {
    enabled: false,
    startSec: 0,
    durationSec: MAX_CLIP_SECONDS,
    endSec: MAX_CLIP_SECONDS,
    sourceDurationSec: 0,
  };
  videoClipEditor?.classList.add('hidden');
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

  selectedClip.enabled = safeDuration > MAX_CLIP_SECONDS;
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
        hasAudio = video.mozHasAudio ? true : null;
      } else if (video.audioTracks && typeof video.audioTracks.length === 'number') {
        hasAudio = video.audioTracks.length > 0 ? true : null;
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

async function validateAndPrepareFile(file, { ignoreSizeLimitForVideo = false } = {}) {
  if (!file) {
    throw new Error('Selecciona un archivo para publicar.');
  }

  const mime = normalizeMimeType(file.type);
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('Formato no permitido. Usa JPG, PNG, GIF, MP4 o MOV.');
  }

  const isVideo = mime.startsWith('video/');
  const sizeMb = getFileSizeMb(file);
  if (sizeMb > MAX_FILE_SIZE_MB && !(isVideo && ignoreSizeLimitForVideo)) {
    throw new Error(`El archivo supera ${MAX_FILE_SIZE_MB}MB.`);
  }

  const meta = await getMediaMetadata(file);

  return {
    mime,
    media_tipo: isVideo ? 'video' : 'image',
    width: meta.width,
    height: meta.height,
    durationSec: Number.isFinite(meta.durationSec) ? meta.durationSec : null,
    hasAudio: typeof meta.hasAudio === 'boolean' ? meta.hasAudio : null,
    sourceSizeMb: sizeMb,
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
      media_has_audio: meta?.hasAudio === true ? true : null,
    };
  }

  const { start, end } = getClipWindow();
  const minDuration = Math.min(MIN_CLIP_SECONDS, sourceDuration);
  const safeStart = clamp(start, 0, Math.max(0, sourceDuration - minDuration));
  const safeEnd = clamp(end, safeStart + minDuration, sourceDuration);

  return {
    clip_start_sec: Number(safeStart.toFixed(3)),
    clip_end_sec: Number(safeEnd.toFixed(3)),
    media_has_audio: meta?.hasAudio === true ? true : null,
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
  if (!isVideoMeta(meta)) {
    return { file, meta, clippedPhysically: false, message: '' };
  }

  const sourceDuration = Number(meta.durationSec || selectedClip.sourceDurationSec || 0);
  const isLongVideo = Number.isFinite(sourceDuration) && sourceDuration > MAX_CLIP_SECONDS;
  const needsCompression = getFileSizeMb(file) > MAX_FILE_SIZE_MB;
  const requiresPhysicalProcessing = isLongVideo || needsCompression;

  if (!requiresPhysicalProcessing) {
    return { file, meta, clippedPhysically: false, message: '' };
  }

  if (!canPhysicallyTrimVideo()) {
    throw new Error(
      `Este dispositivo no soporta recorte/compresión automática. Publica un video de ${MAX_CLIP_SECONDS}s o menos y ${MAX_FILE_SIZE_MB}MB o menos.`
    );
  }

  const outputMime = getTrimOutputMime(meta.mime || file.type);
  if (!outputMime) {
    throw new Error('Este navegador no soporta el formato necesario para recortar/comprimir automáticamente.');
  }

  const clipWindow = isLongVideo
    ? getClipWindow()
    : {
      start: 0,
      end: Number(sourceDuration || 0),
      duration: Number(sourceDuration || 0),
      sourceDuration: Number(sourceDuration || 0),
    };

  const hasClipWindow = Number.isFinite(clipWindow.duration) && clipWindow.duration > 0;
  if (isLongVideo && !hasClipWindow) {
    throw new Error('No se pudo calcular el recorte del video.');
  }

  let workingFile = file;
  let workingMeta = meta;
  let processedPhysically = false;

  if (isLongVideo) {
    const clipped = await transcodeVideoSegment(workingFile, workingMeta, {
      startSec: clipWindow.start,
      endSec: clipWindow.end,
      outputMime,
      scale: 1,
    });
    workingFile = clipped.file;
    workingMeta = clipped.meta;
    processedPhysically = true;
  }

  if (getFileSizeMb(workingFile) <= MAX_FILE_SIZE_MB) {
    return {
      file: workingFile,
      meta: workingMeta,
      clippedPhysically: processedPhysically,
      message: processedPhysically ? 'Video recortado. Verificando tamaño final...' : '',
    };
  }

  const compressionProfiles = buildCompressionProfiles(Number(workingMeta.durationSec || sourceDuration || MAX_CLIP_SECONDS));
  for (const profile of compressionProfiles) {
    const compressed = await transcodeVideoSegment(workingFile, workingMeta, {
      startSec: 0,
      endSec: Number(workingMeta.durationSec || sourceDuration || MAX_CLIP_SECONDS),
      outputMime,
      scale: profile.scale,
      videoBitsPerSecond: profile.videoBitsPerSecond,
      audioBitsPerSecond: profile.audioBitsPerSecond,
    });
    workingFile = compressed.file;
    workingMeta = compressed.meta;
    processedPhysically = true;

    if (getFileSizeMb(workingFile) <= MAX_FILE_SIZE_MB) {
      return {
        file: workingFile,
        meta: workingMeta,
        clippedPhysically: processedPhysically,
        message: 'Video recortado y comprimido. Subiendo publicación...',
      };
    }
  }

  const finalSize = getFileSizeMb(workingFile).toFixed(1);
  throw new Error(`No se pudo reducir el video a ${MAX_FILE_SIZE_MB}MB (quedó en ${finalSize}MB). Usa un clip más corto o menor calidad.`);
}

function roundToEven(value, min = 2) {
  const numeric = Math.max(min, Math.floor(Number(value) || 0));
  return numeric % 2 === 0 ? numeric : numeric - 1;
}

function buildCompressionProfiles(durationSec) {
  const safeDuration = Math.max(1, Number(durationSec || MAX_CLIP_SECONDS));
  const targetTotalBitsPerSecond = Math.max(
    TARGET_AUDIO_BITRATE + MIN_VIDEO_BITRATE,
    Math.floor((MAX_FILE_SIZE_MB * 1024 * 1024 * 8 * 0.9) / safeDuration)
  );
  const baseVideoBitsPerSecond = Math.max(MIN_VIDEO_BITRATE, targetTotalBitsPerSecond - TARGET_AUDIO_BITRATE);

  const profileSeed = [
    { scale: 1, mult: 1.2 },
    { scale: 1, mult: 1.0 },
    { scale: 0.9, mult: 0.85 },
    { scale: 0.8, mult: 0.72 },
    { scale: 0.7, mult: 0.62 },
    { scale: 0.6, mult: 0.52 },
    { scale: 0.5, mult: 0.42 },
    { scale: 0.4, mult: 0.35 },
  ];

  return profileSeed.map((seed) => ({
    scale: seed.scale,
    videoBitsPerSecond: Math.max(MIN_VIDEO_BITRATE, Math.floor(baseVideoBitsPerSecond * seed.mult)),
    audioBitsPerSecond: TARGET_AUDIO_BITRATE,
  }));
}

async function transcodeVideoSegment(file, meta, {
  startSec = 0,
  endSec = Number(meta?.durationSec || 0),
  outputMime = '',
  scale = 1,
  videoBitsPerSecond,
  audioBitsPerSecond,
} = {}) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = false;
  video.defaultMuted = false;
  video.volume = 0;
  video.src = objectUrl;

  let sourceStream = null;
  let stream = null;
  let recorder = null;
  let stopTimer = null;
  let rafId = 0;
  let drawing = false;
  let canvas = null;

  try {
    await waitForEvent(video, 'loadedmetadata', 18000);

    const durationSec = Number(video.duration || meta?.durationSec || 0);
    const minDuration = Math.min(MIN_CLIP_SECONDS, durationSec || MIN_CLIP_SECONDS);
    const safeStart = clamp(Number(startSec || 0), 0, Math.max(0, durationSec - minDuration));
    const safeEnd = clamp(Number(endSec || durationSec), safeStart + minDuration, durationSec);
    const capture = video.captureStream?.bind(video) || video.mozCaptureStream?.bind(video);
    if (!capture) {
      throw new Error('captureStream no está disponible.');
    }

    sourceStream = capture();
    if (!sourceStream) {
      throw new Error('No se pudo abrir el stream de video.');
    }

    const videoWidth = Number(video.videoWidth || 0);
    const videoHeight = Number(video.videoHeight || 0);
    const safeScale = clamp(Number(scale || 1), 0.2, 1);
    const useCanvas = safeScale < 0.999;

    if (useCanvas) {
      if (typeof HTMLCanvasElement === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
        throw new Error('Canvas capture no disponible para reducir resolución.');
      }

      const targetWidth = roundToEven(videoWidth * safeScale, 2);
      const targetHeight = roundToEven(videoHeight * safeScale, 2);
      canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        throw new Error('No se pudo iniciar el canvas para compresión.');
      }

      stream = canvas.captureStream(30);
      sourceStream.getAudioTracks().forEach((track) => stream.addTrack(track));

      const drawFrame = () => {
        if (!drawing) return;
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        rafId = window.requestAnimationFrame(drawFrame);
      };

      const startDrawing = () => {
        if (drawing) return;
        drawing = true;
        drawFrame();
      };
      const stopDrawing = () => {
        drawing = false;
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      };

      video.addEventListener('play', startDrawing);
      video.addEventListener('pause', stopDrawing);
      video.addEventListener('ended', stopDrawing);
    } else {
      stream = sourceStream;
    }

    const chunks = [];
    const recorderOptions = { mimeType: outputMime };
    if (Number.isFinite(videoBitsPerSecond) && videoBitsPerSecond > 0) {
      recorderOptions.videoBitsPerSecond = Math.floor(videoBitsPerSecond);
    }
    if (Number.isFinite(audioBitsPerSecond) && audioBitsPerSecond > 0) {
      recorderOptions.audioBitsPerSecond = Math.floor(audioBitsPerSecond);
    }

    recorder = new MediaRecorder(stream, recorderOptions);
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };

    const stopPromise = new Promise((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
    });

    video.currentTime = safeStart;
    await waitForEvent(video, 'seeked', 12000).catch(() => {});

    const finalizeStop = () => {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      video.pause();
    };

    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= safeEnd - 0.03) finalizeStop();
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
    }, Math.ceil((safeEnd - safeStart + 0.8) * 1000));

    await stopPromise;

    const blobType = normalizeMimeType(outputMime) || normalizeMimeType(chunks[0]?.type) || normalizeMimeType(file.type);
    const outputBlob = new Blob(chunks, { type: blobType || file.type });
    if (!outputBlob.size) {
      throw new Error('El recorte generado está vacío.');
    }

    const baseName = String(file.name || 'video')
      .replace(/\.[^.]+$/, '')
      .replace(/\s+/g, '_');
    const ext = getExtensionFromMime(blobType || file.type, normalizeFileExtension(file));
    const outputFile = new File([outputBlob], `${baseName}-processed.${ext}`, {
      type: blobType || file.type,
      lastModified: Date.now(),
    });

    const outputMeta = await validateAndPrepareFile(outputFile, { ignoreSizeLimitForVideo: true });
    return { file: outputFile, meta: outputMeta };
  } finally {
    if (stopTimer) window.clearTimeout(stopTimer);
    try {
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    } catch (_error) {}
    if (stream) {
      stream.getTracks().forEach((track) => {
        try { track.stop(); } catch (_error) {}
      });
    }
    if (sourceStream && sourceStream !== stream) {
      sourceStream.getTracks().forEach((track) => {
        try { track.stop(); } catch (_error) {}
      });
    }
    if (rafId) {
      window.cancelAnimationFrame(rafId);
    }
    URL.revokeObjectURL(objectUrl);
    video.remove();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
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
    const rowId = toNumber(row.id);
    const isEditing = rowId && editingPostId === rowId;
    const titulo = String(row.titulo || '').trim();
    const safeTitulo = escapeHtml(titulo);
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
          ${isEditing ? `
            <div class="space-y-2" data-role="edit-form" data-id="${row.id}">
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Título</label>
                <input
                  type="text"
                  maxlength="50"
                  value="${safeTitulo}"
                  data-role="edit-titulo"
                  class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                >
                <p class="text-[11px] text-gray-500 mt-1" data-role="edit-titulo-count">${titulo.length} / 50</p>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Texto</label>
                <textarea
                  rows="3"
                  maxlength="280"
                  data-role="edit-texto"
                  class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm resize-y"
                >${safeText}</textarea>
                <p class="text-[11px] text-gray-500 mt-1" data-role="edit-texto-count">${text.length} / 280</p>
              </div>
            </div>
            <div class="flex items-center justify-end gap-2 pt-1">
              <button type="button" data-action="cancel-edit" data-id="${row.id}" class="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-700 hover:bg-gray-100">
                Cancelar
              </button>
              <button type="button" data-action="save-edit" data-id="${row.id}" class="px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700">
                Guardar
              </button>
            </div>
          ` : `
            ${safeTitulo ? `
              <p class="text-[15px] font-semibold text-gray-900 text-center" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                ${safeTitulo}
              </p>
            ` : ''}
            <p class="text-sm text-gray-800 ${text ? '' : 'italic text-gray-500'}" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
              ${safeText || 'Sin texto en esta publicación.'}
            </p>
            <div class="flex items-center justify-end gap-2">
              <button type="button" data-action="start-edit" data-id="${row.id}" class="px-3 py-1.5 rounded-lg text-sm border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100">
                <i class="fa-solid fa-pen mr-1"></i>
                Editar
              </button>
              <button type="button" data-action="delete" data-id="${row.id}" class="px-3 py-1.5 rounded-lg text-sm bg-red-50 border border-red-100 text-red-700 hover:bg-red-100">
                <i class="fa-solid fa-trash mr-1"></i>
                Eliminar
              </button>
            </div>
          `}
        </div>
      </article>
    `;
  }).join('');
}

async function loadLikesCount() {
  const createdAtValues = (publicacionesActivas || [])
    .map((row) => String(row?.created_at || '').trim())
    .filter(Boolean);
  const sinceIso = createdAtValues.length
    ? createdAtValues.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
    : null;

  let query = supabase
    .from(LODEHOY_LIKES_TABLE)
    .select('idusuario,created_at')
    .eq('idcomercio', idComercio);

  if (sinceIso) {
    query = query.gte('created_at', sinceIso);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code !== '42P01') {
      console.warn('No se pudo cargar el conteo de Me Gusta:', error.message || error);
    }
    likesCountByComercio.set(idComercio, 0);
    return;
  }

  const uniqueUsers = new Set(
    (data || [])
      .map((row) => String(row?.idusuario || '').trim())
      .filter(Boolean)
  );
  likesCountByComercio.set(idComercio, uniqueUsers.size);
}

async function loadPublicacionesActivas() {
  setEstadoLista('Cargando publicaciones...');
  editingPostId = null;

  const nowIso = new Date().toISOString();
  let data = null;
  let error = null;
  const attempts = [
    'id,titulo,texto,media_path,media_tipo,created_at,expira_en,clip_start_sec,clip_end_sec',
    'id,titulo,texto,media_path,media_tipo,created_at,expira_en',
    'id,texto,media_path,media_tipo,created_at,expira_en',
  ];

  for (const selectColumns of attempts) {
    const response = await supabase
      .from('publicaciones_hoy')
      .select(selectColumns)
      .eq('idcomercio', idComercio)
      .gt('expira_en', nowIso)
      .order('created_at', { ascending: false });

    if (!response.error) {
      data = response.data;
      error = null;
      break;
    }

    error = response.error;
    const msg = String(response.error.message || '').toLowerCase();
    if (
      !msg.includes('clip_start_sec')
      && !msg.includes('clip_end_sec')
      && !msg.includes('titulo')
    ) {
      break;
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

function startEditPublicacion(postId) {
  const id = toNumber(postId);
  if (!id) return;
  editingPostId = id;
  renderListaPublicaciones();
}

function cancelEditPublicacion() {
  editingPostId = null;
  renderListaPublicaciones();
}

function findEditContainer(postId) {
  const id = toNumber(postId);
  if (!id || !listaPublicacionesComercio) return null;
  return listaPublicacionesComercio.querySelector(`[data-role="edit-form"][data-id="${id}"]`);
}

function updateInlineEditCounters(container) {
  if (!container) return;
  const tituloInput = container.querySelector('[data-role="edit-titulo"]');
  const textoInput = container.querySelector('[data-role="edit-texto"]');
  const tituloCount = container.querySelector('[data-role="edit-titulo-count"]');
  const textoCount = container.querySelector('[data-role="edit-texto-count"]');
  if (tituloInput && tituloCount) {
    tituloCount.textContent = `${String(tituloInput.value || '').length} / 50`;
  }
  if (textoInput && textoCount) {
    textoCount.textContent = `${String(textoInput.value || '').length} / 280`;
  }
}

async function saveEditPublicacion(postId) {
  const id = toNumber(postId);
  if (!id) return;

  const container = findEditContainer(id);
  if (!container) return;

  const tituloInput = container.querySelector('[data-role="edit-titulo"]');
  const textoInput = container.querySelector('[data-role="edit-texto"]');
  const titulo = String(tituloInput?.value || '').trim().slice(0, 50);
  const texto = String(textoInput?.value || '').trim().slice(0, 280);

  setEstadoGuardado('Guardando cambios...');

  const attempts = [
    { titulo, texto },
    { texto },
  ];
  let updateError = null;

  for (const updatePayload of attempts) {
    const response = await supabase
      .from('publicaciones_hoy')
      .update(updatePayload)
      .eq('id', id)
      .eq('idcomercio', idComercio);

    if (!response.error) {
      updateError = null;
      break;
    }

    updateError = response.error;
    const msg = String(response.error.message || '').toLowerCase();
    if (!msg.includes('titulo')) break;
  }

  if (updateError) {
    console.error('Error actualizando publicación:', updateError);
    setEstadoGuardado(updateError.message || 'No se pudo actualizar la publicación.', true);
    return;
  }

  editingPostId = null;
  setEstadoGuardado('Publicación actualizada.');
  await loadPublicacionesActivas();
}

async function handleSubmit(event) {
  event.preventDefault();

  const file = inputArchivo?.files?.[0];
  const titulo = String(inputTitulo?.value || '').trim().slice(0, 50);
  const text = String(inputTexto?.value || '').trim();

  try {
    const baseMeta = selectedFileMeta || await validateAndPrepareFile(file, { ignoreSizeLimitForVideo: true });

    btnPublicar.disabled = true;
    btnPublicar.classList.add('opacity-60', 'cursor-not-allowed');
    setEstadoGuardado('Procesando video y preparando publicación...');

    const trimResult = await trimVideoFilePhysically(file, baseMeta);
    if (trimResult.message) {
      setEstadoGuardado(trimResult.message);
    } else {
      setEstadoGuardado('Subiendo publicación...');
    }

    const fileToUpload = trimResult.file;
    const meta = trimResult.meta;
    const outputSizeMb = getFileSizeMb(fileToUpload);

    if (outputSizeMb > MAX_FILE_SIZE_MB) {
      const sizeText = outputSizeMb.toFixed(1);
      if (isVideoMeta(meta) && !trimResult.clippedPhysically && !canPhysicallyTrimVideo()) {
        throw new Error(`El video pesa ${sizeText}MB. En este dispositivo no se pudo recortar físicamente para bajar de ${MAX_FILE_SIZE_MB}MB. Usa un video más liviano o recórtalo antes de subir.`);
      }
      throw new Error(`El archivo final quedó en ${sizeText}MB. Debe ser ${MAX_FILE_SIZE_MB}MB o menos para publicar.`);
    }

    const clipPayload = trimResult.clippedPhysically
      ? { clip_start_sec: null, clip_end_sec: null, media_has_audio: meta?.hasAudio === true ? true : null }
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
      titulo,
      texto: text,
      media_path: storagePath,
      media_tipo: meta.media_tipo,
      media_mime: meta.mime,
      media_ancho: meta.width,
      media_alto: meta.height,
      ...clipPayload,
    };

    let insertError = null;
    const insertAttempts = [
      { ...payload },
      (() => {
        const item = { ...payload };
        delete item.clip_start_sec;
        delete item.clip_end_sec;
        delete item.media_has_audio;
        return item;
      })(),
      (() => {
        const item = { ...payload };
        delete item.clip_start_sec;
        delete item.clip_end_sec;
        delete item.media_has_audio;
        delete item.titulo;
        return item;
      })(),
    ];

    for (const insertPayload of insertAttempts) {
      const response = await supabase
        .from('publicaciones_hoy')
        .insert(insertPayload);

      if (!response.error) {
        insertError = null;
        break;
      }

      insertError = response.error;
      const msg = String(response.error.message || '').toLowerCase();
      const shouldRetry = (
        msg.includes('clip_start_sec')
        || msg.includes('clip_end_sec')
        || msg.includes('media_has_audio')
        || msg.includes('titulo')
      );
      if (!shouldRetry) break;
    }

    if (insertError) {
      await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
      throw new Error(insertError.message || 'No se pudo guardar la publicación.');
    }

    setEstadoGuardado('Publicación creada correctamente.');

    formPublicacion.reset();
    clearPreview();
    updateContadorTitulo();
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
  inputTitulo?.addEventListener('input', updateContadorTitulo);
  inputTexto?.addEventListener('input', updateContadorTexto);

  clipTimeline?.addEventListener('pointerdown', handleClipTimelinePointerDown);

  inputArchivo?.addEventListener('change', async () => {
    const file = inputArchivo.files?.[0];
    if (!file) {
      clearPreview();
      return;
    }

    try {
      setEstadoGuardado('Validando archivo...');
      const meta = await validateAndPrepareFile(file, { ignoreSizeLimitForVideo: true });
      renderPreview(file, meta);
      const sourceSizeMb = getFileSizeMb(file);
      if (meta.media_tipo === 'video' && Number(meta.durationSec || 0) > MAX_CLIP_SECONDS) {
        setEstadoGuardado(`Video cargado (${Number(meta.durationSec || 0).toFixed(1)}s). Selecciona un fragmento de hasta ${MAX_CLIP_SECONDS}s para publicar.`);
      } else if (meta.media_tipo === 'video' && sourceSizeMb > MAX_FILE_SIZE_MB && !canPhysicallyTrimVideo()) {
        setEstadoGuardado(`Video cargado (${sourceSizeMb.toFixed(1)}MB). Este dispositivo no soporta compresión automática; usa un video de ${MAX_FILE_SIZE_MB}MB o menos.`, true);
      } else if (meta.media_tipo === 'video' && sourceSizeMb > MAX_FILE_SIZE_MB) {
        setEstadoGuardado('Archivo listo para publicar.');
      } else {
        setEstadoGuardado('Archivo listo para publicar.');
      }
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
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const rowId = btn.getAttribute('data-id');

    if (action === 'start-edit') {
      startEditPublicacion(rowId);
      return;
    }

    if (action === 'cancel-edit') {
      cancelEditPublicacion();
      return;
    }

    if (action === 'save-edit') {
      void saveEditPublicacion(rowId);
      return;
    }

    if (action === 'delete') {
      void deletePublicacion(rowId);
    }
  });

  listaPublicacionesComercio?.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('[data-role="edit-titulo"], [data-role="edit-texto"]')) return;
    const container = target.closest('[data-role="edit-form"]');
    updateInlineEditCounters(container);
  });
}

async function init() {
  bindEvents();
  updateContadorTitulo();
  updateContadorTexto();
  resetClipEditor();

  const hasAccess = await validateAccessOrRedirect();
  if (!hasAccess) return;

  await loadPublicacionesActivas();
}

void init();
