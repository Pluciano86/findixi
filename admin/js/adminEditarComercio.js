// adminEditarComercio.js
import { supabase, idComercio } from '../shared/supabaseClient.js';
import { guardarLogoSiAplica, duplicarLogoDesdePrincipal } from './adminLogoComercio.js';
import {
  cargarGaleriaComercio,
  activarBotonesGaleria,
  mostrarPortadaEnPreview,
  duplicarGaleriaDesdePrincipal
} from './adminGaleriaComercio.js';
import { cargarHorariosComercio } from './adminHorarioComercio.js';
import { cargarFeriadosComercio } from './adminFeriadosComercio.js';
import { cargarAmenidadesComercio } from './adminAmenidadesComercio.js';
import { cargarCategoriasYSubcategorias } from './adminCategoriasComercio.js';
import { cargarSucursalesRelacionadas } from './adminSucursalesComercio.js';
import {
  PLANES_PRELIMINARES,
  formatoPrecio,
  resolverPlanComercio,
  buildComercioPlanPayload,
} from '../shared/planes.js';

console.log('adminEditarComercio loaded', { supabase });

async function cargarMunicipiosSelect(idSeleccionado = null) {
  const selectMunicipio = document.getElementById('municipio');
  if (!selectMunicipio) return;
  if (!supabase) {
    console.error('Supabase no disponible para cargar municipios');
    return;
  }
  try {
    const { data, error } = await supabase
      .from('Municipios')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    if (error) throw error;
    selectMunicipio.innerHTML = '<option value=\"\">Selecciona un municipio</option>';
    (data || []).forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nombre || '';
      selectMunicipio.appendChild(opt);
    });
    if (idSeleccionado) {
      selectMunicipio.value = String(idSeleccionado);
    }
  } catch (err) {
    console.error('Error cargando municipios:', err);
  }
}

let categoriaFallbackActual = '';
let subcategoriaFallbackActual = '';

function toNonEmptyString(value) {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizarIds(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id));
}

async function sincronizarRelacionesComercio(id, categoriasIds, subcategoriasIds) {
  const categoriaIds = normalizarIds(categoriasIds);
  const subcategoriaIds = normalizarIds(subcategoriasIds);

  const [eliminarCategorias, eliminarSubcategorias] = await Promise.all([
    supabase.from('ComercioCategorias').delete().eq('idComercio', id),
    supabase.from('ComercioSubcategorias').delete().eq('idComercio', id),
  ]);

  if (eliminarCategorias.error) throw eliminarCategorias.error;
  if (eliminarSubcategorias.error) throw eliminarSubcategorias.error;

  if (categoriaIds.length) {
    const { error } = await supabase.from('ComercioCategorias').insert(
      categoriaIds.map((categoriaId) => ({
        idComercio: id,
        idCategoria: categoriaId,
      }))
    );
    if (error) throw error;
  }

  if (subcategoriaIds.length) {
    const { error } = await supabase.from('ComercioSubcategorias').insert(
      subcategoriaIds.map((subcategoriaId) => ({
        idComercio: id,
        idSubcategoria: subcategoriaId,
      }))
    );
    if (error) throw error;
  }

  return { categoriaIds, subcategoriaIds };
}

// --- Plan admin (cambiar plan desde admin) ---
const planActualEl = document.getElementById('planActualAdmin');
const selectPlanEl = document.getElementById('selectPlanAdmin');
const planPreviewEl = document.getElementById('planPreviewAdmin');
const btnActualizarPlanEl = document.getElementById('btnActualizarPlanAdmin');

let planesCatalogo = null;
let planMap = new Map();
let comercioPlanCache = null;
let planAdminReady = false;

function buildPlanKey(plan) {
  if (!plan) return '';
  if (plan.id !== undefined && plan.id !== null && plan.id !== '') return `id:${plan.id}`;
  if (plan.slug) return `slug:${plan.slug}`;
  if (plan.nivel !== undefined && plan.nivel !== null) return `nivel:${plan.nivel}`;
  if (plan.plan_nivel !== undefined && plan.plan_nivel !== null) return `nivel:${plan.plan_nivel}`;
  if (plan.nombre) return `nombre:${plan.nombre}`;
  return 'nivel:0';
}

async function cargarPlanesAdmin() {
  try {
    const { data, error } = await supabase
      .from('planes')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });
    if (error) throw error;
    if (Array.isArray(data) && data.length) return data;
  } catch (error) {
    console.warn('No se pudieron cargar planes desde Supabase:', error?.message || error);
  }
  return PLANES_PRELIMINARES;
}

function renderPlanActual(planInfo) {
  if (!planActualEl) return;
  const nombre = toNonEmptyString(planInfo?.nombre) || 'Sin plan';
  const nivel = Number(planInfo?.nivel ?? 0);
  planActualEl.textContent = `Plan actual: ${nombre} (Nivel ${nivel})`;
}

function encontrarPlanKeyActual(planes, planInfo) {
  if (!planInfo || !Array.isArray(planes)) return null;
  if (planInfo.plan_id !== null && planInfo.plan_id !== undefined) {
    const match = planes.find((p) => String(p.id) === String(planInfo.plan_id));
    if (match) return buildPlanKey(match);
  }
  const matchNivel = planes.find(
    (p) => Number(p.nivel ?? p.plan_nivel) === Number(planInfo.nivel)
  );
  if (matchNivel) return buildPlanKey(matchNivel);
  if (planInfo.slug) {
    const matchSlug = planes.find(
      (p) => toNonEmptyString(p.slug).toLowerCase() === toNonEmptyString(planInfo.slug).toLowerCase()
    );
    if (matchSlug) return buildPlanKey(matchSlug);
  }
  if (planInfo.nombre) {
    const matchNombre = planes.find(
      (p) => toNonEmptyString(p.nombre).toLowerCase() === toNonEmptyString(planInfo.nombre).toLowerCase()
    );
    if (matchNombre) return buildPlanKey(matchNombre);
  }
  return null;
}

function actualizarPreviewPlan() {
  if (!planPreviewEl || !selectPlanEl) return;
  const opt = selectPlanEl.options[selectPlanEl.selectedIndex];
  if (!opt) {
    planPreviewEl.textContent = '';
    return;
  }
  const nombre = toNonEmptyString(opt.dataset.nombre) || 'Plan';
  const nivel = toNonEmptyString(opt.dataset.nivel) || '0';
  const precio = formatoPrecio(opt.dataset.precio);
  planPreviewEl.textContent = `${nombre} — Nivel ${nivel}${precio ? ` · ${precio}` : ''}`;
}

function construirSelectPlan(planes, planInfo) {
  if (!selectPlanEl) return;
  selectPlanEl.innerHTML = '';
  planMap = new Map();

  (planes || []).forEach((plan) => {
    const key = buildPlanKey(plan);
    const nivel = Number(plan.nivel ?? plan.plan_nivel ?? 0);
    const nombre = toNonEmptyString(plan.nombre) || toNonEmptyString(plan.plan_nombre) || 'Plan';
    const precio = plan.precio ?? plan.plan_precio ?? '';

    planMap.set(key, plan);
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${nombre} — Nivel ${nivel} (${formatoPrecio(precio)})`;
    opt.dataset.nivel = String(nivel);
    opt.dataset.nombre = nombre;
    opt.dataset.precio = String(precio ?? '');
    opt.dataset.planId = plan.id ?? '';
    opt.dataset.slug = plan.slug ?? '';
    selectPlanEl.appendChild(opt);
  });

  const selectedKey = encontrarPlanKeyActual(planes, planInfo);
  if (selectedKey) {
    const optionMatch = Array.from(selectPlanEl.options).find((o) => o.value === selectedKey);
    if (optionMatch) selectPlanEl.value = selectedKey;
  }
  actualizarPreviewPlan();
}

function obtenerPlanSeleccionado() {
  if (!selectPlanEl) return null;
  const opt = selectPlanEl.options[selectPlanEl.selectedIndex];
  if (!opt) return null;
  const plan = planMap.get(selectPlanEl.value);
  if (plan) return plan;

  return {
    id: opt.dataset.planId ? Number(opt.dataset.planId) : null,
    nombre: opt.dataset.nombre,
    slug: opt.dataset.slug,
    nivel: toNumber(opt.dataset.nivel) ?? 0,
    precio: toNumber(opt.dataset.precio),
  };
}

async function actualizarPlanAdmin() {
  if (!idComercio) return;
  const plan = obtenerPlanSeleccionado();
  if (!plan) {
    alert('Selecciona un plan válido.');
    return;
  }
  const nombrePlan = toNonEmptyString(plan.nombre) || toNonEmptyString(plan.slug) || 'seleccionado';
  const confirmar = confirm(`¿Cambiar plan a ${nombrePlan}?`);
  if (!confirmar) return;

  const payload = buildComercioPlanPayload(plan);
  try {
    const { error } = await supabase.rpc('fn_admin_actualizar_plan_comercio', {
      p_id_comercio: Number(idComercio),
      p_plan_id: payload.plan_id ?? null,
      p_plan_nivel: Number(payload.plan_nivel ?? 0),
      p_plan_nombre: payload.plan_nombre ?? null,
    });
    if (error) throw error;
    comercioPlanCache = { ...(comercioPlanCache || {}), ...payload };
    const planInfo = resolverPlanComercio(comercioPlanCache);
    renderPlanActual(planInfo);
    actualizarPreviewPlan();
    alert('Plan actualizado.');
  } catch (err) {
    console.error('Error actualizando plan:', err);
    const missingRpc =
      String(err?.code || '') === '42883' ||
      String(err?.message || '').toLowerCase().includes('fn_admin_actualizar_plan_comercio');
    alert(
      missingRpc
        ? 'No se pudo actualizar: falta aplicar la migracion f33 (fn_admin_actualizar_plan_comercio).'
        : 'No se pudo actualizar el plan.'
    );
  }
}

async function iniciarPlanAdmin(comercio) {
  if (!selectPlanEl || !btnActualizarPlanEl || !planActualEl) return;
  comercioPlanCache = comercio || null;
  const planInfo = resolverPlanComercio(comercio || {});
  renderPlanActual(planInfo);

  if (!planesCatalogo) {
    planesCatalogo = await cargarPlanesAdmin();
  }
  construirSelectPlan(planesCatalogo, planInfo);

  if (!planAdminReady) {
    selectPlanEl.addEventListener('change', actualizarPreviewPlan);
    btnActualizarPlanEl.addEventListener('click', actualizarPlanAdmin);
    planAdminReady = true;
  }
}

// 🚀 Flujo de carga con logs paso a paso
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!supabase) {
      console.error('Supabase no disponible en adminEditarComercio');
      alert('No se pudo inicializar Supabase. Revisa la carga de shared/supabaseClient.js');
      return;
    }
    await cargarMunicipiosSelect();
    await cargarGaleriaComercio();
    await mostrarPortadaEnPreview();
    if (typeof activarBotonesGaleria === 'function') {
  activarBotonesGaleria();
} else {
}

    await cargarHorariosComercio();
    await cargarFeriadosComercio();
    await cargarAmenidadesComercio();
    await cargarCategoriasYSubcategorias();
    await cargarDatosGenerales();
    await cargarSucursalesRelacionadas();
    await verificarSiEsSucursal();
  } catch (err) {
  }
});

// ✅ Mostrar botones solo si el comercio es sucursal
async function verificarSiEsSucursal() {
  try {
    const { data: relacion, error } = await supabase
      .from('ComercioSucursales')
      .select('comercio_id')
      .eq('sucursal_id', idComercio)
      .maybeSingle();

    if (error) throw error;

    if (relacion?.comercio_id) {
      const principalId = relacion.comercio_id;
      const btnLogo = document.getElementById('btnDuplicarLogo');
      const btnGaleria = document.getElementById('btnDuplicarGaleria');

      btnLogo?.classList.remove('hidden');
      btnGaleria?.classList.remove('hidden');

      btnLogo?.addEventListener('click', () =>
        duplicarLogoDesdePrincipal(idComercio, principalId)
      );

      btnGaleria?.addEventListener('click', () =>
        duplicarGaleriaDesdePrincipal(idComercio, principalId)
      );
    } else {
    }
  } catch (err) {
  }
}

// 🧾 Cargar datos generales con logs detallados
async function cargarDatosGenerales() {

  const { data: comercio, error: errorComercio } = await supabase
    .from('Comercios')
    .select(
      'id, nombre, telefono, direccion, latitud, longitud, idMunicipio, municipio, idArea, area, whatsapp, facebook, instagram, tiktok, webpage, descripcion, colorPrimario, colorSecundario, categoria, subCategorias, plan_id, plan_nivel, plan_nombre, plan_status, permite_perfil, aparece_en_cercanos, permite_menu, permite_especiales, permite_ordenes, estado_propiedad, estado_verificacion, propietario_verificado'
    )
    .eq('id', idComercio)
    .maybeSingle();

  if (errorComercio) console.error('❌ Error cargando comercio:', errorComercio);

  if (!comercio) {

    return;
  }

  // 🧩 Log campo por campo
  const camposTexto = [
    'nombre',
    'telefono',
    'direccion',
    'latitud',
    'longitud',
    'whatsapp',
    'facebook',
    'instagram',
    'tiktok',
    'webpage',
    'descripcion',
    'colorPrimario',
    'colorSecundario',
  ];

  // Rellenar inputs
  camposTexto.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = comercio[id] || '';
    }
  });

  await cargarMunicipiosSelect(comercio.idMunicipio);
  await iniciarPlanAdmin(comercio);
}
