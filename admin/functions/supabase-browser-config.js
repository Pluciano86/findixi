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

  const allowedOrigins = String(process.env.SUPABASE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

  if (allowedOrigins.length && origin) {
    const isAllowed = allowedOrigins.some((allowed) => origin.startsWith(allowed));
    if (!isAllowed) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Origen no permitido para configuración de Supabase.' }),
      };
    }
  }

  const supabaseUrl = envFirst([
    'SUPABASE_URL',
    'FINDIXI_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL',
  ]);

  const supabaseAnonKey = envFirst([
    'SUPABASE_ANON_KEY',
    'FINDIXI_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
  ]);

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Faltan SUPABASE_URL o SUPABASE_ANON_KEY en variables de entorno.' }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
    body: JSON.stringify({
      supabaseUrl,
      supabaseAnonKey,
    }),
  };
};
