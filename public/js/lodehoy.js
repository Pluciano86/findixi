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

let currentUser = null;
let favoritosSet = new Set();
let likesVisualSet = new Set();
let publicaciones = [];
let comercioById = new Map();
let sharePostId = null;
let highlightedFromQuery = false;
let audioEnabled = true;
let videoObserver = null;
let autoplayUnlocked = false;

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
        ? 'fa-solid fa-heart text-2xl text-[#EC7F25]'
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

function retryVisibleVideosPlayback() {
  const videos = document.querySelectorAll('video[data-lodehoy-video="1"]');
  videos.forEach((video) => {
    if (isElementAtLeastHalfVisible(video)) {
      void playManagedVideo(video);
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

  const videos = Array.from(document.querySelectorAll('video[data-lodehoy-video="1"]'));
  if (!videos.length) return;

  videoObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
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
  const videos = document.querySelectorAll('video[data-lodehoy-video="1"]');
  videos.forEach((video) => {
    const isNoAudio = video.dataset.hasAudio === '0';
    video.muted = isNoAudio ? true : !audioEnabled;
    video.defaultMuted = isNoAudio ? true : !audioEnabled;
    if (!video.paused) {
      void playManagedVideo(video);
    }
  });
}

function getProfileUrl(comercioId) {
  const id = toNumber(comercioId);
  return `${window.location.origin}${APP_PREFIX}/perfilComercio.html?id=${id}`;
}

function getPostUrl(postId) {
  const id = toNumber(postId);
  return `${window.location.origin}${APP_PREFIX}/lodehoy.html?post=${id}`;
}

function renderPublicaciones() {
  if (!listaPublicaciones) return;

  if (!publicaciones.length) {
    listaPublicaciones.innerHTML = '';
    setEmptyVisible(true);
    if (videoObserver) {
      videoObserver.disconnect();
      videoObserver = null;
    }
    return;
  }

  setEmptyVisible(false);

  const html = publicaciones.map((post) => {
    const comercioId = toNumber(post.idcomercio);
    const comercio = comercioById.get(comercioId) || {};
    const nombreComercio = escapeHtml(comercio.nombre || 'Comercio');
    const municipio = comercio.municipio ? escapeHtml(comercio.municipio) : '';
    const texto = String(post.texto || '').trim();
    const textoSeguro = escapeHtml(texto);
    const logoUrl = getComercioLogoUrl(comercio.logo);
    const mediaUrl = buildStoragePublicUrl(post.media_path);
    const horaPublicada = formatHoraPR(post.created_at);
    const logoUrlSafe = escapeHtml(logoUrl);
    const mediaUrlSafe = escapeHtml(mediaUrl);
    const clipStart = Number.isFinite(Number(post.clip_start_sec)) ? Number(post.clip_start_sec) : 0;
    const clipEnd = Number.isFinite(Number(post.clip_end_sec)) ? Number(post.clip_end_sec) : '';
    const hasAudioAttr = post.media_has_audio === true
      ? '1'
      : (post.media_has_audio === false && !IS_IOS_DEVICE ? '0' : 'unknown');
    const iconLikeVisual = escapeHtml(isLikeVisualOn(comercioId) ? LIKE_ON_ICON_URL : LIKE_OFF_ICON_URL);
    const favoriteClass = isFavorite(comercioId)
      ? 'fa-solid fa-heart text-2xl text-[#EC7F25]'
      : 'fa-regular fa-heart text-2xl text-[#1f2937]';

    const mediaNode = post.media_tipo === 'video'
      ? `<video class="lodehoy-media-content" src="${mediaUrlSafe}" controls playsinline preload="metadata" data-lodehoy-video="1" data-post-id="${post.id}" data-has-audio="${hasAudioAttr}" data-clip-start="${clipStart}" data-clip-end="${clipEnd}"></video>`
      : `<img class="lodehoy-media-content" src="${mediaUrlSafe}" alt="Publicación de ${nombreComercio}" loading="lazy">`;

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
          <img src="${logoUrlSafe}" alt="${nombreComercio}" class="w-11 h-11 rounded-full object-cover border border-gray-200">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">${nombreComercio}</p>
            <p class="text-xs text-gray-500 truncate">${municipio || 'Puerto Rico'}</p>
          </div>
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

        <div class="lodehoy-media-frame bg-gray-100 flex items-center justify-center overflow-hidden relative">
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
        <div class="px-3 py-2 border-t border-gray-100">
          <p class="text-sm text-gray-500 text-center">
            <span class="font-semibold">Publicado:</span> ${escapeHtml(horaPublicada || '—')}
          </p>
        </div>
        ${textoSeguro ? `
          <div class="px-3 pb-3">
            <p class="text-sm text-gray-700 line-clamp-3 font-medium">${textoSeguro}</p>
          </div>
        ` : ''}
      </article>
    `;
  }).join('');

  listaPublicaciones.innerHTML = html;
  updateAudioButtons();
  setupVideoObserver();
  const videos = document.querySelectorAll('video[data-lodehoy-video="1"]');
  videos.forEach((video) => {
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

  const { data: likesData, error: likesErr } = await supabase
    .from(LODEHOY_LIKES_TABLE)
    .select('idcomercio')
    .eq('idusuario', currentUser.id);

  if (likesErr) {
    if (likesErr.code !== '42P01') {
      console.warn('No se pudieron cargar Me Gusta de Lo de Hoy:', likesErr.message || likesErr);
    }
    likesVisualSet = new Set();
    return;
  }

  likesVisualSet = new Set((likesData || []).map((row) => toNumber(row.idcomercio)).filter(Boolean));
}

async function loadPublicaciones() {
  setStatus('Cargando publicaciones...');

  const nowIso = new Date().toISOString();
  let data = null;
  let error = null;

  const withClip = await supabase
    .from('publicaciones_hoy')
    .select('id,idcomercio,texto,media_path,media_tipo,media_has_audio,created_at,expira_en,clip_start_sec,clip_end_sec')
    .gt('expira_en', nowIso)
    .order('created_at', { ascending: false })
    .limit(120);

  if (!withClip.error) {
    data = withClip.data;
  } else {
    const msg = String(withClip.error.message || '').toLowerCase();
    if (msg.includes('clip_start_sec') || msg.includes('clip_end_sec') || msg.includes('media_has_audio')) {
      const fallback = await supabase
        .from('publicaciones_hoy')
        .select('id,idcomercio,texto,media_path,media_tipo,created_at,expira_en')
        .gt('expira_en', nowIso)
        .order('created_at', { ascending: false })
        .limit(120);
      data = fallback.data;
      error = fallback.error;
    } else {
      error = withClip.error;
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

  const comercioIds = [...new Set(publicaciones.map((row) => toNumber(row.idcomercio)).filter(Boolean))];
  comercioById = new Map();

  if (comercioIds.length) {
    const { data: comercios, error: comercioError } = await supabase
      .from('Comercios')
      .select('id,nombre,logo,municipio')
      .in('id', comercioIds);

    if (comercioError) {
      console.warn('No se pudieron cargar comercios para Lo de Hoy:', comercioError.message || comercioError);
    } else {
      (comercios || []).forEach((comercio) => {
        const id = toNumber(comercio.id);
        if (!id) return;
        comercioById.set(id, comercio);
      });
    }
  }

  hideStatus();
  renderPublicaciones();
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
  const resumen = String(post.texto || '').trim();
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
    return;
  }

  const { error } = await supabase
    .from(LODEHOY_LIKES_TABLE)
    .insert([{ idusuario: currentUser.id, idcomercio: id }]);

  if (error) {
    if (error.code === '23505') {
      likesVisualSet.add(id);
      updateLikeVisualButtonsForComercio(id);
      return;
    }
    if (error.code !== '42P01') {
      console.error('Error guardando Me Gusta de Lo de Hoy:', error.message || error);
    }
    return;
  }

  likesVisualSet.add(id);
  updateLikeVisualButtonsForComercio(id);
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
}

async function init() {
  audioEnabled = readAudioPreference();
  registerAutoplayUnlockHandlers();
  bindEvents();
  await loadUserAndFavorites();
  await loadPublicaciones();
}

void init();
