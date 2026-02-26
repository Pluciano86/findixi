// public/js/obtenerClima.js
import { getLang } from "./i18n.js";
const API_KEY = "2c1d54239e886b97ed52ac446c3ae948"; // Clave de OpenWeatherMap

/**
 * Obtiene información del clima actual a partir de coordenadas.
 * @param {number} lat - Latitud
 * @param {number} lon - Longitud
 * @returns {Promise<object|null>} Datos del clima o null si falla
 */
export async function obtenerClima(lat, lon) {
  if (!lat || !lon) {
    console.warn("⚠️ Coordenadas no disponibles para obtener el clima");
    return null;
  }

  const lang = resolveWeatherLang(getLang());
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&lang=${lang}&appid=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

    const data = await response.json();

    // === Datos principales ===
    const temperatura = `${Math.round(data.main.temp)}°F`;
    const min = `${Math.round(data.main.temp_min)}°F`;
    const max = `${Math.round(data.main.temp_max)}°F`;
    const viento = `${Math.round(data.wind.speed)} mph`;
    const humedad = `${data.main.humidity}%`;
    const estado = data.weather?.[0]?.description || "Sin datos";
    const icono = data.weather?.[0]?.icon || "01d";

    // === Asignar icono desde tu bucket de Supabase ===
    const iconoURL = obtenerIconoClima(icono);

    return { temperatura, min, max, viento, humedad, estado, iconoURL };
  } catch (err) {
    console.error("❌ Error al obtener clima:", err.message);
    return null;
  }
}

function resolveWeatherLang(lang) {
  const base = String(lang || "es").toLowerCase().split("-")[0];
  const map = {
    es: "es",
    en: "en",
    fr: "fr",
    de: "de",
    pt: "pt",
    it: "it",
    zh: "zh_cn",
    ko: "kr",
    ja: "ja",
  };
  return map[base] || "es";
}

/**
 * Devuelve la URL del ícono correspondiente según el código del clima.
 * Los archivos SVG se encuentran en: /imagenesapp/enpr/
 */
function obtenerIconoClima(icono) {
  if (!icono) return null;

  const base =
    "https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/";

  const mapa = {
    "01d": "1.svg",   // Cielo despejado (día)
    "01n": "1n.svg",  // Cielo despejado (noche)
    "02d": "2.svg",   // Parcialmente nublado (día)
    "02n": "2n.svg",  // Parcialmente nublado (noche)
    "03d": "2.svg",   // Nublado
    "03n": "3.svg",
    "04d": "45.svg",  // Nubes densas
    "04n": "45.svg",
    "09d": "61.svg",  // Lluvia ligera
    "09n": "61.svg",
    "10d": "53.svg",  // Lluvia moderada
    "10n": "53.svg",
    "11d": "95.svg",  // Tormentas
    "11n": "95.svg",
    "13d": "55.svg",  // Nieve
    "13n": "55.svg",
    "50d": "51.svg",  // Neblina
    "50n": "51n.svg",
  };

  const archivo = mapa[icono] || "1.svg";
  return `${base}${archivo}`;
}
