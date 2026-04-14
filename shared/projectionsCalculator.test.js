import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMonth,
  calculateProjection,
  calculateProjectionSummary,
  createDefaultProjectionMonth,
  createDefaultProjectionSettings,
} from './projectionsCalculator.js';

function buildMonths() {
  return Array.from({ length: 12 }, (_, idx) => createDefaultProjectionMonth(idx));
}

test('Test 1: Comercios se acumulan mes a mes', () => {
  const months = buildMonths();
  months[0].reg_app = 3;
  months[1].reg_app = 2;

  const settings = createDefaultProjectionSettings();
  settings.price_regular = 65;

  const result = calculateProjection(settings, months);
  assert.equal(result.months[1].reg_app, 5);
  assert.equal(result.months[1].mrr_selfservice, 325);
});

test('Test 2: start_month = 4 aplica sueldos/gastos desde mayo, ingresos siempre', () => {
  const months = buildMonths();
  months[0].reg_app = 1;
  months[2].sponsors = 500;
  months[4].ads = 100;

  const settings = createDefaultProjectionSettings();
  settings.start_month = 4;
  settings.sal_min_ceo = 800;
  settings.sal_min_coo = 700;
  settings.sal_min_cgo = 400;
  settings.fixed_expenses = [{ label: 'Fijo', amount: 200 }];

  const result = calculateProjection(settings, months);

  assert.equal(result.months[2].active, false);
  assert.equal(result.months[2].total_salarios, 0);
  assert.equal(result.months[2].gastos_fijos, 0);
  assert.equal(result.months[2].ingresos > 0, true);

  assert.equal(result.months[4].active, true);
  assert.equal(result.months[4].total_salarios, 1900);
  assert.equal(result.months[4].gastos_fijos, 200);
});

test('Test 3: Excedente no se distribuye si caja < reserva_minima', () => {
  const months = buildMonths();
  months[0].sponsors = 3000;

  const settings = createDefaultProjectionSettings();
  settings.start_month = 0;
  settings.sal_min_ceo = 800;
  settings.sal_min_coo = 700;
  settings.sal_min_cgo = 400;
  settings.reserva_minima = 3000;
  settings.fixed_expenses = [{ label: 'Fijo', amount: 300 }];

  const month = calculateMonth(0, settings, months, 500, 0, 0);

  assert.equal(month.excedente > 0, true);
  assert.equal(month.puede_distribuir, false);
  assert.equal(month.dist_amount, 0);
});

test('Test 4: Bono se activa en mes correcto según start_month', () => {
  const months = buildMonths();
  months[4].reg_app = 100;

  const settings = createDefaultProjectionSettings();
  settings.start_month = 4;
  settings.meta_mrr_bono = 5000;

  const result = calculateProjection(settings, months);

  assert.equal(result.months[9].period1_end, 9);
  assert.equal(result.months[9].is_bono_month, true);
  assert.equal(result.months[9].bono_ok, true);
  assert.equal(result.months[5].is_bono_month, false);
});

test('Test 5: Bono = 0 si MRR < meta aunque sea mes de bono', () => {
  const months = buildMonths();
  months[0].reg_app = 1;

  const settings = createDefaultProjectionSettings();
  settings.start_month = 0;
  settings.meta_mrr_bono = 5000;

  const result = calculateProjection(settings, months);

  assert.equal(result.months[5].is_bono_month, true);
  assert.equal(result.months[5].mrr_total < 5000, true);
  assert.equal(result.months[5].bono_ceo, 0);
  assert.equal(result.months[5].bono_coo, 0);
  assert.equal(result.months[5].bono_cgo, 0);
});

test('Test 6: Normalización de porcentajes de distribución', () => {
  const months = buildMonths();
  months[0].sponsors = 5000;

  const settings = createDefaultProjectionSettings();
  settings.start_month = 0;
  settings.dist_pct_ceo = 50;
  settings.dist_pct_coo = 30;
  settings.dist_pct_cgo = 10; // suma 90
  settings.sal_min_ceo = 0;
  settings.sal_min_coo = 0;
  settings.sal_min_cgo = 0;
  settings.reserva_minima = 0;
  settings.fixed_expenses = [];
  settings.positions = [];

  const month = calculateMonth(0, settings, months, 10000, 0, 0);
  const expected = month.dist_amount * (50 / 90);
  assert.equal(Math.round(month.dist_ceo), Math.round(expected));
});

test('Test 7: resultado_neto sigue la fórmula completa', () => {
  const months = buildMonths();
  months[0].reg_app = 10;
  months[0].sponsors = 2000;
  months[0].ads = 300;
  months[0].extra_income = [{ label: 'Extra', amount: 100 }];
  months[0].extra_expense = [{ label: 'Lanzamiento', amount: 80 }];

  const settings = createDefaultProjectionSettings();
  settings.start_month = 0;
  settings.sal_min_ceo = 500;
  settings.sal_min_coo = 400;
  settings.sal_min_cgo = 300;
  settings.reserva_minima = 0;
  settings.fixed_expenses = [{ label: 'Hosting', amount: 100 }];
  settings.positions = [{ label: 'Diseño', amount: 50 }];

  const month = calculateMonth(0, settings, months, 10000, 0, 0);
  const expected =
    month.ingresos -
    month.total_op -
    month.total_salarios -
    month.dist_amount -
    month.bonos_mes;

  assert.equal(Math.round(month.resultado_neto), Math.round(expected));
});

test('Test 8: Gastos extraordinarios solo aplican en el mes ingresado', () => {
  const months = buildMonths();
  months[2].extra_expense = [{ label: 'Evento', amount: 800 }];

  const result = calculateProjectionSummary({
    projection: { name: 'Caso', year: 2026, start_month: 0 },
    settings: createDefaultProjectionSettings(),
    months,
  });

  assert.equal(Math.round(result.months[2].gastos_extra), 800);
  assert.equal(Math.round(result.months[1].gastos_extra), 0);
  assert.equal(Math.round(result.months[3].gastos_extra), 0);
});
