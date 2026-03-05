function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

function envFirst(keys = []) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
}

exports.handler = async function handler(event) {
  const origin = normalizeOrigin(
    event?.headers?.origin || event?.headers?.Origin || event?.headers?.referer || event?.headers?.Referer || ''
  );

  const allowedOrigins = String(process.env.OPENWEATHER_ALLOWED_ORIGINS || process.env.GOOGLE_MAPS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

  if (allowedOrigins.length && origin) {
    const isAllowed = allowedOrigins.some((allowed) => origin.startsWith(allowed));
    if (!isAllowed) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Origen no permitido para configuración de OpenWeather.' }),
      };
    }
  }

  const openWeatherApiKey = envFirst([
    'OPENWEATHER_API_KEY',
    'OPENWEATHER_BROWSER_KEY',
    'NEXT_PUBLIC_OPENWEATHER_API_KEY',
    'VITE_OPENWEATHER_API_KEY',
  ]);

  if (!openWeatherApiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Falta OPENWEATHER_API_KEY en variables de entorno.' }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
    body: JSON.stringify({ openWeatherApiKey }),
  };
};
