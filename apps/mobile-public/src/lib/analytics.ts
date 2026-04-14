import { supabase } from './supabase';
import { openExternalUrl } from './external-link';

export type AnalyticsEventName =
  | 'view_profile'
  | 'view_menu'
  | 'view_menu_item'
  | 'scan_qr_table'
  | 'start_order'
  | 'order_completed'
  | 'click_whatsapp'
  | 'click_call'
  | 'click_waze'
  | 'click_google_maps'
  | 'click_facebook'
  | 'click_instagram'
  | 'click_tiktok'
  | 'click_webpage'
  | 'favorite_add'
  | 'favorite_remove';

type AnalyticsSource = 'app' | 'web' | 'qr_table' | 'unknown';

type TrackAnalyticsParams = {
  idComercio: number;
  eventName: AnalyticsEventName;
  source?: string | null;
  sessionId?: string | null;
  itemId?: number | null;
  orderId?: number | null;
  municipio?: string | null;
  edadRango?: string | null;
  genero?: string | null;
  deviceType?: string | null;
  meta?: Record<string, unknown> | null;
};

type OpenTrackedExternalParams = {
  url: string | null | undefined;
  idComercio: number;
  eventName: AnalyticsEventName;
  source?: string | null;
  loggerTag?: string;
  meta?: Record<string, unknown> | null;
};

function normalizeSource(value: string | null | undefined): AnalyticsSource {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'app';
  if (raw === 'app') return 'app';
  if (raw === 'web') return 'web';
  if (raw === 'qr' || raw === 'qr_table' || raw === 'mesa' || raw === 'table') return 'qr_table';
  return 'unknown';
}

function normalizeDeviceType(value: string | null | undefined): string {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw) return raw;
  return 'mobile';
}

export async function trackAnalyticsEvent(params: TrackAnalyticsParams): Promise<void> {
  const idComercio = Number(params.idComercio);
  if (!Number.isFinite(idComercio) || idComercio <= 0) return;

  const eventName = String(params.eventName || '').trim().toLowerCase();
  if (!eventName) return;

  try {
    const { error } = await supabase.rpc('analytics_track_event', {
      p_id_comercio: idComercio,
      p_event_name: eventName,
      p_source: normalizeSource(params.source),
      p_session_id: params.sessionId || null,
      p_item_id: Number.isFinite(Number(params.itemId)) ? Number(params.itemId) : null,
      p_order_id: Number.isFinite(Number(params.orderId)) ? Number(params.orderId) : null,
      p_municipio: params.municipio || null,
      p_edad_rango: params.edadRango || null,
      p_genero: params.genero || null,
      p_device_type: normalizeDeviceType(params.deviceType),
      p_meta: params.meta || {},
    });
    if (error) throw error;
  } catch (error) {
    console.warn('[mobile-public][analytics] No se pudo registrar evento:', params.eventName, error);
  }
}

export async function openTrackedExternalUrl(params: OpenTrackedExternalParams): Promise<boolean> {
  const opened = await openExternalUrl(params.url, { loggerTag: params.loggerTag || 'mobile-public/analytics' });
  if (!opened) return false;

  void trackAnalyticsEvent({
    idComercio: params.idComercio,
    eventName: params.eventName,
    source: params.source,
    meta: params.meta || undefined,
  });
  return true;
}
