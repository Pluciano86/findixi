import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// ===============================
// CONFIGURACIÓN
// ===============================
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;   // <-- YA LA TIENES GUARDADA
const GOOGLE_CX = "83b2e97d1eb61484f";               // <-- Tu nuevo Custom Search Engine

const BASE_DIR = process.cwd();
const CSV_FILE = "/Users/pedroluciano/Desktop/llamadas-api-google/playasSinImagen.csv";
const OUTPUT_DIR = BASE_DIR; // guardaremos las imágenes aquí

// ===============================
// Función: normalizar nombre de archivo
// ===============================
function normalizarNombre(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_"); // reemplazar espacios y símbolos
}

// ===============================
// Google Search API – obtener 1 imagen
// ===============================
async function buscarImagenGoogle(query) {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&searchType=image&q=${encodeURIComponent(query)}&num=1`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      return null;
    }

    return data.items[0].link; // URL de la imagen
  } catch (err) {
    console.error("Error en búsqueda Google:", err.message);
    return null;
  }
}

// ===============================
// Descargar imagen desde URL
// ===============================
async function descargarImagen(url, filePath) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error("❌ Falló descarga:", url);
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return true;
  } catch (err) {
    console.error("❌ Error descargando imagen:", err.message);
    return false;
  }
}

// ===============================
// Leer CSV
// ===============================
function leerCSV(ruta) {
  const contenido = fs.readFileSync(ruta, "utf8")
    .trim()
    .split("\n")
    .map(line => {
      const [id, nombre, municipio] = line.split(",");
      return { id, nombre, municipio };
    });
  return contenido;
}

// ===============================
// PROCESAR TODAS LAS PLAYAS
// ===============================
async function procesar() {
  console.log("📄 Leyendo CSV...");
  const playas = leerCSV(CSV_FILE);

  console.log(`📌 Procesando ${playas.length} playas...\n`);

  for (const playa of playas) {
    const query = `${playa.nombre} ${playa.municipio} Puerto Rico`;

    console.log(`🔍 Buscando imagen: ${query}`);

    const urlImagen = await buscarImagenGoogle(query);

    if (!urlImagen) {
      console.log(`❌ No se encontró imagen para ${playa.nombre}\n`);
      continue;
    }

    const nombreFile = normalizarNombre(playa.nombre) + ".jpg";
    const savePath = path.join(OUTPUT_DIR, nombreFile);

    console.log(`⬇️  Descargando: ${urlImagen}`);

    const exito = await descargarImagen(urlImagen, savePath);

    if (exito) {
      console.log(`✅ Imagen guardada: ${nombreFile}\n`);
    } else {
      console.log(`❌ Error guardando imagen de ${playa.nombre}\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 800)); // evitar rate limit
  }

  console.log("\n🎉 PROCESO FINALIZADO");
}

procesar();