// distanciaGoogle.js
export async function obtenerTiemposReales(origen, destinos, apiKey) {
  const params = new URLSearchParams({
    origins: `${origen.lat},${origen.lon}`,
    destinations: destinos.map(d => `${d.lat},${d.lon}`).join('|'),
    mode: 'driving',
    key: apiKey,
  });

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.rows[0].elements.map(el => el.duration?.value || null);
  } catch (err) {
    console.error('❌ Error consultando Google Maps:', err);
    return [];
  }
}
