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

const HOME = process.env.HOME || "";
const BASE_DIR = path.join(HOME, "Desktop", "llamadas-api-google");

const REPORT_IN =
  getArg("--report-in") ||
  path.join(BASE_DIR, "lugares_fotos_places_ponce_supabase_reporte.csv");
const SOURCE_CSV =
  getArg("--source-csv") || path.join(BASE_DIR, "lugares_turisticos_ponce.csv");
const OUT_PENDING =
  getArg("--out-pending") ||
  path.join(BASE_DIR, "lugares_fotos_places_ponce_pendientes_revision.csv");
const OUT_SQL =
  getArg("--out-sql") ||
  path.join(BASE_DIR, "lugares_fotos_places_ponce_pendientes_autoupdate.sql");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}
if (!fs.existsSync(REPORT_IN)) {
  throw new Error(`No existe reporte: ${REPORT_IN}`);
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

function splitTokens(v = "") {
  return normalizeText(v)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function jaccardScore(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union > 0 ? inter / union : 0;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function distanceBoost(distKm) {
  if (distKm === null) return 0;
  if (distKm <= 0.15) return 0.35;
  if (distKm <= 0.5) return 0.28;
  if (distKm <= 1.2) return 0.2;
  if (distKm <= 3) return 0.12;
  if (distKm <= 8) return 0.06;
  return 0;
}

function sqlLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function loadSourceByPlaceId(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const raw = fs.readFileSync(filePath, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });
  const out = new Map();
  for (const r of rows) {
    const pid = String(r.place_id || "").trim();
    if (!pid || out.has(pid)) continue;
    out.set(pid, {
      latitud: toNumber(r.latitud),
      longitud: toNumber(r.longitud),
      nombre: String(r.nombre || "").trim(),
      municipio: String(r.municipio || "").trim(),
    });
  }
  return out;
}

function scoreCandidate(pendingRow, candidate, srcByPlaceId) {
  const pNameTokens = splitTokens(pendingRow.nombre);
  const cNameTokens = splitTokens(candidate.nombre);
  const nameScore = jaccardScore(pNameTokens, cNameTokens);

  const pMun = normalizeText(pendingRow.municipio);
  const cMun = normalizeText(candidate.municipio);
  const munExact = pMun && cMun && pMun === cMun ? 1 : 0;

  const src = srcByPlaceId.get(String(pendingRow.place_id || "").trim());
  const lat1 = src?.latitud ?? null;
  const lon1 = src?.longitud ?? null;
  const lat2 = toNumber(candidate.latitud);
  const lon2 = toNumber(candidate.longitud);

  let distKm = null;
  if (
    lat1 !== null &&
    lon1 !== null &&
    lat2 !== null &&
    lon2 !== null
  ) {
    distKm = haversineKm(lat1, lon1, lat2, lon2);
  }

  const score =
    nameScore * 0.72 +
    munExact * 0.16 +
    distanceBoost(distKm) +
    (pendingRow.nombre_norm === normalizeText(candidate.nombre) ? 0.12 : 0);

  return {
    id: candidate.id,
    nombre: candidate.nombre,
    municipio: candidate.municipio,
    imagen: candidate.imagen || "",
    distKm,
    score,
  };
}

function pickTopCandidates(pendingRow, lugares, srcByPlaceId, topN = 3) {
  const pMun = normalizeText(pendingRow.municipio);
  const sameMun = lugares.filter((l) => normalizeText(l.municipio) === pMun);
  const baseSet = sameMun.length > 0 ? sameMun : lugares;

  const scored = baseSet.map((c) => scoreCandidate(pendingRow, c, srcByPlaceId));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

async function main() {
  const raw = fs.readFileSync(REPORT_IN, "utf8");
  const reportRows = parse(raw, { columns: true, skip_empty_lines: true });
  const pending = reportRows
    .filter((r) => String(r.ok).trim() === "1")
    .filter((r) => !String(r.id_lugar || "").trim())
    .map((r) => ({
      ...r,
      nombre_norm: normalizeText(r.nombre),
    }));

  const srcByPlaceId = loadSourceByPlaceId(SOURCE_CSV);

  const { data: lugares, error } = await supabase
    .from("LugaresTuristicos")
    .select("id,nombre,municipio,latitud,longitud,imagen");
  if (error) throw error;

  const outRows = [];
  const sqlLines = [];
  let autoCount = 0;

  for (const row of pending) {
    const top = pickTopCandidates(row, lugares || [], srcByPlaceId, 3);
    const c1 = top[0] || null;
    const c2 = top[1] || null;
    const gap = c1 && c2 ? c1.score - c2.score : c1 ? c1.score : 0;

    const auto =
      !!c1 &&
      c1.score >= 0.9 &&
      gap >= 0.08 &&
      (c1.distKm === null || c1.distKm <= 8);

    if (auto) {
      autoCount += 1;
      sqlLines.push(
        `update public."LugaresTuristicos" set imagen = ${sqlLiteral(
          row.public_url
        )} where id = ${sqlLiteral(c1.id)};`
      );
    }

    outRows.push({
      nombre: row.nombre,
      municipio: row.municipio,
      place_id: row.place_id || "",
      google_maps_url: row.place_id
        ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(
            row.place_id
          )}`
        : "",
      public_url: row.public_url || "",
      storage_path: row.storage_path || "",
      sugerencia_1_id: c1?.id || "",
      sugerencia_1_nombre: c1?.nombre || "",
      sugerencia_1_municipio: c1?.municipio || "",
      sugerencia_1_score: c1 ? c1.score.toFixed(4) : "",
      sugerencia_1_dist_km: c1?.distKm === null || c1?.distKm === undefined ? "" : c1.distKm.toFixed(3),
      sugerencia_2_id: c2?.id || "",
      sugerencia_2_nombre: c2?.nombre || "",
      sugerencia_2_score: c2 ? c2.score.toFixed(4) : "",
      sugerencia_3_id: top[2]?.id || "",
      sugerencia_3_nombre: top[2]?.nombre || "",
      sugerencia_3_score: top[2] ? top[2].score.toFixed(4) : "",
      nivel_confianza:
        c1 && c1.score >= 0.75 ? "alta" : c1 && c1.score >= 0.6 ? "media" : "baja",
      auto_match_recomendado: auto ? "si" : "no",
      razon_auto: auto ? `score=${c1.score.toFixed(3)}, gap=${gap.toFixed(3)}` : "",
    });
  }

  fs.writeFileSync(OUT_PENDING, stringify(outRows, { header: true }));
  fs.writeFileSync(OUT_SQL, `${sqlLines.join("\n")}\n`);

  console.log(`✅ Pendientes analizados: ${pending.length}`);
  console.log(`🧠 Auto-match recomendado: ${autoCount}`);
  console.log(`📄 CSV pendientes: ${OUT_PENDING}`);
  console.log(`🧾 SQL sugerido: ${OUT_SQL}`);
}

main().catch((error) => {
  console.error("❌ Falló reconciliarLugaresPendientes:", error.message);
  process.exit(1);
});
