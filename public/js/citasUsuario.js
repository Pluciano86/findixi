import { supabase } from '../shared/supabaseClient.js';
import { getPublicBase } from '../shared/utils.js';

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

const TIMELINE_STEPS = [
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'confirmada', label: 'Confirmada' },
  { key: 'completada', label: 'Completada' },
  { key: 'cancelada', label: 'Cancelada' },
];

let citasAll = [];
let activeTab = 'activas';
const DEFAULT_COMERCIO_LOGO = getPublicBase('findixi/iconoPerfil.png');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveComercioLogoUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_COMERCIO_LOGO;
  if (/^https?:\/\//i.test(raw)) return raw;
  return getPublicBase(`galeriacomercios/${raw.replace(/^\/+/, '')}`);
}

function resolveStaffTitle(staff = {}) {
  const candidates = [
    staff?.titulo,
    staff?.profesion,
    staff?.cargo,
    staff?.rol,
    staff?.especialidad,
  ];
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text) return text;
  }
  return '';
}

function normalizeStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return 'pendiente';
  if (raw.includes('cancel') || raw.includes('rechaz')) return raw.includes('rechaz') ? 'rechazada' : 'cancelada';
  if (raw.includes('complete') || raw.includes('complet') || raw.includes('closed') || raw.includes('done')) return 'completada';
  if (raw.includes('confirm') || raw.includes('accepted') || raw.includes('acept')) return 'confirmada';
  if (raw.includes('pending') || raw.includes('pend')) return 'pendiente';
  return raw;
}

function statusBadgeClass(status) {
  const s = normalizeStatus(status);
  if (s === 'pendiente') return 'border border-blue-200 bg-blue-50 text-blue-800';
  if (s === 'confirmada') return 'border border-emerald-200 bg-emerald-50 text-emerald-800';
  if (s === 'completada') return 'border border-amber-300 bg-amber-50 text-amber-800';
  if (s === 'cancelada' || s === 'rechazada') return 'border border-red-200 bg-red-50 text-red-700';
  return 'border border-gray-200 bg-gray-50 text-gray-700';
}

function statusBadgeIcon(status) {
  const s = normalizeStatus(status);
  if (s === 'pendiente') return 'fa-hourglass-half';
  if (s === 'confirmada') return 'fa-circle-check';
  if (s === 'completada') return 'fa-square-check';
  if (s === 'cancelada' || s === 'rechazada') return 'fa-circle-xmark';
  return 'fa-circle-info';
}

function statusHeaderAccent(status) {
  const s = normalizeStatus(status);
  if (s === 'pendiente') return 'bg-gradient-to-r from-blue-400 to-sky-500';
  if (s === 'confirmada') return 'bg-gradient-to-r from-emerald-400 to-teal-500';
  if (s === 'completada') return 'bg-gradient-to-r from-amber-300 to-amber-500';
  if (s === 'cancelada' || s === 'rechazada') return 'bg-gradient-to-r from-rose-400 to-red-500';
  return 'bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500';
}

function formatDate(dateRaw) {
  const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  const formatted = date.toLocaleDateString('es-PR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatTime(value) {
  return String(value || '').slice(0, 5) || '--:--';
}

function formatTime12h(value) {
  const raw = String(value || '').trim();
  if (!raw) return '--:--';
  const hhmm = raw.slice(0, 5);
  const [h, m] = hhmm.split(':').map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function parseServicioMeta(servicioRaw) {
  const raw = String(servicioRaw || '').trim();
  if (!raw) return { titulo: 'Servicio sin especificar', meta: [] };

  const match = raw.match(/^(.*)\((.*)\)\s*$/);
  if (!match) return { titulo: raw, meta: [] };

  const titulo = String(match[1] || '').trim() || raw;
  const metaRaw = String(match[2] || '').trim();
  const meta = metaRaw
    .split(/[·•|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  return { titulo, meta };
}

function getServicioTiempoPrecio(servicioInfo = {}) {
  const meta = Array.isArray(servicioInfo.meta) ? servicioInfo.meta : [];
  let tiempo = '';
  let precio = '';

  for (const item of meta) {
    const value = String(item || '').trim();
    if (!value) continue;
    const lower = value.toLowerCase();
    if (!tiempo && (lower.includes('min') || lower.includes('hora') || lower.includes('hr'))) {
      tiempo = value;
      continue;
    }
    if (!precio && (value.includes('$') || lower.includes('usd'))) {
      precio = value;
      continue;
    }
  }

  return {
    tiempo: tiempo || '--',
    precio: precio || '--',
  };
}

function getTimelineStepState(status, stepKey) {
  const s = normalizeStatus(status);
  if (s === 'cancelada' || s === 'rechazada') {
    if (stepKey === 'cancelada') return 'current-cancel';
    if (stepKey === 'pendiente') return 'done';
    return 'todo';
  }

  const rank = { pendiente: 0, confirmada: 1, completada: 2 };
  const currentRank = rank[s] ?? 0;
  const stepRank = rank[stepKey];
  if (stepRank == null) return 'todo';
  if (stepRank < currentRank) return 'done';
  if (stepRank === currentRank) return 'current';
  return 'todo';
}

function timelineStepClasses(stepState) {
  if (stepState === 'done') {
    return {
      dot: 'bg-emerald-500 border-emerald-500 text-white',
      label: 'text-emerald-700',
    };
  }
  if (stepState === 'current') {
    return {
      dot: 'bg-sky-500 border-sky-500 text-white ring-4 ring-sky-100',
      label: 'text-sky-700 font-semibold',
    };
  }
  if (stepState === 'current-cancel') {
    return {
      dot: 'bg-red-500 border-red-500 text-white ring-4 ring-red-100',
      label: 'text-red-700 font-semibold',
    };
  }
  return {
    dot: 'bg-white border-slate-300 text-slate-300',
    label: 'text-slate-400',
  };
}

function timelineConnectorClass(leftState) {
  return leftState === 'done' || leftState === 'current'
    ? 'bg-emerald-300'
    : 'bg-slate-200';
}

function renderTimelineHtml(status) {
  const nodes = TIMELINE_STEPS.map((step) => {
    const stepState = getTimelineStepState(status, step.key);
    const stepClasses = timelineStepClasses(stepState);
    const icon = stepState === 'done' ? 'fa-check' : stepState === 'current-cancel' ? 'fa-xmark' : 'fa-circle';
    return {
      key: step.key,
      label: step.label,
      stepState,
      dotClass: stepClasses.dot,
      labelClass: stepClasses.label,
      icon,
    };
  });

  let html = '<div class="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3"><p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-2">Estado de la cita</p>';
  html += '<div class="grid grid-cols-4 gap-1 items-start">';
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    html += `
      <div class="flex flex-col items-center text-center">
        <div class="w-full flex items-center">
          ${i > 0 ? `<span class="h-[2px] flex-1 ${timelineConnectorClass(nodes[i - 1].stepState)}"></span>` : '<span class="flex-1"></span>'}
          <span class="w-6 h-6 rounded-full border inline-flex items-center justify-center text-[10px] ${node.dotClass}">
            <i class="fa-solid ${node.icon}"></i>
          </span>
          ${i < nodes.length - 1 ? `<span class="h-[2px] flex-1 ${timelineConnectorClass(node.stepState)}"></span>` : '<span class="flex-1"></span>'}
        </div>
        <span class="mt-1 text-[11px] leading-tight ${node.labelClass}">${escapeHtml(node.label)}</span>
      </div>
    `;
  }
  html += '</div></div>';
  return html;
}

function getNextStepCopy(status) {
  const s = normalizeStatus(status);
  if (s === 'confirmada') {
    return {
      title: 'Próximo paso',
      body: 'Tu cita ya está confirmada. Preséntate a tiempo y llega 10 minutos antes.',
      tone: 'green',
    };
  }
  if (s === 'completada') {
    return {
      title: 'Siguiente recomendación',
      body: 'Esta cita ya fue completada. Puedes reservar otra cita cuando quieras.',
      tone: 'orange',
    };
  }
  if (s === 'cancelada' || s === 'rechazada') {
    return {
      title: 'Próximo paso',
      body: 'Esta cita fue cancelada. Si deseas, agenda una nueva fecha.',
      tone: 'red',
    };
  }
  return {
    title: 'Próximo paso',
    body: 'Tu cita está pendiente de confirmación por el comercio. Te notificaremos cuando cambie.',
    tone: 'blue',
  };
}

function nextStepClasses(tone) {
  if (tone === 'blue') return 'border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 text-blue-900';
  if (tone === 'green') return 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-900';
  if (tone === 'orange') return 'border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 text-amber-900';
  if (tone === 'red') return 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50 text-red-900';
  return 'border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 text-blue-900';
}

function toDateTimeLocal(dateRaw, timeRaw) {
  const date = String(dateRaw || '').trim();
  const time = String(timeRaw || '').trim();
  if (!date || !time) return null;
  const hhmm = time.slice(0, 5);
  const parsed = new Date(`${date}T${hhmm}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function shouldAutoComplete(cita, now = new Date()) {
  if (normalizeStatus(cita?.estado) !== 'confirmada') return false;
  const endAt = toDateTimeLocal(cita?.fecha_cita, cita?.hora_fin || cita?.hora_inicio);
  if (!endAt) return false;
  return endAt.getTime() <= now.getTime();
}

async function autoCompleteDueCitas(rows = [], userId = '') {
  const now = new Date();
  const dueIds = [];

  const normalizedRows = rows.map((row) => {
    if (shouldAutoComplete(row, now)) {
      dueIds.push(Number(row.id));
      return { ...row, estado: 'completada' };
    }
    return row;
  });

  if (dueIds.length && userId) {
    const { error } = await supabase
      .from('ComercioCitas')
      .update({ estado: 'completada' })
      .in('id', dueIds)
      .eq('id_usuario', userId);
    if (error) {
      console.warn('No se pudieron auto-completar algunas citas:', error);
    }
  }

  return normalizedRows;
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

  for (const [index, cita] of visible.entries()) {
    const status = normalizeStatus(cita.estado);
    const statusLabel = STATUS_LABELS[status] || status;
    const comercioNombre = cita.comercio_nombre || (cita.id_comercio ? `Comercio ${cita.id_comercio}` : 'Comercio');
    const comercioMunicipio = String(cita.comercio_municipio || '').trim();
    const staffNombre = cita.staff_nombre || (cita.id_staff ? `Profesional ${cita.id_staff}` : 'Profesional');
    const staffTitle = String(cita.staff_titulo || '').trim();
    const comercioLogoUrl = resolveComercioLogoUrl(cita.comercio_logo);
    const servicio = String(cita.servicio || '').trim() || 'Servicio sin especificar';
    const servicioInfo = parseServicioMeta(servicio);
    const servicioMetrics = getServicioTiempoPrecio(servicioInfo);
    const fecha = formatDate(cita.fecha_cita);
    const hora = `${formatTime12h(cita.hora_inicio)} - ${formatTime12h(cita.hora_fin)}`;
    const notas = String(cita.notas || '').trim();
    const nextStep = getNextStepCopy(status);
    const nextStepTone = nextStepClasses(nextStep.tone);

    const detailId = `citaDetail_${Number(cita.id) || index}`;

    const card = document.createElement('article');
    card.className = 'cita-card relative overflow-hidden bg-white rounded-[26px] p-4';
    card.innerHTML = `
      <div class="absolute inset-x-0 top-0 h-1 ${statusHeaderAccent(status)}"></div>
      <button
        type="button"
        class="cita-accordion-toggle w-full text-left pt-1"
        aria-expanded="false"
        aria-controls="${detailId}"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm shadow-sm">
                <i class="fa-solid fa-calendar-check"></i>
              </span>
              <p class="text-[22px] leading-tight font-semibold text-sky-800 truncate">${escapeHtml(servicioInfo.titulo)}</p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2 shrink-0">
            <span class="inline-flex shrink-0 items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-semibold ${statusBadgeClass(status)}">
              <i class="fa-solid ${statusBadgeIcon(status)}"></i>
              ${escapeHtml(statusLabel)}
            </span>
            <span class="cita-accordion-chevron inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-transform duration-200">
              <i class="fa-solid fa-chevron-down text-xs"></i>
            </span>
          </div>
        </div>
        <div class="mt-2 flex flex-col items-center text-center">
          <div class="flex items-center justify-center gap-2 max-w-full">
            <img
              src="${escapeHtml(comercioLogoUrl)}"
              alt="Logo ${escapeHtml(comercioNombre)}"
              class="h-11 w-11 rounded-full border border-slate-200 bg-white object-cover shrink-0"
              loading="lazy"
              onerror="this.onerror=null;this.src='${escapeHtml(DEFAULT_COMERCIO_LOGO)}';"
            />
            <p class="text-xl font-semibold text-slate-800 leading-tight truncate">${escapeHtml(comercioNombre)}</p>
          </div>
          ${
            comercioMunicipio
              ? `<p class="mt-0.5 text-sm font-medium text-slate-500 leading-tight">${escapeHtml(comercioMunicipio)}</p>`
              : ''
          }
        </div>
        <div class="mt-2 grid w-full grid-cols-2 gap-2 text-sm text-slate-600">
          <span class="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
            <i class="fa-regular fa-calendar text-slate-500"></i>
            ${escapeHtml(fecha)}
          </span>
          <span class="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
            <i class="fa-regular fa-clock text-slate-500"></i>
            ${escapeHtml(hora)}
          </span>
        </div>
      </button>

      <div id="${detailId}" class="cita-accordion-detail hidden">
        <div class="mt-3 grid grid-cols-2 gap-2">
          <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
            <p class="text-[11px] uppercase tracking-wide text-slate-500">Tiempo</p>
            <p class="text-sm font-semibold text-slate-800">Tiempo: ${escapeHtml(servicioMetrics.tiempo)}</p>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
            <p class="text-[11px] uppercase tracking-wide text-slate-500">Precio</p>
            <p class="text-sm font-semibold text-slate-800">Precio: ${escapeHtml(servicioMetrics.precio)}</p>
          </div>
        </div>
        <div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
          <p class="text-lg font-semibold text-slate-800 truncate">${escapeHtml(comercioNombre)}</p>
          <div class="mt-2 border-t border-slate-200 pt-2">
            <p class="text-[11px] font-medium text-slate-500 uppercase tracking-[0.08em]">Cita con:</p>
            <p class="text-base font-semibold text-slate-800 truncate">${escapeHtml(staffNombre)}</p>
            ${
              staffTitle
                ? `<p class="mt-0.5 text-sm font-medium text-slate-500 truncate">${escapeHtml(staffTitle)}</p>`
                : ''
            }
          </div>
        </div>
        ${renderTimelineHtml(status)}
        <div class="mt-3 rounded-2xl border px-3 py-3 ${nextStepTone}">
          <p class="text-[11px] font-semibold uppercase tracking-[0.08em]">${escapeHtml(nextStep.title)}</p>
          <p class="mt-1 text-sm font-medium leading-relaxed">${escapeHtml(nextStep.body)}</p>
        </div>
        ${
          notas
            ? `<div class="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                 <p class="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Notas</p>
                 <p class="mt-1 text-sm text-slate-700">${escapeHtml(notas)}</p>
               </div>`
            : ''
        }
      </div>
    `;

    const toggle = card.querySelector('.cita-accordion-toggle');
    const detail = card.querySelector('.cita-accordion-detail');
    const chevron = card.querySelector('.cita-accordion-chevron');
    const openOnStart = index === 0;
    if (detail && toggle) {
      detail.classList.toggle('hidden', !openOnStart);
      toggle.setAttribute('aria-expanded', openOnStart ? 'true' : 'false');
      chevron?.classList.toggle('rotate-180', openOnStart);

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        detail.classList.toggle('hidden', expanded);
        chevron?.classList.toggle('rotate-180', !expanded);
      });
    }

    citasContainer.appendChild(card);
  }
}

async function enrichNames(rows = []) {
  const comercioIds = [...new Set(rows.map((row) => Number(row.id_comercio)).filter((id) => Number.isFinite(id) && id > 0))];
  const staffIds = [...new Set(rows.map((row) => Number(row.id_staff)).filter((id) => Number.isFinite(id) && id > 0))];
  const comercioMap = new Map();
  const staffMap = new Map();

  if (comercioIds.length) {
    let comercioRows = null;
    const comercioSelectAttempts = [
      'id,nombre,logo,municipio,pueblo',
      'id,nombre,logo,municipio',
      'id,nombre,logo,pueblo',
      'id,nombre,logo',
    ];

    for (const selectClause of comercioSelectAttempts) {
      const { data, error } = await supabase
        .from('Comercios')
        .select(selectClause)
        .in('id', comercioIds);
      if (!error) {
        comercioRows = data || [];
        break;
      }
    }

    for (const row of comercioRows || []) {
      comercioMap.set(Number(row.id), {
        nombre: row.nombre || '',
        logo: row.logo || '',
        municipio: row.municipio || row.pueblo || '',
      });
    }
  }

  if (staffIds.length) {
    let staffRows = null;
    const staffSelectAttempts = [
      'id,nombre,profesion,titulo,cargo,rol,especialidad',
      'id,nombre,profesion,titulo,cargo,rol',
      'id,nombre,profesion,titulo,cargo',
      'id,nombre,profesion,titulo',
      'id,nombre,profesion',
      'id,nombre,titulo',
      'id,nombre,cargo',
      'id,nombre,rol',
      'id,nombre,especialidad',
      'id,nombre',
    ];

    for (const selectClause of staffSelectAttempts) {
      const { data, error } = await supabase
        .from('ComercioStaff')
        .select(selectClause)
        .in('id', staffIds);
      if (!error) {
        staffRows = data || [];
        break;
      }
    }

    for (const row of staffRows || []) {
      staffMap.set(Number(row.id), {
        nombre: row.nombre || '',
        titulo: resolveStaffTitle(row),
      });
    }
  }

  return rows.map((row) => ({
    ...row,
    comercio_nombre: comercioMap.get(Number(row.id_comercio))?.nombre || '',
    comercio_logo: comercioMap.get(Number(row.id_comercio))?.logo || '',
    comercio_municipio: comercioMap.get(Number(row.id_comercio))?.municipio || '',
    staff_nombre: staffMap.get(Number(row.id_staff))?.nombre || '',
    staff_titulo: staffMap.get(Number(row.id_staff))?.titulo || '',
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
    const rowsWithStatus = await autoCompleteDueCitas(rows, user.id);
    citasAll = await enrichNames(rowsWithStatus);
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
