import fs from "fs";
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
const INPUT_CSV = getArg("--input") || `${BASE_DIR}/lugares_limpios.csv`;
const OUTPUT_CSV = getArg("--output") || `${BASE_DIR}/lugares_detallados.csv`;
const DELAY_MS = Number(getArg("--delay") || "220");
const LIMIT = Number(getArg("--limit") || "0");

if (!API_KEY || String(API_KEY).trim() === "") {
  throw new Error("Falta API key. Define GOOGLE_API_KEY o GOOGLE_MAPS_API_KEY");
}
if (!fs.existsSync(INPUT_CSV)) {
  throw new Error(`No existe CSV de entrada: ${INPUT_CSV}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeStringify(value) {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

async function fetchDetails(placeId) {
  const fields = [
    "place_id",
    "name",
    "formatted_address",
    "formatted_phone_number",
    "website",
    "price_level",
    "rating",
    "user_ratings_total",
    "business_status",
    "opening_hours",
    "editorial_summary",
  ].join(",");

  const url =
    "https://maps.googleapis.com/maps/api/place/details/json" +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=${encodeURIComponent(fields)}` +
    `&key=${API_KEY}`;

  const res = await axios.get(url, { timeout: 25000 });
  const status = res?.data?.status || "";
  if (status !== "OK") {
    return {
      ok: false,
      status,
      error: res?.data?.error_message || "",
      result: null,
    };
  }

  return {
    ok: true,
    status,
    error: "",
    result: res?.data?.result || null,
  };
}

async function main() {
  const raw = fs.readFileSync(INPUT_CSV, "utf8");
  let rows = parse(raw, { columns: true, skip_empty_lines: true });
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);

  const cache = new Map();
  let calls = 0;
  let ok = 0;
  let fail = 0;
  let withoutPlaceId = 0;

  const enriched = [];

  console.log(`📄 Input: ${INPUT_CSV}`);
  console.log(`🧾 Filas a procesar: ${rows.length}`);
  console.log(`📁 Output: ${OUTPUT_CSV}`);

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const placeId = String(row.place_id || "").trim();
    if (!placeId) {
      withoutPlaceId += 1;
      enriched.push({
        ...row,
        google_details_status: "SIN_PLACE_ID",
        google_details_error: "",
        google_descripcion: "",
        google_price_level: "",
        google_open_now: "",
        google_opening_hours_json: "",
        google_weekday_text: "",
        google_website: "",
        google_phone: "",
        google_rating: row.rating ?? "",
        google_user_ratings_total: row.user_ratings_total ?? "",
        google_business_status: row.business_status || "",
      });
      continue;
    }

    let details = cache.get(placeId);
    if (!details) {
      calls += 1;
      try {
        details = await fetchDetails(placeId);
      } catch (error) {
        details = {
          ok: false,
          status: "REQUEST_ERROR",
          error: error?.message || "error",
          result: null,
        };
      }
      cache.set(placeId, details);
      await sleep(DELAY_MS);
    }

    if (details.ok) ok += 1;
    else fail += 1;

    const result = details.result || {};
    const opening = result.opening_hours || {};
    const editorial = result.editorial_summary || {};

    enriched.push({
      ...row,
      google_details_status: details.status || "",
      google_details_error: details.error || "",
      google_descripcion: editorial.overview || "",
      google_price_level:
        result.price_level !== null && result.price_level !== undefined
          ? String(result.price_level)
          : "",
      google_open_now:
        opening.open_now === null || opening.open_now === undefined
          ? ""
          : String(Boolean(opening.open_now)),
      google_opening_hours_json: safeStringify(opening.periods || []),
      google_weekday_text: Array.isArray(opening.weekday_text)
        ? opening.weekday_text.join(" || ")
        : "",
      google_website: result.website || "",
      google_phone: result.formatted_phone_number || "",
      google_rating:
        result.rating !== null && result.rating !== undefined
          ? String(result.rating)
          : (row.rating ?? ""),
      google_user_ratings_total:
        result.user_ratings_total !== null && result.user_ratings_total !== undefined
          ? String(result.user_ratings_total)
          : (row.user_ratings_total ?? ""),
      google_business_status: result.business_status || row.business_status || "",
    });

    if ((i + 1) % 50 === 0 || i === rows.length - 1) {
      console.log(`⏳ Progreso: ${i + 1}/${rows.length}`);
    }
  }

  fs.writeFileSync(OUTPUT_CSV, stringify(enriched, { header: true }));

  console.log("\n✅ Enriquecimiento completado");
  console.log(`Filas input: ${rows.length}`);
  console.log(`Sin place_id: ${withoutPlaceId}`);
  console.log(`Llamadas a Details: ${calls}`);
  console.log(`Respuestas OK: ${ok}`);
  console.log(`Respuestas no-OK: ${fail}`);
  console.log(`Archivo: ${OUTPUT_CSV}`);
}

main().catch((error) => {
  console.error("❌ Falló enriquecerDetallesLugares:", error.message);
  process.exit(1);
});
