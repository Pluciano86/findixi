// === IMPORTS ===
import fs from "fs";
import axios from "axios";
import { stringify } from "csv-stringify/sync";
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "busquedas/.env" });

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

// === CONFIGURACIÓN ===
const API_KEY =
  getArg("--api-key") ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_BROWSER_KEY;
const OUTPUT_DIR = `${process.env.HOME}/Desktop/llamadas-api-google`;
const ARCHIVO_SALIDA = getArg("--output") || `${OUTPUT_DIR}/lugares_turisticos.csv`;
const DELAY_MS = Number(getArg("--delay") || "1500");
const MUNICIPIO_FILTRO = getArg("--municipio");
const MUNICIPIOS_CSV = getArg("--municipios");
const MUNICIPIOS_FILE = getArg("--municipios-file");

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

const norm = (s = "") =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function detectarMunicipioDesdeDireccion(direccion = "") {
  const dirNorm = norm(direccion);
  if (!dirNorm) return "";
  const match = municipios.find((m) => dirNorm.includes(norm(m)));
  return match || "";
}

function loadMunicipiosObjetivo() {
  if (MUNICIPIO_FILTRO) {
    return municipios.filter((m) => norm(m) === norm(MUNICIPIO_FILTRO));
  }

  if (MUNICIPIOS_CSV) {
    const values = MUNICIPIOS_CSV
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const objetivo = municipios.filter((m) => values.some((v) => norm(v) === norm(m)));
    return Array.from(new Set(objetivo));
  }

  if (MUNICIPIOS_FILE) {
    if (!fs.existsSync(MUNICIPIOS_FILE)) {
      throw new Error(`No existe archivo de municipios: ${MUNICIPIOS_FILE}`);
    }
    const values = fs
      .readFileSync(MUNICIPIOS_FILE, "utf8")
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter((v) => v && !v.startsWith("#"));
    const objetivo = municipios.filter((m) => values.some((v) => norm(v) === norm(m)));
    return Array.from(new Set(objetivo));
  }

  return municipios;
}

// === FUNCIÓN PRINCIPAL ===
async function recolectarLugares() {
  if (!API_KEY || String(API_KEY).trim() === "") {
    throw new Error("Falta API key. Define GOOGLE_API_KEY o GOOGLE_MAPS_API_KEY");
  }

  const resultados = [];
  let totalConsultas = 0;
  let totalErroresApi = 0;
  let ultimoErrorApi = null;

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const municipiosObjetivo = loadMunicipiosObjetivo();

  if ((MUNICIPIO_FILTRO || MUNICIPIOS_CSV || MUNICIPIOS_FILE) && municipiosObjetivo.length === 0) {
    throw new Error("No se reconocieron municipios en los parámetros de filtro");
  }

  console.log(`🧭 Municipios objetivo: ${municipiosObjetivo.length}`);
  if (MUNICIPIO_FILTRO) {
    console.log(`🧭 Municipio filtro: ${MUNICIPIO_FILTRO}`);
  } else if (MUNICIPIOS_CSV) {
    console.log(`🧭 Municipios CSV: ${MUNICIPIOS_CSV}`);
  } else if (MUNICIPIOS_FILE) {
    console.log(`🧭 Municipios archivo: ${MUNICIPIOS_FILE}`);
  } else {
    console.log("🧭 Municipio filtro: todos");
  }
  console.log(`📁 Salida: ${ARCHIVO_SALIDA}`);

  for (const categoria of categorias) {
    for (const municipio of municipiosObjetivo) {
      const query = `${categoria} en ${municipio}, Puerto Rico`;
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`;
      
      console.log(`🔎 Buscando "${categoria}" en ${municipio}...`);
      totalConsultas++;

      try {
        const res = await axios.get(url);
        const data = res.data;
        const status = data?.status;

        if (status && status !== "OK" && status !== "ZERO_RESULTS") {
          totalErroresApi++;
          ultimoErrorApi = `${status}${data?.error_message ? `: ${data.error_message}` : ""}`;
          console.warn(`⚠️ API status en ${municipio}/${categoria}: ${ultimoErrorApi}`);
          // Si la key/config está mal, no tiene sentido seguir 1000+ consultas
          if (status === "REQUEST_DENIED" || status === "INVALID_REQUEST") {
            throw new Error(`Google Places rechazó la petición (${ultimoErrorApi})`);
          }
        }

        if (data.results?.length) {
          for (const lugar of data.results) {
            if (categoriasExcluidas.some(palabra => 
                lugar.name?.toLowerCase().includes(palabra) || 
                lugar.formatted_address?.toLowerCase().includes(palabra)
            )) continue;

            const municipioDetectado = detectarMunicipioDesdeDireccion(lugar.formatted_address || "");

            resultados.push({
              place_id: lugar.place_id || "",
              nombre: lugar.name || "",
              direccion: lugar.formatted_address || "",
              latitud: lugar.geometry?.location?.lat || "",
              longitud: lugar.geometry?.location?.lng || "",
              municipio: municipioDetectado || municipio,
              municipio_query: municipio,
              municipio_detectado: municipioDetectado || "",
              categoria,
              types: Array.isArray(lugar.types) ? lugar.types.join("|") : "",
              rating: lugar.rating ?? "",
              user_ratings_total: lugar.user_ratings_total ?? "",
              business_status: lugar.business_status || "",
              photo_ref: Array.isArray(lugar.photos) && lugar.photos[0]?.photo_reference
                ? lugar.photos[0].photo_reference
                : "",
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
          const nextStatus = nextData?.status;

          if (nextStatus && nextStatus !== "OK" && nextStatus !== "ZERO_RESULTS") {
            totalErroresApi++;
            ultimoErrorApi = `${nextStatus}${nextData?.error_message ? `: ${nextData.error_message}` : ""}`;
            console.warn(`⚠️ API status paginación en ${municipio}/${categoria}: ${ultimoErrorApi}`);
            if (nextStatus === "REQUEST_DENIED" || nextStatus === "INVALID_REQUEST") {
              throw new Error(`Google Places rechazó la paginación (${ultimoErrorApi})`);
            }
          }

          if (nextData.results?.length) {
            for (const lugar of nextData.results) {
              if (categoriasExcluidas.some(palabra => 
                  lugar.name?.toLowerCase().includes(palabra) || 
                  lugar.formatted_address?.toLowerCase().includes(palabra)
              )) continue;

              const municipioDetectado = detectarMunicipioDesdeDireccion(lugar.formatted_address || "");

              resultados.push({
                place_id: lugar.place_id || "",
                nombre: lugar.name || "",
                direccion: lugar.formatted_address || "",
                latitud: lugar.geometry?.location?.lat || "",
                longitud: lugar.geometry?.location?.lng || "",
                municipio: municipioDetectado || municipio,
                municipio_query: municipio,
                municipio_detectado: municipioDetectado || "",
                categoria,
                types: Array.isArray(lugar.types) ? lugar.types.join("|") : "",
                rating: lugar.rating ?? "",
                user_ratings_total: lugar.user_ratings_total ?? "",
                business_status: lugar.business_status || "",
                photo_ref: Array.isArray(lugar.photos) && lugar.photos[0]?.photo_reference
                  ? lugar.photos[0].photo_reference
                  : "",
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
  console.log(`⚠️ Total respuestas API no-OK: ${totalErroresApi}`);
  if (ultimoErrorApi) {
    console.log(`⚠️ Último error API: ${ultimoErrorApi}`);
  }
}

// === EJECUTAR ===
recolectarLugares();
