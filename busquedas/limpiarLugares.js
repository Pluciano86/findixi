// ===============================
// LIMPIEZA DE LUGARES TURÍSTICOS
// ===============================

import fs from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

// === CONFIG (RUTAS CORRECTAS) ===
const BASE = `${process.env.HOME}/Desktop/llamadas-api-google`;
const INPUT = `${BASE}/lugares_turisticos.csv`;
const OUTPUT = `${BASE}/lugares_limpios.csv`;
const OUTPUT_DESC = `${BASE}/lugares_descartados.csv`;

// === HELPERS ===
const norm = (s = "") =>
  s.toString().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const contiene = (txt = "", arr = []) =>
  arr.some(w => norm(txt).includes(norm(w)));

const extraerMunicipio = (direccion = "") => {
  const partes = direccion.split(",");
  return partes.length ? partes[partes.length - 2]?.trim() || "" : "";
};

// === CARGAR CSV ===
const raw = fs.readFileSync(INPUT, "utf8");
const filas = parse(raw, { columns: true, skip_empty_lines: true });

// === CONFIGURACIÓN DE CATEGORÍAS ===
const CAT_PARQUES = ["Parque", "Parque Acuático", "Parque Recreativo"];
const CAT_PLAZA_PUBLICA = "Plaza Pública";

const KEY_CASCADA = ["waterfall", "cascada"];
const KEY_RIO = ["river", "rio", "charca", "lake", "lago"];
const KEY_CATEDRAL = ["catedral"];

// === PROCESO ===
const vistos = new Set();
const limpios = [];
const descartados = [];

for (const r of filas) {
  
  let { nombre, direccion, municipio, categoria } = r;

  if (!nombre || !municipio) {
    descartados.push({ ...r, motivo: "datos incompletos" });
    continue;
  }

  // Normalización para detectar duplicados
  const clave = norm(nombre) + "_" + norm(municipio);
  if (vistos.has(clave)) {
    descartados.push({ ...r, motivo: "duplicado" });
    continue;
  }
  vistos.add(clave);

  // REGLA: Determinar categoría correcta por palabras del nombre
  const nombreNorm = norm(nombre);

  // — CASCADA
  if (contiene(nombreNorm, KEY_CASCADA)) {
    categoria = "Cascada";
  }

  // — RÍO / CHARCA
  else if (contiene(nombreNorm, KEY_RIO)) {
    categoria = "Río / Charca";
  }

  // — CATEDRAL
  else if (contiene(nombreNorm, KEY_CATEDRAL)) {
    categoria = "Catedral";
  }

  // — PLAZA PÚBLICA
  if (nombreNorm.includes("plaza") || categoria === "Plaza Pública") {
    categoria = CAT_PLAZA_PUBLICA;
  }

  // — PARQUES (si ya vienen correctas)
  if (categoria.includes("Parque")) {
    if (!CAT_PARQUES.includes(categoria)) {
      categoria = "Parque";
    }
  }

  // Validar MUNICIPIO vs DIRECCIÓN
  if (direccion && direccion !== "") {
    const muniDireccion = extraerMunicipio(direccion);

    if (
      muniDireccion &&
      norm(muniDireccion) !== norm(municipio)
    ) {
      descartados.push({ ...r, motivo: "municipio no coincide con dirección" });
      continue;
    }
  }

  // Campo Catedral (si existe)
  if (categoria !== "Catedral" && "catedral" in r) {
    r.catedral = "";
  }

  // Guardar limpio
  limpios.push({
    ...r,
    categoria
  });
}

// === GUARDAR RESULTADOS ===
fs.writeFileSync(OUTPUT, stringify(limpios, { header: true }));
fs.writeFileSync(OUTPUT_DESC, stringify(descartados, { header: true }));

console.log("✅ Limpieza completada");
console.log("👉 Guardado:", OUTPUT, "(registros:", limpios.length + ")");
console.log("🗑️ Descartados:", OUTPUT_DESC, "(registros:", descartados.length + ")");