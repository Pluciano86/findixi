import { supabase } from '../shared/supabaseClient.js';
import { t } from './i18n.js';

const PUBLIC_BUCKET_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios';
const DEFAULT_LOGO = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png';
const APP_PREFIX = ['localhost', '127.0.0.1', '::1'].includes(String(window.location.hostname || '').toLowerCase()) ? '/public' : '';
const USER_AGENT = String(window.navigator?.userAgent || '').toLowerCase();
const IS_IOS_DEVICE = /iphone|ipad|ipod/.test(USER_AGENT)
  || (String(window.navigator?.platform || '').toLowerCase() === 'macintel' && Number(window.navigator?.maxTouchPoints || 0) > 1);
const MAX_RENDER = 10;
const TOP_POOL = 40;
const FETCH_LIMIT = 120;
const MAX_PER_COMERCIO = 2;
const IS_LISTADO_AREA_PAGE = String(window.location.pathname || '').toLowerCase().includes('listadoarea');

const section = document.getElementById('lodehoyTeaserSection');
const statusEl = document.getElementById('lodehoyTeaserStatus');
const listEl = document.getElementById('lodehoyTeaserList');
const teaserBtnEl = document.getElementById('lodehoyTeaserBtn');

let loaded = false;
let loadingPromise = null;
let lastFiltersKey = '';
let teaserVideoObserver = null;
let teaserAutoplayUnlocked = !IS_IOS_DEVICE;
let teaserUnlockHandlersBound = false;
let teaserPlaybackEventsBound = false;
let teaserListScrollBound = false;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFilterId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readAreaFilters() {
  if (!IS_LISTADO_AREA_PAGE) {
    return { idArea: null, idMunicipio: null };
  }

  const globalFilters = window.filtrosArea || {};
  const fromGlobalMunicipio = normalizeFilterId(globalFilters.idMunicipio);
  const fromGlobalArea = normalizeFilterId(globalFilters.idArea);

  if (fromGlobalMunicipio || fromGlobalArea) {
    return {
      idArea: fromGlobalArea,
      idMunicipio: fromGlobalMunicipio,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    idArea: normalizeFilterId(params.get('idArea')),
    idMunicipio: normalizeFilterId(params.get('idMunicipio')),
  };
}

function buildFiltersKey(filters = {}) {
  const idArea = normalizeFilterId(filters.idArea) || 0;
  const idMunicipio = normalizeFilterId(filters.idMunicipio) || 0;
  return `a:${idArea}|m:${idMunicipio}`;
}

function buildLoDeHoyHref(filters = {}) {
  const idArea = normalizeFilterId(filters.idArea);
  const idMunicipio = normalizeFilterId(filters.idMunicipio);
  const params = new URLSearchParams();
  if (idMunicipio) {
    params.set('idMunicipio', String(idMunicipio));
  } else if (idArea) {
    params.set('idArea', String(idArea));
  }
  const query = params.toString();
  return `${APP_PREFIX}/lodehoy.html${query ? `?${query}` : ''}`;
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

function shuffle(list = []) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function setStatus(message = '') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.toggle('hidden', !message);
}

function getTeaserVideos() {
  if (!listEl) return [];
  return Array.from(listEl.querySelectorAll('video[data-teaser-video="1"]'));
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

function pauseTeaserVideo(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  video.pause();
}

async function playTeaserVideo(video) {
  if (!(video instanceof HTMLVideoElement)) return;
  if (IS_IOS_DEVICE && !teaserAutoplayUnlocked) return;
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('loop', '');
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  try {
    await video.play();
  } catch (_error) {}
}

function syncTeaserVideoPlayback() {
  getTeaserVideos().forEach((video) => {
    if (isElementAtLeastHalfVisible(video)) {
      void playTeaserVideo(video);
    } else {
      pauseTeaserVideo(video);
    }
  });
}

function setupTeaserVideoObserver() {
  if (teaserVideoObserver) {
    teaserVideoObserver.disconnect();
    teaserVideoObserver = null;
  }

  const videos = getTeaserVideos();
  if (!videos.length) return;

  if ('IntersectionObserver' in window) {
    teaserVideoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;
        if (entry.intersectionRatio >= 0.5) {
          void playTeaserVideo(video);
        } else {
          pauseTeaserVideo(video);
        }
      });
    }, {
      threshold: [0, 0.5, 1],
    });
    videos.forEach((video) => teaserVideoObserver.observe(video));
  }

  syncTeaserVideoPlayback();
}

function registerTeaserAutoplayUnlockHandlers() {
  if (!IS_IOS_DEVICE || teaserUnlockHandlersBound) return;
  teaserUnlockHandlersBound = true;

  const unlock = () => {
    teaserAutoplayUnlocked = true;
    syncTeaserVideoPlayback();
  };

  document.addEventListener('touchstart', unlock, { once: true, passive: true });
  document.addEventListener('scroll', unlock, { once: true, passive: true });
  document.addEventListener('pointerdown', unlock, { once: true, passive: true });

  if (window.scrollY > 0 || window.pageYOffset > 0) {
    unlock();
  }
}

function bindTeaserPlaybackEvents() {
  if (teaserPlaybackEventsBound) return;
  teaserPlaybackEventsBound = true;

  window.addEventListener('scroll', syncTeaserVideoPlayback, { passive: true });
  window.addEventListener('resize', syncTeaserVideoPlayback);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      getTeaserVideos().forEach((video) => pauseTeaserVideo(video));
      return;
    }
    syncTeaserVideoPlayback();
  });

  if (listEl && !teaserListScrollBound) {
    teaserListScrollBound = true;
    listEl.addEventListener('scroll', syncTeaserVideoPlayback, { passive: true });
  }
}

async function loadPostsActivas() {
  const nowIso = new Date().toISOString();
  const attempts = [
    'id,idcomercio,titulo,texto,media_path,media_tipo,created_at,expira_en',
    'id,idcomercio,texto,media_path,media_tipo,created_at,expira_en',
  ];

  for (const columns of attempts) {
    const response = await supabase
      .from('publicaciones_hoy')
      .select(columns)
      .gt('expira_en', nowIso)
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);

    if (!response.error) {
      return response.data || [];
    }

    const msg = String(response.error.message || '').toLowerCase();
    if (!msg.includes('titulo')) {
      throw response.error;
    }
  }
  return [];
}

async function loadComerciosMap(comercioIds = []) {
  const map = new Map();
  if (!comercioIds.length) return map;

  const attempts = [
    'id,nombre,logo,municipio,idArea,idMunicipio',
    'id,nombre,logo,municipio',
    'id,nombre,logo,idArea,idMunicipio',
    'id,nombre,logo',
    'id,nombre,idArea,idMunicipio',
    'id,nombre',
  ];

  for (const columns of attempts) {
    const response = await supabase
      .from('Comercios')
      .select(columns)
      .in('id', comercioIds);

    if (response.error) continue;
    (response.data || []).forEach((row) => {
      const id = toNumber(row?.id);
      if (!id) return;
      map.set(id, {
        ...row,
        _idArea: toNumber(row?.idArea ?? row?.idarea ?? row?.id_area),
        _idMunicipio: toNumber(row?.idMunicipio ?? row?.idmunicipio ?? row?.id_municipio),
      });
    });
    return map;
  }

  return map;
}

async function loadLikesCountMap(comercioIds = []) {
  const counter = new Map(comercioIds.map((id) => [id, 0]));
  if (!comercioIds.length) return counter;

  const response = await supabase
    .from('lodehoy_likes_comercio')
    .select('idcomercio,idusuario')
    .in('idcomercio', comercioIds);

  if (response.error) {
    return counter;
  }

  const usersByComercio = new Map(comercioIds.map((id) => [id, new Set()]));
  (response.data || []).forEach((row) => {
    const comercioId = toNumber(row?.idcomercio);
    const userId = String(row?.idusuario || '').trim();
    if (!comercioId || !userId) return;
    if (!usersByComercio.has(comercioId)) {
      usersByComercio.set(comercioId, new Set());
    }
    usersByComercio.get(comercioId).add(userId);
  });

  usersByComercio.forEach((users, comercioId) => {
    counter.set(comercioId, users.size);
  });
  return counter;
}

function pickRandomTopPosts(posts = []) {
  const sorted = [...posts].sort((a, b) => {
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pool = sorted.slice(0, Math.min(TOP_POOL, sorted.length));
  const randomized = shuffle(pool);
  const selected = [];
  const perComercio = new Map();

  for (const item of randomized) {
    if (selected.length >= MAX_RENDER) break;
    const comercioId = toNumber(item.idcomercio);
    const used = perComercio.get(comercioId) || 0;
    if (used >= MAX_PER_COMERCIO) continue;
    selected.push(item);
    perComercio.set(comercioId, used + 1);
  }

  if (selected.length < Math.min(MAX_RENDER, randomized.length)) {
    for (const item of randomized) {
      if (selected.length >= MAX_RENDER) break;
      if (selected.some((it) => it.id === item.id)) continue;
      selected.push(item);
    }
  }
  return selected;
}

function renderTeaser(posts = []) {
  if (!section || !listEl) return;

  if (!posts.length) {
    listEl.innerHTML = '';
    if (teaserVideoObserver) {
      teaserVideoObserver.disconnect();
      teaserVideoObserver = null;
    }
    section.classList.add('hidden');
    return;
  }

  listEl.innerHTML = posts.map((post) => {
    const comercioId = toNumber(post.idcomercio);
    const mediaUrl = escapeHtml(buildStoragePublicUrl(post.media_path));
    const rawTitle = String(post.titulo || post.texto || '').trim();
    const title = escapeHtml(rawTitle);
    const titleHtml = title || '&nbsp;';
    const hora = escapeHtml(formatHoraPR(post.created_at));
    const comercioNombre = escapeHtml(String(post.comercioNombre || t('home.defaultBusinessName')).trim());
    const logoUrl = escapeHtml(String(post.comercioLogo || DEFAULT_LOGO));
    const href = comercioId
      ? `${window.location.origin}${APP_PREFIX}/perfilComercio.html?id=${comercioId}`
      : `${window.location.origin}${APP_PREFIX}/lodehoy.html`;

    const mediaNode = post.media_tipo === 'video'
      ? `<video class="w-full h-full object-cover" src="${mediaUrl}" autoplay loop muted playsinline webkit-playsinline preload="metadata" data-teaser-video="1"></video>`
      : `<img class="w-full h-full object-cover" src="${mediaUrl}" alt="${title}" loading="lazy">`;

    return `
      <a href="${escapeHtml(href)}" class="min-w-[152px] max-w-[152px] snap-start block">
        <article class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden h-[282px] flex flex-col">
          <div class="aspect-[4/5] bg-gray-100 overflow-hidden relative shrink-0">
            ${mediaNode}
          </div>
          <div class="px-2 py-2 min-h-[86px] flex flex-col justify-between">
            <div class="flex items-center justify-center gap-2 mb-1">
              <img src="${logoUrl}" alt="${comercioNombre}" class="w-5 h-5 rounded-full object-cover border border-gray-200">
              <p class="text-[11px] text-gray-700 truncate text-center">${comercioNombre}</p>
            </div>
            <div class="h-[34px] flex items-center justify-center">
              <p class="w-full text-[12px] font-semibold text-gray-900 text-center leading-tight" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                ${titleHtml}
              </p>
            </div>
            <div class="mt-1 flex items-center justify-center">
              <p class="text-[10px] text-gray-500 text-center">${escapeHtml(t('home.publishedLabel'))}: ${hora || '--'}</p>
            </div>
          </div>
        </article>
      </a>
    `;
  }).join('');

  setupTeaserVideoObserver();
  registerTeaserAutoplayUnlockHandlers();
  bindTeaserPlaybackEvents();
  section.classList.remove('hidden');
}

async function loadTeaser() {
  if (!section || !listEl) return;

  const filters = readAreaFilters();
  const filtersKey = buildFiltersKey(filters);
  if (loaded && filtersKey === lastFiltersKey) return;
  if (loadingPromise) return;

  loaded = true;
  lastFiltersKey = filtersKey;
  setStatus(t('home.loadingLodehoy'));
  if (teaserBtnEl) {
    teaserBtnEl.href = buildLoDeHoyHref(filters);
  }

  loadingPromise = (async () => {
    try {
      const postsRaw = await loadPostsActivas();
      if (!postsRaw.length) {
        renderTeaser([]);
        return;
      }

      const comercioIds = [...new Set(postsRaw.map((row) => toNumber(row.idcomercio)).filter(Boolean))];
      const [comercioMap, likesMap] = await Promise.all([
        loadComerciosMap(comercioIds),
        loadLikesCountMap(comercioIds),
      ]);

      const enriched = postsRaw
        .filter((row) => row?.media_path && row?.media_tipo)
        .map((row) => {
          const comercioId = toNumber(row.idcomercio);
          const comercio = comercioMap.get(comercioId) || {};
          const logoRaw = String(comercio.logo || '').trim();
          const logoUrl = logoRaw ? (logoRaw.startsWith('http') ? logoRaw : buildStoragePublicUrl(logoRaw)) : DEFAULT_LOGO;
          return {
            ...row,
            likeCount: Number(likesMap.get(comercioId) || 0),
            comercioNombre: comercio.nombre || t('home.defaultBusinessName'),
            comercioLogo: logoUrl || DEFAULT_LOGO,
            comercioIdArea: toNumber(comercio._idArea),
            comercioIdMunicipio: toNumber(comercio._idMunicipio),
          };
        });

      const filtered = enriched.filter((row) => {
        const postMunicipio = toNumber(row.comercioIdMunicipio);
        const postArea = toNumber(row.comercioIdArea);
        if (filters.idMunicipio) return postMunicipio === filters.idMunicipio;
        if (filters.idArea) return postArea === filters.idArea;
        return true;
      });

      const selected = pickRandomTopPosts(filtered);
      renderTeaser(selected);
    } catch (error) {
      console.warn('No se pudo cargar teaser de Lo de Hoy:', error?.message || error);
      section.classList.add('hidden');
    } finally {
      setStatus('');
      loadingPromise = null;
    }
  })();

  await loadingPromise;
}

function initTeaser() {
  if (!section || !listEl) return;

  if (teaserBtnEl) {
    teaserBtnEl.href = buildLoDeHoyHref(readAreaFilters());
  }

  if (!('IntersectionObserver' in window)) {
    void loadTeaser();
    return;
  }

  const triggerEl = document.getElementById('categoriasSection') || section;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void loadTeaser();
    });
  }, {
    root: null,
    threshold: 0.12,
    rootMargin: '320px 0px',
  });

  observer.observe(triggerEl);

  if (IS_LISTADO_AREA_PAGE) {
    window.addEventListener('areaCargada', () => {
      void loadTeaser();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTeaser, { once: true });
} else {
  initTeaser();
}
