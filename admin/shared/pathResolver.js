const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);
const ADMIN_SEGMENT = '/admin/';

function normalizePath(path) {
  if (typeof path !== 'string') return '';
  if (!path) return '';
  return path.startsWith('/') ? path.slice(1) : path;
}

function startsWithDot(path) {
  return path.startsWith('./') || path.startsWith('../');
}

function startsWithAdminFolder(path) {
  return path.startsWith('admin/');
}

function containsAdminSegment(path) {
  return path.includes(ADMIN_SEGMENT);
}

const ENVIRONMENT = (() => {
  if (typeof window === 'undefined') {
    return { isLocal: false, isInsideAdmin: false };
  }

  const { hostname, pathname } = window.location;
  const isLocal = LOCAL_HOSTNAMES.has(hostname);
  const isInsideAdmin = pathname.includes(ADMIN_SEGMENT);

  const label = isLocal ? 'local (Live Server)' : 'producción (Netlify)';
  console.info(`Rutas dinámicas activas — entorno detectado: ${label}`);

  return { isLocal, isInsideAdmin };
})();

export function resolvePath(relativePath) {
  const trimmed = typeof relativePath === 'string' ? relativePath.trim() : '';
  if (!trimmed) return '';

  const normalized = normalizePath(trimmed);
  const dotPrefixed = startsWithDot(trimmed);
  const adminPrefixed = startsWithAdminFolder(normalized);
  const hasAdminSegment = containsAdminSegment(trimmed);

  if (!ENVIRONMENT.isLocal) {
    return dotPrefixed ? trimmed : normalized;
  }

  if (dotPrefixed) {
    return trimmed;
  }

  if (adminPrefixed || hasAdminSegment) {
    return normalized;
  }

  if (ENVIRONMENT.isInsideAdmin) {
    return normalized;
  }

  return `admin/${normalized}`;
}

export function applyResolvedPaths(root = document) {
  const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
  const elements = scope.querySelectorAll('[data-resolve-path]');

  elements.forEach(element => {
    const target = element.getAttribute('data-resolve-path');
    if (!target) return;

    const resolved = resolvePath(target);

    if (element.tagName === 'A') {
      element.setAttribute('href', resolved);
    } else if (element.tagName === 'FORM') {
      element.setAttribute('action', resolved);
    } else if (element.dataset.resolveAssign === 'location') {
      element.addEventListener('click', () => {
        window.location.href = resolved;
      });
    }
  });
}

if (typeof window !== 'undefined') {
  window.resolveAdminPath = resolvePath;
}
