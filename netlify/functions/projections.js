import {
  buildDefaultProjectionBundle,
  calculateProjectionSummary,
  createDefaultProjection,
  normalizeMoneyItems,
  normalizeProjectionMonth,
  normalizeProjectionSettings,
} from '../../shared/projectionsCalculator.js';
import { buildHeaders, createSupabaseAdmin, parseBody, requireAuthUser } from './otpShared.js';

const ALLOWED_ROLES = new Set(['admin', 'owner', 'superadmin', 'app_admin', 'app_owner', 'app_superadmin']);

const JSON_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
};

const SETTINGS_FIELDS = [
  'price_regular',
  'price_plus',
  'price_premium',
  'dist_pct_ceo',
  'dist_pct_coo',
  'dist_pct_cgo',
  'sal_min_ceo',
  'sal_min_coo',
  'sal_min_cgo',
  'reserva_minima',
  'meta_mrr_bono',
  'bono_pct_ceo',
  'bono_pct_coo',
  'bono_pct_cgo',
  'positions',
  'fixed_expenses',
];

const MONTH_FIELDS = [
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
];

function apiResponse(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: buildHeaders({ ...JSON_HEADERS, ...extraHeaders }),
    body: JSON.stringify(payload),
  };
}

function toRoleText(value) {
  return String(value || '').trim().toLowerCase();
}

function toPositiveInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : fallback;
}

function clampMonth(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(11, Math.round(parsed)));
}

function parseProjectionPathSegments(event) {
  const fallbackPath = String(event?.path || '');
  const rawUrl = String(event?.rawUrl || '').trim();
  let pathName = fallbackPath;

  if (rawUrl) {
    try {
      pathName = new URL(rawUrl).pathname || fallbackPath;
    } catch (_error) {
      pathName = fallbackPath;
    }
  }

  const marker = '/projections';
  const index = pathName.toLowerCase().indexOf(marker);
  if (index === -1) return [];

  return pathName
    .slice(index + marker.length)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

async function resolveUserRole(supabaseAdmin, user) {
  const metaRole = toRoleText(user?.user_metadata?.rol_app || user?.app_metadata?.rol_app || user?.role);
  if (metaRole && ALLOWED_ROLES.has(metaRole)) return metaRole;

  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('rol_app')
    .eq('id', user?.id)
    .maybeSingle();

  if (error) throw error;
  return toRoleText(data?.rol_app);
}

async function requireAdminOrOwner(event, supabaseAdmin) {
  const user = await requireAuthUser(event, supabaseAdmin);
  if (!user) return { ok: false, response: apiResponse(401, { error: 'No autorizado.' }) };

  const role = await resolveUserRole(supabaseAdmin, user);
  if (!ALLOWED_ROLES.has(role)) {
    return { ok: false, response: apiResponse(403, { error: 'Permisos insuficientes.' }) };
  }

  return { ok: true, user, role };
}

function buildProjectionInsertPayload(body = {}) {
  const normalized = createDefaultProjection({
    name: body.name,
    year: body.year,
    startMonth: body.start_month,
  });

  return {
    name: normalized.name,
    year: normalized.year,
    start_month: normalized.start_month,
  };
}

function buildProjectionPatchPayload(body = {}) {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    payload.name = String(body.name || '').trim() || 'Nueva proyección';
  }
  if (Object.prototype.hasOwnProperty.call(body, 'year')) {
    payload.year = Math.max(2000, Math.round(Number(body.year) || new Date().getFullYear()));
  }
  if (Object.prototype.hasOwnProperty.call(body, 'start_month')) {
    payload.start_month = clampMonth(body.start_month, 0);
  }
  return payload;
}

function buildSettingsPatchPayload(body = {}, projectionStartMonth = 0) {
  const raw = {};
  SETTINGS_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) return;
    raw[field] = body[field];
  });

  if (!Object.keys(raw).length) return {};

  const normalized = normalizeProjectionSettings(raw, {
    startMonth: projectionStartMonth,
  });

  const payload = {};
  Object.keys(raw).forEach((field) => {
    if (field === 'positions' || field === 'fixed_expenses') {
      payload[field] = normalizeMoneyItems(normalized[field]);
      return;
    }
    payload[field] = normalized[field];
  });

  return payload;
}

function buildMonthPatchPayload(body = {}, monthIndex = 0) {
  const raw = {};
  MONTH_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(body, field)) return;
    raw[field] = body[field];
  });

  if (Object.prototype.hasOwnProperty.call(body, 'extra_expenses')) {
    raw.extra_expense = body.extra_expenses;
  }

  if (!Object.keys(raw).length) return {};

  const normalized = normalizeProjectionMonth({ month_index: monthIndex, ...raw }, monthIndex);
  const payload = {};

  Object.keys(raw).forEach((field) => {
    if (field === 'extra_income' || field === 'extra_expense') {
      payload[field] = normalizeMoneyItems(normalized[field]);
      return;
    }
    payload[field] = normalized[field];
  });

  return payload;
}

function buildDistributionWarning(settings) {
  const sum = Number(settings.dist_pct_ceo || 0) + Number(settings.dist_pct_coo || 0) + Number(settings.dist_pct_cgo || 0);
  const rounded = Math.round(sum * 100) / 100;
  if (Math.abs(rounded - 100) < 0.01) return null;
  return `La distribución actual suma ${rounded}%. Se normaliza automáticamente a 100% en el cálculo.`;
}

async function fetchProjectionDetail(supabaseAdmin, projectionId) {
  const { data: projection, error: projectionError } = await supabaseAdmin
    .from('projections')
    .select('*')
    .eq('id', projectionId)
    .maybeSingle();

  if (projectionError) throw projectionError;
  if (!projection) return null;

  const [{ data: settings, error: settingsError }, { data: months, error: monthsError }] = await Promise.all([
    supabaseAdmin
      .from('projection_settings')
      .select('*')
      .eq('projection_id', projectionId)
      .maybeSingle(),
    supabaseAdmin
      .from('projection_months')
      .select('*')
      .eq('projection_id', projectionId)
      .order('month_index', { ascending: true }),
  ]);

  if (settingsError) throw settingsError;
  if (monthsError) throw monthsError;

  const mergedSettings = normalizeProjectionSettings(settings || {}, {
    startMonth: projection.start_month,
  });

  return {
    projection,
    settings: mergedSettings,
    months: Array.isArray(months) ? months : [],
  };
}

async function handleListProjections(supabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from('projections')
    .select('id, name, year, start_month, created_at, updated_at')
    .order('year', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return apiResponse(200, { projections: data || [] });
}

async function handleCreateProjection(supabaseAdmin, body) {
  const projectionPayload = buildProjectionInsertPayload(body || {});

  const { data: projection, error: projectionError } = await supabaseAdmin
    .from('projections')
    .insert(projectionPayload)
    .select('*')
    .single();

  if (projectionError) throw projectionError;

  const defaults = buildDefaultProjectionBundle({
    name: projectionPayload.name,
    year: projectionPayload.year,
    startMonth: projectionPayload.start_month,
  });

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

  const { error: settingsError } = await supabaseAdmin
    .from('projection_settings')
    .insert(settingsPayload);

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

  const { error: monthsError } = await supabaseAdmin.from('projection_months').insert(monthRows);
  if (monthsError) throw monthsError;

  const detail = await fetchProjectionDetail(supabaseAdmin, projection.id);
  return apiResponse(201, detail);
}

async function handleGetProjection(supabaseAdmin, projectionId) {
  const detail = await fetchProjectionDetail(supabaseAdmin, projectionId);
  if (!detail) return apiResponse(404, { error: 'Proyección no encontrada.' });
  return apiResponse(200, detail);
}

async function handlePatchProjection(supabaseAdmin, projectionId, body) {
  const payload = buildProjectionPatchPayload(body || {});
  if (!Object.keys(payload).length) {
    return apiResponse(400, { error: 'No hay campos para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('projections')
    .update(payload)
    .eq('id', projectionId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) return apiResponse(404, { error: 'Proyección no encontrada.' });

  return apiResponse(200, { projection: data });
}

async function handleDeleteProjection(supabaseAdmin, projectionId) {
  const { error } = await supabaseAdmin
    .from('projections')
    .delete()
    .eq('id', projectionId);

  if (error) throw error;
  return apiResponse(200, { ok: true, id: projectionId });
}

async function handleGetSettings(supabaseAdmin, projectionId) {
  const detail = await fetchProjectionDetail(supabaseAdmin, projectionId);
  if (!detail) return apiResponse(404, { error: 'Configuración no encontrada.' });

  const warning = buildDistributionWarning(detail.settings);
  return apiResponse(200, {
    settings: detail.settings,
    warnings: warning ? [warning] : [],
  });
}

async function handlePatchSettings(supabaseAdmin, projectionId, body) {
  const { data: projection, error: projectionError } = await supabaseAdmin
    .from('projections')
    .select('id, start_month')
    .eq('id', projectionId)
    .maybeSingle();

  if (projectionError) throw projectionError;
  if (!projection) return apiResponse(404, { error: 'Proyección no encontrada.' });

  const nextStartMonth = Object.prototype.hasOwnProperty.call(body, 'start_month')
    ? clampMonth(body.start_month, projection.start_month || 0)
    : projection.start_month;

  const settingsPayload = buildSettingsPatchPayload(body || {}, nextStartMonth);
  const wantsStartMonthUpdate = Object.prototype.hasOwnProperty.call(body || {}, 'start_month');

  if (!Object.keys(settingsPayload).length && !wantsStartMonthUpdate) {
    return apiResponse(400, { error: 'No hay campos de configuración para actualizar.' });
  }

  if (wantsStartMonthUpdate) {
    const { error: projectionUpdateError } = await supabaseAdmin
      .from('projections')
      .update({ start_month: nextStartMonth })
      .eq('id', projectionId);

    if (projectionUpdateError) throw projectionUpdateError;
  }

  if (Object.keys(settingsPayload).length) {
    const { error: settingsError } = await supabaseAdmin
      .from('projection_settings')
      .update(settingsPayload)
      .eq('projection_id', projectionId);

    if (settingsError) throw settingsError;
  }

  const detail = await fetchProjectionDetail(supabaseAdmin, projectionId);
  if (!detail) return apiResponse(404, { error: 'Configuración no encontrada.' });

  const warning = buildDistributionWarning(detail.settings);
  return apiResponse(200, {
    settings: detail.settings,
    warnings: warning ? [warning] : [],
  });
}

async function handleGetMonths(supabaseAdmin, projectionId) {
  const { data, error } = await supabaseAdmin
    .from('projection_months')
    .select('*')
    .eq('projection_id', projectionId)
    .order('month_index', { ascending: true });

  if (error) throw error;
  return apiResponse(200, { months: data || [] });
}

async function handlePatchMonth(supabaseAdmin, projectionId, monthIndex, body) {
  const payload = buildMonthPatchPayload(body || {}, monthIndex);
  if (!Object.keys(payload).length) {
    return apiResponse(400, { error: 'No hay campos del mes para actualizar.' });
  }

  const { data, error } = await supabaseAdmin
    .from('projection_months')
    .update(payload)
    .eq('projection_id', projectionId)
    .eq('month_index', monthIndex)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) return apiResponse(404, { error: 'Mes no encontrado.' });

  return apiResponse(200, { month: data });
}

async function handleSummary(supabaseAdmin, projectionId) {
  const detail = await fetchProjectionDetail(supabaseAdmin, projectionId);
  if (!detail) return apiResponse(404, { error: 'Proyección no encontrada.' });

  const summary = calculateProjectionSummary({
    projection: detail.projection,
    settings: detail.settings,
    months: detail.months,
  });

  return apiResponse(200, {
    months: summary.months,
    kpis: summary.kpis,
    settings: summary.settings,
    bonus_periods: summary.bonus_periods,
  });
}

async function routeRequest(event, supabaseAdmin) {
  const method = String(event?.httpMethod || 'GET').toUpperCase();
  const segments = parseProjectionPathSegments(event);
  const body = method === 'GET' || method === 'DELETE' ? {} : parseBody(event);

  if (body === null) return apiResponse(400, { error: 'Body inválido.' });

  if (segments.length === 0) {
    if (method === 'GET') return handleListProjections(supabaseAdmin);
    if (method === 'POST') return handleCreateProjection(supabaseAdmin, body);
    return apiResponse(405, { error: 'Método no permitido.' });
  }

  const projectionId = toPositiveInt(segments[0], 0);
  if (!projectionId) return apiResponse(400, { error: 'ID de proyección inválido.' });

  if (segments.length === 1) {
    if (method === 'GET') return handleGetProjection(supabaseAdmin, projectionId);
    if (method === 'PATCH') return handlePatchProjection(supabaseAdmin, projectionId, body);
    if (method === 'DELETE') return handleDeleteProjection(supabaseAdmin, projectionId);
    return apiResponse(405, { error: 'Método no permitido.' });
  }

  const subresource = segments[1];

  if (subresource === 'settings') {
    if (method === 'GET') return handleGetSettings(supabaseAdmin, projectionId);
    if (method === 'PATCH') return handlePatchSettings(supabaseAdmin, projectionId, body);
    return apiResponse(405, { error: 'Método no permitido.' });
  }

  if (subresource === 'months') {
    if (segments.length === 2) {
      if (method === 'GET') return handleGetMonths(supabaseAdmin, projectionId);
      return apiResponse(405, { error: 'Método no permitido.' });
    }

    const monthIndexRaw = Number(segments[2]);
    const monthIndex = Number.isInteger(monthIndexRaw) ? monthIndexRaw : -1;
    if (monthIndex < 0 || monthIndex > 11) {
      return apiResponse(400, { error: 'Índice de mes inválido.' });
    }

    if (method === 'PATCH' || method === 'PUT') {
      return handlePatchMonth(supabaseAdmin, projectionId, monthIndex, body);
    }

    return apiResponse(405, { error: 'Método no permitido.' });
  }

  if (subresource === 'summary') {
    if (method === 'GET') return handleSummary(supabaseAdmin, projectionId);
    return apiResponse(405, { error: 'Método no permitido.' });
  }

  return apiResponse(404, { error: 'Ruta no encontrada.' });
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: buildHeaders(JSON_HEADERS),
      body: '',
    };
  }

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const auth = await requireAdminOrOwner(event, supabaseAdmin);
    if (!auth.ok) return auth.response;

    return await routeRequest(event, supabaseAdmin);
  } catch (error) {
    console.error('[projections] error', error);
    return apiResponse(500, {
      error: 'No se pudo procesar la solicitud de proyecciones.',
      detalle: error?.message || String(error),
    });
  }
};
