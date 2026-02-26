// botonMenu.js
import { supabase } from '../shared/supabaseClient.js';
import { resolverPlanComercio } from '../shared/planes.js';

const idComercio = new URLSearchParams(window.location.search).get('id');

const btnVerMenu = document.getElementById('btnVerMenu');

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

  const planActual = await obtenerPlanComercio(idComercio);
  if (planActual && !planActual.permite_menu) {
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
  if (idParaMenu !== idComercio) {
    console.log('✅ Menú mostrado usando sucursal relacionada', idParaMenu);
  } else {
    console.log('✅ Menú encontrado para este comercio');
  }
}

await mostrarBotonMenu();
