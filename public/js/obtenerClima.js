// public/js/obtenerClima.js
import { getLang } from "./i18n.js";

const hasProcessEnv = typeof process !== "undefined" && typeof process.env !== "undefined";
const browserEnv = typeof window !== "undefined" ? (window.__ENV__ || window.ENV || {}) : {};
let cachedWeatherApiKey = null;

function readFirstEnv(keys = []) {
  for (const key of keys) {
    const browserValue = browserEnv[key];
    if (typeof browserValue === "string" && browserValue.trim()) return browserValue.trim();
  }

  if (hasProcessEnv) {
    for (const key of keys) {
      const processValue = process.env[key];
      if (typeof processValue === "string" && processValue.trim()) return processValue.trim();
    }
  }

  return "";
}

function readFirstLocalStorage(keys = []) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return "";
  for (const key of keys) {
    const storageValue = localStorage.getItem(key);
    if (typeof storageValue === "string" && storageValue.trim()) return storageValue.trim();
  }
  return "";
}

function isLocalHostRuntime() {
  if (typeof window === "undefined") return false;
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isLikelyNetlifyDevRuntime() {
  if (typeof window === "undefined") return false;
  const port = String(window.location.port || "");
  return port === "8888" || port === "8889";
}

async function fetchRuntimeOpenWeatherKey() {
  if (typeof window === "undefined" || typeof fetch !== "function") return "";
  if (isLocalHostRuntime() && !isLikelyNetlifyDevRuntime()) return "";

  const endpoints = [
    "/.netlify/functions/openweather-browser-config",
    "/api/openweather-browser-config",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) continue;
      const payload = await response.json();
      const key = String(payload?.openWeatherApiKey || payload?.apiKey || "").trim();
      if (key) return key;
    } catch (_error) {
      // Intentar siguiente endpoint.
    }
  }

  return "";
}

async function resolveOpenWeatherApiKey() {
  if (typeof cachedWeatherApiKey === "string") return cachedWeatherApiKey;

  const envKey = readFirstEnv([
    "OPENWEATHER_API_KEY",
    "OPENWEATHER_BROWSER_KEY",
    "NEXT_PUBLIC_OPENWEATHER_API_KEY",
    "VITE_OPENWEATHER_API_KEY",
  ]);

  if (envKey) {
    cachedWeatherApiKey = envKey;
    return cachedWeatherApiKey;
  }

  const localStorageKey = readFirstLocalStorage([
    "OPENWEATHER_API_KEY",
    "OPENWEATHER_BROWSER_KEY",
    "NEXT_PUBLIC_OPENWEATHER_API_KEY",
    "VITE_OPENWEATHER_API_KEY",
  ]);
  if (localStorageKey) {
    cachedWeatherApiKey = localStorageKey;
    return cachedWeatherApiKey;
  }

  const runtimeKey = await fetchRuntimeOpenWeatherKey();
  cachedWeatherApiKey = runtimeKey || "";
  return cachedWeatherApiKey;
}

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

  const API_KEY = await resolveOpenWeatherApiKey();
  if (!API_KEY) {
    console.warn("⚠️ OPENWEATHER_API_KEY no configurada en runtime.");
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
