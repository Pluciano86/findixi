import axios from "axios";
import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;
const INPUT_CSV = "panaderias_lajas.csv";
const OUTPUT_CSV = "panaderias_lajas_con_telefonos.csv";

if (!API_KEY) {
  console.error("❌ Falta GOOGLE_API_KEY en el entorno.");
  process.exit(1);
}

function readCsvRows(path) {
  const raw = fs.readFileSync(path, "utf8");
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
    });

    if (data.status !== "OK" || !data.result) return "";

    return data.result.formatted_phone_number || data.result.international_phone_number || "";
  } catch (error) {
    console.error(`❌ Error Place Details para "${nombre}": ${error.message}`);
    return "";
  }
}

async function enriquecerTelefonos() {
  const rows = await readCsvRows(INPUT_CSV);

  if (!rows.length) {
    console.log("⚠️ El CSV de entrada no tiene filas.");
    return;
  }

  const output = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nombre = row.nombre || "";
    const direccion = row.direccion || "";

    console.log(`📞 [${i + 1}/${rows.length}] Buscando teléfono: ${nombre}`);

    let telefono = (row.telefono || "").trim();
    const placeId = await findPlaceId(nombre, direccion);

    if (placeId) {
      const phone = await getPhoneByPlaceId(placeId, nombre);
      if (phone) telefono = phone;
    }

    output.push({
      nombre: row.nombre || "",
      telefono,
      direccion: row.direccion || "",
      latitud: row.latitud || "",
      longitud: row.longitud || "",
      municipio: row.municipio || "",
      categoria: row.categoria || "",
    });

    await delay(120);
  }

  const csvWriter = createObjectCsvWriter({
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

  await csvWriter.writeRecords(output);

  const conTelefono = output.filter((r) => r.telefono).length;
  console.log(`✅ Archivo generado: ${OUTPUT_CSV}`);
  console.log(`📊 Teléfonos encontrados: ${conTelefono}/${output.length}`);
}

enriquecerTelefonos().catch((error) => {
  console.error("❌ Error general:", error.message);
  process.exit(1);
});
