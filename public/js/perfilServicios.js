import { supabase } from '../shared/supabaseClient.js';

const CATEGORIAS_SERVICIOS_FALLBACK = new Set([
  'salon de belleza',
  'salon de bellezas',
  'tecnicas de unas',
  'tecnica de unas',
  'barberias',
  'barberia',
  'esteticas',
  'estetica',
  'spa',
]);
const isLocalEnv = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const LOGIN_URL = isLocalEnv ? '/public/logearse.html' : '/logearse.html';

const STAFF_PHOTO_PLACEHOLDER = 'https://placehold.co/240x240?text=Staff';
const STAFF_WORK_PLACEHOLDER = 'https://placehold.co/420x320?text=Trabajo';

const DEFAULT_AGENDA = {
  timezone: 'America/Puerto_Rico',
  slot_minutes: 60,
  buffer_minutes: 0,
  dias: {
    1: [{ inicio: '09:00', fin: '17:00' }],
    2: [{ inicio: '09:00', fin: '17:00' }],
    3: [{ inicio: '09:00', fin: '17:00' }],
    4: [{ inicio: '09:00', fin: '17:00' }],
    5: [{ inicio: '09:00', fin: '17:00' }],
    6: [{ inicio: '09:00', fin: '14:00' }],
  },
};

const state = {
  idComercio: null,
  comercio: null,
  tipoPerfil: 'menu',
  staffList: [],
  staffById: new Map(),
  trabajosByStaff: new Map(),
  activeStaffId: null,
  activeStaffName: '',
  selectedDate: '',
  selectedTime: '',
  calendarMonthAnchor: null,
  calendarMonthCache: new Map(),
  modalBound: false,
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function normalizeExternalUrl(value) {
  const clean = sanitizeText(value);
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean) || /^mailto:/i.test(clean) || /^tel:/i.test(clean)) return clean;
  return `https://${clean}`;
}

function normalizeWhatsappUrl(value) {
  const clean = sanitizeText(value);
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean) || /^whatsapp:/i.test(clean)) return clean;
  const digits = clean.replace(/\D+/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}`;
}

function normalizePhoneHref(value) {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  return `tel:${digits}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toHHmm(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function toMinutes(hhmm) {
  const clean = toHHmm(hhmm);
  if (!clean) return null;
  const [h, m] = clean.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToHHmm(total) {
  const value = Number(total);
  if (!Number.isFinite(value) || value < 0) return '';
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime12h(hhmm) {
  const clean = toHHmm(hhmm);
  if (!clean) return '';
  const [rawHour, rawMinute] = clean.split(':').map(Number);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return clean;

  const suffix = rawHour >= 12 ? 'PM' : 'AM';
  const hour12 = rawHour % 12 || 12;
  return `${hour12}:${String(rawMinute).padStart(2, '0')} ${suffix}`;
}

function formatDateISO(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLong(dateISO) {
  const date = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateISO;
  return new Intl.DateTimeFormat('es-PR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateForSlotsTitle(dateISO) {
  const date = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateISO;
  return new Intl.DateTimeFormat('es-PR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date).replace(',', '');
}

function formatMonthLabel(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-PR', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function firstDayOfMonth(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastDayOfMonth(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(dateObj, delta = 0) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  return new Date(d.getFullYear(), d.getMonth() + Number(delta || 0), 1);
}

function getDayNumberFromDateISO(dateISO) {
  const date = new Date(`${dateISO}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getDay();
}

function overlaps(slotStart, slotEnd, rangeStart, rangeEnd) {
  return slotStart < rangeEnd && rangeStart < slotEnd;
}

function normalizeAgendaConfig(raw) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const slotMinutes = Number(input.slot_minutes);
  const bufferMinutes = Number(input.buffer_minutes);
  const timezone = sanitizeText(input.timezone) || DEFAULT_AGENDA.timezone;

  const safeSlot = Number.isFinite(slotMinutes) && slotMinutes >= 15 && slotMinutes <= 240 ? Math.floor(slotMinutes) : DEFAULT_AGENDA.slot_minutes;
  const safeBuffer = Number.isFinite(bufferMinutes) && bufferMinutes >= 0 && bufferMinutes <= 180 ? Math.floor(bufferMinutes) : DEFAULT_AGENDA.buffer_minutes;

  const dias = {};
  for (let day = 0; day <= 6; day += 1) {
    const source = Array.isArray(input?.dias?.[day]) ? input.dias[day] : DEFAULT_AGENDA.dias?.[day] || [];
    dias[day] = source
      .map((interval) => {
        const inicio = toHHmm(interval?.inicio);
        const fin = toHHmm(interval?.fin);
        const iniMin = toMinutes(inicio);
        const finMin = toMinutes(fin);
        if (iniMin == null || finMin == null || iniMin >= finMin) return null;
        return { inicio, fin, iniMin, finMin };
      })
      .filter(Boolean);
  }

  return {
    timezone,
    slot_minutes: safeSlot,
    buffer_minutes: safeBuffer,
    dias,
  };
}

function buildSlotsFromAgenda(agenda, dateISO, bookedIntervals = []) {
  const day = getDayNumberFromDateISO(dateISO);
  if (day == null) return [];

  const intervals = Array.isArray(agenda?.dias?.[day]) ? agenda.dias[day] : [];
  if (!intervals.length) return [];

  const step = Math.max(agenda.slot_minutes + agenda.buffer_minutes, agenda.slot_minutes, 15);
  const slots = [];

  intervals.forEach((interval) => {
    for (let start = interval.iniMin; start + agenda.slot_minutes <= interval.finMin; start += step) {
      const end = start + agenda.slot_minutes;
      const isBooked = bookedIntervals.some((booked) => overlaps(start, end, booked.start, booked.end));
      if (!isBooked) {
        slots.push({
          hora: minutesToHHmm(start),
          inicioMin: start,
          finMin: end,
        });
      }
    }
  });

  return slots;
}

function showSection(show) {
  const section = document.getElementById('seccionStaffServicios');
  if (!section) return;
  section.classList.toggle('hidden', !show);
}

function getCategoriasFromComercioData(comercio) {
  const relaciones = Array.isArray(comercio?.ComercioCategorias) ? comercio.ComercioCategorias : [];
  const nombres = relaciones
    .map((rel) => rel?.categoria?.nombre || rel?.Categorias?.nombre || rel?.nombre || '')
    .filter(Boolean);

  if (comercio?.categoria) nombres.push(comercio.categoria);

  return nombres.map((nombre) => ({ nombre }));
}

async function fetchCategoriasComercio(idComercio) {
  const id = Number(idComercio);
  if (!Number.isFinite(id) || id <= 0) return [];

  const { data: relaciones, error: relError } = await supabase
    .from('ComercioCategorias')
    .select('idCategoria')
    .eq('idComercio', id);

  if (relError) {
    console.warn('No se pudo cargar relacion de categorias para perfil servicios:', relError?.message || relError);
    return [];
  }

  const ids = Array.from(
    new Set(
      (relaciones || [])
        .map((row) => Number(row?.idCategoria))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );

  if (!ids.length) return [];

  let { data, error } = await supabase
    .from('Categorias')
    .select('id, nombre, tipo_perfil')
    .in('id', ids);

  if (error && /tipo_perfil/i.test(String(error.message || error.details || ''))) {
    const fallback = await supabase
      .from('Categorias')
      .select('id, nombre')
      .in('id', ids);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.warn('No se pudieron cargar categorias para perfil servicios:', error?.message || error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function resolveTipoPerfilComercio(categorias = []) {
  let hasServicios = false;

  for (const categoria of categorias) {
    const tipoPerfil = normalizeText(categoria?.tipo_perfil);
    if (tipoPerfil === 'servicios') hasServicios = true;
    if (tipoPerfil === 'tienda') return 'tienda';

    const nombre = normalizeText(categoria?.nombre);
    if (CATEGORIAS_SERVICIOS_FALLBACK.has(nombre)) hasServicios = true;
  }

  return hasServicios ? 'servicios' : 'menu';
}

async function fetchStaff(idComercio) {
  const id = Number(idComercio);
  if (!Number.isFinite(id) || id <= 0) return [];

  const { data, error } = await supabase
    .from('ComercioStaff')
    .select('id,id_comercio,nombre,profesion,foto_url,telefono,email,facebook,instagram,whatsapp,biografia,agenda_config,orden,activo')
    .eq('id_comercio', id)
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.warn('No se pudo cargar staff del comercio:', error?.message || error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function fetchStaffTrabajos(staffIds = []) {
  const ids = Array.from(new Set((staffIds || []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)));
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('ComercioStaffTrabajos')
    .select('id,id_staff,media_url,titulo,descripcion,orden,activo')
    .in('id_staff', ids)
    .eq('activo', true)
    .order('orden', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.warn('No se pudo cargar galeria de staff:', error?.message || error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

async function fetchBookedIntervals(staffId, dateISO) {
  const id = Number(staffId);
  if (!Number.isFinite(id) || id <= 0 || !dateISO) return [];

  const { data, error } = await supabase
    .from('ComercioCitas')
    .select('hora_inicio,hora_fin,estado')
    .eq('id_staff', id)
    .eq('fecha_cita', dateISO)
    .in('estado', ['pendiente', 'confirmada']);

  if (error) {
    console.warn('No se pudo cargar bloqueos de citas:', error?.message || error);
    return [];
  }

  return (data || [])
    .map((row) => {
      const start = toMinutes(row?.hora_inicio);
      const end = toMinutes(row?.hora_fin);
      if (start == null || end == null || start >= end) return null;
      return { start, end };
    })
    .filter(Boolean);
}

async function fetchBookedIntervalsRange(staffId, fromDateISO, toDateISO) {
  const id = Number(staffId);
  if (!Number.isFinite(id) || id <= 0 || !fromDateISO || !toDateISO) return [];

  const { data, error } = await supabase
    .from('ComercioCitas')
    .select('fecha_cita,hora_inicio,hora_fin,estado')
    .eq('id_staff', id)
    .gte('fecha_cita', fromDateISO)
    .lte('fecha_cita', toDateISO)
    .in('estado', ['pendiente', 'confirmada']);

  if (error) {
    console.warn('No se pudo cargar bloqueos por rango para calendario:', error?.message || error);
    return [];
  }

  return Array.isArray(data) ? data : [];
}

function getActiveStaff() {
  const id = Number(state.activeStaffId);
  return state.staffById.get(id) || null;
}

function setFeedback(type, message) {
  const feedback = document.getElementById('citaFeedback');
  if (!feedback) return;

  if (!message) {
    feedback.classList.add('hidden');
    feedback.textContent = '';
    feedback.className = 'hidden text-xs mt-2';
    return;
  }

  feedback.classList.remove('hidden');
  feedback.textContent = message;
  feedback.className = 'text-xs mt-2';

  if (type === 'error') {
    feedback.classList.add('text-red-600');
  } else if (type === 'success') {
    feedback.classList.add('text-[#b86600]');
  } else {
    feedback.classList.add('text-gray-600');
  }
}

function updateSelectedLabels() {
  const fechaLabel = document.getElementById('citaFechaLabel');
  const horaLabel = document.getElementById('citaHoraLabel');
  const inputFecha = document.getElementById('citaFecha');
  const inputHora = document.getElementById('citaHora');

  if (fechaLabel) {
    fechaLabel.textContent = state.selectedDate ? formatDateLong(state.selectedDate) : 'Sin seleccionar';
  }
  if (horaLabel) {
    horaLabel.textContent = state.selectedTime ? formatTime12h(state.selectedTime) : 'Sin seleccionar';
  }
  if (inputFecha) inputFecha.value = state.selectedDate;
  if (inputHora) inputHora.value = state.selectedTime;
}

function renderStaffCards() {
  const grid = document.getElementById('staffServiciosGrid');
  const empty = document.getElementById('staffServiciosEmpty');
  const swipeHint = document.getElementById('staffSwipeHint');
  if (!grid || !empty) return;

  if (!state.staffList.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    swipeHint?.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  swipeHint?.classList.toggle('hidden', state.staffList.length <= 3);

  grid.innerHTML = state.staffList.map((staff) => {
    const foto = sanitizeText(staff.foto_url) || STAFF_PHOTO_PLACEHOLDER;
    const nombreRaw = sanitizeText(staff.nombre || 'Profesional');
    const nombreTokens = nombreRaw.split(/\s+/).filter(Boolean);
    const nombreLinea1 = escapeHtml(nombreTokens[0] || 'Profesional');
    const nombreLinea2 = escapeHtml(nombreTokens[1] || '');
    const profesion = escapeHtml(staff.profesion || 'Staff');

    return `
      <article
        class="snap-start shrink-0 rounded-xl border border-gray-200 px-2 pt-1.5 pb-2 flex flex-col justify-between items-center text-center bg-white shadow-sm cursor-pointer select-none h-[182px]"
        style="flex: 0 0 calc((100% - 1rem) / 3);"
        data-action="abrir-staff-card"
        data-staff-id="${Number(staff.id)}"
        tabindex="0"
        role="button"
        aria-label="Abrir perfil de ${escapeHtml(nombreRaw)}"
      >
        <div class="w-full flex flex-col items-center gap-1.5">
          <img src="${escapeHtml(foto)}" alt="${escapeHtml(nombreRaw)}" class="w-20 h-20 rounded-xl object-cover border border-gray-200">
          <div class="w-full min-h-[50px] flex flex-col items-center justify-center text-center">
            <p class="w-full text-center text-sm font-normal text-gray-800 leading-tight h-[16px] overflow-hidden">${nombreLinea1}</p>
            <p class="w-full text-center text-sm font-normal text-gray-800 leading-tight h-[16px] overflow-hidden">${nombreLinea2 || '&nbsp;'}</p>
            <p class="text-[11px] text-gray-500 leading-tight h-[14px] overflow-hidden">${profesion}</p>
          </div>
        </div>
        <div class="w-full rounded-lg bg-[#121212] text-white text-[11px] font-normal py-1">Ver perfil y citas</div>
      </article>
    `;
  }).join('');

  grid.scrollLeft = 0;
}

function updateModalStickyName() {
  const panel = document.getElementById('modalStaffPanel');
  const stickyName = document.getElementById('modalStaffStickyName');
  if (!panel || !stickyName) return;

  const name = sanitizeText(state.activeStaffName);
  if (!name) {
    stickyName.textContent = '';
    return;
  }

  stickyName.textContent = panel.scrollTop > 84 ? name : '';
}

function renderStaffContacts(staff) {
  const contactContainer = document.getElementById('staffModalContacto');
  const socialContainer = document.getElementById('staffModalRedes');
  if (!contactContainer || !socialContainer) return;

  const contactLinks = [];
  const socialLinks = [];

  const telHref = normalizePhoneHref(staff.telefono);
  if (telHref) contactLinks.push({ href: telHref, label: 'Telefono', icon: 'fa-solid fa-phone' });

  const whatsappHref = normalizeWhatsappUrl(staff.whatsapp || staff.telefono);
  if (whatsappHref) contactLinks.push({ href: whatsappHref, label: 'WhatsApp', icon: 'fa-brands fa-whatsapp' });

  const email = sanitizeText(staff.email);
  if (email) contactLinks.push({ href: `mailto:${email}`, label: 'Email', icon: 'fa-regular fa-envelope' });

  const facebookHref = normalizeExternalUrl(staff.facebook);
  if (facebookHref) socialLinks.push({ href: facebookHref, label: 'Facebook', icon: 'fa-brands fa-facebook-f' });

  const instagramHref = normalizeExternalUrl(staff.instagram);
  if (instagramHref) socialLinks.push({ href: instagramHref, label: 'Instagram', icon: 'fa-brands fa-instagram' });

  contactContainer.innerHTML = !contactLinks.length
    ? '<p class="text-xs text-gray-500">Sin datos de contacto publicados.</p>'
    : contactLinks.map((link) => `
      <a
        href="${escapeHtml(link.href)}"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-sm font-normal text-gray-700 hover:bg-gray-50"
      >
        <i class="${escapeHtml(link.icon)}"></i>
        <span>${escapeHtml(link.label)}</span>
      </a>
    `).join('');

  socialContainer.innerHTML = !socialLinks.length
    ? '<p class="text-xs text-gray-500">Sin redes sociales publicadas.</p>'
    : socialLinks.map((link) => `
      <a
        href="${escapeHtml(link.href)}"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-sm font-normal text-gray-700 hover:bg-gray-50"
      >
        <i class="${escapeHtml(link.icon)}"></i>
        <span>${escapeHtml(link.label)}</span>
      </a>
    `).join('');
}

function renderStaffGallery(staffId) {
  const gallery = document.getElementById('staffModalGaleria');
  const empty = document.getElementById('staffModalGaleriaVacia');
  if (!gallery || !empty) return;

  const trabajos = state.trabajosByStaff.get(Number(staffId)) || [];
  if (!trabajos.length) {
    gallery.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  gallery.innerHTML = trabajos.map((item) => {
    const image = sanitizeText(item.media_url) || STAFF_WORK_PLACEHOLDER;
    const titulo = sanitizeText(item.titulo) || 'Trabajo';
    return `
      <a href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer" class="shrink-0">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(titulo)}" class="w-28 h-20 rounded-lg object-cover border border-gray-200">
      </a>
    `;
  }).join('');
}

function buildBookedByDateMap(rows = []) {
  const map = new Map();

  (rows || []).forEach((row) => {
    const dateISO = sanitizeText(row?.fecha_cita);
    if (!dateISO) return;

    const start = toMinutes(row?.hora_inicio);
    const end = toMinutes(row?.hora_fin);
    if (start == null || end == null || start >= end) return;

    if (!map.has(dateISO)) map.set(dateISO, []);
    map.get(dateISO).push({ start, end });
  });

  return map;
}

function getMonthCacheKey(staffId, monthStartISO) {
  return `${Number(staffId)}:${monthStartISO}`;
}

async function getMonthAvailability(staff, monthAnchorDate) {
  const monthStart = firstDayOfMonth(monthAnchorDate);
  const monthEnd = lastDayOfMonth(monthStart);
  const fromISO = formatDateISO(monthStart);
  const toISO = formatDateISO(monthEnd);
  const cacheKey = getMonthCacheKey(staff.id, fromISO);
  const cached = state.calendarMonthCache.get(cacheKey);
  if (cached) return cached;

  const rows = await fetchBookedIntervalsRange(staff.id, fromISO, toISO);
  const bookedByDate = buildBookedByDateMap(rows);
  const agenda = normalizeAgendaConfig(staff.agenda_config);
  const todayISO = formatDateISO(new Date());
  const dayInfo = new Map();
  let firstAvailableDate = '';

  const totalDays = monthEnd.getDate();
  for (let day = 1; day <= totalDays; day += 1) {
    const dateObj = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const dateISO = formatDateISO(dateObj);
    if (!dateISO) continue;

    let slots = [];
    if (dateISO >= todayISO) {
      const booked = bookedByDate.get(dateISO) || [];
      const nowMinutes = dateISO === todayISO ? ((new Date().getHours() * 60) + new Date().getMinutes()) : null;
      slots = buildSlotsFromAgenda(agenda, dateISO, booked)
        .filter((slot) => nowMinutes == null || slot.inicioMin > (nowMinutes + 4));
    }

    const available = slots.length > 0;
    if (available && !firstAvailableDate) firstAvailableDate = dateISO;

    dayInfo.set(dateISO, {
      available,
      slotsCount: slots.length,
    });
  }

  const payload = {
    monthStart,
    monthEnd,
    fromISO,
    toISO,
    dayInfo,
    bookedByDate,
    firstAvailableDate,
  };

  state.calendarMonthCache.set(cacheKey, payload);
  return payload;
}

async function renderCalendarDays() {
  const container = document.getElementById('calendarioCitasDias');
  const label = document.getElementById('calendarioCitasMesLabel');
  const empty = document.getElementById('calendarioCitasDiasVacio');
  const staff = getActiveStaff();
  if (!container || !staff) return;

  if (!(state.calendarMonthAnchor instanceof Date) || Number.isNaN(state.calendarMonthAnchor.getTime())) {
    state.calendarMonthAnchor = firstDayOfMonth(new Date());
  } else {
    state.calendarMonthAnchor = firstDayOfMonth(state.calendarMonthAnchor);
  }

  const monthData = await getMonthAvailability(staff, state.calendarMonthAnchor);
  const { monthStart, monthEnd, dayInfo, firstAvailableDate } = monthData;
  const monthStartISO = formatDateISO(monthStart);
  const monthEndISO = formatDateISO(monthEnd);
  const selectedInfo = dayInfo.get(state.selectedDate);
  const selectedInMonth = state.selectedDate >= monthStartISO && state.selectedDate <= monthEndISO;

  if (!selectedInMonth || !selectedInfo?.available) {
    state.selectedDate = firstAvailableDate || '';
    state.selectedTime = '';
  }

  if (label) label.textContent = formatMonthLabel(monthStart);
  if (empty) empty.classList.toggle('hidden', !!firstAvailableDate);

  const firstWeekday = monthStart.getDay();
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push('<div class="h-11 rounded-md"></div>');
  }

  for (let day = 1; day <= monthEnd.getDate(); day += 1) {
    const dayISO = formatDateISO(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
    const info = dayInfo.get(dayISO) || { available: false, slotsCount: 0 };
    const selected = state.selectedDate === dayISO;
    const disabled = !info.available;

    const classes = selected
      ? 'bg-[#fb8500] text-white border-[#fb8500]'
      : disabled
        ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50';

    cells.push(`
      <button
        type="button"
        data-action="select-day"
        data-day="${dayISO}"
        class="h-11 rounded-md border text-[11px] leading-tight ${classes}"
        ${disabled ? 'disabled' : ''}
      >
        <span class="block text-sm font-normal">${day}</span>
        ${info.available ? `<span class="block text-[10px] opacity-80">${info.slotsCount}</span>` : '<span class="block text-[10px] opacity-70">—</span>'}
      </button>
    `);
  }

  const fillerCells = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < fillerCells; i += 1) {
    cells.push('<div class="h-11 rounded-md"></div>');
  }

  container.innerHTML = cells.join('');
  updateSelectedLabels();
}

async function renderSlotsForSelectedDay() {
  const slotsContainer = document.getElementById('citasSlotsContainer');
  const empty = document.getElementById('citasSlotsVacio');
  const title = document.getElementById('citasSlotsTitulo');
  if (!slotsContainer || !empty) return;

  const staff = getActiveStaff();
  if (!staff || !state.selectedDate) {
    slotsContainer.innerHTML = '';
    empty.classList.add('hidden');
    if (title) title.textContent = 'Horarios disponibles';
    updateSelectedLabels();
    return;
  }

  if (title) {
    title.textContent = `Horarios disponibles para ${formatDateForSlotsTitle(state.selectedDate)}`;
  }

  const agenda = normalizeAgendaConfig(staff.agenda_config);
  const selectedDateObj = new Date(`${state.selectedDate}T12:00:00`);
  const monthAnchor = firstDayOfMonth(selectedDateObj);
  const monthData = await getMonthAvailability(staff, monthAnchor);
  const booked = monthData.bookedByDate.get(state.selectedDate) || await fetchBookedIntervals(staff.id, state.selectedDate);
  const todayISO = formatDateISO(new Date());
  const nowMinutes = (() => {
    if (state.selectedDate !== todayISO) return null;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })();

  const slots = buildSlotsFromAgenda(agenda, state.selectedDate, booked)
    .filter((slot) => nowMinutes == null || slot.inicioMin > (nowMinutes + 4));

  if (!slots.length) {
    slotsContainer.innerHTML = '';
    empty.classList.remove('hidden');
    state.selectedTime = '';
    updateSelectedLabels();
    return;
  }

  empty.classList.add('hidden');

  if (!slots.some((slot) => slot.hora === state.selectedTime)) {
    state.selectedTime = '';
  }

  slotsContainer.innerHTML = slots.map((slot) => {
    const selected = slot.hora === state.selectedTime;
    return `
      <button
        type="button"
        data-action="select-slot"
        data-slot="${slot.hora}"
        class="px-3 py-1.5 rounded-full text-sm font-normal border ${selected ? 'bg-[#fb8500] text-white border-[#fb8500]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}"
      >${formatTime12h(slot.hora)}</button>
    `;
  }).join('');

  updateSelectedLabels();
}

function openModal() {
  const modal = document.getElementById('modalStaffServicios');
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closeModal() {
  const modal = document.getElementById('modalStaffServicios');
  const stickyName = document.getElementById('modalStaffStickyName');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
  if (stickyName) stickyName.textContent = '';
  setFeedback('', '');
}

async function prefillUserContact() {
  const inputNombre = document.getElementById('inputCitaNombre');
  const inputEmail = document.getElementById('inputCitaEmail');

  try {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    if (inputEmail && !sanitizeText(inputEmail.value)) {
      inputEmail.value = sanitizeText(user.email);
    }

    if (inputNombre && !sanitizeText(inputNombre.value)) {
      const fullName = sanitizeText(user.user_metadata?.full_name || user.user_metadata?.name || '');
      if (fullName) {
        inputNombre.value = fullName;
      } else {
        const { data: perfil } = await supabase
          .from('usuarios')
          .select('nombre,apellido')
          .eq('id', user.id)
          .maybeSingle();

        const nombrePerfil = `${sanitizeText(perfil?.nombre)} ${sanitizeText(perfil?.apellido)}`.trim();
        if (nombrePerfil) inputNombre.value = nombrePerfil;
      }
    }
  } catch (error) {
    console.warn('No se pudo precargar datos del usuario para cita:', error?.message || error);
  }
}

async function openStaffProfile(staffId) {
  const staff = state.staffById.get(Number(staffId));
  if (!staff) return;

  state.activeStaffId = Number(staff.id);
  state.activeStaffName = sanitizeText(staff.nombre) || 'Profesional';
  state.selectedDate = '';
  state.selectedTime = '';
  state.calendarMonthAnchor = firstDayOfMonth(new Date());

  const fotoEl = document.getElementById('staffModalFoto');
  const nombreEl = document.getElementById('staffModalNombre');
  const profesionEl = document.getElementById('staffModalProfesion');
  const bioEl = document.getElementById('staffModalBio');

  if (fotoEl) fotoEl.src = sanitizeText(staff.foto_url) || STAFF_PHOTO_PLACEHOLDER;
  if (nombreEl) nombreEl.textContent = sanitizeText(staff.nombre) || 'Profesional';
  if (profesionEl) profesionEl.textContent = sanitizeText(staff.profesion) || 'Staff';
  if (bioEl) bioEl.textContent = sanitizeText(staff.biografia) || 'Sin descripcion disponible.';

  renderStaffContacts(staff);
  renderStaffGallery(staff.id);

  await renderCalendarDays();
  await renderSlotsForSelectedDay();

  updateSelectedLabels();
  setFeedback('', '');
  await prefillUserContact();
  openModal();

  const panel = document.getElementById('modalStaffPanel');
  if (panel) panel.scrollTop = 0;
  updateModalStickyName();
}

function buildTrabajosMap(trabajos = []) {
  const map = new Map();
  (trabajos || []).forEach((item) => {
    const staffId = Number(item?.id_staff);
    if (!Number.isFinite(staffId) || staffId <= 0) return;
    if (!map.has(staffId)) map.set(staffId, []);
    map.get(staffId).push(item);
  });
  return map;
}

function bindEvents() {
  if (state.modalBound) return;
  state.modalBound = true;

  const grid = document.getElementById('staffServiciosGrid');
  const modalPanel = document.getElementById('modalStaffPanel');
  const daysContainer = document.getElementById('calendarioCitasDias');
  const slotsContainer = document.getElementById('citasSlotsContainer');
  const btnPrevMes = document.getElementById('btnCitasPrevMes');
  const btnNextMes = document.getElementById('btnCitasNextMes');
  const form = document.getElementById('formCitaStaff');
  const closeBtn = document.getElementById('cerrarModalStaffServicios');
  const backdrop = document.getElementById('modalBackdropStaffServicios');

  grid?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-action="abrir-staff-card"]');
    if (!card) return;
    const staffId = Number(card.getAttribute('data-staff-id'));
    if (!Number.isFinite(staffId) || staffId <= 0) return;
    void openStaffProfile(staffId);
  });

  grid?.addEventListener('keydown', (event) => {
    const card = event.target.closest('[data-action="abrir-staff-card"]');
    if (!card) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const staffId = Number(card.getAttribute('data-staff-id'));
    if (!Number.isFinite(staffId) || staffId <= 0) return;
    void openStaffProfile(staffId);
  });

  daysContainer?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="select-day"]');
    if (!button || button.disabled) return;
    const day = sanitizeText(button.getAttribute('data-day'));
    if (!day) return;
    state.selectedDate = day;
    state.selectedTime = '';
    void (async () => {
      await renderCalendarDays();
      await renderSlotsForSelectedDay();
    })();
  });

  btnPrevMes?.addEventListener('click', () => {
    state.calendarMonthAnchor = addMonths(state.calendarMonthAnchor || new Date(), -1);
    state.selectedDate = '';
    state.selectedTime = '';
    void (async () => {
      await renderCalendarDays();
      await renderSlotsForSelectedDay();
    })();
  });

  btnNextMes?.addEventListener('click', () => {
    state.calendarMonthAnchor = addMonths(state.calendarMonthAnchor || new Date(), 1);
    state.selectedDate = '';
    state.selectedTime = '';
    void (async () => {
      await renderCalendarDays();
      await renderSlotsForSelectedDay();
    })();
  });

  slotsContainer?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="select-slot"]');
    if (!button) return;
    const slot = sanitizeText(button.getAttribute('data-slot'));
    if (!slot) return;
    state.selectedTime = slot;
    void renderSlotsForSelectedDay();
  });

  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  modalPanel?.addEventListener('scroll', updateModalStickyName);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const staff = getActiveStaff();
    if (!staff) {
      setFeedback('error', 'No se pudo identificar el profesional seleccionado.');
      return;
    }

    if (!state.selectedDate || !state.selectedTime) {
      setFeedback('error', 'Debes seleccionar fecha y hora para continuar.');
      return;
    }

    const inputNombre = document.getElementById('inputCitaNombre');
    const inputTelefono = document.getElementById('inputCitaTelefono');
    const inputEmail = document.getElementById('inputCitaEmail');
    const inputServicio = document.getElementById('inputCitaServicio');
    const inputNotas = document.getElementById('inputCitaNotas');
    const submitBtn = document.getElementById('btnReservarCita');

    const clienteNombre = sanitizeText(inputNombre?.value);
    const clienteTelefono = sanitizeText(inputTelefono?.value);
    const clienteEmail = sanitizeText(inputEmail?.value);
    const servicio = sanitizeText(inputServicio?.value);
    const notas = sanitizeText(inputNotas?.value);

    if (!clienteNombre || !clienteTelefono) {
      setFeedback('error', 'Nombre y telefono son requeridos para reservar.');
      return;
    }

    const agenda = normalizeAgendaConfig(staff.agenda_config);
    const horaInicio = state.selectedTime;
    const startMin = toMinutes(horaInicio);
    if (startMin == null) {
      setFeedback('error', 'Hora seleccionada invalida.');
      return;
    }

    const horaFin = minutesToHHmm(startMin + agenda.slot_minutes);

    let userId = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      userId = authData?.user?.id || null;
    } catch (_error) {
      userId = null;
    }

    if (!userId) {
      setFeedback('error', 'Debes iniciar sesion para reservar una cita.');
      const currentPath = `${window.location.pathname}${window.location.search}`;
      window.setTimeout(() => {
        window.location.href = `${LOGIN_URL}?redirect=${encodeURIComponent(currentPath)}`;
      }, 500);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Reservando...';
    }

    setFeedback('info', 'Guardando tu cita...');

    try {
      const payload = {
        id_comercio: Number(state.idComercio),
        id_staff: Number(staff.id),
        id_usuario: userId,
        cliente_nombre: clienteNombre,
        cliente_telefono: clienteTelefono,
        cliente_email: clienteEmail || null,
        servicio: servicio || null,
        notas: notas || null,
        fecha_cita: state.selectedDate,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        timezone: agenda.timezone || 'America/Puerto_Rico',
        estado: 'pendiente',
        canal_origen: 'web_perfil',
      };

      const { error } = await supabase
        .from('ComercioCitas')
        .insert(payload);

      if (error) {
        if (String(error.code || '') === '23505') {
          setFeedback('error', 'Ese horario acaba de ocuparse. Selecciona otro y vuelve a intentar.');
          state.selectedTime = '';
          await renderSlotsForSelectedDay();
          return;
        }

        setFeedback('error', 'No se pudo guardar la cita. Verifica que las migraciones nuevas esten aplicadas.');
        console.error('Error creando cita:', error);
        return;
      }

      setFeedback('success', 'Cita reservada. Recibiras notificacion cuando el comercio la confirme.');
      if (inputServicio) inputServicio.value = '';
      if (inputNotas) inputNotas.value = '';
      state.selectedTime = '';
      state.calendarMonthCache.clear();
      await renderCalendarDays();
      await renderSlotsForSelectedDay();
    } catch (error) {
      console.error('Error inesperado reservando cita:', error);
      setFeedback('error', 'Error inesperado al guardar la cita. Intenta de nuevo.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirmar cita';
      }
    }
  });
}

export async function initPerfilServicios({ idComercio, comercio = null } = {}) {
  const id = Number(idComercio);
  if (!Number.isFinite(id) || id <= 0) {
    showSection(false);
    return;
  }

  state.idComercio = id;
  state.comercio = comercio || null;
  state.staffList = [];
  state.staffById = new Map();
  state.trabajosByStaff = new Map();
  state.activeStaffId = null;
  state.activeStaffName = '';
  state.selectedDate = '';
  state.selectedTime = '';
  state.calendarMonthAnchor = firstDayOfMonth(new Date());
  state.calendarMonthCache = new Map();

  const fetchedCategorias = await fetchCategoriasComercio(id);
  const categoriasBase = fetchedCategorias.length ? fetchedCategorias : getCategoriasFromComercioData(comercio);
  state.tipoPerfil = resolveTipoPerfilComercio(categoriasBase);

  if (state.tipoPerfil !== 'servicios') {
    showSection(false);
    return;
  }

  const staff = await fetchStaff(id);
  state.staffList = staff;
  state.staffById = new Map(staff.map((row) => [Number(row.id), row]));

  const trabajos = await fetchStaffTrabajos(staff.map((row) => row.id));
  state.trabajosByStaff = buildTrabajosMap(trabajos);

  showSection(true);
  bindEvents();
  renderStaffCards();
}
