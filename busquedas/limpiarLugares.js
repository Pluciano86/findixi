// ===============================
// LIMPIEZA DE LUGARES TURÍSTICOS
// ===============================

import fs from "fs";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

// === CONFIG (RUTAS CORRECTAS) ===
const BASE = `${process.env.HOME}/Desktop/llamadas-api-google`;
const INPUT = getArg("--input") || `${BASE}/lugares_turisticos.csv`;
const OUTPUT = getArg("--output") || `${BASE}/lugares_limpios.csv`;
const OUTPUT_DESC = getArg("--descartados") || `${BASE}/lugares_descartados.csv`;

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
const KEY_MIRADOR = ["mirador", "viewpoint", "lookout"];
const KEY_MUSEO = ["museo", "museum"];
const KEY_FARO = ["faro", "lighthouse"];
const KEY_TEATRO = ["teatro", "theater", "theatre", "performing arts"];
const KEY_MONUMENTO = ["monumento", "monument", "historic", "histórico", "estatua"];
const KEY_JARDIN = ["jardin", "jardín", "botanico", "botánico", "garden"];
const KEY_PASEO = ["paseo", "malecon", "malecón", "boardwalk", "waterfront", "guancha"];

function categoriaPorTypesYNombre(typesRaw = "", nombre = "", categoriaOriginal = "") {
  const types = norm(typesRaw).split("|").map((t) => t.trim()).filter(Boolean);
  const n = norm(nombre);
  const c = norm(categoriaOriginal);

  const hasType = (value) => types.includes(value);

  if (contiene(n, KEY_PASEO)) return "Paseo Marítimo";
  if (contiene(n, KEY_CASCADA) || hasType("waterfall")) return "Cascada";
  if (contiene(n, KEY_RIO) || hasType("natural_feature")) return "Río / Charca";
  if (contiene(n, KEY_CATEDRAL) || hasType("church")) return "Catedral";
  if (contiene(n, KEY_MUSEO) || hasType("museum")) return "Museo";
  if (contiene(n, KEY_MIRADOR)) return "Mirador";
  if (contiene(n, KEY_FARO)) return "Faro";
  if (contiene(n, KEY_TEATRO) || hasType("performing_arts_theater")) return "Teatro";
  if (contiene(n, KEY_MONUMENTO) || hasType("monument")) return "Monumento";
  if (contiene(n, KEY_JARDIN) || hasType("botanical_garden")) return "Jardín";
  if (hasType("zoo")) return "Zoológico";

  if (c.includes("museo")) return "Museo";
  if (c.includes("mirador")) return "Mirador";
  if (c.includes("faro")) return "Faro";
  if (c.includes("teatro")) return "Teatro";
  if (c.includes("monumento")) return "Monumento";
  if (c.includes("jardin")) return "Jardín";
  if (c.includes("plaza")) return "Plaza Pública";
  if (c.includes("parque")) return "Parque";

  return categoriaOriginal || "Otros";
}

// === PROCESO ===
const vistos = new Set();
const limpios = [];
const descartados = [];

for (const r of filas) {
  
  let { nombre, direccion, municipio, categoria, types, municipio_detectado } = r;
  const municipioFinal = (municipio_detectado || municipio || "").trim();

  if (!nombre || !municipioFinal) {
    descartados.push({ ...r, motivo: "datos incompletos" });
    continue;
  }

  // Normalización para detectar duplicados:
  // prioridad por place_id (más estable), fallback nombre+municipio.
  const placeId = (r.place_id || "").trim();
  const clave = placeId
    ? `place_${placeId}`
    : norm(nombre) + "_" + norm(municipioFinal);
  if (vistos.has(clave)) {
    descartados.push({ ...r, motivo: "duplicado" });
    continue;
  }
  vistos.add(clave);

  // REGLA: Determinar categoría correcta por palabras del nombre
  const nombreNorm = norm(nombre);

  categoria = categoriaPorTypesYNombre(types, nombre, categoria);

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

  // Validar municipio vs dirección (modo flexible):
  // Antes se descartaba si no coincidía exacto y se perdían demasiados registros.
  // Ahora solo se marca y conserva para revisión posterior.
  if (direccion && direccion !== "") {
    const muniDireccion = extraerMunicipio(direccion);
    if (muniDireccion && norm(muniDireccion) !== norm(municipioFinal)) {
      r.observacion = "municipio_direccion_no_coincide";
    }
  }

  // Campo Catedral (si existe)
  if (categoria !== "Catedral" && "catedral" in r) {
    r.catedral = "";
  }

  // Guardar limpio
  limpios.push({
    ...r,
    municipio: municipioFinal,
    categoria
  });
}

// === GUARDAR RESULTADOS ===
fs.writeFileSync(OUTPUT, stringify(limpios, { header: true }));
fs.writeFileSync(OUTPUT_DESC, stringify(descartados, { header: true }));

console.log("✅ Limpieza completada");
console.log("👉 Guardado:", OUTPUT, "(registros:", limpios.length + ")");
console.log("🗑️ Descartados:", OUTPUT_DESC, "(registros:", descartados.length + ")");
