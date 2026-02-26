import { calcularTiempoEnVehiculo } from '../shared/utils.js';
import { getDrivingDistance, formatTiempo } from '../shared/osrmClient.js';

// Calcula la distancia Haversine entre dos coordenadas
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function calcularTiemposParaLista(lista, origenCoords = {}) {
  const origenLat = Number(origenCoords.lat);
  const origenLon = Number(origenCoords.lon);
  const origenValido = Number.isFinite(origenLat) && Number.isFinite(origenLon);

  const lugaresValidos = lista.filter(l =>
    Number.isFinite(Number(l.latitud)) &&
    Number.isFinite(Number(l.longitud))
  );

  await Promise.all(lugaresValidos.map(async (lugar) => {
    const destinoLat = Number(lugar.latitud);
    const destinoLon = Number(lugar.longitud);
    if (!Number.isFinite(destinoLat) || !Number.isFinite(destinoLon)) return;

    let distanciaKm = origenValido
      ? calcularDistanciaHaversine(origenLat, origenLon, destinoLat, destinoLon)
      : null;

    let minutosCrudos = null;
    let texto = null;

    if (origenValido) {
      const resultado = await getDrivingDistance(
        { lat: origenLat, lng: origenLon },
        { lat: destinoLat, lng: destinoLon }
      );
      if (resultado?.duracion != null) {
        minutosCrudos = Math.round(resultado.duracion / 60);
        texto = formatTiempo(resultado.duracion);
        if (typeof resultado.distancia === 'number') {
          distanciaKm = resultado.distancia / 1000;
        }
      }
    }

    if (!texto && Number.isFinite(distanciaKm)) {
      const fallback = calcularTiempoEnVehiculo(distanciaKm);
      minutosCrudos = fallback.minutos;
      texto = formatTiempo(fallback.minutos * 60);
    }

    if (!texto) texto = 'N/D';

    lugar.tiempoVehiculo = texto;
    lugar.tiempoTexto = texto;
    lugar.minutosCrudos = minutosCrudos;
    lugar.distanciaKm = distanciaKm;
    lugar.distanciaTexto = Number.isFinite(distanciaKm) ? `${distanciaKm.toFixed(1)} km` : null;
  }));

  return lista;
}
