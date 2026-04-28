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

const PERFIL_TIPO_VALIDOS = new Set(['menu', 'servicios', 'tienda']);
const CAMPOS_TIPO_PERFIL = ['tipo_perfil', 'tipoPerfil', 'perfil_tipo', 'perfilTipo', 'perfil'];
const CAMPOS_CATEGORIA = ['categoria', 'categorias', 'subCategorias', 'subcategoria', 'nombreCategoria', 'nombreSubcategoria'];
const CAMPOS_MODALIDAD_TIENDA = [
  ['tiendaFisica', 'tiendaOnline'],
  ['tienda_fisica', 'tienda_online'],
];

const KEYWORDS_SERVICIOS = [
  'servicio',
  'servicios',
  'barber',
  'barberia',
  'salon',
  'belleza',
  'estetica',
  'spa',
  'masaje',
  'manicure',
  'pedicure',
  'pestanas',
  'cejas',
  'nails',
  'unas',
  'tattoo',
  'piercing',
  'clinica',
  'medico',
  'dental',
  'abogado',
  'legal',
  'consultoria',
  'coach',
  'gimnasio',
  'fitness',
  'entrenador',
  'fotografia',
  'evento',
  'eventos',
  'taller',
  'mecanica',
  'lavanderia',
  'reparacion',
];

const KEYWORDS_TIENDA = [
  'tienda',
  'store',
  'retail',
  'boutique',
  'ecommerce',
  'e-commerce',
  'shop',
  'supermercado',
  'colmado',
  'farmacia',
  'ferreteria',
  'libreria',
  'zapateria',
  'ropa',
  'moda',
  'joyeria',
  'electronica',
  'hogar',
  'muebleria',
  'jugueteria',
];

const KEYWORDS_MENU = [
  'menu',
  'restaurante',
  'restaurant',
  'comida',
  'cafe',
  'cafeteria',
  'food',
  'bebida',
  'bar',
  'panaderia',
  'pizza',
  'burger',
  'taco',
  'sushi',
];

function normalizarTexto(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function leerBooleanoComercio(comercio = {}, key) {
  if (!comercio || typeof comercio !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(comercio, key)) return null;
  return comercio[key] === true;
}

function splitCategoriaTokens(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => splitCategoriaTokens(item));

  if (typeof value === 'object') {
    if (value.id != null) return [String(value.id)];
    if (value.nombre != null) return [String(value.nombre)];
    return [];
  }

  const raw = String(value).trim();
  if (!raw) return [];
  return raw
    .split(/[|,;/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extraerTextosCategoria(comercio = {}) {
  const out = [];
  CAMPOS_CATEGORIA.forEach((campo) => {
    out.push(...splitCategoriaTokens(comercio?.[campo]));
  });
  return Array.from(new Set(out.map((item) => item.trim()).filter(Boolean)));
}

function inferirPerfilPorTexto(textoNormalizado = '') {
  if (!textoNormalizado) return null;
  if (KEYWORDS_SERVICIOS.some((term) => textoNormalizado.includes(term))) return 'servicios';
  if (KEYWORDS_TIENDA.some((term) => textoNormalizado.includes(term))) return 'tienda';
  if (KEYWORDS_MENU.some((term) => textoNormalizado.includes(term))) return 'menu';
  return null;
}

function pickTipoPerfil(valores = []) {
  const normalized = valores.map((item) => normalizarTexto(item)).filter((item) => PERFIL_TIPO_VALIDOS.has(item));
  if (!normalized.length) return null;
  if (normalized.includes('servicios')) return 'servicios';
  if (normalized.includes('tienda')) return 'tienda';
  return 'menu';
}

export function resolverPerfilComercio(comercio = {}, options = {}) {
  const tipoDesdeCategorias = pickTipoPerfil(Array.isArray(options?.categoryProfileTypes) ? options.categoryProfileTypes : []);
  if (tipoDesdeCategorias) return tipoDesdeCategorias;

  const tipoExpl = pickTipoPerfil(CAMPOS_TIPO_PERFIL.map((campo) => comercio?.[campo]));
  if (tipoExpl) return tipoExpl;

  const categoriaTextos = extraerTextosCategoria(comercio);
  const textoUnificado = normalizarTexto(categoriaTextos.join(' '));
  const inferido = inferirPerfilPorTexto(textoUnificado);
  if (inferido) return inferido;

  for (const [fisicaKey, onlineKey] of CAMPOS_MODALIDAD_TIENDA) {
    const tiendaFisica = leerBooleanoComercio(comercio, fisicaKey);
    const tiendaOnline = leerBooleanoComercio(comercio, onlineKey);
    if (tiendaOnline === true && tiendaFisica === false) return 'tienda';
  }

  return 'menu';
}

export function resolverCtaPrincipalComercio(comercio = {}, options = {}) {
  const idComercioRaw = options?.idComercio ?? comercio?.id ?? comercio?.idComercio ?? comercio?.idcomercio;
  const idComercio = Number(idComercioRaw);
  const suffix = Number.isFinite(idComercio) && idComercio > 0 ? `?id=${idComercio}` : '';
  const profileType = resolverPerfilComercio(comercio, options);

  if (profileType === 'servicios') {
    return {
      profileType,
      label: 'Servicios',
      href: `./staffServicios.html${suffix}`,
    };
  }

  if (profileType === 'tienda') {
    return {
      profileType,
      label: 'Tienda',
      href: `./editarPerfilComercio.html${suffix}`,
    };
  }

  return {
    profileType: 'menu',
    label: 'Menu',
    href: `./adminMenuComercio.html${suffix}`,
  };
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

export {
  pickRandomItems,
  shuffleArray,
  getNearestUpcomingISODate,
  getLatestISODate,
  compareByNearestUpcomingDate,
} from '../packages/shared/src/utils/collections.js';
