function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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

function aFormato12Horas(hora) {
  if (!hora && hora !== 0) return null;
  const [rawHora, rawMinuto] = String(hora).split(':');
  const h = parseInt(rawHora, 10);
  const m = parseInt(rawMinuto ?? '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const sufijo = h >= 12 ? 'PM' : 'AM';
  const hora12 = h % 12 || 12;
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

export function formatearMonedaUSD(valor, opciones = {}) {
  const num = toNumber(valor);
  if (!Number.isFinite(num)) return opciones.fallback ?? 'Gratis';
  if (num <= 0) return opciones.fallback ?? 'Gratis';
  const decimales = Number.isInteger(num) ? 0 : 2;
  return `$${num.toFixed(decimales)}`;
}
