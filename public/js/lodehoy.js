import { supabase } from '../shared/supabaseClient.js';
import { requireAuth } from './authGuard.js';

const PUBLIC_BUCKET_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios';
const DEFAULT_LOGO = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png';
const SHARE_ICON_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/send.svg';
const LIKE_ON_ICON_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/likeit.svg';
const LIKE_OFF_ICON_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/nolikeit.svg';
const LODEHOY_LIKES_TABLE = 'lodehoy_likes_comercio';
const LODEHOY_AUDIO_PREF_KEY = 'lodehoy_audio_enabled';
const HOST = String(window.location.hostname || '').toLowerCase();
const IS_LOCAL = HOST === 'localhost' || HOST === '127.0.0.1' || HOST === '::1';
const IS_IOS_DEVICE = /iphone|ipad|ipod/i.test(String(window.navigator?.userAgent || ''))
  || (String(window.navigator?.platform || '').toLowerCase() === 'macintel' && Number(window.navigator?.maxTouchPoints || 0) > 1);
const APP_PREFIX = IS_LOCAL ? '/public' : '';

const estadoCarga = document.getElementById('estadoCarga');
const estadoVacio = document.getElementById('estadoVacio');
const listaPublicaciones = document.getElementById('listaPublicaciones');
const shareSheet = document.getElementById('shareSheet');
const shareSheetCerrar = document.getElementById('shareSheetCerrar');
const mediaViewer = document.getElementById('mediaViewer');
const mediaViewerContent = document.getElementById('mediaViewerContent');
const mediaViewerClose = document.getElementById('mediaViewerClose');
const filtroUbicacion = document.getElementById('filtroUbicacionLoDeHoy');
const filtroCategoria = document.getElementById('filtroCategoriaLoDeHoy');
const filtroOrden = document.getElementById('filtroOrdenLoDeHoy');
const EMPTY_DEFAULT_TEXT = 'Todavía no hay publicaciones para hoy.';
const EMPTY_FILTER_TEXT = 'No hay publicaciones para los filtros seleccionados.';

let currentUser = null;
let favoritosSet = new Set();
let likesVisualSet = new Set();
let publicaciones = [];
let publicacionesRender = [];
let comercioById = new Map();
let likesCountByComercio = new Map();
let categoriasByComercio = new Map();
let categoriaNombreById = new Map();
let areasCatalog = [];
let municipiosCatalog = [];
let userCoords = null;
let ubicacionInteracted = false;
let sharePostId = null;
let highlightedFromQuery = false;
let audioEnabled = true;
let videoObserver = null;
let autoplayUnlocked = false;
let mediaViewerOpen = false;
const filterState = {
  scopeType: 'area',
  scopeValue: '',
  categoriaId: '',
  orden: 'recientes',
};
const initialScopeFromQuery = (() => {
  const params = new URLSearchParams(window.location.search);
  const municipioId = toNumber(params.get('idMunicipio'));
  const areaId = toNumber(params.get('idArea'));
  if (municipioId && municipioId > 0) {
    return { scopeType: 'municipio', scopeValue: String(municipioId) };
  }
  if (areaId && areaId > 0) {
    return { scopeType: 'area', scopeValue: String(areaId) };
  }
  return null;
})();
let initialScopeApplied = false;

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

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function getPuertoRicoNowParts() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Puerto_Rico',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const pick = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
  };
}

function getLoDeHoyWindowStartIso() {
  const pr = getPuertoRicoNowParts();
  if (!pr.year || !pr.month || !pr.day) return null;

  const dayUtc = Date.UTC(pr.year, pr.month - 1, pr.day) - (pr.hour < 5 ? 86400000 : 0);
  const dayDate = new Date(dayUtc);
  const y = dayDate.getUTCFullYear();
  const m = pad2(dayDate.getUTCMonth() + 1);
  const d = pad2(dayDate.getUTCDate());
  // Puerto Rico no usa DST; se mantiene en UTC-04:00.
  return `${y}-${m}-${d}T05:00:00-04:00`;
}

function getComercioLikeCount(comercioId) {
  const id = toNumber(comercioId);
  if (!id) return 0;
  const count = Number(likesCountByComercio.get(id) || 0);
  return Number.isFinite(count) ? count : 0;
}

function getDistanceKmFromUser(comercio = {}) {
  if (!Number.isFinite(userCoords?.lat) || !Number.isFinite(userCoords?.lon)) {
    return Number.POSITIVE_INFINITY;
  }

  const lat1 = Number(userCoords.lat);
  const lon1 = Number(userCoords.lon);
  const lat2 = Number(comercio.latitud);
  const lon2 = Number(comercio.longitud);
  if (!Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return Number.POSITIVE_INFINITY;
  }

  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function readAudioPreference() {
  try {
    const raw = localStorage.getItem(LODEHOY_AUDIO_PREF_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch (_error) {}
  return true;
}

function saveAudioPreference() {
  try {
    localStorage.setItem(LODEHOY_AUDIO_PREF_KEY, audioEnabled ? '1' : '0');
  } catch (_error) {}
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function resolveVideoClipRange(video) {
  const duration = toFiniteNumber(video?.duration, 0);
  const startRaw = toFiniteNumber(video?.dataset?.clipStart, 0);
  const endRaw = toFiniteNumber(video?.dataset?.clipEnd, duration);

  const safeStart = Math.max(0, startRaw);
  let safeEnd = endRaw > safeStart ? endRaw : duration;
  if (duration > 0) {
    safeEnd = Math.min(duration, safeEnd);
  }
  if (!Number.isFinite(safeEnd) || safeEnd <= safeStart) {
    safeEnd = duration > safeStart ? duration : safeStart + 0.1;
  }
  return { start: safeStart, end: safeEnd };
}

function isElementAtLeastHalfVisible(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
  const overlapW = Math.max(0, Math.min(rect.right, viewportW) - Math.max(rect.left, 0));
  const overlapH = Math.max(0, Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0));
  const visibleArea = overlapW * overlapH;
  const totalArea = rect.width * rect.height;
  if (!totalArea) return false;
  return (visibleArea / totalArea) >= 0.5;
}

function getMediaOrientation(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return 'landscape';
  }
  return h > w ? 'portrait' : 'landscape';
}

function applyFeedMediaLayout(mediaEl, orientation = 'landscape') {
  if (!(mediaEl instanceof HTMLElement)) return;
  const frame = mediaEl.closest('.lodehoy-media-frame');
  if (!frame) return;

  const isPortrait = orientation === 'portrait';
  frame.classList.toggle('lodehoy-media-frame--portrait', isPortrait);
  frame.classList.toggle('lodehoy-media-frame--landscape', !isPortrait);
  mediaEl.classList.toggle('lodehoy-media-fit-cover', isPortrait);
  mediaEl.classList.toggle('lodehoy-media-fit-contain', !isPortrait);

  if (isPortrait) {
    mediaEl.classList.add('h-full');
    mediaEl.classList.remove('h-auto');
  } else {
    mediaEl.classList.add('h-auto');
    mediaEl.classList.remove('h-full');
  }
}

function resolveAndApplyFeedMediaOrientation(mediaEl) {
  if (mediaEl instanceof HTMLImageElement) {
    const applyFromImage = () => {
      const orientation = getMediaOrientation(mediaEl.naturalWidth, mediaEl.naturalHeight);
      applyFeedMediaLayout(mediaEl, orientation);
    };

    if (mediaEl.complete && mediaEl.naturalWidth > 0) {
      applyFromImage();
    } else {
      mediaEl.addEventListener('load', applyFromImage, { once: true });
    }
    return;
  }

  if (mediaEl instanceof HTMLVideoElement) {
    const applyFromVideo = () => {
      const orientation = getMediaOrientation(mediaEl.videoWidth, mediaEl.videoHeight);
      applyFeedMediaLayout(mediaEl, orientation);
    };

    if (mediaEl.readyState >= 1 && mediaEl.videoWidth > 0) {
      applyFromVideo();
    } else {
      mediaEl.addEventListener('loadedmetadata', applyFromVideo, { once: true });
    }
  }
}

function setupFeedMediaLayout() {
  if (!listaPublicaciones) return;
  const mediaList = listaPublicaciones.querySelectorAll('[data-role="feed-media"]');
  mediaList.forEach((mediaEl) => {
    applyFeedMediaLayout(mediaEl, 'landscape');
    resolveAndApplyFeedMediaOrientation(mediaEl);
  });
}

function encodeStoragePath(path) {
  const clean = String(path || '')
    .trim()
    .replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/galeriacomercios\//i, '')
    .replace(/^\/+/, '')
    .replace(/^public\//i, '')
    .replace(/^galeriacomercios\//i, '');

  return clean
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function buildStoragePublicUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const encoded = encodeStoragePath(path);
  return encoded ? `${PUBLIC_BUCKET_BASE}/${encoded}` : '';
}

function getComercioLogoUrl(logo) {
  if (!logo) return DEFAULT_LOGO;
  if (/^https?:\/\//i.test(logo)) return logo;
  return buildStoragePublicUrl(logo);
}

function formatHoraPR(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-PR', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Puerto_Rico',
  }).format(date);
}

function setStatus(message, { error = false } = {}) {
  if (!estadoCarga) return;
  estadoCarga.textContent = message;
  estadoCarga.classList.remove('hidden');
  estadoCarga.classList.toggle('text-red-600', error);
  estadoCarga.classList.toggle('text-gray-500', !error);
}

function hideStatus() {
  estadoCarga?.classList.add('hidden');
}

function setEmptyVisible(visible) {
  if (!estadoVacio) return;
  estadoVacio.classList.toggle('hidden', !visible);
}

function setSelectOptions(select, options = [], selectedValue = '') {
  if (!select) return;
  select.innerHTML = options.map((opt) => {
    const value = escapeHtml(opt.value ?? '');
    const label = escapeHtml(opt.label ?? '');
    const selected = String(opt.value ?? '') === String(selectedValue ?? '') ? ' selected' : '';
    return `<option value="${value}"${selected}>${label}</option>`;
  }).join('');
}

function parseCategoriaTokens(rawCategoria) {
  if (typeof rawCategoria !== 'string') return [];
  return rawCategoria
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getComercioCategoriasIds(comercioId) {
  const id = toNumber(comercioId);
  if (!id) return [];
  return categoriasByComercio.get(id) || [];
}

function syncCategoryFallbackFromComercios() {
  comercioById.forEach((comercio, comercioId) => {
    const categoriaIds = categoriasByComercio.get(comercioId);
    if (Array.isArray(categoriaIds) && categoriaIds.length) return;

    const tokens = parseCategoriaTokens(comercio?.categoria);
    if (!tokens.length) return;

    const knownIds = [];
    categoriaNombreById.forEach((nombre, id) => {
      const normNombre = normalizeText(nombre);
      if (tokens.some((token) => normalizeText(token) === normNombre)) {
        knownIds.push(id);
      }
    });
    if (knownIds.length) {
      categoriasByComercio.set(comercioId, knownIds);
    }
  });
}

function getMunicipiosForActiveScopeType() {
  if (filterState.scopeType !== 'municipio') return [];
  return municipiosCatalog.filter((municipio) => toNumber(municipio?.id));
}

function getAreasForActiveScopeType() {
  if (filterState.scopeType !== 'area') return [];
  return areasCatalog.filter((area) => toNumber(area?.idArea));
}

function getCategoriasDisponibles() {
  const usedCategoryIds = new Set();
  publicaciones.forEach((post) => {
    const comercioId = toNumber(post.idcomercio);
    const ids = getComercioCategoriasIds(comercioId);
    ids.forEach((id) => {
      if (toNumber(id)) usedCategoryIds.add(toNumber(id));
    });
  });

  return Array.from(usedCategoryIds)
    .map((id) => ({ id, nombre: categoriaNombreById.get(id) || `Categoría ${id}` }))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
}

function isFavorite(comercioId) {
  const id = toNumber(comercioId);
  return id ? favoritosSet.has(id) : false;
}

function isLikeVisualOn(comercioId) {
  const id = toNumber(comercioId);
  return id ? likesVisualSet.has(id) : false;
}

function updateFavoriteButtonsForComercio(comercioId) {
  const id = toNumber(comercioId);
  if (!id) return;

  const buttons = document.querySelectorAll(`[data-action="favorite"][data-comercio-id="${id}"]`);
  buttons.forEach((button) => {
    const icon = button.querySelector('i');
    if (icon) {
      icon.className = isFavorite(id)
        ? 'fa-solid fa-heart text-2xl text-red-500'
        : 'fa-regular fa-heart text-2xl text-[#1f2937]';
    }
    button.setAttribute('aria-pressed', isFavorite(id) ? 'true' : 'false');
  });
}

function updateLikeVisualButtonsForComercio(comercioId) {
  const id = toNumber(comercioId);
  if (!id) return;

  const buttons = document.querySelectorAll(`[data-action="like-visual"][data-comercio-id="${id}"]`);
  const iconUrl = isLikeVisualOn(id) ? LIKE_ON_ICON_URL : LIKE_OFF_ICON_URL;
  const altText = isLikeVisualOn(id) ? 'Me gusta activo' : 'Me gusta inactivo';

  buttons.forEach((button) => {
    const img = button.querySelector('img');
    if (img) {
      img.src = iconUrl;
      img.alt = altText;
    }
    button.setAttribute('aria-pressed', isLikeVisualOn(id) ? 'true' : 'false');
    button.classList.toggle('bg-rose-50', isLikeVisualOn(id));
    button.classList.toggle('ring-1', isLikeVisualOn(id));
    button.classList.toggle('ring-rose-200', isLikeVisualOn(id));
  });
}

function updateAudioButtons() {
  const buttons = document.querySelectorAll('[data-action="toggle-audio"]');
  buttons.forEach((button) => {
    const icon = button.querySelector('i');
    if (icon) {
      icon.className = audioEnabled
        ? 'fa-solid fa-volume-high text-[12px] text-emerald-700'
        : 'fa-solid fa-volume-xmark text-[12px] text-gray-700';
    }
    button.setAttribute('aria-pressed', audioEnabled ? 'true' : 'false');
    button.setAttribute('aria-label', audioEnabled ? 'Silenciar videos' : 'Activar audio de videos');
    button.classList.toggle('ring-1', audioEnabled);
    button.classList.toggle('ring-emerald-200', audioEnabled);
  });
}

function getVideoAudioControls(videoId) {
  if (!videoId) return { button: null, badge: null };
  return {
    button: document.querySelector(`button[data-action="toggle-audio"][data-video-id="${videoId}"]`),
    badge: document.querySelector(`[data-role="video-no-audio"][data-video-id="${videoId}"]`),
  };
}

function inferVideoAudio(video) {
  if (!(video instanceof HTMLVideoElement)) return { known: false, hasAudio: true };

  if (typeof video.mozHasAudio === 'boolean') {
    return { known: true, hasAudio: video.mozHasAudio };
  }

  const tracks = video.audioTracks;
  if (tracks && typeof tracks.length === 'number') {
    if (tracks.length > 0) {
      return { known: true, hasAudio: true };
    }
    if (!IS_IOS_DEVICE) {
      return { known: true, hasAudio: false };
    }
  }

  if (typeof video.webkitAudioDecodedByteCount === 'number') {
    if (video.webkitAudioDecodedByteCount > 0) {
      return { known: true, hasAudio: true };
    }
  }

  return { known: false, hasAudio: true };
}

function applyVideoAudioUI(video, { known, hasAudio }) {
  const videoId = String(video?.dataset?.postId || '').trim();
  if (!videoId) return;
  video.dataset.hasAudio = known ? (hasAudio ? '1' : '0') : 'unknown';

  const { button, badge } = getVideoAudioControls(videoId);
  if (!button && !badge) return;

  if (known && !hasAudio) {
    button?.classList.add('hidden');
    badge?.classList.remove('hidden');
    video.muted = true;
    video.defaultMuted = true;
    return;
  }

  button?.classList.remove('hidden');
  badge?.classList.add('hidden');
}

function scheduleVideoAudioProbe(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  if (video.dataset.audioProbeScheduled === '1') return;
  video.dataset.audioProbeScheduled = '1';

  const runProbe = () => {
    const first = inferVideoAudio(video);
    applyVideoAudioUI(video, first);

    if (first.known) return;

    window.setTimeout(() => {
      const later = inferVideoAudio(video);
      applyVideoAudioUI(video, later);
    }, 1200);
  };

  if (video.readyState >= 1) {
    runProbe();
  } else {
    video.addEventListener('loadedmetadata', runProbe, { once: true });
  }
}

function bindVideoClipLoop(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  if (video.dataset.clipLoopBound === '1') return;
  video.dataset.clipLoopBound = '1';
  video.loop = false;

  const ensureWindow = () => {
    const { start, end } = resolveVideoClipRange(video);
    if (video.currentTime < start || video.currentTime > end) {
      video.currentTime = start;
    }
  };

  video.addEventListener('loadedmetadata', ensureWindow);
  video.addEventListener('timeupdate', () => {
    const { start, end } = resolveVideoClipRange(video);
    if (video.currentTime >= end - 0.04) {
      video.currentTime = start;
      if (!video.paused) {
        void video.play().catch(() => {});
      }
    }
  });
}

function getFeedVideos() {
  if (!listaPublicaciones) return [];
  return Array.from(listaPublicaciones.querySelectorAll('video[data-lodehoy-video="1"]'));
}

function retryVisibleVideosPlayback() {
  getFeedVideos().forEach((video) => {
    if (isElementAtLeastHalfVisible(video)) {
      void playManagedVideo(video);
    }
  });
}

function pauseAllFeedVideos() {
  getFeedVideos().forEach((video) => pauseManagedVideo(video));
}

function syncViewportVideoPlayback() {
  getFeedVideos().forEach((video) => {
    if (mediaViewerOpen) {
      pauseManagedVideo(video);
      return;
    }

    if (isElementAtLeastHalfVisible(video)) {
      void playManagedVideo(video);
    } else {
      pauseManagedVideo(video);
    }
  });
}

function registerAutoplayUnlockHandlers() {
  const unlock = () => {
    autoplayUnlocked = true;
    audioEnabled = true;
    saveAudioPreference();
    updateAudioButtons();
    applyAudioStateToVisibleVideos();
    retryVisibleVideosPlayback();
  };

  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('scroll', unlock, { once: true, passive: true });
  document.addEventListener('pointerdown', unlock, { once: true, passive: true });
}

function pauseManagedVideo(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  video.loop = false;
  video.pause();
}

async function playManagedVideo(video) {
  if (!(video instanceof HTMLVideoElement)) return;

  scheduleVideoAudioProbe(video);
  bindVideoClipLoop(video);
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.autoplay = true;

  const clip = resolveVideoClipRange(video);
  if (video.currentTime < clip.start || video.currentTime > clip.end) {
    video.currentTime = clip.start;
  }

  const isNoAudio = video.dataset.hasAudio === '0';
  video.muted = isNoAudio ? true : !audioEnabled;
  video.defaultMuted = isNoAudio ? true : !audioEnabled;
  video.loop = false;

  try {
    await video.play();
  } catch (_error) {
    if (!autoplayUnlocked || audioEnabled) {
      // Fallback para navegadores que bloquean autoplay con audio.
      video.muted = true;
      video.defaultMuted = true;
      try {
        await video.play();
      } catch (_errorMuted) {}
    }
  }
}

function setupVideoObserver() {
  if (videoObserver) {
    videoObserver.disconnect();
    videoObserver = null;
  }

  const videos = getFeedVideos();
  if (!videos.length) return;

  videoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (mediaViewerOpen) {
        pauseManagedVideo(video);
        return;
      }
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        void playManagedVideo(video);
      } else {
        pauseManagedVideo(video);
      }
    });
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

  videos.forEach((video) => {
    videoObserver.observe(video);
  });
}

function applyAudioStateToVisibleVideos() {
  getFeedVideos().forEach((video) => {
    const isNoAudio = video.dataset.hasAudio === '0';
    video.muted = isNoAudio ? true : !audioEnabled;
    video.defaultMuted = isNoAudio ? true : !audioEnabled;
    if (!video.paused) {
      void playManagedVideo(video);
    }
  });
}

function closeMediaViewer() {
  if (!mediaViewer || !mediaViewerContent) return;
  mediaViewer.classList.add('hidden');
  mediaViewerOpen = false;
  document.body.classList.remove('overflow-hidden');
  mediaViewerContent.innerHTML = '';
  retryVisibleVideosPlayback();
}

function openMediaViewer(postId) {
  const id = toNumber(postId);
  if (!id || !mediaViewer || !mediaViewerContent) return;
  const post = publicaciones.find((item) => toNumber(item.id) === id);
  if (!post) return;

  const comercio = comercioById.get(toNumber(post.idcomercio)) || {};
  const mediaUrl = buildStoragePublicUrl(post.media_path);
  const mediaUrlSafe = escapeHtml(mediaUrl);
  const nombreComercio = escapeHtml(comercio.nombre || 'Comercio');
  const clipStart = Number.isFinite(Number(post.clip_start_sec)) ? Number(post.clip_start_sec) : 0;
  const clipEnd = Number.isFinite(Number(post.clip_end_sec)) ? Number(post.clip_end_sec) : '';
  const hasAudioAttr = post.media_has_audio === true
    ? '1'
    : (post.media_has_audio === false && !IS_IOS_DEVICE ? '0' : 'unknown');

  const node = post.media_tipo === 'video'
    ? `
      <video
        id="mediaViewerVideo"
        class="w-full h-full max-w-[100vw] max-h-[100vh] object-contain"
        src="${mediaUrlSafe}"
        controls
        autoplay
        playsinline
        webkit-playsinline
        preload="metadata"
        data-post-id="${post.id}"
        data-has-audio="${hasAudioAttr}"
        data-clip-start="${clipStart}"
        data-clip-end="${clipEnd}"
      ></video>
    `
    : `<img class="w-full h-full max-w-[100vw] max-h-[100vh] object-contain" src="${mediaUrlSafe}" alt="Publicación de ${nombreComercio}" loading="lazy">`;

  mediaViewerContent.innerHTML = node;
  mediaViewer.classList.remove('hidden');
  mediaViewerOpen = true;
  document.body.classList.add('overflow-hidden');
  pauseAllFeedVideos();

  if (post.media_tipo === 'video') {
    const video = document.getElementById('mediaViewerVideo');
    if (video instanceof HTMLVideoElement) {
      bindVideoClipLoop(video);
      scheduleVideoAudioProbe(video);
      const isNoAudio = video.dataset.hasAudio === '0';
      video.muted = isNoAudio ? true : !audioEnabled;
      video.defaultMuted = isNoAudio ? true : !audioEnabled;
      void video.play().catch(async () => {
        video.muted = true;
        video.defaultMuted = true;
        await video.play().catch(() => {});
      });
    }
  }
}

async function ensureUserCoords() {
  if (Number.isFinite(userCoords?.lat) && Number.isFinite(userCoords?.lon)) {
    return true;
  }

  if (!navigator?.geolocation) {
    return false;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userCoords = {
          lat: Number(position.coords.latitude),
          lon: Number(position.coords.longitude),
        };
        resolve(true);
      },
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function postMatchesScope(post) {
  const comercio = comercioById.get(toNumber(post.idcomercio)) || {};
  const scopeValue = toNumber(filterState.scopeValue);
  if (!scopeValue) return true;

  if (filterState.scopeType === 'municipio') {
    return toNumber(comercio.idMunicipio) === scopeValue;
  }
  return toNumber(comercio.idArea) === scopeValue;
}

function postMatchesCategoria(post) {
  const categoriaId = toNumber(filterState.categoriaId);
  if (!categoriaId) return true;
  const comercioId = toNumber(post.idcomercio);
  const ids = getComercioCategoriasIds(comercioId);
  return ids.includes(categoriaId);
}

function comparePublicaciones(a, b) {
  const likesA = getComercioLikeCount(a.idcomercio);
  const likesB = getComercioLikeCount(b.idcomercio);
  if (likesA !== likesB) return likesB - likesA;

  if (filterState.orden === 'cercania') {
    const comercioA = comercioById.get(toNumber(a.idcomercio)) || {};
    const comercioB = comercioById.get(toNumber(b.idcomercio)) || {};
    const distA = getDistanceKmFromUser(comercioA);
    const distB = getDistanceKmFromUser(comercioB);
    if (distA !== distB) return distA - distB;
  }

  const dateA = new Date(a.created_at).getTime();
  const dateB = new Date(b.created_at).getTime();
  if (filterState.orden === 'antiguos') return dateA - dateB;
  return dateB - dateA;
}

function buildScopeOptionValue(scopeType, scopeValue = '') {
  return `scope:${scopeType}:${scopeValue || ''}`;
}

function parseScopeOptionValue(rawValue) {
  const raw = String(rawValue || '');
  if (!raw.startsWith('scope:')) return null;
  const [_, rawScopeType, ...rest] = raw.split(':');
  const scopeType = rawScopeType === 'municipio' ? 'municipio' : 'area';
  return {
    scopeType,
    scopeValue: String(rest.join(':') || ''),
  };
}

function refreshUbicacionOptions() {
  if (!filtroUbicacion) return;

  const scopeType = filterState.scopeType === 'municipio' ? 'municipio' : 'area';
  const isMunicipio = scopeType === 'municipio';
  const dynamicItems = isMunicipio ? getMunicipiosForActiveScopeType() : getAreasForActiveScopeType();
  const options = [
    { value: 'placeholder:localidad', label: 'Localidad:' },
    { value: 'mode:area', label: 'Por Área' },
    { value: 'mode:municipio', label: 'Por Municipio' },
    {
      value: buildScopeOptionValue(scopeType, ''),
      label: isMunicipio ? 'Municipio: Todos' : 'Área: Todas',
    },
  ];

  dynamicItems.forEach((item) => {
    if (isMunicipio) {
      const id = toNumber(item.id);
      if (!id) return;
      options.push({
        value: buildScopeOptionValue('municipio', String(id)),
        label: item.nombre || `Municipio ${id}`,
      });
      return;
    }

    const id = toNumber(item.idArea);
    if (!id) return;
    options.push({
      value: buildScopeOptionValue('area', String(id)),
      label: item.nombre || item.nombre_es || `Área ${id}`,
    });
  });

  const selectedValue = buildScopeOptionValue(scopeType, String(filterState.scopeValue || ''));
  const hasCurrent = options.some((opt) => opt.value === selectedValue);
  if (!hasCurrent) {
    filterState.scopeValue = '';
  }

  const finalSelected = !ubicacionInteracted
    ? 'placeholder:localidad'
    : (hasCurrent ? selectedValue : buildScopeOptionValue(scopeType, ''));

  setSelectOptions(filtroUbicacion, options, finalSelected);
}

function refreshCategoriaOptions() {
  const categorias = getCategoriasDisponibles();
  const options = [
    { value: '', label: 'Categorías:' },
    { value: '__all__', label: 'Todas las categorías' },
  ];
  categorias.forEach((categoria) => {
    options.push({ value: String(categoria.id), label: categoria.nombre });
  });

  const currentValue = filterState.categoriaId || '';
  const hasCurrent = options.some((opt) => String(opt.value) === String(currentValue));
  if (!hasCurrent) {
    filterState.categoriaId = '';
  }

  setSelectOptions(filtroCategoria, options, currentValue);
}

async function applyFiltersAndRender() {
  if (filterState.orden === 'cercania') {
    const hasCoords = await ensureUserCoords();
    if (!hasCoords) {
      filterState.orden = 'recientes';
      if (filtroOrden) filtroOrden.value = 'recientes';
    }
  }

  publicacionesRender = publicaciones
    .filter((post) => postMatchesScope(post))
    .filter((post) => postMatchesCategoria(post))
    .sort(comparePublicaciones);

  if (estadoVacio) {
    estadoVacio.textContent = publicaciones.length > 0 && publicacionesRender.length === 0
      ? EMPTY_FILTER_TEXT
      : EMPTY_DEFAULT_TEXT;
  }

  hideStatus();
  renderPublicaciones(publicacionesRender);
}

function refreshFiltersUI() {
  if (filtroOrden) filtroOrden.value = filterState.orden || '';
  refreshUbicacionOptions();
  refreshCategoriaOptions();
}

function applyInitialScopeFromQuery() {
  if (initialScopeApplied) return;
  initialScopeApplied = true;
  if (!initialScopeFromQuery) return;
  filterState.scopeType = initialScopeFromQuery.scopeType;
  filterState.scopeValue = initialScopeFromQuery.scopeValue;
  ubicacionInteracted = true;
}

function getProfileUrl(comercioId) {
  const id = toNumber(comercioId);
  return `${window.location.origin}${APP_PREFIX}/perfilComercio.html?id=${id}`;
}

function getPostUrl(postId) {
  const id = toNumber(postId);
  return `${window.location.origin}${APP_PREFIX}/lodehoy.html?post=${id}`;
}

function renderPublicaciones(list = publicaciones) {
  if (!listaPublicaciones) return;

  if (!list.length) {
    listaPublicaciones.innerHTML = '';
    setEmptyVisible(true);
    if (videoObserver) {
      videoObserver.disconnect();
      videoObserver = null;
    }
    return;
  }

  setEmptyVisible(false);

  const html = list.map((post) => {
    const comercioId = toNumber(post.idcomercio);
    const comercio = comercioById.get(comercioId) || {};
    const nombreComercio = escapeHtml(comercio.nombre || 'Comercio');
    const municipio = comercio.municipio ? escapeHtml(comercio.municipio) : '';
    const titulo = String(post.titulo || '').trim();
    const tituloSeguro = escapeHtml(titulo);
    const texto = String(post.texto || '').trim();
    const textoSeguro = escapeHtml(texto);
    const logoUrl = getComercioLogoUrl(comercio.logo);
    const mediaUrl = buildStoragePublicUrl(post.media_path);
    const horaPublicada = formatHoraPR(post.created_at);
    const logoUrlSafe = escapeHtml(logoUrl);
    const mediaUrlSafe = escapeHtml(mediaUrl);
    const profileUrlSafe = escapeHtml(getProfileUrl(comercioId));
    const clipStart = Number.isFinite(Number(post.clip_start_sec)) ? Number(post.clip_start_sec) : 0;
    const clipEnd = Number.isFinite(Number(post.clip_end_sec)) ? Number(post.clip_end_sec) : '';
    const hasAudioAttr = post.media_has_audio === true
      ? '1'
      : (post.media_has_audio === false && !IS_IOS_DEVICE ? '0' : 'unknown');
    const iconLikeVisual = escapeHtml(isLikeVisualOn(comercioId) ? LIKE_ON_ICON_URL : LIKE_OFF_ICON_URL);
    const favoriteClass = isFavorite(comercioId)
      ? 'fa-solid fa-heart text-2xl text-red-500'
      : 'fa-regular fa-heart text-2xl text-[#1f2937]';

    const mediaNode = post.media_tipo === 'video'
      ? `<video class="lodehoy-media-content cursor-zoom-in" src="${mediaUrlSafe}" controls autoplay muted playsinline webkit-playsinline preload="metadata" data-role="feed-media" data-lodehoy-video="1" data-action="open-media" data-post-id="${post.id}" data-has-audio="${hasAudioAttr}" data-clip-start="${clipStart}" data-clip-end="${clipEnd}"></video>`
      : `<img class="lodehoy-media-content cursor-zoom-in" src="${mediaUrlSafe}" alt="Publicación de ${nombreComercio}" loading="lazy" data-role="feed-media" data-action="open-media" data-post-id="${post.id}">`;

    return `
      <article id="post-${post.id}" class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <header class="px-3 py-3 flex items-center gap-3">
          <button
            type="button"
            data-action="favorite"
            data-comercio-id="${comercioId}"
            class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
            aria-label="Favorito del comercio"
            aria-pressed="${isFavorite(comercioId) ? 'true' : 'false'}"
          >
            <i class="${favoriteClass}"></i>
          </button>
          <a
            href="${profileUrlSafe}"
            class="min-w-0 flex-1 flex items-center gap-3 hover:opacity-90 transition"
            aria-label="Ver perfil de ${nombreComercio}"
          >
            <img src="${logoUrlSafe}" alt="${nombreComercio}" class="w-11 h-11 rounded-full object-cover border border-gray-200">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 truncate">${nombreComercio}</p>
              <p class="text-xs text-gray-500 truncate">${municipio || 'Puerto Rico'}</p>
            </div>
          </a>
          <div class="ml-auto flex items-center gap-2">
            <button
              type="button"
              data-action="like-visual"
              data-comercio-id="${comercioId}"
              class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
              aria-label="Me gusta del comercio"
              aria-pressed="${isLikeVisualOn(comercioId) ? 'true' : 'false'}"
            >
              <img src="${iconLikeVisual}" alt="${isLikeVisualOn(comercioId) ? 'Me gusta activo' : 'Me gusta inactivo'}" class="w-8 h-8">
            </button>
            <button
              type="button"
              data-action="share"
              data-post-id="${post.id}"
              class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition"
              aria-label="Compartir publicación"
            >
              <img src="${escapeHtml(SHARE_ICON_URL)}" alt="Compartir" class="w-8 h-8">
            </button>
          </div>
        </header>

        <div class="lodehoy-media-frame lodehoy-media-frame--landscape bg-gray-100 flex items-center justify-center overflow-hidden relative">
          ${mediaNode}
          ${post.media_tipo === 'video' ? `
            <div class="absolute right-2 bottom-2 z-10 flex items-center gap-2">
              <span data-role="video-no-audio" data-video-id="${post.id}" class="hidden px-2 py-0.5 rounded-full bg-white/95 text-[10px] font-semibold text-gray-700 shadow-sm">
                Video sin Audio
              </span>
              <button
                type="button"
                data-action="toggle-audio"
                data-video-id="${post.id}"
                class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/95 shadow-sm border border-gray-100"
                aria-label="${audioEnabled ? 'Silenciar videos' : 'Activar audio de videos'}"
                aria-pressed="${audioEnabled ? 'true' : 'false'}"
              >
                <i class="${audioEnabled ? 'fa-solid fa-volume-high text-[12px] text-emerald-700' : 'fa-solid fa-volume-xmark text-[12px] text-gray-700'}"></i>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="px-3 py-3 border-t border-gray-100 space-y-2">
          ${tituloSeguro ? `
            <p class="text-[18px] leading-tight font-semibold text-gray-900 text-center" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${tituloSeguro}
            </p>
          ` : ''}
          ${textoSeguro ? `
            <p class="text-[16px] leading-snug font-normal text-gray-700 text-center line-clamp-3">
              ${textoSeguro}
            </p>
          ` : ''}
          <p class="text-[13px] leading-tight font-normal text-gray-500 text-center">
            Publicado: ${escapeHtml(horaPublicada || '—')}
          </p>
        </div>
      </article>
    `;
  }).join('');

  listaPublicaciones.innerHTML = html;
  setupFeedMediaLayout();
  updateAudioButtons();
  setupVideoObserver();
  getFeedVideos().forEach((video) => {
    bindVideoClipLoop(video);
    const hasAudioAttr = String(video.dataset.hasAudio || '').trim();
    const knownAudio = hasAudioAttr === '1' || hasAudioAttr === '0';
    const hasAudio = hasAudioAttr !== '0';
    applyVideoAudioUI(video, { known: knownAudio, hasAudio });
    if (!knownAudio) {
      scheduleVideoAudioProbe(video);
    }
  });
  maybeHighlightPostFromQuery();
}

function maybeHighlightPostFromQuery() {
  if (highlightedFromQuery) return;
  const postId = toNumber(new URLSearchParams(window.location.search).get('post'));
  if (!postId) return;

  const target = document.getElementById(`post-${postId}`);
  if (!target) return;

  highlightedFromQuery = true;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('ring-2', 'ring-[#EC7F25]');
  setTimeout(() => {
    target.classList.remove('ring-2', 'ring-[#EC7F25]');
  }, 2500);
}

async function loadUserAndFavorites() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.warn('No se pudo obtener usuario actual:', error.message || error);
    currentUser = null;
    favoritosSet = new Set();
    likesVisualSet = new Set();
    return;
  }

  currentUser = data?.user || null;
  if (!currentUser) {
    favoritosSet = new Set();
    likesVisualSet = new Set();
    return;
  }

  const { data: favs, error: favErr } = await supabase
    .from('favoritosusuarios')
    .select('idcomercio')
    .eq('idusuario', currentUser.id);

  if (favErr) {
    console.warn('No se pudo cargar favoritos:', favErr.message || favErr);
    favoritosSet = new Set();
  } else {
    favoritosSet = new Set((favs || []).map((row) => toNumber(row.idcomercio)).filter(Boolean));
  }

  likesVisualSet = new Set();
}

async function loadLikesVisualForComercios(comercioIds = []) {
  if (!currentUser || !comercioIds.length) {
    likesVisualSet = new Set();
    return;
  }

  const windowStartIso = getLoDeHoyWindowStartIso();
  let query = supabase
    .from(LODEHOY_LIKES_TABLE)
    .select('idcomercio')
    .eq('idusuario', currentUser.id)
    .in('idcomercio', comercioIds);

  if (windowStartIso) {
    query = query.gte('created_at', windowStartIso);
  }

  let { data, error } = await query;
  if (error && String(error.message || '').toLowerCase().includes('created_at')) {
    ({ data, error } = await supabase
      .from(LODEHOY_LIKES_TABLE)
      .select('idcomercio')
      .eq('idusuario', currentUser.id)
      .in('idcomercio', comercioIds));
  }

  if (error) {
    if (error.code !== '42P01') {
      console.warn('No se pudieron cargar Me Gusta de Lo de Hoy:', error.message || error);
    }
    likesVisualSet = new Set();
    return;
  }

  likesVisualSet = new Set((data || []).map((row) => toNumber(row.idcomercio)).filter(Boolean));
}

async function loadGeoCatalogs() {
  const areasAttempts = [
    { columns: 'idArea,nombre_es,nombre', order: 'nombre_es' },
    { columns: 'idArea,nombre', order: 'nombre' },
  ];
  const municipiosAttempts = [
    'id,nombre,idArea',
    'id,nombre',
  ];

  areasCatalog = [];
  for (const attempt of areasAttempts) {
    const { data, error } = await supabase
      .from('Area')
      .select(attempt.columns)
      .order(attempt.order, { ascending: true });
    if (!error) {
      areasCatalog = (data || []).map((row) => ({
        ...row,
        nombre: String(row?.nombre_es || row?.nombre || '').trim(),
      }));
      break;
    }
  }

  municipiosCatalog = [];
  for (const columns of municipiosAttempts) {
    const { data, error } = await supabase
      .from('Municipios')
      .select(columns)
      .order('nombre', { ascending: true });
    if (!error) {
      municipiosCatalog = (data || []).map((row) => ({
        ...row,
        idArea: toNumber(row?.idArea),
      }));
      break;
    }
  }
}

function readCategoriaIdFromRelacion(relacion) {
  const raw = relacion?.idCategoria ?? relacion?.idcategoria ?? relacion?.id_categoria;
  return toNumber(raw);
}

async function loadCategoriasPorComercio(comercioIds = []) {
  categoriasByComercio = new Map();
  categoriaNombreById = new Map();

  if (!comercioIds.length) return;

  const embedded = await supabase
    .from('Comercios')
    .select(`
      id,
      ComercioCategorias (
        idCategoria,
        categoria:Categorias (
          id,
          nombre
        )
      )
    `)
    .in('id', comercioIds);

  if (!embedded.error) {
    (embedded.data || []).forEach((comercio) => {
      const comercioId = toNumber(comercio?.id);
      if (!comercioId) return;
      const ids = [];
      (Array.isArray(comercio.ComercioCategorias) ? comercio.ComercioCategorias : []).forEach((rel) => {
        const categoriaId = readCategoriaIdFromRelacion(rel);
        if (!categoriaId) return;
        ids.push(categoriaId);
        const catName = String(rel?.categoria?.nombre || '').trim();
        if (catName) categoriaNombreById.set(categoriaId, catName);
      });
      categoriasByComercio.set(comercioId, Array.from(new Set(ids)));
    });
    return;
  }

  const relAttempts = [
    { select: 'idComercio,idCategoria', comercioCol: 'idComercio', categoriaCol: 'idCategoria' },
    { select: 'idcomercio,idcategoria', comercioCol: 'idcomercio', categoriaCol: 'idcategoria' },
    { select: 'idComercio,id_categoria', comercioCol: 'idComercio', categoriaCol: 'id_categoria' },
  ];

  const categoriaIds = new Set();
  for (const attempt of relAttempts) {
    const { data, error } = await supabase
      .from('ComercioCategorias')
      .select(attempt.select)
      .in(attempt.comercioCol, comercioIds);
    if (error) continue;

    (data || []).forEach((rel) => {
      const comercioId = toNumber(rel?.[attempt.comercioCol]);
      const categoriaId = toNumber(rel?.[attempt.categoriaCol]);
      if (!comercioId || !categoriaId) return;
      const current = categoriasByComercio.get(comercioId) || [];
      current.push(categoriaId);
      categoriasByComercio.set(comercioId, current);
      categoriaIds.add(categoriaId);
    });
    break;
  }

  if (categoriaIds.size) {
    const ids = Array.from(categoriaIds);
    const { data, error } = await supabase
      .from('Categorias')
      .select('id,nombre')
      .in('id', ids);
    if (!error) {
      (data || []).forEach((categoria) => {
        const id = toNumber(categoria?.id);
        if (!id) return;
        categoriaNombreById.set(id, String(categoria?.nombre || `Categoría ${id}`));
      });
    }
  }

  categoriasByComercio.forEach((ids, comercioId) => {
    categoriasByComercio.set(comercioId, Array.from(new Set(ids)));
  });
}

async function loadLikesCountByComercios(comercioIds = []) {
  likesCountByComercio = new Map(comercioIds.map((id) => [id, 0]));
  if (!comercioIds.length) return;

  const windowStartIso = getLoDeHoyWindowStartIso();
  let query = supabase
    .from(LODEHOY_LIKES_TABLE)
    .select('idcomercio,idusuario')
    .in('idcomercio', comercioIds);

  if (windowStartIso) {
    query = query.gte('created_at', windowStartIso);
  }

  let { data, error } = await query;
  if (error && String(error.message || '').toLowerCase().includes('created_at')) {
    ({ data, error } = await supabase
      .from(LODEHOY_LIKES_TABLE)
      .select('idcomercio,idusuario')
      .in('idcomercio', comercioIds));
  }

  if (error) {
    if (error.code !== '42P01') {
      console.warn('No se pudo cargar el conteo de Me Gusta para Lo de Hoy:', error.message || error);
    }
    return;
  }

  const byComercioUsers = new Map(comercioIds.map((id) => [id, new Set()]));
  (data || []).forEach((row) => {
    const comercioId = toNumber(row?.idcomercio);
    const userId = String(row?.idusuario || '').trim();
    if (!comercioId || !userId) return;
    if (!byComercioUsers.has(comercioId)) {
      byComercioUsers.set(comercioId, new Set());
    }
    byComercioUsers.get(comercioId).add(userId);
  });

  const counter = new Map(comercioIds.map((id) => [id, 0]));
  byComercioUsers.forEach((usersSet, comercioId) => {
    counter.set(comercioId, usersSet.size);
  });
  likesCountByComercio = counter;
}

async function loadComerciosForPublicaciones(comercioIds = []) {
  comercioById = new Map();
  if (!comercioIds.length) return;

  const attempts = [
    'id,nombre,logo,municipio,idArea,idMunicipio,latitud,longitud,categoria',
    'id,nombre,logo,municipio,idArea,idMunicipio,latitud,longitud',
    'id,nombre,logo,municipio',
  ];

  for (const columns of attempts) {
    const { data, error } = await supabase
      .from('Comercios')
      .select(columns)
      .in('id', comercioIds);

    if (error) {
      continue;
    }

    (data || []).forEach((row) => {
      const id = toNumber(row?.id);
      if (!id) return;
      comercioById.set(id, {
        ...row,
        idArea: toNumber(row?.idArea),
        idMunicipio: toNumber(row?.idMunicipio),
        latitud: Number(row?.latitud),
        longitud: Number(row?.longitud),
      });
    });
    break;
  }
}

async function loadPublicaciones() {
  setStatus('Cargando publicaciones...');

  const nowIso = new Date().toISOString();
  let data = null;
  let error = null;

  const attempts = [
    'id,idcomercio,titulo,texto,media_path,media_tipo,media_has_audio,created_at,expira_en,clip_start_sec,clip_end_sec',
    'id,idcomercio,titulo,texto,media_path,media_tipo,created_at,expira_en,clip_start_sec,clip_end_sec',
    'id,idcomercio,titulo,texto,media_path,media_tipo,created_at,expira_en',
    'id,idcomercio,texto,media_path,media_tipo,created_at,expira_en',
  ];

  for (const selectColumns of attempts) {
    const response = await supabase
      .from('publicaciones_hoy')
      .select(selectColumns)
      .gt('expira_en', nowIso)
      .order('created_at', { ascending: false })
      .limit(120);

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
      && !msg.includes('media_has_audio')
      && !msg.includes('titulo')
    ) {
      break;
    }
  }

  if (error) {
    console.error('Error cargando publicaciones de hoy:', error);
    const message = String(error.message || '').toLowerCase().includes('publicaciones_hoy')
      ? 'Falta configurar la tabla de publicaciones. Aplica la migración en Supabase para activar Lo de Hoy.'
      : 'No se pudieron cargar las publicaciones. Intenta de nuevo.';
    setStatus(message, { error: true });
    setEmptyVisible(false);
    return;
  }

  publicaciones = data || [];

  await loadGeoCatalogs();
  const comercioIds = [...new Set(publicaciones.map((row) => toNumber(row.idcomercio)).filter(Boolean))];
  await Promise.all([
    loadComerciosForPublicaciones(comercioIds),
    loadCategoriasPorComercio(comercioIds),
    loadLikesCountByComercios(comercioIds),
    loadLikesVisualForComercios(comercioIds),
  ]);
  syncCategoryFallbackFromComercios();

  applyInitialScopeFromQuery();
  refreshFiltersUI();
  await applyFiltersAndRender();
}

function openShareSheet(postId) {
  sharePostId = toNumber(postId);
  if (!sharePostId || !shareSheet) return;

  shareSheet.classList.remove('hidden');
  shareSheet.classList.add('flex');
}

function closeShareSheet() {
  if (!shareSheet) return;
  shareSheet.classList.add('hidden');
  shareSheet.classList.remove('flex');
  sharePostId = null;
}

function getSharePayload(postId) {
  const id = toNumber(postId);
  const post = publicaciones.find((item) => toNumber(item.id) === id);
  if (!post) return null;

  const comercioId = toNumber(post.idcomercio);
  const comercio = comercioById.get(comercioId) || {};
  const comercioNombre = String(comercio.nombre || 'Comercio');
  const titulo = String(post.titulo || '').trim();
  const resumen = String(post.texto || titulo || '').trim();
  const resumenCorto = resumen.length > 120 ? `${resumen.slice(0, 117)}...` : resumen;
  const postUrl = getPostUrl(post.id);
  const profileUrl = getProfileUrl(comercioId);

  const text = resumenCorto
    ? `${comercioNombre}: ${resumenCorto}`
    : `${comercioNombre} en Lo de Hoy`;

  return {
    postUrl,
    profileUrl,
    text,
    fullText: `${text}\n${postUrl}\nPerfil: ${profileUrl}`,
  };
}

async function handleShare(channel) {
  const payload = getSharePayload(sharePostId);
  if (!payload) return;

  if (channel === 'whatsapp') {
    const url = `https://wa.me/?text=${encodeURIComponent(payload.fullText)}`;
    window.open(url, '_blank', 'noopener');
    closeShareSheet();
    return;
  }

  if (channel === 'facebook') {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.postUrl)}`;
    window.open(url, '_blank', 'noopener');
    closeShareSheet();
    return;
  }

  if (channel === 'sms') {
    const url = `sms:?&body=${encodeURIComponent(payload.fullText)}`;
    window.location.href = url;
    closeShareSheet();
    return;
  }

  if (channel === 'copy') {
    try {
      await navigator.clipboard.writeText(payload.postUrl);
      alert('URL copiada al portapapeles.');
    } catch (_error) {
      window.prompt('Copia este enlace:', payload.postUrl);
    }
    closeShareSheet();
  }
}

function toggleGlobalAudio() {
  audioEnabled = !audioEnabled;
  saveAudioPreference();
  updateAudioButtons();
  applyAudioStateToVisibleVideos();
}

async function toggleLikeVisual(comercioId) {
  const id = toNumber(comercioId);
  if (!id) return;

  if (!currentUser) {
    try {
      const user = await requireAuth('likeCommerceInLoDeHoy');
      if (!user?.id) return;
      currentUser = user;
      await loadUserAndFavorites();
      const activeComercioIds = [...new Set(publicaciones.map((row) => toNumber(row.idcomercio)).filter(Boolean))];
      await loadLikesVisualForComercios(activeComercioIds);
    } catch {
      return;
    }
  }

  const alreadyLiked = likesVisualSet.has(id);

  if (alreadyLiked) {
    const { error } = await supabase
      .from(LODEHOY_LIKES_TABLE)
      .delete()
      .eq('idusuario', currentUser.id)
      .eq('idcomercio', id);

    if (error) {
      if (error.code !== '42P01') {
        console.error('Error removiendo Me Gusta de Lo de Hoy:', error.message || error);
      }
      return;
    }

    likesVisualSet.delete(id);
    updateLikeVisualButtonsForComercio(id);
    likesCountByComercio.set(id, Math.max(0, getComercioLikeCount(id) - 1));
    await applyFiltersAndRender();
    return;
  }

  const { error } = await supabase
    .from(LODEHOY_LIKES_TABLE)
    .insert([{ idusuario: currentUser.id, idcomercio: id }]);

  if (error) {
    if (error.code === '23505') {
      likesVisualSet.add(id);
      updateLikeVisualButtonsForComercio(id);
      const activeComercioIds = [...new Set(publicaciones.map((row) => toNumber(row.idcomercio)).filter(Boolean))];
      await loadLikesCountByComercios(activeComercioIds);
      await applyFiltersAndRender();
      return;
    }
    if (error.code !== '42P01') {
      console.error('Error guardando Me Gusta de Lo de Hoy:', error.message || error);
    }
    return;
  }

  likesVisualSet.add(id);
  updateLikeVisualButtonsForComercio(id);
  likesCountByComercio.set(id, getComercioLikeCount(id) + 1);
  await applyFiltersAndRender();
}

async function toggleFavorite(comercioId) {
  const id = toNumber(comercioId);
  if (!id) return;

  if (!currentUser) {
    try {
      const user = await requireAuth('favoriteCommerce');
      if (!user?.id) return;
      currentUser = user;
      await loadUserAndFavorites();
    } catch {
      return;
    }
  }

  const alreadyLiked = favoritosSet.has(id);

  if (alreadyLiked) {
    const { error } = await supabase
      .from('favoritosusuarios')
      .delete()
      .eq('idusuario', currentUser.id)
      .eq('idcomercio', id);

    if (error) {
      console.error('Error removiendo favorito:', error.message || error);
      return;
    }

    favoritosSet.delete(id);
    updateFavoriteButtonsForComercio(id);
    return;
  }

  const { error } = await supabase
    .from('favoritosusuarios')
    .insert([{ idusuario: currentUser.id, idcomercio: id }]);

  if (error) {
    console.error('Error guardando favorito:', error.message || error);
    return;
  }

  favoritosSet.add(id);
  updateFavoriteButtonsForComercio(id);
}

function bindEvents() {
  listaPublicaciones?.addEventListener('click', async (event) => {
    const mediaTarget = event.target.closest('[data-action="open-media"][data-post-id]');
    if (mediaTarget) {
      event.preventDefault();
      openMediaViewer(mediaTarget.getAttribute('data-post-id'));
      return;
    }

    const target = event.target.closest('button[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    if (action === 'share') {
      openShareSheet(target.getAttribute('data-post-id'));
      return;
    }

    if (action === 'toggle-audio') {
      toggleGlobalAudio();
      return;
    }

    if (action === 'like-visual') {
      toggleLikeVisual(target.getAttribute('data-comercio-id'));
      return;
    }

    if (action === 'favorite') {
      await toggleFavorite(target.getAttribute('data-comercio-id'));
    }
  });

  shareSheetCerrar?.addEventListener('click', closeShareSheet);

  mediaViewerClose?.addEventListener('click', closeMediaViewer);

  mediaViewer?.addEventListener('click', (event) => {
    if (event.target === mediaViewer) {
      closeMediaViewer();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mediaViewerOpen) {
      closeMediaViewer();
    }
  });

  let syncPlaybackRaf = 0;
  const schedulePlaybackSync = () => {
    if (syncPlaybackRaf) return;
    syncPlaybackRaf = window.requestAnimationFrame(() => {
      syncPlaybackRaf = 0;
      syncViewportVideoPlayback();
    });
  };

  window.addEventListener('scroll', schedulePlaybackSync, { passive: true });
  window.addEventListener('resize', schedulePlaybackSync, { passive: true });
  window.addEventListener('orientationchange', schedulePlaybackSync);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseAllFeedVideos();
      return;
    }
    schedulePlaybackSync();
  });

  shareSheet?.addEventListener('click', (event) => {
    if (event.target === shareSheet) {
      closeShareSheet();
      return;
    }

    const button = event.target.closest('button[data-share-channel]');
    if (!button) return;

    const channel = button.getAttribute('data-share-channel');
    void handleShare(channel);
  });

  filtroUbicacion?.addEventListener('change', async (event) => {
    const value = String(event.target?.value || '').trim().toLowerCase();
    if (!value) return;

    if (value === 'placeholder:localidad') {
      ubicacionInteracted = false;
      filterState.scopeValue = '';
      await applyFiltersAndRender();
      return;
    }

    if (value.startsWith('mode:')) {
      const mode = value === 'mode:municipio' ? 'municipio' : 'area';
      filterState.scopeType = mode;
      filterState.scopeValue = '';
      ubicacionInteracted = true;
      refreshUbicacionOptions();
      await applyFiltersAndRender();
      return;
    }

    const parsed = parseScopeOptionValue(value);
    if (!parsed) return;
    filterState.scopeType = parsed.scopeType;
    filterState.scopeValue = parsed.scopeValue;
    ubicacionInteracted = true;
    await applyFiltersAndRender();
  });

  filtroCategoria?.addEventListener('change', async (event) => {
    const value = String(event.target?.value || '');
    filterState.categoriaId = value === '__all__' ? '' : value;
    if (value === '__all__' && filtroCategoria) {
      filtroCategoria.value = '__all__';
    }
    await applyFiltersAndRender();
  });

  filtroOrden?.addEventListener('change', async (event) => {
    const value = String(event.target?.value || '').trim().toLowerCase();
    filterState.orden = ['recientes', 'antiguos', 'cercania'].includes(value) ? value : '';
    await applyFiltersAndRender();
  });
}

async function init() {
  audioEnabled = readAudioPreference();
  filterState.scopeType = 'area';
  const ordenInicial = String(filtroOrden?.value ?? '').toLowerCase().trim();
  filterState.orden = ['recientes', 'antiguos', 'cercania'].includes(ordenInicial) ? ordenInicial : '';
  filterState.scopeValue = '';
  filterState.categoriaId = '';
  ubicacionInteracted = false;
  registerAutoplayUnlockHandlers();
  bindEvents();
  await loadUserAndFavorites();
  await loadPublicaciones();
}

void init();
