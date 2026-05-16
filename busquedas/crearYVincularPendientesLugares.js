import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: path.join("busquedas", ".env") });

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const HOME = process.env.HOME || "";
const BASE_DIR = path.join(HOME, "Desktop", "llamadas-api-google");

const PENDING_CSV =
  getArg("--pending-csv") ||
  path.join(BASE_DIR, "lugares_fotos_places_ponce_pendientes_revision.csv");
const SOURCE_CSV =
  getArg("--source-csv") || path.join(BASE_DIR, "lugares_turisticos_ponce.csv");
const REPORT_OUT =
  getArg("--report-out") ||
  path.join(BASE_DIR, "lugares_fotos_places_ponce_creados_vinculados.csv");
const APPLY = hasFlag("--apply");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}
if (!fs.existsSync(PENDING_CSV)) {
  throw new Error(`No existe pendientes CSV: ${PENDING_CSV}`);
}
if (!fs.existsSync(SOURCE_CSV)) {
  throw new Error(`No existe source CSV: ${SOURCE_CSV}`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function normalizeText(v = "") {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMunicipio(v = "") {
  return normalizeText(v);
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function loadCsv(filePath) {
  return parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
  });
}

async function getMunicipiosMap() {
  const { data, error } = await supabase
    .from("Municipios")
    .select("id, nombre, idArea");
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    map.set(normalizeMunicipio(row.nombre || ""), {
      idMunicipio: Number(row.id),
      idArea: Number(row.idArea),
      municipio: row.nombre || null,
    });
  }
  return map;
}

async function getAreaMap() {
  const { data, error } = await supabase.from("Area").select("idArea, nombre");
  if (error) throw error;
  const map = new Map();
  for (const row of data || []) {
    map.set(Number(row.idArea), row.nombre || null);
  }
  return map;
}

async function getExistingLugaresMap() {
  const { data, error } = await supabase
    .from("LugaresTuristicos")
    .select("id,nombre,municipio,imagen");
  if (error) throw error;

  const byNameMunicipio = new Map();
  for (const row of data || []) {
    const key = `${normalizeText(row.nombre)}__${normalizeMunicipio(row.municipio)}`;
    if (!byNameMunicipio.has(key)) byNameMunicipio.set(key, []);
    byNameMunicipio.get(key).push(row);
  }
  return byNameMunicipio;
}

async function main() {
  const pendingRows = loadCsv(PENDING_CSV);
  const sourceRows = loadCsv(SOURCE_CSV);

  const sourceByPlaceId = new Map();
  for (const r of sourceRows) {
    const pid = String(r.place_id || "").trim();
    if (!pid || sourceByPlaceId.has(pid)) continue;
    sourceByPlaceId.set(pid, r);
  }

  const municipiosMap = await getMunicipiosMap();
  const areaMap = await getAreaMap();
  const existingMap = await getExistingLugaresMap();

  console.log(`📄 Pendientes: ${pendingRows.length}`);
  console.log(`🧪 Modo apply: ${APPLY ? "si" : "no"}`);

  const report = [];
  let created = 0;
  let updatedExisting = 0;
  let skippedNoSource = 0;
  let failed = 0;

  for (const row of pendingRows) {
    const nombre = String(row.nombre || "").trim();
    const municipio = String(row.municipio || "").trim();
    const placeId = String(row.place_id || "").trim();
    const publicUrl = String(row.public_url || "").trim();
    const key = `${normalizeText(nombre)}__${normalizeMunicipio(municipio)}`;

    const existing = existingMap.get(key) || [];
    const src = sourceByPlaceId.get(placeId);

    if (!src) {
      skippedNoSource += 1;
      report.push({
        ok: false,
        accion: "skip_no_source",
        error: "place_id no encontrado en source CSV",
        id_lugar: existing[0]?.id || "",
        nombre,
        municipio,
        place_id: placeId,
        imagen: publicUrl,
      });
      continue;
    }

    const muniRef = municipiosMap.get(normalizeMunicipio(municipio)) || null;
    const idMunicipio = Number.isFinite(muniRef?.idMunicipio) ? muniRef.idMunicipio : null;
    const idArea = Number.isFinite(muniRef?.idArea) ? muniRef.idArea : null;
    const areaNombre = idArea ? areaMap.get(idArea) || null : null;

    try {
      if (existing.length === 1) {
        const idLugar = existing[0].id;
        if (APPLY) {
          const { error: updErr } = await supabase
            .from("LugaresTuristicos")
            .update({ imagen: publicUrl })
            .eq("id", idLugar);
          if (updErr) throw updErr;
        }
        updatedExisting += 1;
        report.push({
          ok: true,
          accion: "update_existing",
          error: "",
          id_lugar: idLugar,
          nombre,
          municipio,
          place_id: placeId,
          imagen: publicUrl,
        });
        continue;
      }

      if (existing.length > 1) {
        report.push({
          ok: false,
          accion: "skip_ambiguous_existing",
          error: `Hay ${existing.length} filas existentes con mismo nombre+municipio`,
          id_lugar: "",
          nombre,
          municipio,
          place_id: placeId,
          imagen: publicUrl,
        });
        continue;
      }

      const payload = {
        nombre,
        municipio,
        idMunicipio,
        idArea,
        area: areaNombre,
        direccion: String(src.direccion || "").trim() || null,
        descripcion: null,
        latitud: toNumber(src.latitud),
        longitud: toNumber(src.longitud),
        precioEntrada: null,
        telefono: null,
        web: null,
        facebook: null,
        instagram: null,
        tiktok: null,
        imagen: publicUrl || null,
        gratis: false,
        activo: true,
        abiertoSiempre: false,
      };

      let inserted = null;
      if (APPLY) {
        const { data, error: insErr } = await supabase
          .from("LugaresTuristicos")
          .insert([payload])
          .select("id,nombre,municipio")
          .single();
        if (insErr) throw insErr;
        inserted = data;
      } else {
        inserted = { id: "", nombre, municipio };
      }

      created += 1;
      report.push({
        ok: true,
        accion: "insert_new",
        error: "",
        id_lugar: inserted?.id || "",
        nombre,
        municipio,
        place_id: placeId,
        imagen: publicUrl,
      });
    } catch (error) {
      failed += 1;
      report.push({
        ok: false,
        accion: "error",
        error: error?.message || "error",
        id_lugar: "",
        nombre,
        municipio,
        place_id: placeId,
        imagen: publicUrl,
      });
    }
  }

  fs.writeFileSync(REPORT_OUT, stringify(report, { header: true }));

  console.log("\n✅ Proceso completado");
  console.log(`Nuevos creados: ${created}`);
  console.log(`Existentes actualizados: ${updatedExisting}`);
  console.log(`Sin source: ${skippedNoSource}`);
  console.log(`Errores: ${failed}`);
  console.log(`Reporte: ${REPORT_OUT}`);
}

main().catch((error) => {
  console.error("❌ Falló crearYVincularPendientesLugares:", error.message);
  process.exit(1);
});

