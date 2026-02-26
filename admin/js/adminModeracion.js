import { supabase } from '../shared/supabaseClient.js';

const filtroEstado = document.getElementById('filtroEstado');
const filtroTipo = document.getElementById('filtroTipo');
const btnRefrescar = document.getElementById('btnRefrescarModeracion');
const feedback = document.getElementById('moderacionFeedback');
const solicitudesList = document.getElementById('solicitudesList');
const disputasList = document.getElementById('disputasList');
const solicitudesCount = document.getElementById('solicitudesCount');
const disputasCount = document.getElementById('disputasCount');
const solicitudesSection = document.getElementById('solicitudesSection');
const disputasSection = document.getElementById('disputasSection');

let currentUserId = null;
let loading = false;

function showFeedback(type, message) {
  if (!feedback) return;
  const tones = {
    success: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800',
    error: 'bg-red-50 border border-red-200 text-red-700',
    info: 'bg-sky-50 border border-sky-200 text-sky-800',
  };
  feedback.className = `text-sm rounded-xl px-4 py-3 ${tones[type] || tones.info}`;
  feedback.textContent = message;
  feedback.classList.remove('hidden');
}

function clearFeedback() {
  if (!feedback) return;
  feedback.classList.add('hidden');
  feedback.textContent = '';
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function prettyJson(value) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return '{}';
  }
}

async function cargarUsuario() {
  try {
    const {
      data: { user } = {},
    } = await supabase.auth.getUser();
    currentUserId = user?.id || null;
  } catch {
    currentUserId = null;
  }
}

function buildEstadoBadge(estado) {
  const value = String(estado || 'pendiente').toLowerCase();
  const tone = {
    pendiente: 'bg-amber-100 text-amber-700',
    aprobada: 'bg-emerald-100 text-emerald-700',
    rechazada: 'bg-red-100 text-red-700',
    cancelada: 'bg-gray-200 text-gray-700',
  };
  return `<span class="text-xs px-2 py-0.5 rounded-full ${tone[value] || tone.pendiente}">${escapeHtml(value)}</span>`;
}

function setLoadingState(isLoading) {
  loading = isLoading;
  btnRefrescar.disabled = isLoading;
  btnRefrescar.classList.toggle('opacity-60', isLoading);
  btnRefrescar.textContent = isLoading ? 'Cargando...' : 'Refrescar';
}

async function fetchComerciosByIds(ids = []) {
  const unicos = Array.from(new Set((ids || []).map((x) => Number(x)).filter((x) => Number.isFinite(x))));
  if (!unicos.length) return new Map();

  const { data, error } = await supabase
    .from('Comercios')
    .select('id, nombre, telefono, direccion, logo')
    .in('id', unicos);
  if (error) throw error;

  const map = new Map();
  (data || []).forEach((row) => map.set(Number(row.id), row));
  return map;
}

async function cargarSolicitudes(estado) {
  if (!solicitudesList) return [];
  let query = supabase
    .from('solicitudes_cambio_comercio')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(150);

  if (estado && estado !== 'all') {
    query = query.eq('estado', estado);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function cargarDisputas(estado) {
  if (!disputasList) return [];
  let query = supabase
    .from('disputas_comercio')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(150);

  if (estado && estado !== 'all') {
    query = query.eq('estado', estado);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

function renderSolicitudes(items = [], comercioMap = new Map()) {
  if (!solicitudesList) return;
  solicitudesCount.textContent = String(items.length);
  if (!items.length) {
    solicitudesList.innerHTML = '<p class="text-sm text-gray-500">No hay solicitudes para este filtro.</p>';
    return;
  }

  solicitudesList.innerHTML = items
    .map((req) => {
      const comercio = comercioMap.get(Number(req.idComercio)) || {};
      const puedeResolver = String(req.estado || '') === 'pendiente';
      return `
        <article class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p class="text-sm font-semibold text-gray-900">${escapeHtml(comercio.nombre || req.nombre_comercio || 'Comercio')}</p>
              <p class="text-xs text-gray-500">ID comercio: ${escapeHtml(req.idComercio)} · Campo: ${escapeHtml(req.campo)}</p>
            </div>
            ${buildEstadoBadge(req.estado)}
          </div>

          <div class="grid md:grid-cols-2 gap-3 mt-3">
            <div>
              <p class="text-xs font-semibold text-gray-600 mb-1">Valor actual</p>
              <pre class="text-[11px] bg-gray-50 border border-gray-200 rounded p-2">${escapeHtml(prettyJson(req.valor_actual))}</pre>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-600 mb-1">Valor solicitado</p>
              <pre class="text-[11px] bg-sky-50 border border-sky-100 rounded p-2">${escapeHtml(prettyJson(req.valor_solicitado))}</pre>
            </div>
          </div>

          <p class="text-sm text-gray-700 mt-3"><span class="font-semibold">Motivo:</span> ${escapeHtml(req.motivo || '—')}</p>
          <p class="text-xs text-gray-500 mt-1">Creada: ${escapeHtml(formatDate(req.created_at))}</p>

          ${
            puedeResolver
              ? `<div class="flex gap-2 mt-3">
                   <button data-action="aprobar-solicitud" data-id="${escapeHtml(req.id)}" class="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Aprobar</button>
                   <button data-action="rechazar-solicitud" data-id="${escapeHtml(req.id)}" class="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Rechazar</button>
                 </div>`
              : `<p class="text-xs text-gray-500 mt-2">Revisada: ${escapeHtml(formatDate(req.revisado_en))}</p>`
          }
        </article>
      `;
    })
    .join('');
}

function renderDisputas(items = [], comercioMap = new Map()) {
  if (!disputasList) return;
  disputasCount.textContent = String(items.length);
  if (!items.length) {
    disputasList.innerHTML = '<p class="text-sm text-gray-500">No hay disputas para este filtro.</p>';
    return;
  }

  disputasList.innerHTML = items
    .map((item) => {
      const comercio = comercioMap.get(Number(item.idComercio)) || {};
      const puedeResolver = String(item.estado || '') === 'pendiente';
      return `
        <article class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p class="text-sm font-semibold text-gray-900">${escapeHtml(comercio.nombre || item.nombre_comercio || 'Comercio')}</p>
              <p class="text-xs text-gray-500">ID comercio: ${escapeHtml(item.idComercio)} · Solicitante: ${escapeHtml(item.contacto_nombre || '—')}</p>
            </div>
            ${buildEstadoBadge(item.estado)}
          </div>

          <p class="text-sm text-gray-700 mt-2"><span class="font-semibold">Email:</span> ${escapeHtml(item.contacto_email || '—')}</p>
          <p class="text-sm text-gray-700"><span class="font-semibold">Teléfono:</span> ${escapeHtml(item.contacto_telefono || '—')}</p>
          <p class="text-sm text-gray-700 mt-1"><span class="font-semibold">Mensaje:</span> ${escapeHtml(item.mensaje || '—')}</p>
          <p class="text-xs text-gray-500 mt-2">Creada: ${escapeHtml(formatDate(item.created_at))}</p>

          <div class="flex flex-wrap gap-2 mt-3">
            <a href="./editarComercio.html?id=${escapeHtml(item.idComercio)}" class="px-3 py-2 text-sm rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200">
              Ver comercio
            </a>
            ${
              puedeResolver
                ? `
                  <button data-action="aprobar-disputa" data-id="${escapeHtml(item.id)}" class="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Aprobar reclamo</button>
                  <button data-action="rechazar-disputa" data-id="${escapeHtml(item.id)}" class="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Rechazar</button>
                `
                : `<span class="text-xs text-gray-500 self-center">Revisada: ${escapeHtml(formatDate(item.revisado_en))}</span>`
            }
          </div>
        </article>
      `;
    })
    .join('');
}

async function refreshData() {
  if (loading) return;
  clearFeedback();
  setLoadingState(true);
  try {
    const estado = filtroEstado?.value || 'pendiente';
    const tipo = filtroTipo?.value || 'solicitudes';
    const showSolicitudes = tipo === 'solicitudes' || tipo === 'all';
    const showDisputas = tipo === 'disputas' || tipo === 'all';

    solicitudesSection?.classList.toggle('hidden', !showSolicitudes);
    disputasSection?.classList.toggle('hidden', !showDisputas);

    const [solicitudes, disputas] = await Promise.all([
      showSolicitudes ? cargarSolicitudes(estado) : Promise.resolve([]),
      showDisputas ? cargarDisputas(estado) : Promise.resolve([]),
    ]);

    const idsComercio = [
      ...solicitudes.map((x) => x.idComercio),
      ...disputas.map((x) => x.idComercio),
    ];
    const comercioMap = await fetchComerciosByIds(idsComercio);

    renderSolicitudes(solicitudes, comercioMap);
    renderDisputas(disputas, comercioMap);
  } catch (error) {
    console.error('Error cargando moderación:', error);
    showFeedback('error', 'No se pudo cargar la moderación. Verifica permisos y tablas.');
  } finally {
    setLoadingState(false);
  }
}

async function resolverSolicitud(id, decision) {
  const nota = prompt(`Nota de revisión (${decision}):`, '') || null;
  const { error } = await supabase.rpc('fn_admin_resolver_solicitud_cambio', {
    p_solicitud_id: id,
    p_decision: decision,
    p_revisado_por: currentUserId,
    p_nota_revision: nota,
  });
  if (error) throw error;
}

async function resolverDisputa(id, decision) {
  const nota = prompt(`Nota de revisión (${decision}):`, '') || null;
  const { error } = await supabase.rpc('fn_admin_resolver_disputa_comercio', {
    p_disputa_id: id,
    p_decision: decision,
    p_revisado_por: currentUserId,
    p_nota_revision: nota,
  });
  if (error) throw error;
}

async function handleActionClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.getAttribute('data-action');
  const id = button.getAttribute('data-id');
  if (!action || !id) return;

  button.disabled = true;
  try {
    if (action === 'aprobar-solicitud') {
      await resolverSolicitud(id, 'aprobada');
      showFeedback('success', 'Solicitud aprobada y aplicada al comercio.');
    } else if (action === 'rechazar-solicitud') {
      await resolverSolicitud(id, 'rechazada');
      showFeedback('warning', 'Solicitud rechazada.');
    } else if (action === 'aprobar-disputa') {
      await resolverDisputa(id, 'aprobada');
      showFeedback('success', 'Disputa aprobada y comercio actualizado.');
    } else if (action === 'rechazar-disputa') {
      await resolverDisputa(id, 'rechazada');
      showFeedback('warning', 'Disputa rechazada.');
    }
    await refreshData();
  } catch (error) {
    console.error('Error resolviendo acción:', error);
    showFeedback('error', `No se pudo completar la acción: ${error?.message || 'error desconocido'}`);
  } finally {
    button.disabled = false;
  }
}

function wireEvents() {
  btnRefrescar?.addEventListener('click', refreshData);
  filtroEstado?.addEventListener('change', refreshData);
  filtroTipo?.addEventListener('change', refreshData);
  solicitudesList?.addEventListener('click', handleActionClick);
  disputasList?.addEventListener('click', handleActionClick);
}

async function init() {
  await cargarUsuario();
  wireEvents();
  await refreshData();
}

init();
