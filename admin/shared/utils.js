export const SUPABASE_PUBLIC_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public';

export function getPublicBase(path = '') {
  const normalized = String(path || '').replace(/^\/+/, '');
  return normalized ? `${SUPABASE_PUBLIC_BASE}/${normalized}` : SUPABASE_PUBLIC_BASE;
}

export { calcularTiempoEnVehiculo, calcularDistanciaHaversineKm } from './pkg/utils/distance.js';
export {
  formatearHorario,
  normalizarTelefono,
  formatearTelefonoDisplay,
  formatearTelefonoHref,
  formatearMonedaUSD,
} from './pkg/utils/formatters.js';
