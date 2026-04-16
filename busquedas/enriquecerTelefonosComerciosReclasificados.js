import axios from "axios";
import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;
const INPUT_CSV = "comercios_reclasificados_jangueo.csv";
const OUTPUT_CSV = "comercios_reclasificados_jangueo_con_telefonos.csv";
const DELAY_MS = 120;

if (!API_KEY) {
  console.error("❌ Falta GOOGLE_API_KEY en el entorno.");
  process.exit(1);
}

function parseCsv(raw) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    const next = raw[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ",") {
      pushField();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i++;
      pushField();
      pushRow();
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    pushField();
    pushRow();
  }

  if (!rows.length) return [];

  const headers = rows[0];
  const records = [];

  for (let i = 1; i < rows.length; i++) {
    const current = rows[i];
    if (!current.length || current.every((cell) => !cell)) continue;

    const record = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = current[j] ?? "";
    }
    records.push(record);
  }

  return records;
}

function normalize(value) {
  return (value || "").toString().trim().toLowerCase();
}

function keyFor(nombre, direccion) {
  return `${normalize(nombre)}|${normalize(direccion)}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPlaceId(nombre, direccion) {
  const input = `${nombre}, ${direccion}, Puerto Rico`;
  const url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json";

  try {
    const { data } = await axios.get(url, {
      params: {
        input,
        inputtype: "textquery",
        fields: "place_id",
        key: API_KEY,
      },
      timeout: 20000,
    });

    if (data.status !== "OK" || !data.candidates?.length) return "";
    return data.candidates[0].place_id || "";
  } catch (error) {
    console.error(`❌ Error Find Place para "${nombre}": ${error.message}`);
    return "";
  }
}

async function getPhoneByPlaceId(placeId, nombre) {
  const url = "https://maps.googleapis.com/maps/api/place/details/json";

  try {
    const { data } = await axios.get(url, {
      params: {
        place_id: placeId,
        fields: "formatted_phone_number,international_phone_number",
        key: API_KEY,
      },
      timeout: 20000,
    });

    if (data.status !== "OK" || !data.result) return "";
    return data.result.formatted_phone_number || data.result.international_phone_number || "";
  } catch (error) {
    console.error(`❌ Error Place Details para "${nombre}": ${error.message}`);
    return "";
  }
}

async function main() {
  const raw = fs.readFileSync(INPUT_CSV, "utf8");
  const rows = parseCsv(raw);

  if (!rows.length) {
    console.log("⚠️ El CSV de entrada no tiene filas.");
    return;
  }

  const uniques = new Map();
  for (const row of rows) {
    const nombre = row.nombre || "";
    const direccion = row.direccion || "";
    const key = keyFor(nombre, direccion);
    if (!uniques.has(key)) {
      uniques.set(key, { nombre, direccion });
    }
  }

  const uniqueList = Array.from(uniques.values());
  const phoneByKey = new Map();

  console.log(`🧾 Filas totales: ${rows.length}`);
  console.log(`🔍 Comercios únicos por nombre+dirección: ${uniqueList.length}`);

  for (let i = 0; i < uniqueList.length; i++) {
    const { nombre, direccion } = uniqueList[i];
    const k = keyFor(nombre, direccion);

    console.log(`📞 [${i + 1}/${uniqueList.length}] ${nombre}`);

    let telefono = "";
    const placeId = await findPlaceId(nombre, direccion);

    if (placeId) {
      telefono = await getPhoneByPlaceId(placeId, nombre);
    }

    phoneByKey.set(k, telefono || "");
    await delay(DELAY_MS);
  }

  const output = rows.map((row) => {
    const k = keyFor(row.nombre || "", row.direccion || "");
    const telefono = phoneByKey.get(k) || (row.telefono || "");

    return {
      nombre: row.nombre || "",
      telefono,
      direccion: row.direccion || "",
      latitud: row.latitud || "",
      longitud: row.longitud || "",
      municipio: row.municipio || "",
      categoria: row.categoria || "",
    };
  });

  const writer = createObjectCsvWriter({
    path: OUTPUT_CSV,
    header: [
      { id: "nombre", title: "nombre" },
      { id: "telefono", title: "telefono" },
      { id: "direccion", title: "direccion" },
      { id: "latitud", title: "latitud" },
      { id: "longitud", title: "longitud" },
      { id: "municipio", title: "municipio" },
      { id: "categoria", title: "categoria" },
    ],
  });

  await writer.writeRecords(output);

  const conTelefono = output.filter((r) => (r.telefono || "").trim()).length;
  console.log(`✅ Archivo generado: ${OUTPUT_CSV}`);
  console.log(`📊 Filas con teléfono: ${conTelefono}/${output.length}`);
}

main().catch((error) => {
  console.error("❌ Error general:", error.message);
  process.exit(1);
});
