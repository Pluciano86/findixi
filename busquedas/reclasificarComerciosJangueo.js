import fs from "fs";
import { createObjectCsvWriter } from "csv-writer";

const INPUT_CSV = "comercios.csv";
const OUTPUT_MAIN_CSV = "comercios_reclasificados_jangueo.csv";
const OUTPUT_JANGUEO_SUBCAT_CSV = "jangueo_subcategorias.csv";

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

function toLower(value) {
  return (value || "").toString().toLowerCase();
}

function recategorizar(nombre, categoriaOriginal) {
  const n = toLower(nombre);

  // Regla específica solicitada:
  // "Bar & Grill" se clasifica como barra.
  if (n.includes("bar & grill") || n.includes("bar and grill")) return "Barras";

  // Si dice Restaurant o Restaurante, clasifica como restaurante
  // aunque también tenga Bar o Barra.
  if (n.includes("restaurant") || n.includes("restaurante")) return "Restaurantes";

  return categoriaOriginal;
}

async function main() {
  const raw = fs.readFileSync(INPUT_CSV, "utf8");
  const rows = parseCsv(raw);

  if (!rows.length) {
    console.log("⚠️ El CSV de entrada no tiene filas.");
    return;
  }

  const mainOutput = [];
  const jangueoSubcats = [];
  const jangueoSet = new Set();

  let cambiosPorNombre = 0;
  let movidosAJangueo = 0;

  for (const row of rows) {
    const categoriaOriginal = row.categoria || "";
    const categoriaNormalizada = recategorizar(row.nombre || "", categoriaOriginal);
    const huboCambioPorNombre = categoriaNormalizada !== categoriaOriginal;

    if (huboCambioPorNombre) cambiosPorNombre++;

    const esSubcategoriaJangueo = ["Discotecas", "Pubs", "Barras"].includes(categoriaNormalizada);
    const categoriaFinal = esSubcategoriaJangueo ? "Jangueo" : categoriaNormalizada;

    if (esSubcategoriaJangueo) {
      movidosAJangueo++;

      const nombre = row.nombre || "";
      const subcategoriaActual = categoriaNormalizada;
      const key = `${toLower(nombre).trim()}|${toLower(subcategoriaActual).trim()}`;

      if (!jangueoSet.has(key)) {
        jangueoSet.add(key);
        jangueoSubcats.push({
          nombre,
          subcategoria_actual: subcategoriaActual,
        });
      }
    }

    mainOutput.push({
      nombre: row.nombre || "",
      telefono: row.telefono || "",
      direccion: row.direccion || "",
      latitud: row.latitud || "",
      longitud: row.longitud || "",
      municipio: row.municipio || "",
      categoria: categoriaFinal,
    });
  }

  const mainWriter = createObjectCsvWriter({
    path: OUTPUT_MAIN_CSV,
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

  const subcatsWriter = createObjectCsvWriter({
    path: OUTPUT_JANGUEO_SUBCAT_CSV,
    header: [
      { id: "nombre", title: "nombre" },
      { id: "subcategoria_actual", title: "subcategoria_actual" },
    ],
  });

  await mainWriter.writeRecords(mainOutput);
  await subcatsWriter.writeRecords(jangueoSubcats);

  console.log(`✅ Archivo principal: ${OUTPUT_MAIN_CSV} (${mainOutput.length} filas)`);
  console.log(`✅ Archivo subcategorías: ${OUTPUT_JANGUEO_SUBCAT_CSV} (${jangueoSubcats.length} filas únicas)`);
  console.log(`📊 Cambios por regla de nombre: ${cambiosPorNombre}`);
  console.log(`📊 Filas movidas a Jangueo: ${movidosAJangueo}`);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
