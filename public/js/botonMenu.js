// botonMenu.js
import { supabase } from '../shared/supabaseClient.js';
import { resolverPlanComercio } from '../shared/planes.js';

const idComercio = new URLSearchParams(window.location.search).get('id');
const btnVerMenu = document.getElementById('btnVerMenu');

const SERVICIOS_LABELS = {
  es: 'Ver Nuestros Servicios',
  en: 'View Our Services',
  zh: '查看我们的服务',
  fr: 'Voir nos services',
  pt: 'Ver nossos serviços',
  de: 'Unsere Services ansehen',
  it: 'Vedi i nostri servizi',
  ko: '우리 서비스 보기',
  ja: 'サービスを見る',
};

const TIENDA_LABELS = {
  es: 'Ver Tienda',
  en: 'View Store',
  zh: '查看商店',
  fr: 'Voir la boutique',
  pt: 'Ver loja',
  de: 'Shop ansehen',
  it: 'Vedi negozio',
  ko: '스토어 보기',
  ja: 'ストアを見る',
};

const CATEGORIAS_SERVICIOS_FALLBACK = new Set([
  'salon de belleza',
  'tecnicas de unas',
  'barberias',
  'esteticas',
  'spa',
]);

function normalizeLang(lang) {
  return String(lang || 'es').toLowerCase().split('-')[0];
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getLabelByPerfil(tipoPerfil) {
  const lang = normalizeLang(document.documentElement.lang || localStorage.getItem('lang') || 'es');
  if (tipoPerfil === 'tienda') return TIENDA_LABELS[lang] || TIENDA_LABELS.es;
  if (tipoPerfil === 'servicios') return SERVICIOS_LABELS[lang] || SERVICIOS_LABELS.es;
  return null;
}

function aplicarTextoPerfilSiCorresponde(tipoPerfil) {
  if (!btnVerMenu || !tipoPerfil || tipoPerfil === 'menu') return;
  btnVerMenu.dataset.i18n = tipoPerfil === 'tienda'
    ? 'perfilComercio.verTienda'
    : 'perfilComercio.verServicios';
  btnVerMenu.textContent = getLabelByPerfil(tipoPerfil) || btnVerMenu.textContent;

  window.addEventListener('lang:changed', () => {
    btnVerMenu.textContent = getLabelByPerfil(tipoPerfil) || btnVerMenu.textContent;
  });
}

async function obtenerCategoriasComercio(idComercioParam) {
  const idComercioNum = Number(idComercioParam);
  if (!Number.isFinite(idComercioNum) || idComercioNum <= 0) return [];

  const { data: relaciones, error: relError } = await supabase
    .from('ComercioCategorias')
    .select('idCategoria')
    .eq('idComercio', idComercioNum);

  if (relError) {
    console.warn('No se pudieron cargar categorías del comercio:', relError?.message || relError);
    return [];
  }

  const ids = Array.from(
    new Set(
      (relaciones || [])
        .map((row) => Number(row?.idCategoria))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );

  if (!ids.length) return [];

  let query = supabase.from('Categorias').select('id, nombre, tipo_perfil').in('id', ids);
  let { data, error } = await query;

  if (error && /tipo_perfil/i.test(String(error.message || error.details || ''))) {
    const fallbackResult = await supabase.from('Categorias').select('id, nombre').in('id', ids);
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    console.warn('No se pudieron cargar detalles de categorías:', error?.message || error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function resolveTipoPerfilComercio(categorias = []) {
  let hasServicios = false;

  for (const categoria of categorias) {
    const tipoPerfil = normalizeText(categoria?.tipo_perfil);
    if (tipoPerfil === 'tienda') return 'tienda';
    if (tipoPerfil === 'servicios') hasServicios = true;

    const nombre = normalizeText(categoria?.nombre);
    if (CATEGORIAS_SERVICIOS_FALLBACK.has(nombre)) hasServicios = true;
  }

  return hasServicios ? 'servicios' : 'menu';
}

async function tieneMenuActivo(id) {
  const { data, error } = await supabase
    .from('menus')
    .select('id')
    .eq('idComercio', id)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('No se pudo verificar menú:', error?.message || error);
    return false;
  }
  return !!data;
}

async function obtenerPlanComercio(id) {
  const { data, error } = await supabase
    .from('Comercios')
    .select(
      'plan_id, plan_nivel, plan_nombre, permite_menu, estado_propiedad, estado_verificacion, propietario_verificado'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.warn('No se pudo cargar plan del comercio:', error?.message || error);
    return null;
  }
  return resolverPlanComercio(data || {});
}

async function obtenerRelacionadoConMenus(idActual) {
  const { data, error } = await supabase
    .from('ComercioSucursales')
    .select('comercio_id, sucursal_id')
    .or(`comercio_id.eq.${idActual},sucursal_id.eq.${idActual}`);

  if (error) {
    console.warn('No se pudieron cargar sucursales relacionadas:', error?.message || error);
    return null;
  }
  if (!data || data.length === 0) return null;

  // Tomar cualquier otro id relacionado y verificar menú activo
  for (const rel of data) {
    const candidato = rel.comercio_id === Number(idActual) ? rel.sucursal_id : rel.comercio_id;
    if (candidato && await tieneMenuActivo(candidato)) {
      return candidato;
    }
  }
  return null;
}

async function mostrarBotonMenu() {
  if (!btnVerMenu || !idComercio) return;

  const categoriasComercio = await obtenerCategoriasComercio(idComercio);
  const tipoPerfil = resolveTipoPerfilComercio(categoriasComercio);
  aplicarTextoPerfilSiCorresponde(tipoPerfil);

  const planActual = await obtenerPlanComercio(idComercio);
  if (planActual && !planActual.permite_menu) {
    return;
  }

  if (tipoPerfil === 'tienda') {
    let idDestinoTienda = idComercio;
    const tieneMenuPropio = await tieneMenuActivo(idComercio);
    if (!tieneMenuPropio) {
      const relacionadoConMenu = await obtenerRelacionadoConMenus(idComercio);
      if (relacionadoConMenu) idDestinoTienda = relacionadoConMenu;
    }

    btnVerMenu.href = `tienda/tiendaComercio.html?idComercio=${idDestinoTienda}&source=app`;
    btnVerMenu.style.display = 'inline-block';
    btnVerMenu.classList.remove('hidden');
    btnVerMenu.classList.add(
      'inline-block',
      'mt-4',
      'bg-orange-400',
      'hover:bg-orange-600',
      'text-white',
      'font-normal',
      'py-2',
      'px-10',
      'rounded-full',
      'shadow-lg'
    );
    return;
  }

  let idParaMenu = idComercio;
  const tieneMenuPropio = await tieneMenuActivo(idComercio);
  if (!tieneMenuPropio) {
    const relacionadoConMenu = await obtenerRelacionadoConMenus(idComercio);
    if (relacionadoConMenu) {
      idParaMenu = relacionadoConMenu;
    } else {
      return; // no hay menú ni en sucursales relacionadas
    }
  }

  const planMenu = idParaMenu !== idComercio ? await obtenerPlanComercio(idParaMenu) : planActual;
  if (planMenu && !planMenu.permite_menu) {
    return;
  }

  btnVerMenu.href = `menu/menuComercio.html?idComercio=${idParaMenu}&modo=pickup&source=app`;
  btnVerMenu.style.display = 'inline-block';
  btnVerMenu.classList.remove('hidden');
  btnVerMenu.classList.add(
    'inline-block',
    'mt-4',
    'bg-orange-400',
    'hover:bg-orange-600',
    'text-white',
    'font-normal',
    'py-2',
    'px-10',
    'rounded-full',
    'shadow-lg'
  );
}

await mostrarBotonMenu();
