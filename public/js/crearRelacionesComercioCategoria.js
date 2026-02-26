const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

// === ARCHIVOS ===
const archivoComercios = "comercios_final.csv";
const archivoCategorias = "ComercioCategorias_rows.csv";
const archivoSalida = "relaciones_comercio_categoria.csv";

// === LEER ARCHIVOS ===
const comerciosCSV = fs.readFileSync(archivoComercios, "utf8");
const categoriasCSV = fs.readFileSync(archivoCategorias, "utf8");

const comercios = parse(comerciosCSV, { columns: true, skip_empty_lines: true });
const categorias = parse(categoriasCSV, { columns: true, skip_empty_lines: true });

// Crear mapa de categorías
const mapaCategorias = {};
for (const c of categorias) {
  const nombre = (c.nombre || c.categoria || "").toLowerCase().trim();
  mapaCategorias[nombre] = c.idCategoria || c.id || "";
}

// === PROCESAR ===
const relaciones = [];
let idComercio = 163; // 👈 comienzo del rango que indicaste

for (const r of comercios) {
  const cat = (r.categoria || "").toLowerCase().trim();

  if (!cat || cat === "jangueo") {
    // omitir jangueo o vacíos
    idComercio++;
    continue;
  }

  const idCategoria = mapaCategorias[cat] || "";
  if (!idCategoria) {
    console.warn(`⚠️ Categoría no encontrada: "${cat}"`);
  }

  relaciones.push({
    idComercio,
    idCategoria,
  });

  idComercio++;
}

// === GUARDAR CSV ===
const output = stringify(relaciones, { header: true });
fs.writeFileSync(archivoSalida, output);

console.log("✅ Archivo de relaciones generado:", archivoSalida);
console.log(`📊 Total relaciones: ${relaciones.length}`);