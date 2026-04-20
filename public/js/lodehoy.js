import { supabase } from '../shared/supabaseClient.js';
import { requireAuth } from './authGuard.js';

const PUBLIC_BUCKET_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios';
const DEFAULT_LOGO = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png';
const HOST = String(window.location.hostname || '').toLowerCase();
const IS_LOCAL = HOST === 'localhost' || HOST === '127.0.0.1' || HOST === '::1';
const APP_PREFIX = IS_LOCAL ? '/public' : '';

const estadoCarga = document.getElementById('estadoCarga');
const estadoVacio = document.getElementById('estadoVacio');
const listaPublicaciones = document.getElementById('listaPublicaciones');
const shareSheet = document.getElementById('shareSheet');
const shareSheetCerrar = document.getElementById('shareSheetCerrar');

let currentUser = null;
let favoritosSet = new Set();
let publicaciones = [];
let comercioById = new Map();
let sharePostId = null;
let highlightedFromQuery = false;

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

function formatFechaPR(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('es-PR', {
    dateStyle: 'medium',
    timeStyle: 'short',
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

function getLikeButtonLabel(comercioId) {
  return isFavorite(comercioId) ? 'Te gusta' : 'Me gusta';
}

function getLikeButtonClass(comercioId) {
  return isFavorite(comercioId)
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-gray-100 text-gray-700 border-gray-200';
}

function updateLikeButtonsForComercio(comercioId) {
  const id = toNumber(comercioId);
  if (!id) return;

  const buttons = document.querySelectorAll(`[data-action="like"][data-comercio-id="${id}"]`);
  buttons.forEach((button) => {
    const icon = button.querySelector('i');
    const text = button.querySelector('span');
    if (icon) {
      icon.className = isFavorite(id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    }
    if (text) {
      text.textContent = getLikeButtonLabel(id);
    }
    button.className = `w-full border rounded-lg py-2 text-sm font-medium transition ${getLikeButtonClass(id)}`;
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
    const fecha = formatFechaPR(post.created_at);
    const logoUrlSafe = escapeHtml(logoUrl);
    const mediaUrlSafe = escapeHtml(mediaUrl);

    const mediaNode = post.media_tipo === 'video'
      ? `<video class="lodehoy-media-content" src="${mediaUrlSafe}" controls playsinline preload="metadata"></video>`
      : `<img class="lodehoy-media-content" src="${mediaUrlSafe}" alt="Publicación de ${nombreComercio}" loading="lazy">`;

    return `
      <article id="post-${post.id}" class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <header class="px-3 py-3 flex items-center gap-3">
          <img src="${logoUrlSafe}" alt="${nombreComercio}" class="w-11 h-11 rounded-full object-cover border border-gray-200">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">${nombreComercio}</p>
            <p class="text-xs text-gray-500 truncate">${municipio || 'Puerto Rico'}</p>
          </div>
          <span class="ml-auto text-[11px] text-gray-500 whitespace-nowrap">${escapeHtml(fecha)}</span>
        </header>

        <div class="lodehoy-media-frame bg-gray-100 flex items-center justify-center overflow-hidden">
          ${mediaNode}
        </div>
        ${textoSeguro ? `
          <div class="px-3 py-2 border-t border-gray-100">
            <p class="text-sm text-gray-700 line-clamp-3">${textoSeguro}</p>
          </div>
        ` : ''}

        <div class="p-3 grid grid-cols-2 gap-2">
          <button type="button" data-action="share" data-post-id="${post.id}" class="w-full border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <i class="fa-solid fa-share-nodes mr-1"></i> Share
          </button>
          <button type="button" data-action="like" data-comercio-id="${comercioId}" class="w-full border rounded-lg py-2 text-sm font-medium transition ${getLikeButtonClass(comercioId)}">
            <i class="${isFavorite(comercioId) ? 'fa-solid' : 'fa-regular'} fa-heart mr-1"></i>
            <span>${getLikeButtonLabel(comercioId)}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');

  listaPublicaciones.innerHTML = html;
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
    return;
  }

  currentUser = data?.user || null;
  if (!currentUser) {
    favoritosSet = new Set();
    return;
  }

  const { data: favs, error: favErr } = await supabase
    .from('favoritosusuarios')
    .select('idcomercio')
    .eq('idusuario', currentUser.id);

  if (favErr) {
    console.warn('No se pudo cargar favoritos:', favErr.message || favErr);
    favoritosSet = new Set();
    return;
  }

  favoritosSet = new Set((favs || []).map((row) => toNumber(row.idcomercio)).filter(Boolean));
}

async function loadPublicaciones() {
  setStatus('Cargando publicaciones...');

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('publicaciones_hoy')
    .select('id,idcomercio,texto,media_path,media_tipo,created_at,expira_en')
    .gt('expira_en', nowIso)
    .order('created_at', { ascending: false })
    .limit(120);

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

async function toggleLike(comercioId) {
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
    updateLikeButtonsForComercio(id);
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
  updateLikeButtonsForComercio(id);
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

    if (action === 'like') {
      await toggleLike(target.getAttribute('data-comercio-id'));
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
  bindEvents();
  await loadUserAndFavorites();
  await loadPublicaciones();
}

void init();
