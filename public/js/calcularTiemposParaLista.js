import { getDrivingDistance, formatTiempo } from '../shared/osrmClient.js';
import {
  calcularDistanciaHaversineKm,
  calcularTiempoEnVehiculo,
} from '../shared/pkg/utils/distance.js';

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
      ? calcularDistanciaHaversineKm(origenLat, origenLon, destinoLat, destinoLon)
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
