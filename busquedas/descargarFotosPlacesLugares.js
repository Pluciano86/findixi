import fs from "fs";
import path from "path";
import axios from "axios";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "busquedas/.env" });

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

const API_KEY =
  getArg("--api-key") ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_BROWSER_KEY;

const BASE_DIR = `${process.env.HOME}/Desktop/llamadas-api-google`;
const INPUT_CSV = getArg("--input") || `${BASE_DIR}/lugares_turisticos.csv`;
const MUNICIPIO_FILTRO = getArg("--municipio");
const LIMIT = Number(getArg("--limit") || "0");
const MAXWIDTH = Number(getArg("--maxwidth") || "1200");
const OUT_DIR = getArg("--outdir") || `${BASE_DIR}/lugares_fotos_places`;
const REPORT_CSV = getArg("--report") || `${BASE_DIR}/lugares_fotos_places_reporte.csv`;
const DELAY_MS = Number(getArg("--delay") || "250");

if (!API_KEY || String(API_KEY).trim() === "") {
  throw new Error("Falta API key. Define GOOGLE_API_KEY o GOOGLE_MAPS_API_KEY");
}

if (!fs.existsSync(INPUT_CSV)) {
  throw new Error(`No existe input CSV: ${INPUT_CSV}`);
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const norm = (v = "") =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function sanitizeFilename(v = "") {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

function extFromContentType(contentType = "") {
  const raw = String(contentType || "").toLowerCase();
  if (raw.includes("jpeg") || raw.includes("jpg")) return "jpg";
  if (raw.includes("png")) return "png";
  if (raw.includes("webp")) return "webp";
  return "jpg";
}

function decodeApiErrorFromImageBuffer(buf) {
  try {
    const text = Buffer.from(buf || []).toString("utf8");
    const match = text.match(/API keys with referer restrictions cannot be used with this API\./i);
    if (match) return "REQUEST_DENIED: API key con restriccion por referer no sirve para este endpoint";
    return "HTTP error image/png desde Google Places Photo (posible key restringida o API no habilitada)";
  } catch {
    return "HTTP error image/png desde Google Places Photo";
  }
}

async function main() {
  const raw = fs.readFileSync(INPUT_CSV, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true });

  const detailsPhotoCache = new Map();

  async function resolvePhotoRef(row) {
    const direct = (row.photo_ref || "").trim();
    if (direct) return { photoRef: direct, from: "textsearch" };

    const placeId = (row.place_id || "").trim();
    if (!placeId) return { photoRef: "", from: "none" };

    if (detailsPhotoCache.has(placeId)) {
      return { photoRef: detailsPhotoCache.get(placeId) || "", from: "details-cache" };
    }

    const detailsUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=photos` +
      `&key=${API_KEY}`;

    try {
      const detailsRes = await axios.get(detailsUrl);
      const status = detailsRes?.data?.status;
      if (status !== "OK") {
        detailsPhotoCache.set(placeId, "");
        return { photoRef: "", from: `details-${status || "error"}` };
      }
      const ref = detailsRes?.data?.result?.photos?.[0]?.photo_reference || "";
      detailsPhotoCache.set(placeId, ref);
      return { photoRef: ref, from: "details" };
    } catch {
      detailsPhotoCache.set(placeId, "");
      return { photoRef: "", from: "details-error" };
    }
  }

  let filtered = rows;
  if (MUNICIPIO_FILTRO) {
    filtered = filtered.filter((r) => norm(r.municipio) === norm(MUNICIPIO_FILTRO));
  }

  if (LIMIT > 0) {
    filtered = filtered.slice(0, LIMIT);
  }

  console.log(`📄 Input CSV: ${INPUT_CSV}`);
  console.log(`📍 Municipio: ${MUNICIPIO_FILTRO || "todos"}`);
  console.log(`🖼️ Registros a procesar: ${filtered.length}`);
  console.log(`📂 Directorio salida: ${OUT_DIR}`);

  const seenPlaceId = new Set();
  const report = [];
  let ok = 0;
  let fail = 0;
  let skippedDup = 0;
  let noPhotoRef = 0;
  let detailsResolved = 0;

  for (const row of filtered) {
    const placeId = (row.place_id || "").trim();
    const nombre = (row.nombre || "").trim();
    const municipio = (row.municipio || "").trim();
    const { photoRef, from } = await resolvePhotoRef(row);
    if (from === "details" || from === "details-cache") detailsResolved += 1;
    if (!photoRef) {
      noPhotoRef += 1;
      report.push({
        ok: false,
        error: "sin_photo_ref",
        nombre,
        municipio,
        place_id: placeId,
        photo_ref: "",
        photo_ref_source: from,
        imagen_local: "",
      });
      continue;
    }

    const dedupKey = placeId || `${nombre}__${municipio}__${photoRef.slice(0, 24)}`;
    if (seenPlaceId.has(dedupKey)) {
      skippedDup += 1;
      continue;
    }
    seenPlaceId.add(dedupKey);

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${MAXWIDTH}&photo_reference=${encodeURIComponent(photoRef)}&key=${API_KEY}`;
    const baseName = sanitizeFilename(`${municipio}_${nombre}_${placeId || "sin_place_id"}`);

    try {
      const res = await axios.get(photoUrl, {
        responseType: "arraybuffer",
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const ext = extFromContentType(res.headers["content-type"] || "");
      const fileName = `${baseName}.${ext}`;
      const filePath = path.join(OUT_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(res.data));

      report.push({
        ok: true,
        error: "",
        nombre,
        municipio,
        place_id: placeId,
        photo_ref: photoRef,
        photo_ref_source: from,
        imagen_local: filePath,
      });
      ok += 1;
      console.log(`✅ ${nombre} (${municipio})`);
    } catch (err) {
      const isPng = String(err?.response?.headers?.["content-type"] || "")
        .toLowerCase()
        .includes("image/png");
      const msg = isPng
        ? decodeApiErrorFromImageBuffer(err?.response?.data)
        : err?.response?.data
          ? String(Buffer.from(err.response.data).toString("utf8")).slice(0, 180)
          : (err?.message || "error");

      report.push({
        ok: false,
        error: msg,
        nombre,
        municipio,
        place_id: placeId,
        photo_ref: photoRef,
        photo_ref_source: from,
        imagen_local: "",
      });
      fail += 1;
      console.log(`❌ ${nombre} (${municipio}) -> ${msg}`);
    }

    await delay(DELAY_MS);
  }

  fs.writeFileSync(REPORT_CSV, stringify(report, { header: true }));

  console.log("\n✅ Descarga Places Photo completada");
  console.log(`OK: ${ok}`);
  console.log(`Errores: ${fail}`);
  console.log(`Duplicados saltados: ${skippedDup}`);
  console.log(`Sin photo_ref final: ${noPhotoRef}`);
  console.log(`photo_ref resuelto por Details: ${detailsResolved}`);
  console.log(`Reporte: ${REPORT_CSV}`);
}

main().catch((err) => {
  console.error("❌ Falló descargarFotosPlacesLugares:", err.message);
  process.exit(1);
});
