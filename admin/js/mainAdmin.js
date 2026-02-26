import { getPublicBase } from '../shared/utils.js';
import { resolvePath } from '../shared/pathResolver.js';
import { supabase } from '../shared/supabaseClient.js';
import {
  PLANES_PRELIMINARES,
  formatoPrecio,
  resolverPlanComercio,
  buildComercioPlanPayload,
} from '../shared/planes.js';

const baseImageUrl = getPublicBase('galeriacomercios');
const UNKNOWN_CATEGORY_LABEL = 'Sin categoría';
const COMERCIOS_PAGE_SIZE = 1000;

let todosLosComercios = [];
let logos = [];
let categorias = [];
let municipios = [];
let soloActivos = true;
let categoriasCache = null;
let categoriasPromise = null;
let subcategoriasCache = null;
let subcategoriasPromise = null;
let planesCatalogo = null;
let planesOptions = [];
let planesMap = new Map();

export const idComercio = new URLSearchParams(window.location.search).get('id');

function toNonEmptyString(value) {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseDelimitedList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function buildPlanKey(plan) {
  if (!plan) return '';
  if (plan.id !== undefined && plan.id !== null && plan.id !== '') return `id:${plan.id}`;
  if (plan.slug) return `slug:${plan.slug}`;
  if (plan.nivel !== undefined && plan.nivel !== null) return `nivel:${plan.nivel}`;
  if (plan.plan_nivel !== undefined && plan.plan_nivel !== null) return `nivel:${plan.plan_nivel}`;
  if (plan.nombre) return `nombre:${plan.nombre}`;
  return 'nivel:0';
}

async function cargarPlanesCatalogo() {
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

function rebuildPlanesOptions(planes) {
  planesOptions = [];
  planesMap = new Map();
  (planes || []).forEach(plan => {
    const nivel = Number(plan.nivel ?? plan.plan_nivel ?? 0);
    const nombre = toNonEmptyString(plan.nombre) || toNonEmptyString(plan.plan_nombre) || 'Plan';
    const precio = plan.precio ?? plan.plan_precio ?? '';
    const key = buildPlanKey(plan);
    planesOptions.push({
      key,
      plan,
      nombre,
      nivel,
      precio,
    });
    planesMap.set(key, plan);
  });
}

async function ensurePlanesCatalogo() {
  if (planesCatalogo) return planesCatalogo;
  planesCatalogo = await cargarPlanesCatalogo();
  rebuildPlanesOptions(planesCatalogo);
  return planesCatalogo;
}

function encontrarPlanKeyActual(planInfo) {
  if (!planInfo) return null;
  if (planInfo.plan_id !== null && planInfo.plan_id !== undefined) {
    const match = planesOptions.find(opt => String(opt.plan.id) === String(planInfo.plan_id));
    if (match) return match.key;
  }
  const matchNivel = planesOptions.find(opt => Number(opt.nivel) === Number(planInfo.nivel));
  if (matchNivel) return matchNivel.key;
  if (planInfo.slug) {
    const matchSlug = planesOptions.find(
      opt => toNonEmptyString(opt.plan.slug).toLowerCase() === toNonEmptyString(planInfo.slug).toLowerCase()
    );
    if (matchSlug) return matchSlug.key;
  }
  if (planInfo.nombre) {
    const matchNombre = planesOptions.find(
      opt => toNonEmptyString(opt.nombre).toLowerCase() === toNonEmptyString(planInfo.nombre).toLowerCase()
    );
    if (matchNombre) return matchNombre.key;
  }
  return planesOptions[0]?.key ?? null;
}

function buildPlanControl(comercio, { compact = false } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = compact ? 'flex flex-col gap-2' : 'flex items-center gap-2';

  if (!planesOptions.length) {
    const empty = document.createElement('span');
    empty.className = 'text-xs text-gray-400';
    empty.textContent = 'Sin planes';
    wrapper.appendChild(empty);
    return wrapper;
  }

  const planInfo = resolverPlanComercio(comercio);
  const selectedKey = encontrarPlanKeyActual(planInfo);
  let currentKey = selectedKey;

  const select = document.createElement('select');
  select.className = 'plan-select border rounded px-2 py-1 text-xs bg-white w-full';
  planesOptions.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.key;
    option.textContent = `${opt.nombre} — Nivel ${opt.nivel} (${formatoPrecio(opt.precio)})`;
    select.appendChild(option);
  });
  if (selectedKey) select.value = selectedKey;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-plan-update px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700';
  button.textContent = 'Actualizar';

  button.addEventListener('click', async () => {
    const selected = select.value;
    const plan = planesMap.get(selected);
    if (!plan) {
      alert('Plan inválido.');
      return;
    }
    const nombrePlan = toNonEmptyString(plan.nombre) || toNonEmptyString(plan.slug) || 'seleccionado';
    const confirmar = confirm(`¿Cambiar plan a ${nombrePlan}?`);
    if (!confirmar) {
      if (currentKey) select.value = currentKey;
      return;
    }

    const payload = buildComercioPlanPayload(plan);
    const prevKey = currentKey;
    button.disabled = true;
    select.disabled = true;
    button.textContent = 'Actualizando...';

    try {
      const { error } = await supabase.rpc('fn_admin_actualizar_plan_comercio', {
        p_id_comercio: Number(comercio.id),
        p_plan_id: payload.plan_id ?? null,
        p_plan_nivel: Number(payload.plan_nivel ?? 0),
        p_plan_nombre: payload.plan_nombre ?? null,
      });
      if (error) throw error;

      currentKey = selected;
      const idx = todosLosComercios.findIndex(item => String(item.id) === String(comercio.id));
      if (idx !== -1) {
        todosLosComercios[idx] = { ...todosLosComercios[idx], ...payload };
      }
      actualizarPlanLabels(comercio.id, plan);
      alert('Plan actualizado.');
    } catch (error) {
      console.error('Error actualizando plan:', error);
      const missingRpc =
        String(error?.code || '') === '42883' ||
        String(error?.message || '').toLowerCase().includes('fn_admin_actualizar_plan_comercio');
      alert(
        missingRpc
          ? 'No se pudo actualizar: falta aplicar la migracion f33 (fn_admin_actualizar_plan_comercio).'
          : 'No se pudo actualizar el plan.'
      );
      if (prevKey) select.value = prevKey;
    } finally {
      button.disabled = false;
      select.disabled = false;
      button.textContent = 'Actualizar';
    }
  });

  wrapper.appendChild(select);
  wrapper.appendChild(button);
  return wrapper;
}

function actualizarPlanLabels(idComercio, plan) {
  const nombre = toNonEmptyString(plan?.nombre) || toNonEmptyString(plan?.slug) || 'Plan';
  const nivel = Number(plan?.nivel ?? plan?.plan_nivel ?? 0);
  document.querySelectorAll(`.plan-label[data-id="${idComercio}"]`).forEach((el) => {
    el.textContent = `Plan: ${nombre} (Nivel ${nivel})`;
  });
}

async function getCategoriasCache() {
  if (categoriasCache) return categoriasCache;
  if (!categoriasPromise) {
    categoriasPromise = supabase
      .from('Categorias')
      .select('id, nombre')
      .order('nombre', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        const map = new Map();
        list.forEach(({ id, nombre }) => {
          if (id === undefined || id === null) return;
          const label = toNonEmptyString(nombre);
          if (label) map.set(String(id), label);
        });
        categoriasCache = { list, map };
        categorias = list;
        return categoriasCache;
      })
      .catch(err => {
        categoriasCache = null;
        throw err;
      })
      .finally(() => {
        categoriasPromise = null;
      });
  }
  return categoriasPromise;
}

async function getSubcategoriasCache() {
  if (subcategoriasCache) return subcategoriasCache;
  if (!subcategoriasPromise) {
    subcategoriasPromise = supabase
      .from('subCategoria')
      .select('id, nombre')
      .order('nombre', { ascending: true })
      .then(({ data, error }) => {
        if (error) throw error;
        const list = Array.isArray(data) ? data : [];
        const map = new Map();
        list.forEach(({ id, nombre }) => {
          if (id === undefined || id === null) return;
          const label = toNonEmptyString(nombre);
          if (label) map.set(String(id), label);
        });
        subcategoriasCache = { list, map };
        return subcategoriasCache;
      })
      .catch(err => {
        subcategoriasCache = null;
        throw err;
      })
      .finally(() => {
        subcategoriasPromise = null;
      });
  }
  return subcategoriasPromise;
}

function normalizeCommerceRecord(comercio, categoriaMap, subcategoriaMap) {
  const categoriasMap = categoriaMap instanceof Map ? categoriaMap : new Map();
  const subcategoriasMap = subcategoriaMap instanceof Map ? subcategoriaMap : new Map();
  const { ComercioCategorias, ComercioSubcategorias, ...rest } = comercio;

  const categoriaIdSet = new Set();
  const categoriaNombreSet = new Set();
  (Array.isArray(ComercioCategorias) ? ComercioCategorias : []).forEach(rel => {
    if (!rel || typeof rel !== 'object') return;
    const nested = rel.categoria || rel.Categoria || rel.Categorias;
    const rawId = rel.idCategoria ?? nested?.id;
    if (rawId !== undefined && rawId !== null && rawId !== '') {
      const numericId = Number(rawId);
      if (!Number.isNaN(numericId)) categoriaIdSet.add(numericId);
      const mappedName = categoriasMap.get(String(rawId));
      const label = toNonEmptyString(nested?.nombre) || mappedName;
      if (label) categoriaNombreSet.add(label);
    }
  });

  const subcategoriaIdSet = new Set();
  const subcategoriaNombreSet = new Set();
  (Array.isArray(ComercioSubcategorias) ? ComercioSubcategorias : []).forEach(rel => {
    if (!rel || typeof rel !== 'object') return;
    const nested = rel.subcategoria || rel.Subcategoria || rel.subCategoria;
    const rawId = rel.idSubcategoria ?? nested?.id;
    if (rawId !== undefined && rawId !== null && rawId !== '') {
      const numericId = Number(rawId);
      if (!Number.isNaN(numericId)) subcategoriaIdSet.add(numericId);
      const mappedName = subcategoriasMap.get(String(rawId));
      const label = toNonEmptyString(nested?.nombre) || mappedName;
      if (label) subcategoriaNombreSet.add(label);
    }
  });

  parseDelimitedList(rest.categoria).forEach(entry => categoriaNombreSet.add(entry));
  parseDelimitedList(rest.subCategorias).forEach(entry => subcategoriaNombreSet.add(entry));

  const categoriaFallback = toNonEmptyString(rest.categoria);
  if (!categoriaNombreSet.size && categoriaFallback) {
    categoriaNombreSet.add(categoriaFallback);
  }

  const categoriaDisplay = categoriaNombreSet.size
    ? Array.from(categoriaNombreSet).join(', ')
    : UNKNOWN_CATEGORY_LABEL;

  return {
    ...rest,
    categoriaIds: Array.from(categoriaIdSet),
    subcategoriaIds: Array.from(subcategoriaIdSet),
    categoriaNombres: Array.from(categoriaNombreSet),
    subcategoriaNombres: Array.from(subcategoriaNombreSet),
    categoriaDisplay,
  };
}

function isComercioActivo(comercio) {
  const rawActivo = comercio?.activo;
  const activoFlag =
    rawActivo === true ||
    rawActivo === 1 ||
    rawActivo === '1' ||
    rawActivo === 'true' ||
    rawActivo === 't';
  const estadoListing = toNonEmptyString(comercio?.estado_listing).toLowerCase();
  return activoFlag || estadoListing === 'publicado';
}

function buildComerciosSelect() {
  return `
    *,
    ComercioCategorias (
      idCategoria,
      categoria:Categorias (
        id,
        nombre
      )
    ),
    ComercioSubcategorias (
      idSubcategoria,
      subcategoria:subCategoria (
        id,
        nombre
      )
    )
  `;
}

async function fetchComerciosPage({ from, to, onlyActivos }) {
  let query = supabase
    .from('Comercios')
    .select(buildComerciosSelect())
    .range(from, to);

  if (onlyActivos) {
    query = query.or('activo.eq.true,estado_listing.eq.publicado');
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function fetchAllComercios({ onlyActivos }) {
  const rows = [];
  let from = 0;

  // PostgREST suele limitar respuestas a 1000 filas.
  while (true) {
    const to = from + COMERCIOS_PAGE_SIZE - 1;
    const chunk = await fetchComerciosPage({ from, to, onlyActivos });
    rows.push(...chunk);
    if (chunk.length < COMERCIOS_PAGE_SIZE) break;
    from += COMERCIOS_PAGE_SIZE;
  }

  return rows;
}

export async function cargarDatosComercio() {
  if (!idComercio) return;
  const { data, error } = await supabase
    .from('Comercios')
    .select(
      `
        *,
        ComercioCategorias (
          idCategoria
        ),
        ComercioSubcategorias (
          idSubcategoria
        )
      `
    )
    .eq('id', idComercio)
    .maybeSingle();

  if (error || !data) {
    alert('Error cargando comercio');
    return;
  }

  for (const key in data) {
    const el = document.getElementById(key);
    if (el) {
      if (key.includes("color") && (!data[key] || !/^#[0-9A-Fa-f]{6}$/.test(data[key]))) {
        el.value = '#000000';
      } else {
        el.value = data[key] || '';
      }
    }
  }

  if (data.idMunicipio) document.getElementById('municipio').value = String(data.idMunicipio);
  const categoriasRel = Array.isArray(data.ComercioCategorias) ? data.ComercioCategorias : [];
  const subcategoriasRel = Array.isArray(data.ComercioSubcategorias) ? data.ComercioSubcategorias : [];

  const categoriasDesdeRel = Array.from(
    new Set(
      categoriasRel
        .map(rel => rel?.idCategoria)
        .filter(id => id !== null && id !== undefined && id !== '')
        .map(id => Number(id))
        .filter(id => !Number.isNaN(id))
    )
  );

  const subcategoriasDesdeRel = Array.from(
    new Set(
      subcategoriasRel
        .map(rel => rel?.idSubcategoria)
        .filter(id => id !== null && id !== undefined && id !== '')
        .map(id => Number(id))
        .filter(id => !Number.isNaN(id))
    )
  );

  const categoriasFallback = Array.isArray(data.idCategoria)
    ? data.idCategoria
    : data.idCategoria !== null && data.idCategoria !== undefined
    ? [data.idCategoria]
    : [];

  const subcategoriasFallback = Array.isArray(data.idSubcategoria)
    ? data.idSubcategoria
    : data.idSubcategoria !== null && data.idSubcategoria !== undefined
    ? [data.idSubcategoria]
    : [];

  window.categoriasSeleccionadas = categoriasDesdeRel.length
    ? categoriasDesdeRel
    : categoriasFallback
        .map(id => Number(id))
        .filter(id => !Number.isNaN(id));

  window.subcategoriasSeleccionadas = subcategoriasDesdeRel.length
    ? subcategoriasDesdeRel
    : subcategoriasFallback
        .map(id => Number(id))
        .filter(id => !Number.isNaN(id));
}

export async function cargarComercios({ showLoader = false } = {}) {
  const contador = document.getElementById('contador-comercios');
  const tabla = document.getElementById('tabla-comercios');
  const tablaMobile = document.getElementById('tabla-mobile');

  if (showLoader) {
    if (contador) contador.textContent = 'Actualizando...';
    if (tabla) {
      tabla.innerHTML = `
        <tr>
          <td colspan="8" class="px-4 py-6 text-center text-sm text-gray-500 animate-pulse">
            Actualizando...
          </td>
        </tr>`;
    }
    if (tablaMobile) {
      tablaMobile.innerHTML = `
        <div class="text-center text-sm text-gray-500 bg-white rounded-lg shadow px-4 py-6 animate-pulse">
          Actualizando...
        </div>`;
    }
  }

  try {
    await ensurePlanesCatalogo();
    const comerciosPromise = fetchAllComercios({ onlyActivos: soloActivos });

    const [categoriasData, subcategoriasData, comerciosResponse, imagenesResponse, municipiosResponse] =
      await Promise.all([
        getCategoriasCache(),
        getSubcategoriasCache(),
        comerciosPromise,
        supabase
          .from('imagenesComercios')
          .select('idComercio, imagen, logo')
          .eq('logo', true),
        supabase.from('Municipios').select('id, nombre'),
      ]);

    const categoriaMap = categoriasData?.map ?? new Map();
    const subcategoriaMap = subcategoriasData?.map ?? new Map();

    const comercios = comerciosResponse;
    const errorComercios = null;
    const { data: imagenes, error: errorImagenes } = imagenesResponse;
    const { data: muniData, error: errorMunicipios } = municipiosResponse;

    if (errorComercios || errorImagenes || errorMunicipios) {
      console.error('❌ Error cargando datos:', {
        errorComercios,
        errorImagenes,
        errorMunicipios,
      });
      alert('Error cargando comercios');
      return;
    }

    todosLosComercios = (comercios || []).map(comercio =>
      normalizeCommerceRecord(comercio, categoriaMap, subcategoriaMap)
    );
    logos = Array.isArray(imagenes) ? imagenes : [];
    municipios = Array.isArray(muniData) ? muniData : [];

    filtrarYMostrarComercios();
  } catch (err) {
    console.error('❌ Error cargando datos:', err);
    alert('Error cargando comercios');
  }
}

export function filtrarYMostrarComercios() {
  const normalizar = txt => toNonEmptyString(txt).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const filtroNombreValor = document.getElementById('search-nombre')?.value || '';
  const filtroNombre = normalizar(filtroNombreValor);
  const filtroCategoriaValor = document.getElementById('search-categoria')?.value || '';
  const categoriaFiltroNumero = filtroCategoriaValor ? Number(filtroCategoriaValor) : null;
  const filtroCategoria =
    categoriaFiltroNumero !== null && !Number.isNaN(categoriaFiltroNumero) ? categoriaFiltroNumero : null;
  const filtroMunicipio = document.getElementById('search-municipio')?.value || '';
  const filtroOrden = document.getElementById('search-orden')?.value || '';

  let lista = todosLosComercios.filter(c => {
    if (soloActivos && !isComercioActivo(c)) return false;
    if (filtroNombre && !normalizar(c.nombre).includes(filtroNombre)) return false;
    if (
      filtroCategoria !== null &&
      !(Array.isArray(c.categoriaIds) && c.categoriaIds.includes(filtroCategoria))
    ) {
      return false;
    }
    if (filtroMunicipio && String(c.idMunicipio) !== String(filtroMunicipio)) return false;
    return true;
  });

  if (filtroOrden === 'az') {
    lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else {
    lista.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const tabla = document.getElementById('tabla-comercios');
  const tablaMobile = document.getElementById('tabla-mobile');
  const contador = document.getElementById('contador-comercios');
  if (!tabla || !tablaMobile || !contador) return;

  contador.textContent = `Mostrando ${lista.length} comercio${lista.length !== 1 ? 's' : ''}`;
  tabla.innerHTML = '';
  tablaMobile.innerHTML = '';

  if (lista.length === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-6 text-center text-sm text-gray-500">
          No se encontraron comercios con estos criterios.
        </td>
      </tr>`;
    tablaMobile.innerHTML = `
      <div class="text-center text-sm text-gray-500 bg-white rounded-lg shadow px-4 py-6">
        No se encontraron comercios con estos criterios.
      </div>`;
    return;
  }

  lista.forEach(c => {
    const activoVisual = isComercioActivo(c);
    const logo = logos.find(img => img.idComercio === c.id);
    const logoUrl = logo ? `${baseImageUrl}/${logo.imagen}` : '';
    const nombreCategoria = c.categoriaDisplay || UNKNOWN_CATEGORY_LABEL;
    const nombreMunicipio = municipios.find(m => m.id === c.idMunicipio)?.nombre || '-';

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="px-4 py-2 font-medium flex items-center gap-2">
        <img src="${logoUrl}" class="w-8 h-8 object-contain border rounded" />
        ${c.nombre}
      </td>
      <td class="px-4 py-2">${nombreCategoria}</td>
      <td class="px-4 py-2">${nombreMunicipio}</td>
      <td class="px-4 py-2">-</td>
      <td class="px-4 py-2 plan-cell" data-id="${c.id}"></td>
      <td class="px-4 py-2 text-center">
        <input type="checkbox" class="toggle-activo" data-id="${c.id}" ${activoVisual ? 'checked' : ''}>
      </td>
      <td class="px-4 py-2 text-xs">${new Date(c.created_at).toLocaleDateString()}</td>
      <td class="px-4 py-2 text-center">
        <button class="text-orange-500 btn-editar" data-id="${c.id}"><i class="fas fa-edit"></i></button>
        <button class="text-red-500 ml-2 btn-eliminar" data-id="${c.id}"><i class="fas fa-trash-alt"></i></button>
      </td>
    `;
    tabla.appendChild(fila);
    const planCell = fila.querySelector('.plan-cell');
    if (planCell) {
      planCell.appendChild(buildPlanControl(c));
    }

    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow p-4 flex flex-col gap-2';
    const planInfo = resolverPlanComercio(c);
    card.innerHTML = `
      <div class="flex gap-4 items-start">
        <div class="flex gap-3 flex-1">
          <img src="${logoUrl}" class="w-24 h-24 object-contain shadow rounded-full bg-white"/>
          <div>
            <div class="text-xl font-bold text-gray-800">${c.nombre}</div>
            <div class="text-sm text-gray-600">Categoría: <strong>${nombreCategoria}</strong></div>
            <div class="text-sm text-gray-600">Municipio: <strong>${nombreMunicipio}</strong></div>
            <div class="text-xs text-gray-500 plan-label" data-id="${c.id}">Plan: ${planInfo.nombre} (Nivel ${planInfo.nivel})</div>
            <span class="text-xs text-gray-500">Desde: ${new Date(c.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="flex flex-col items-center gap-3 text-xl">
          <button class="text-orange-500 btn-editar" data-id="${c.id}"><i class="fas fa-edit"></i></button>
          <label class="flex flex-col items-center text-xs text-gray-600">
            <input type="checkbox" class="toggle-activo" data-id="${c.id}" ${activoVisual ? 'checked' : ''}>
            <span class="mt-1">Activo</span>
          </label>
          <button class="text-red-500 btn-eliminar" data-id="${c.id}"><i class="fas fa-times-circle"></i></button>
        </div>
      </div>
      <div class="plan-card" data-id="${c.id}"></div>
    `;
    tablaMobile.appendChild(card);
    const planCard = card.querySelector('.plan-card');
    if (planCard) {
      planCard.appendChild(buildPlanControl(c, { compact: true }));
    }
  });

  document.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      window.location.href = resolvePath(`editarComercio.html?id=${id}`);
    });
  });

  document.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const btnEliminar = e.currentTarget;
      const id = btnEliminar.dataset.id;

      const confirmado = confirm('¿Eliminar comercio?\n\nEsta acción eliminará el comercio y toda su información relacionada. ¿Deseas continuar?');
      if (!confirmado) return;

      console.log('Eliminando comercio:', id);
      const iconoOriginal = btnEliminar.innerHTML;
      btnEliminar.disabled = true;
      btnEliminar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

      try {
        console.log('Eliminando horarios para comercio:', id);
        const { error: errorHorarios } = await supabase.from('Horarios').delete().eq('idComercio', id);
        if (errorHorarios) throw errorHorarios;

        console.log('Obteniendo imágenes asociadas para comercio:', id);
        const { data: imagenesRelacionadas, error: errorImagenesRelacionadas } = await supabase
          .from('imagenesComercios')
          .select('imagen')
          .eq('idComercio', id);
        if (errorImagenesRelacionadas) throw errorImagenesRelacionadas;

        let storageWarning = false;
        if (Array.isArray(imagenesRelacionadas) && imagenesRelacionadas.length) {
          const rutas = imagenesRelacionadas
            .map(img => img.imagen)
            .filter(Boolean);

          if (rutas.length) {
            console.log('Eliminando imágenes del almacenamiento:', rutas);
            const { error: errorStorage } = await supabase.storage.from('galeriacomercios').remove(rutas);
            if (errorStorage) {
              storageWarning = true;
              console.error('Error eliminando imágenes del almacenamiento:', errorStorage);
            }
          }
        }

        console.log('Eliminando registros de imágenes en base de datos:', id);
        const { error: errorImagenes } = await supabase.from('imagenesComercios').delete().eq('idComercio', id);
        if (errorImagenes) throw errorImagenes;

        console.log('Eliminando amenidades para comercio:', id);
        const { error: errorAmenidades } = await supabase.from('comercioAmenidades').delete().eq('idComercio', id);
        if (errorAmenidades) throw errorAmenidades;

        console.log('Eliminando categorías relacionadas:', id);
        const { error: errorCategoriasRelacion } = await supabase
          .from('ComercioCategorias')
          .delete()
          .eq('idComercio', id);
        if (errorCategoriasRelacion) throw errorCategoriasRelacion;

        console.log('Eliminando subcategorías relacionadas:', id);
        const { error: errorSubcategoriasRelacion } = await supabase
          .from('ComercioSubcategorias')
          .delete()
          .eq('idComercio', id);
        if (errorSubcategoriasRelacion) throw errorSubcategoriasRelacion;

        console.log('Eliminando comercio principal:', id);
        const { error: errorComercio } = await supabase.from('Comercios').delete().eq('id', id);
        if (errorComercio) throw errorComercio;

        todosLosComercios = todosLosComercios.filter(c => String(c.id) !== String(id));
        logos = logos.filter(img => String(img.idComercio) !== String(id));
        filtrarYMostrarComercios();

        if (storageWarning) {
          alert('Comercio eliminado, pero hubo errores al eliminar imágenes del almacenamiento.');
        } else {
          alert('Comercio eliminado correctamente.');
        }
      } catch (error) {
        console.error('Error al eliminar el comercio:', error);
        alert('Error al eliminar el comercio. Inténtalo nuevamente.');
      } finally {
        btnEliminar.disabled = false;
        btnEliminar.innerHTML = iconoOriginal;
      }
    });
  });

  document.querySelectorAll('.toggle-activo').forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      const target = e.currentTarget;
      const id = target.dataset.id;
      const nuevoEstado = target.checked;
      const estadoPrevio = !nuevoEstado;

      const confirmado = confirm('¿Seguro que deseas cambiar el estado de este comercio?');
      if (!confirmado) {
        target.checked = estadoPrevio;
        return;
      }

      try {
        target.disabled = true;
        target.dataset.loading = 'true';
        const { error } = await supabase.from('Comercios').update({ activo: nuevoEstado }).eq('id', id);
        if (error) {
          throw error;
        }
        console.log(`✅ Comercio ${id} actualizado a ${nuevoEstado ? 'activo' : 'inactivo'}`);
      } catch (error) {
        alert('Error al actualizar el estado del comercio.');
        target.checked = estadoPrevio;
        console.error('Error actualizando estado del comercio', error);
      } finally {
        target.disabled = false;
        delete target.dataset.loading;
      }
    });
  });
}

export async function actualizarFiltroSoloActivos(estado) {
  soloActivos = estado;
  await cargarComercios({ showLoader: true });
}

export async function cargarCategorias() {
  const select = document.getElementById('search-categoria');
  if (!select) return;
  try {
    const { list } = await getCategoriasCache();
    const currentValue = select.value;
    select.innerHTML = '<option value="">Todas las categorías</option>';
    list.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.nombre;
      select.appendChild(option);
    });
    if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
      select.value = currentValue;
    }
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

export async function cargarMunicipios() {
  const { data } = await supabase.from('Municipios').select('id, nombre');
  const select = document.getElementById('search-municipio');
  if (!select) return;
  data.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = m.nombre;
    select.appendChild(option);
  });
}

export async function cargarMunicipiosFormulario(idSeleccionado = null) {
  const { data, error } = await supabase.from('Municipios').select('id, nombre').order('nombre', { ascending: true });
  if (error) {
    console.error('Error cargando municipios para el formulario:', error);
    return;
  }

  const select = document.getElementById('municipio');
  if (!select) return;

  select.innerHTML = '<option value="">Selecciona un municipio</option>';
  data.forEach(m => {
    const option = document.createElement('option');
    option.value = m.id;
    option.textContent = m.nombre;
    if (idSeleccionado && String(m.id) === String(idSeleccionado)) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const esEditarComercio = window.location.pathname.includes('editarComercio');
  if (!esEditarComercio || !idComercio) return;

  await cargarDatosComercio();

  const { data, error } = await supabase
    .from('Comercios')
    .select('idMunicipio')
    .eq('id', idComercio)
    .maybeSingle();

  if (error) {
    console.warn('Error obteniendo municipio del comercio:', error);
    return;
  }

  await cargarMunicipiosFormulario(data?.idMunicipio);
});
