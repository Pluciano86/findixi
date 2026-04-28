import { supabase } from '../shared/supabaseClient.js';

const tabActivas = document.getElementById('tabCitasActivas');
const tabPasadas = document.getElementById('tabCitasPasadas');
const citasContainer = document.getElementById('citasContainer');
const citasEmpty = document.getElementById('citasEmpty');
const citasLoading = document.getElementById('citasLoading');
const btnRefreshCitas = document.getElementById('btnRefreshCitas');

const STATUS_ACTIVE = new Set(['pendiente', 'confirmada']);
const STATUS_PAST = new Set(['cancelada', 'rechazada', 'completada']);

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  rechazada: 'Rechazada',
};

let citasAll = [];
let activeTab = 'activas';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return 'pendiente';
  return raw;
}

function statusBadgeClass(status) {
  const s = normalizeStatus(status);
  if (s === 'pendiente') return 'bg-amber-100 text-amber-800';
  if (s === 'confirmada') return 'bg-sky-100 text-sky-800';
  if (s === 'completada') return 'bg-emerald-100 text-emerald-800';
  if (s === 'cancelada' || s === 'rechazada') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

function formatDate(dateRaw) {
  const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('es-PR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(value) {
  return String(value || '').slice(0, 5) || '--:--';
}

function setLoading(isLoading) {
  if (citasLoading) citasLoading.classList.toggle('hidden', !isLoading);
}

function setEmpty(isEmpty) {
  if (citasEmpty) citasEmpty.classList.toggle('hidden', !isEmpty);
}

function setActiveTabStyles() {
  const activeClasses = 'bg-white text-slate-900 border-slate-200 shadow-sm';
  const inactiveClasses = 'bg-transparent text-gray-500 border-transparent';

  if (tabActivas) {
    tabActivas.className = `tab-btn flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${activeTab === 'activas' ? activeClasses : inactiveClasses}`;
  }
  if (tabPasadas) {
    tabPasadas.className = `tab-btn flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition ${activeTab === 'pasadas' ? activeClasses : inactiveClasses}`;
  }
}

function filterByActiveTab() {
  if (activeTab === 'pasadas') {
    return citasAll.filter((cita) => STATUS_PAST.has(normalizeStatus(cita.estado)));
  }
  return citasAll.filter((cita) => {
    const s = normalizeStatus(cita.estado);
    if (STATUS_ACTIVE.has(s)) return true;
    return !STATUS_PAST.has(s);
  });
}

function renderCitas() {
  if (!citasContainer) return;
  const visible = filterByActiveTab();

  citasContainer.innerHTML = '';
  setEmpty(!visible.length);
  if (!visible.length) return;

  for (const cita of visible) {
    const status = normalizeStatus(cita.estado);
    const statusLabel = STATUS_LABELS[status] || status;
    const comercioNombre = cita.comercio_nombre || (cita.id_comercio ? `Comercio ${cita.id_comercio}` : 'Comercio');
    const staffNombre = cita.staff_nombre || (cita.id_staff ? `Profesional ${cita.id_staff}` : 'Profesional');
    const servicio = String(cita.servicio || '').trim() || 'Servicio sin especificar';
    const fecha = formatDate(cita.fecha_cita);
    const hora = `${formatTime(cita.hora_inicio)} - ${formatTime(cita.hora_fin)}`;
    const notas = String(cita.notas || '').trim();

    const card = document.createElement('article');
    card.className = 'cita-card bg-white rounded-2xl p-4';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-base font-semibold text-slate-800">${escapeHtml(servicio)}</p>
          <p class="text-sm text-slate-600">${escapeHtml(comercioNombre)}</p>
          <p class="text-sm text-slate-500">${escapeHtml(staffNombre)}</p>
        </div>
        <span class="text-xs px-2 py-1 rounded-full ${statusBadgeClass(status)}">${escapeHtml(statusLabel)}</span>
      </div>
      <div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p class="text-sm font-medium text-slate-700">${escapeHtml(fecha)}</p>
        <p class="text-sm text-slate-600">${escapeHtml(hora)}</p>
      </div>
      ${notas ? `<p class="mt-3 text-sm text-slate-600"><span class="font-medium text-slate-700">Notas:</span> ${escapeHtml(notas)}</p>` : ''}
    `;
    citasContainer.appendChild(card);
  }
}

async function enrichNames(rows = []) {
  const comercioIds = [...new Set(rows.map((row) => Number(row.id_comercio)).filter((id) => Number.isFinite(id) && id > 0))];
  const staffIds = [...new Set(rows.map((row) => Number(row.id_staff)).filter((id) => Number.isFinite(id) && id > 0))];
  const comercioMap = new Map();
  const staffMap = new Map();

  if (comercioIds.length) {
    const { data } = await supabase
      .from('Comercios')
      .select('id,nombre')
      .in('id', comercioIds);
    for (const row of data || []) {
      comercioMap.set(Number(row.id), row.nombre || '');
    }
  }

  if (staffIds.length) {
    const { data } = await supabase
      .from('ComercioStaff')
      .select('id,nombre')
      .in('id', staffIds);
    for (const row of data || []) {
      staffMap.set(Number(row.id), row.nombre || '');
    }
  }

  return rows.map((row) => ({
    ...row,
    comercio_nombre: comercioMap.get(Number(row.id_comercio)) || '',
    staff_nombre: staffMap.get(Number(row.id_staff)) || '',
  }));
}

async function cargarCitas() {
  setLoading(true);
  try {
    const { data: userResp, error: userErr } = await supabase.auth.getUser();
    const user = userResp?.user || null;
    if (userErr || !user) {
      window.location.href = './logearse.html';
      return;
    }

    const { data, error } = await supabase
      .from('ComercioCitas')
      .select('id,id_comercio,id_staff,servicio,notas,fecha_cita,hora_inicio,hora_fin,estado,created_at')
      .eq('id_usuario', user.id)
      .order('fecha_cita', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error cargando citas de usuario:', error);
      citasAll = [];
      renderCitas();
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    citasAll = await enrichNames(rows);
    renderCitas();
  } finally {
    setLoading(false);
  }
}

tabActivas?.addEventListener('click', () => {
  activeTab = 'activas';
  setActiveTabStyles();
  renderCitas();
});

tabPasadas?.addEventListener('click', () => {
  activeTab = 'pasadas';
  setActiveTabStyles();
  renderCitas();
});

btnRefreshCitas?.addEventListener('click', async () => {
  await cargarCitas();
});

setActiveTabStyles();
void cargarCitas();
