export const SUPABASE_PUBLIC_BASE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public';

export function getPublicBase(path = '') {
  const normalized = String(path || '').replace(/^\/+/, '');
  return normalized ? `${SUPABASE_PUBLIC_BASE}/${normalized}` : SUPABASE_PUBLIC_BASE;
}

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

function aFormato12Horas(hora) {
  if (!hora && hora !== 0) return null;
  const [rawHora, rawMinuto] = String(hora).split(':');
  const h = parseInt(rawHora, 10);
  const m = parseInt(rawMinuto ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const sufijo = h >= 12 ? 'PM' : 'AM';
  const hora12 = (h % 12) || 12;
  return `${hora12}:${m.toString().padStart(2, '0')} ${sufijo}`;
}

export function formatearHorario(apertura, cierre, cerrado) {
  if (cerrado) return 'Cerrado';

  if (apertura && cierre) {
    const desde = aFormato12Horas(String(apertura).slice(0, 5));
    const hasta = aFormato12Horas(String(cierre).slice(0, 5));
    if (desde && hasta) {
      return `${desde} - ${hasta}`;
    }
  }

  return 'Horario no disponible';
}

export function normalizarTelefono(telefono = '') {
  const digits = String(telefono || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

export function formatearTelefonoDisplay(telefono = '') {
  const digits = normalizarTelefono(telefono);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(telefono || '').trim();
}

export function formatearTelefonoHref(telefono = '') {
  const rawDigits = String(telefono || '').replace(/\D/g, '');
  if (!rawDigits) return '';
  if (rawDigits.length === 10) return `tel:${rawDigits}`;
  if (rawDigits.length === 11 && rawDigits.startsWith('1')) return `tel:+${rawDigits}`;
  return `tel:${rawDigits}`;
}
