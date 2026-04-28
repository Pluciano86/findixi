import { supabase } from './supabaseClient.js';

export const ANALYTICS_RANGE_PRESETS = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
];

function isMissingResourceError(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  return code === '42P01' || code === '42703' || message.includes('does not exist') || message.includes('relation') || message.includes('column');
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toISODate(value) {
  return value.toISOString().slice(0, 10);
}

function addDays(base, days) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function listDates(from, to) {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const values = [];
  for (let cur = new Date(start); cur.getTime() <= end.getTime(); cur = addDays(cur, 1)) {
    values.push(toISODate(cur));
  }
  return values;
}

function emptyKpis() {
  return {
    favoritesLive: 0,
    viewsProfile: 0,
    viewsMenu: 0,
    ordersCompleted: 0,
    clicksTotal: 0,
    conversionAction: 0,
  };
}

function normalizeSourceLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return 'Desconocido';
  if (key === 'app') return 'App';
  if (key === 'web') return 'Web';
  if (key === 'qr_table' || key === 'qr' || key === 'mesa' || key === 'table') return 'Mesa QR';
  return key;
}

const CHANNEL_DEFS = [
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

function normalizeGenderLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return 'Desconocido';
  if (['m', 'male', 'masculino', 'hombre'].includes(key)) return 'Hombre';
  if (['f', 'female', 'femenino', 'mujer'].includes(key)) return 'Mujer';
  return 'Desconocido';
}

function pickTopRows(input, limit = 5, labelTransform) {
  return Array.from(input.entries())
    .map(([label, total]) => ({
      label: labelTransform ? labelTransform(label) : label,
      total,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function calcPct(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildInsights(kpis, previous, channels) {
  const insights = [];

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

async function fetchKpisRange(idComercio, from, to) {
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
    const eventName = String(entry?.event_name || '').trim().toLowerCase();
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

async function fetchDailyRows(idComercio, from, to) {
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

  const rowsByDay = new Map();
  (Array.isArray(data) ? data : []).forEach((entry) => {
    const createdAt = new Date(String(entry?.created_at || ''));
    if (!Number.isFinite(createdAt.getTime())) return;
    const day = createdAt.toISOString().slice(0, 10);
    if (!day) return;
    const eventName = String(entry?.event_name || '').trim().toLowerCase();
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

async function fetchChannelClicks(idComercio, from, to) {
  const base = {
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
    const eventName = String(entry?.event_name || '').trim().toLowerCase();
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

async function fetchSegments(idComercio, from, to) {
  const buckets = {
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
    const type = String(entry?.segment_type || '').trim().toLowerCase();
    const value = String(entry?.segment_value || '').trim();
    const total = toNumber(entry?.total);
    if (!value || total <= 0) return;

    const map = buckets[type];
    if (!map) return;
    map.set(value, (map.get(value) || 0) + total);
  });

  return buckets;
}

async function fetchVisitsBySource(idComercio, from, to) {
  const buckets = new Map([
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
    const label = normalizeSourceLabel(String(entry?.source || ''));
    buckets.set(label, (buckets.get(label) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .map(([label, total]) => ({ label, total }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

async function fetchChannelDrilldown(idComercio) {
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const from = `${String(currentYear - 2).padStart(4, '0')}-01-01T00:00:00.000Z`;
  const to = `${String(currentYear).padStart(4, '0')}-12-31T23:59:59.999Z`;

  const defByEvent = new Map(CHANNEL_DEFS.map((item) => [item.eventName, item]));
  const rowsByKey = new Map();

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
    const eventName = String(entry?.event_name || '').trim().toLowerCase();
    const def = defByEvent.get(eventName);
    if (!def) return;
    const target = rowsByKey.get(def.key);
    if (!target) return;

    const createdAt = new Date(String(entry?.created_at || ''));
    if (!Number.isFinite(createdAt.getTime())) return;

    target.total += 1;
    const year = createdAt.getUTCFullYear();
    const month = createdAt.getUTCMonth();

    target.yearly.set(year, (target.yearly.get(year) || 0) + 1);
    if (year === currentYear && month >= 0 && month < 12) {
      target.monthly[month] += 1;
    }

    const gender = normalizeGenderLabel(String(entry?.genero || ''));
    target.genders.set(gender, (target.genders.get(gender) || 0) + 1);
  });

  return CHANNEL_DEFS.map((def) => {
    const row = rowsByKey.get(def.key);
    return {
      key: def.key,
      label: def.label,
      total: row?.total || 0,
      monthly: MONTH_LABELS.map((label, index) => ({
        month: index + 1,
        label,
        total: row?.monthly[index] || 0,
      })),
      yearly: Array.from((row?.yearly || new Map()).entries())
        .map(([year, total]) => ({ year, total }))
        .sort((a, b) => b.year - a.year)
        .slice(0, 3),
      genders: Array.from((row?.genders || new Map()).entries())
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total),
    };
  });
}

async function fetchProfileAudience(idComercio, from, to) {
  const genders = new Map();
  const ages = new Map();

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
    const genero = normalizeGenderLabel(String(entry?.genero || ''));
    const edad = String(entry?.edad_rango || '').trim() || 'Desconocido';

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

async function fetchTopItems(idComercio, from, to) {
  const empty = { viewed: [], ordered: [] };

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

  const aggregate = new Map();
  (Array.isArray(data) ? data : []).forEach((entry) => {
    const itemId = Number(entry?.item_id);
    if (!Number.isFinite(itemId) || itemId <= 0) return;
    const current = aggregate.get(itemId) || { views: 0, orders: 0 };
    current.views += toNumber(entry?.views);
    current.orders += toNumber(entry?.orders);
    aggregate.set(itemId, current);
  });

  const ids = Array.from(aggregate.keys());
  const names = new Map();

  if (ids.length) {
    const { data: productos, error: prodError } = await supabase.from('productos').select('id,nombre').in('id', ids);
    if (!prodError) {
      (Array.isArray(productos) ? productos : []).forEach((entry) => {
        const id = Number(entry?.id);
        if (!Number.isFinite(id) || id <= 0) return;
        names.set(id, String(entry?.nombre || '').trim() || `Producto ${id}`);
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
    };
  });

  return {
    viewed: [...list].filter((row) => row.views > 0).sort((a, b) => b.views - a.views).slice(0, 5),
    ordered: [...list].filter((row) => row.orders > 0).sort((a, b) => b.orders - a.orders).slice(0, 5),
  };
}

export async function fetchBusinessAnalyticsDashboard(idComercio, days = 7) {
  const safeDays = Math.max(1, Math.round(Number(days) || 7));
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
