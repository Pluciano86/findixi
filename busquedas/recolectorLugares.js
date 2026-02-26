// === IMPORTS ===
import fs from "fs";
import axios from "axios";
import { stringify } from "csv-stringify/sync";
import dotenv from "dotenv";
dotenv.config();

// === CONFIGURACIÓN ===
const API_KEY = process.env.GOOGLE_API_KEY;
const OUTPUT_DIR = `${process.env.HOME}/Desktop/llamadas-api-google`;
const ARCHIVO_SALIDA = `${OUTPUT_DIR}/lugares_turisticos.csv`;
const DELAY_MS = 1500;

// === MUNICIPIOS DE PUERTO RICO ===
const municipios = [
  "Adjuntas", "Aguada", "Aguadilla", "Aguas Buenas", "Aibonito", "Añasco", "Arecibo", "Arroyo",
  "Barceloneta", "Barranquitas", "Bayamón", "Cabo Rojo", "Caguas", "Camuy", "Canóvanas", "Carolina",
  "Cataño", "Cayey", "Ceiba", "Ciales", "Cidra", "Coamo", "Comerío", "Corozal", "Culebra",
  "Dorado", "Fajardo", "Florida", "Guánica", "Guayama", "Guayanilla", "Guaynabo", "Gurabo",
  "Hatillo", "Hormigueros", "Humacao", "Isabela", "Jayuya", "Juana Díaz", "Juncos", "Lajas",
  "Lares", "Las Marías", "Las Piedras", "Loíza", "Luquillo", "Manatí", "Maricao", "Maunabo",
  "Mayagüez", "Moca", "Morovis", "Naguabo", "Naranjito", "Orocovis", "Patillas", "Peñuelas",
  "Ponce", "Quebradillas", "Rincón", "Río Grande", "Sabana Grande", "Salinas", "San Germán",
  "San Juan", "San Lorenzo", "San Sebastián", "Santa Isabel", "Toa Alta", "Toa Baja", "Trujillo Alto",
  "Utuado", "Vega Alta", "Vega Baja", "Vieques", "Villalba", "Yabucoa", "Yauco"
];

// === CATEGORÍAS TURÍSTICAS ===
const categorias = [
  "Museos", 
  "Miradores", 
  "Parques Naturales", 
  "Zoológicos", 
  "Plazas Públicas", 
  "Monumentos Históricos",
  "Faros", 
  "Jardines Botánicos", 
  "Arte Urbano", 
  "Teatros", 
  "Ríos", 
  "Lagos", 
  "Charcas", 
  "Cascadas"
];

const categoriasExcluidas = ["playa", "montaña", "hacienda", "isla", "cueva marina"];

// === FUNCIÓN DE RETARDO ===
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// === FUNCIÓN PRINCIPAL ===
async function recolectarLugares() {
  const resultados = [];
  let totalConsultas = 0;

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const categoria of categorias) {
    for (const municipio of municipios) {
      const query = `${categoria} en ${municipio}, Puerto Rico`;
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`;
      
      console.log(`🔎 Buscando "${categoria}" en ${municipio}...`);
      totalConsultas++;

      try {
        const res = await axios.get(url);
        const data = res.data;

        if (data.results?.length) {
          for (const lugar of data.results) {
            if (categoriasExcluidas.some(palabra => 
                lugar.name?.toLowerCase().includes(palabra) || 
                lugar.formatted_address?.toLowerCase().includes(palabra)
            )) continue;

            resultados.push({
              nombre: lugar.name || "",
              direccion: lugar.formatted_address || "",
              latitud: lugar.geometry?.location?.lat || "",
              longitud: lugar.geometry?.location?.lng || "",
              municipio,
              categoria
            });
          }
        }

        // Paginación
        let nextPageToken = data.next_page_token;
        while (nextPageToken) {
          await delay(2500);
          const nextUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${API_KEY}`;
          const nextRes = await axios.get(nextUrl);
          const nextData = nextRes.data;

          if (nextData.results?.length) {
            for (const lugar of nextData.results) {
              if (categoriasExcluidas.some(palabra => 
                  lugar.name?.toLowerCase().includes(palabra) || 
                  lugar.formatted_address?.toLowerCase().includes(palabra)
              )) continue;

              resultados.push({
                nombre: lugar.name || "",
                direccion: lugar.formatted_address || "",
                latitud: lugar.geometry?.location?.lat || "",
                longitud: lugar.geometry?.location?.lng || "",
                municipio,
                categoria
              });
            }
          }
          nextPageToken = nextData.next_page_token;
        }
      } catch (err) {
        console.error(`❌ Error en ${municipio} (${categoria}):`, err.message);
      }

      await delay(DELAY_MS);
    }
  }

  // === GUARDAR CSV ===
  fs.writeFileSync(
    ARCHIVO_SALIDA,
    stringify(resultados, { header: true })
  );

  console.log(`✅ Archivo generado: ${ARCHIVO_SALIDA}`);
  console.log(`📊 Total de resultados: ${resultados.length}`);
  console.log(`📞 Total de consultas realizadas: ${totalConsultas}`);
}

// === EJECUTAR ===
recolectarLugares();