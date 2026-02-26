const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const APP_SEGMENTS = Object.freeze({
  public: '/public',
  comercio: '',
  admin: '/admin',
});

const REMOTE_DEFAULTS = Object.freeze({
  public: 'https://test.findixi.com',
  comercio: 'https://comercio.findixi.com',
  admin: 'https://administ.findixi.com',
});

function getBrowserEnv() {
  if (typeof window === 'undefined') return {};
  return window.__ENV__ || window.ENV || {};
}

function readFirstEnv(keys = []) {
  const browserEnv = getBrowserEnv();
  for (const key of keys) {
    const browserValue = browserEnv[key];
    if (typeof browserValue === 'string' && browserValue.trim()) return browserValue.trim();
  }

  if (typeof process !== 'undefined' && process?.env) {
    for (const key of keys) {
      const processValue = process.env[key];
      if (typeof processValue === 'string' && processValue.trim()) return processValue.trim();
    }
  }

  return '';
}

function normalizeBaseUrl(value, fallback) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  const fallbackValue = String(fallback || '').trim();
  if (!candidate) return fallbackValue.replace(/\/+$/, '');

  try {
    return new URL(candidate).origin.replace(/\/+$/, '');
  } catch (_error) {
    return fallbackValue.replace(/\/+$/, '');
  }
}

export function isLocalRuntime() {
  if (typeof window === 'undefined') return false;
  return LOCAL_HOSTNAMES.has(String(window.location.hostname || '').toLowerCase());
}

function getRemoteBaseUrl(appName) {
  const envKeysByApp = {
    public: ['FINDIXI_PUBLIC_BASE_URL', 'PUBLIC_BASE_URL'],
    comercio: [
      'FINDIXI_COMERCIO_BASE_URL',
      'FINDIXI_COMERCIO_LOGIN_BASE_URL',
      'COMERCIO_BASE_URL',
      'COMERCIO_LOGIN_BASE_URL',
    ],
    admin: ['FINDIXI_ADMIN_BASE_URL', 'ADMIN_BASE_URL'],
  };

  const envKeys = envKeysByApp[appName] || [];
  const fallback = REMOTE_DEFAULTS[appName] || '';
  return normalizeBaseUrl(readFirstEnv(envKeys), fallback);
}

export function getAppBaseUrl(appName) {
  if (!Object.prototype.hasOwnProperty.call(APP_SEGMENTS, appName)) {
    throw new Error(`App desconocida para runtimeConfig: ${appName}`);
  }

  if (isLocalRuntime() && typeof window !== 'undefined') {
    return `${window.location.origin}${APP_SEGMENTS[appName]}`.replace(/\/+$/, '');
  }

  return getRemoteBaseUrl(appName);
}

export function buildAppUrl(appName, relativePath = '') {
  const baseUrl = getAppBaseUrl(appName);
  const rawPath = String(relativePath || '').trim();
  if (!rawPath) return baseUrl;
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${baseUrl}${normalizedPath}`;
}

export const COMERCIO_LOGIN_BASE_URL = normalizeBaseUrl(
  readFirstEnv([
    'FINDIXI_COMERCIO_LOGIN_BASE_URL',
    'FINDIXI_COMERCIO_BASE_URL',
    'COMERCIO_LOGIN_BASE_URL',
    'COMERCIO_BASE_URL',
  ]),
  getAppBaseUrl('comercio')
);

export function getComercioLoginHostLabel() {
  if (isLocalRuntime() && typeof window !== 'undefined') {
    return `${window.location.host}/login.html`;
  }

  try {
    return new URL(COMERCIO_LOGIN_BASE_URL).host || 'comercio.findixi.com';
  } catch (_error) {
    return 'comercio.findixi.com';
  }
}

export const QR_REDIMIR_URL = buildAppUrl('public', '/redimir-cupon.html');
