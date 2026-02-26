// ===============================
// BUSCAR COORDENADAS DE PLAYAS
// ===============================

import fs from "fs";
import axios from "axios";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import dotenv from "dotenv";
dotenv.config();

// === API KEY ===
const API_KEY = process.env.GOOGLE_API_KEY;

// === RUTAS ===
const BASE = `${process.env.HOME}/Desktop/llamadas-api-google`;
const INPUT = `${BASE}/playasNoCoordenadas.csv`;
const OUTPUT = `${BASE}/playas_coordenadas.csv`;

// === DELAY para evitar bloqueo ===
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// === FUNCIÓN PRINCIPAL ===
async function buscarCoordenadas() {

  console.log("🔎 Cargando lista de playas...");

  const raw = fs.readFileSync(INPUT, "utf8");
  const filas = parse(raw, { columns: true, skip_empty_lines: true });

  const resultados = [];

  let count = 0;

  for (const row of filas) {
    const { id, nombre } = row;

    count++;
    console.log(`(${count}/${filas.length}) 🌊 Buscando: ${nombre}`);

    let lat = "";
    let lng = "";

    try {
      const query = `${nombre} Puerto Rico`;
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`;

      const res = await axios.get(url);

      const first = res.data.results?.[0];

      if (first && first.geometry?.location) {
        lat = first.geometry.location.lat;
        lng = first.geometry.location.lng;
      } else {
        console.warn(`⚠️ No se encontraron coordenadas para: ${nombre}`);
      }

    } catch (err) {
      console.error(`❌ Error buscando ${nombre}:`, err.message);
    }

    resultados.push({
      id,
      latitud: lat,
      longitud: lng
    });

    await delay(1500); // evitar rate limit
  }

  // === GUARDAR CSV ===
  fs.writeFileSync(OUTPUT, stringify(resultados, { header: true }));

  console.log("\n✅ Búsqueda completada");
  console.log(`📁 Archivo generado: ${OUTPUT}`);
  console.log(`📌 Total procesadas: ${filas.length}`);
}

// Ejecutar
buscarCoordenadas();