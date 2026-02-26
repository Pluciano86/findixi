export const SUPABASE_PUBLIC_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public';

const STORAGE_BUCKET = 'galeriacomercios';

export function buildStorageUrl(pathRelativo) {
  if (!pathRelativo) return null;

  const limpio = String(pathRelativo).trim().replace(/^public\//i, '');
  const segmentos = limpio.split('/').filter(Boolean);

  if (segmentos[0] && segmentos[0].toLowerCase() === STORAGE_BUCKET) {
    segmentos[0] = STORAGE_BUCKET;
  }

  const pathNormalizado = segmentos
    .map((segmento, idx) => (idx === 0 ? segmento : encodeURIComponent(segmento)))
    .join('/');

  return `${SUPABASE_PUBLIC_BASE}/${pathNormalizado}`;
}

export function getPublicBase(path = '') {
  const normalized = String(path || '').replace(/^\/+/, '');
  return normalized ? `${SUPABASE_PUBLIC_BASE}/${normalized}` : SUPABASE_PUBLIC_BASE;
}

export {
  calcularTiempoEnVehiculo,
  calcularDistanciaHaversineKm,
} from '../packages/shared/src/utils/distance.js';

export {
  formatearHorario,
  normalizarTelefono,
  formatearTelefonoDisplay,
  formatearTelefonoHref,
  formatearMonedaUSD,
} from '../packages/shared/src/utils/formatters.js';
