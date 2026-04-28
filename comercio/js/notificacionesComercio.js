import { supabase } from '../shared/supabaseClient.js';

const filtroComercio = document.getElementById('filtroComercio');
const btnRecargarNotificaciones = document.getElementById('btnRecargarNotificaciones');
const btnCargarMasNotificaciones = document.getElementById('btnCargarMasNotificaciones');
const notificacionesLista = document.getElementById('notificacionesLista');
const notificacionesVacio = document.getElementById('notificacionesVacio');
const notificacionesResumen = document.getElementById('notificacionesResumen');

const state = {
  user: null,
  comercios: [],
  comercioIds: [],
  pageSize: 30,
  offset: 0,
  total: 0,
  loading: false,
  hasMore: false,
};
let notificacionesRealtimeChannels = [];
let notificacionesRealtimeTimer = null;

const COMERCIOS_SELECT_BASE =
  'id, nombre, logo, plan_id, plan_nivel, plan_nombre, permite_menu, permite_especiales, permite_ordenes, estado_propiedad, estado_verificacion, propietario_verificado, logo_aprobado, portada_aprobada';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getIdComercio(row = {}) {
  return toNumber(row.idComercio ?? row.idcomercio ?? row.id_comercio ?? row.comercio_id ?? null);
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

function parsePayload(rawPayload) {
  if (!rawPayload) return {};
  if (typeof rawPayload === 'object') return rawPayload;
  if (typeof rawPayload !== 'string') return {};
  try {
    const parsed = JSON.parse(rawPayload);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function formatTipo(tipo = '') {
  const normalized = String(tipo || '').toLowerCase();
  if (normalized === 'notificacion_cita') return 'Cita';
  if (normalized === 'notificacion_orden') return 'Orden';
  if (normalized === 'notificacion_sistema') return 'Sistema';
  if (normalized.startsWith('invitacion')) return 'Invitacion';
  return 'Notificacion';
}

function formatFecha(fechaRaw) {
  if (!fechaRaw) return '';
  const fecha = new Date(fechaRaw);
  if (Number.isNaN(fecha.getTime())) return '';
  return fecha.toLocaleString('es-PR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMensajeTexto(mensaje = {}) {
  const payload = parsePayload(mensaje.payload);
  const payloadMessage = String(payload?.message || payload?.mensaje || '').trim();
  const directMessage = String(mensaje?.message || '').trim();
  if (payloadMessage) return payloadMessage;
  if (directMessage) return directMessage;
  return `Nueva notificacion de ${formatTipo(mensaje?.tipo)}.`;
}

function getMensajeDestino(mensaje = {}) {
  const payload = parsePayload(mensaje.payload);
  const comercioId = getIdComercio(mensaje);
  const actionPath = String(payload?.action_path || payload?.target_path || '').trim();
  const actionUrl = String(payload?.action_url || payload?.url || '').trim();
  if (actionPath) {
    if (actionPath.startsWith('http://') || actionPath.startsWith('https://')) return actionPath;
    if (actionPath.startsWith('/')) return actionPath;
    return actionPath.startsWith('./') ? actionPath : `./${actionPath}`;
  }
  if (actionUrl) return actionUrl;

  const tipo = String(mensaje?.tipo || '').toLowerCase();
  if (tipo === 'notificacion_cita' && Number.isFinite(comercioId)) return `./staff.html?id=${comercioId}`;
  if (tipo === 'notificacion_orden' && Number.isFinite(comercioId)) return `./ordenesPickup.html?id=${comercioId}`;
  if (Number.isFinite(comercioId)) return `./editarPerfilComercio.html?id=${comercioId}`;
  return '';
}

async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = './login.html';
    return null;
  }
  return data.user;
}

async function fetchUsuarioComerciosByUser(userId) {
  const attempts = [
    { selectCol: 'idComercio', filterCol: 'idUsuario' },
    { selectCol: 'idcomercio', filterCol: 'idUsuario' },
    { selectCol: 'idComercio', filterCol: 'idusuario' },
    { selectCol: 'idcomercio', filterCol: 'idusuario' },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from('UsuarioComercios')
      .select(`${attempt.selectCol}, rol`)
      .eq(attempt.filterCol, userId);

    if (!error) {
      const rows = Array.isArray(data) ? data : [];
      return rows
        .map((row) => ({
          idComercio: getIdComercio(row),
          rol: row?.rol || '',
        }))
        .filter((row) => Number.isFinite(row.idComercio));
    }

    lastError = error;
    if (!isMissingColumnError(error)) break;
  }

  throw lastError || new Error('No se pudieron cargar asignaciones.');
}

async function fetchComerciosByIds(ids = []) {
  if (!ids.length) return { data: [], error: null };

  const attempts = [
    `${COMERCIOS_SELECT_BASE}, categoria, idCategoria, tipo_perfil, tiendaFisica, tiendaOnline`,
    `${COMERCIOS_SELECT_BASE}, categoria, idCategoria, tipo_perfil`,
    `${COMERCIOS_SELECT_BASE}, categoria, idCategoria`,
    `${COMERCIOS_SELECT_BASE}, categoria`,
    COMERCIOS_SELECT_BASE,
  ];

  let lastError = null;
  for (const selectExpr of attempts) {
    const { data, error } = await supabase.from('Comercios').select(selectExpr).in('id', ids);
    if (!error) return { data: Array.isArray(data) ? data : [], error: null };
    lastError = error;
    if (!isMissingColumnError(error)) break;
  }

  return { data: [], error: lastError };
}

async function cargarComerciosUsuario(user) {
  const relaciones = await fetchUsuarioComerciosByUser(user.id).catch(() => []);
  const idsRelacionados = new Set(relaciones.map((r) => getIdComercio(r)).filter(Boolean));

  const { data: comerciosOwner } = await supabase
    .from('Comercios')
    .select('id')
    .eq('owner_user_id', user.id);

  (Array.isArray(comerciosOwner) ? comerciosOwner : []).forEach((c) => {
    if (c?.id) idsRelacionados.add(c.id);
  });

  const ids = [...idsRelacionados];
  if (!ids.length) return [];
  const { data: comercios, error } = await fetchComerciosByIds(ids);
  if (error) return [];
  return comercios || [];
}

function renderFiltroComercios(comercios = []) {
  if (!filtroComercio) return;
  filtroComercio.innerHTML = '<option value="all">Todos los comercios</option>';

  comercios
    .slice()
    .sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'))
    .forEach((comercio) => {
      const option = document.createElement('option');
      option.value = String(comercio.id);
      option.textContent = comercio.nombre || `Comercio ${comercio.id}`;
      filtroComercio.appendChild(option);
    });
}

function setResumen() {
  if (!notificacionesResumen) return;
  const loaded = notificacionesLista?.children?.length || 0;
  if (!state.total) {
    notificacionesResumen.textContent = 'Sin notificaciones registradas.';
    return;
  }
  notificacionesResumen.textContent = `${loaded} de ${state.total} notificaciones`;
}

function clearLista() {
  if (!notificacionesLista) return;
  notificacionesLista.innerHTML = '';
  notificacionesVacio?.classList.add('hidden');
}

function updateEmptyAndMore() {
  const hasItems = Boolean(notificacionesLista && notificacionesLista.children.length);
  notificacionesVacio?.classList.toggle('hidden', hasItems);
  btnCargarMasNotificaciones?.classList.toggle('hidden', !state.hasMore);
  setResumen();
}

function clearNotificacionesRealtime() {
  if (notificacionesRealtimeTimer) {
    clearTimeout(notificacionesRealtimeTimer);
    notificacionesRealtimeTimer = null;
  }
  notificacionesRealtimeChannels.forEach((channel) => {
    try {
      supabase.removeChannel(channel);
    } catch (error) {
      console.warn('No se pudo limpiar canal realtime de notificaciones:', error?.message || error);
    }
  });
  notificacionesRealtimeChannels = [];
}

function scheduleNotificacionesRealtimeRefresh() {
  if (notificacionesRealtimeTimer) clearTimeout(notificacionesRealtimeTimer);
  notificacionesRealtimeTimer = setTimeout(async () => {
    if (state.loading) {
      scheduleNotificacionesRealtimeRefresh();
      return;
    }
    await cargarNotificaciones({ reset: true });
  }, 300);
}

function setupNotificacionesRealtime() {
  clearNotificacionesRealtime();
  const ids = [...new Set((state.comercioIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return;

  const channels = ids.map((id) =>
    supabase
      .channel(`notificaciones-comercio-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'Mensajes',
        filter: `id_comercio=eq.${id}`,
      }, () => {
        scheduleNotificacionesRealtimeRefresh();
      })
      .subscribe()
  );
  notificacionesRealtimeChannels = channels;
}

async function eliminarNotificacion(id) {
  const notifId = Number(id);
  if (!Number.isFinite(notifId)) return false;
  const { error } = await supabase.from('Mensajes').delete().eq('id', notifId);
  if (error) {
    alert('No se pudo eliminar la notificacion.');
    return false;
  }
  return true;
}

function renderNotificacionItem(mensaje = {}) {
  const comercioMap = new Map(state.comercios.map((c) => [Number(c.id), c]));
  const comercioId = getIdComercio(mensaje);
  const comercioNombre =
    comercioMap.get(comercioId)?.nombre ||
    (Number.isFinite(comercioId) ? `Comercio ${comercioId}` : 'Comercio');
  const texto = getMensajeTexto(mensaje);
  const tipo = formatTipo(mensaje?.tipo);
  const fecha = formatFecha(mensaje?.created_at);
  const destino = getMensajeDestino(mensaje);

  const item = document.createElement('article');
  item.className = 'rounded-xl border border-slate-200 p-3 sm:p-4 bg-slate-50 space-y-3';
  item.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h4 class="text-sm font-semibold text-slate-900 truncate">${comercioNombre}</h4>
        <p class="text-xs text-slate-500">${tipo}${fecha ? ` · ${fecha}` : ''}</p>
      </div>
    </div>
    <p class="text-sm text-slate-700"></p>
    <div class="flex items-center justify-end gap-2"></div>
  `;

  const textNode = item.querySelector('p.text-sm');
  if (textNode) textNode.textContent = texto;

  const actions = item.querySelector('div.flex.items-center.justify-end.gap-2');
  if (actions) {
    const btnIr = document.createElement('button');
    btnIr.type = 'button';
    btnIr.className = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed';
    btnIr.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square text-xs"></i> Ir';
    if (!destino) btnIr.disabled = true;
    btnIr.addEventListener('click', () => {
      if (!destino) return;
      window.location.href = destino;
    });

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm font-semibold';
    btnEliminar.innerHTML = '<i class="fa-solid fa-trash text-xs"></i> Eliminar';
    btnEliminar.addEventListener('click', async () => {
      const ok = await eliminarNotificacion(mensaje.id);
      if (!ok) return;
      state.offset = 0;
      clearLista();
      await cargarNotificaciones({ reset: true });
    });

    actions.appendChild(btnIr);
    actions.appendChild(btnEliminar);
  }

  return item;
}

async function fetchNotificaciones({ limit, offset }) {
  let query = supabase
    .from('Mensajes')
    .select('*', { count: 'exact' })
    .in('id_comercio', state.comercioIds)
    .not('tipo', 'ilike', 'invitacion%')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const filtro = String(filtroComercio?.value || 'all');
  if (filtro !== 'all') {
    const id = Number(filtro);
    if (Number.isFinite(id)) query = query.eq('id_comercio', id);
  }

  const { data, error, count } = await query;
  if (error) {
    console.warn('No se pudieron cargar notificaciones:', error.message || error);
    return { rows: [], total: 0 };
  }

  return {
    rows: Array.isArray(data) ? data : [],
    total: Number(count || 0),
  };
}

async function cargarNotificaciones({ reset = false } = {}) {
  if (state.loading) return;
  state.loading = true;

  if (reset) {
    state.offset = 0;
    state.total = 0;
    state.hasMore = false;
    clearLista();
  }

  const { rows, total } = await fetchNotificaciones({
    limit: state.pageSize,
    offset: state.offset,
  });

  state.total = total;
  rows.forEach((row) => {
    const node = renderNotificacionItem(row);
    notificacionesLista?.appendChild(node);
  });

  state.offset += rows.length;
  state.hasMore = state.offset < state.total;
  state.loading = false;
  updateEmptyAndMore();
}

async function init() {
  const user = await getUser();
  if (!user) return;
  state.user = user;

  const comercios = await cargarComerciosUsuario(user);
  state.comercios = comercios;
  state.comercioIds = comercios.map((c) => Number(c.id)).filter((id) => Number.isFinite(id));
  renderFiltroComercios(comercios);
  setupNotificacionesRealtime();

  if (!state.comercioIds.length) {
    clearLista();
    state.total = 0;
    state.hasMore = false;
    updateEmptyAndMore();
    return;
  }

  await cargarNotificaciones({ reset: true });
}

filtroComercio?.addEventListener('change', async () => {
  await cargarNotificaciones({ reset: true });
});

btnRecargarNotificaciones?.addEventListener('click', async () => {
  await cargarNotificaciones({ reset: true });
});

btnCargarMasNotificaciones?.addEventListener('click', async () => {
  await cargarNotificaciones();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  }, { once: true });
} else {
  void init();
}

window.addEventListener('beforeunload', () => {
  clearNotificacionesRealtime();
});
