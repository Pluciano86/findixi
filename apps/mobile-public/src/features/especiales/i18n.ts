type EspecialesI18nKey =
  | 'especiales.almuerzo'
  | 'especiales.happyHour'
  | 'especiales.paraHoy'
  | 'especiales.buscar'
  | 'especiales.municipios'
  | 'especiales.ordenarPor'
  | 'especiales.ordenCercania'
  | 'especiales.ordenAz'
  | 'especiales.ordenRecientes'
  | 'especiales.misFavoritos'
  | 'especiales.todosMunicipios'
  | 'especiales.cargando'
  | 'especiales.error'
  | 'especiales.reintentar'
  | 'especiales.emptyAlmuerzo'
  | 'especiales.emptyHappy'
  | 'especiales.comercio'
  | 'especiales.minVehiculo'
  | 'especiales.precioNoDisponible'
  | 'especiales.soloFavoritos'
  | 'especiales.sinUbicacion'
  | 'especiales.hoy';

type Dict = Record<EspecialesI18nKey, string>;

const ES: Dict = {
  'especiales.almuerzo': 'Almuerzo',
  'especiales.happyHour': 'Happy Hour',
  'especiales.paraHoy': 'para Hoy {dia}',
  'especiales.buscar': 'Buscar',
  'especiales.municipios': 'Municipios:',
  'especiales.ordenarPor': 'Ordenar por:',
  'especiales.ordenCercania': 'Cercanía',
  'especiales.ordenAz': 'Orden Alfabético',
  'especiales.ordenRecientes': 'Más Recientes',
  'especiales.misFavoritos': 'Mis Favoritos',
  'especiales.todosMunicipios': 'Municipios',
  'especiales.cargando': 'Cargando especiales...',
  'especiales.error': 'No pudimos cargar los especiales.',
  'especiales.reintentar': 'Reintentar',
  'especiales.emptyAlmuerzo': 'No hay Almuerzos disponibles para hoy en esta selección.',
  'especiales.emptyHappy': 'No hay Happy Hours disponibles para hoy en esta selección.',
  'especiales.comercio': 'Comercio',
  'especiales.minVehiculo': 'a unos {min} min en vehículo',
  'especiales.precioNoDisponible': 'Precio no disponible',
  'especiales.soloFavoritos': 'Solo favoritos',
  'especiales.sinUbicacion': 'Ubicación no disponible',
  'especiales.hoy': 'hoy',
};

const EN: Dict = {
  'especiales.almuerzo': 'Lunch',
  'especiales.happyHour': 'Happy Hour',
  'especiales.paraHoy': 'for {dia}',
  'especiales.buscar': 'Search',
  'especiales.municipios': 'Municipalities:',
  'especiales.ordenarPor': 'Sort by:',
  'especiales.ordenCercania': 'Nearest',
  'especiales.ordenAz': 'Alphabetical',
  'especiales.ordenRecientes': 'Most Recent',
  'especiales.misFavoritos': 'My Favorites',
  'especiales.todosMunicipios': 'Municipalities',
  'especiales.cargando': 'Loading specials...',
  'especiales.error': "We couldn't load the specials.",
  'especiales.reintentar': 'Retry',
  'especiales.emptyAlmuerzo': 'No lunch specials available today for this selection.',
  'especiales.emptyHappy': 'No happy hour specials available today for this selection.',
  'especiales.comercio': 'Business',
  'especiales.minVehiculo': 'about {min} min by car',
  'especiales.precioNoDisponible': 'Price not available',
  'especiales.soloFavoritos': 'Favorites only',
  'especiales.sinUbicacion': 'Location unavailable',
  'especiales.hoy': 'today',
};

const DICTS: Record<string, Dict> = {
  es: ES,
  en: EN,
  zh: EN,
  fr: EN,
  pt: EN,
  de: EN,
  it: EN,
  ko: EN,
  ja: EN,
};

function normalizeLang(lang: string): string {
  return String(lang || 'es').toLowerCase().split('-')[0];
}

function resolveLocale(lang: string): string {
  const code = normalizeLang(lang);
  const map: Record<string, string> = {
    es: 'es-PR',
    en: 'en-US',
    zh: 'zh-CN',
    fr: 'fr-FR',
    pt: 'pt-PT',
    de: 'de-DE',
    it: 'it-IT',
    ko: 'ko-KR',
    ja: 'ja-JP',
  };
  return map[code] || 'es-PR';
}

function capitalizeWord(value: string): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function tEspeciales(key: EspecialesI18nKey, lang: string, params?: Record<string, string | number>): string {
  const code = normalizeLang(lang);
  const template = DICTS[code]?.[key] || ES[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    return value == null ? '' : String(value);
  });
}

export function getEspecialesDayLabel(lang: string, date = new Date()): string {
  return capitalizeWord(
    date.toLocaleDateString(resolveLocale(lang), {
      weekday: 'long',
    })
  );
}
