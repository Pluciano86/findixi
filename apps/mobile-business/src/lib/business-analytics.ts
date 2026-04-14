import { supabase } from './supabase';

export type AnalyticsRangeKey = '7d' | '30d' | '90d';

export type AnalyticsRangePreset = {
  key: AnalyticsRangeKey;
  label: string;
  days: number;
};

export const ANALYTICS_RANGE_PRESETS: AnalyticsRangePreset[] = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
];

export type AnalyticsKpis = {
  favoritesLive: number;
  viewsProfile: number;
  viewsMenu: number;
  ordersCompleted: number;
  clicksTotal: number;
  conversionAction: number;
};

export type AnalyticsDailyRow = {
  day: string;
  viewsProfile: number;
  viewsMenu: number;
  ordersCompleted: number;
  clicksTotal: number;
};

export type AnalyticsChannelClicks = {
  whatsapp: number;
  call: number;
  waze: number;
  googleMaps: number;
  facebook: number;
  instagram: number;
  tiktok: number;
  webpage: number;
};

export type AnalyticsSegmentRow = {
  label: string;
  total: number;
};

export type AnalyticsChannelMonthRow = {
  month: number;
  label: string;
  total: number;
};

export type AnalyticsChannelYearRow = {
  year: number;
  total: number;
};

export type AnalyticsChannelDrilldown = {
  key: keyof AnalyticsChannelClicks;
  label: string;
  total: number;
  monthly: AnalyticsChannelMonthRow[];
  yearly: AnalyticsChannelYearRow[];
  genders: AnalyticsSegmentRow[];
};

export type AnalyticsItemRow = {
  itemId: number;
  nombre: string;
  views: number;
  orders: number;
};

export type AnalyticsDashboardData = {
  range: {
    days: number;
    from: string;
    to: string;
  };
  kpis: AnalyticsKpis;
  previousKpis: AnalyticsKpis;
  daily: AnalyticsDailyRow[];
  channels: AnalyticsChannelClicks;
  channelDrilldown: AnalyticsChannelDrilldown[];
  visitsBySource: AnalyticsSegmentRow[];
  profileAudienceGeneros: AnalyticsSegmentRow[];
  profileAudienceEdades: AnalyticsSegmentRow[];
  sourceBreakdown: AnalyticsSegmentRow[];
  municipios: AnalyticsSegmentRow[];
  edades: AnalyticsSegmentRow[];
  generos: AnalyticsSegmentRow[];
  topViewedItems: AnalyticsItemRow[];
  topOrderedItems: AnalyticsItemRow[];
  insights: string[];
  hasData: boolean;
};

function isMissingResourceError(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  const message = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return code === '42P01' || code === '42703' || message.includes('does not exist') || message.includes('relation') || message.includes('column');
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toISODate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function listDates(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const values: string[] = [];
  for (let cur = new Date(start); cur.getTime() <= end.getTime(); cur = addDays(cur, 1)) {
    values.push(toISODate(cur));
  }
  return values;
}

function emptyKpis(): AnalyticsKpis {
  return {
    favoritesLive: 0,
    viewsProfile: 0,
    viewsMenu: 0,
    ordersCompleted: 0,
    clicksTotal: 0,
    conversionAction: 0,
  };
}

function normalizeSourceLabel(value: string): string {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return 'Desconocido';
  if (key === 'app') return 'App';
  if (key === 'web') return 'Web';
  if (key === 'qr_table' || key === 'qr' || key === 'mesa' || key === 'table') return 'Mesa QR';
  return key;
}

const CHANNEL_DEFS: Array<{ key: keyof AnalyticsChannelClicks; label: string; eventName: string }> = [
  { key: 'whatsapp', label: 'WhatsApp', eventName: 'click_whatsapp' },
  { key: 'call', label: 'Llamadas', eventName: 'click_call' },
  { key: 'waze', label: 'Waze', eventName: 'click_waze' },
  { key: 'googleMaps', label: 'Google Maps', eventName: 'click_google_maps' },
  { key: 'facebook', label: 'Facebook', eventName: 'click_facebook' },
  { key: 'instagram', label: 'Instagram', eventName: 'click_instagram' },
  { key: 'tiktok', label: 'TikTok', eventName: 'click_tiktok' },
  { key: 'webpage', label: 'Web', eventName: 'click_webpage' },
];

const CLICK_EVENT_NAMES = CHANNEL_DEFS.map((item) => item.eventName);
const CLICK_EVENT_NAME_SET = new Set(CLICK_EVENT_NAMES);
const KPI_EVENT_NAMES = ['view_profile', 'view_menu', 'order_completed', ...CLICK_EVENT_NAMES];

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function normalizeGenderLabel(value: string): string {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return 'Desconocido';
  if (['m', 'male', 'masculino', 'hombre'].includes(key)) return 'Hombre';
  if (['f', 'female', 'femenino', 'mujer'].includes(key)) return 'Mujer';
  return 'Desconocido';
}

function pickTopRows(input: Map<string, number>, limit = 5, labelTransform?: (value: string) => string): AnalyticsSegmentRow[] {
  return Array.from(input.entries())
    .map(([label, total]) => ({
      label: labelTransform ? labelTransform(label) : label,
      total,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function calcPct(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildInsights(kpis: AnalyticsKpis, previous: AnalyticsKpis, channels: AnalyticsChannelClicks): string[] {
  const insights: string[] = [];

  const profileTrend = calcPct(kpis.viewsProfile, previous.viewsProfile);
  if (profileTrend >= 10) {
    insights.push(`Tu tráfico de perfil subió ${profileTrend}% vs período anterior.`);
  } else if (profileTrend <= -10) {
    insights.push(`Tu tráfico de perfil bajó ${Math.abs(profileTrend)}%. Considera activar una promoción.`);
  }

  if (kpis.viewsMenu > 0 && kpis.ordersCompleted === 0) {
    insights.push('Hay vistas de menú sin órdenes registradas. Revisa precios, fotos y llamados a la acción.');
  }

  const mapClicks = channels.waze + channels.googleMaps;
  if (mapClicks > 0) {
    insights.push(`Se registraron ${mapClicks} interacciones de ruta (Google Maps + Waze).`);
  }

  const socialClicks = channels.facebook + channels.instagram + channels.tiktok + channels.webpage;
  if (socialClicks > 0) {
    insights.push(`Tus redes y web generaron ${socialClicks} clics en este período.`);
  }

  if (kpis.viewsProfile > 0 && kpis.clicksTotal === 0) {
    insights.push('Tienes vistas pero sin clics de acción. Destaca mejor WhatsApp, ubicación y ofertas.');
  }

  if (!insights.length) {
    insights.push('Aún no hay suficiente actividad para recomendaciones. Sigue promoviendo tu perfil y menú.');
  }

  return insights.slice(0, 4);
}

async function fetchKpisRange(idComercio: number, from: string, to: string): Promise<AnalyticsKpis> {
  if (!Number.isFinite(idComercio) || idComercio <= 0) return emptyKpis();

  const [favoritesResult, eventsResult] = await Promise.all([
    supabase.from('favoritosusuarios').select('*', { count: 'exact', head: true }).eq('idcomercio', idComercio),
    supabase
      .from('analytics_events')
      .select('event_name')
      .eq('id_comercio', idComercio)
      .gte('created_at', `${from}T00:00:00.000Z`)
      .lte('created_at', `${to}T23:59:59.999Z`)
      .in('event_name', KPI_EVENT_NAMES),
  ]);

  const favoritesError = favoritesResult.error;
  const eventsError = eventsResult.error;

  if (favoritesError && !isMissingResourceError(favoritesError)) {
    throw favoritesError;
  }
  if (eventsError) {
    if (isMissingResourceError(eventsError)) {
      return {
        ...emptyKpis(),
        favoritesLive: toNumber(favoritesResult.count),
      };
    }
    throw eventsError;
  }

  let viewsProfile = 0;
  let viewsMenu = 0;
  let ordersCompleted = 0;
  let clicksTotal = 0;

  (Array.isArray(eventsResult.data) ? eventsResult.data : []).forEach((entry) => {
    const eventName = String((entry as Record<string, unknown>).event_name || '').trim().toLowerCase();
    if (!eventName) return;
    if (eventName === 'view_profile') {
      viewsProfile += 1;
      return;
    }
    if (eventName === 'view_menu') {
      viewsMenu += 1;
      return;
    }
    if (eventName === 'order_completed') {
      ordersCompleted += 1;
      return;
    }
    if (CLICK_EVENT_NAME_SET.has(eventName)) {
      clicksTotal += 1;
    }
  });

  const actions = clicksTotal + ordersCompleted;
  const conversionAction = viewsProfile > 0 ? Number(((actions / viewsProfile) * 100).toFixed(1)) : 0;

  return {
    favoritesLive: toNumber(favoritesResult.count),
    viewsProfile,
    viewsMenu,
    ordersCompleted,
    clicksTotal,
    conversionAction,
  };
}

async function fetchDailyRows(idComercio: number, from: string, to: string): Promise<AnalyticsDailyRow[]> {
  const { data, error } = await supabase
    .from('analytics_events')
    .select('event_name,created_at')
    .eq('id_comercio', idComercio)
    .gte('created_at', `${from}T00:00:00.000Z`)
    .lte('created_at', `${to}T23:59:59.999Z`)
    .in('event_name', KPI_EVENT_NAMES);

  if (error) {
    if (isMissingResourceError(error)) return [];
    throw error;
  }

  const rowsByDay = new Map<string, AnalyticsDailyRow>();
  (Array.isArray(data) ? data : []).forEach((entry) => {
    const row = entry as Record<string, unknown>;
    const createdAt = new Date(String(row.created_at || ''));
    if (!Number.isFinite(createdAt.getTime())) return;
    const day = createdAt.toISOString().slice(0, 10);
    if (!day) return;
    const eventName = String(row.event_name || '').trim().toLowerCase();
    const current = rowsByDay.get(day) || {
      day,
      viewsProfile: 0,
      viewsMenu: 0,
      ordersCompleted: 0,
      clicksTotal: 0,
    };

    if (eventName === 'view_profile') current.viewsProfile += 1;
    else if (eventName === 'view_menu') current.viewsMenu += 1;
    else if (eventName === 'order_completed') current.ordersCompleted += 1;
    else if (CLICK_EVENT_NAME_SET.has(eventName)) current.clicksTotal += 1;

    rowsByDay.set(day, current);
  });

  return listDates(from, to).map((day) => {
    const row = rowsByDay.get(day);
    return (
      row || {
        day,
        viewsProfile: 0,
        viewsMenu: 0,
        ordersCompleted: 0,
        clicksTotal: 0,
      }
    );
  });
}

async function fetchChannelClicks(idComercio: number, from: string, to: string): Promise<AnalyticsChannelClicks> {
  const base: AnalyticsChannelClicks = {
    whatsapp: 0,
    call: 0,
    waze: 0,
    googleMaps: 0,
    facebook: 0,
    instagram: 0,
    tiktok: 0,
    webpage: 0,
  };

  const { data, error } = await supabase
    .from('analytics_events')
    .select('event_name')
    .eq('id_comercio', idComercio)
    .gte('created_at', `${from}T00:00:00.000Z`)
    .lte('created_at', `${to}T23:59:59.999Z`)
    .in('event_name', CLICK_EVENT_NAMES);

  if (error) {
    if (isMissingResourceError(error)) return base;
    throw error;
  }

  (Array.isArray(data) ? data : []).forEach((entry) => {
    const eventName = String((entry as Record<string, unknown>).event_name || '').trim().toLowerCase();
    if (eventName === 'click_whatsapp') base.whatsapp += 1;
    else if (eventName === 'click_call') base.call += 1;
    else if (eventName === 'click_waze') base.waze += 1;
    else if (eventName === 'click_google_maps') base.googleMaps += 1;
    else if (eventName === 'click_facebook') base.facebook += 1;
    else if (eventName === 'click_instagram') base.instagram += 1;
    else if (eventName === 'click_tiktok') base.tiktok += 1;
    else if (eventName === 'click_webpage') base.webpage += 1;
  });

  return base;
}

type SegmentBuckets = {
  source: Map<string, number>;
  municipio: Map<string, number>;
  edad_rango: Map<string, number>;
  genero: Map<string, number>;
};

async function fetchSegments(idComercio: number, from: string, to: string): Promise<SegmentBuckets> {
  const buckets: SegmentBuckets = {
    source: new Map(),
    municipio: new Map(),
    edad_rango: new Map(),
    genero: new Map(),
  };

  const { data, error } = await supabase
    .from('analytics_daily_segments')
    .select('segment_type,segment_value,total')
    .eq('id_comercio', idComercio)
    .gte('day', from)
    .lte('day', to);

  if (error) {
    if (isMissingResourceError(error)) return buckets;
    throw error;
  }

  (Array.isArray(data) ? data : []).forEach((entry) => {
    const row = entry as Record<string, unknown>;
    const type = String(row.segment_type || '').trim().toLowerCase();
    const value = String(row.segment_value || '').trim();
    const total = toNumber(row.total);
    if (!value || total <= 0) return;

    const map = (buckets as Record<string, Map<string, number>>)[type];
    if (!map) return;
    map.set(value, (map.get(value) || 0) + total);
  });

  return buckets;
}

async function fetchVisitsBySource(idComercio: number, from: string, to: string): Promise<AnalyticsSegmentRow[]> {
  const buckets = new Map<string, number>([
    ['Web', 0],
    ['App', 0],
    ['Mesa QR', 0],
    ['Desconocido', 0],
  ]);

  const { data, error } = await supabase
    .from('analytics_events')
    .select('source,event_name,created_at')
    .eq('id_comercio', idComercio)
    .gte('created_at', `${from}T00:00:00.000Z`)
    .lte('created_at', `${to}T23:59:59.999Z`)
    .in('event_name', ['view_profile', 'view_menu']);

  if (error) {
    if (isMissingResourceError(error)) return [];
    throw error;
  }

  (Array.isArray(data) ? data : []).forEach((entry) => {
    const row = entry as Record<string, unknown>;
    const label = normalizeSourceLabel(String(row.source || ''));
    buckets.set(label, (buckets.get(label) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .map(([label, total]) => ({ label, total }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

async function fetchChannelDrilldown(idComercio: number): Promise<AnalyticsChannelDrilldown[]> {
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const from = `${String(currentYear - 2).padStart(4, '0')}-01-01T00:00:00.000Z`;
  const to = `${String(currentYear).padStart(4, '0')}-12-31T23:59:59.999Z`;

  const defByEvent = new Map(CHANNEL_DEFS.map((item) => [item.eventName, item]));
  const rowsByKey = new Map<
    keyof AnalyticsChannelClicks,
    {
      total: number;
      monthly: number[];
      yearly: Map<number, number>;
      genders: Map<string, number>;
    }
  >();

  CHANNEL_DEFS.forEach((def) => {
    rowsByKey.set(def.key, {
      total: 0,
      monthly: new Array(12).fill(0),
      yearly: new Map(),
      genders: new Map(),
    });
  });

  const { data, error } = await supabase
    .from('analytics_events')
    .select('event_name,created_at,genero')
    .eq('id_comercio', idComercio)
    .gte('created_at', from)
    .lte('created_at', to)
    .in(
      'event_name',
      CHANNEL_DEFS.map((item) => item.eventName)
    );

  if (error) {
    if (isMissingResourceError(error)) {
      return CHANNEL_DEFS.map((def) => ({
        key: def.key,
        label: def.label,
        total: 0,
        monthly: MONTH_LABELS.map((label, index) => ({ month: index + 1, label, total: 0 })),
        yearly: [],
        genders: [],
      }));
    }
    throw error;
  }

  (Array.isArray(data) ? data : []).forEach((entry) => {
    const row = entry as Record<string, unknown>;
    const eventName = String(row.event_name || '').trim().toLowerCase();
    const def = defByEvent.get(eventName);
    if (!def) return;
    const target = rowsByKey.get(def.key);
    if (!target) return;

    const createdAt = new Date(String(row.created_at || ''));
    if (!Number.isFinite(createdAt.getTime())) return;

    target.total += 1;
    const year = createdAt.getUTCFullYear();
    const month = createdAt.getUTCMonth();

    target.yearly.set(year, (target.yearly.get(year) || 0) + 1);
    if (year === currentYear && month >= 0 && month < 12) {
      target.monthly[month] += 1;
    }

    const gender = normalizeGenderLabel(String(row.genero || ''));
    target.genders.set(gender, (target.genders.get(gender) || 0) + 1);
  });

  return CHANNEL_DEFS.map((def) => {
    const row = rowsByKey.get(def.key);
    const total = row?.total || 0;
    return {
      key: def.key,
      label: def.label,
      total,
      monthly: MONTH_LABELS.map((label, index) => ({
        month: index + 1,
        label,
        total: row?.monthly[index] || 0,
      })),
      yearly: Array.from((row?.yearly || new Map()).entries())
        .map(([year, totalYear]) => ({
          year,
          total: totalYear,
        }))
        .sort((a, b) => b.year - a.year)
        .slice(0, 3),
      genders: Array.from((row?.genders || new Map()).entries())
        .map(([label, totalGender]) => ({
          label,
          total: totalGender,
        }))
        .sort((a, b) => b.total - a.total),
    } as AnalyticsChannelDrilldown;
  });
}

async function fetchProfileAudience(idComercio: number, from: string, to: string): Promise<{
  generos: AnalyticsSegmentRow[];
  edades: AnalyticsSegmentRow[];
}> {
  const genders = new Map<string, number>();
  const ages = new Map<string, number>();

  const { data, error } = await supabase
    .from('analytics_events')
    .select('genero,edad_rango,created_at,event_name')
    .eq('id_comercio', idComercio)
    .gte('created_at', `${from}T00:00:00.000Z`)
    .lte('created_at', `${to}T23:59:59.999Z`)
    .eq('event_name', 'view_profile');

  if (error) {
    if (isMissingResourceError(error)) return { generos: [], edades: [] };
    throw error;
  }

  (Array.isArray(data) ? data : []).forEach((entry) => {
    const row = entry as Record<string, unknown>;
    const genero = normalizeGenderLabel(String(row.genero || ''));
    const edad = String(row.edad_rango || '').trim() || 'Desconocido';

    genders.set(genero, (genders.get(genero) || 0) + 1);
    ages.set(edad, (ages.get(edad) || 0) + 1);
  });

  return {
    generos: Array.from(genders.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total),
    edades: Array.from(ages.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total),
  };
}

async function fetchTopItems(idComercio: number, from: string, to: string): Promise<{ viewed: AnalyticsItemRow[]; ordered: AnalyticsItemRow[] }> {
  const empty = { viewed: [] as AnalyticsItemRow[], ordered: [] as AnalyticsItemRow[] };

  const { data, error } = await supabase
    .from('analytics_daily_items')
    .select('item_id,views,orders')
    .eq('id_comercio', idComercio)
    .gte('day', from)
    .lte('day', to);

  if (error) {
    if (isMissingResourceError(error)) return empty;
    throw error;
  }

  const aggregate = new Map<number, { views: number; orders: number }>();
  (Array.isArray(data) ? data : []).forEach((entry) => {
    const row = entry as Record<string, unknown>;
    const itemId = Number(row.item_id);
    if (!Number.isFinite(itemId) || itemId <= 0) return;
    const current = aggregate.get(itemId) || { views: 0, orders: 0 };
    current.views += toNumber(row.views);
    current.orders += toNumber(row.orders);
    aggregate.set(itemId, current);
  });

  const ids = Array.from(aggregate.keys());
  const names = new Map<number, string>();

  if (ids.length) {
    const { data: productos, error: prodError } = await supabase.from('productos').select('id,nombre').in('id', ids);
    if (!prodError) {
      (Array.isArray(productos) ? productos : []).forEach((entry) => {
        const row = entry as Record<string, unknown>;
        const id = Number(row.id);
        if (!Number.isFinite(id) || id <= 0) return;
        names.set(id, String(row.nombre || '').trim() || `Producto ${id}`);
      });
    }
  }

  const list = ids.map((itemId) => {
    const stats = aggregate.get(itemId) || { views: 0, orders: 0 };
    return {
      itemId,
      nombre: names.get(itemId) || `Producto ${itemId}`,
      views: stats.views,
      orders: stats.orders,
    } as AnalyticsItemRow;
  });

  return {
    viewed: [...list].filter((row) => row.views > 0).sort((a, b) => b.views - a.views).slice(0, 5),
    ordered: [...list].filter((row) => row.orders > 0).sort((a, b) => b.orders - a.orders).slice(0, 5),
  };
}

export async function fetchBusinessAnalyticsDashboard(idComercio: number, days: number): Promise<AnalyticsDashboardData> {
  const safeDays = Math.max(1, Math.round(days));
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const to = toISODate(todayUtc);
  const from = toISODate(addDays(todayUtc, -(safeDays - 1)));

  const prevTo = toISODate(addDays(todayUtc, -safeDays));
  const prevFrom = toISODate(addDays(todayUtc, -((safeDays * 2) - 1)));

  const [kpis, previousKpis, daily, channels, segments, topItems, channelDrilldown, visitsBySource, profileAudience] = await Promise.all([
    fetchKpisRange(idComercio, from, to),
    fetchKpisRange(idComercio, prevFrom, prevTo),
    fetchDailyRows(idComercio, from, to),
    fetchChannelClicks(idComercio, from, to),
    fetchSegments(idComercio, from, to),
    fetchTopItems(idComercio, from, to),
    fetchChannelDrilldown(idComercio),
    fetchVisitsBySource(idComercio, from, to),
    fetchProfileAudience(idComercio, from, to),
  ]);

  const sourceBreakdown = pickTopRows(segments.source, 4, normalizeSourceLabel);
  const municipios = pickTopRows(segments.municipio, 5);
  const edades = pickTopRows(segments.edad_rango, 5);
  const generos = pickTopRows(segments.genero, 5);

  const insights = buildInsights(kpis, previousKpis, channels);

  const hasData =
    kpis.viewsProfile > 0 ||
    kpis.viewsMenu > 0 ||
    kpis.clicksTotal > 0 ||
    kpis.ordersCompleted > 0 ||
    kpis.favoritesLive > 0;

  return {
    range: { days: safeDays, from, to },
    kpis,
    previousKpis,
    daily,
    channels,
    channelDrilldown,
    visitsBySource,
    profileAudienceGeneros: profileAudience.generos,
    profileAudienceEdades: profileAudience.edades,
    sourceBreakdown,
    municipios,
    edades,
    generos,
    topViewedItems: topItems.viewed,
    topOrderedItems: topItems.ordered,
    insights,
    hasData,
  };
}
