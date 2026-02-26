import { t } from '../js/i18n.js';

const LOCAL_OSRM_BASE = 'http://127.0.0.1:5000';
const REMOTE_OSRM_BASE = 'https://osrm.enpe-erre.com';

function resolveBaseUrl() {
  return window.location.hostname === 'localhost'
    ? LOCAL_OSRM_BASE
    : REMOTE_OSRM_BASE;
}

/**
 * Obtiene distancia y duración en vehículo desde OSRM.
 * @param {{ lat: number, lng: number }} from
 * @param {{ lat: number, lng: number }} to
 * @returns {Promise<{distancia: number, duracion: number} | null>}
 */
export async function getDrivingDistance(from, to) {
  try {
    const baseUrl = resolveBaseUrl();
    const url = `${baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error OSRM: ${res.status}`);

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    return {
      distancia: route.distance,
      duracion: route.duration
    };
  } catch (err) {
    console.error('Error en OSRM:', err);
    return null;
  }
}

export function formatTiempo(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'N/D';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) {
    return t(totalMin === 1 ? 'time.inMinute' : 'time.inMinutes', { n: totalMin });
  }

  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  const horasTexto = t(horas === 1 ? 'time.inHour' : 'time.inHours', { n: horas });

  if (minutos === 0) return horasTexto;

  return t('time.inHoursMinutes', { h: horas, m: minutos });
}
