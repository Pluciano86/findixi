exports.handler = async function (event) {
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  if (!GOOGLE_MAPS_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Falta GOOGLE_MAPS_API_KEY en variables de entorno' })
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Falta el body en la petición' })
    };
  }

  const { origen, destinos } = JSON.parse(event.body);

  const params = new URLSearchParams({
    origins: `${origen.lat},${origen.lon}`,
    destinations: destinos.map((d) => `${d.lat},${d.lon}`).join('|'),
    mode: 'driving',
    units: 'metric',
    key: GOOGLE_MAPS_API_KEY
  });

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`;

  try {
    // 👇 Import dinámico aquí resuelve el problema
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    const data = await response.json();

    const tiempos = data.rows[0].elements.map((el) => el.duration?.value || null);

    return {
      statusCode: 200,
      body: JSON.stringify({ tiempos })
    };
  } catch (err) {
    console.error('Error en función distance:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error consultando Google Maps' })
    };
  }
};