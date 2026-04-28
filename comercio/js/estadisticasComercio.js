import { supabase } from '../shared/supabaseClient.js';
import { renderBusinessChrome } from '../shared/businessChrome.js';
import { fetchBusinessAnalyticsDashboard } from '../shared/businessAnalytics.js';

const KPI_CARDS = [
  { key: 'favoritesLive', label: 'Favoritos' },
  { key: 'viewsProfile', label: 'Vistas perfil' },
  { key: 'viewsMenu', label: 'Vistas menú' },
  { key: 'clicksTotal', label: 'Clicks acción' },
  { key: 'ordersCompleted', label: 'Órdenes' },
  { key: 'conversionAction', label: 'Conversión acción', asPercent: true },
];

const CHANNEL_COLORS = {
  whatsapp: '#22c55e',
  call: '#ef4444',
  waze: '#06b6d4',
  googleMaps: '#3b82f6',
  facebook: '#2563eb',
  instagram: '#ec4899',
  tiktok: '#111827',
  webpage: '#f59e0b',
};

const PERCENT_COLORS = ['#f97316', '#219ebc', '#7c3aed', '#16a34a', '#ef4444', '#0ea5e9', '#d97706'];

const ui = {
  loading: document.getElementById('statsLoading'),
  error: document.getElementById('statsError'),
  errorText: document.getElementById('statsErrorText'),
  noComercio: document.getElementById('statsNoComercio'),
  content: document.getElementById('statsContent'),
  refreshBtn: document.getElementById('btnRefreshStats'),
  kpiGrid: document.getElementById('kpiGrid'),
  channelGrid: document.getElementById('channelGrid'),
  channelHelper: document.getElementById('channelHelper'),
  channelDetail: document.getElementById('channelDetail'),
  audienceGender: document.getElementById('audienceGender'),
  audienceAge: document.getElementById('audienceAge'),
  topViewedList: document.getElementById('topViewedList'),
  topOrderedList: document.getElementById('topOrderedList'),
  insightsList: document.getElementById('insightsList'),
  insightsHint: document.getElementById('insightsHint'),
};

const state = {
  idComercio: 0,
  dashboard: null,
  expandedChannelKey: null,
  refreshing: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getIdComercio(row = {}) {
  const value = row.idComercio ?? row.idcomercio ?? row.id_comercio ?? row.comercio_id ?? null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

function show(el, visible) {
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function calcTrendPct(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function getTrendMeta(current, previous) {
  const pct = calcTrendPct(current, previous);
  if (pct >= 0.1) return { tone: 'up', text: `+${pct}%` };
  if (pct <= -0.1) return { tone: 'down', text: `${pct}%` };
  return { tone: 'flat', text: '0%' };
}

function getTrendClasses(tone) {
  if (tone === 'up') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (tone === 'down') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-slate-700 bg-slate-50 border-slate-200';
}

function formatMetricValue(value, asPercent) {
  if (!Number.isFinite(value)) return asPercent ? '0%' : '0';
  if (asPercent) return `${Math.round(value)}%`;
  return String(Math.round(value));
}

function toPercentRows(rows, forcedOrder = [], palette = PERCENT_COLORS) {
  const totals = new Map();
  rows.forEach((row) => totals.set(row.label, Number(row.total) || 0));
  forcedOrder.forEach((label) => {
    if (!totals.has(label)) totals.set(label, 0);
  });

  const total = Array.from(totals.values()).reduce((acc, value) => acc + value, 0);
  const list = Array.from(totals.entries()).map(([label, value], index) => ({
    label,
    total: value,
    percent: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
    color: palette[index % palette.length],
  }));

  return list.sort((a, b) => b.total - a.total);
}

function normalizeGenderRows(rows) {
  const mapping = new Map([
    ['Hombre', 0],
    ['Mujer', 0],
    ['Desconocido', 0],
  ]);

  rows.forEach((row) => {
    const key = String(row.label || '').trim().toLowerCase();
    const value = Number(row.total) || 0;
    if (key === 'hombre' || key === 'm' || key === 'masculino') {
      mapping.set('Hombre', (mapping.get('Hombre') || 0) + value);
    } else if (key === 'mujer' || key === 'f' || key === 'femenino') {
      mapping.set('Mujer', (mapping.get('Mujer') || 0) + value);
    } else {
      mapping.set('Desconocido', (mapping.get('Desconocido') || 0) + value);
    }
  });

  return Array.from(mapping.entries()).map(([label, total]) => ({ label, total }));
}

function renderKpis() {
  if (!ui.kpiGrid || !state.dashboard) return;
  const html = KPI_CARDS.map((item) => {
    const current = Number(state.dashboard.kpis[item.key] || 0);
    const previous = Number(state.dashboard.previousKpis[item.key] || 0);
    const trend = getTrendMeta(current, previous);
    const trendClasses = getTrendClasses(trend.tone);
    return `
      <article class="rounded-xl border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-semibold text-slate-700">${escapeHtml(item.label)}</p>
          <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${trendClasses}">${escapeHtml(trend.text)}</span>
        </div>
        <p class="mt-2 text-3xl font-bold text-slate-900">${escapeHtml(formatMetricValue(current, Boolean(item.asPercent)))}</p>
        <p class="mt-1 text-xs text-slate-500">Previo: ${escapeHtml(formatMetricValue(previous, Boolean(item.asPercent)))}</p>
      </article>
    `;
  }).join('');
  ui.kpiGrid.innerHTML = html;
}

function buildDonut(rows, emptyText) {
  const nonZeroRows = rows.filter((row) => row.total > 0);
  const renderRows = nonZeroRows.length ? nonZeroRows : rows;
  if (!renderRows.length) {
    return `<p class="text-sm text-slate-500">${escapeHtml(emptyText)}</p>`;
  }

  const total = renderRows.reduce((acc, row) => acc + row.total, 0);
  let offset = 0;
  const stops = renderRows.map((row) => {
    const start = offset;
    const end = Math.min(100, offset + Math.max(0, row.percent));
    offset = end;
    return `${row.color} ${start}% ${end}%`;
  });
  if (offset < 100) {
    stops.push(`#e2e8f0 ${offset}% 100%`);
  }

  const donutBg = `conic-gradient(${stops.join(', ')})`;

  return `
    <div class="flex flex-col md:flex-row md:items-center gap-4">
      <div class="relative inline-flex items-center justify-center">
        <div class="donut-ring" style="background:${donutBg};"></div>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <p class="text-xl font-bold text-slate-900">${escapeHtml(String(total))}</p>
          <p class="text-xs text-slate-500">Total</p>
        </div>
      </div>
      <div class="space-y-2 flex-1">
        ${renderRows.map((row) => `
          <div class="flex items-center gap-2 text-sm">
            <span class="inline-block h-2.5 w-2.5 rounded-full" style="background:${row.color};"></span>
            <span class="text-slate-700">${escapeHtml(row.label)}</span>
            <span class="ml-auto font-semibold text-slate-900">${escapeHtml(`${row.percent}% (${row.total})`)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function buildHorizontalPercentBars(rows, emptyText) {
  const nonZeroRows = rows.filter((row) => row.total > 0);
  const renderRows = nonZeroRows.length ? nonZeroRows : rows;
  if (!renderRows.length) {
    return `<p class="text-sm text-slate-500">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="space-y-3">
      ${renderRows.map((row) => `
        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-sm">
            <span class="inline-block h-2.5 w-2.5 rounded-full" style="background:${row.color};"></span>
            <span class="text-slate-700">${escapeHtml(row.label)}</span>
            <span class="ml-auto font-semibold text-slate-900">${escapeHtml(`${row.total} (${row.percent}%)`)}</span>
          </div>
          <div class="h-2.5 rounded-full bg-slate-200 overflow-hidden">
            <div class="h-full rounded-full" style="width:${Math.max(0, Math.min(100, row.percent))}%; background:${row.color};"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function buildMonthBars(channel) {
  const maxValue = Math.max(1, ...channel.monthly.map((row) => row.total));
  return `
    <div class="overflow-x-auto">
      <div class="flex gap-2 min-w-max pb-1">
        ${channel.monthly.map((month, index) => {
          const barHeight = month.total <= 0 ? 8 : Math.max((month.total / maxValue) * 84, 12);
          const color = CHANNEL_COLORS[channel.key] || PERCENT_COLORS[index % PERCENT_COLORS.length];
          return `
            <div class="w-11 flex flex-col items-center gap-1">
              <span class="text-[11px] font-semibold text-slate-600">${month.total}</span>
              <div class="h-24 w-8 rounded-md bg-slate-200 border border-slate-300 flex items-end p-1">
                <div class="w-full rounded-sm" style="height:${barHeight}px; background:${color};"></div>
              </div>
              <span class="text-[11px] text-slate-500">${escapeHtml(month.label)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderChannels() {
  if (!ui.channelGrid || !ui.channelDetail || !ui.channelHelper || !state.dashboard) return;
  const total = state.dashboard.channelDrilldown.reduce((acc, row) => acc + row.total, 0);
  const rows = state.dashboard.channelDrilldown.map((row) => ({
    ...row,
    percent: total > 0 ? Number(((row.total / total) * 100).toFixed(1)) : 0,
    color: CHANNEL_COLORS[row.key] || '#64748b',
  }));

  ui.channelGrid.innerHTML = rows.map((row) => `
    <article class="rounded-xl border ${state.expandedChannelKey === row.key ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white'} p-4">
      <p class="text-sm font-semibold text-slate-700">${escapeHtml(row.label)}</p>
      <p class="mt-2 text-3xl font-bold text-slate-900">${row.total}</p>
      <p class="text-xs text-slate-500">${row.percent}% del total</p>
      <button
        type="button"
        data-channel-toggle="${escapeHtml(row.key)}"
        class="mt-3 inline-flex items-center justify-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
      >
        ${state.expandedChannelKey === row.key ? 'Ver menos' : 'Ver más'}
      </button>
    </article>
  `).join('');

  const selected = rows.find((row) => row.key === state.expandedChannelKey) || null;
  show(ui.channelDetail, Boolean(selected));
  show(ui.channelHelper, !selected);

  if (!selected) {
    ui.channelDetail.innerHTML = '';
    return;
  }

  const genderRows = toPercentRows(
    normalizeGenderRows(selected.genders || []),
    ['Hombre', 'Mujer', 'Desconocido'],
    ['#2563eb', '#ec4899', '#64748b']
  );

  ui.channelDetail.innerHTML = `
    <div>
      <h3 class="text-base font-semibold text-slate-900 mb-2">${escapeHtml(selected.label)}: clicks por mes</h3>
      ${buildMonthBars(selected)}
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-900 mb-2">Género (%)</h3>
      ${buildHorizontalPercentBars(genderRows, 'Sin datos de género para este canal.')}
    </div>
  `;
}

function renderSegmentList(container, rows, emptyText) {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = `<p class="text-sm text-slate-500">${escapeHtml(emptyText)}</p>`;
    return;
  }

  container.innerHTML = `
    <div class="space-y-2">
      ${rows.map((row, index) => `
        <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span class="text-slate-700">${escapeHtml(row.label || `Item ${index + 1}`)}</span>
          <span class="font-semibold text-slate-900">${escapeHtml(String(toNumber(row.total)))}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderAudience() {
  if (!state.dashboard || !ui.audienceGender || !ui.audienceAge) return;
  const genderRows = toPercentRows(
    normalizeGenderRows(state.dashboard.profileAudienceGeneros || []),
    ['Hombre', 'Mujer', 'Desconocido'],
    ['#2563eb', '#ec4899', '#64748b']
  );
  const ageRows = toPercentRows(state.dashboard.profileAudienceEdades || [], [], PERCENT_COLORS);

  ui.audienceGender.innerHTML = buildDonut(genderRows, 'Sin datos de género en visitas de perfil.');
  ui.audienceAge.innerHTML = buildDonut(ageRows, 'Sin datos de edad en visitas de perfil.');
}

function renderTopLists() {
  if (!state.dashboard) return;
  renderSegmentList(
    ui.topViewedList,
    state.dashboard.topViewedItems.map((item) => ({ label: item.nombre, total: item.views })),
    'Sin vistas de productos en este rango.'
  );
  renderSegmentList(
    ui.topOrderedList,
    state.dashboard.topOrderedItems.map((item) => ({ label: item.nombre, total: item.orders })),
    'Sin órdenes de productos en este rango.'
  );
}

function renderInsights() {
  if (!state.dashboard || !ui.insightsList || !ui.insightsHint) return;
  ui.insightsList.innerHTML = (state.dashboard.insights || []).map((item) => `
    <div class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span class="mt-2 inline-block h-2 w-2 rounded-full bg-orange-500"></span>
      <p class="text-sm text-slate-700">${escapeHtml(item)}</p>
    </div>
  `).join('');
  show(ui.insightsHint, !state.dashboard.hasData);
}

function setLoading(loading) {
  show(ui.loading, loading);
  if (ui.refreshBtn) {
    ui.refreshBtn.disabled = loading;
    ui.refreshBtn.textContent = loading ? 'Actualizando...' : 'Actualizar';
    ui.refreshBtn.classList.toggle('opacity-70', loading);
    ui.refreshBtn.classList.toggle('cursor-not-allowed', loading);
  }
}

async function fetchUsuarioComerciosByUser(userId) {
  const attempts = [
    { selectCol: 'idComercio', filterCol: 'idUsuario' },
    { selectCol: 'idcomercio', filterCol: 'idUsuario' },
    { selectCol: 'idComercio', filterCol: 'idusuario' },
    { selectCol: 'idcomercio', filterCol: 'idusuario' },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('UsuarioComercios')
      .select(`${attempt.selectCol}, rol`)
      .eq(attempt.filterCol, userId);

    if (!error) {
      return (Array.isArray(data) ? data : [])
        .map((row) => ({ idComercio: getIdComercio(row), rol: row?.rol || '' }))
        .filter((row) => row.idComercio > 0);
    }
    if (!isMissingColumnError(error)) break;
  }

  return [];
}

function parseStorageAsignaciones() {
  try {
    const raw = localStorage.getItem('comercio_asignaciones');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        idComercio: getIdComercio(item),
        rol: item?.rol || '',
      }))
      .filter((item) => item.idComercio > 0);
  } catch (_error) {
    return [];
  }
}

async function resolveComercioId(userId) {
  const search = new URLSearchParams(window.location.search);
  const fromUrl = Number(search.get('id') || search.get('idComercio') || 0);
  if (Number.isFinite(fromUrl) && fromUrl > 0) return fromUrl;

  const storageAsignaciones = parseStorageAsignaciones();
  if (storageAsignaciones.length) return storageAsignaciones[0].idComercio;

  const asignaciones = await fetchUsuarioComerciosByUser(userId);
  if (asignaciones.length) return asignaciones[0].idComercio;

  const { data: comerciosOwner, error } = await supabase
    .from('Comercios')
    .select('id')
    .eq('owner_user_id', userId)
    .limit(1);

  if (error) return 0;
  const first = Array.isArray(comerciosOwner) && comerciosOwner.length ? Number(comerciosOwner[0]?.id) : 0;
  return Number.isFinite(first) ? first : 0;
}

function renderDashboard() {
  renderKpis();
  renderChannels();
  renderAudience();
  renderTopLists();
  renderInsights();
}

async function loadStats() {
  if (!state.idComercio) return;
  show(ui.error, false);
  setLoading(true);
  try {
    state.dashboard = await fetchBusinessAnalyticsDashboard(state.idComercio, 7);
    state.expandedChannelKey = null;
    renderDashboard();
    show(ui.content, true);
  } catch (error) {
    console.error('No se pudieron cargar estadísticas:', error);
    if (ui.errorText) ui.errorText.textContent = 'No se pudieron cargar las estadísticas del comercio.';
    show(ui.error, true);
    show(ui.content, false);
  } finally {
    setLoading(false);
  }
}

async function init() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.user) {
    window.location.href = './login.html';
    return;
  }

  const userId = sessionData.session.user.id;
  state.idComercio = await resolveComercioId(userId);

  await renderBusinessChrome({
    active: 'stats',
    idComercio: state.idComercio,
    basePath: '.',
    title: 'Estadísticas',
    showBack: true,
    showFooter: true,
  });

  if (!state.idComercio) {
    show(ui.loading, false);
    show(ui.noComercio, true);
    return;
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get('id') !== String(state.idComercio)) {
    url.searchParams.set('id', String(state.idComercio));
    window.history.replaceState({}, '', url.toString());
  }

  await loadStats();
}

ui.refreshBtn?.addEventListener('click', async () => {
  if (state.refreshing) return;
  state.refreshing = true;
  try {
    await loadStats();
  } finally {
    state.refreshing = false;
  }
});

ui.channelGrid?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('[data-channel-toggle]') : null;
  if (!target) return;
  const key = String(target.getAttribute('data-channel-toggle') || '').trim();
  if (!key) return;
  state.expandedChannelKey = state.expandedChannelKey === key ? null : key;
  renderChannels();
});

void init();
