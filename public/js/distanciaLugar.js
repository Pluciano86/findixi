import { getDrivingDistance, formatTiempo } from '../shared/osrmClient.js';

function formatearMinutosConversacional(min) {
  if (!Number.isFinite(min)) return null;
  if (min < 60) return `a ${min} minutos`;
  const horas = Math.floor(min / 60);
  const mins = min % 60;
  let texto = `a ${horas} hora${horas === 1 ? '' : 's'}`;
  if (mins) texto += ` y ${mins} minutos`;
  return texto;
}

export async function calcularTiemposParaLugares(lista, origenCoords = {}) {
  if (!Array.isArray(lista) || lista.length === 0) return lista;

  const origenLat = Number(origenCoords.lat);
  const origenLon = Number(origenCoords.lon);
  const origenValido = Number.isFinite(origenLat) && Number.isFinite(origenLon);
  if (!origenValido) return lista;

  const lugaresValidos = lista.filter(l =>
    Number.isFinite(Number(l.latitud)) &&
    Number.isFinite(Number(l.longitud))
  );

  await Promise.all(lugaresValidos.map(async (lugar) => {
    const destinoLat = Number(lugar.latitud);
    const destinoLon = Number(lugar.longitud);
    if (!Number.isFinite(destinoLat) || !Number.isFinite(destinoLon)) return;

    const distanciaHaversine = calcularDistancia(origenLat, origenLon, destinoLat, destinoLon);

    const resultado = await getDrivingDistance(
      { lat: origenLat, lng: origenLon },
      { lat: destinoLat, lng: destinoLon }
    );

    let minutos = resultado?.duracion != null ? Math.round(resultado.duracion / 60) : null;
    let texto = resultado?.duracion != null ? formatTiempo(resultado.duracion) : null;
    let distanciaKm = typeof resultado?.distancia === 'number'
      ? resultado.distancia / 1000
      : distanciaHaversine;

    if (minutos === null && Number.isFinite(distanciaHaversine)) {
      const velocidad = distanciaHaversine < 5
        ? 30
        : distanciaHaversine < 15
          ? 45
          : distanciaHaversine < 40
            ? 60
            : 75;
      minutos = Math.round((distanciaHaversine / velocidad) * 60);
      texto = formatTiempo(minutos * 60);
    }

    if (!texto) texto = 'N/D';

    lugar.tiempoTexto = texto;
    lugar.tiempoVehiculo = texto;
    lugar.minutosCrudos = minutos;
    lugar.distanciaLugar = distanciaKm;
    lugar.distanciaTexto = Number.isFinite(distanciaKm) ? `${distanciaKm.toFixed(1)} km` : null;
  }));

  return lista;
}

export function calcularDistancia(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const R = 6371;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
