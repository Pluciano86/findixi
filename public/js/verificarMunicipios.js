// === IMPORTS (CommonJS) ===
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

// === CONFIGURACIÓN ===
const archivoEntrada = "comercios_filtrados_v2.csv";
const archivoSalida = "comercios_verificados.csv";

// Lista completa de municipios de Puerto Rico (para validación en direcciones)
const municipiosPR = [
  "Adjuntas", "Aguada", "Aguadilla", "Aguas Buenas", "Aibonito", "Añasco", "Arecibo", "Arroyo",
  "Barceloneta", "Barranquitas", "Bayamón", "Cabo Rojo", "Caguas", "Camuy", "Canóvanas",
  "Carolina", "Cataño", "Cayey", "Ceiba", "Ciales", "Cidra", "Coamo", "Comerío", "Corozal",
  "Culebra", "Dorado", "Fajardo", "Florida", "Guánica", "Guayama", "Guayanilla", "Guaynabo",
  "Gurabo", "Hatillo", "Hormigueros", "Humacao", "Isabela", "Jayuya", "Juana Díaz", "Juncos",
  "Lajas", "Lares", "Las Marías", "Las Piedras", "Loíza", "Luquillo", "Manatí", "Maricao",
  "Maunabo", "Mayagüez", "Moca", "Morovis", "Naguabo", "Naranjito", "Orocovis", "Patillas",
  "Peñuelas", "Ponce", "Quebradillas", "Rincón", "Río Grande", "Sabana Grande", "Salinas",
  "San Germán", "San Juan", "San Lorenzo", "San Sebastián", "Santa Isabel", "Toa Alta",
  "Toa Baja", "Trujillo Alto", "Utuado", "Vega Alta", "Vega Baja", "Vieques", "Villalba",
  "Yabucoa", "Yauco"
];

// Palabras de alojamiento a eliminar
const excluirAlojamiento = [
  "hotel", "resort", "villa", "villas", "parador", "hacienda", "guest house",
  "guesthouse", "lodge", "bnb", "airbnb", "inn", "finca", "apartamento", "apartments",
  "condo", "suite", "suites", "casas", "alojamiento", "hospedaje"
];

// === PROCESAMIENTO ===
const input = fs.readFileSync(archivoEntrada, "utf8");
const registros = parse(input, { columns: true, skip_empty_lines: true });

let corregidos = 0;
let eliminados = 0;

// Verificar y limpiar
const verificados = registros.filter((r) => {
  const nombre = (r.nombre || "").toLowerCase();
  const direccion = (r.direccion || "").toLowerCase();
  let municipio = (r.municipio || "").trim();

  // 🔍 Si la dirección contiene el nombre de otro municipio, corrige
  for (const muni of municipiosPR) {
    if (direccion.includes(muni.toLowerCase()) && municipio.toLowerCase() !== muni.toLowerCase()) {
      r.municipio = muni;
      corregidos++;
      break;
    }
  }

  // 🚫 Eliminar alojamientos (por nombre o dirección)
  if (excluirAlojamiento.some((p) => nombre.includes(p) || direccion.includes(p))) {
    eliminados++;
    return false;
  }

  return true;
});

// === ESCRIBIR NUEVO CSV ===
const output = stringify(verificados, { header: true });
fs.writeFileSync(archivoSalida, output);

console.log(`✅ Archivo generado: ${archivoSalida}`);
console.log(`📊 Comercios verificados: ${verificados.length}`);
console.log(`🔁 Municipios corregidos: ${corregidos}`);
console.log(`🗑️ Alojamientos eliminados: ${eliminados}`);