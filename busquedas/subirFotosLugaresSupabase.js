import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

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

const INPUT_CSV = getArg("--input") || path.join(BASE_DIR, "lugares_fotos_places_ponce_ok.csv");
const SOURCE_CSV = getArg("--source-csv") || path.join(BASE_DIR, "lugares_turisticos_ponce.csv");
const REPORT_CSV = getArg("--report") || path.join(BASE_DIR, "lugares_fotos_places_ponce_supabase_reporte.csv");
const SQL_OUT = getArg("--sql-out") || path.join(BASE_DIR, "lugares_fotos_places_ponce_updates.sql");
const BUCKET = getArg("--bucket") || "galerialugares";
const FOLDER = (getArg("--folder") || "imagenes/lugares_ponce").replace(/^\/+|\/+$/g, "");
const LIMIT = Number(getArg("--limit") || "0");
const DELAY_MS = Number(getArg("--delay") || "0");

const APPLY_DB = hasFlag("--apply-db");
const DRY_RUN = hasFlag("--dry-run");
const UPSERT = hasFlag("--no-upsert") ? false : true;

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en variables de entorno");
}

if (!fs.existsSync(INPUT_CSV)) {
  throw new Error(`No existe CSV de entrada: ${INPUT_CSV}`);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PLACE_ID_CANDIDATE_COLUMNS = [
  "place_id",
  "google_place_id",
  "google_place_id_posible_match",
];

function normalizeText(v = "") {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slug(v = "") {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extensionFromFile(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpg";
  if (ext === ".png") return "png";
  if (ext === ".webp") return "webp";
  if (ext === ".gif") return "gif";
  return "jpg";
}

function mimeFromExt(ext) {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordKey(lat, lon, municipio = "") {
  const latN = toNumber(lat);
  const lonN = toNumber(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return "";
  return `${latN.toFixed(5)}|${lonN.toFixed(5)}|${normalizeText(municipio)}`;
}

function buildStoragePath(row, idLugar, index) {
  const municipio = slug(row.municipio || "sin_municipio");
  const nombre = slug(row.nombre || "sin_nombre");
  const placeId = slug(row.place_id || "");
  const ext = extensionFromFile(row.imagen_local);
  const suffix = idLugar ? `id${idLugar}` : (placeId || `row${index + 1}`);
  const fileName = `${municipio}_${nombre}_${suffix}.${ext}`.slice(0, 220);
  return `${FOLDER}/${fileName}`;
}

function toSqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function loadLugaresForMatching() {
  const { data: sample, error: sampleError } = await supabase
    .from("LugaresTuristicos")
    .select("*")
    .limit(1);
  if (sampleError) throw sampleError;

  const keys = Object.keys(sample?.[0] || {});
  const selectFields = ["id", "nombre", "municipio", "imagen", "latitud", "longitud"];
  for (const candidate of PLACE_ID_CANDIDATE_COLUMNS) {
    if (keys.includes(candidate)) {
      selectFields.push(candidate);
    }
  }

  const uniqueFields = Array.from(new Set(selectFields));
  const { data: lugares, error } = await supabase
    .from("LugaresTuristicos")
    .select(uniqueFields.join(","));
  if (error) throw error;

  return {
    lugares: lugares || [],
    placeIdColumns: uniqueFields.filter((f) => PLACE_ID_CANDIDATE_COLUMNS.includes(f)),
  };
}

function buildIndexes(lugares, placeIdColumns) {
  const byPlaceId = new Map();
  const byNameMunicipio = new Map();
  const byCoordMunicipio = new Map();

  for (const lugar of lugares) {
    for (const col of placeIdColumns) {
      const pid = String(lugar[col] || "").trim();
      if (!pid) continue;
      if (!byPlaceId.has(pid)) byPlaceId.set(pid, []);
      byPlaceId.get(pid).push(lugar);
    }

    const key = `${normalizeText(lugar.nombre)}__${normalizeText(lugar.municipio)}`;
    if (!byNameMunicipio.has(key)) byNameMunicipio.set(key, []);
    byNameMunicipio.get(key).push(lugar);

    const ck = coordKey(lugar.latitud, lugar.longitud, lugar.municipio);
    if (ck) {
      if (!byCoordMunicipio.has(ck)) byCoordMunicipio.set(ck, []);
      byCoordMunicipio.get(ck).push(lugar);
    }
  }

  return { byPlaceId, byNameMunicipio, byCoordMunicipio };
}

function resolveLugar(row, indexes, sourceByPlaceId) {
  const pid = String(row.place_id || "").trim();
  if (pid && indexes.byPlaceId.has(pid)) {
    const matches = indexes.byPlaceId.get(pid);
    if (matches.length === 1) {
      return { lugar: matches[0], mode: "place_id", ambiguous: false };
    }
    return { lugar: null, mode: "place_id", ambiguous: true };
  }

  const key = `${normalizeText(row.nombre)}__${normalizeText(row.municipio)}`;
  const matches = indexes.byNameMunicipio.get(key) || [];
  if (matches.length === 1) {
    return { lugar: matches[0], mode: "nombre_municipio", ambiguous: false };
  }
  if (matches.length > 1) {
    return { lugar: null, mode: "nombre_municipio", ambiguous: true };
  }

  if (pid && sourceByPlaceId?.has(pid)) {
    const src = sourceByPlaceId.get(pid);
    const ck = coordKey(src.latitud, src.longitud, row.municipio || src.municipio || "");
    if (ck && indexes.byCoordMunicipio.has(ck)) {
      const coordMatches = indexes.byCoordMunicipio.get(ck);
      if (coordMatches.length === 1) {
        return { lugar: coordMatches[0], mode: "coordenadas", ambiguous: false };
      }
      if (coordMatches.length > 1) {
        return { lugar: null, mode: "coordenadas", ambiguous: true };
      }
    }
  }

  return { lugar: null, mode: "sin_match", ambiguous: false };
}

function loadSourceByPlaceId() {
  if (!fs.existsSync(SOURCE_CSV)) return new Map();
  const raw = fs.readFileSync(SOURCE_CSV, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  const out = new Map();
  for (const row of rows) {
    const pid = String(row.place_id || "").trim();
    if (!pid || out.has(pid)) continue;
    out.set(pid, {
      place_id: pid,
      nombre: row.nombre || "",
      municipio: row.municipio || "",
      latitud: row.latitud ?? null,
      longitud: row.longitud ?? null,
    });
  }
  return out;
}

async function main() {
  const raw = fs.readFileSync(INPUT_CSV, "utf8");
  let rows = parse(raw, { columns: true, skip_empty_lines: true });
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);
  const sourceByPlaceId = loadSourceByPlaceId();

  const { lugares, placeIdColumns } = await loadLugaresForMatching();
  const indexes = buildIndexes(lugares, placeIdColumns);

  console.log(`📄 CSV entrada: ${INPUT_CSV}`);
  console.log(`🧾 Filas a procesar: ${rows.length}`);
  console.log(`🗺️ Fuente auxiliar place_id->coords: ${sourceByPlaceId.size ? SOURCE_CSV : "(no cargada)"}`);
  console.log(`🪣 Bucket destino: ${BUCKET}/${FOLDER}`);
  console.log(`🧭 Match por place_id columnas: ${placeIdColumns.join(", ") || "(ninguna)"}`);
  console.log(`💾 Actualizar DB imagen: ${APPLY_DB ? "si" : "no"}`);
  console.log(`🧪 Dry run: ${DRY_RUN ? "si" : "no"}`);

  const report = [];
  const sqlLines = [];

  let uploaded = 0;
  let dbUpdated = 0;
  let failed = 0;
  let unmatched = 0;
  let ambiguous = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const nombre = String(row.nombre || "").trim();
    const municipio = String(row.municipio || "").trim();
    const placeId = String(row.place_id || "").trim();
    const localPath = String(row.imagen_local || "").trim();

    const resolved = resolveLugar(row, indexes, sourceByPlaceId);
    const idLugar = resolved.lugar?.id ?? null;

    if (resolved.ambiguous) ambiguous += 1;
    if (!idLugar) unmatched += 1;

    if (!localPath || !fs.existsSync(localPath)) {
      failed += 1;
      report.push({
        ok: false,
        status: "file_missing",
        error: `No existe imagen local: ${localPath || "(vacio)"}`,
        nombre,
        municipio,
        place_id: placeId,
        id_lugar: idLugar || "",
        match_mode: resolved.mode,
        imagen_local: localPath,
        storage_path: "",
        public_url: "",
        db_updated: false,
      });
      continue;
    }

    const storagePath = buildStoragePath(row, idLugar, i);
    let publicUrl = "";
    let uploadedNow = false;
    let dbUpdatedNow = false;
    let status = "ok";
    let errorMsg = "";

    try {
      if (!DRY_RUN) {
        const ext = extensionFromFile(localPath);
        const mime = mimeFromExt(ext);
        const fileBuffer = fs.readFileSync(localPath);

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, fileBuffer, {
            contentType: mime,
            upsert: UPSERT,
          });
        if (uploadError) throw uploadError;
      }

      publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl || "";
      uploadedNow = true;
      uploaded += 1;

      if (idLugar && publicUrl) {
        sqlLines.push(
          `update public."LugaresTuristicos" set imagen = ${toSqlLiteral(publicUrl)} where id = ${toSqlLiteral(idLugar)};`
        );
      }

      if (APPLY_DB && idLugar && publicUrl && !DRY_RUN) {
        const { error: updateError } = await supabase
          .from("LugaresTuristicos")
          .update({ imagen: publicUrl })
          .eq("id", idLugar);
        if (updateError) throw updateError;
        dbUpdatedNow = true;
        dbUpdated += 1;
      }

      console.log(`✅ [${i + 1}/${rows.length}] ${nombre} -> ${storagePath}${idLugar ? ` (id:${idLugar})` : " (sin match id)"}`);
    } catch (error) {
      failed += 1;
      status = "error";
      errorMsg = error?.message || "error";
      console.log(`❌ [${i + 1}/${rows.length}] ${nombre} -> ${errorMsg}`);
    }

    report.push({
      ok: uploadedNow,
      status,
      error: errorMsg,
      nombre,
      municipio,
      place_id: placeId,
      id_lugar: idLugar || "",
      match_mode: resolved.mode,
      imagen_local: localPath,
      storage_path: storagePath,
      public_url: publicUrl,
      db_updated: dbUpdatedNow,
    });

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  fs.writeFileSync(REPORT_CSV, stringify(report, { header: true }));
  fs.writeFileSync(SQL_OUT, `${sqlLines.join("\n")}\n`);

  console.log("\n✅ Proceso completado");
  console.log(`Subidas OK: ${uploaded}`);
  console.log(`Errores: ${failed}`);
  console.log(`Sin match idLugar: ${unmatched}`);
  console.log(`Matches ambiguos: ${ambiguous}`);
  console.log(`DB actualizados: ${dbUpdated}`);
  console.log(`Reporte CSV: ${REPORT_CSV}`);
  console.log(`SQL generado: ${SQL_OUT}`);
}

main().catch((error) => {
  console.error("❌ Falló subirFotosLugaresSupabase:", error.message);
  process.exit(1);
});
