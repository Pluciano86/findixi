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
const cancelarEdicion = document.getElementById('cancelarEdicion');
const planesLista = document.getElementById('planesLista');
const planesEmpty = document.getElementById('planesEmpty');
const formMensaje = document.getElementById('formMensaje');
const estadoPlanes = document.getElementById('estadoPlanes');
const refreshPlanes = document.getElementById('refreshPlanes');

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

function resetForm() {
  planId.value = '';
  planNombre.value = '';
  planPrecio.value = '';
  planNivel.value = '0';
  planOrden.value = '';
  planDescripcion.value = '';
  planFeatures.value = '';
  planActivo.checked = true;
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

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">${plan.nombre || base.nombre}</h3>
          <p class="text-sm text-gray-500">Nivel ${nivel} · ${formatoPrecio(plan.precio ?? base.precio)} / mes</p>
          <p class="text-xs text-gray-400">Orden: ${plan.orden ?? '—'}</p>
        </div>
        <span class="text-xs font-semibold px-2 py-1 rounded-full ${activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}">
          ${activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>
      ${plan.descripcion_corta ? `<p class="text-sm text-gray-600">${plan.descripcion_corta}</p>` : ''}
      ${features.length ? `
        <ul class="text-sm text-gray-600 list-disc list-inside space-y-1">
          ${features.map((f) => `<li>${f}</li>`).join('')}
        </ul>` : ''}
      <div class="flex items-center gap-2">
        <button data-action="edit" data-id="${plan.id ?? ''}" class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">
          Editar
        </button>
        <button data-action="toggle" data-id="${plan.id ?? ''}" class="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-100">
          ${activo ? 'Desactivar' : 'Activar'}
        </button>
        <button data-action="delete" data-id="${plan.id ?? ''}" class="px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
          Eliminar
        </button>
      </div>
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
      const seleccionado = planesCache.find((p) => String(p.id) === String(id));
      if (!seleccionado) return;

      if (modoLocal) return;

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
    estadoPlanes.textContent = '';

    if (!planesCache.length) {
      planesCache = [];
    }
    renderPlanes(planesCache);
  } catch (error) {
    console.warn('No se pudieron cargar planes desde Supabase:', error?.message || error);
    estadoPlanes.textContent = 'Tabla planes no disponible. Mostrando datos preliminares.';
    modoLocal = true;
    planesCache = PLANES_PRELIMINARES.map((plan) => ({ ...plan, id: null, activo: true }));
    renderPlanes(planesCache);
  }
}

async function guardarPlan(event) {
  event.preventDefault();
  if (modoLocal) {
    setMensaje('No se puede guardar sin la tabla planes.');
    return;
  }

  const payload = {
    nombre: planNombre.value.trim(),
    precio: planPrecio.value ? Number(planPrecio.value) : 0,
    nivel: Number(planNivel.value) || 0,
    orden: planOrden.value ? Number(planOrden.value) : null,
    descripcion_corta: planDescripcion.value.trim() || null,
    features: toFeaturesArray(planFeatures.value),
    activo: !!planActivo.checked,
  };

  try {
    if (!payload.nombre) {
      setMensaje('El nombre del plan es requerido.');
      return;
    }

    if (planId.value) {
      const { error } = await supabase
        .from('planes')
        .update(payload)
        .eq('id', planId.value);
      if (error) throw error;
      setMensaje('Plan actualizado.');
    } else {
      const { error } = await supabase.from('planes').insert(payload);
      if (error) throw error;
      setMensaje('Plan creado.');
    }

    resetForm();
    await cargarPlanes();
  } catch (error) {
    console.error('Error guardando plan:', error);
    setMensaje('No se pudo guardar el plan.');
  }
}

async function toggleActivo(plan) {
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
  const confirmar = confirm(`¿Eliminar el plan "${plan.nombre}"?`);
  if (!confirmar) return;
  const { error } = await supabase.from('planes').delete().eq('id', plan.id);
  if (error) {
    console.error('Error eliminando plan:', error);
    return;
  }
  await cargarPlanes();
}

planForm?.addEventListener('submit', guardarPlan);

cancelarEdicion?.addEventListener('click', () => {
  resetForm();
});

refreshPlanes?.addEventListener('click', () => {
  cargarPlanes();
});

resetForm();
await cargarPlanes();
