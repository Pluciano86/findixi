import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(repoRoot, '.env') });
dotenv.config({ path: path.resolve(repoRoot, '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const CSV_PATH =
  process.argv[2] ||
  path.join(process.env.HOME || '', 'Desktop/llamadas-api-google/lugares_limpios.csv');
const DB_TIMEOUT_MS = Number(process.argv[3] || '30000');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

if (!fs.existsSync(CSV_PATH)) {
  console.error(`No existe el CSV: ${CSV_PATH}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CATEGORY_MAP = {
  museos: 'Museo',
  museo: 'Museo',
  miradores: 'Mirador',
  mirador: 'Mirador',
  'parques naturales': 'Parque',
  parque: 'Parque',
  'plazas publicas': 'Plaza Pública',
  'plaza publica': 'Plaza Pública',
  'monumentos historicos': 'Monumento',
  monumento: 'Monumento',
  faros: 'Faro',
  faro: 'Faro',
  'jardines botanicos': 'Jardín',
  jardin: 'Jardín',
  'arte urbano': 'Arte Urbano',
  teatros: 'Teatro',
  teatro: 'Teatro',
  rios: 'Río / Charca',
  rio: 'Río / Charca',
  lagos: 'Río / Charca',
  lago: 'Río / Charca',
  charcas: 'Río / Charca',
  charca: 'Río / Charca',
  cascadas: 'Cascada',
  cascada: 'Cascada',
};

const EXCLUDE_PATTERNS = [
  /\bparking\b/i,
  /\bestacionamiento\b/i,
  /\balquiler\b/i,
  /\brenta\b/i,
  /\bfor rent\b/i,
  /\bse vende\b/i,
  /\bventa\b/i,
  /\bwarehouse\b/i,
  /\bstorage\b/i,
  /\bcondominio\b/i,
  /\bapartamento\b/i,
];

const TOURISM_KEYWORDS = [
  'museo',
  'mirador',
  'faro',
  'jardin',
  'jardín',
  'plaza',
  'monumento',
  'cascada',
  'charca',
  'rio',
  'río',
  'lago',
  'teatro',
  'arqueolog',
  'historico',
  'histórico',
  'reserva',
  'bosque',
  'cueva',
  'cultural',
  'parque',
];

const TOURISM_TYPES = new Set([
  'tourist_attraction',
  'museum',
  'park',
  'zoo',
  'aquarium',
  'art_gallery',
  'amusement_park',
  'natural_feature',
  'hiking_area',
  'campground',
  'historical_landmark',
  'monument',
  'church',
  'city_hall',
  'point_of_interest',
]);

const NEGATIVE_TYPES = new Set([
  'supermarket',
  'grocery_or_supermarket',
  'doctor',
  'hospital',
  'school',
  'university',
  'lodging',
  'shopping_mall',
  'restaurant',
  'bar',
  'cafe',
  'night_club',
  'gas_station',
  'car_dealer',
  'car_repair',
  'bank',
  'pharmacy',
]);

const normalizeText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const normalizeMunicipio = (value = '') => normalizeText(value).replace(/[^\w\s]/g, '');

const normalizeLugarKey = (nombre = '', municipio = '') =>
  `${normalizeText(nombre)}__${normalizeMunicipio(municipio)}`;

function normalizeCategory(input) {
  const key = normalizeText(input).replace(/[^\w\s/]/g, '');
  return CATEGORY_MAP[key] || (input ? String(input).trim() : 'Otros');
}

function isSuspicious(row) {
  const target = `${row.nombre || ''} ${row.direccion || ''}`;
  return EXCLUDE_PATTERNS.some((rx) => rx.test(target));
}

function isTourismLikely(row) {
  const nombre = normalizeText(row.nombre || '');
  const categoria = normalizeText(row.categoria || '');
  const types = normalizeText(row.types || '')
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);

  const hasKeyword = TOURISM_KEYWORDS.some((kw) => nombre.includes(kw) || categoria.includes(kw));
  const hasTourismType = types.some((t) => TOURISM_TYPES.has(t));

  const negativeType = types.some((t) => NEGATIVE_TYPES.has(t));
  if (negativeType && !hasKeyword) return false;

  return hasKeyword || hasTourismType;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toTimeHHMM(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}$/.test(raw)) return null;
  const hh = raw.slice(0, 2);
  const mm = raw.slice(2, 4);
  if (Number(hh) > 23 || Number(mm) > 59) return null;
  return `${hh}:${mm}`;
}

function priceLevelToHint(levelRaw) {
  const level = Number(levelRaw);
  if (!Number.isFinite(level)) return '';
  if (level <= 0) return 'Gratis';
  if (level === 1) return '$';
  if (level === 2) return '$$';
  if (level === 3) return '$$$';
  return '$$$$';
}

function mergeDescripcion(base, googleDescripcion, googlePriceLevel) {
  const main = String(base || '').trim() || String(googleDescripcion || '').trim();
  const hint = priceLevelToHint(googlePriceLevel);
  if (!hint) return main || null;
  const tag = `Nivel de precio (Google): ${hint}`;
  if (!main) return tag;
  if (main.toLowerCase().includes('nivel de precio (google):')) return main;
  return `${main}\n\n${tag}`;
}

function parseOpeningPeriods(periodsRaw) {
  if (!periodsRaw) return [];
  let periods = periodsRaw;
  if (typeof periodsRaw === 'string') {
    const text = periodsRaw.trim();
    if (!text) return [];
    try {
      periods = JSON.parse(text);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(periods)) return [];

  const base = new Map();
  for (let d = 0; d <= 6; d += 1) {
    base.set(d, {
      diaSemana: d,
      apertura: null,
      cierre: null,
      cerrado: true,
      abiertoSiempre: false,
      cerradoTemporalmente: false,
    });
  }

  for (const period of periods) {
    const openDay = Number(period?.open?.day);
    const openTime = toTimeHHMM(period?.open?.time);
    const closeDay = Number(period?.close?.day);
    const closeTime = toTimeHHMM(period?.close?.time);

    if (!Number.isInteger(openDay) || openDay < 0 || openDay > 6) continue;
    const openRow = base.get(openDay);
    if (!openRow) continue;

    if (openTime === '00:00' && closeTime === '00:00' && openDay === closeDay) {
      openRow.cerrado = false;
      openRow.abiertoSiempre = true;
      openRow.apertura = null;
      openRow.cierre = null;
      continue;
    }

    openRow.cerrado = false;
    openRow.abiertoSiempre = false;
    openRow.apertura = openTime || openRow.apertura || '00:00';

    if (Number.isInteger(closeDay) && closeDay >= 0 && closeDay <= 6 && closeTime) {
      if (closeDay === openDay) {
        openRow.cierre = closeTime;
      } else {
        openRow.cierre = '23:59';
        const closeRow = base.get(closeDay);
        if (closeRow) {
          closeRow.cerrado = false;
          closeRow.abiertoSiempre = false;
          if (!closeRow.apertura) closeRow.apertura = '00:00';
          closeRow.cierre = closeTime;
        }
      }
    } else if (!openRow.cierre) {
      openRow.cierre = '23:59';
    }
  }

  return Array.from(base.values());
}

async function withTimeout(promise, label, timeoutMs = DB_TIMEOUT_MS) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout en ${label} (${timeoutMs}ms)`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getCategoryMap() {
  const { data, error } = await withTimeout(
    supabase
    .from('categoriaLugares')
    .select('id, nombre'),
    'getCategoryMap'
  );
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    map.set(normalizeText(row.nombre), { id: row.id, nombre: row.nombre });
  }
  return map;
}

async function getMunicipiosMap() {
  const { data, error } = await withTimeout(
    supabase
    .from('Municipios')
    .select('id, nombre, idArea'),
    'getMunicipiosMap'
  );
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    const key = normalizeMunicipio(row.nombre || '');
    if (!key) continue;
    map.set(key, {
      idMunicipio: Number(row.id),
      idArea: Number(row.idArea),
      municipio: row.nombre || null,
    });
  }
  return map;
}

async function getAreaMap() {
  const { data, error } = await withTimeout(
    supabase
    .from('Area')
    .select('idArea, nombre'),
    'getAreaMap'
  );
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    const id = Number(row.idArea);
    if (!Number.isFinite(id)) continue;
    map.set(id, row.nombre || null);
  }
  return map;
}

async function ensureCategory(categoryName, categoryMap) {
  const key = normalizeText(categoryName || 'Otros');
  if (categoryMap.has(key)) return categoryMap.get(key);

  const { data, error } = await withTimeout(
    supabase
    .from('categoriaLugares')
    .insert([{ nombre: categoryName }])
    .select('id, nombre')
    .single(),
    'ensureCategory.insert'
  );
  if (error) throw error;

  const value = { id: data.id, nombre: data.nombre };
  categoryMap.set(key, value);
  return value;
}

async function getExistingLugaresIndex() {
  const { data, error } = await withTimeout(
    supabase
    .from('LugaresTuristicos')
    .select('id, nombre, municipio'),
    'getExistingLugaresIndex'
  );
  if (error) throw error;

  const index = new Map();
  for (const row of data || []) {
    const key = normalizeLugarKey(row.nombre, row.municipio);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row);
  }
  return index;
}

async function ensureLugarCategoria(idLugar, idCategoria) {
  const { data, error } = await withTimeout(
    supabase
    .from('lugarCategoria')
    .select('id')
    .eq('idLugar', idLugar)
    .eq('idCategoria', idCategoria)
    .limit(1),
    'ensureLugarCategoria.select'
  );
  if (error) throw error;
  if (Array.isArray(data) && data.length > 0) return false;

  const { error: insertError } = await withTimeout(
    supabase
    .from('lugarCategoria')
    .insert([{ idLugar, idCategoria }]),
    'ensureLugarCategoria.insert'
  );
  if (insertError) throw insertError;
  return true;
}

async function syncHorariosLugar(idLugar, horarios) {
  if (!Array.isArray(horarios) || horarios.length === 0) return { upserts: 0 };

  const { data: existingRows, error: existingError } = await withTimeout(
    supabase
    .from('horariosLugares')
    .select('id, diaSemana')
    .eq('idLugar', idLugar),
    'syncHorariosLugar.select'
  );
  if (existingError) throw existingError;

  const byDay = new Map();
  for (const row of existingRows || []) {
    byDay.set(Number(row.diaSemana), row);
  }

  let upserts = 0;
  for (const h of horarios) {
    const dia = Number(h.diaSemana);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) continue;

    const payload = {
      idLugar,
      diaSemana: dia,
      apertura: h.apertura || null,
      cierre: h.cierre || null,
      cerrado: Boolean(h.cerrado),
      abiertoSiempre: Boolean(h.abiertoSiempre),
      cerradoTemporalmente: Boolean(h.cerradoTemporalmente),
    };

    const existing = byDay.get(dia);
    if (existing?.id) {
      const { error: updateError } = await withTimeout(
        supabase
        .from('horariosLugares')
        .update(payload)
        .eq('id', existing.id),
        'syncHorariosLugar.update'
      );
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await withTimeout(
        supabase
        .from('horariosLugares')
        .insert([payload]),
        'syncHorariosLugar.insert'
      );
      if (insertError) throw insertError;
    }
    upserts += 1;
  }

  return { upserts };
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const seen = new Set();
  const cleaned = [];
  let skippedSuspicious = 0;
  let skippedDuplicate = 0;
  let skippedNotTourism = 0;

  for (const row of rows) {
    const nombre = String(row.nombre || '').trim();
    const municipio = String(row.municipio || '').trim();
    const direccion = String(row.direccion || '').trim();
    const placeId = String(row.place_id || '').trim();

    if (!nombre || !municipio) continue;
    if (isSuspicious({ nombre, direccion })) {
      skippedSuspicious += 1;
      continue;
    }
    if (!isTourismLikely(row)) {
      skippedNotTourism += 1;
      continue;
    }

    const key = placeId
      ? `place_${placeId}`
      : `${normalizeText(nombre)}__${normalizeText(municipio)}`;
    if (seen.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    seen.add(key);

    cleaned.push({
      nombre,
      municipio,
      direccion,
      latitud: toNumber(row.latitud),
      longitud: toNumber(row.longitud),
      categoria: normalizeCategory(row.categoria),
      types: row.types || '',
      google_descripcion: row.google_descripcion || '',
      google_price_level: row.google_price_level || '',
      google_phone: row.google_phone || '',
      google_website: row.google_website || '',
      google_opening_hours_json: row.google_opening_hours_json || '',
    });
  }

  const categoryMap = await getCategoryMap();
  const municipiosMap = await getMunicipiosMap();
  const areaMap = await getAreaMap();
  const existingIndex = await getExistingLugaresIndex();
  let inserted = 0;
  let updated = 0;
  let categorized = 0;
  let mappedMunicipioArea = 0;
  let ambiguousExisting = 0;
  let horariosSynced = 0;
  let rowErrors = 0;

  for (let idx = 0; idx < cleaned.length; idx += 1) {
    const row = cleaned[idx];
    const muniKey = normalizeMunicipio(row.municipio || '');
    const muniRef = municipiosMap.get(muniKey) || null;
    const idMunicipio = Number.isFinite(muniRef?.idMunicipio) ? muniRef.idMunicipio : null;
    const idArea = Number.isFinite(muniRef?.idArea) ? muniRef.idArea : null;
    const areaNombre = idArea ? (areaMap.get(idArea) || null) : null;
    if (idMunicipio && idArea) mappedMunicipioArea += 1;

    const payload = {
      nombre: row.nombre,
      municipio: row.municipio,
      idMunicipio,
      idArea,
      area: areaNombre,
      direccion: row.direccion || null,
      descripcion: mergeDescripcion('', row.google_descripcion, row.google_price_level),
      latitud: row.latitud,
      longitud: row.longitud,
      precioEntrada: null,
      telefono: row.google_phone || null,
      web: row.google_website || null,
      facebook: null,
      instagram: null,
      tiktok: null,
      gratis: false,
      activo: true,
      abiertoSiempre: false,
      cerradoTemporalmente: false,
      imagen: null,
    };

    try {
      const key = normalizeLugarKey(row.nombre, row.municipio);
      const existing = existingIndex.get(key) || [];
      if (existing.length > 1) {
        ambiguousExisting += 1;
        console.warn(`⚠️ Lugar ambiguo (mismo nombre+municipio): "${row.nombre}" (${row.municipio})`);
        continue;
      }

      let placeId = null;
      if (existing.length === 1) {
        placeId = existing[0].id;
        const { error: updateError } = await withTimeout(
          supabase
          .from('LugaresTuristicos')
          .update(payload)
          .eq('id', placeId),
          'LugaresTuristicos.update'
        );
        if (updateError) {
          console.error(`❌ Error actualizando lugar "${row.nombre}":`, updateError.message);
          continue;
        }
        updated += 1;
      } else {
        const { data: place, error: insertError } = await withTimeout(
          supabase
          .from('LugaresTuristicos')
          .insert([payload])
          .select('id, nombre, municipio')
          .single(),
          'LugaresTuristicos.insert'
        );
        if (insertError) {
          console.error(`❌ Error insertando lugar "${row.nombre}":`, insertError.message);
          continue;
        }
        placeId = place.id;
        inserted += 1;
        if (!existingIndex.has(key)) existingIndex.set(key, []);
        existingIndex.get(key).push(place);
      }

      const cat = await ensureCategory(row.categoria || 'Otros', categoryMap);
      try {
        const linked = await ensureLugarCategoria(placeId, cat.id);
        if (linked) categorized += 1;
      } catch (relError) {
        console.error(`⚠️ Error relacionando categoría para "${row.nombre}":`, relError.message);
      }

      try {
        const horarios = parseOpeningPeriods(row.google_opening_hours_json);
        if (horarios.length > 0) {
          const res = await syncHorariosLugar(placeId, horarios);
          horariosSynced += res.upserts;
        }
      } catch (horarioErr) {
        console.error(`⚠️ Error sincronizando horarios para "${row.nombre}":`, horarioErr.message);
      }

      if ((inserted + updated) % 100 === 0) {
        console.log(`⏳ Sync progreso: ${inserted + updated}/${cleaned.length} (insert:${inserted}, update:${updated})`);
      }
    } catch (rowError) {
      rowErrors += 1;
      console.error(`⚠️ Error fila ${idx + 1}/${cleaned.length} (${row.nombre}):`, rowError.message || rowError);
    }
  }

  console.log('✅ Sync de lugares completado');
  console.log(`CSV: ${CSV_PATH}`);
  console.log(`Filas CSV: ${rows.length}`);
  console.log(`Filas limpias: ${cleaned.length}`);
  console.log(`Descartados sospechosos: ${skippedSuspicious}`);
  console.log(`Descartados no turísticos: ${skippedNotTourism}`);
  console.log(`Descartados duplicados: ${skippedDuplicate}`);
  console.log(`Insertados: ${inserted}`);
  console.log(`Actualizados: ${updated}`);
  console.log(`Lugares ambiguos omitidos: ${ambiguousExisting}`);
  console.log(`Con categoría asignada: ${categorized}`);
  console.log(`Horarios sincronizados: ${horariosSynced}`);
  console.log(`Errores por fila: ${rowErrors}`);
  console.log(`Con mapeo municipio/área: ${mappedMunicipioArea}`);
}

main().catch((error) => {
  console.error('❌ Fallo en syncLugaresDesdeCsv:', error);
  process.exit(1);
});
