import { supabase } from '../shared/supabaseClient.js';
import {
  MONTH_LABELS,
  buildDefaultProjectionBundle,
  calculateProjectionSummary,
  createDefaultProjection,
  formatMoney,
  normalizeMoneyItems,
  normalizeProjectionMonth,
  normalizeProjectionSettings,
  roundMoney,
} from '../shared/projectionsCalculator.js';

const ALLOWED_ROLES = new Set(['admin', 'owner', 'superadmin', 'app_admin', 'app_owner', 'app_superadmin']);

const state = {
  projections: [],
  currentProjectionId: null,

  projection: null,
  settings: null,
  months: [],
  summary: null,

  projectionDraft: null,
  settingsDraft: null,
  monthsDraft: [],
  liveSummary: null,

  selectedMonth: 0,
  activeTab: 'annual',

  dirtyMonths: new Set(),
  settingsDirty: false,
};

const el = {
  projectionSelect: document.getElementById('projectionSelect'),
  btnNewProjection: document.getElementById('btnNewProjection'),
  btnExportCsv: document.getElementById('btnExportCsv'),
  projectionStatus: document.getElementById('projectionStatus'),

  kpiIngresosAno: document.getElementById('kpiIngresosAno'),
  kpiCajaFinal: document.getElementById('kpiCajaFinal'),
  kpiMrrDic: document.getElementById('kpiMrrDic'),
  kpiMesesPositivos: document.getElementById('kpiMesesPositivos'),
  kpiPuntoEq: document.getElementById('kpiPuntoEq'),
  kpiBonos: document.getElementById('kpiBonos'),

  tabButtons: Array.from(document.querySelectorAll('.tab-btn')),
  tabAnnual: document.getElementById('tabAnnual'),
  tabMonth: document.getElementById('tabMonth'),
  tabData: document.getElementById('tabData'),
  tabPartners: document.getElementById('tabPartners'),
  tabSettings: document.getElementById('tabSettings'),

  annualHint: document.getElementById('annualHint'),
  annualMrrChart: document.getElementById('annualMrrChart'),
  annualNetChart: document.getElementById('annualNetChart'),
  annualTableContainer: document.getElementById('annualTableContainer'),

  monthChipsDetail: document.getElementById('monthChipsDetail'),
  monthDetailContainer: document.getElementById('monthDetailContainer'),

  monthChipsData: document.getElementById('monthChipsData'),
  dataDirtyState: document.getElementById('dataDirtyState'),
  dataSaveStatus: document.getElementById('dataSaveStatus'),

  dataRegApp: document.getElementById('dataRegApp'),
  dataRegCgo: document.getElementById('dataRegCgo'),
  dataPlusApp: document.getElementById('dataPlusApp'),
  dataPlusCgo: document.getElementById('dataPlusCgo'),
  dataPremApp: document.getElementById('dataPremApp'),
  dataPremCgo: document.getElementById('dataPremCgo'),
  dataSponsors: document.getElementById('dataSponsors'),
  dataMunicipios: document.getElementById('dataMunicipios'),
  dataAds: document.getElementById('dataAds'),
  dataNotes: document.getElementById('dataNotes'),

  addDataIncomeBtn: document.getElementById('addDataIncomeBtn'),
  addDataExpenseBtn: document.getElementById('addDataExpenseBtn'),
  dataExtraIncomeList: document.getElementById('dataExtraIncomeList'),
  dataExtraExpenseList: document.getElementById('dataExtraExpenseList'),

  dataSummaryMrr: document.getElementById('dataSummaryMrr'),
  dataSummaryExcedente: document.getElementById('dataSummaryExcedente'),
  dataSummaryResultado: document.getElementById('dataSummaryResultado'),
  dataPrestartHint: document.getElementById('dataPrestartHint'),

  saveDataMonthBtn: document.getElementById('saveDataMonthBtn'),

  partnerCards: document.getElementById('partnerCards'),
  partnersTableContainer: document.getElementById('partnersTableContainer'),

  settingsDirtyState: document.getElementById('settingsDirtyState'),
  settingsSaveStatus: document.getElementById('settingsSaveStatus'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),

  cfgPriceRegular: document.getElementById('cfgPriceRegular'),
  cfgPricePlus: document.getElementById('cfgPricePlus'),
  cfgPricePremium: document.getElementById('cfgPricePremium'),

  cfgStartMonth: document.getElementById('cfgStartMonth'),

  cfgDistCeo: document.getElementById('cfgDistCeo'),
  cfgDistCoo: document.getElementById('cfgDistCoo'),
  cfgDistCgo: document.getElementById('cfgDistCgo'),
  distPctHint: document.getElementById('distPctHint'),

  cfgSalMinCeo: document.getElementById('cfgSalMinCeo'),
  cfgSalMinCoo: document.getElementById('cfgSalMinCoo'),
  cfgSalMinCgo: document.getElementById('cfgSalMinCgo'),
  cfgReservaMinima: document.getElementById('cfgReservaMinima'),

  addPositionBtn: document.getElementById('addPositionBtn'),
  positionsList: document.getElementById('positionsList'),

  cfgMetaMrrBono: document.getElementById('cfgMetaMrrBono'),
  cfgBonoPctCeo: document.getElementById('cfgBonoPctCeo'),
  cfgBonoPctCoo: document.getElementById('cfgBonoPctCoo'),
  cfgBonoPctCgo: document.getElementById('cfgBonoPctCgo'),
  bonusPeriodHint: document.getElementById('bonusPeriodHint'),

  addFixedExpenseBtn: document.getElementById('addFixedExpenseBtn'),
  fixedExpensesList: document.getElementById('fixedExpensesList'),
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value, fallback = 0) {
  return Math.max(0, Math.round(toNumber(value, fallback)));
}

function toMoney(value, fallback = 0) {
  return Math.max(0, toNumber(value, fallback));
}

function toPct(value, fallback = 0) {
  return Math.max(0, toNumber(value, fallback));
}

function monthShort(index) {
  return (MONTH_LABELS[index] || '').slice(0, 3);
}

function monthName(index) {
  return MONTH_LABELS[index] || `Mes ${index + 1}`;
}

function toneClass(tone) {
  if (tone === 'positive') return 'text-emerald-700';
  if (tone === 'negative') return 'text-red-700';
  return 'text-gray-500';
}

function setProjectionStatus(text, tone = 'muted') {
  if (!el.projectionStatus) return;
  const map = {
    muted: 'text-gray-500',
    success: 'text-emerald-700',
    error: 'text-red-700',
    info: 'text-sky-700',
  };
  el.projectionStatus.className = `text-xs mt-3 ${map[tone] || map.muted}`;
  el.projectionStatus.textContent = text || '';
}

function setDataSaveStatus(text, tone = 'muted') {
  if (!el.dataSaveStatus) return;
  const map = {
    muted: 'text-gray-500',
    success: 'text-emerald-700',
    error: 'text-red-700',
    info: 'text-sky-700',
  };
  el.dataSaveStatus.className = `text-sm ${map[tone] || map.muted}`;
  el.dataSaveStatus.textContent = text || '';
}

function setSettingsSaveStatus(text, tone = 'muted') {
  if (!el.settingsSaveStatus) return;
  const map = {
    muted: 'text-gray-500',
    success: 'text-emerald-700',
    error: 'text-red-700',
    info: 'text-sky-700',
  };
  el.settingsSaveStatus.className = `text-sm ${map[tone] || map.muted}`;
  el.settingsSaveStatus.textContent = text || '';
}

function markDataDirty(dirty, monthIndex = state.selectedMonth) {
  if (dirty) state.dirtyMonths.add(monthIndex);
  else state.dirtyMonths.delete(monthIndex);

  const isDirty = state.dirtyMonths.has(state.selectedMonth);
  if (el.dataDirtyState) {
    el.dataDirtyState.textContent = isDirty ? 'Cambios sin guardar' : 'Guardado ✓';
    el.dataDirtyState.className = isDirty ? 'text-xs text-amber-700' : 'text-xs text-gray-500';
  }
}

function markSettingsDirty(dirty) {
  state.settingsDirty = dirty;
  if (el.settingsDirtyState) {
    el.settingsDirtyState.textContent = dirty ? 'Cambios sin guardar' : 'Guardado ✓';
    el.settingsDirtyState.className = dirty ? 'text-xs text-amber-700' : 'text-xs text-gray-500';
  }
}

function getApiCandidateUrls(path = '') {
  const normalized = String(path || '').trim().replace(/^\/+/, '');
  const suffix = normalized ? `/${normalized}` : '';

  const host = String(window.location.hostname || '').toLowerCase();
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
  const port = String(window.location.port || '');
  const customBase = String(window.FINDIXI_FUNCTIONS_BASE_URL || '').trim().replace(/\/+$/, '');
  const urls = [];

  if (customBase) {
    urls.push(`${customBase}/api/projections${suffix}`);
    urls.push(`${customBase}/.netlify/functions/projections${suffix}`);
  }

  // En Live Server local, priorizar Netlify Dev para funciones serverless.
  if (isLocal && port !== '8888') {
    urls.push(`http://localhost:8888/api/projections${suffix}`);
    urls.push(`http://localhost:8888/.netlify/functions/projections${suffix}`);
    return [...new Set(urls)];
  }

  urls.push(`/api/projections${suffix}`);
  urls.push(`/.netlify/functions/projections${suffix}`);

  return [...new Set(urls)];
}

function isLocalLiveServerRuntime() {
  const host = String(window.location.hostname || '').toLowerCase();
  const port = String(window.location.port || '');
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
  return isLocal && port !== '8888';
}

function parseApiPathSegments(path = '') {
  return String(path || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function buildDistWarning(settings = {}) {
  const sum =
    Number(settings.dist_pct_ceo || 0) +
    Number(settings.dist_pct_coo || 0) +
    Number(settings.dist_pct_cgo || 0);
  const rounded = Math.round(sum * 100) / 100;
  if (Math.abs(rounded - 100) < 0.01) return [];
  return [`La distribución suma ${rounded}% y se normaliza automáticamente en cálculo.`];
}

function normalizeMonthsFromRows(rows = []) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const idx = Math.max(0, Math.min(11, Math.round(Number(row?.month_index) || 0)));
    map.set(idx, row || {});
  });

  return Array.from({ length: 12 }, (_, idx) => normalizeProjectionMonth(map.get(idx) || {}, idx));
}

async function fetchProjectionDetailViaSupabase(projectionId) {
  const [{ data: projection, error: projectionError }, { data: settings, error: settingsError }, { data: months, error: monthsError }] = await Promise.all([
    supabase.from('projections').select('*').eq('id', projectionId).maybeSingle(),
    supabase.from('projection_settings').select('*').eq('projection_id', projectionId).maybeSingle(),
    supabase.from('projection_months').select('*').eq('projection_id', projectionId).order('month_index', { ascending: true }),
  ]);

  if (projectionError) throw projectionError;
  if (!projection) return null;
  if (settingsError) throw settingsError;
  if (monthsError) throw monthsError;

  return {
    projection,
    settings: normalizeProjectionSettings(settings || {}, { startMonth: projection.start_month }),
    months: normalizeMonthsFromRows(months || []),
  };
}

async function apiRequestViaSupabase(method, path = '', body = undefined) {
  const verb = String(method || 'GET').toUpperCase();
  const segments = parseApiPathSegments(path);

  if (segments.length === 0) {
    if (verb === 'GET') {
      const { data, error } = await supabase
        .from('projections')
        .select('id, name, year, start_month, created_at, updated_at')
        .order('year', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { projections: data || [] };
    }

    if (verb === 'POST') {
      const normalizedProjection = createDefaultProjection({
        name: body?.name,
        year: body?.year,
        startMonth: body?.start_month,
      });
      const defaults = buildDefaultProjectionBundle({
        name: normalizedProjection.name,
        year: normalizedProjection.year,
        startMonth: normalizedProjection.start_month,
      });

      const { data: projection, error: projectionError } = await supabase
        .from('projections')
        .insert(normalizedProjection)
        .select('*')
        .single();
      if (projectionError) throw projectionError;

      const settingsPayload = {
        projection_id: projection.id,
        price_regular: defaults.settings.price_regular,
        price_plus: defaults.settings.price_plus,
        price_premium: defaults.settings.price_premium,
        dist_pct_ceo: defaults.settings.dist_pct_ceo,
        dist_pct_coo: defaults.settings.dist_pct_coo,
        dist_pct_cgo: defaults.settings.dist_pct_cgo,
        sal_min_ceo: defaults.settings.sal_min_ceo,
        sal_min_coo: defaults.settings.sal_min_coo,
        sal_min_cgo: defaults.settings.sal_min_cgo,
        reserva_minima: defaults.settings.reserva_minima,
        meta_mrr_bono: defaults.settings.meta_mrr_bono,
        bono_pct_ceo: defaults.settings.bono_pct_ceo,
        bono_pct_coo: defaults.settings.bono_pct_coo,
        bono_pct_cgo: defaults.settings.bono_pct_cgo,
        positions: normalizeMoneyItems(defaults.settings.positions),
        fixed_expenses: normalizeMoneyItems(defaults.settings.fixed_expenses),
      };
      const { error: settingsError } = await supabase.from('projection_settings').insert(settingsPayload);
      if (settingsError) throw settingsError;

      const monthRows = defaults.months.map((month) => ({
        projection_id: projection.id,
        month_index: month.month_index,
        reg_app: month.reg_app,
        reg_cgo: month.reg_cgo,
        plus_app: month.plus_app,
        plus_cgo: month.plus_cgo,
        prem_app: month.prem_app,
        prem_cgo: month.prem_cgo,
        sponsors: month.sponsors,
        municipios: month.municipios,
        ads: month.ads,
        extra_income: normalizeMoneyItems(month.extra_income),
        extra_expense: normalizeMoneyItems(month.extra_expense),
        notes: month.notes,
      }));
      const { error: monthsError } = await supabase.from('projection_months').insert(monthRows);
      if (monthsError) throw monthsError;

      return await fetchProjectionDetailViaSupabase(projection.id);
    }

    throw new Error(`Método no permitido: ${verb}`);
  }

  const projectionId = Number(segments[0]);
  if (!Number.isInteger(projectionId) || projectionId <= 0) {
    throw new Error('ID de proyección inválido.');
  }

  if (segments.length === 1) {
    if (verb === 'GET') {
      const detail = await fetchProjectionDetailViaSupabase(projectionId);
      if (!detail) throw new Error('Proyección no encontrada.');
      return detail;
    }

    if (verb === 'PATCH') {
      const payload = {};
      if (Object.prototype.hasOwnProperty.call(body || {}, 'name')) payload.name = String(body.name || '').trim() || 'Nueva proyección';
      if (Object.prototype.hasOwnProperty.call(body || {}, 'year')) payload.year = Math.max(2000, Math.round(Number(body.year) || new Date().getFullYear()));
      if (Object.prototype.hasOwnProperty.call(body || {}, 'start_month')) payload.start_month = Math.max(0, Math.min(11, Math.round(Number(body.start_month) || 0)));
      if (!Object.keys(payload).length) throw new Error('No hay campos para actualizar.');

      const { data, error } = await supabase
        .from('projections')
        .update(payload)
        .eq('id', projectionId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Proyección no encontrada.');
      return { projection: data };
    }

    if (verb === 'DELETE') {
      const { error } = await supabase.from('projections').delete().eq('id', projectionId);
      if (error) throw error;
      return { ok: true, id: projectionId };
    }

    throw new Error(`Método no permitido: ${verb}`);
  }

  const subresource = segments[1];

  if (subresource === 'settings') {
    if (verb === 'GET') {
      const detail = await fetchProjectionDetailViaSupabase(projectionId);
      if (!detail) throw new Error('Proyección no encontrada.');
      return { settings: detail.settings, warnings: buildDistWarning(detail.settings) };
    }

    if (verb === 'PATCH') {
      const detail = await fetchProjectionDetailViaSupabase(projectionId);
      if (!detail) throw new Error('Proyección no encontrada.');

      const nextStartMonth = Object.prototype.hasOwnProperty.call(body || {}, 'start_month')
        ? Math.max(0, Math.min(11, Math.round(Number(body.start_month) || 0)))
        : detail.projection.start_month;

      if (Object.prototype.hasOwnProperty.call(body || {}, 'start_month')) {
        const { error: projectionError } = await supabase
          .from('projections')
          .update({ start_month: nextStartMonth })
          .eq('id', projectionId);
        if (projectionError) throw projectionError;
      }

      const normalized = normalizeProjectionSettings({ ...detail.settings, ...(body || {}) }, { startMonth: nextStartMonth });
      const payload = {
        price_regular: normalized.price_regular,
        price_plus: normalized.price_plus,
        price_premium: normalized.price_premium,
        dist_pct_ceo: normalized.dist_pct_ceo,
        dist_pct_coo: normalized.dist_pct_coo,
        dist_pct_cgo: normalized.dist_pct_cgo,
        sal_min_ceo: normalized.sal_min_ceo,
        sal_min_coo: normalized.sal_min_coo,
        sal_min_cgo: normalized.sal_min_cgo,
        reserva_minima: normalized.reserva_minima,
        meta_mrr_bono: normalized.meta_mrr_bono,
        bono_pct_ceo: normalized.bono_pct_ceo,
        bono_pct_coo: normalized.bono_pct_coo,
        bono_pct_cgo: normalized.bono_pct_cgo,
        positions: normalizeMoneyItems(normalized.positions),
        fixed_expenses: normalizeMoneyItems(normalized.fixed_expenses),
      };

      const { error: settingsError } = await supabase
        .from('projection_settings')
        .update(payload)
        .eq('projection_id', projectionId);
      if (settingsError) throw settingsError;

      const refreshed = await fetchProjectionDetailViaSupabase(projectionId);
      return {
        settings: refreshed?.settings || normalized,
        warnings: buildDistWarning(refreshed?.settings || normalized),
      };
    }

    throw new Error(`Método no permitido: ${verb}`);
  }

  if (subresource === 'months') {
    if (segments.length === 2) {
      if (verb !== 'GET') throw new Error(`Método no permitido: ${verb}`);
      const { data, error } = await supabase
        .from('projection_months')
        .select('*')
        .eq('projection_id', projectionId)
        .order('month_index', { ascending: true });
      if (error) throw error;
      return { months: normalizeMonthsFromRows(data || []) };
    }

    const monthIndex = Number(segments[2]);
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
      throw new Error('Índice de mes inválido.');
    }

    if (verb === 'PATCH' || verb === 'PUT') {
      const raw = { ...(body || {}) };
      if (Object.prototype.hasOwnProperty.call(raw, 'extra_expenses') && !Object.prototype.hasOwnProperty.call(raw, 'extra_expense')) {
        raw.extra_expense = raw.extra_expenses;
      }

      const normalized = normalizeProjectionMonth({ month_index: monthIndex, ...raw }, monthIndex);
      const payload = {};
      [
        'reg_app',
        'reg_cgo',
        'plus_app',
        'plus_cgo',
        'prem_app',
        'prem_cgo',
        'sponsors',
        'municipios',
        'ads',
        'extra_income',
        'extra_expense',
        'notes',
      ].forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(raw, field)) return;
        if (field === 'extra_income' || field === 'extra_expense') {
          payload[field] = normalizeMoneyItems(normalized[field]);
        } else {
          payload[field] = normalized[field];
        }
      });

      if (!Object.keys(payload).length) throw new Error('No hay campos del mes para actualizar.');

      const { data, error } = await supabase
        .from('projection_months')
        .update(payload)
        .eq('projection_id', projectionId)
        .eq('month_index', monthIndex)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Mes no encontrado.');
      return { month: normalizeProjectionMonth(data, monthIndex) };
    }

    throw new Error(`Método no permitido: ${verb}`);
  }

  if (subresource === 'summary') {
    if (verb !== 'GET') throw new Error(`Método no permitido: ${verb}`);
    const detail = await fetchProjectionDetailViaSupabase(projectionId);
    if (!detail) throw new Error('Proyección no encontrada.');
    const summary = calculateProjectionSummary({
      projection: detail.projection,
      settings: detail.settings,
      months: detail.months,
    });
    return {
      months: summary.months,
      kpis: summary.kpis,
      settings: summary.settings,
      bonus_periods: summary.bonus_periods,
    };
  }

  throw new Error('Ruta no encontrada.');
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error('No se encontró token de sesión.');
  return token;
}

async function apiRequest(method, path = '', body = undefined) {
  if (isLocalLiveServerRuntime()) return apiRequestViaSupabase(method, path, body);

  const token = await getAccessToken();
  const urls = getApiCandidateUrls(path);
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;

      const detail = String(payload?.detalle || '').trim();
      const base = String(payload?.error || '').trim();
      const message = detail
        ? (base ? `${base} (${detail})` : detail)
        : (base || `HTTP ${response.status}`);
      const error = new Error(message);
      error.status = response.status;

      if (response.status === 404) {
        lastError = error;
        continue;
      }

      throw error;
    } catch (error) {
      lastError = error;
    }
  }

  // Fallback universal: si Netlify Functions falla, intenta operar directo con Supabase browser.
  // Esto mantiene el módulo utilizable en entornos donde la función API no esté disponible todavía.
  try {
    return await apiRequestViaSupabase(method, path, body);
  } catch (fallbackError) {
    if (!lastError) throw fallbackError;

    const primaryMessage = String(lastError?.message || '').trim();
    const fallbackMessage = String(fallbackError?.message || '').trim();
    const joined = fallbackMessage
      ? `${primaryMessage || 'Error API'} · fallback Supabase: ${fallbackMessage}`
      : (primaryMessage || 'No se pudo completar la solicitud API.');
    const composite = new Error(joined);
    composite.status = lastError?.status || fallbackError?.status;
    throw composite;
  }
}

function getCurrentSummary() {
  return state.liveSummary || state.summary;
}

function getCurrentMonthSummary() {
  return getCurrentSummary()?.months?.[state.selectedMonth] || null;
}

function getCurrentMonthDraft() {
  return state.monthsDraft[state.selectedMonth] || null;
}

function renderDataSummaryPanel() {
  const monthSummary = getCurrentMonthSummary();
  if (!monthSummary) return;

  if (el.dataSummaryMrr) el.dataSummaryMrr.textContent = formatMoney(monthSummary.mrr_total || 0);
  if (el.dataSummaryExcedente) el.dataSummaryExcedente.textContent = formatMoney(monthSummary.excedente || 0);
  if (el.dataSummaryResultado) {
    el.dataSummaryResultado.textContent = formatMoney(monthSummary.resultado_neto || 0);
    el.dataSummaryResultado.className = monthSummary.resultado_neto >= 0 ? 'text-emerald-700' : 'text-red-700';
  }

  if (el.dataPrestartHint) {
    el.dataPrestartHint.textContent = monthSummary.is_pre_start
      ? 'Mes pre-inicio: sueldos y gastos fijos quedan en $0 automáticamente.'
      : 'Mes activo: aplica operación, sueldos mínimos y distribución según caja.';
  }
}

function updateCurrentMonthDraft(updater, options = {}) {
  const rerender = options.rerender !== false;
  const month = getCurrentMonthDraft();
  if (!month) return;

  updater(month);
  state.monthsDraft[state.selectedMonth] = normalizeProjectionMonth(month, state.selectedMonth, {
    preserveEmptyItems: true,
  });

  markDataDirty(true, state.selectedMonth);
  recomputeLiveSummary();
  if (rerender) {
    renderMonthChips();
    renderMonthDetail();
    renderDataForm();
    renderAnnualSection();
    renderPartnersSection();
  } else {
    renderMonthChips();
    renderMonthDetail();
    renderDataSummaryPanel();
    renderAnnualSection();
    renderPartnersSection();
  }
}

function ensureArrayFieldWithEmpty(rows = []) {
  return normalizeMoneyItems(rows, { keepEmpty: true });
}

function recomputeLiveSummary() {
  if (!state.projectionDraft || !state.settingsDraft || !state.monthsDraft.length) return;
  state.liveSummary = calculateProjectionSummary({
    projection: state.projectionDraft,
    settings: state.settingsDraft,
    months: state.monthsDraft,
  });
  renderKpis();
}

function mapSummaryToKpis(summary) {
  if (!summary) {
    return {
      ingresos_total: 0,
      caja_final: 0,
      mrr_diciembre: 0,
      meses_positivos: 0,
      punto_equilibrio: -1,
      total_bonos: 0,
    };
  }
  return summary.kpis || {};
}

function renderKpis() {
  const summary = getCurrentSummary();
  const kpis = mapSummaryToKpis(summary);

  el.kpiIngresosAno.textContent = formatMoney(kpis.ingresos_total || 0);
  el.kpiCajaFinal.textContent = formatMoney(kpis.caja_final || 0);
  el.kpiMrrDic.textContent = formatMoney(kpis.mrr_diciembre || 0);
  el.kpiMesesPositivos.textContent = `${kpis.meses_positivos || 0}/12`;
  el.kpiBonos.textContent = formatMoney(kpis.total_bonos || 0);

  const breakEvenIdx = Number(kpis.punto_equilibrio);
  el.kpiPuntoEq.textContent = Number.isInteger(breakEvenIdx) && breakEvenIdx >= 0
    ? monthName(breakEvenIdx)
    : 'No alcanzado';

  el.kpiCajaFinal.classList.toggle('kpi-positive', (kpis.caja_final || 0) >= 0);
  el.kpiCajaFinal.classList.toggle('kpi-negative', (kpis.caja_final || 0) < 0);

  el.kpiMesesPositivos.classList.remove('text-emerald-700', 'text-amber-700');
  el.kpiMesesPositivos.classList.add((kpis.meses_positivos || 0) >= 6 ? 'text-emerald-700' : 'text-amber-700');
}

function buildAnnualRows(summary) {
  const months = summary?.months || [];
  const read = (key) => months.map((month) => Number(month[key] || 0));

  return [
    { section: 'Comercios', label: 'Regular acumulado', values: read('tot_regular'), money: false },
    { section: 'Comercios', label: 'Plus acumulado', values: read('tot_plus'), money: false },
    { section: 'Comercios', label: 'Premium acumulado', values: read('tot_premium'), money: false },

    { section: 'Ingresos', label: 'MRR total', values: read('mrr_total'), cls: 'text-teal-700' },
    {
      section: 'Ingresos',
      label: 'Sponsors + Municipios',
      values: months.map((month) => Number(month.sponsors || 0) + Number(month.municipios || 0)),
    },
    { section: 'Ingresos', label: 'Ingresos totales', values: read('ingresos'), strong: true, cls: 'text-emerald-700' },

    { section: 'Gastos', label: 'Gastos operativos', values: read('total_op') },
    { section: 'Gastos', label: 'Sueldos mínimos', values: read('total_salarios') },
    { section: 'Gastos', label: 'Excedente distribuido', values: read('dist_amount'), cls: 'text-teal-700' },
    { section: 'Gastos', label: 'Bonos período', values: read('bonos_mes'), cls: 'text-violet-700' },

    { section: 'Resultados', label: 'Resultado empresa', values: read('resultado_neto'), strong: true, toneByValue: true },
    {
      section: 'Resultados',
      label: 'Caja acumulada',
      values: read('caja_acumulada'),
      strong: true,
      toneByValue: true,
      totalMode: 'final',
    },

    { section: 'Socios total mes', label: 'CEO total', values: read('total_ceo'), strong: true, cls: 'text-teal-700' },
    { section: 'Socios total mes', label: 'COO total', values: read('total_coo'), strong: true, cls: 'text-emerald-700' },
    { section: 'Socios total mes', label: 'CGO total', values: read('total_cgo'), strong: true, cls: 'text-amber-700' },
  ];
}

function renderAnnualCharts(summary) {
  const months = summary?.months || [];
  const maxMrr = Math.max(1, ...months.map((month) => Number(month.mrr_total || 0)));
  const maxNetAbs = Math.max(1, ...months.map((month) => Math.abs(Number(month.resultado_neto || 0))));

  el.annualMrrChart.innerHTML = months
    .map((month) => {
      const width = (Number(month.mrr_total || 0) / maxMrr) * 100;
      const color = month.is_bono_month ? 'bg-amber-400' : 'bg-teal-500';
      const star = month.is_bono_month ? (month.bono_ok ? ' ★' : ' ☆') : '';
      return `
        <div class="grid grid-cols-[48px_1fr_80px] gap-2 items-center">
          <span class="text-xs text-gray-600">${monthShort(month.month_index)}${star}</span>
          <div class="w-full bg-gray-200 rounded h-3">
            <div class="mini-bar h-3 ${color}" style="width:${Math.max(2, width)}%"></div>
          </div>
          <span class="text-xs text-right text-gray-700">${formatMoney(month.mrr_total)}</span>
        </div>
      `;
    })
    .join('');

  el.annualNetChart.innerHTML = months
    .map((month) => {
      const abs = Math.abs(Number(month.resultado_neto || 0));
      const width = (abs / maxNetAbs) * 100;
      const color = month.resultado_neto >= 0 ? 'bg-emerald-500' : 'bg-red-500';
      return `
        <div class="grid grid-cols-[48px_1fr_80px] gap-2 items-center">
          <span class="text-xs text-gray-600">${monthShort(month.month_index)}</span>
          <div class="w-full bg-gray-200 rounded h-3">
            <div class="mini-bar h-3 ${color}" style="width:${Math.max(2, width)}%"></div>
          </div>
          <span class="text-xs text-right ${month.resultado_neto >= 0 ? 'text-emerald-700' : 'text-red-700'}">${formatMoney(month.resultado_neto)}</span>
        </div>
      `;
    })
    .join('');
}

function renderAnnualTable(summary) {
  const months = summary?.months || [];
  if (!months.length) {
    el.annualTableContainer.innerHTML = '<p class="text-sm text-gray-500">Sin datos.</p>';
    return;
  }

  const rows = buildAnnualRows(summary);
  const sectionRendered = new Set();

  const head = months
    .map((month) => {
      const star = month.is_bono_month ? (month.bono_ok ? '⭐' : '☆') : '';
      const pre = month.is_pre_start ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-700';
      return `<th class="px-2 py-2 text-xs font-semibold whitespace-nowrap ${pre}">${monthShort(month.month_index)} ${star}</th>`;
    })
    .join('');

  const body = rows
    .map((row) => {
      const sectionLine = sectionRendered.has(row.section)
        ? ''
        : `<tr class="bg-slate-100 border-t border-slate-200"><td class="sticky-col px-3 py-2 font-semibold text-slate-800">${row.section}</td>${Array.from({ length: 13 }).map(() => '<td></td>').join('')}</tr>`;
      sectionRendered.add(row.section);

      const total = row.totalMode === 'final'
        ? row.values[row.values.length - 1]
        : row.values.reduce((sum, value) => sum + value, 0);

      const cells = row.values
        .map((value, index) => {
          const month = months[index];
          const faded = month?.is_pre_start ? 'text-gray-400' : '';
          const tone = row.toneByValue ? (value >= 0 ? 'text-emerald-700' : 'text-red-700') : (row.cls || 'text-gray-800');
          const weight = row.strong ? 'font-semibold' : '';
          const content = row.money === false ? Math.round(value).toLocaleString('en-US') : formatMoney(value);
          return `<td class="px-2 py-2 text-right text-sm ${tone} ${faded} ${weight}">${content}</td>`;
        })
        .join('');

      const totalTone = row.toneByValue
        ? (total >= 0 ? 'text-emerald-700' : 'text-red-700')
        : (row.cls || 'text-gray-900');
      const totalContent = row.money === false ? Math.round(total).toLocaleString('en-US') : formatMoney(total);

      return `
        ${sectionLine}
        <tr class="border-t border-gray-100">
          <td class="sticky-col px-3 py-2 text-sm ${row.strong ? 'font-semibold' : ''}">${row.label}</td>
          ${cells}
          <td class="px-2 py-2 text-right text-sm ${row.strong ? 'font-semibold' : ''} ${totalTone}">${totalContent}</td>
        </tr>
      `;
    })
    .join('');

  el.annualTableContainer.innerHTML = `
    <table class="min-w-[1100px] w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
      <thead>
        <tr class="border-b border-gray-200">
          <th class="sticky-col px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Concepto</th>
          ${head}
          <th class="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Total</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderAnnualSection() {
  const summary = getCurrentSummary();
  if (!summary) {
    el.annualTableContainer.innerHTML = '<p class="text-sm text-gray-500">Sin datos.</p>';
    el.annualMrrChart.innerHTML = '';
    el.annualNetChart.innerHTML = '';
    return;
  }

  renderAnnualCharts(summary);
  renderAnnualTable(summary);

  if (el.annualHint) {
    const start = monthName(summary.projection?.start_month || 0);
    el.annualHint.textContent = `Inicio del proyecto: ${start} ${summary.projection?.year || ''}`.trim();
  }
}

function buildMonthChipsHtml(months = []) {
  return months
    .map((month) => {
      const active = month.month_index === state.selectedMonth;
      const star = month.is_bono_month ? (month.bono_ok ? '⭐' : '☆') : '';
      const dotColor = month.month_tone === 'positive'
        ? 'bg-emerald-500'
        : month.month_tone === 'negative'
          ? 'bg-red-500'
          : 'bg-gray-400';
      return `
        <button
          type="button"
          class="month-chip ${active ? 'active' : ''} border px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-2"
          data-month-index="${month.month_index}"
          data-tone="${month.month_tone}"
        >
          <span>${monthShort(month.month_index)}</span>
          <span class="h-2 w-2 rounded-full ${dotColor}"></span>
          <span>${star}</span>
        </button>
      `;
    })
    .join('');
}

function bindChipClicks(root) {
  root?.querySelectorAll('[data-month-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const monthIndex = Number(button.dataset.monthIndex);
      if (!Number.isInteger(monthIndex)) return;
      state.selectedMonth = Math.max(0, Math.min(11, monthIndex));
      renderMonthChips();
      renderMonthDetail();
      renderDataForm();
    });
  });
}

function renderMonthChips() {
  const months = getCurrentSummary()?.months || [];
  const html = buildMonthChipsHtml(months);

  if (el.monthChipsDetail) {
    el.monthChipsDetail.innerHTML = html;
    bindChipClicks(el.monthChipsDetail);
  }

  if (el.monthChipsData) {
    el.monthChipsData.innerHTML = html;
    bindChipClicks(el.monthChipsData);
  }
}

function listItemsHtml(items = [], emptyLabel = 'Sin items') {
  if (!Array.isArray(items) || !items.length) {
    return `<p class="text-xs text-gray-400">${emptyLabel}</p>`;
  }

  return `
    <ul class="space-y-1 text-sm">
      ${items.map((item) => `<li class="flex justify-between gap-2"><span>${escapeHtml(item.label || 'Item')}</span><strong>${formatMoney(item.amount || 0)}</strong></li>`).join('')}
    </ul>
  `;
}

function renderMonthDetail() {
  const month = getCurrentMonthSummary();
  if (!month || !el.monthDetailContainer) {
    el.monthDetailContainer.innerHTML = '<p class="text-sm text-gray-500">Sin datos.</p>';
    return;
  }

  const preBadge = month.is_pre_start
    ? '<span class="text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-700">Pre-inicio</span>'
    : '';
  const bonusBadge = month.is_bono_month
    ? `<span class="text-xs px-2 py-1 rounded-full ${month.bono_ok ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'}">★ Bono</span>`
    : '';

  const reserveAlert = !month.puede_distribuir && month.excedente > 0
    ? `<p class="text-sm text-amber-700 mt-2">Caja acumulada por debajo de reserva mínima: no se distribuye excedente este mes.</p>`
    : '';

  const bonusBlock = month.is_bono_month
    ? `
      <section class="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <h4 class="font-semibold text-gray-900">Bono período</h4>
        <p class="text-sm">Excedente acumulado período: <strong>${formatMoney(month.periodo_acc)}</strong></p>
        <p class="text-sm">MRR vs meta: <strong>${formatMoney(month.mrr_total)}</strong> / <strong>${formatMoney(state.settingsDraft?.meta_mrr_bono || 0)}</strong></p>
        ${month.bono_ok
          ? `<div class="grid md:grid-cols-3 gap-2 text-sm">
              <p>CEO: <strong class="text-emerald-700">${formatMoney(month.bono_ceo)}</strong></p>
              <p>COO: <strong class="text-emerald-700">${formatMoney(month.bono_coo)}</strong></p>
              <p>CGO: <strong class="text-emerald-700">${formatMoney(month.bono_cgo)}</strong></p>
            </div>`
          : '<p class="text-sm text-red-700">No cumple meta MRR para activar bono.</p>'}
      </section>
    `
    : '';

  el.monthDetailContainer.innerHTML = `
    <section class="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h3 class="font-semibold text-gray-900">${month.nombre}</h3>
        <div class="flex items-center gap-2">${preBadge}${bonusBadge}</div>
      </div>
      <p class="text-sm mt-1 ${month.resultado_neto >= 0 ? 'text-emerald-700' : 'text-red-700'}">Resultado neto: <strong>${formatMoney(month.resultado_neto)}</strong></p>
    </section>

    <section class="grid lg:grid-cols-2 gap-3">
      <article class="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
        <h4 class="font-semibold text-gray-900">Ingresos</h4>
        <p class="text-sm">MRR App: <strong>${formatMoney(month.mrr_selfservice)}</strong></p>
        <p class="text-sm">MRR CGO: <strong>${formatMoney(month.mrr_cgo)}</strong></p>
        <p class="text-sm">Sponsors: <strong>${formatMoney(month.sponsors)}</strong></p>
        <p class="text-sm">Municipios: <strong>${formatMoney(month.municipios)}</strong></p>
        <p class="text-sm">Ingresos extra: <strong>${formatMoney(month.extra_income_total)}</strong></p>
        <p class="text-sm text-emerald-700">Total ingresos: <strong>${formatMoney(month.ingresos)}</strong></p>
      </article>

      <article class="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
        <h4 class="font-semibold text-gray-900">Gastos y sueldos</h4>
        <p class="text-sm">Gastos fijos: <strong>${formatMoney(month.gastos_fijos)}</strong></p>
        <p class="text-sm">Nómina adicional: <strong>${formatMoney(month.gastos_posiciones)}</strong></p>
        <p class="text-sm">Publicidad: <strong>${formatMoney(month.gastos_ads)}</strong></p>
        <p class="text-sm">Gastos extra: <strong>${formatMoney(month.gastos_extra)}</strong></p>
        <p class="text-sm">Sueldo mín. CEO: <strong>${formatMoney(month.sal_ceo)}</strong></p>
        <p class="text-sm">Sueldo mín. COO: <strong>${formatMoney(month.sal_coo)}</strong></p>
        <p class="text-sm">Sueldo mín. CGO: <strong>${formatMoney(month.sal_cgo)}</strong></p>
      </article>
    </section>

    <section class="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
      <h4 class="font-semibold text-gray-900">Distribución excedente</h4>
      <p class="text-sm">Utilidad bruta: <strong>${formatMoney(month.utilidad_bruta)}</strong></p>
      <p class="text-sm">Excedente disponible: <strong>${formatMoney(month.excedente)}</strong></p>
      <p class="text-sm">Distribución CEO/COO/CGO: <strong>${formatMoney(month.dist_ceo)}</strong> / <strong>${formatMoney(month.dist_coo)}</strong> / <strong>${formatMoney(month.dist_cgo)}</strong></p>
      ${reserveAlert}
    </section>

    ${bonusBlock}

    <section class="grid lg:grid-cols-2 gap-3">
      <article class="bg-white border border-gray-200 rounded-xl p-4">
        <h4 class="font-semibold text-gray-900">Total socios</h4>
        <p class="text-sm">CEO: <strong class="text-teal-700">${formatMoney(month.total_ceo)}</strong></p>
        <p class="text-sm">COO: <strong class="text-emerald-700">${formatMoney(month.total_coo)}</strong></p>
        <p class="text-sm">CGO: <strong class="text-amber-700">${formatMoney(month.total_cgo)}</strong></p>
      </article>
      <article class="bg-white border border-gray-200 rounded-xl p-4">
        <h4 class="font-semibold text-gray-900">Empresa</h4>
        <p class="text-sm ${month.resultado_neto >= 0 ? 'text-emerald-700' : 'text-red-700'}">Resultado neto: <strong>${formatMoney(month.resultado_neto)}</strong></p>
        <p class="text-sm ${month.caja_acumulada >= 0 ? 'text-emerald-700' : 'text-red-700'}">Caja acumulada: <strong>${formatMoney(month.caja_acumulada)}</strong></p>
      </article>
    </section>

    <section class="bg-white border border-gray-200 rounded-xl p-4 space-y-1">
      <h4 class="font-semibold text-gray-900">Comercios acumulados</h4>
      <p class="text-sm">Regular: <strong>${month.tot_regular}</strong></p>
      <p class="text-sm">Plus: <strong>${month.tot_plus}</strong></p>
      <p class="text-sm">Premium: <strong>${month.tot_premium}</strong></p>
      <p class="text-sm">MRR total: <strong>${formatMoney(month.mrr_total)}</strong></p>
    </section>
  `;
}

function renderListEditor(container, items, onChange, labels = {}) {
  if (!container) return;
  const list = Array.isArray(items) ? items : [];

  if (!list.length) {
    container.innerHTML = '<p class="text-xs text-gray-400">Sin items.</p>';
    return;
  }

  container.innerHTML = '';
  list.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-12 gap-2 items-center';
    row.innerHTML = `
      <input data-kind="label" data-index="${index}" type="text" class="col-span-7 border rounded px-3 py-2" placeholder="${labels.label || 'Descripción'}" value="${escapeHtml(item?.label || '')}">
      <input data-kind="amount" data-index="${index}" type="number" min="0" step="1" class="col-span-4 border rounded px-3 py-2" placeholder="${labels.amount || 'Monto'}" value="${Math.round(Number(item?.amount) || 0)}">
      <button data-kind="remove" data-index="${index}" type="button" class="col-span-1 text-red-600 text-sm">✕</button>
    `;

    row.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', (event) => {
        const kind = event.target.dataset.kind;
        const idx = Number(event.target.dataset.index);
        onChange({ type: 'edit', kind, index: idx, value: event.target.value });
      });
    });

    row.querySelector('[data-kind="remove"]')?.addEventListener('click', (event) => {
      const idx = Number(event.target.dataset.index);
      onChange({ type: 'remove', index: idx });
    });

    container.appendChild(row);
  });
}

function renderDataForm() {
  const monthDraft = getCurrentMonthDraft();
  const monthSummary = getCurrentMonthSummary();
  if (!monthDraft || !monthSummary) return;

  el.dataRegApp.value = String(toInt(monthDraft.reg_app, 0));
  el.dataRegCgo.value = String(toInt(monthDraft.reg_cgo, 0));
  el.dataPlusApp.value = String(toInt(monthDraft.plus_app, 0));
  el.dataPlusCgo.value = String(toInt(monthDraft.plus_cgo, 0));
  el.dataPremApp.value = String(toInt(monthDraft.prem_app, 0));
  el.dataPremCgo.value = String(toInt(monthDraft.prem_cgo, 0));
  el.dataSponsors.value = String(toInt(monthDraft.sponsors, 0));
  el.dataMunicipios.value = String(toInt(monthDraft.municipios, 0));
  el.dataAds.value = String(toInt(monthDraft.ads, 0));
  el.dataNotes.value = String(monthDraft.notes || '');

  renderListEditor(el.dataExtraIncomeList, monthDraft.extra_income, (action) => {
    updateCurrentMonthDraft((draft) => {
      const list = Array.isArray(draft.extra_income) ? [...draft.extra_income] : [];
      if (action.type === 'remove') {
        list.splice(action.index, 1);
      } else if (action.type === 'edit') {
        const row = list[action.index] || { label: '', amount: 0 };
        if (action.kind === 'label') row.label = action.value;
        if (action.kind === 'amount') row.amount = toMoney(action.value, 0);
        list[action.index] = row;
      }
      draft.extra_income = ensureArrayFieldWithEmpty(list);
    }, { rerender: action.type !== 'edit' });
  }, { label: 'Ingreso extraordinario', amount: 'Monto' });

  renderListEditor(el.dataExtraExpenseList, monthDraft.extra_expense, (action) => {
    updateCurrentMonthDraft((draft) => {
      const list = Array.isArray(draft.extra_expense) ? [...draft.extra_expense] : [];
      if (action.type === 'remove') {
        list.splice(action.index, 1);
      } else if (action.type === 'edit') {
        const row = list[action.index] || { label: '', amount: 0 };
        if (action.kind === 'label') row.label = action.value;
        if (action.kind === 'amount') row.amount = toMoney(action.value, 0);
        list[action.index] = row;
      }
      draft.extra_expense = ensureArrayFieldWithEmpty(list);
    }, { rerender: action.type !== 'edit' });
  }, { label: 'Gasto extraordinario', amount: 'Monto' });

  renderDataSummaryPanel();

  markDataDirty(state.dirtyMonths.has(state.selectedMonth), state.selectedMonth);
}

function readDataFormIntoDraft() {
  updateCurrentMonthDraft((draft) => {
    draft.reg_app = toInt(el.dataRegApp.value, 0);
    draft.reg_cgo = toInt(el.dataRegCgo.value, 0);
    draft.plus_app = toInt(el.dataPlusApp.value, 0);
    draft.plus_cgo = toInt(el.dataPlusCgo.value, 0);
    draft.prem_app = toInt(el.dataPremApp.value, 0);
    draft.prem_cgo = toInt(el.dataPremCgo.value, 0);
    draft.sponsors = toMoney(el.dataSponsors.value, 0);
    draft.municipios = toMoney(el.dataMunicipios.value, 0);
    draft.ads = toMoney(el.dataAds.value, 0);
    draft.notes = String(el.dataNotes.value || '');
  }, { rerender: false });
}

function validateMoneyItemLabels(items) {
  const list = Array.isArray(items) ? items : [];
  return !list.some((item) => (Number(item?.amount || 0) > 0) && !String(item?.label || '').trim());
}

async function saveSelectedMonth() {
  if (!state.currentProjectionId) return;
  readDataFormIntoDraft();

  const month = getCurrentMonthDraft();
  if (!month) return;

  if (!validateMoneyItemLabels(month.extra_income) || !validateMoneyItemLabels(month.extra_expense)) {
    alert('Cada ingreso o gasto extraordinario con monto debe tener etiqueta.');
    return;
  }

  setDataSaveStatus('Guardando mes...', 'info');

  const payload = {
    reg_app: month.reg_app,
    reg_cgo: month.reg_cgo,
    plus_app: month.plus_app,
    plus_cgo: month.plus_cgo,
    prem_app: month.prem_app,
    prem_cgo: month.prem_cgo,
    sponsors: month.sponsors,
    municipios: month.municipios,
    ads: month.ads,
    extra_income: normalizeMoneyItems(month.extra_income),
    extra_expense: normalizeMoneyItems(month.extra_expense),
    notes: String(month.notes || ''),
  };

  try {
    await apiRequest('PATCH', `${state.currentProjectionId}/months/${state.selectedMonth}`, payload);
    await refreshCurrentProjection();
    markDataDirty(false, state.selectedMonth);
    setDataSaveStatus('Guardado ✓', 'success');
  } catch (error) {
    console.error('Error guardando mes:', error);
    setDataSaveStatus(`Error: ${error.message}`, 'error');
  }
}

function getPartnerTotals(summary) {
  const months = summary?.months || [];
  const period1End = summary?.bonus_periods?.first_period_end ?? Math.min((summary?.projection?.start_month || 0) + 5, 11);
  const period2End = summary?.bonus_periods?.second_period_end ?? 11;

  const at = (idx) => months[idx] || {};
  return {
    ceo: {
      salary: months.reduce((s, month) => s + Number(month.sal_ceo || 0), 0),
      dist: months.reduce((s, month) => s + Number(month.dist_ceo || 0), 0),
      bonus1: Number(at(period1End).bono_ceo || 0),
      bonus2: Number(at(period2End).bono_ceo || 0),
      total: months.reduce((s, month) => s + Number(month.total_ceo || 0), 0),
    },
    coo: {
      salary: months.reduce((s, month) => s + Number(month.sal_coo || 0), 0),
      dist: months.reduce((s, month) => s + Number(month.dist_coo || 0), 0),
      bonus1: Number(at(period1End).bono_coo || 0),
      bonus2: Number(at(period2End).bono_coo || 0),
      total: months.reduce((s, month) => s + Number(month.total_coo || 0), 0),
    },
    cgo: {
      salary: months.reduce((s, month) => s + Number(month.sal_cgo || 0), 0),
      dist: months.reduce((s, month) => s + Number(month.dist_cgo || 0), 0),
      bonus1: Number(at(period1End).bono_cgo || 0),
      bonus2: Number(at(period2End).bono_cgo || 0),
      total: months.reduce((s, month) => s + Number(month.total_cgo || 0), 0),
    },
    period1End,
    period2End,
  };
}

function renderPartnerCards(summary) {
  if (!el.partnerCards) return;
  const totals = getPartnerTotals(summary);
  const meta = Number(state.settingsDraft?.meta_mrr_bono || 0);

  const progressFor = (month) => {
    const mrr = Number(month?.mrr_total || 0);
    if (meta <= 0) return { pct: 100, label: `${formatMoney(mrr)} / Sin meta` };
    const pct = Math.min(100, Math.round((mrr / meta) * 100));
    return { pct, label: `${formatMoney(mrr)} / ${formatMoney(meta)}` };
  };

  const p1 = summary.months[totals.period1End] || {};
  const p2 = summary.months[totals.period2End] || {};
  const p1Bar = progressFor(p1);
  const p2Bar = progressFor(p2);

  const cards = [
    { key: 'ceo', name: 'CEO', role: 'Producto / tecnología', tone: 'teal', data: totals.ceo },
    { key: 'coo', name: 'COO', role: 'Operaciones', tone: 'emerald', data: totals.coo },
    { key: 'cgo', name: 'CGO', role: 'Ventas y crecimiento', tone: 'amber', data: totals.cgo },
  ];

  const toneMap = {
    teal: 'text-teal-700 bg-teal-50 border-teal-200',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
  };

  el.partnerCards.innerHTML = cards
    .map((card) => `
      <article class="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold ${toneMap[card.tone]} inline-flex px-2 py-1 rounded-full border">${card.name}</p>
            <p class="text-xs text-gray-500 mt-1">${card.role}</p>
          </div>
          <p class="text-lg font-semibold ${toneMap[card.tone].split(' ')[0]}">${formatMoney(card.data.total)}</p>
        </div>
        <p class="text-sm">Sueldos mínimos año: <strong>${formatMoney(card.data.salary)}</strong></p>
        <p class="text-sm">Distribución excedente año: <strong>${formatMoney(card.data.dist)}</strong></p>
        <p class="text-sm">Bono período 1 (${monthName(totals.period1End)}): <strong class="${card.data.bonus1 > 0 ? 'text-emerald-700' : 'text-red-700'}">${card.data.bonus1 > 0 ? formatMoney(card.data.bonus1) : 'No cumple'}</strong></p>
        <p class="text-sm">Bono período 2 (${monthName(totals.period2End)}): <strong class="${card.data.bonus2 > 0 ? 'text-emerald-700' : 'text-red-700'}">${card.data.bonus2 > 0 ? formatMoney(card.data.bonus2) : 'No cumple'}</strong></p>
        <div class="pt-1">
          <p class="text-xs text-gray-500">Progreso período 1</p>
          <div class="w-full h-2 rounded bg-gray-200 mt-1"><div class="h-2 rounded bg-teal-500" style="width:${p1Bar.pct}%"></div></div>
          <p class="text-xs text-gray-500 mt-1">${p1Bar.label}</p>
        </div>
        <div class="pt-1">
          <p class="text-xs text-gray-500">Progreso período 2</p>
          <div class="w-full h-2 rounded bg-gray-200 mt-1"><div class="h-2 rounded bg-amber-500" style="width:${p2Bar.pct}%"></div></div>
          <p class="text-xs text-gray-500 mt-1">${p2Bar.label}</p>
        </div>
      </article>
    `)
    .join('');
}

function renderPartnersTable(summary) {
  const months = summary?.months || [];
  if (!months.length) {
    el.partnersTableContainer.innerHTML = '<p class="text-sm text-gray-500">Sin datos.</p>';
    return;
  }

  const rows = [
    { label: 'Sueldo CEO', values: months.map((m) => m.sal_ceo) },
    { label: 'Distribución CEO', values: months.map((m) => m.dist_ceo) },
    { label: 'Total CEO', values: months.map((m) => m.total_ceo), strong: true, cls: 'text-teal-700' },

    { label: 'Sueldo COO', values: months.map((m) => m.sal_coo) },
    { label: 'Distribución COO', values: months.map((m) => m.dist_coo) },
    { label: 'Total COO', values: months.map((m) => m.total_coo), strong: true, cls: 'text-emerald-700' },

    { label: 'Sueldo CGO', values: months.map((m) => m.sal_cgo) },
    { label: 'Distribución CGO', values: months.map((m) => m.dist_cgo) },
    { label: 'Total CGO', values: months.map((m) => m.total_cgo), strong: true, cls: 'text-amber-700' },

    { label: 'Ingresos', values: months.map((m) => m.ingresos) },
    { label: 'Gastos op.', values: months.map((m) => m.total_op) },
    { label: 'Sueldos mín.', values: months.map((m) => m.total_salarios) },
    { label: 'Excedente', values: months.map((m) => m.excedente) },
    { label: 'Bonos', values: months.map((m) => m.bonos_mes), cls: 'text-violet-700' },
    { label: 'Resultado', values: months.map((m) => m.resultado_neto), toneByValue: true, strong: true },
    { label: 'Caja acum.', values: months.map((m) => m.caja_acumulada), toneByValue: true, strong: true, totalMode: 'final' },
  ];

  const head = months
    .map((month) => `<th class="px-2 py-2 text-xs font-semibold whitespace-nowrap ${month.is_pre_start ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-700'}">${monthShort(month.month_index)}</th>`)
    .join('');

  const body = rows
    .map((row) => {
      const total = row.totalMode === 'final'
        ? Number(row.values[row.values.length - 1] || 0)
        : row.values.reduce((sum, value) => sum + Number(value || 0), 0);

      const cells = row.values
        .map((value, index) => {
          const month = months[index];
          const faded = month.is_pre_start ? 'text-gray-400' : '';
          const tone = row.toneByValue
            ? (value >= 0 ? 'text-emerald-700' : 'text-red-700')
            : (row.cls || 'text-gray-800');
          return `<td class="px-2 py-2 text-right text-sm ${row.strong ? 'font-semibold' : ''} ${tone} ${faded}">${formatMoney(value)}</td>`;
        })
        .join('');

      const totalTone = row.toneByValue
        ? (total >= 0 ? 'text-emerald-700' : 'text-red-700')
        : (row.cls || 'text-gray-900');

      return `
        <tr class="border-t border-gray-100">
          <td class="sticky-col px-3 py-2 text-sm ${row.strong ? 'font-semibold' : ''}">${row.label}</td>
          ${cells}
          <td class="px-2 py-2 text-right text-sm ${row.strong ? 'font-semibold' : ''} ${totalTone}">${formatMoney(total)}</td>
        </tr>
      `;
    })
    .join('');

  el.partnersTableContainer.innerHTML = `
    <table class="min-w-[1100px] w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
      <thead>
        <tr class="border-b border-gray-200">
          <th class="sticky-col px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Concepto</th>
          ${head}
          <th class="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Total año</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderPartnersSection() {
  const summary = getCurrentSummary();
  if (!summary) {
    el.partnerCards.innerHTML = '<p class="text-sm text-gray-500">Sin datos.</p>';
    el.partnersTableContainer.innerHTML = '';
    return;
  }

  renderPartnerCards(summary);
  renderPartnersTable(summary);
}

function updateDistHint() {
  const sum =
    toPct(el.cfgDistCeo.value, 0) +
    toPct(el.cfgDistCoo.value, 0) +
    toPct(el.cfgDistCgo.value, 0);

  const rounded = Math.round(sum * 100) / 100;
  const ok = Math.abs(rounded - 100) < 0.01;

  if (!el.distPctHint) return;
  el.distPctHint.textContent = ok
    ? `Suma actual: ${rounded}% (correcto)`
    : `Suma actual: ${rounded}% (se normaliza automáticamente en cálculo)`;

  el.distPctHint.className = ok ? 'text-xs text-emerald-700' : 'text-xs text-amber-700';
}

function renderSettingsListEditor(container, items, onAction) {
  if (!container) return;
  const list = Array.isArray(items) ? items : [];

  if (!list.length) {
    container.innerHTML = '<p class="text-xs text-gray-400">Sin items.</p>';
    return;
  }

  container.innerHTML = '';
  list.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-12 gap-2 items-center';
    row.innerHTML = `
      <input data-kind="label" data-index="${index}" type="text" class="col-span-7 border rounded px-3 py-2" placeholder="Nombre" value="${escapeHtml(item?.label || '')}">
      <input data-kind="amount" data-index="${index}" type="number" min="0" step="1" class="col-span-4 border rounded px-3 py-2" placeholder="Monto" value="${Math.round(Number(item?.amount) || 0)}">
      <button data-kind="remove" data-index="${index}" type="button" class="col-span-1 text-red-600 text-sm">✕</button>
    `;

    row.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', (event) => {
        const idx = Number(event.target.dataset.index);
        const kind = event.target.dataset.kind;
        onAction({ type: 'edit', index: idx, kind, value: event.target.value });
      });
    });

    row.querySelector('[data-kind="remove"]')?.addEventListener('click', (event) => {
      const idx = Number(event.target.dataset.index);
      onAction({ type: 'remove', index: idx });
    });

    container.appendChild(row);
  });
}

function renderSettingsForm() {
  if (!state.settingsDraft || !state.projectionDraft) return;
  const settings = state.settingsDraft;

  el.cfgPriceRegular.value = String(toInt(settings.price_regular, 65));
  el.cfgPricePlus.value = String(toInt(settings.price_plus, 95));
  el.cfgPricePremium.value = String(toInt(settings.price_premium, 155));

  el.cfgStartMonth.value = String(state.projectionDraft.start_month || 0);

  el.cfgDistCeo.value = String(toPct(settings.dist_pct_ceo, 60));
  el.cfgDistCoo.value = String(toPct(settings.dist_pct_coo, 25));
  el.cfgDistCgo.value = String(toPct(settings.dist_pct_cgo, 15));

  el.cfgSalMinCeo.value = String(toInt(settings.sal_min_ceo, 800));
  el.cfgSalMinCoo.value = String(toInt(settings.sal_min_coo, 700));
  el.cfgSalMinCgo.value = String(toInt(settings.sal_min_cgo, 400));
  el.cfgReservaMinima.value = String(toInt(settings.reserva_minima, 3000));

  el.cfgMetaMrrBono.value = String(toInt(settings.meta_mrr_bono, 5000));
  el.cfgBonoPctCeo.value = String(toPct(settings.bono_pct_ceo, 10));
  el.cfgBonoPctCoo.value = String(toPct(settings.bono_pct_coo, 5));
  el.cfgBonoPctCgo.value = String(toPct(settings.bono_pct_cgo, 3));

  renderSettingsListEditor(el.positionsList, settings.positions, (action) => {
    const list = ensureArrayFieldWithEmpty(settings.positions || []);
    if (action.type === 'remove') {
      list.splice(action.index, 1);
    } else if (action.type === 'edit') {
      const row = list[action.index] || { label: '', amount: 0 };
      if (action.kind === 'label') row.label = action.value;
      if (action.kind === 'amount') row.amount = toMoney(action.value, 0);
      list[action.index] = row;
    }
    state.settingsDraft.positions = ensureArrayFieldWithEmpty(list);
    markSettingsDirty(true);
    recomputeLiveSummary();
    if (action.type !== 'edit') renderSettingsForm();
    else {
      updateDistHint();
      renderDataSummaryPanel();
    }
    renderMonthDetail();
    renderAnnualSection();
    renderPartnersSection();
  });

  renderSettingsListEditor(el.fixedExpensesList, settings.fixed_expenses, (action) => {
    const list = ensureArrayFieldWithEmpty(settings.fixed_expenses || []);
    if (action.type === 'remove') {
      list.splice(action.index, 1);
    } else if (action.type === 'edit') {
      const row = list[action.index] || { label: '', amount: 0 };
      if (action.kind === 'label') row.label = action.value;
      if (action.kind === 'amount') row.amount = toMoney(action.value, 0);
      list[action.index] = row;
    }
    state.settingsDraft.fixed_expenses = ensureArrayFieldWithEmpty(list);
    markSettingsDirty(true);
    recomputeLiveSummary();
    if (action.type !== 'edit') renderSettingsForm();
    else {
      updateDistHint();
      renderDataSummaryPanel();
    }
    renderMonthDetail();
    renderAnnualSection();
    renderPartnersSection();
  });

  updateDistHint();

  const summary = getCurrentSummary();
  if (summary?.bonus_periods && el.bonusPeriodHint) {
    const p1 = monthName(summary.bonus_periods.first_period_end);
    const p2 = monthName(summary.bonus_periods.second_period_end);
    el.bonusPeriodHint.textContent = `Período 1 vence en ${p1}. Período 2 siempre en ${p2}.`;
  }

  markSettingsDirty(state.settingsDirty);
}

function syncSettingsDraftFromInputs() {
  if (!state.settingsDraft || !state.projectionDraft) return;

  state.projectionDraft.start_month = Math.max(0, Math.min(11, toInt(el.cfgStartMonth.value, state.projectionDraft.start_month || 0)));

  state.settingsDraft = normalizeProjectionSettings({
    ...state.settingsDraft,
    start_month: state.projectionDraft.start_month,
    price_regular: toInt(el.cfgPriceRegular.value, 65),
    price_plus: toInt(el.cfgPricePlus.value, 95),
    price_premium: toInt(el.cfgPricePremium.value, 155),
    dist_pct_ceo: toPct(el.cfgDistCeo.value, 60),
    dist_pct_coo: toPct(el.cfgDistCoo.value, 25),
    dist_pct_cgo: toPct(el.cfgDistCgo.value, 15),
    sal_min_ceo: toInt(el.cfgSalMinCeo.value, 800),
    sal_min_coo: toInt(el.cfgSalMinCoo.value, 700),
    sal_min_cgo: toInt(el.cfgSalMinCgo.value, 400),
    reserva_minima: toInt(el.cfgReservaMinima.value, 3000),
    meta_mrr_bono: toInt(el.cfgMetaMrrBono.value, 5000),
    bono_pct_ceo: toPct(el.cfgBonoPctCeo.value, 10),
    bono_pct_coo: toPct(el.cfgBonoPctCoo.value, 5),
    bono_pct_cgo: toPct(el.cfgBonoPctCgo.value, 3),
    positions: ensureArrayFieldWithEmpty(state.settingsDraft.positions || []),
    fixed_expenses: ensureArrayFieldWithEmpty(state.settingsDraft.fixed_expenses || []),
  }, {
    startMonth: state.projectionDraft.start_month,
    preserveEmptyItems: true,
  });

  markSettingsDirty(true);
  recomputeLiveSummary();
  updateDistHint();
  renderAnnualSection();
  renderMonthDetail();
  renderPartnersSection();
}

async function saveSettings() {
  if (!state.currentProjectionId) return;
  syncSettingsDraftFromInputs();

  if (!validateMoneyItemLabels(state.settingsDraft.positions) || !validateMoneyItemLabels(state.settingsDraft.fixed_expenses)) {
    alert('Cada posición o gasto fijo con monto debe tener etiqueta.');
    return;
  }

  const payload = {
    start_month: state.projectionDraft.start_month,
    price_regular: state.settingsDraft.price_regular,
    price_plus: state.settingsDraft.price_plus,
    price_premium: state.settingsDraft.price_premium,
    dist_pct_ceo: state.settingsDraft.dist_pct_ceo,
    dist_pct_coo: state.settingsDraft.dist_pct_coo,
    dist_pct_cgo: state.settingsDraft.dist_pct_cgo,
    sal_min_ceo: state.settingsDraft.sal_min_ceo,
    sal_min_coo: state.settingsDraft.sal_min_coo,
    sal_min_cgo: state.settingsDraft.sal_min_cgo,
    reserva_minima: state.settingsDraft.reserva_minima,
    meta_mrr_bono: state.settingsDraft.meta_mrr_bono,
    bono_pct_ceo: state.settingsDraft.bono_pct_ceo,
    bono_pct_coo: state.settingsDraft.bono_pct_coo,
    bono_pct_cgo: state.settingsDraft.bono_pct_cgo,
    positions: normalizeMoneyItems(state.settingsDraft.positions),
    fixed_expenses: normalizeMoneyItems(state.settingsDraft.fixed_expenses),
  };

  setSettingsSaveStatus('Guardando configuración...', 'info');

  try {
    const response = await apiRequest('PATCH', `${state.currentProjectionId}/settings`, payload);
    await refreshCurrentProjection();

    if (Array.isArray(response?.warnings) && response.warnings.length) {
      setSettingsSaveStatus(`Guardado ✓ · ${response.warnings[0]}`, 'info');
    } else {
      setSettingsSaveStatus('Guardado ✓', 'success');
    }
    markSettingsDirty(false);
  } catch (error) {
    console.error('Error guardando configuración:', error);
    setSettingsSaveStatus(`Error: ${error.message}`, 'error');
  }
}

function renderProjectionSelect() {
  if (!el.projectionSelect) return;

  el.projectionSelect.innerHTML = '';
  state.projections.forEach((projection) => {
    const option = document.createElement('option');
    option.value = String(projection.id);
    option.textContent = `${projection.name} (${projection.year})`;
    el.projectionSelect.appendChild(option);
  });

  if (state.currentProjectionId) {
    el.projectionSelect.value = String(state.currentProjectionId);
  }
}

function resetDraftsFromServer(detail, summaryPayload) {
  state.projection = detail.projection;
  state.settings = detail.settings;
  state.months = detail.months;

  state.projectionDraft = deepClone(detail.projection);
  state.settingsDraft = normalizeProjectionSettings(detail.settings || {}, {
    startMonth: detail.projection?.start_month ?? 0,
    preserveEmptyItems: true,
  });
  state.monthsDraft = (Array.isArray(detail.months) ? detail.months : []).map((month, index) =>
    normalizeProjectionMonth(month, index, { preserveEmptyItems: true })
  );

  const serverSummary = summaryPayload?.months
    ? {
      projection: deepClone(detail.projection),
      settings: normalizeProjectionSettings(summaryPayload.settings || detail.settings || {}, {
        startMonth: detail.projection?.start_month ?? 0,
      }),
      months: summaryPayload.months,
      kpis: summaryPayload.kpis || {},
      bonus_periods: summaryPayload.bonus_periods || {},
    }
    : calculateProjectionSummary({
      projection: detail.projection,
      settings: detail.settings,
      months: detail.months,
    });

  state.summary = serverSummary;
  state.liveSummary = calculateProjectionSummary({
    projection: state.projectionDraft,
    settings: state.settingsDraft,
    months: state.monthsDraft,
  });

  state.dirtyMonths.clear();
  state.settingsDirty = false;
  markDataDirty(false, state.selectedMonth);
  markSettingsDirty(false);
}

async function ensureAccess() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = './login.html';
    return false;
  }

  const metaRole = String(user?.user_metadata?.rol_app || user?.app_metadata?.rol_app || '').trim().toLowerCase();
  if (ALLOWED_ROLES.has(metaRole)) return true;

  const { data, error } = await supabase
    .from('usuarios')
    .select('rol_app')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error validando permisos:', error);
    alert('No se pudieron validar permisos.');
    window.location.href = './index.html';
    return false;
  }

  const role = String(data?.rol_app || '').trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    alert('No tienes permisos para acceder a este módulo.');
    window.location.href = './index.html';
    return false;
  }

  return true;
}

async function refreshCurrentProjection() {
  if (!state.currentProjectionId) return;
  setProjectionStatus('Cargando proyección...', 'info');

  const projectionId = Number(state.currentProjectionId);
  const [detail, summary] = await Promise.all([
    apiRequest('GET', `${projectionId}`),
    apiRequest('GET', `${projectionId}/summary`),
  ]);

  resetDraftsFromServer(detail, summary);

  renderKpis();
  renderAnnualSection();
  renderMonthChips();
  renderMonthDetail();
  renderDataForm();
  renderPartnersSection();
  renderSettingsForm();

  setProjectionStatus('Datos sincronizados.', 'success');
}

async function loadProjectionList() {
  setProjectionStatus('Cargando lista de proyecciones...', 'info');
  const response = await apiRequest('GET');
  state.projections = Array.isArray(response.projections) ? response.projections : [];

  renderProjectionSelect();

  if (!state.projections.length) {
    state.currentProjectionId = null;
    state.summary = null;
    state.liveSummary = null;

    renderKpis();
    el.annualTableContainer.innerHTML = '<p class="text-sm text-gray-500">No hay proyecciones. Crea una nueva.</p>';
    el.monthDetailContainer.innerHTML = '';
    el.partnerCards.innerHTML = '';
    el.partnersTableContainer.innerHTML = '';
    setProjectionStatus('No hay proyecciones disponibles.', 'muted');
    return;
  }

  const exists = state.projections.some((projection) => Number(projection.id) === Number(state.currentProjectionId));
  if (!exists) {
    state.currentProjectionId = Number(state.projections[0].id);
  }

  renderProjectionSelect();
  await refreshCurrentProjection();
}

async function createProjection() {
  const currentYear = new Date().getFullYear();
  const name = prompt('Nombre de la proyección:', `Escenario ${currentYear}`);
  if (name === null) return;

  const cleanName = String(name || '').trim();
  if (!cleanName) {
    alert('El nombre es obligatorio.');
    return;
  }

  const yearRaw = prompt('Año de la proyección:', String(currentYear));
  if (yearRaw === null) return;
  const year = Math.max(2000, Math.round(Number(yearRaw) || currentYear));

  const startRaw = prompt('Mes de inicio (0=Enero, 11=Diciembre):', '0');
  if (startRaw === null) return;
  const startMonth = Math.max(0, Math.min(11, Math.round(Number(startRaw) || 0)));

  setProjectionStatus('Creando proyección...', 'info');
  await apiRequest('POST', '', {
    name: cleanName,
    year,
    start_month: startMonth,
  });

  await loadProjectionList();
  setProjectionStatus('Proyección creada.', 'success');
}

function toCsvValue(value) {
  const raw = String(value ?? '');
  if (!raw.includes(',') && !raw.includes('"') && !raw.includes('\n')) return raw;
  return `"${raw.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const summary = getCurrentSummary();
  if (!summary) {
    alert('No hay datos para exportar.');
    return;
  }

  const rows = buildAnnualRows(summary);
  const header = ['Concepto', ...MONTH_LABELS, 'Total'];
  const lines = [header.map(toCsvValue).join(',')];

  let currentSection = '';
  rows.forEach((row) => {
    if (row.section !== currentSection) {
      currentSection = row.section;
      lines.push([toCsvValue(`-- ${currentSection}`), ...Array.from({ length: 13 }, () => '')].join(','));
    }

    const total = row.totalMode === 'final'
      ? row.values[row.values.length - 1]
      : row.values.reduce((sum, value) => sum + Number(value || 0), 0);

    const serializedValues = row.values.map((value) => {
      if (row.money === false) return Math.round(value || 0);
      return roundMoney(value || 0);
    });

    const serializedTotal = row.money === false
      ? Math.round(total || 0)
      : roundMoney(total || 0);

    lines.push([row.label, ...serializedValues, serializedTotal].map(toCsvValue).join(','));
  });

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const filename = String(state.projectionDraft?.name || 'proyeccion').replace(/[^a-zA-Z0-9_-]+/g, '_');
  link.download = `${filename}_${state.projectionDraft?.year || 'anual'}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setActiveTab(tab) {
  state.activeTab = tab;
  el.tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
  el.tabAnnual.classList.toggle('hidden', tab !== 'annual');
  el.tabMonth.classList.toggle('hidden', tab !== 'month');
  el.tabData.classList.toggle('hidden', tab !== 'data');
  el.tabPartners.classList.toggle('hidden', tab !== 'partners');
  el.tabSettings.classList.toggle('hidden', tab !== 'settings');
}

function wireDataListeners() {
  const inputs = [
    el.dataRegApp,
    el.dataRegCgo,
    el.dataPlusApp,
    el.dataPlusCgo,
    el.dataPremApp,
    el.dataPremCgo,
    el.dataSponsors,
    el.dataMunicipios,
    el.dataAds,
    el.dataNotes,
  ].filter(Boolean);

  inputs.forEach((input) => {
    const handler = () => {
      readDataFormIntoDraft();
      setDataSaveStatus('Cambios sin guardar', 'muted');
      renderMonthDetail();
      renderAnnualSection();
      renderPartnersSection();
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
  });

  el.addDataIncomeBtn?.addEventListener('click', () => {
    updateCurrentMonthDraft((draft) => {
      const list = ensureArrayFieldWithEmpty(draft.extra_income || []);
      list.push({ label: '', amount: 0 });
      draft.extra_income = list;
    });
  });

  el.addDataExpenseBtn?.addEventListener('click', () => {
    updateCurrentMonthDraft((draft) => {
      const list = ensureArrayFieldWithEmpty(draft.extra_expense || []);
      list.push({ label: '', amount: 0 });
      draft.extra_expense = list;
    });
  });

  el.saveDataMonthBtn?.addEventListener('click', saveSelectedMonth);
}

function wireSettingsListeners() {
  const inputs = [
    el.cfgPriceRegular,
    el.cfgPricePlus,
    el.cfgPricePremium,
    el.cfgStartMonth,
    el.cfgDistCeo,
    el.cfgDistCoo,
    el.cfgDistCgo,
    el.cfgSalMinCeo,
    el.cfgSalMinCoo,
    el.cfgSalMinCgo,
    el.cfgReservaMinima,
    el.cfgMetaMrrBono,
    el.cfgBonoPctCeo,
    el.cfgBonoPctCoo,
    el.cfgBonoPctCgo,
  ].filter(Boolean);

  inputs.forEach((input) => {
    const handler = () => {
      syncSettingsDraftFromInputs();
      setSettingsSaveStatus('Cambios sin guardar', 'muted');
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
  });

  el.addPositionBtn?.addEventListener('click', () => {
    state.settingsDraft.positions = ensureArrayFieldWithEmpty(state.settingsDraft.positions || []);
    state.settingsDraft.positions.push({ label: '', amount: 0 });
    markSettingsDirty(true);
    recomputeLiveSummary();
    renderSettingsForm();
    renderMonthDetail();
    renderAnnualSection();
    renderPartnersSection();
  });

  el.addFixedExpenseBtn?.addEventListener('click', () => {
    state.settingsDraft.fixed_expenses = ensureArrayFieldWithEmpty(state.settingsDraft.fixed_expenses || []);
    state.settingsDraft.fixed_expenses.push({ label: '', amount: 0 });
    markSettingsDirty(true);
    recomputeLiveSummary();
    renderSettingsForm();
    renderMonthDetail();
    renderAnnualSection();
    renderPartnersSection();
  });

  el.saveSettingsBtn?.addEventListener('click', saveSettings);
}

function wireGeneralListeners() {
  el.tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  el.btnNewProjection?.addEventListener('click', async () => {
    try {
      await createProjection();
    } catch (error) {
      console.error('Error creando proyección:', error);
      setProjectionStatus(`Error: ${error.message}`, 'error');
    }
  });

  el.projectionSelect?.addEventListener('change', async () => {
    const nextId = Number(el.projectionSelect.value || 0);
    if (!nextId) return;

    state.currentProjectionId = nextId;
    try {
      await refreshCurrentProjection();
    } catch (error) {
      console.error('Error cargando proyección:', error);
      setProjectionStatus(`Error: ${error.message}`, 'error');
    }
  });

  el.btnExportCsv?.addEventListener('click', exportCsv);
}

function populateStartMonthOptions() {
  if (!el.cfgStartMonth) return;
  el.cfgStartMonth.innerHTML = MONTH_LABELS
    .map((label, index) => `<option value="${index}">${label}</option>`)
    .join('');
}

async function init() {
  populateStartMonthOptions();
  wireGeneralListeners();
  wireDataListeners();
  wireSettingsListeners();

  const ok = await ensureAccess();
  if (!ok) return;

  try {
    await loadProjectionList();
  } catch (error) {
    console.error('Error inicializando Proyecciones:', error);
    setProjectionStatus(`Error inicial: ${error.message}`, 'error');
  }
}

init();
