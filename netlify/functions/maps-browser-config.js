function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\/+$/, '');
}

exports.handler = async function handler(event) {
  const origin = normalizeOrigin(
    event?.headers?.origin || event?.headers?.Origin || event?.headers?.referer || event?.headers?.Referer || ''
  );

  const allowedOrigins = String(process.env.GOOGLE_MAPS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

  if (allowedOrigins.length && origin) {
    const isAllowed = allowedOrigins.some((allowed) => origin.startsWith(allowed));
    if (!isAllowed) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Origen no permitido para configuración de mapas.' }),
      };
    }
  }

  const googleMapsKey =
    process.env.GOOGLE_MAPS_BROWSER_KEY ||
    process.env.GOOGLE_MAPS_API_KEY_BROWSER ||
    '';

  if (!googleMapsKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Falta GOOGLE_MAPS_BROWSER_KEY en variables de entorno.' }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
    body: JSON.stringify({ googleMapsKey }),
  };
};
