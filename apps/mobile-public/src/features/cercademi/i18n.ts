type CercaI18nKey =
  | 'cerca.title'
  | 'cerca.placeholder'
  | 'cerca.categoriasTodas'
  | 'cerca.filtros'
  | 'cerca.abierto'
  | 'cerca.activos'
  | 'cerca.favoritos'
  | 'cerca.ajusteRadio'
  | 'cerca.radio'
  | 'cerca.loading'
  | 'cerca.error'
  | 'cerca.sinUbicacion'
  | 'cerca.sinResultados'
  | 'cerca.reintentar'
  | 'cerca.centrarme'
  | 'cerca.recargar'
  | 'cerca.favoritosLoginTitulo'
  | 'cerca.favoritosLoginBody'
  | 'cerca.favoritosVacios'
  | 'cerca.municipio'
  | 'cerca.abiertoAhora'
  | 'cerca.cerradoAhora'
  | 'cerca.verPerfil'
  | 'cerca.llamar'
  | 'cerca.ir'
  | 'cerca.abrirGps'
  | 'cerca.rutaTitulo'
  | 'cerca.rutaBody'
  | 'cerca.rutaGoogle'
  | 'cerca.rutaWaze'
  | 'cerca.cancelar'
  | 'cerca.rutaErrorTitulo'
  | 'cerca.rutaErrorBody';

type Dict = Record<CercaI18nKey, string>;

const ES: Dict = {
  'cerca.title': 'COMERCIOS CERCA DE MI',
  'cerca.placeholder': 'Buscar comercios o descripciones',
  'cerca.categoriasTodas': 'Todas las categorías',
  'cerca.filtros': 'Filtros',
  'cerca.abierto': 'Abierto ahora',
  'cerca.activos': 'Activos',
  'cerca.favoritos': 'Mis Favoritos',
  'cerca.ajusteRadio': 'Ajusta el radio para ampliar o reducir el perímetro de búsqueda.',
  'cerca.radio': 'Radio (mi):',
  'cerca.loading': 'Cargando comercios cercanos...',
  'cerca.error': 'No se pudieron cargar los comercios cercanos.',
  'cerca.sinUbicacion': 'No pudimos obtener tu ubicación.',
  'cerca.sinResultados': 'No hay comercios dentro del radio seleccionado.',
  'cerca.reintentar': 'Reintentar',
  'cerca.centrarme': 'Centrarme',
  'cerca.recargar': 'Recargar',
  'cerca.favoritosLoginTitulo': 'Inicia sesión',
  'cerca.favoritosLoginBody': 'Para usar Mis Favoritos debes iniciar sesión.',
  'cerca.favoritosVacios': 'No tienes comercios favoritos guardados.',
  'cerca.municipio': 'Municipio',
  'cerca.abiertoAhora': 'Abierto Ahora',
  'cerca.cerradoAhora': 'Cerrado Ahora',
  'cerca.verPerfil': 'Ver perfil',
  'cerca.llamar': 'Llamar',
  'cerca.ir': 'Ir',
  'cerca.abrirGps': 'Abrir GPS',
  'cerca.rutaTitulo': 'Elegir navegación',
  'cerca.rutaBody': '¿Con qué app deseas abrir la ruta?',
  'cerca.rutaGoogle': 'Google Maps',
  'cerca.rutaWaze': 'Waze',
  'cerca.cancelar': 'Cancelar',
  'cerca.rutaErrorTitulo': 'No se pudo abrir la navegación',
  'cerca.rutaErrorBody': 'Intenta nuevamente en unos segundos.',
};

const EN: Dict = {
  'cerca.title': 'BUSINESSES NEAR ME',
  'cerca.placeholder': 'Search businesses or descriptions',
  'cerca.categoriasTodas': 'All categories',
  'cerca.filtros': 'Filters',
  'cerca.abierto': 'Open now',
  'cerca.activos': 'Active',
  'cerca.favoritos': 'My Favorites',
  'cerca.ajusteRadio': 'Adjust the radius to expand or reduce the search area.',
  'cerca.radio': 'Radius (mi):',
  'cerca.loading': 'Loading nearby businesses...',
  'cerca.error': "Couldn't load nearby businesses.",
  'cerca.sinUbicacion': "We couldn't get your location.",
  'cerca.sinResultados': 'No businesses found within the selected radius.',
  'cerca.reintentar': 'Retry',
  'cerca.centrarme': 'Center me',
  'cerca.recargar': 'Reload',
  'cerca.favoritosLoginTitulo': 'Sign in',
  'cerca.favoritosLoginBody': 'You must sign in to use My Favorites.',
  'cerca.favoritosVacios': "You don't have favorite businesses yet.",
  'cerca.municipio': 'Municipality',
  'cerca.abiertoAhora': 'Open Now',
  'cerca.cerradoAhora': 'Closed Now',
  'cerca.verPerfil': 'View profile',
  'cerca.llamar': 'Call',
  'cerca.ir': 'Go',
  'cerca.abrirGps': 'Open GPS',
  'cerca.rutaTitulo': 'Choose navigation',
  'cerca.rutaBody': 'Which app do you want to use for directions?',
  'cerca.rutaGoogle': 'Google Maps',
  'cerca.rutaWaze': 'Waze',
  'cerca.cancelar': 'Cancel',
  'cerca.rutaErrorTitulo': "Couldn't open navigation",
  'cerca.rutaErrorBody': 'Please try again in a few seconds.',
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

export function tCerca(key: CercaI18nKey, lang: string): string {
  const code = normalizeLang(lang);
  return DICTS[code]?.[key] || ES[key] || key;
}
