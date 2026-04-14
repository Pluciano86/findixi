export const MONTH_LABELS = Object.freeze([
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]);

const MAX_MONTH_INDEX = 11;

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNonNegativeNumber(value, fallback = 0) {
  return Math.max(0, toFiniteNumber(value, fallback));
}

function toNonNegativeInt(value, fallback = 0) {
  return Math.max(0, Math.round(toFiniteNumber(value, fallback)));
}

function clampMonthIndex(value, fallback = 0) {
  return Math.max(0, Math.min(MAX_MONTH_INDEX, Math.round(toFiniteNumber(value, fallback))));
}

export function roundMoney(value) {
  return Math.round(toFiniteNumber(value, 0));
}

export function formatMoney(value) {
  return `$${roundMoney(value).toLocaleString('en-US')}`;
}

export function normalizeMoneyItems(items = [], options = {}) {
  const keepEmpty = Boolean(options.keepEmpty);
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      label: String(item?.label || '').trim(),
      amount: toNonNegativeNumber(item?.amount, 0),
    }))
    .filter((item) => keepEmpty || item.label || item.amount > 0);
}

function sumMoneyItems(items = []) {
  return normalizeMoneyItems(items).reduce((sum, item) => sum + item.amount, 0);
}

export function createDefaultProjection({ name = 'Nueva proyección', year, startMonth = 0 } = {}) {
  const currentYear = new Date().getFullYear();
  return {
    name: String(name || '').trim() || 'Nueva proyección',
    year: Math.max(2000, Math.round(toFiniteNumber(year, currentYear))),
    start_month: clampMonthIndex(startMonth, 0),
  };
}

export function createDefaultProjectionMonth(monthIndex = 0) {
  return {
    month_index: clampMonthIndex(monthIndex, 0),
    reg_app: 0,
    reg_cgo: 0,
    plus_app: 0,
    plus_cgo: 0,
    prem_app: 0,
    prem_cgo: 0,
    sponsors: 0,
    municipios: 0,
    ads: 0,
    extra_income: [],
    extra_expense: [],
    notes: '',
  };
}

export function createDefaultProjectionSettings() {
  return {
    price_regular: 65,
    price_plus: 95,
    price_premium: 155,

    dist_pct_ceo: 60,
    dist_pct_coo: 25,
    dist_pct_cgo: 15,

    sal_min_ceo: 800,
    sal_min_coo: 700,
    sal_min_cgo: 400,

    reserva_minima: 3000,

    meta_mrr_bono: 5000,
    bono_pct_ceo: 10,
    bono_pct_coo: 5,
    bono_pct_cgo: 3,

    positions: [],
    fixed_expenses: [
      { label: 'Hosting / infra', amount: 120 },
      { label: 'Herramientas SaaS', amount: 130 },
      { label: 'Misceláneos', amount: 80 },
    ],
  };
}

export function buildDefaultProjectionBundle(input = {}) {
  const projection = createDefaultProjection(input);
  const settings = createDefaultProjectionSettings();
  const months = Array.from({ length: 12 }, (_, index) => createDefaultProjectionMonth(index));
  return { projection, settings, months };
}

export function normalizeProjectionSettings(settingsInput = {}, options = {}) {
  const defaults = createDefaultProjectionSettings();
  const startMonthFallback = Object.prototype.hasOwnProperty.call(options, 'startMonth')
    ? options.startMonth
    : (settingsInput.start_month ?? 0);

  return {
    ...defaults,
    start_month: clampMonthIndex(startMonthFallback, 0),

    price_regular: toNonNegativeInt(settingsInput.price_regular, defaults.price_regular),
    price_plus: toNonNegativeInt(settingsInput.price_plus, defaults.price_plus),
    price_premium: toNonNegativeInt(settingsInput.price_premium, defaults.price_premium),

    dist_pct_ceo: toNonNegativeNumber(settingsInput.dist_pct_ceo, defaults.dist_pct_ceo),
    dist_pct_coo: toNonNegativeNumber(settingsInput.dist_pct_coo, defaults.dist_pct_coo),
    dist_pct_cgo: toNonNegativeNumber(settingsInput.dist_pct_cgo, defaults.dist_pct_cgo),

    sal_min_ceo: toNonNegativeInt(settingsInput.sal_min_ceo, defaults.sal_min_ceo),
    sal_min_coo: toNonNegativeInt(settingsInput.sal_min_coo, defaults.sal_min_coo),
    sal_min_cgo: toNonNegativeInt(settingsInput.sal_min_cgo, defaults.sal_min_cgo),

    reserva_minima: toNonNegativeInt(settingsInput.reserva_minima, defaults.reserva_minima),

    meta_mrr_bono: toNonNegativeInt(settingsInput.meta_mrr_bono, defaults.meta_mrr_bono),
    bono_pct_ceo: toNonNegativeNumber(settingsInput.bono_pct_ceo, defaults.bono_pct_ceo),
    bono_pct_coo: toNonNegativeNumber(settingsInput.bono_pct_coo, defaults.bono_pct_coo),
    bono_pct_cgo: toNonNegativeNumber(settingsInput.bono_pct_cgo, defaults.bono_pct_cgo),

    positions: normalizeMoneyItems(settingsInput.positions, { keepEmpty: Boolean(options.preserveEmptyItems) }),
    fixed_expenses: normalizeMoneyItems(settingsInput.fixed_expenses, { keepEmpty: Boolean(options.preserveEmptyItems) }),
  };
}

export function normalizeProjectionMonth(monthInput = {}, monthIndex = 0, options = {}) {
  const defaults = createDefaultProjectionMonth(monthIndex);
  const preserveEmptyItems = Boolean(options.preserveEmptyItems);

  const extraIncomeRaw = Object.prototype.hasOwnProperty.call(monthInput, 'extra_income')
    ? monthInput.extra_income
    : defaults.extra_income;

  const extraExpenseRaw = Object.prototype.hasOwnProperty.call(monthInput, 'extra_expense')
    ? monthInput.extra_expense
    : (monthInput.extra_expenses ?? defaults.extra_expense);

  return {
    ...defaults,
    month_index: clampMonthIndex(monthInput.month_index, monthIndex),
    reg_app: toNonNegativeInt(monthInput.reg_app, defaults.reg_app),
    reg_cgo: toNonNegativeInt(monthInput.reg_cgo, defaults.reg_cgo),
    plus_app: toNonNegativeInt(monthInput.plus_app, defaults.plus_app),
    plus_cgo: toNonNegativeInt(monthInput.plus_cgo, defaults.plus_cgo),
    prem_app: toNonNegativeInt(monthInput.prem_app, defaults.prem_app),
    prem_cgo: toNonNegativeInt(monthInput.prem_cgo, defaults.prem_cgo),
    sponsors: toNonNegativeNumber(monthInput.sponsors, defaults.sponsors),
    municipios: toNonNegativeNumber(monthInput.municipios, defaults.municipios),
    ads: toNonNegativeNumber(monthInput.ads, defaults.ads),
    extra_income: normalizeMoneyItems(extraIncomeRaw, { keepEmpty: preserveEmptyItems }),
    extra_expense: normalizeMoneyItems(extraExpenseRaw, { keepEmpty: preserveEmptyItems }),
    notes: String(monthInput.notes || ''),
  };
}

function ensureMonthArray(monthsInput = [], options = {}) {
  const byIndex = new Map();
  const list = Array.isArray(monthsInput) ? monthsInput : [];

  list.forEach((row) => {
    const index = clampMonthIndex(row?.month_index, 0);
    byIndex.set(index, row || {});
  });

  const months = [];
  for (let index = 0; index <= MAX_MONTH_INDEX; index += 1) {
    months.push(normalizeProjectionMonth(byIndex.get(index) || {}, index, options));
  }
  return months;
}

function getPeriodEnds(startMonth) {
  const start = clampMonthIndex(startMonth, 0);
  return {
    period1_end: Math.min(start + 5, MAX_MONTH_INDEX),
    period2_end: MAX_MONTH_INDEX,
  };
}

function sumDistPct(settings) {
  const total =
    toNonNegativeNumber(settings.dist_pct_ceo, 0) +
    toNonNegativeNumber(settings.dist_pct_coo, 0) +
    toNonNegativeNumber(settings.dist_pct_cgo, 0);
  return total || 100;
}

function monthTone(month) {
  if (!month.active) return 'prestart';
  return month.resultado_neto >= 0 ? 'positive' : 'negative';
}

export function calculateMonth(index, settings, monthsData, cumulativeCash = 0, exAcc1 = 0, exAcc2 = 0) {
  const monthIndex = clampMonthIndex(index, 0);
  const currentMonth = monthsData[monthIndex] || createDefaultProjectionMonth(monthIndex);

  const startMonth = clampMonthIndex(settings.start_month, 0);
  const active = monthIndex >= startMonth;

  const { period1_end, period2_end } = getPeriodEnds(startMonth);

  let reg_app = 0;
  let reg_cgo = 0;
  let plus_app = 0;
  let plus_cgo = 0;
  let prem_app = 0;
  let prem_cgo = 0;

  for (let j = 0; j <= monthIndex; j += 1) {
    const row = monthsData[j] || createDefaultProjectionMonth(j);
    reg_app += toNonNegativeInt(row.reg_app, 0);
    reg_cgo += toNonNegativeInt(row.reg_cgo, 0);
    plus_app += toNonNegativeInt(row.plus_app, 0);
    plus_cgo += toNonNegativeInt(row.plus_cgo, 0);
    prem_app += toNonNegativeInt(row.prem_app, 0);
    prem_cgo += toNonNegativeInt(row.prem_cgo, 0);
  }

  const mrr_selfservice =
    (reg_app * settings.price_regular) +
    (plus_app * settings.price_plus) +
    (prem_app * settings.price_premium);

  const mrr_cgo =
    (reg_cgo * settings.price_regular) +
    (plus_cgo * settings.price_plus) +
    (prem_cgo * settings.price_premium);

  const mrr_total = mrr_selfservice + mrr_cgo;

  const extra_income_total = sumMoneyItems(currentMonth.extra_income);
  const ingresos =
    mrr_total +
    toNonNegativeNumber(currentMonth.sponsors, 0) +
    toNonNegativeNumber(currentMonth.municipios, 0) +
    extra_income_total;

  let gastos_fijos = 0;
  let gastos_posiciones = 0;
  let gastos_ads = 0;
  let gastos_extra = 0;

  if (active) {
    gastos_fijos = sumMoneyItems(settings.fixed_expenses);
    gastos_posiciones = sumMoneyItems(settings.positions);
    gastos_ads = toNonNegativeNumber(currentMonth.ads, 0);
    gastos_extra = sumMoneyItems(currentMonth.extra_expense);
  }

  const total_op = gastos_fijos + gastos_posiciones + gastos_ads + gastos_extra;

  const sal_ceo = active ? settings.sal_min_ceo : 0;
  const sal_coo = active ? settings.sal_min_coo : 0;
  const sal_cgo = active ? settings.sal_min_cgo : 0;
  const total_salarios = sal_ceo + sal_coo + sal_cgo;

  const utilidad_bruta = ingresos - total_op;
  const excedente = Math.max(0, utilidad_bruta - total_salarios);

  const puede_distribuir = cumulativeCash >= settings.reserva_minima;
  const dist_amount = puede_distribuir ? excedente : 0;

  const total_dist = sumDistPct(settings);
  const dist_ceo = dist_amount * (settings.dist_pct_ceo / total_dist);
  const dist_coo = dist_amount * (settings.dist_pct_coo / total_dist);
  const dist_cgo = dist_amount * (settings.dist_pct_cgo / total_dist);

  const is_bono_month = monthIndex === period1_end || monthIndex === period2_end;

  let nextExAcc1 = exAcc1;
  let nextExAcc2 = exAcc2;
  if (monthIndex <= period1_end) nextExAcc1 += excedente;
  else nextExAcc2 += excedente;

  const periodo_acc = monthIndex === period1_end ? nextExAcc1 : nextExAcc2;
  const bono_ok = is_bono_month && mrr_total >= settings.meta_mrr_bono;

  const bono_ceo = bono_ok ? periodo_acc * (settings.bono_pct_ceo / 100) : 0;
  const bono_coo = bono_ok ? periodo_acc * (settings.bono_pct_coo / 100) : 0;
  const bono_cgo = bono_ok ? periodo_acc * (settings.bono_pct_cgo / 100) : 0;

  const total_ceo = sal_ceo + dist_ceo + bono_ceo;
  const total_coo = sal_coo + dist_coo + bono_coo;
  const total_cgo = sal_cgo + dist_cgo + bono_cgo;
  const total_socios = total_ceo + total_coo + total_cgo;

  const bonos_mes = is_bono_month ? (bono_ceo + bono_coo + bono_cgo) : 0;
  const resultado_neto = ingresos - total_op - total_salarios - dist_amount - bonos_mes;
  const caja_acumulada = cumulativeCash + resultado_neto;

  return {
    month_index: monthIndex,
    month_label: MONTH_LABELS[monthIndex],
    nombre: MONTH_LABELS[monthIndex],

    active,
    is_pre_start: !active,
    start_month: startMonth,

    period1_end,
    period2_end,

    reg_app,
    reg_cgo,
    plus_app,
    plus_cgo,
    prem_app,
    prem_cgo,
    tot_regular: reg_app + reg_cgo,
    tot_plus: plus_app + plus_cgo,
    tot_premium: prem_app + prem_cgo,

    mrr_selfservice,
    mrr_cgo,
    mrr_total,
    ingresos,
    extra_income_total,

    gastos_fijos,
    gastos_posiciones,
    gastos_ads,
    gastos_extra,
    total_op,

    sal_ceo,
    sal_coo,
    sal_cgo,
    total_salarios,

    utilidad_bruta,
    excedente,
    puede_distribuir,
    dist_amount,
    dist_ceo,
    dist_coo,
    dist_cgo,

    is_bono_month,
    bonus_target_met: bono_ok,
    bono_ok,
    periodo_acc,
    bono_ceo,
    bono_coo,
    bono_cgo,
    bonos_mes,

    total_ceo,
    total_coo,
    total_cgo,
    total_socios,

    sponsors: toNonNegativeNumber(currentMonth.sponsors, 0),
    municipios: toNonNegativeNumber(currentMonth.municipios, 0),
    ads: toNonNegativeNumber(currentMonth.ads, 0),
    extra_income: normalizeMoneyItems(currentMonth.extra_income),
    extra_expense: normalizeMoneyItems(currentMonth.extra_expense),
    notes: String(currentMonth.notes || ''),

    resultado_neto,
    caja_acumulada,
    month_tone: monthTone({ active, resultado_neto }),

    // Compatibilidad con el modelo anterior
    accum: {
      reg_total: reg_app + reg_cgo,
      plus_total: plus_app + plus_cgo,
      prem_total: prem_app + prem_cgo,
      total_paid: (reg_app + reg_cgo) + (plus_app + plus_cgo) + (prem_app + prem_cgo),
    },
    gastos: total_op + total_salarios + dist_amount + bonos_mes,
    neto: resultado_neto,
  };
}

export function calculateProjection(settingsInput = {}, monthsInput = [], options = {}) {
  const normalizeOptions = {};
  if (Object.prototype.hasOwnProperty.call(options, 'startMonth') && options.startMonth !== undefined) {
    normalizeOptions.startMonth = options.startMonth;
  }
  const settings = normalizeProjectionSettings(settingsInput, normalizeOptions);
  const monthsData = ensureMonthArray(monthsInput);

  let cumulativeCash = toFiniteNumber(options.initialCash, 0);
  let exAcc1 = 0;
  let exAcc2 = 0;

  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const month = calculateMonth(i, settings, monthsData, cumulativeCash, exAcc1, exAcc2);
    cumulativeCash = month.caja_acumulada;

    if (i <= month.period1_end) exAcc1 = month.periodo_acc;
    else exAcc2 = month.periodo_acc;

    months.push(month);
  }

  const december = months[11] || { caja_acumulada: 0, mrr_total: 0 };
  const punto_equilibrio = months.findIndex((month) => month.resultado_neto > 0);

  const kpis = {
    ingresos_total: months.reduce((sum, month) => sum + month.ingresos, 0),
    caja_final: december.caja_acumulada,
    mrr_diciembre: december.mrr_total,
    meses_positivos: months.filter((month) => month.resultado_neto > 0).length,
    punto_equilibrio,
    total_bonos: months.reduce((sum, month) => sum + month.bonos_mes, 0),
    total_ceo_ano: months.reduce((sum, month) => sum + month.total_ceo, 0),
    total_coo_ano: months.reduce((sum, month) => sum + month.total_coo, 0),
    total_cgo_ano: months.reduce((sum, month) => sum + month.total_cgo, 0),
  };

  return {
    settings,
    months,
    kpis,
    bonus_periods: {
      first_period_end: months[0]?.period1_end ?? Math.min(settings.start_month + 5, 11),
      second_period_end: 11,
    },
  };
}

export function calculateProjectionSummary({ projection = {}, settings = {}, months = [] } = {}) {
  const normalizedProjection = createDefaultProjection({
    name: projection.name,
    year: projection.year,
    startMonth: projection.start_month,
  });

  const result = calculateProjection(
    {
      ...settings,
      start_month: normalizedProjection.start_month,
    },
    months,
    { startMonth: normalizedProjection.start_month }
  );

  return {
    projection: normalizedProjection,
    settings: result.settings,
    months: result.months,
    kpis: result.kpis,
    bonus_periods: result.bonus_periods,
  };
}
