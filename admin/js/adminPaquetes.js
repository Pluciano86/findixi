import { supabase } from '../shared/supabaseClient.js';
import { PLANES_PRELIMINARES, formatoPrecio, obtenerPlanPorNivel } from '../shared/planes.js';

const planForm = document.getElementById('planForm');
const planId = document.getElementById('planId');
const planNombre = document.getElementById('planNombre');
const planPrecio = document.getElementById('planPrecio');
const planNivel = document.getElementById('planNivel');
const planOrden = document.getElementById('planOrden');
const planDescripcion = document.getElementById('planDescripcion');
const planFeatures = document.getElementById('planFeatures');
const planActivo = document.getElementById('planActivo');
const planDisponibilidad = document.getElementById('planDisponibilidad');
const planOfertaActiva = document.getElementById('planOfertaActiva');
const planOfertaTipo = document.getElementById('planOfertaTipo');
const planPrecioOferta = document.getElementById('planPrecioOferta');
const planOfertaHasta = document.getElementById('planOfertaHasta');
const cancelarEdicion = document.getElementById('cancelarEdicion');
const planesLista = document.getElementById('planesLista');
const planesEmpty = document.getElementById('planesEmpty');
const formMensaje = document.getElementById('formMensaje');
const estadoPlanes = document.getElementById('estadoPlanes');
const refreshPlanes = document.getElementById('refreshPlanes');
const seedPlanes = document.getElementById('seedPlanes');

let planesCache = [];
let modoLocal = false;

function setMensaje(texto = '') {
  if (!formMensaje) return;
  formMensaje.textContent = texto;
}

function toFeaturesArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|\s*,\s*/)
      .map((f) => f.trim())
      .filter(Boolean);
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.features)) return value.features.filter(Boolean);
  }
  return [];
}

function featuresToText(features) {
  const list = toFeaturesArray(features);
  return list.join('\n');
}

function parseMissingColumn(error) {
  const source = `${String(error?.message || '')} ${String(error?.details || '')}`;
  const match =
    source.match(/column\s+"([a-zA-Z0-9_]+)"\s+does not exist/i) ||
    source.match(/column\s+'([a-zA-Z0-9_]+)'\s+does not exist/i) ||
    source.match(/Could not find the '([a-zA-Z0-9_]+)' column/i);
  return match?.[1] || null;
}

function normalizeDisponibilidad(value) {
  const raw = String(value || 'disponible').trim().toLowerCase();
  if (raw === 'no_disponible') return 'no_disponible';
  if (raw === 'proximamente') return 'proximamente';
  return 'disponible';
}

function toDateInputValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function getPlanKey(plan = {}) {
  if (plan.id !== null && plan.id !== undefined && String(plan.id).trim() !== '') {
    return `id:${String(plan.id)}`;
  }
  if (plan.slug) return `slug:${String(plan.slug)}`;
  return `nivel:${String(plan.nivel ?? 0)}`;
}

function syncOfertaControls() {
  const ofertaActiva = Boolean(planOfertaActiva?.checked);
  const tipo = String(planOfertaTipo?.value || 'precio_especial');
  const esGratis = tipo === 'gratis_limitado';

  if (planOfertaTipo) planOfertaTipo.disabled = !ofertaActiva;
  if (planOfertaHasta) planOfertaHasta.disabled = !ofertaActiva;
  if (planPrecioOferta) {
    planPrecioOferta.disabled = !ofertaActiva || esGratis;
    if (esGratis) planPrecioOferta.value = '';
  }
}

function resetForm() {
  planId.value = '';
  planNombre.value = '';
  planPrecio.value = '';
  planNivel.value = '0';
  planOrden.value = '';
  planDescripcion.value = '';
  planFeatures.value = '';
  planActivo.checked = true;
  if (planDisponibilidad) planDisponibilidad.value = 'disponible';
  if (planOfertaActiva) planOfertaActiva.checked = false;
  if (planOfertaTipo) planOfertaTipo.value = 'precio_especial';
  if (planPrecioOferta) planPrecioOferta.value = '';
  if (planOfertaHasta) planOfertaHasta.value = '';
  syncOfertaControls();
  setMensaje('');
}

function fillForm(plan) {
  planId.value = plan.id || '';
  planNombre.value = plan.nombre || '';
  planPrecio.value = plan.precio ?? '';
  planNivel.value = String(plan.nivel ?? 0);
  planOrden.value = plan.orden ?? '';
  planDescripcion.value = plan.descripcion_corta || plan.descripcion || '';
  planFeatures.value = featuresToText(plan.features || plan.caracteristicas || []);
  planActivo.checked = plan.activo !== false;
  if (planDisponibilidad) {
    const disponibilidad = normalizeDisponibilidad(plan.disponibilidad || plan.estado_disponibilidad || 'disponible');
    planDisponibilidad.value = disponibilidad;
  }
  if (planOfertaActiva) {
    planOfertaActiva.checked = plan.oferta_activa === true;
  }
  if (planOfertaTipo) {
    const tipo = String(plan.oferta_tipo || '').trim();
    if (tipo === 'gratis_limitado' || plan.oferta_gratis === true) {
      planOfertaTipo.value = 'gratis_limitado';
    } else {
      planOfertaTipo.value = 'precio_especial';
    }
  }
  if (planPrecioOferta) {
    const precioOferta = plan.precio_oferta;
    planPrecioOferta.value = Number.isFinite(Number(precioOferta)) ? Number(precioOferta) : '';
  }
  if (planOfertaHasta) {
    planOfertaHasta.value = toDateInputValue(plan.oferta_hasta);
  }
  syncOfertaControls();
}

function renderPlanes(planes) {
  planesLista.innerHTML = '';
  if (!planes || planes.length === 0) {
    planesEmpty.classList.remove('hidden');
    return;
  }
  planesEmpty.classList.add('hidden');

  planes.forEach((plan) => {
    const card = document.createElement('div');
    card.className = 'border border-gray-200 rounded-xl p-4 shadow-sm bg-white space-y-3';
    const nivel = Number.isFinite(Number(plan.nivel)) ? Number(plan.nivel) : 0;
    const base = obtenerPlanPorNivel(nivel);
    const features = toFeaturesArray(plan.features || plan.caracteristicas || []);
    const activo = plan.activo !== false;
    const hasPersistedId = plan.id !== null && plan.id !== undefined && String(plan.id).trim() !== '';
    const disponibilidad = normalizeDisponibilidad(plan.disponibilidad || plan.estado_disponibilidad || 'disponible');
    const ofertaActiva = plan.oferta_activa === true;
    const ofertaTipo = String(plan.oferta_tipo || '').trim() === 'gratis_limitado' || plan.oferta_gratis === true
      ? 'gratis_limitado'
      : 'precio_especial';
    const precioBase = Number(plan.precio ?? base.precio ?? 0) || 0;
    const precioOfertaNum = Number(plan.precio_oferta);
    const ofertaHastaLabel = toDateInputValue(plan.oferta_hasta);
    const planKey = getPlanKey(plan);

    const disponibilidadBadge = {
      disponible: '<span class="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">Disponible</span>',
      proximamente: '<span class="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">Próximamente</span>',
      no_disponible: '<span class="text-xs font-semibold px-2 py-1 rounded-full bg-rose-100 text-rose-700">No disponible</span>',
    }[disponibilidad];

    let precioHtml = `${formatoPrecio(precioBase)} / mes`;
    if (ofertaActiva) {
      if (ofertaTipo === 'gratis_limitado') {
        precioHtml = `<span class="line-through text-gray-400">${formatoPrecio(precioBase)}</span> · <span class="text-emerald-600 font-semibold">GRATIS</span>`;
      } else if (Number.isFinite(precioOfertaNum)) {
        precioHtml = `<span class="line-through text-gray-400">${formatoPrecio(precioBase)}</span> · <span class="text-amber-600 font-semibold">${formatoPrecio(precioOfertaNum)}</span>`;
      }
    }

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">${plan.nombre || base.nombre}</h3>
          <p class="text-sm text-gray-500">Nivel ${nivel} · ${precioHtml}</p>
          <p class="text-xs text-gray-400">Orden: ${plan.orden ?? '—'}</p>
          ${ofertaActiva ? `<p class="text-xs text-amber-700 mt-1">Oferta activa${ofertaHastaLabel ? ` hasta ${ofertaHastaLabel}` : ''}</p>` : ''}
        </div>
        <div class="flex flex-col items-end gap-1">
          <span class="text-xs font-semibold px-2 py-1 rounded-full ${activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}">
            ${activo ? 'Activo' : 'Inactivo'}
          </span>
          ${disponibilidadBadge}
        </div>
      </div>
      ${plan.descripcion_corta ? `<p class="text-sm text-gray-600">${plan.descripcion_corta}</p>` : ''}
      ${features.length ? `
        <ul class="text-sm text-gray-600 list-disc list-inside space-y-1">
          ${features.map((f) => `<li>${f}</li>`).join('')}
        </ul>` : ''}
      ${hasPersistedId ? `<div class="flex items-center gap-2">
        <button data-action="edit" data-id="${plan.id ?? ''}" data-plan-key="${planKey}" class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">
          Editar
        </button>
        <button data-action="toggle" data-id="${plan.id ?? ''}" data-plan-key="${planKey}" class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">
          ${activo ? 'Desactivar' : 'Activar'}
        </button>
        <button data-action="delete" data-id="${plan.id ?? ''}" data-plan-key="${planKey}" class="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
          Eliminar
        </button>
      </div>` : `<div class="flex items-center gap-2">
        <button data-action="create" data-plan-key="${planKey}" class="px-3 py-1.5 text-sm rounded-lg border border-cyan-200 text-cyan-700 hover:bg-cyan-50">
          Crear en DB
        </button>
      </div>`}
    `;

    card.querySelectorAll('button').forEach((btn) => {
      if (modoLocal && btn.dataset.action !== 'edit') {
        btn.disabled = true;
        btn.classList.add('opacity-60');
      }
      if (modoLocal && btn.dataset.action === 'edit') {
        btn.disabled = true;
        btn.classList.add('opacity-60');
      }
    });

    card.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      const planKey = button.dataset.planKey || '';
      const seleccionado = planesCache.find((p) => getPlanKey(p) === planKey);
      if (!seleccionado && action !== 'create') return;

      if (modoLocal) return;

      if (action === 'create') {
        if (!seleccionado) return;
        crearPlanDesdePreliminar(seleccionado);
        return;
      }
      if (action === 'edit') {
        fillForm(seleccionado);
        setMensaje('Editando plan.');
        return;
      }
      if (action === 'toggle') {
        toggleActivo(seleccionado);
        return;
      }
      if (action === 'delete') {
        eliminarPlan(seleccionado);
      }
    });

    planesLista.appendChild(card);
  });
}

async function cargarPlanes() {
  estadoPlanes.textContent = 'Cargando planes...';
  modoLocal = false;
  try {
    const { data, error } = await supabase
      .from('planes')
      .select('*')
      .order('orden', { ascending: true });

    if (error) throw error;

    planesCache = Array.isArray(data) ? data : [];
    if (!planesCache.length) {
      estadoPlanes.textContent = 'No hay planes en la base de datos. Mostrando paquetes base.';
      planesCache = PLANES_PRELIMINARES.map((plan, index) => ({
        ...plan,
        id: null,
        activo: true,
        disponibilidad: 'disponible',
        oferta_activa: false,
        oferta_tipo: 'precio_especial',
        precio_oferta: null,
        oferta_hasta: null,
        orden: plan.orden ?? index + 1,
      }));
      renderPlanes(planesCache);
      return;
    }

    estadoPlanes.textContent = '';
    renderPlanes(planesCache);
  } catch (error) {
    console.warn('No se pudieron cargar planes desde Supabase:', error?.message || error);
    estadoPlanes.textContent = 'Tabla planes no disponible. Mostrando datos preliminares.';
    modoLocal = true;
    planesCache = PLANES_PRELIMINARES.map((plan) => ({ ...plan, id: null, activo: true }));
    renderPlanes(planesCache);
  }
}

async function insertPlanWithFallback(payload) {
  let body = { ...payload };
  const removedColumns = [];
  for (let i = 0; i < 12; i += 1) {
    const { error } = await supabase.from('planes').insert(body);
    if (!error) return { ok: true, body, removedColumns };

    const missingColumn = parseMissingColumn(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(body, missingColumn)) {
      removedColumns.push(missingColumn);
      delete body[missingColumn];
      continue;
    }
    return { ok: false, error };
  }
  return { ok: false, error: new Error('No se pudo insertar con el esquema actual.') };
}

async function updatePlanWithFallback(id, payload) {
  let body = { ...payload };
  const removedColumns = [];
  for (let i = 0; i < 12; i += 1) {
    const { error } = await supabase.from('planes').update(body).eq('id', id);
    if (!error) return { ok: true, body, removedColumns };

    const missingColumn = parseMissingColumn(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(body, missingColumn)) {
      removedColumns.push(missingColumn);
      delete body[missingColumn];
      continue;
    }
    return { ok: false, error };
  }
  return { ok: false, error: new Error('No se pudo actualizar con el esquema actual.') };
}

function buildPlanPayloadFromForm() {
  const ofertaActiva = !!planOfertaActiva?.checked;
  const ofertaTipo = String(planOfertaTipo?.value || 'precio_especial');
  const ofertaEsGratis = ofertaActiva && ofertaTipo === 'gratis_limitado';
  const precioOfertaValue = planPrecioOferta?.value;
  const precioOfertaNum = precioOfertaValue === '' ? null : Number(precioOfertaValue);

  const disponibilidadValue = normalizeDisponibilidad(planDisponibilidad?.value || 'disponible');

  return {
    nombre: planNombre.value.trim(),
    precio: planPrecio.value ? Number(planPrecio.value) : 0,
    nivel: Number(planNivel.value) || 0,
    orden: planOrden.value ? Number(planOrden.value) : null,
    descripcion_corta: planDescripcion.value.trim() || null,
    features: toFeaturesArray(planFeatures.value),
    activo: !!planActivo.checked,
    disponibilidad: disponibilidadValue,
    estado_disponibilidad: disponibilidadValue,
    oferta_activa: ofertaActiva,
    oferta_tipo: ofertaTipo,
    oferta_gratis: ofertaEsGratis,
    precio_oferta: ofertaActiva && !ofertaEsGratis && Number.isFinite(precioOfertaNum) ? precioOfertaNum : null,
    oferta_hasta: ofertaActiva && planOfertaHasta?.value ? planOfertaHasta.value : null,
  };
}

function assertDisponibilidadPersisted(result) {
  const removed = Array.isArray(result?.removedColumns) ? result.removedColumns : [];
  const removedDisponibilidad = removed.includes('disponibilidad');
  const removedEstadoDisponibilidad = removed.includes('estado_disponibilidad');
  if (removedDisponibilidad && removedEstadoDisponibilidad) {
    throw new Error(
      'No se guardó la disponibilidad: faltan columnas disponibilidad/estado_disponibilidad en la tabla planes. Ejecuta la migración.'
    );
  }
}

async function guardarPlan(event) {
  event.preventDefault();
  if (modoLocal) {
    setMensaje('No se puede guardar sin la tabla planes.');
    return;
  }

  const payload = buildPlanPayloadFromForm();

  try {
    if (!payload.nombre) {
      setMensaje('El nombre del plan es requerido.');
      return;
    }

    if (planId.value) {
      const updated = await updatePlanWithFallback(planId.value, payload);
      if (!updated.ok) throw updated.error;
      assertDisponibilidadPersisted(updated);
      setMensaje('Plan actualizado.');
    } else {
      const inserted = await insertPlanWithFallback(payload);
      if (!inserted.ok) throw inserted.error;
      assertDisponibilidadPersisted(inserted);
      setMensaje('Plan creado.');
    }

    resetForm();
    await cargarPlanes();
  } catch (error) {
    console.error('Error guardando plan:', error);
    setMensaje('No se pudo guardar el plan.');
  }
}

async function crearPlanDesdePreliminar(plan) {
  if (!plan || modoLocal) return;

  const payload = {
    nombre: plan.nombre || '',
    precio: Number(plan.precio ?? 0) || 0,
    nivel: Number(plan.nivel ?? 0) || 0,
    orden: Number(plan.orden ?? 0) || null,
    descripcion_corta: plan.descripcion_corta || null,
    features: toFeaturesArray(plan.features || []),
    activo: plan.activo !== false,
    disponibilidad: normalizeDisponibilidad(plan.disponibilidad || 'disponible'),
    estado_disponibilidad: normalizeDisponibilidad(plan.disponibilidad || 'disponible'),
    oferta_activa: plan.oferta_activa === true,
    oferta_tipo: plan.oferta_tipo || 'precio_especial',
    oferta_gratis: plan.oferta_gratis === true,
    precio_oferta: Number.isFinite(Number(plan.precio_oferta)) ? Number(plan.precio_oferta) : null,
    oferta_hasta: toDateInputValue(plan.oferta_hasta) || null,
  };

  const inserted = await insertPlanWithFallback(payload);
  if (!inserted.ok) {
    console.error('Error creando plan preliminar:', inserted.error);
    setMensaje('No se pudo crear el plan en la base de datos.');
    return;
  }
  assertDisponibilidadPersisted(inserted);

  setMensaje('Plan base creado en la base de datos.');
  await cargarPlanes();
}

async function toggleActivo(plan) {
  if (!plan?.id) return;
  const { error } = await supabase
    .from('planes')
    .update({ activo: !(plan.activo !== false) })
    .eq('id', plan.id);
  if (error) {
    console.error('Error actualizando activo:', error);
    return;
  }
  await cargarPlanes();
}

async function eliminarPlan(plan) {
  if (!plan?.id) return;
  const confirmar = confirm(`¿Eliminar el plan "${plan.nombre}"?`);
  if (!confirmar) return;
  const { error } = await supabase.from('planes').delete().eq('id', plan.id);
  if (error) {
    console.error('Error eliminando plan:', error);
    return;
  }
  await cargarPlanes();
}

async function sembrarPlanesBase() {
  if (modoLocal) {
    setMensaje('No se puede sembrar en modo local.');
    return;
  }

  const confirmar = confirm('Se crearán en DB los paquetes base que falten. ¿Continuar?');
  if (!confirmar) return;

  try {
    const existentes = new Set(
      (planesCache || [])
        .filter((p) => p.id)
        .map((p) => Number(p.nivel))
        .filter((n) => Number.isFinite(n))
    );

    const faltantes = PLANES_PRELIMINARES
      .filter((p) => !existentes.has(Number(p.nivel)))
      .map((plan, index) => ({
        nombre: plan.nombre,
        precio: Number(plan.precio ?? 0) || 0,
        nivel: Number(plan.nivel ?? 0) || 0,
        orden: Number(plan.orden ?? index + 1) || index + 1,
        descripcion_corta: plan.descripcion_corta || null,
        features: toFeaturesArray(plan.features || []),
        activo: true,
        disponibilidad: 'disponible',
        estado_disponibilidad: 'disponible',
        oferta_activa: false,
        oferta_tipo: 'precio_especial',
        oferta_gratis: false,
        precio_oferta: null,
        oferta_hasta: null,
      }));

    if (!faltantes.length) {
      setMensaje('No faltan paquetes base por crear.');
      return;
    }

    for (const payload of faltantes) {
      const inserted = await insertPlanWithFallback(payload);
      if (!inserted.ok) {
        throw inserted.error;
      }
      assertDisponibilidadPersisted(inserted);
    }

    setMensaje(`Se crearon ${faltantes.length} paquetes base.`);
    await cargarPlanes();
  } catch (error) {
    console.error('Error sembrando paquetes base:', error);
    setMensaje('No se pudieron sembrar todos los paquetes base.');
  }
}

(async () => {
  planForm?.addEventListener('submit', guardarPlan);

  cancelarEdicion?.addEventListener('click', () => {
    resetForm();
  });

  refreshPlanes?.addEventListener('click', () => {
    cargarPlanes();
  });
  seedPlanes?.addEventListener('click', () => {
    sembrarPlanesBase();
  });
  planOfertaActiva?.addEventListener('change', syncOfertaControls);
  planOfertaTipo?.addEventListener('change', syncOfertaControls);

  resetForm();
  await cargarPlanes();
})();
