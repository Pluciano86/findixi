import { supabase } from '../shared/supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const idComercio = Number(params.get('id') || 0);

const subtitleComercio = document.getElementById('subtitleComercio');
const btnBackPerfil = document.getElementById('btnBackPerfil');
const schemaWarning = document.getElementById('schemaWarning');
const globalFeedback = document.getElementById('globalFeedback');

const staffAgendaRows = document.getElementById('staffAgendaRows');
const staffListEl = document.getElementById('staffList');
const staffEmptyEl = document.getElementById('staffEmpty');
const staffForm = document.getElementById('staffForm');
const btnStaffNuevo = document.getElementById('btnStaffNuevo');
const btnStaffLimpiar = document.getElementById('btnStaffLimpiar');
const staffModal = document.getElementById('staffModal');
const staffModalTitle = document.getElementById('staffModalTitle');
const btnStaffModalClose = document.getElementById('btnStaffModalClose');
const btnStaffModalNuevoServicio = document.getElementById('btnStaffModalNuevoServicio');
const staffModalServiciosListEl = document.getElementById('staffModalServiciosList');
const staffModalServiciosEmptyEl = document.getElementById('staffModalServiciosEmpty');
const btnStaffTrabajosSubir = document.getElementById('btnStaffTrabajosSubir');
const staffTrabajoFilesInput = document.getElementById('staffTrabajoFiles');
const staffTrabajosListEl = document.getElementById('staffTrabajosList');
const staffTrabajosEmptyEl = document.getElementById('staffTrabajosEmpty');

const staffIdInput = document.getElementById('staffId');
const staffNombreInput = document.getElementById('staffNombre');
const staffProfesionInput = document.getElementById('staffProfesion');
const staffFotoUrlInput = document.getElementById('staffFotoUrl');
const staffFotoFileInput = document.getElementById('staffFotoFile');
const staffTelefonoInput = document.getElementById('staffTelefono');
const staffEmailInput = document.getElementById('staffEmail');
const staffWhatsappInput = document.getElementById('staffWhatsapp');
const staffFacebookInput = document.getElementById('staffFacebook');
const staffInstagramInput = document.getElementById('staffInstagram');
const staffBiografiaInput = document.getElementById('staffBiografia');
const staffSlotMinutesInput = document.getElementById('staffSlotMinutes');
const staffBufferMinutesInput = document.getElementById('staffBufferMinutes');
const staffOrdenInput = document.getElementById('staffOrden');
const staffActivoInput = document.getElementById('staffActivo');

const trabajoForm = document.getElementById('trabajoForm');
const trabajosListEl = document.getElementById('trabajosList');
const trabajosEmptyEl = document.getElementById('trabajosEmpty');
const btnTrabajoNuevo = document.getElementById('btnTrabajoNuevo');
const btnTrabajoLimpiar = document.getElementById('btnTrabajoLimpiar');
const trabajoModal = document.getElementById('trabajoModal');
const trabajoModalTitle = document.getElementById('trabajoModalTitle');
const btnTrabajoModalClose = document.getElementById('btnTrabajoModalClose');

const trabajoIdInput = document.getElementById('trabajoId');
const trabajoStaffSelect = document.getElementById('trabajoStaffId');
const trabajoOrdenInput = document.getElementById('trabajoOrden');
const trabajoMediaUrlInput = document.getElementById('trabajoMediaUrl');
const trabajoMediaFileInput = document.getElementById('trabajoMediaFile');
const trabajoTituloInput = document.getElementById('trabajoTitulo');
const trabajoDescripcionInput = document.getElementById('trabajoDescripcion');
const trabajoActivoInput = document.getElementById('trabajoActivo');

const servicioForm = document.getElementById('servicioForm');
const serviciosListEl = document.getElementById('serviciosList');
const serviciosEmptyEl = document.getElementById('serviciosEmpty');
const btnServicioNuevo = document.getElementById('btnServicioNuevo');
const btnServicioLimpiar = document.getElementById('btnServicioLimpiar');
const servicioModal = document.getElementById('servicioModal');
const servicioModalTitle = document.getElementById('servicioModalTitle');
const btnServicioModalClose = document.getElementById('btnServicioModalClose');

const servicioIdInput = document.getElementById('servicioId');
const servicioStaffSelect = document.getElementById('servicioStaffId');
const servicioNombreInput = document.getElementById('servicioNombre');
const servicioDescripcionInput = document.getElementById('servicioDescripcion');
const servicioDuracionInput = document.getElementById('servicioDuracion');
const servicioPrecioInput = document.getElementById('servicioPrecio');
const servicioOrdenInput = document.getElementById('servicioOrden');
const servicioActivoInput = document.getElementById('servicioActivo');

const citaManualForm = document.getElementById('citaManualForm');
const citaManualStaff = document.getElementById('citaManualStaff');
const citaManualFecha = document.getElementById('citaManualFecha');
const citaManualHora = document.getElementById('citaManualHora');
const citaManualDuracion = document.getElementById('citaManualDuracion');
const citaManualCliente = document.getElementById('citaManualCliente');
const citaManualTelefono = document.getElementById('citaManualTelefono');
const citaManualEmail = document.getElementById('citaManualEmail');
const citaManualServicio = document.getElementById('citaManualServicio');
const citaManualEstado = document.getElementById('citaManualEstado');
const citaManualNotas = document.getElementById('citaManualNotas');

const filtroFechaDesde = document.getElementById('filtroFechaDesde');
const filtroFechaHasta = document.getElementById('filtroFechaHasta');
const filtroStaff = document.getElementById('filtroStaff');
const filtroEstado = document.getElementById('filtroEstado');
const btnCitasRecargar = document.getElementById('btnCitasRecargar');
const citasListEl = document.getElementById('citasList');
const citasEmptyEl = document.getElementById('citasEmpty');
const btnCalendarPrevMonth = document.getElementById('btnCalendarPrevMonth');
const btnCalendarNextMonth = document.getElementById('btnCalendarNextMonth');
const btnCalendarToday = document.getElementById('btnCalendarToday');
const btnCalendarClearDay = document.getElementById('btnCalendarClearDay');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');
const calendarDayFilterLabel = document.getElementById('calendarDayFilterLabel');
const calendarCitasGrid = document.getElementById('calendarCitasGrid');

const btnNotifRecargar = document.getElementById('btnNotifRecargar');
const notificacionesListEl = document.getElementById('notificacionesList');
const notificacionesEmptyEl = document.getElementById('notificacionesEmpty');

const DIAS = [
  { id: 0, label: 'Domingo' },
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
];

const DEFAULT_SLOT_MINUTES = 60;
const DEFAULT_BUFFER_MINUTES = 0;
const SCHEMA_MIGRATION_MESSAGE = 'No se encontró el esquema de Staff/Citas/Servicios. Aplica las migraciones 20260422143000_servicios_staff_citas_notificaciones.sql, 20260422200000_staff_servicios_catalogo.sql, 20260422213000_staff_servicios_precio.sql y 20260422220000_staff_servicios_precio_texto.sql en Supabase.';

let currentUser = null;
let staffList = [];
let staffById = new Map();
let trabajosList = [];
let serviciosList = [];
let citasList = [];
let citasSourceList = [];
let notificacionesList = [];
let calendarMonthAnchor = null;
let calendarSelectedDay = '';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanText(value) {
  return String(value || '').trim();
}

function asNullable(value) {
  const clean = cleanText(value);
  return clean ? clean : null;
}

function formatPriceText(value) {
  const clean = cleanText(value);
  return clean || 'No definido';
}

function toIsoDate(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(value) {
  const clean = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const [y, m, d] = clean.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== (m - 1) || date.getDate() !== d) return null;
  return date;
}

function monthStart(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(dateValue || '');
  return new Intl.DateTimeFormat('es-PR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatDateTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue || '');
  return new Intl.DateTimeFormat('es-PR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeExternalUrl(value) {
  const clean = cleanText(value);
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean) || /^mailto:/i.test(clean) || /^tel:/i.test(clean)) return clean;
  return `https://${clean}`;
}

function normalizeAgenda(raw) {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const slotMinutes = Math.min(240, Math.max(15, Math.floor(Number(data.slot_minutes) || DEFAULT_SLOT_MINUTES)));
  const bufferMinutes = Math.min(180, Math.max(0, Math.floor(Number(data.buffer_minutes) || DEFAULT_BUFFER_MINUTES)));
  const timezone = cleanText(data.timezone) || 'America/Puerto_Rico';

  const dias = {};
  for (const day of DIAS) {
    const list = Array.isArray(data?.dias?.[day.id]) ? data.dias[day.id] : [];
    dias[day.id] = list
      .map((entry) => {
        const inicio = String(entry?.inicio || '').slice(0, 5);
        const fin = String(entry?.fin || '').slice(0, 5);
        if (!/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fin) || inicio >= fin) return null;
        return { inicio, fin };
      })
      .filter(Boolean);
  }

  return {
    timezone,
    slot_minutes: slotMinutes,
    buffer_minutes: bufferMinutes,
    dias,
  };
}

function agendaRowId(dayId, field) {
  return `agenda_${dayId}_${field}`;
}

function renderAgendaRows() {
  if (!staffAgendaRows) return;
  staffAgendaRows.innerHTML = DIAS.map((day) => `
    <div class="rounded-lg border border-gray-200 p-2 bg-gray-50">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-gray-700">${escapeHtml(day.label)}</span>
        <label class="text-xs inline-flex items-center gap-1 text-gray-600">
          <input id="${agendaRowId(day.id, 'open')}" type="checkbox" class="accent-blue-600" checked />
          Abierto
        </label>
      </div>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <input id="${agendaRowId(day.id, 'start')}" type="time" value="09:00" class="w-full border rounded px-2 py-1 text-sm" />
        <input id="${agendaRowId(day.id, 'end')}" type="time" value="17:00" class="w-full border rounded px-2 py-1 text-sm" />
      </div>
    </div>
  `).join('');

  for (const day of DIAS) {
    const open = document.getElementById(agendaRowId(day.id, 'open'));
    const start = document.getElementById(agendaRowId(day.id, 'start'));
    const end = document.getElementById(agendaRowId(day.id, 'end'));

    const sync = () => {
      const disabled = !open?.checked;
      if (start) start.disabled = disabled;
      if (end) end.disabled = disabled;
    };

    open?.addEventListener('change', sync);
    sync();
  }
}

function resetAgendaInputs() {
  for (const day of DIAS) {
    const open = document.getElementById(agendaRowId(day.id, 'open'));
    const start = document.getElementById(agendaRowId(day.id, 'start'));
    const end = document.getElementById(agendaRowId(day.id, 'end'));

    if (open) open.checked = day.id !== 0;
    if (start) start.value = '09:00';
    if (end) end.value = day.id === 6 ? '14:00' : '17:00';

    const disabled = !open?.checked;
    if (start) start.disabled = disabled;
    if (end) end.disabled = disabled;
  }
}

function agendaFromInputs() {
  const slot = Math.min(240, Math.max(15, Math.floor(Number(staffSlotMinutesInput?.value) || DEFAULT_SLOT_MINUTES)));
  const buffer = Math.min(180, Math.max(0, Math.floor(Number(staffBufferMinutesInput?.value) || DEFAULT_BUFFER_MINUTES)));

  const dias = {};
  for (const day of DIAS) {
    const open = document.getElementById(agendaRowId(day.id, 'open'));
    const start = document.getElementById(agendaRowId(day.id, 'start'));
    const end = document.getElementById(agendaRowId(day.id, 'end'));

    const isOpen = !!open?.checked;
    const startValue = String(start?.value || '').slice(0, 5);
    const endValue = String(end?.value || '').slice(0, 5);

    if (isOpen && /^\d{2}:\d{2}$/.test(startValue) && /^\d{2}:\d{2}$/.test(endValue) && startValue < endValue) {
      dias[day.id] = [{ inicio: startValue, fin: endValue }];
    } else {
      dias[day.id] = [];
    }
  }

  return {
    timezone: 'America/Puerto_Rico',
    slot_minutes: slot,
    buffer_minutes: buffer,
    dias,
  };
}

function fillAgendaInputs(rawAgenda) {
  const agenda = normalizeAgenda(rawAgenda);
  staffSlotMinutesInput.value = String(agenda.slot_minutes);
  staffBufferMinutesInput.value = String(agenda.buffer_minutes);

  for (const day of DIAS) {
    const open = document.getElementById(agendaRowId(day.id, 'open'));
    const start = document.getElementById(agendaRowId(day.id, 'start'));
    const end = document.getElementById(agendaRowId(day.id, 'end'));

    const first = Array.isArray(agenda.dias[day.id]) && agenda.dias[day.id].length ? agenda.dias[day.id][0] : null;
    const isOpen = !!first;

    if (open) open.checked = isOpen;
    if (start) start.value = first?.inicio || (day.id === 0 ? '09:00' : '09:00');
    if (end) end.value = first?.fin || (day.id === 6 ? '14:00' : '17:00');

    const disabled = !isOpen;
    if (start) start.disabled = disabled;
    if (end) end.disabled = disabled;
  }
}

function showGlobalFeedback(message, type = 'info') {
  if (!globalFeedback) return;
  if (!message) {
    globalFeedback.classList.add('hidden');
    globalFeedback.textContent = '';
    globalFeedback.className = 'hidden mt-3 text-sm rounded-lg px-3 py-2';
    return;
  }

  const tone = {
    info: 'bg-sky-50 border border-sky-200 text-sky-800',
    success: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800',
    error: 'bg-red-50 border border-red-200 text-red-700',
  };

  globalFeedback.className = `mt-3 text-sm rounded-lg px-3 py-2 ${tone[type] || tone.info}`;
  globalFeedback.textContent = message;
  globalFeedback.classList.remove('hidden');
}

function showSchemaWarning(message) {
  if (!schemaWarning) return;
  if (!message) {
    schemaWarning.classList.add('hidden');
    schemaWarning.textContent = '';
    return;
  }
  schemaWarning.classList.remove('hidden');
  schemaWarning.textContent = message;
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  if (staffModal?.classList.contains('hidden') && trabajoModal?.classList.contains('hidden') && servicioModal?.classList.contains('hidden')) {
    document.body.classList.remove('overflow-hidden');
  }
}

function isSchemaMissingError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const combined = `${message} ${details}`;
  return (
    code === '42P01'
    || code === '42703'
    || combined.includes('comerciostaff')
    || combined.includes('comerciostafftrabajos')
    || combined.includes('comerciostaffservicios')
    || combined.includes('comerciocitas')
    || combined.includes('comerciocitasnotificaciones')
    || (combined.includes('precio') && combined.includes('column'))
  );
}

function extFromFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
  if (name.endsWith('.webp')) return 'webp';
  return 'jpg';
}

function randomSuffix(size = 8) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < size; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function uploadImageToPublic(file, folder) {
  const mime = String(file?.type || '').toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error('Formato no permitido. Usa JPG, PNG o WEBP.');
  }

  const sizeMb = Number(file?.size || 0) / (1024 * 1024);
  if (sizeMb > 8) {
    throw new Error('La imagen excede 8MB.');
  }

  const ext = extFromFile(file);
  const path = `${folder}/${idComercio}/${Date.now()}-${randomSuffix()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('galeriacomercios').upload(path, file, {
    upsert: false,
    cacheControl: '3600',
  });

  if (uploadError) {
    throw new Error(uploadError.message || 'No se pudo subir la imagen.');
  }

  const { data } = supabase.storage.from('galeriacomercios').getPublicUrl(path);
  return data?.publicUrl || null;
}

function setDefaultDateFilters() {
  const today = new Date();
  const start = monthStart(today);
  const end = monthEnd(today);
  calendarMonthAnchor = start;
  calendarSelectedDay = '';

  if (filtroFechaDesde) filtroFechaDesde.value = toIsoDate(start);
  if (filtroFechaHasta) filtroFechaHasta.value = toIsoDate(end);
  if (citaManualFecha) citaManualFecha.value = toIsoDate(today);
  if (citaManualHora) citaManualHora.value = '09:00';
}

function addMinutesToTime(hhmm, minutesToAdd) {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = (h * 60) + m + Number(minutesToAdd || 0);
  const bounded = Math.max(0, Math.min(total, 23 * 60 + 59));
  const hh = String(Math.floor(bounded / 60)).padStart(2, '0');
  const mm = String(bounded % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getStatusBadgeClass(status) {
  const s = cleanText(status).toLowerCase();
  if (s === 'pendiente') return 'bg-amber-100 text-amber-800';
  if (s === 'confirmada') return 'bg-sky-100 text-sky-800';
  if (s === 'completada') return 'bg-emerald-100 text-emerald-800';
  if (s === 'cancelada' || s === 'rechazada') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}

function currentStaffName(staffId) {
  const row = staffById.get(Number(staffId));
  return row?.nombre || `Staff ${staffId}`;
}

function getCalendarStatus(status) {
  const normalized = cleanText(status).toLowerCase();
  if (normalized === 'rechazada') return 'cancelada';
  return normalized;
}

function getCalendarStatusDotClass(status) {
  if (status === 'pendiente') return 'bg-amber-500';
  if (status === 'confirmada') return 'bg-sky-500';
  if (status === 'completada') return 'bg-emerald-500';
  if (status === 'cancelada') return 'bg-red-500';
  return 'bg-gray-300';
}

function syncCalendarMonthFromFilters() {
  const fromDate = parseIsoDate(filtroFechaDesde?.value);
  const toDate = parseIsoDate(filtroFechaHasta?.value);

  if (fromDate) {
    calendarMonthAnchor = monthStart(fromDate);
    return;
  }

  if (toDate) {
    calendarMonthAnchor = monthStart(toDate);
    return;
  }

  if (!calendarMonthAnchor) {
    calendarMonthAnchor = monthStart(new Date());
  }
}

function setDateFiltersForCalendarMonth(dateLike) {
  const start = monthStart(dateLike);
  const end = monthEnd(start);

  calendarMonthAnchor = start;
  if (filtroFechaDesde) filtroFechaDesde.value = toIsoDate(start);
  if (filtroFechaHasta) filtroFechaHasta.value = toIsoDate(end);
}

function keepCalendarDayInRange() {
  if (!calendarSelectedDay) return;

  const fromDate = cleanText(filtroFechaDesde?.value);
  const toDate = cleanText(filtroFechaHasta?.value);
  if ((fromDate && calendarSelectedDay < fromDate) || (toDate && calendarSelectedDay > toDate)) {
    calendarSelectedDay = '';
  }
}

function renderCitasCalendar() {
  if (!calendarCitasGrid) return;

  syncCalendarMonthFromFilters();
  keepCalendarDayInRange();

  const anchor = calendarMonthAnchor || monthStart(new Date());
  const start = monthStart(anchor);
  const end = monthEnd(anchor);
  const daysInMonth = end.getDate();
  const firstWeekday = start.getDay();
  const todayIso = toIsoDate(new Date());

  const calendarSummary = new Map();
  for (const cita of citasSourceList) {
    const dateKey = cleanText(cita.fecha_cita);
    if (!dateKey) continue;

    let summary = calendarSummary.get(dateKey);
    if (!summary) {
      summary = { total: 0, statuses: new Set() };
      calendarSummary.set(dateKey, summary);
    }

    summary.total += 1;
    summary.statuses.add(getCalendarStatus(cita.estado));
  }

  const statusOrder = ['pendiente', 'confirmada', 'completada', 'cancelada'];
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push('<div class="h-[58px] rounded-md"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayDate = new Date(start.getFullYear(), start.getMonth(), day);
    const dayIso = toIsoDate(dayDate);
    const dayData = calendarSummary.get(dayIso);
    const total = Number(dayData?.total || 0);
    const statuses = dayData
      ? statusOrder.filter((status) => dayData.statuses.has(status))
      : [];
    const selected = calendarSelectedDay === dayIso;
    const isToday = dayIso === todayIso;

    const buttonClass = selected
      ? 'border-cyan-500 bg-cyan-50'
      : total > 0
        ? 'border-gray-300 bg-white hover:bg-gray-50'
        : 'border-gray-200 bg-gray-50 hover:bg-gray-100';

    const numberClass = selected
      ? 'text-cyan-700'
      : total > 0
        ? 'text-gray-800'
        : 'text-gray-400';

    const todayRing = isToday && !selected ? ' ring-1 ring-slate-300' : '';
    const dotsHtml = statuses.map((status) => `
      <span class="w-1.5 h-1.5 rounded-full ${getCalendarStatusDotClass(status)}"></span>
    `).join('');

    cells.push(`
      <button
        type="button"
        data-action="calendar-day"
        data-date="${dayIso}"
        class="h-[58px] rounded-md border px-1.5 py-1 text-left transition ${buttonClass}${todayRing}"
        aria-label="${dayIso}"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold ${numberClass}">${day}</span>
          ${total ? `<span class="text-[10px] font-semibold text-gray-600">${total}</span>` : ''}
        </div>
        <div class="mt-1 flex flex-wrap gap-1 min-h-[8px]">
          ${dotsHtml}
        </div>
      </button>
    `);
  }

  const fillerCells = (7 - (cells.length % 7)) % 7;
  for (let index = 0; index < fillerCells; index += 1) {
    cells.push('<div class="h-[58px] rounded-md"></div>');
  }

  if (calendarMonthLabel) {
    calendarMonthLabel.textContent = new Intl.DateTimeFormat('es-PR', {
      month: 'long',
      year: 'numeric',
    }).format(start);
  }

  if (calendarDayFilterLabel) {
    if (calendarSelectedDay) {
      const count = citasList.length;
      calendarDayFilterLabel.textContent = `Día seleccionado: ${formatDate(calendarSelectedDay)} · ${count} cita${count === 1 ? '' : 's'}.`;
    } else {
      const count = citasSourceList.length;
      calendarDayFilterLabel.textContent = `Mes completo: ${count} cita${count === 1 ? '' : 's'} (según filtros actuales).`;
    }
  }

  calendarCitasGrid.innerHTML = cells.join('');
}

function applyCitasViewFilter() {
  keepCalendarDayInRange();
  if (calendarSelectedDay) {
    citasList = citasSourceList.filter((cita) => cleanText(cita.fecha_cita) === calendarSelectedDay);
  } else {
    citasList = [...citasSourceList];
  }

  renderCitasList();
  renderCitasCalendar();
}

async function validateAccessOrRedirect() {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    window.location.href = './index.html';
    return false;
  }

  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  currentUser = userResp?.user || null;
  if (userErr || !currentUser) {
    window.location.href = './login.html';
    return false;
  }

  const relResp = await supabase
    .from('UsuarioComercios')
    .select('idComercio')
    .eq('idUsuario', currentUser.id)
    .eq('idComercio', idComercio)
    .limit(1);

  let hasAccess = Array.isArray(relResp.data) && relResp.data.length > 0;
  if (!hasAccess) {
    const ownerResp = await supabase
      .from('Comercios')
      .select('id,nombre')
      .eq('id', idComercio)
      .eq('owner_user_id', currentUser.id)
      .maybeSingle();

    hasAccess = !ownerResp.error && !!ownerResp.data;
  }

  if (!hasAccess) {
    alert('No tienes acceso a este comercio.');
    window.location.href = './index.html';
    return false;
  }

  const comercioResp = await supabase
    .from('Comercios')
    .select('id,nombre')
    .eq('id', idComercio)
    .maybeSingle();

  if (comercioResp.data?.nombre) {
    subtitleComercio.textContent = `${comercioResp.data.nombre} · ID ${idComercio}`;
  } else {
    subtitleComercio.textContent = `Comercio ID ${idComercio}`;
  }

  btnBackPerfil.href = `./editarPerfilComercio.html?id=${idComercio}`;
  return true;
}

function updateStaffSelectors() {
  const previousTrabajoStaff = cleanText(trabajoStaffSelect?.value);
  const previousServicioStaff = cleanText(servicioStaffSelect?.value);
  const previousFiltroStaff = cleanText(filtroStaff?.value);
  const previousCitaStaff = cleanText(citaManualStaff?.value);

  if (trabajoStaffSelect) {
    trabajoStaffSelect.innerHTML = [
      '<option value="">Selecciona un profesional</option>',
      ...staffList.map((item) => `<option value="${Number(item.id)}">${escapeHtml(item.nombre)}${item.activo ? '' : ' (inactivo)'}</option>`),
    ].join('');
    if (previousTrabajoStaff) trabajoStaffSelect.value = previousTrabajoStaff;
  }

  if (filtroStaff) {
    filtroStaff.innerHTML = [
      '<option value="">Todos</option>',
      ...staffList.map((item) => `<option value="${Number(item.id)}">${escapeHtml(item.nombre)}</option>`),
    ].join('');
    if (previousFiltroStaff) filtroStaff.value = previousFiltroStaff;
  }

  if (citaManualStaff) {
    citaManualStaff.innerHTML = [
      '<option value="">Selecciona un profesional</option>',
      ...staffList.filter((item) => item.activo !== false).map((item) => `<option value="${Number(item.id)}">${escapeHtml(item.nombre)}</option>`),
    ].join('');
    if (previousCitaStaff) citaManualStaff.value = previousCitaStaff;
  }

  if (servicioStaffSelect) {
    servicioStaffSelect.innerHTML = [
      '<option value="">Selecciona un profesional</option>',
      ...staffList.map((item) => `<option value="${Number(item.id)}">${escapeHtml(item.nombre)}${item.activo ? '' : ' (inactivo)'}</option>`),
    ].join('');
    if (previousServicioStaff) servicioStaffSelect.value = previousServicioStaff;
  }
}

function renderStaffList() {
  if (!staffListEl || !staffEmptyEl) return;

  if (!staffList.length) {
    staffListEl.innerHTML = '';
    staffEmptyEl.classList.remove('hidden');
    return;
  }

  staffEmptyEl.classList.add('hidden');
  staffListEl.innerHTML = staffList.map((item) => {
    const photo = cleanText(item.foto_url) || 'https://placehold.co/100x100?text=Staff';
    const statusClass = item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600';
    return `
      <article class="border border-gray-200 rounded-xl p-3 bg-white">
        <div class="flex gap-3">
          <img src="${escapeHtml(photo)}" alt="${escapeHtml(item.nombre || 'Staff')}" class="w-16 h-16 rounded-lg object-cover border border-gray-200" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap gap-2 items-center">
              <h3 class="text-base font-semibold text-gray-900 truncate">${escapeHtml(item.nombre || '—')}</h3>
              <span class="text-xs px-2 py-1 rounded-full ${statusClass}">${item.activo ? 'activo' : 'inactivo'}</span>
            </div>
            <p class="text-sm text-gray-600">${escapeHtml(item.profesion || 'Sin profesión')}</p>
            <p class="text-xs text-gray-500 mt-1">Orden: ${Number(item.orden || 100)} · Slot ${Number(item.agenda_config?.slot_minutes || 60)} min</p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" data-action="edit-staff" data-id="${Number(item.id)}" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Editar</button>
          <button type="button" data-action="toggle-staff" data-id="${Number(item.id)}" data-next="${item.activo ? '0' : '1'}" class="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold">${item.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </article>
    `;
  }).join('');
}

async function loadStaff() {
  const { data, error } = await supabase
    .from('ComercioStaff')
    .select('id,id_comercio,nombre,profesion,foto_url,telefono,email,facebook,instagram,whatsapp,biografia,agenda_config,orden,activo,created_at')
    .eq('id_comercio', idComercio)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    if (isSchemaMissingError(error)) {
      showSchemaWarning(SCHEMA_MIGRATION_MESSAGE);
      staffList = [];
      staffById = new Map();
      renderStaffList();
      updateStaffSelectors();
      return;
    }
    throw error;
  }

  showSchemaWarning('');
  staffList = Array.isArray(data) ? data : [];
  staffById = new Map(staffList.map((row) => [Number(row.id), row]));

  renderStaffList();
  updateStaffSelectors();
}

function clearStaffForm() {
  if (staffForm) staffForm.reset();
  staffIdInput.value = '';
  staffSlotMinutesInput.value = String(DEFAULT_SLOT_MINUTES);
  staffBufferMinutesInput.value = String(DEFAULT_BUFFER_MINUTES);
  staffOrdenInput.value = '100';
  staffActivoInput.checked = true;
  resetAgendaInputs();
}

function fillStaffForm(staff) {
  if (!staff) return;
  staffIdInput.value = String(staff.id || '');
  staffNombreInput.value = cleanText(staff.nombre);
  staffProfesionInput.value = cleanText(staff.profesion);
  staffFotoUrlInput.value = cleanText(staff.foto_url);
  staffTelefonoInput.value = cleanText(staff.telefono);
  staffEmailInput.value = cleanText(staff.email);
  staffWhatsappInput.value = cleanText(staff.whatsapp);
  staffFacebookInput.value = cleanText(staff.facebook);
  staffInstagramInput.value = cleanText(staff.instagram);
  staffBiografiaInput.value = cleanText(staff.biografia);
  staffOrdenInput.value = String(Number(staff.orden || 100));
  staffActivoInput.checked = staff.activo !== false;
  fillAgendaInputs(staff.agenda_config || {});
}

async function saveStaff(event) {
  event.preventDefault();

  const id = toNumber(staffIdInput.value);
  const nombre = cleanText(staffNombreInput.value);
  const profesion = cleanText(staffProfesionInput.value);

  if (!nombre || !profesion) {
    showGlobalFeedback('Nombre y profesión son requeridos.', 'warning');
    return;
  }

  const photoFile = staffFotoFileInput?.files?.[0] || null;
  let fotoUrl = cleanText(staffFotoUrlInput.value);
  if (photoFile) {
    showGlobalFeedback('Subiendo foto del profesional...', 'info');
    fotoUrl = await uploadImageToPublic(photoFile, 'servicios/staff');
  }

  const payload = {
    id_comercio: idComercio,
    nombre,
    profesion,
    foto_url: fotoUrl || null,
    telefono: asNullable(staffTelefonoInput.value),
    email: asNullable(staffEmailInput.value),
    whatsapp: asNullable(staffWhatsappInput.value),
    facebook: asNullable(normalizeExternalUrl(staffFacebookInput.value)),
    instagram: asNullable(normalizeExternalUrl(staffInstagramInput.value)),
    biografia: asNullable(staffBiografiaInput.value),
    orden: Math.max(1, Math.floor(Number(staffOrdenInput.value) || 100)),
    activo: !!staffActivoInput.checked,
    agenda_config: agendaFromInputs(),
  };

  if (id) {
    const { error } = await supabase
      .from('ComercioStaff')
      .update(payload)
      .eq('id', id)
      .eq('id_comercio', idComercio);
    if (error) throw error;
    showGlobalFeedback('Profesional actualizado.', 'success');
  } else {
    const { error } = await supabase
      .from('ComercioStaff')
      .insert(payload);
    if (error) throw error;
    showGlobalFeedback('Profesional creado.', 'success');
  }

  clearStaffForm();
  await loadStaff();
  await loadTrabajos();
  await loadServicios();
  await loadCitas();
  closeModal(staffModal);
}

async function toggleStaffActive(staffId, nextActive) {
  const id = toNumber(staffId);
  if (!id) return;
  const { error } = await supabase
    .from('ComercioStaff')
    .update({ activo: nextActive })
    .eq('id', id)
    .eq('id_comercio', idComercio);

  if (error) throw error;
  showGlobalFeedback(nextActive ? 'Profesional activado.' : 'Profesional desactivado.', 'success');
  await loadStaff();
  await loadTrabajos();
  await loadServicios();
  await loadCitas();
}

function clearTrabajoForm(keepStaffSelection = true) {
  const selectedStaff = keepStaffSelection ? cleanText(trabajoStaffSelect?.value) : '';
  if (trabajoForm) trabajoForm.reset();
  if (trabajoIdInput) trabajoIdInput.value = '';
  if (trabajoOrdenInput) trabajoOrdenInput.value = '100';
  if (trabajoActivoInput) trabajoActivoInput.checked = true;
  if (selectedStaff) {
    if (trabajoStaffSelect) trabajoStaffSelect.value = selectedStaff;
  } else if (!cleanText(trabajoStaffSelect?.value) && staffList.length) {
    if (trabajoStaffSelect) trabajoStaffSelect.value = String(staffList[0].id);
  }
}

function fillTrabajoForm(item) {
  if (!item) return;
  trabajoIdInput.value = String(item.id || '');
  trabajoStaffSelect.value = String(item.id_staff || '');
  trabajoOrdenInput.value = String(Number(item.orden || 100));
  trabajoMediaUrlInput.value = cleanText(item.media_url);
  trabajoTituloInput.value = cleanText(item.titulo);
  trabajoDescripcionInput.value = cleanText(item.descripcion);
  trabajoActivoInput.checked = item.activo !== false;
}

function renderTrabajosList() {
  if (!trabajosListEl || !trabajosEmptyEl) return;

  const selectedStaffId = toNumber(trabajoStaffSelect.value);
  const filtered = selectedStaffId ? trabajosList.filter((row) => Number(row.id_staff) === selectedStaffId) : [];

  if (!filtered.length) {
    trabajosListEl.innerHTML = '';
    trabajosEmptyEl.classList.remove('hidden');
    return;
  }

  trabajosEmptyEl.classList.add('hidden');
  trabajosListEl.innerHTML = filtered.map((item) => {
    const statusClass = item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600';
    const image = cleanText(item.media_url) || 'https://placehold.co/120x90?text=Trabajo';
    return `
      <article class="border border-gray-200 rounded-xl p-3 bg-white">
        <div class="flex gap-3">
          <img src="${escapeHtml(image)}" alt="Trabajo" class="w-20 h-16 rounded-lg border border-gray-200 object-cover" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap gap-2 items-center">
              <p class="text-sm font-semibold text-gray-900">${escapeHtml(item.titulo || 'Sin título')}</p>
              <span class="text-xs px-2 py-1 rounded-full ${statusClass}">${item.activo ? 'activo' : 'inactivo'}</span>
            </div>
            <p class="text-xs text-gray-600 mt-1">${escapeHtml(item.descripcion || 'Sin descripción')}</p>
            <p class="text-xs text-gray-500 mt-1">Orden ${Number(item.orden || 100)}</p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" data-action="edit-trabajo" data-id="${Number(item.id)}" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Editar</button>
          <button type="button" data-action="toggle-trabajo" data-id="${Number(item.id)}" data-next="${item.activo ? '0' : '1'}" class="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold">${item.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </article>
    `;
  }).join('');
}

async function loadTrabajos() {
  const selectedStaffId = toNumber(trabajoStaffSelect?.value);
  if (!selectedStaffId) {
    trabajosList = [];
    renderTrabajosList();
    renderStaffModalTrabajos();
    return;
  }

  const { data, error } = await supabase
    .from('ComercioStaffTrabajos')
    .select('id,id_staff,media_url,titulo,descripcion,orden,activo,created_at')
    .eq('id_staff', selectedStaffId)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    if (isSchemaMissingError(error)) {
      showSchemaWarning(SCHEMA_MIGRATION_MESSAGE);
      trabajosList = [];
      renderTrabajosList();
      renderStaffModalTrabajos();
      return;
    }
    throw error;
  }

  trabajosList = Array.isArray(data) ? data : [];
  renderTrabajosList();
  renderStaffModalTrabajos();
}

async function saveTrabajo(event) {
  event.preventDefault();

  const id = toNumber(trabajoIdInput.value);
  const staffId = toNumber(trabajoStaffSelect.value);
  if (!staffId) {
    showGlobalFeedback('Selecciona el profesional del trabajo.', 'warning');
    return;
  }

  let mediaUrl = cleanText(trabajoMediaUrlInput.value);
  const mediaFile = trabajoMediaFileInput?.files?.[0] || null;
  if (mediaFile) {
    showGlobalFeedback('Subiendo imagen del trabajo...', 'info');
    mediaUrl = await uploadImageToPublic(mediaFile, 'servicios/trabajos');
  }

  if (!mediaUrl) {
    showGlobalFeedback('La imagen del trabajo es requerida (URL o archivo).', 'warning');
    return;
  }

  const payload = {
    id_staff: staffId,
    media_url: mediaUrl,
    titulo: asNullable(trabajoTituloInput.value),
    descripcion: asNullable(trabajoDescripcionInput.value),
    orden: Math.max(1, Math.floor(Number(trabajoOrdenInput.value) || 100)),
    activo: !!trabajoActivoInput.checked,
  };

  if (id) {
    const { error } = await supabase
      .from('ComercioStaffTrabajos')
      .update(payload)
      .eq('id', id)
      .eq('id_staff', staffId);
    if (error) throw error;
    showGlobalFeedback('Trabajo actualizado.', 'success');
  } else {
    const { error } = await supabase
      .from('ComercioStaffTrabajos')
      .insert(payload);
    if (error) throw error;
    showGlobalFeedback('Trabajo agregado.', 'success');
  }

  clearTrabajoForm();
  if (trabajoStaffSelect) trabajoStaffSelect.value = String(staffId);
  await loadTrabajos();
  closeModal(trabajoModal);
}

async function toggleTrabajoActive(trabajoId, nextActive) {
  const id = toNumber(trabajoId);
  const staffId = toNumber(trabajoStaffSelect?.value) || currentEditingStaffId();
  if (!id || !staffId) return;

  const { error } = await supabase
    .from('ComercioStaffTrabajos')
    .update({ activo: nextActive })
    .eq('id', id)
    .eq('id_staff', staffId);

  if (error) throw error;
  showGlobalFeedback(nextActive ? 'Trabajo activado.' : 'Trabajo desactivado.', 'success');
  await loadTrabajos();
}

function clearServicioForm(keepStaffSelection = true) {
  const selectedStaff = keepStaffSelection ? cleanText(servicioStaffSelect?.value) : '';
  if (servicioForm) servicioForm.reset();
  servicioIdInput.value = '';
  servicioDuracionInput.value = '60';
  servicioPrecioInput.value = '';
  servicioOrdenInput.value = '100';
  servicioActivoInput.checked = true;
  if (selectedStaff) {
    servicioStaffSelect.value = selectedStaff;
  } else if (!cleanText(servicioStaffSelect?.value) && staffList.length) {
    servicioStaffSelect.value = String(staffList[0].id);
  }
}

function fillServicioForm(item) {
  if (!item) return;
  servicioIdInput.value = String(item.id || '');
  servicioStaffSelect.value = String(item.id_staff || '');
  servicioNombreInput.value = cleanText(item.nombre);
  servicioDescripcionInput.value = cleanText(item.descripcion);
  servicioDuracionInput.value = String(Math.max(15, Math.floor(Number(item.duracion_min) || 60)));
  servicioPrecioInput.value = cleanText(item.precio);
  servicioOrdenInput.value = String(Number(item.orden || 100));
  servicioActivoInput.checked = item.activo !== false;
}

function currentEditingStaffId() {
  return toNumber(staffIdInput?.value);
}

function renderStaffModalServicios() {
  if (!staffModalServiciosListEl || !staffModalServiciosEmptyEl) return;

  const staffId = currentEditingStaffId();
  if (!staffId) {
    staffModalServiciosListEl.innerHTML = '';
    staffModalServiciosEmptyEl.textContent = 'Guarda el profesional para gestionar sus servicios.';
    staffModalServiciosEmptyEl.classList.remove('hidden');
    return;
  }

  const rows = serviciosList.filter((row) => Number(row.id_staff) === Number(staffId));
  if (!rows.length) {
    staffModalServiciosListEl.innerHTML = '';
    staffModalServiciosEmptyEl.textContent = 'Este profesional aún no tiene servicios guardados.';
    staffModalServiciosEmptyEl.classList.remove('hidden');
    return;
  }

  staffModalServiciosEmptyEl.classList.add('hidden');
  staffModalServiciosListEl.innerHTML = rows.map((item) => {
    const statusClass = item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600';
    return `
      <article class="border border-gray-200 rounded-lg p-2.5 bg-gray-50">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">${escapeHtml(item.nombre || 'Servicio')}</p>
            <p class="text-xs text-gray-600 mt-0.5">${escapeHtml(item.descripcion || 'Sin descripción')}</p>
            <p class="text-xs text-gray-500 mt-1">Duración ${Math.max(15, Number(item.duracion_min || 60))} min · Precio ${escapeHtml(formatPriceText(item.precio))}</p>
          </div>
          <span class="text-[10px] px-2 py-1 rounded-full ${statusClass}">${item.activo ? 'activo' : 'inactivo'}</span>
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          <button type="button" data-action="edit-staff-modal-servicio" data-id="${Number(item.id)}" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold">Editar</button>
          <button type="button" data-action="toggle-staff-modal-servicio" data-id="${Number(item.id)}" data-next="${item.activo ? '0' : '1'}" class="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-semibold">${item.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </article>
    `;
  }).join('');
}

async function refreshStaffModalServicios(staffId = currentEditingStaffId()) {
  if (!Number.isFinite(staffId) || staffId <= 0) {
    serviciosList = [];
    renderStaffModalServicios();
    return;
  }
  if (servicioStaffSelect) servicioStaffSelect.value = String(staffId);
  await loadServicios();
}

function renderStaffModalTrabajos() {
  if (!staffTrabajosListEl || !staffTrabajosEmptyEl) return;

  const staffId = currentEditingStaffId();
  if (!staffId) {
    staffTrabajosListEl.innerHTML = '';
    staffTrabajosEmptyEl.textContent = 'Guarda el profesional para gestionar su galería.';
    staffTrabajosEmptyEl.classList.remove('hidden');
    return;
  }

  const rows = trabajosList.filter((row) => Number(row.id_staff) === Number(staffId));
  if (!rows.length) {
    staffTrabajosListEl.innerHTML = '';
    staffTrabajosEmptyEl.textContent = 'Este profesional aún no tiene imágenes en su galería.';
    staffTrabajosEmptyEl.classList.remove('hidden');
    return;
  }

  staffTrabajosEmptyEl.classList.add('hidden');
  staffTrabajosListEl.innerHTML = rows.map((item) => {
    const image = cleanText(item.media_url) || 'https://placehold.co/120x90?text=Trabajo';
    const statusClass = item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600';
    return `
      <article class="border border-gray-200 rounded-lg p-2 bg-gray-50">
        <div class="flex gap-2">
          <img src="${escapeHtml(image)}" alt="Trabajo" class="w-16 h-16 rounded-lg border border-gray-200 object-cover" />
          <div class="min-w-0 flex-1">
            <p class="text-xs text-gray-700 truncate">${escapeHtml(item.titulo || 'Imagen de trabajo')}</p>
            <p class="text-[11px] text-gray-500 mt-0.5">Orden ${Number(item.orden || 100)}</p>
            <span class="inline-flex mt-1 text-[10px] px-2 py-0.5 rounded-full ${statusClass}">${item.activo ? 'activo' : 'inactivo'}</span>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" data-action="toggle-staff-modal-trabajo" data-id="${Number(item.id)}" data-next="${item.activo ? '0' : '1'}" class="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-semibold">${item.activo ? 'Desactivar' : 'Activar'}</button>
              <button type="button" data-action="delete-staff-modal-trabajo" data-id="${Number(item.id)}" class="px-2 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white text-[10px] font-semibold">Eliminar</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

async function refreshStaffModalTrabajos(staffId = currentEditingStaffId()) {
  if (!Number.isFinite(staffId) || staffId <= 0) {
    trabajosList = [];
    renderStaffModalTrabajos();
    return;
  }
  if (trabajoStaffSelect) trabajoStaffSelect.value = String(staffId);
  await loadTrabajos();
}

async function uploadStaffTrabajosFiles(staffId, files = []) {
  const normalizedStaffId = toNumber(staffId);
  if (!normalizedStaffId) return;

  const validFiles = Array.from(files || []).filter(Boolean);
  if (!validFiles.length) {
    showGlobalFeedback('Selecciona una o más imágenes para subir.', 'warning');
    return;
  }

  const existing = trabajosList.filter((row) => Number(row.id_staff) === normalizedStaffId);
  let nextOrder = existing.reduce((max, row) => Math.max(max, Number(row.orden || 100)), 0) + 1;

  for (let index = 0; index < validFiles.length; index += 1) {
    const file = validFiles[index];
    showGlobalFeedback(`Subiendo imagen ${index + 1} de ${validFiles.length}...`, 'info');
    const mediaUrl = await uploadImageToPublic(file, 'servicios/trabajos');

    const payload = {
      id_staff: normalizedStaffId,
      media_url: mediaUrl,
      titulo: null,
      descripcion: null,
      orden: nextOrder,
      activo: true,
    };

    const { error } = await supabase
      .from('ComercioStaffTrabajos')
      .insert(payload);
    if (error) throw error;
    nextOrder += 1;
  }

  if (staffTrabajoFilesInput) staffTrabajoFilesInput.value = '';
  showGlobalFeedback(`${validFiles.length} imagen${validFiles.length === 1 ? '' : 'es'} subida${validFiles.length === 1 ? '' : 's'} correctamente.`, 'success');
  await refreshStaffModalTrabajos(normalizedStaffId);
}

async function deleteTrabajo(trabajoId, staffId) {
  const id = toNumber(trabajoId);
  const ownerStaffId = toNumber(staffId);
  if (!id || !ownerStaffId) return;

  const { error } = await supabase
    .from('ComercioStaffTrabajos')
    .delete()
    .eq('id', id)
    .eq('id_staff', ownerStaffId);

  if (error) throw error;
  showGlobalFeedback('Imagen eliminada de la galería.', 'success');
  await refreshStaffModalTrabajos(ownerStaffId);
}

function renderServiciosList() {
  if (!serviciosListEl || !serviciosEmptyEl) return;

  const selectedStaffId = toNumber(servicioStaffSelect?.value);
  const filtered = selectedStaffId
    ? serviciosList.filter((row) => Number(row.id_staff) === selectedStaffId)
    : [];

  if (!filtered.length) {
    serviciosListEl.innerHTML = '';
    serviciosEmptyEl.classList.remove('hidden');
    return;
  }

  serviciosEmptyEl.classList.add('hidden');
  serviciosListEl.innerHTML = filtered.map((item) => {
    const statusClass = item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600';
    return `
      <article class="border border-gray-200 rounded-xl p-3 bg-white">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-gray-900">${escapeHtml(item.nombre || 'Servicio')}</p>
            <p class="text-xs text-gray-600 mt-1">${escapeHtml(item.descripcion || 'Sin descripción')}</p>
            <p class="text-xs text-gray-500 mt-1">Duración ${Math.max(15, Number(item.duracion_min || 60))} min · Precio ${escapeHtml(formatPriceText(item.precio))} · Orden ${Number(item.orden || 100)}</p>
          </div>
          <span class="text-xs px-2 py-1 rounded-full ${statusClass}">${item.activo ? 'activo' : 'inactivo'}</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" data-action="edit-servicio" data-id="${Number(item.id)}" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Editar</button>
          <button type="button" data-action="toggle-servicio" data-id="${Number(item.id)}" data-next="${item.activo ? '0' : '1'}" class="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold">${item.activo ? 'Desactivar' : 'Activar'}</button>
        </div>
      </article>
    `;
  }).join('');
}

async function loadServicios() {
  const selectedStaffId = toNumber(servicioStaffSelect?.value);
  if (!selectedStaffId) {
    serviciosList = [];
    renderServiciosList();
    renderStaffModalServicios();
    return;
  }

  const { data, error } = await supabase
    .from('ComercioStaffServicios')
    .select('id,id_staff,nombre,descripcion,duracion_min,precio,orden,activo,created_at')
    .eq('id_staff', selectedStaffId)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    if (isSchemaMissingError(error)) {
      showSchemaWarning(SCHEMA_MIGRATION_MESSAGE);
      serviciosList = [];
      renderServiciosList();
      renderStaffModalServicios();
      return;
    }
    throw error;
  }

  serviciosList = Array.isArray(data) ? data : [];
  renderServiciosList();
  renderStaffModalServicios();
}

async function saveServicio(event) {
  event.preventDefault();

  const id = toNumber(servicioIdInput.value);
  const staffId = toNumber(servicioStaffSelect.value);
  const nombre = cleanText(servicioNombreInput.value);
  if (!staffId) {
    showGlobalFeedback('Selecciona el profesional para este servicio.', 'warning');
    return;
  }
  if (!nombre) {
    showGlobalFeedback('El nombre del servicio es requerido.', 'warning');
    return;
  }

  const payload = {
    id_staff: staffId,
    nombre,
    descripcion: asNullable(servicioDescripcionInput.value),
    duracion_min: Math.min(480, Math.max(15, Math.floor(Number(servicioDuracionInput.value) || 60))),
    precio: cleanText(servicioPrecioInput.value),
    orden: Math.max(1, Math.floor(Number(servicioOrdenInput.value) || 100)),
    activo: !!servicioActivoInput.checked,
  };

  if (!payload.precio) {
    showGlobalFeedback('El precio o rango es requerido. Ejemplo: $25 o $20 - $35.', 'warning');
    return;
  }

  if (id) {
    const { error } = await supabase
      .from('ComercioStaffServicios')
      .update(payload)
      .eq('id', id)
      .eq('id_staff', staffId);
    if (error) throw error;
    showGlobalFeedback('Servicio actualizado.', 'success');
  } else {
    const { error } = await supabase
      .from('ComercioStaffServicios')
      .insert(payload);
    if (error) throw error;
    showGlobalFeedback('Servicio agregado.', 'success');
  }

  clearServicioForm();
  if (servicioStaffSelect) servicioStaffSelect.value = String(staffId);
  await loadServicios();
  closeModal(servicioModal);
}

async function toggleServicioActive(servicioId, nextActive) {
  const id = toNumber(servicioId);
  const staffId = toNumber(servicioStaffSelect?.value);
  if (!id || !staffId) return;

  const { error } = await supabase
    .from('ComercioStaffServicios')
    .update({ activo: nextActive })
    .eq('id', id)
    .eq('id_staff', staffId);

  if (error) throw error;
  showGlobalFeedback(nextActive ? 'Servicio activado.' : 'Servicio desactivado.', 'success');
  await loadServicios();
}

function renderCitasList() {
  if (!citasListEl || !citasEmptyEl) return;

  if (!citasList.length) {
    citasListEl.innerHTML = '';
    citasEmptyEl.classList.remove('hidden');
    return;
  }

  citasEmptyEl.classList.add('hidden');

  citasListEl.innerHTML = citasList.map((cita) => {
    const staffNombre = escapeHtml(currentStaffName(cita.id_staff));
    const status = cleanText(cita.estado).toLowerCase();
    const statusClass = getStatusBadgeClass(status);
    const fecha = formatDate(cita.fecha_cita);
    const acciones = [];

    if (status === 'pendiente') {
      acciones.push({ to: 'confirmada', label: 'Confirmar', cls: 'bg-sky-600 hover:bg-sky-700' });
      acciones.push({ to: 'rechazada', label: 'Rechazar', cls: 'bg-red-600 hover:bg-red-700' });
      acciones.push({ to: 'cancelada', label: 'Cancelar', cls: 'bg-gray-700 hover:bg-gray-800' });
    } else if (status === 'confirmada') {
      acciones.push({ to: 'completada', label: 'Completar', cls: 'bg-emerald-600 hover:bg-emerald-700' });
      acciones.push({ to: 'cancelada', label: 'Cancelar', cls: 'bg-gray-700 hover:bg-gray-800' });
    }

    const accionesHtml = acciones.map((action) => `
      <button type="button" data-action="cita-status" data-id="${Number(cita.id)}" data-next-status="${action.to}" class="px-3 py-1.5 rounded-lg text-white text-xs font-semibold ${action.cls}">${action.label}</button>
    `).join('');

    return `
      <article class="border border-gray-200 rounded-xl p-3 bg-white">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-gray-900">${escapeHtml(cita.cliente_nombre || 'Cliente')}</p>
            <p class="text-xs text-gray-600">${escapeHtml(cita.cliente_telefono || 'Sin teléfono')} · ${escapeHtml(cita.cliente_email || 'Sin email')}</p>
            <p class="text-xs text-gray-500 mt-1">${fecha} · ${escapeHtml(String(cita.hora_inicio || '').slice(0, 5))}-${escapeHtml(String(cita.hora_fin || '').slice(0, 5))}</p>
            <p class="text-xs text-gray-500">${staffNombre} · ${escapeHtml(cita.servicio || 'Sin servicio')}</p>
            <p class="text-xs text-gray-500">Canal: ${escapeHtml(cita.canal_origen || 'web_perfil')}</p>
          </div>
          <span class="text-xs px-2 py-1 rounded-full ${statusClass}">${escapeHtml(status)}</span>
        </div>
        ${cita.notas ? `<p class="text-xs text-gray-600 mt-2">Notas: ${escapeHtml(cita.notas)}</p>` : ''}
        ${accionesHtml ? `<div class="mt-3 flex flex-wrap gap-2">${accionesHtml}</div>` : ''}
      </article>
    `;
  }).join('');
}

async function loadCitas() {
  let query = supabase
    .from('ComercioCitas')
    .select('id,id_comercio,id_staff,cliente_nombre,cliente_telefono,cliente_email,servicio,notas,fecha_cita,hora_inicio,hora_fin,timezone,estado,canal_origen,created_at,updated_at')
    .eq('id_comercio', idComercio)
    .order('fecha_cita', { ascending: true })
    .order('hora_inicio', { ascending: true });

  const fromDate = cleanText(filtroFechaDesde?.value);
  const toDate = cleanText(filtroFechaHasta?.value);
  const staffId = toNumber(filtroStaff?.value);
  const estado = cleanText(filtroEstado?.value).toLowerCase();

  if (fromDate) query = query.gte('fecha_cita', fromDate);
  if (toDate) query = query.lte('fecha_cita', toDate);
  if (staffId) query = query.eq('id_staff', staffId);
  if (estado) query = query.eq('estado', estado);

  const { data, error } = await query;

  if (error) {
    if (isSchemaMissingError(error)) {
      showSchemaWarning(SCHEMA_MIGRATION_MESSAGE);
      citasSourceList = [];
      citasList = [];
      renderCitasList();
      renderCitasCalendar();
      return;
    }
    throw error;
  }

  citasSourceList = Array.isArray(data) ? data : [];
  applyCitasViewFilter();
}

async function updateCitaStatus(id, nextStatus) {
  const citaId = toNumber(id);
  if (!citaId) return;

  const { error } = await supabase
    .from('ComercioCitas')
    .update({ estado: nextStatus })
    .eq('id', citaId)
    .eq('id_comercio', idComercio);

  if (error) throw error;

  showGlobalFeedback(`Cita #${citaId} actualizada a ${nextStatus}.`, 'success');
  await loadCitas();
  await loadNotificaciones();
}

async function createManualCita(event) {
  event.preventDefault();

  const staffId = toNumber(citaManualStaff.value);
  const fecha = cleanText(citaManualFecha.value);
  const horaInicio = cleanText(citaManualHora.value);
  const duracion = Math.max(15, Math.min(240, Math.floor(Number(citaManualDuracion.value) || 60)));
  const horaFin = addMinutesToTime(horaInicio, duracion);

  if (!staffId || !fecha || !horaInicio || !horaFin) {
    showGlobalFeedback('Completa staff, fecha y hora para guardar la cita manual.', 'warning');
    return;
  }

  const payload = {
    id_comercio: idComercio,
    id_staff: staffId,
    id_usuario: null,
    cliente_nombre: cleanText(citaManualCliente.value),
    cliente_telefono: cleanText(citaManualTelefono.value),
    cliente_email: asNullable(citaManualEmail.value),
    servicio: asNullable(citaManualServicio.value),
    notas: asNullable(citaManualNotas.value),
    fecha_cita: fecha,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    timezone: 'America/Puerto_Rico',
    estado: cleanText(citaManualEstado.value) || 'pendiente',
    canal_origen: 'panel_comercio',
    recordatorio_minutos: 60,
  };

  if (!payload.cliente_nombre || !payload.cliente_telefono) {
    showGlobalFeedback('Nombre y teléfono del cliente son requeridos.', 'warning');
    return;
  }

  const { error } = await supabase
    .from('ComercioCitas')
    .insert(payload);

  if (error) {
    if (String(error.code || '').toUpperCase() === '23505') {
      showGlobalFeedback('Ese horario ya está ocupado para este profesional.', 'warning');
      return;
    }
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('row-level security')) {
      showGlobalFeedback('No tienes policy de insert para comercio en ComercioCitas. Aplica la migración más reciente.', 'error');
      return;
    }
    throw error;
  }

  showGlobalFeedback('Cita manual creada.', 'success');
  citaManualForm.reset();
  citaManualDuracion.value = '60';
  citaManualFecha.value = toIsoDate(new Date());
  citaManualHora.value = '09:00';
  await loadCitas();
  await loadNotificaciones();
}

function renderNotificacionesList() {
  if (!notificacionesListEl || !notificacionesEmptyEl) return;

  if (!notificacionesList.length) {
    notificacionesListEl.innerHTML = '';
    notificacionesEmptyEl.classList.remove('hidden');
    return;
  }

  notificacionesEmptyEl.classList.add('hidden');
  notificacionesListEl.innerHTML = notificacionesList.map((item) => {
    const badge = getStatusBadgeClass(item.estado);
    const payloadText = cleanText(item.payload?.message || item.payload?.subject || '');
    const citaInfo = item.cita
      ? `${formatDate(item.cita.fecha_cita)} ${String(item.cita.hora_inicio || '').slice(0, 5)} · ${item.cita.cliente_nombre || 'Cliente'}`
      : `Cita #${item.id_cita}`;

    return `
      <article class="border border-gray-200 rounded-xl p-3 bg-white">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-sm font-semibold text-gray-900">${escapeHtml(item.destinatario)} · ${escapeHtml(item.canal)}</p>
            <p class="text-xs text-gray-600">Destino: ${escapeHtml(item.destino || '—')}</p>
            <p class="text-xs text-gray-500 mt-1">${escapeHtml(citaInfo)}</p>
            <p class="text-xs text-gray-500">Programada: ${escapeHtml(formatDateTime(item.scheduled_at))}</p>
            ${item.sent_at ? `<p class="text-xs text-gray-500">Enviada: ${escapeHtml(formatDateTime(item.sent_at))}</p>` : ''}
            ${payloadText ? `<p class="text-xs text-gray-600 mt-1">${escapeHtml(payloadText)}</p>` : ''}
            ${item.error_text ? `<p class="text-xs text-red-600 mt-1">Error: ${escapeHtml(item.error_text)}</p>` : ''}
          </div>
          <span class="text-xs px-2 py-1 rounded-full ${badge}">${escapeHtml(item.estado || 'pendiente')}</span>
        </div>
      </article>
    `;
  }).join('');
}

async function loadNotificaciones() {
  const { data: citasData, error: citasError } = await supabase
    .from('ComercioCitas')
    .select('id,fecha_cita,hora_inicio,cliente_nombre')
    .eq('id_comercio', idComercio)
    .order('fecha_cita', { ascending: false })
    .limit(300);

  if (citasError) {
    if (isSchemaMissingError(citasError)) {
      showSchemaWarning(SCHEMA_MIGRATION_MESSAGE);
      notificacionesList = [];
      renderNotificacionesList();
      return;
    }
    throw citasError;
  }

  const citas = Array.isArray(citasData) ? citasData : [];
  const ids = citas.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0);
  const citaMap = new Map(citas.map((row) => [Number(row.id), row]));

  if (!ids.length) {
    notificacionesList = [];
    renderNotificacionesList();
    return;
  }

  const { data, error } = await supabase
    .from('ComercioCitasNotificaciones')
    .select('id,id_cita,destinatario,canal,destino,payload,estado,error_text,scheduled_at,sent_at,created_at')
    .in('id_cita', ids)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    if (isSchemaMissingError(error)) {
      showSchemaWarning(SCHEMA_MIGRATION_MESSAGE);
      notificacionesList = [];
      renderNotificacionesList();
      return;
    }
    throw error;
  }

  notificacionesList = (Array.isArray(data) ? data : []).map((row) => ({
    ...row,
    cita: citaMap.get(Number(row.id_cita)) || null,
  }));

  renderNotificacionesList();
}

function bindEvents() {
  btnStaffModalClose?.addEventListener('click', () => closeModal(staffModal));
  btnTrabajoModalClose?.addEventListener('click', () => closeModal(trabajoModal));
  btnServicioModalClose?.addEventListener('click', () => closeModal(servicioModal));

  document.addEventListener('click', (event) => {
    const closer = event.target.closest('[data-close-modal]');
    if (!closer) return;
    const modalType = cleanText(closer.getAttribute('data-close-modal'));
    if (modalType === 'staff') closeModal(staffModal);
    if (modalType === 'trabajo') closeModal(trabajoModal);
    if (modalType === 'servicio') closeModal(servicioModal);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeModal(staffModal);
    closeModal(trabajoModal);
    closeModal(servicioModal);
  });

  btnStaffNuevo?.addEventListener('click', () => {
    clearStaffForm();
    renderStaffModalServicios();
    renderStaffModalTrabajos();
    if (staffModalTitle) staffModalTitle.textContent = 'Nuevo profesional';
    openModal(staffModal);
    showGlobalFeedback('Formulario de staff listo para crear nuevo profesional.', 'info');
  });

  btnStaffLimpiar?.addEventListener('click', () => {
    clearStaffForm();
    renderStaffModalServicios();
    renderStaffModalTrabajos();
    showGlobalFeedback('', 'info');
  });

  staffForm?.addEventListener('submit', async (event) => {
    try {
      await saveStaff(event);
    } catch (error) {
      console.error('Error guardando staff:', error);
      showGlobalFeedback(error.message || 'No se pudo guardar el profesional.', 'error');
    }
  });

  staffListEl?.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = toNumber(btn.getAttribute('data-id'));
    if (!id) return;

    try {
      if (action === 'edit-staff') {
        const item = staffById.get(id);
        fillStaffForm(item);
        await refreshStaffModalServicios(id);
        await refreshStaffModalTrabajos(id);
        if (staffModalTitle) staffModalTitle.textContent = `Editar profesional · ${item?.nombre || `#${id}`}`;
        openModal(staffModal);
        showGlobalFeedback(`Editando: ${item?.nombre || 'profesional'}.`, 'info');
      }

      if (action === 'toggle-staff') {
        const next = btn.getAttribute('data-next') === '1';
        await toggleStaffActive(id, next);
      }
    } catch (error) {
      console.error('Error acción staff:', error);
      showGlobalFeedback(error.message || 'No se pudo completar la acción de staff.', 'error');
    }
  });

  btnStaffModalNuevoServicio?.addEventListener('click', async () => {
    const staffId = currentEditingStaffId();
    if (!staffId) {
      showGlobalFeedback('Primero guarda el profesional para poder agregar servicios.', 'warning');
      return;
    }

    if (servicioStaffSelect) servicioStaffSelect.value = String(staffId);
    clearServicioForm();
    if (servicioStaffSelect) servicioStaffSelect.value = String(staffId);
    if (servicioModalTitle) servicioModalTitle.textContent = 'Nuevo servicio';
    openModal(servicioModal);
  });

  btnStaffTrabajosSubir?.addEventListener('click', async () => {
    const staffId = currentEditingStaffId();
    if (!staffId) {
      showGlobalFeedback('Primero guarda el profesional para poder subir galería.', 'warning');
      return;
    }

    try {
      await uploadStaffTrabajosFiles(staffId, staffTrabajoFilesInput?.files || []);
    } catch (error) {
      console.error('Error subiendo imágenes de galería:', error);
      showGlobalFeedback(error.message || 'No se pudieron subir las imágenes.', 'error');
    }
  });

  staffTrabajosListEl?.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const action = cleanText(btn.getAttribute('data-action'));
    const trabajoId = toNumber(btn.getAttribute('data-id'));
    const staffId = currentEditingStaffId();
    if (!trabajoId || !staffId) return;

    try {
      if (trabajoStaffSelect) trabajoStaffSelect.value = String(staffId);

      if (action === 'toggle-staff-modal-trabajo') {
        const next = btn.getAttribute('data-next') === '1';
        await toggleTrabajoActive(trabajoId, next);
      }

      if (action === 'delete-staff-modal-trabajo') {
        const confirmed = window.confirm('¿Eliminar esta imagen de la galería?');
        if (!confirmed) return;
        await deleteTrabajo(trabajoId, staffId);
      }
    } catch (error) {
      console.error('Error acción galería en modal staff:', error);
      showGlobalFeedback(error.message || 'No se pudo completar la acción de galería.', 'error');
    }
  });

  staffModalServiciosListEl?.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const action = cleanText(btn.getAttribute('data-action'));
    const id = toNumber(btn.getAttribute('data-id'));
    const staffId = currentEditingStaffId();
    if (!id || !staffId) return;

    try {
      if (servicioStaffSelect) servicioStaffSelect.value = String(staffId);

      if (action === 'edit-staff-modal-servicio') {
        const item = serviciosList.find((row) => Number(row.id) === id);
        fillServicioForm(item);
        if (servicioModalTitle) servicioModalTitle.textContent = `Editar servicio #${id}`;
        openModal(servicioModal);
      }

      if (action === 'toggle-staff-modal-servicio') {
        const next = btn.getAttribute('data-next') === '1';
        await toggleServicioActive(id, next);
      }
    } catch (error) {
      console.error('Error acción servicio en modal staff:', error);
      showGlobalFeedback(error.message || 'No se pudo completar la acción del servicio.', 'error');
    }
  });

  btnTrabajoNuevo?.addEventListener('click', () => {
    clearTrabajoForm();
    if (trabajoModalTitle) trabajoModalTitle.textContent = 'Nuevo trabajo de galería';
    openModal(trabajoModal);
    showGlobalFeedback('Formulario de galería listo para crear un trabajo.', 'info');
  });

  trabajoStaffSelect?.addEventListener('change', async () => {
    try {
      clearTrabajoForm();
      await loadTrabajos();
    } catch (error) {
      console.error('Error cargando trabajos por staff:', error);
      showGlobalFeedback(error.message || 'No se pudieron cargar los trabajos.', 'error');
    }
  });

  btnTrabajoLimpiar?.addEventListener('click', () => {
    clearTrabajoForm();
    showGlobalFeedback('', 'info');
  });

  trabajoForm?.addEventListener('submit', async (event) => {
    try {
      await saveTrabajo(event);
    } catch (error) {
      console.error('Error guardando trabajo:', error);
      showGlobalFeedback(error.message || 'No se pudo guardar el trabajo.', 'error');
    }
  });

  trabajosListEl?.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = toNumber(btn.getAttribute('data-id'));
    if (!id) return;

    try {
      if (action === 'edit-trabajo') {
        const item = trabajosList.find((row) => Number(row.id) === id);
        fillTrabajoForm(item);
        if (trabajoModalTitle) trabajoModalTitle.textContent = `Editar trabajo #${id}`;
        openModal(trabajoModal);
        showGlobalFeedback(`Editando trabajo #${id}.`, 'info');
      }

      if (action === 'toggle-trabajo') {
        const next = btn.getAttribute('data-next') === '1';
        await toggleTrabajoActive(id, next);
      }
    } catch (error) {
      console.error('Error acción trabajo:', error);
      showGlobalFeedback(error.message || 'No se pudo completar la acción del trabajo.', 'error');
    }
  });

  btnServicioNuevo?.addEventListener('click', () => {
    clearServicioForm();
    if (servicioModalTitle) servicioModalTitle.textContent = 'Nuevo servicio';
    openModal(servicioModal);
    showGlobalFeedback('Formulario de servicios listo para crear un nuevo servicio.', 'info');
  });

  servicioStaffSelect?.addEventListener('change', async () => {
    try {
      clearServicioForm();
      await loadServicios();
    } catch (error) {
      console.error('Error cargando servicios por staff:', error);
      showGlobalFeedback(error.message || 'No se pudieron cargar los servicios.', 'error');
    }
  });

  btnServicioLimpiar?.addEventListener('click', () => {
    clearServicioForm();
    showGlobalFeedback('', 'info');
  });

  servicioForm?.addEventListener('submit', async (event) => {
    try {
      await saveServicio(event);
    } catch (error) {
      console.error('Error guardando servicio:', error);
      showGlobalFeedback(error.message || 'No se pudo guardar el servicio.', 'error');
    }
  });

  serviciosListEl?.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const id = toNumber(btn.getAttribute('data-id'));
    if (!id) return;

    try {
      if (action === 'edit-servicio') {
        const item = serviciosList.find((row) => Number(row.id) === id);
        fillServicioForm(item);
        if (servicioModalTitle) servicioModalTitle.textContent = `Editar servicio #${id}`;
        openModal(servicioModal);
        showGlobalFeedback(`Editando servicio #${id}.`, 'info');
      }

      if (action === 'toggle-servicio') {
        const next = btn.getAttribute('data-next') === '1';
        await toggleServicioActive(id, next);
      }
    } catch (error) {
      console.error('Error acción servicio:', error);
      showGlobalFeedback(error.message || 'No se pudo completar la acción del servicio.', 'error');
    }
  });

  const recargarCitas = async () => {
    try {
      syncCalendarMonthFromFilters();
      keepCalendarDayInRange();
      await loadCitas();
    } catch (error) {
      console.error('Error recargando citas:', error);
      showGlobalFeedback(error.message || 'No se pudieron cargar las citas.', 'error');
    }
  };

  const handleDateFilterChange = async () => {
    syncCalendarMonthFromFilters();
    keepCalendarDayInRange();
    await recargarCitas();
  };

  filtroFechaDesde?.addEventListener('change', handleDateFilterChange);
  filtroFechaHasta?.addEventListener('change', handleDateFilterChange);
  filtroStaff?.addEventListener('change', recargarCitas);
  filtroEstado?.addEventListener('change', recargarCitas);
  btnCitasRecargar?.addEventListener('click', recargarCitas);

  btnCalendarPrevMonth?.addEventListener('click', async () => {
    const base = calendarMonthAnchor || monthStart(new Date());
    calendarSelectedDay = '';
    setDateFiltersForCalendarMonth(new Date(base.getFullYear(), base.getMonth() - 1, 1));
    await recargarCitas();
  });

  btnCalendarNextMonth?.addEventListener('click', async () => {
    const base = calendarMonthAnchor || monthStart(new Date());
    calendarSelectedDay = '';
    setDateFiltersForCalendarMonth(new Date(base.getFullYear(), base.getMonth() + 1, 1));
    await recargarCitas();
  });

  btnCalendarToday?.addEventListener('click', async () => {
    calendarSelectedDay = '';
    setDateFiltersForCalendarMonth(new Date());
    await recargarCitas();
  });

  btnCalendarClearDay?.addEventListener('click', () => {
    calendarSelectedDay = '';
    applyCitasViewFilter();
  });

  calendarCitasGrid?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="calendar-day"]');
    if (!button) return;

    const selectedDate = cleanText(button.getAttribute('data-date'));
    if (!selectedDate) return;

    calendarSelectedDay = selectedDate === calendarSelectedDay ? '' : selectedDate;
    applyCitasViewFilter();
  });

  citaManualForm?.addEventListener('submit', async (event) => {
    try {
      await createManualCita(event);
    } catch (error) {
      console.error('Error creando cita manual:', error);
      showGlobalFeedback(error.message || 'No se pudo crear la cita manual.', 'error');
    }
  });

  citasListEl?.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="cita-status"]');
    if (!btn) return;

    const id = toNumber(btn.getAttribute('data-id'));
    const nextStatus = cleanText(btn.getAttribute('data-next-status')).toLowerCase();
    if (!id || !nextStatus) return;

    try {
      await updateCitaStatus(id, nextStatus);
    } catch (error) {
      console.error('Error actualizando estatus de cita:', error);
      showGlobalFeedback(error.message || 'No se pudo actualizar la cita.', 'error');
    }
  });

  btnNotifRecargar?.addEventListener('click', async () => {
    try {
      await loadNotificaciones();
    } catch (error) {
      console.error('Error recargando notificaciones:', error);
      showGlobalFeedback(error.message || 'No se pudieron cargar notificaciones.', 'error');
    }
  });
}

async function init() {
  renderAgendaRows();
  resetAgendaInputs();
  clearStaffForm();
  renderStaffModalServicios();
  renderStaffModalTrabajos();
  clearTrabajoForm();
  clearServicioForm();
  setDefaultDateFilters();
  bindEvents();

  const ok = await validateAccessOrRedirect();
  if (!ok) return;

  try {
    await loadStaff();

    if (!cleanText(trabajoStaffSelect?.value) && staffList.length) {
      if (trabajoStaffSelect) trabajoStaffSelect.value = String(staffList[0].id);
    }

    if (!cleanText(citaManualStaff.value) && staffList.length) {
      const firstActive = staffList.find((row) => row.activo !== false);
      if (firstActive) citaManualStaff.value = String(firstActive.id);
    }

    if (!cleanText(servicioStaffSelect?.value) && staffList.length) {
      servicioStaffSelect.value = String(staffList[0].id);
    }

    await loadTrabajos();
    await loadServicios();
    await loadCitas();
    await loadNotificaciones();
  } catch (error) {
    console.error('Error inicializando Staff/Citas:', error);
    showGlobalFeedback(error.message || 'No se pudo inicializar el módulo de Staff/Citas.', 'error');
  }
}

void init();
