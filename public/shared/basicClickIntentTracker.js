import { supabase } from './supabaseClient.js';

const SESSION_KEY = 'findixi_public_session_id';
const RECENT_EVENT_WINDOW_MS = 5000;
const recentEvents = new Map();
let cachedUserIdPromise = null;

function getOrCreatePublicSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const generated = `pub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch (_) {
    return `pub_${Date.now().toString(36)}_memory`;
  }
}

function getMunicipioUsuario() {
  const stored = localStorage.getItem('municipioUsuario');
  if (stored && stored.trim()) return stored.trim();

  const select =
    document.getElementById('filtro-municipio') ||
    document.getElementById('filtroMunicipio') ||
    document.querySelector('select[name="municipio"]');

  if (!select || !(select instanceof HTMLSelectElement)) return null;
  const label = select.options?.[select.selectedIndex]?.text?.trim();
  if (!label || /^municipio/i.test(label)) return null;
  return label;
}

function detectIntentSource() {
  const urlSearch = new URLSearchParams(window.location.search);
  if (urlSearch.get('q') || urlSearch.get('search')) return 'busqueda';

  const inputIds = [
    'filtro-nombre',
    'busquedaNombre',
    'buscar-comercio',
    'buscarComercio',
    'search',
  ];

  for (const id of inputIds) {
    const input = document.getElementById(id);
    if (input && 'value' in input && String(input.value || '').trim()) {
      return 'busqueda';
    }
  }

  const genericSearchInput = document.querySelector('input[type="search"]');
  if (genericSearchInput && String(genericSearchInput.value || '').trim()) {
    return 'busqueda';
  }

  return 'listado';
}

async function getCurrentUserId() {
  if (!cachedUserIdPromise) {
    cachedUserIdPromise = supabase.auth
      .getUser()
      .then(({ data }) => data?.user?.id || null)
      .catch(() => null);
  }
  return cachedUserIdPromise;
}

export async function registrarBasicClickIntent({
  idComercio,
  fuente = null,
  metadata = {},
} = {}) {
  const comercioId = Number(idComercio);
  if (!Number.isFinite(comercioId) || comercioId <= 0) return;

  const finalFuente = fuente === 'busqueda' ? 'busqueda' : fuente === 'listado' ? 'listado' : detectIntentSource();
  const dedupeKey = `${comercioId}:${finalFuente}`;
  const now = Date.now();
  const last = recentEvents.get(dedupeKey) || 0;
  if (now - last < RECENT_EVENT_WINDOW_MS) return;
  recentEvents.set(dedupeKey, now);

  const payload = {
    idComercio: comercioId,
    evento: 'basic_click_intent',
    fuente: finalFuente,
    municipio_usuario: getMunicipioUsuario(),
    session_id: getOrCreatePublicSessionId(),
    metadata: {
      path: window.location.pathname,
      ...metadata,
    },
  };

  const userId = await getCurrentUserId();
  if (userId) payload.user_id = userId;

  const { error } = await supabase.from('basic_click_intents').insert(payload);
  if (error) {
    console.warn('No se pudo registrar basic_click_intent:', error.message || error);
  }
}
