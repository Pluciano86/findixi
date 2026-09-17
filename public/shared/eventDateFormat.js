import { t, getLang } from '../js/i18n.js';
function capitalizarPalabra(texto = '') {
  if (!texto) return '';
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function estilizarFechaExtendida(fechaLocale = '') {
  if (!fechaLocale) return '';
  const [primeraParte, ...resto] = fechaLocale.split(', ');
  const primera = capitalizarPalabra(primeraParte);
  let restoTexto = resto.join(', ');

  if (restoTexto) {
    restoTexto = restoTexto.replace(/ de ([a-záéíóúñ]+)/gi, (_, palabra) => ` de ${capitalizarPalabra(palabra)}`);
    restoTexto = restoTexto.replace(/\sde\s(\d{4})$/i, ' $1');
  }

  return restoTexto ? `${primera}, ${restoTexto}` : primera;
}

function resolveLocale(langValue) {
  const lang = (langValue || 'es').toLowerCase().split('-')[0];
  const map = {
    es: 'es-PR',
    en: 'en-US',
    fr: 'fr-FR',
    pt: 'pt-PT',
    de: 'de-DE',
    it: 'it-IT',
    zh: 'zh-CN',
    ko: 'ko-KR',
    ja: 'ja-JP'
  };
  return map[lang] || 'es-PR';
}

export function formatearFecha(fechaStr) {
  if (!fechaStr) return t('evento.sinFecha');
  const [year, month, day] = fechaStr.split('-').map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) return t('evento.sinFecha');
  const fecha = new Date(Date.UTC(year, month - 1, day));
  const base = fecha.toLocaleDateString(resolveLocale(getLang()), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
  return estilizarFechaExtendida(base);
}

export function formatearHora(horaStr) {
  if (!horaStr) return '';
  const [hourPart, minutePart] = horaStr.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return '';
  const fecha = new Date(Date.UTC(1970, 0, 1, hour, minute));
  const base = fecha.toLocaleTimeString(resolveLocale(getLang()), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });
  return base.toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
}

