import { supabase } from './supabaseClient.js';

const SESSION_KEY = 'findixi_analytics_session_id';
const recentEvents = new Map();

function normalizeSource(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'web';
  if (raw === 'app') return 'app';
  if (raw === 'web') return 'web';
  if (raw === 'qr' || raw === 'mesa' || raw === 'table' || raw === 'qr_table') return 'qr_table';
  return 'unknown';
}

function getOrCreateSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const generated = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch (_) {
    return `web_${Date.now().toString(36)}_memory`;
  }
}

function shouldSkipByDedupe(key, dedupeMs) {
  const ttl = Number(dedupeMs);
  if (!key || !Number.isFinite(ttl) || ttl <= 0) return false;
  const now = Date.now();
  const last = recentEvents.get(key) || 0;
  if (now - last < ttl) return true;
  recentEvents.set(key, now);
  return false;
}

export async function trackAnalyticsEvent({
  idComercio,
  eventName,
  source = 'web',
  municipio = null,
  edadRango = null,
  genero = null,
  itemId = null,
  orderId = null,
  metadata = {},
  dedupeKey = '',
  dedupeMs = 0,
} = {}) {
  const comercioId = Number(idComercio);
  if (!Number.isFinite(comercioId) || comercioId <= 0) return;
  const normalizedEvent = String(eventName || '').trim().toLowerCase();
  if (!normalizedEvent) return;
  if (shouldSkipByDedupe(dedupeKey, dedupeMs)) return;

  try {
    const payload = {
      p_id_comercio: comercioId,
      p_event_name: normalizedEvent,
      p_source: normalizeSource(source),
      p_session_id: getOrCreateSessionId(),
      p_item_id: Number.isFinite(Number(itemId)) ? Number(itemId) : null,
      p_order_id: Number.isFinite(Number(orderId)) ? Number(orderId) : null,
      p_municipio: municipio ? String(municipio).trim() : null,
      p_edad_rango: edadRango ? String(edadRango).trim() : null,
      p_genero: genero ? String(genero).trim() : null,
      p_device_type: 'web',
      p_meta: metadata && typeof metadata === 'object' ? metadata : {},
    };

    const { error } = await supabase.rpc('analytics_track_event', payload);
    if (error) {
      console.warn('[analyticsTracker] No se pudo registrar evento:', normalizedEvent, error.message || error);
    }
  } catch (error) {
    console.warn('[analyticsTracker] Error registrando evento:', normalizedEvent, error?.message || error);
  }
}

export function bindTrackedAnchor(anchorEl, {
  idComercio,
  eventName,
  source = 'web',
  municipio = null,
  metadata = {},
  dedupeKey = '',
  dedupeMs = 0,
  navigateAfterTrack = false,
  navigationDelayMs = 180,
} = {}) {
  if (!anchorEl || anchorEl.dataset.analyticsBound === '1') return;
  anchorEl.dataset.analyticsBound = '1';

  anchorEl.addEventListener('click', (event) => {
    const href = anchorEl.getAttribute('href') || '';
    const target = String(anchorEl.getAttribute('target') || '').toLowerCase();
    const shouldDelayNavigation = Boolean(navigateAfterTrack && href && href !== '#');

    if (shouldDelayNavigation) {
      event.preventDefault();
    }

    const trackPromise = trackAnalyticsEvent({
      idComercio,
      eventName,
      source,
      municipio,
      metadata,
      dedupeKey,
      dedupeMs,
    });

    if (!shouldDelayNavigation) return;

    const openTrackedHref = () => {
      if (!href || href === '#') return;
      if (target === '_blank') {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      window.location.href = href;
    };

    Promise.resolve(trackPromise)
      .catch(() => {})
      .finally(() => {
        window.setTimeout(openTrackedHref, Math.max(0, Number(navigationDelayMs) || 0));
      });
  });
}
