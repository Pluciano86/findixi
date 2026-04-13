// === IMPORTS ===
const fs = require("fs");
const axios = require("axios");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
require("dotenv").config();

// === CONFIGURACIÓN ===
const API_KEY = process.env.GOOGLE_API_KEY;
const archivoEntrada = "comercios_organizados.csv"; // o comercios_verificados.csv
const archivoSalida = "comercios_con_telefonos.csv";
const delayMs = 1500; // 1.5 segundos entre llamadas (seguro)

// === FUNCIÓN PRINCIPAL ===
async function obtenerTelefono(nombre, municipio) {
  try {
    const query = `${nombre} ${municipio} Puerto Rico`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`;
    const searchRes = await axios.get(searchUrl);

    if (!searchRes.data.results?.length) return "";

    const placeId = searchRes.data.results[0].place_id;
    if (!placeId) return "";

    // Obtener detalles del lugar (incluye teléfono)
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number&key=${API_KEY}`;
    const detailsRes = await axios.get(detailsUrl);

    return detailsRes.data.result?.formatted_phone_number || "";
  } catch (err) {
    console.error("❌ Error con:", nombre, err.message);
    return "";
  }
}

// === PROCESAR CSV ===
(async () => {
  const input = fs.readFileSync(archivoEntrada, "utf8");
  const registros = parse(input, { columns: true, skip_empty_lines: true });

  const resultados = [];
  let count = 0;

  for (const r of registros) {
    const categorias = (r.categoria || "").split(",").map(x => x.trim().toLowerCase());
    // ⚠️ Saltar los que son solo "Jangueo"
    if (categorias.length === 1 && categorias[0] === "jangueo") {
      resultados.push({ ...r, telefono: "" });
      continue;
    }

    console.log(`🔎 [${++count}/${registros.length}] Buscando teléfono para: ${r.nombre} (${r.municipio})`);
    const telefono = await obtenerTelefono(r.nombre, r.municipio);

    resultados.push({ ...r, telefono });

    // Esperar entre solicitudes
    await new Promise(res => setTimeout(res, delayMs));
  }

  // === GUARDAR RESULTADOS ===
  const output = stringify(resultados, { header: true });
  fs.writeFileSync(archivoSalida, output);

  console.log(`✅ Archivo generado: ${archivoSalida}`);
})();