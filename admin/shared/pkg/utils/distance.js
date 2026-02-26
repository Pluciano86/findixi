function seleccionarVelocidad(distanciaKm = 0) {
  if (distanciaKm < 5) return 30;
  if (distanciaKm < 15) return 45;
  if (distanciaKm < 40) return 60;
  return 75;
}

export function calcularTiempoEnVehiculo(distanciaKm = 0) {
  const distancia = Number.isFinite(distanciaKm) ? Math.max(distanciaKm, 0) : 0;
  const velocidad = seleccionarVelocidad(distancia);
  const minutos = Math.round((distancia / velocidad) * 60);

  if (minutos >= 60) {
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    const texto = minutosRestantes === 0 ? `${horas}h` : `${horas}h ${minutosRestantes}min`;
    return { minutos, texto };
  }

  return { minutos, texto: `${minutos} min` };
}

export function calcularDistanciaHaversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}
