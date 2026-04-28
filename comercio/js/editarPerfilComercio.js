import { supabase } from '../shared/supabaseClient.js';
import { formatoPrecio, obtenerPlanPorNivel, resolverPlanComercio } from '../shared/planes.js';
import { resolverCtaPrincipalComercio } from '../shared/utils.js';

const idComercio = new URLSearchParams(window.location.search).get('id');

const telefono = document.getElementById('telefono');
const direccion = document.getElementById('direccion');
const tiendaFisicaInput = document.getElementById('tiendaFisica');
const tiendaOnlineInput = document.getElementById('tiendaOnline');
const storeModeFeedback = document.getElementById('storeModeFeedback');
const direccionFieldWrapper = document.getElementById('direccionFieldWrapper');
const horariosSection = document.getElementById('horariosSection');
const feriadosSection = document.getElementById('feriadosSection');
const whatsapp = document.getElementById('whatsapp');
const facebook = document.getElementById('facebook');
const instagram = document.getElementById('instagram');
const tiktok = document.getElementById('tiktok');
const webpage = document.getElementById('webpage');
const descripcion = document.getElementById('descripcion');
const horariosContainer = document.getElementById('horariosContainer');
const feriadosContainer = document.getElementById('feriadosContainer');
const btnGuardar = document.getElementById('btn-guardar');
const btnAdminMenu = document.getElementById('btnAdminMenu');
const btnStaffServicios = document.getElementById('btnStaffServicios');
const btnAdministrarEspeciales = document.getElementById('btnAdministrarEspeciales');
const btnAgregarFeriado = document.getElementById('agregarFeriado');
const planBadge = document.getElementById('planBadge');
const planCta = document.getElementById('planCta');
const verificationCta = document.getElementById('verificationCta');
const imageValidationCta = document.getElementById('imageValidationCta');
const btnCambiarPlan = document.getElementById('btnCambiarPlan');
const planDetails = document.getElementById('planDetails');
const comercioNombreHeading = document.getElementById('comercioNombreHeading');
const panelActionLinks = document.getElementById('panelActionLinks');
const protectedLockState = document.getElementById('protectedLockState');
const protectedNombre = document.getElementById('protectedNombre');
const protectedCoords = document.getElementById('protectedCoords');
const protectedTelefono = document.getElementById('protectedTelefono');
const protectedLogo = document.getElementById('protectedLogo');
const protectedLogoPlaceholder = document.getElementById('protectedLogoPlaceholder');
const protectedPortada = document.getElementById('protectedPortada');
const protectedPortadaPlaceholder = document.getElementById('protectedPortadaPlaceholder');
const fullProfileSections = document.getElementById('fullProfileSections');
const gateStatusCta = document.getElementById('gateStatusCta');
const gateChecklist = document.getElementById('gateChecklist');
const btnCompletarPagoPlan = document.getElementById('btnCompletarPagoPlan');
const btnContinuarFormulario = document.getElementById('btnContinuarFormulario');
const firstLogoUploadSection = document.getElementById('firstLogoUploadSection');
const firstLogoInput = document.getElementById('firstLogoInput');
const firstLogoProcessBtn = document.getElementById('firstLogoProcessBtn');
const firstLogoFeedback = document.getElementById('firstLogoFeedback');
const firstLogoEditor = document.getElementById('firstLogoEditor');
const firstLogoPreviewCanvas = document.getElementById('firstLogoPreviewCanvas');
const firstLogoZoom = document.getElementById('firstLogoZoom');
const firstLogoCenterBtn = document.getElementById('firstLogoCenterBtn');
const firstLogoUpgradeBox = document.getElementById('firstLogoUpgradeBox');
const firstLogoUpgradeText = document.getElementById('firstLogoUpgradeText');
const firstLogoRetryBtn = document.getElementById('firstLogoRetryBtn');
const firstLogoUpgradeBtn = document.getElementById('firstLogoUpgradeBtn');
const firstPortadaUploadSection = document.getElementById('firstPortadaUploadSection');
const firstPortadaInput = document.getElementById('firstPortadaInput');
const firstPortadaProcessBtn = document.getElementById('firstPortadaProcessBtn');
const firstPortadaFeedback = document.getElementById('firstPortadaFeedback');
const resumenPerfilEstado = document.getElementById('resumenPerfilEstado');
const resumenPlanNombre = document.getElementById('resumenPlanNombre');
const resumenPlanMeta = document.getElementById('resumenPlanMeta');
const resumenTelefono = document.getElementById('resumenTelefono');
const resumenDireccion = document.getElementById('resumenDireccion');
const resumenHorarioHoy = document.getElementById('resumenHorarioHoy');
const resumenStoreMode = document.getElementById('resumenStoreMode');
const resumenDescripcion = document.getElementById('resumenDescripcion');

const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
let comercioActual = null;
let firstLogoOffer = null;
let firstLogoEditorState = null;
let horariosActuales = [];
let currentStoreMode = { tiendaFisica: true, tiendaOnline: false };
let categoriaTipoPerfilPromise = null;
const urlParams = new URLSearchParams(window.location.search);
const onboardingFlow = ['1', 'true', 'yes'].includes(String(urlParams.get('onboarding') || '').toLowerCase()) ||
  ['1', 'true', 'yes'].includes(String(urlParams.get('nuevo') || '').toLowerCase());
let fullFormUnlocked = !onboardingFlow;

if (!idComercio) {
  alert('ID de comercio no encontrado');
}

function buildImageFunctionEndpoints() {
  const endpoints = [];
  const customBase = String(window.FINDIXI_FUNCTIONS_BASE_URL || '').trim().replace(/\/+$/, '');
  if (customBase) {
    endpoints.push(`${customBase}/.netlify/functions/image-validate-process`);
  }
  endpoints.push('/.netlify/functions/image-validate-process');

  const hostname = String(window.location.hostname || '').toLowerCase();
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (isLocalHost && String(window.location.port || '') !== '8888') {
    endpoints.push('http://localhost:8888/.netlify/functions/image-validate-process');
  }

  return [...new Set(endpoints)];
}

async function callImageProcessEndpoint(payload, token) {
  const endpoints = buildImageFunctionEndpoints();
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) return data;

      if (response.status === 405) {
        lastError = new Error(
          'No se pudo validar imagen en Live Server (405). Usa Netlify Dev (`netlify dev`) o prueba en test.findixi.com.'
        );
        continue;
      }

      const message = data?.error || data?.detalle || `No se pudo validar imagen (HTTP ${response.status}).`;
      lastError = new Error(message);

      if (response.status >= 400 && response.status < 500 && response.status !== 404) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No se pudo validar imagen.');
}

function isMissingStoreColumnsError(error) {
  if (!error) return false;
  const hayCodigo = String(error.code || '').toLowerCase();
  const detalle = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  if (!/tiendafisica|tiendaonline/.test(detalle)) return false;
  return hayCodigo === '42703' || hayCodigo.startsWith('pgrst') || hayCodigo === '' || hayCodigo === '400';
}

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

function normalizarTextoPerfil(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseCategoryTokensPerfil(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => parseCategoryTokensPerfil(item));
  if (typeof value === 'object') {
    const idValue = Number(value?.id);
    if (Number.isFinite(idValue) && idValue > 0) return [String(idValue)];
    if (value?.nombre) return [String(value.nombre)];
    return [];
  }

  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/[|,;/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function fetchCategoriaTipoPerfilMap() {
  if (!categoriaTipoPerfilPromise) {
    categoriaTipoPerfilPromise = (async () => {
      const byId = new Map();
      const byName = new Map();
      const attempts = [
        { select: 'id, nombre, tipo_perfil', hasTipoPerfil: true },
        { select: 'id, nombre', hasTipoPerfil: false },
      ];

      for (const attempt of attempts) {
        const { data, error } = await supabase.from('Categorias').select(attempt.select);
        if (error) {
          if (isMissingColumnError(error)) continue;
          return { byId, byName };
        }

        (Array.isArray(data) ? data : []).forEach((row) => {
          const id = Number(row?.id);
          const nombre = String(row?.nombre || '').trim();
          const tipo = attempt.hasTipoPerfil ? normalizarTextoPerfil(row?.tipo_perfil) : '';
          if (!['menu', 'servicios', 'tienda'].includes(tipo)) return;
          if (Number.isFinite(id) && id > 0) byId.set(id, tipo);
          if (nombre) byName.set(normalizarTextoPerfil(nombre), tipo);
        });
        return { byId, byName };
      }

      return { byId, byName };
    })();
  }
  return categoriaTipoPerfilPromise;
}

function resolveCategoryProfileTypes(comercio = {}, categoriaTipoMap = { byId: new Map(), byName: new Map() }) {
  const tokens = [
    ...parseCategoryTokensPerfil(comercio?.idCategoria),
    ...parseCategoryTokensPerfil(comercio?.idcategoria),
    ...parseCategoryTokensPerfil(comercio?.categoria),
    ...parseCategoryTokensPerfil(comercio?.categorias),
    ...parseCategoryTokensPerfil(comercio?.subCategorias),
  ];

  const types = [];
  tokens.forEach((token) => {
    const asNumber = Number(token);
    if (Number.isFinite(asNumber) && categoriaTipoMap.byId.has(asNumber)) {
      types.push(categoriaTipoMap.byId.get(asNumber));
      return;
    }
    const byName = categoriaTipoMap.byName.get(normalizarTextoPerfil(token));
    if (byName) types.push(byName);
  });

  return Array.from(new Set(types.filter((item) => ['menu', 'servicios', 'tienda'].includes(item))));
}

async function resolvePrimaryActionCta(comercio = {}) {
  const categoriaTipoMap = await fetchCategoriaTipoPerfilMap();
  const categoryProfileTypes = resolveCategoryProfileTypes(comercio, categoriaTipoMap);
  return resolverCtaPrincipalComercio(comercio, {
    idComercio,
    categoryProfileTypes,
  });
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatCoord(value) {
  const num = toFiniteNumber(value);
  return num === null ? '—' : num.toFixed(6);
}

function isComercioVerificado(comercio = {}) {
  const estadoPropiedad = String(comercio?.estado_propiedad || '').toLowerCase();
  const estadoVerificacion = String(comercio?.estado_verificacion || '').toLowerCase();
  const propietarioVerificado = comercio?.propietario_verificado === true;
  const verificacionOk = ['otp_verificado', 'sms_verificado', 'messenger_verificado', 'manual_aprobado'].includes(
    estadoVerificacion
  );
  return estadoPropiedad === 'verificado' && (propietarioVerificado || verificacionOk);
}

function normalizeImageEstado(value) {
  const estado = String(value || '').trim().toLowerCase();
  if (['aprobado', 'upgrade_listo'].includes(estado)) return 'aprobado';
  if (estado === 'requiere_accion') return 'requiere_accion';
  if (estado === 'en_upgrade') return 'en_upgrade';
  return 'pendiente';
}

function getImageEstadoLabel(value) {
  const estado = normalizeImageEstado(value);
  if (estado === 'aprobado') return 'Aprobado';
  if (estado === 'requiere_accion') return 'Requiere acción';
  if (estado === 'en_upgrade') return 'En optimización';
  return 'Pendiente';
}

function isImageApproved(comercio = {}, type = 'logo') {
  const estado = normalizeImageEstado(type === 'logo' ? comercio.logo_estado : comercio.portada_estado);
  const aprobadoFlag = type === 'logo' ? comercio.logo_aprobado === true : comercio.portada_aprobada === true;
  return aprobadoFlag || estado === 'aprobado';
}

function isPlanPaymentReady(comercio = {}, planInfo = resolverPlanComercio(comercio)) {
  if (Number(planInfo?.nivel || 0) <= 0) return true;
  const demoState = String(comercio?.pago_estado_demo || '').toLowerCase();
  const planStatus = String(comercio?.plan_status || '').toLowerCase();
  return ['demo_aprobado', 'aprobado', 'paid', 'activo', 'active'].includes(demoState) ||
    ['demo_aprobado', 'aprobado', 'paid', 'activo', 'active'].includes(planStatus);
}

function getPaymentStatusLabel(comercio = {}, planInfo = resolverPlanComercio(comercio)) {
  if (Number(planInfo?.nivel || 0) <= 0) return 'Plan Basic seleccionado';
  const demoState = String(comercio?.pago_estado_demo || '').toLowerCase();
  if (demoState === 'demo_aprobado') return `Pago del plan ${planInfo.nombre} confirmado (demo)`;
  const planStatus = String(comercio?.plan_status || '').toLowerCase();
  if (['aprobado', 'paid', 'activo', 'active'].includes(planStatus)) {
    return `Pago del plan ${planInfo.nombre} confirmado`;
  }
  return `Pago del plan ${planInfo.nombre} pendiente`;
}

function getHorariosConfiguradosCount(horarios = []) {
  return new Set((horarios || []).map((row) => Number(row?.diaSemana)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)).size;
}

function formatTime12h(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw || '—';
  let hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isFinite(hour)) return raw || '—';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

function getStoreModeLabel(mode = {}) {
  if (mode.tiendaFisica && mode.tiendaOnline) return 'Tienda física + online';
  if (mode.tiendaOnline) return 'Solo tienda online';
  return 'Tienda física';
}

function getHorarioHoyResumen(horarios = []) {
  const jsDay = new Date().getDay();
  const diaSemana = jsDay === 0 ? 6 : jsDay - 1;
  const dayLabel = dias[diaSemana] || 'Hoy';
  const row = (horarios || []).find((item) => Number(item?.diaSemana) === diaSemana) || null;
  if (!row) return `${dayLabel}: sin definir`;
  if (row.cerrado) return `${dayLabel}: Cerrado`;
  if (!row.apertura || !row.cierre) return `${dayLabel}: sin definir`;
  return `${dayLabel}: ${formatTime12h(row.apertura)} - ${formatTime12h(row.cierre)}`;
}

function renderQuickOverview(comercio = null, horarios = []) {
  const planInfo = resolverPlanComercio(comercio || {});
  const mode = readStoreModeFromForm();
  const telefonoText = String(telefono?.value || comercio?.telefono || '').trim() || 'No disponible';
  const direccionText = String(direccion?.value || comercio?.direccion || '').trim() || 'No disponible';
  const descripcionText = String(descripcion?.value || comercio?.descripcion || '').trim() || 'Sin descripción';
  const estadoVerificado = isComercioVerificado(comercio || {});
  const listing = String(comercio?.estado_listing || '').toLowerCase();
  const activo = comercio?.activo === true || listing === 'publicado';

  if (resumenPerfilEstado) {
    resumenPerfilEstado.textContent = activo ? 'Activo' : estadoVerificado ? 'Verificado' : 'Pendiente';
    resumenPerfilEstado.className = activo
      ? 'text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700'
      : estadoVerificado
        ? 'text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700'
        : 'text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700';
  }

  if (resumenPlanNombre) resumenPlanNombre.textContent = planInfo.nombre || 'Sin plan';
  if (resumenPlanMeta) resumenPlanMeta.textContent = `${formatoPrecio(planInfo.precio)} · Nivel ${planInfo.nivel}`;
  if (resumenTelefono) resumenTelefono.textContent = telefonoText;
  if (resumenDireccion) resumenDireccion.textContent = direccionText;
  if (resumenHorarioHoy) resumenHorarioHoy.textContent = getHorarioHoyResumen(horarios);
  if (resumenStoreMode) resumenStoreMode.textContent = getStoreModeLabel(mode);
  if (resumenDescripcion) {
    resumenDescripcion.textContent = descripcionText.length > 180 ? `${descripcionText.slice(0, 177)}...` : descripcionText;
  }
}

function readStoreModeFromComercio(comercio = {}) {
  const hasFisica = typeof comercio?.tiendaFisica === 'boolean';
  const hasOnline = typeof comercio?.tiendaOnline === 'boolean';

  const tiendaFisica = hasFisica ? comercio.tiendaFisica : true;
  const tiendaOnline = hasOnline ? comercio.tiendaOnline : false;

  return {
    tiendaFisica: tiendaFisica !== false,
    tiendaOnline: tiendaOnline === true,
  };
}

function readStoreModeFromForm() {
  return {
    tiendaFisica: tiendaFisicaInput?.checked !== false,
    tiendaOnline: tiendaOnlineInput?.checked === true,
  };
}

function setStoreModeFeedback(type = 'info', message = '') {
  if (!storeModeFeedback) return;
  if (!message) {
    storeModeFeedback.classList.add('hidden');
    storeModeFeedback.textContent = '';
    return;
  }
  const tone = {
    info: 'bg-sky-50 border border-sky-200 text-sky-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800',
    error: 'bg-red-50 border border-red-200 text-red-700',
  };
  storeModeFeedback.className = `text-xs rounded-lg px-3 py-2 ${tone[type] || tone.info}`;
  storeModeFeedback.textContent = message;
  storeModeFeedback.classList.remove('hidden');
}

function applyStoreModeUI(mode = readStoreModeFromForm()) {
  const isFisica = mode?.tiendaFisica !== false;
  currentStoreMode = {
    tiendaFisica: isFisica,
    tiendaOnline: mode?.tiendaOnline === true,
  };

  direccionFieldWrapper?.classList.toggle('hidden', !isFisica);
  horariosSection?.classList.toggle('hidden', !isFisica);
  feriadosSection?.classList.toggle('hidden', !isFisica);

  if (!isFisica) {
    setStoreModeFeedback('info', 'Tienda configurada sin presencia física: dirección y horarios se ocultarán en el perfil público.');
  } else if (storeModeFeedback?.classList.contains('border-sky-200')) {
    setStoreModeFeedback('', '');
  }
}

function isBrandingGateReady(comercio = {}, planInfo = resolverPlanComercio(comercio)) {
  return isImageApproved(comercio, 'logo') && isImageApproved(comercio, 'portada') && isPlanPaymentReady(comercio, planInfo);
}

function onboardingUnlockStorageKey() {
  return `findixi_onboarding_full_form_unlocked_${idComercio || 'unknown'}`;
}

function loadOnboardingUnlockState() {
  if (!onboardingFlow) return true;
  try {
    return sessionStorage.getItem(onboardingUnlockStorageKey()) === '1';
  } catch (_error) {
    return false;
  }
}

function persistOnboardingUnlockState(unlocked) {
  if (!onboardingFlow) return;
  try {
    if (unlocked) sessionStorage.setItem(onboardingUnlockStorageKey(), '1');
    else sessionStorage.removeItem(onboardingUnlockStorageKey());
  } catch (_error) {
    // ignore storage errors
  }
}

function renderImageValidationCta(comercio = {}) {
  if (!imageValidationCta) return;

  const logoEstado = normalizeImageEstado(comercio.logo_estado);
  const portadaEstado = normalizeImageEstado(comercio.portada_estado);
  const logoAprobado = comercio.logo_aprobado === true || logoEstado === 'aprobado';
  const portadaAprobada = comercio.portada_aprobada === true || portadaEstado === 'aprobado';

  if (logoAprobado && portadaAprobada) {
    imageValidationCta.classList.add('hidden');
    imageValidationCta.innerHTML = '';
    return;
  }

  const bullets = [];
  if (!logoAprobado) bullets.push(`Logo: ${getImageEstadoLabel(comercio.logo_estado)}`);
  if (!portadaAprobada) bullets.push(`Portada: ${getImageEstadoLabel(comercio.portada_estado)}`);

  imageValidationCta.classList.remove('hidden');
  imageValidationCta.innerHTML = `
    <div class="font-semibold">Pendiente validación de imagen</div>
    <p class="mt-1">Para publicar el comercio en Findixi, logo y portada deben estar aprobados.</p>
    <p class="mt-2 text-xs">${bullets.join(' · ')}</p>
  `;
}

function setFieldsLocked(fields = [], locked = false) {
  fields.forEach((el) => {
    if (!el) return;
    el.disabled = locked;
    el.classList.toggle('bg-gray-100', locked);
    el.classList.toggle('cursor-not-allowed', locked);
  });
}

function setFirstLogoFeedback(type, message) {
  if (!firstLogoFeedback) return;
  const tone = {
    success: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800',
    error: 'bg-red-50 border border-red-200 text-red-700',
    info: 'bg-sky-50 border border-sky-200 text-sky-800',
  };
  firstLogoFeedback.className = `text-xs rounded-lg px-3 py-2 ${tone[type] || tone.info}`;
  firstLogoFeedback.textContent = message;
  firstLogoFeedback.classList.remove('hidden');
}

function clearFirstLogoFeedback() {
  if (!firstLogoFeedback) return;
  firstLogoFeedback.classList.add('hidden');
  firstLogoFeedback.textContent = '';
}

function setFirstPortadaFeedback(type, message) {
  if (!firstPortadaFeedback) return;
  const tone = {
    success: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-800',
    error: 'bg-red-50 border border-red-200 text-red-700',
    info: 'bg-sky-50 border border-sky-200 text-sky-800',
  };
  firstPortadaFeedback.className = `text-xs rounded-lg px-3 py-2 ${tone[type] || tone.info}`;
  firstPortadaFeedback.textContent = message;
  firstPortadaFeedback.classList.remove('hidden');
}

function clearFirstPortadaFeedback() {
  if (!firstPortadaFeedback) return;
  firstPortadaFeedback.classList.add('hidden');
  firstPortadaFeedback.textContent = '';
}

function clearFirstLogoEditor() {
  if (firstLogoEditorState?.objectUrl) {
    URL.revokeObjectURL(firstLogoEditorState.objectUrl);
  }
  firstLogoEditorState = null;
  if (firstLogoEditor) firstLogoEditor.classList.add('hidden');
  if (firstLogoZoom) firstLogoZoom.value = '100';

  const canvas = firstLogoPreviewCanvas;
  const ctx = canvas?.getContext('2d');
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function getCircleLayout(side) {
  const radius = Math.round(side * 0.43);
  const center = side / 2;
  return { center, radius, diameter: radius * 2 };
}

function pickBackgroundColorFromImage(image) {
  const sampleSize = 64;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#111111';

  ctx.drawImage(image, 0, 0, sampleSize, sampleSize);
  const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
  const bins = new Map();
  let whiteLike = 0;
  let total = 0;

  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const isBorder = x === 0 || y === 0 || x === sampleSize - 1 || y === sampleSize - 1;
      if (!isBorder) continue;

      const idx = (y * sampleSize + x) * 4;
      const r = data[idx] ?? 255;
      const g = data[idx + 1] ?? 255;
      const b = data[idx + 2] ?? 255;
      const a = data[idx + 3] ?? 255;
      if (a < 20) continue;

      total += 1;
      if (r >= 230 && g >= 230 && b >= 230) whiteLike += 1;

      const qr = Math.round(r / 24) * 24;
      const qg = Math.round(g / 24) * 24;
      const qb = Math.round(b / 24) * 24;
      const key = `${qr}|${qg}|${qb}`;
      const prev = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      prev.count += 1;
      prev.r += r;
      prev.g += g;
      prev.b += b;
      bins.set(key, prev);
    }
  }

  if (!total) return '#111111';
  if (whiteLike / total >= 0.55) return '#ffffff';

  let selected = null;
  for (const bucket of bins.values()) {
    if (!selected || bucket.count > selected.count) selected = bucket;
  }
  if (!selected || !selected.count) return '#111111';

  return `rgb(${Math.round(selected.r / selected.count)}, ${Math.round(selected.g / selected.count)}, ${Math.round(selected.b / selected.count)})`;
}

function detectClientTextHeavyLogo(image) {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { blocked: false };

  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const total = size * size;
  const dark = new Uint8Array(total);

  let darkCount = 0;
  let transitions = 0;
  for (let y = 0; y < size; y += 1) {
    let prev = 0;
    for (let x = 0; x < size; x += 1) {
      const idxPx = y * size + x;
      const idx = idxPx * 4;
      const lum = 0.2126 * (data[idx] || 0) + 0.7152 * (data[idx + 1] || 0) + 0.0722 * (data[idx + 2] || 0);
      const v = lum < 165 ? 1 : 0;
      dark[idxPx] = v;
      darkCount += v;
      if (x > 0 && v !== prev) transitions += 1;
      prev = v;
    }
  }

  const darkRatio = darkCount / Math.max(1, total);
  const transitionDensity = transitions / Math.max(1, size * (size - 1));
  const blocked = darkRatio > 0.54 && transitionDensity > 0.33;

  return {
    blocked,
    darkRatio,
    transitionDensity,
    reason: blocked
      ? 'Detectamos demasiado texto distribuido en toda la imagen. Sube un logo más simple (símbolo o texto breve).'
      : '',
  };
}

function renderFirstLogoPreview(showGuide = true) {
  if (!firstLogoEditorState || !firstLogoPreviewCanvas) return;
  const canvas = firstLogoPreviewCanvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { image, scale, offsetX, offsetY, backgroundColor } = firstLogoEditorState;
  const { center, radius } = getCircleLayout(canvas.width);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = backgroundColor || '#111111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const drawX = center - drawW / 2 + offsetX;
  const drawY = center - drawH / 2 + offsetY;
  ctx.drawImage(image, drawX, drawY, drawW, drawH);
  ctx.restore();

  if (showGuide) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function updateFirstLogoScaleBySlider() {
  if (!firstLogoEditorState || !firstLogoZoom) return;
  const raw = Number(firstLogoZoom.value || 100);
  const normalized = Math.max(0, Math.min(1, (raw - 60) / 220));
  const nextScale =
    firstLogoEditorState.minScale +
    (firstLogoEditorState.maxScale - firstLogoEditorState.minScale) * normalized;
  firstLogoEditorState.scale = nextScale;
  renderFirstLogoPreview(true);
}

async function prepareFirstLogoEditor(file) {
  clearFirstLogoEditor();
  if (!file) return false;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la vista previa del logo.'));
      img.src = objectUrl;
    });

    const textCheck = detectClientTextHeavyLogo(image);
    if (textCheck.blocked) {
      setFirstLogoFeedback('warning', textCheck.reason);
      URL.revokeObjectURL(objectUrl);
      return false;
    }

    const canvasSide = firstLogoPreviewCanvas?.width || 480;
    const { diameter } = getCircleLayout(canvasSide);
    const initialScale = (diameter * 0.88) / Math.max(1, Math.max(image.width, image.height));
    const isPngInput = String(file.type || '').toLowerCase() === 'image/png';

    firstLogoEditorState = {
      image,
      objectUrl,
      backgroundColor: isPngInput ? '#ffffff' : pickBackgroundColorFromImage(image),
      scale: initialScale,
      minScale: initialScale * 0.6,
      maxScale: initialScale * 3.2,
      offsetX: 0,
      offsetY: 0,
      dragging: false,
      dragStartX: 0,
      dragStartY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
    };

    if (firstLogoZoom) firstLogoZoom.value = '100';
    if (firstLogoEditor) firstLogoEditor.classList.remove('hidden');
    renderFirstLogoPreview(true);
    return true;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function getPreparedLogoDataUrl(file) {
  if (!firstLogoEditorState?.image) {
    const ok = await prepareFirstLogoEditor(file);
    if (!ok) return '';
  }
  if (!firstLogoEditorState?.image) return '';

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const { image, scale, offsetX, offsetY, backgroundColor } = firstLogoEditorState;
  const { center, radius } = getCircleLayout(canvas.width);
  const scaleFactor = canvas.width / Math.max(1, firstLogoPreviewCanvas?.width || 480);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = backgroundColor || '#111111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawW = image.width * scale * scaleFactor;
  const drawH = image.height * scale * scaleFactor;
  const drawX = center - drawW / 2 + offsetX * scaleFactor;
  const drawY = center - drawH / 2 + offsetY * scaleFactor;
  ctx.drawImage(image, drawX, drawY, drawW, drawH);
  ctx.restore();

  return canvas.toDataURL('image/png', 0.95);
}

function hideLogoUpgradeBox() {
  firstLogoUpgradeBox?.classList.add('hidden');
  firstLogoOffer = null;
}

function showLogoUpgradeBox(offer, nota = '') {
  if (!firstLogoUpgradeBox) return;
  firstLogoOffer = offer || null;
  const label = offer?.label || 'Incluido en tu plan';
  if (firstLogoUpgradeText) {
    firstLogoUpgradeText.textContent = nota
      ? `${nota} Puedes subir otro archivo o usar Logo Upgrade (${label}).`
      : `Puedes subir otro archivo o usar Logo Upgrade (${label}).`;
  }
  firstLogoUpgradeBox.classList.remove('hidden');
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

function renderProtectedFields(comercio = {}) {
  if (protectedNombre) protectedNombre.textContent = comercio.nombre || 'Sin nombre';
  if (protectedCoords) {
    protectedCoords.textContent = `${formatCoord(comercio.latitud)}, ${formatCoord(comercio.longitud)}`;
  }
  if (protectedTelefono) {
    protectedTelefono.textContent = comercio.telefono || '—';
  }
  if (comercioNombreHeading) {
    comercioNombreHeading.textContent = comercio.nombre || 'Comercio';
  }
  if (protectedLogo) {
    if (comercio.logo) {
      protectedLogo.src = comercio.logo;
      protectedLogo.classList.remove('hidden');
      protectedLogoPlaceholder?.classList.add('hidden');
    } else {
      protectedLogo.classList.add('hidden');
      protectedLogoPlaceholder?.classList.remove('hidden');
    }
  }
  if (protectedPortada) {
    if (comercio.portada) {
      protectedPortada.src = comercio.portada;
      protectedPortada.classList.remove('hidden');
      protectedPortadaPlaceholder?.classList.add('hidden');
    } else {
      protectedPortada.classList.add('hidden');
      protectedPortadaPlaceholder?.classList.remove('hidden');
    }
  }

  const locked = isComercioVerificado(comercio);
  if (protectedLockState) {
    protectedLockState.textContent = locked ? 'Verificado' : 'Pendiente de verificación';
    protectedLockState.className = locked
      ? 'mt-2 inline-flex text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700'
      : 'mt-2 inline-flex text-xs font-semibold px-2 py-1 rounded-full bg-slate-200 text-slate-700';
  }

  const sinLogo = !comercio.logo;
  const puedeSubirPrimerLogo = sinLogo;
  if (firstLogoUploadSection) {
    firstLogoUploadSection.classList.toggle('hidden', !puedeSubirPrimerLogo);
  }
  if (!puedeSubirPrimerLogo) {
    clearFirstLogoFeedback();
    if (firstLogoInput) firstLogoInput.value = '';
    hideLogoUpgradeBox();
    clearFirstLogoEditor();
  }

  const sinPortada = !comercio.portada;
  const puedeSubirPrimeraPortada = sinPortada;
  if (firstPortadaUploadSection) {
    firstPortadaUploadSection.classList.toggle('hidden', !puedeSubirPrimeraPortada);
  }
  if (!puedeSubirPrimeraPortada) {
    clearFirstPortadaFeedback();
    if (firstPortadaInput) firstPortadaInput.value = '';
  }
}

function setFullProfileVisibility(visible) {
  fullProfileSections?.classList.toggle('hidden', !visible);
  panelActionLinks?.classList.toggle('hidden', !visible);
}

function renderOnboardingGate(comercio = {}, planInfo = resolverPlanComercio(comercio), horarios = []) {
  if (!gateStatusCta || !gateChecklist || !btnContinuarFormulario) return;

  if (!onboardingFlow) {
    gateStatusCta.classList.add('hidden');
    setFullProfileVisibility(true);
    return;
  }

  const logoOk = isImageApproved(comercio, 'logo');
  const portadaOk = isImageApproved(comercio, 'portada');
  const paymentOk = isPlanPaymentReady(comercio, planInfo);
  const gateReady = logoOk && portadaOk && paymentOk;

  const checks = [
    { ok: logoOk, label: 'Logo aprobado' },
    { ok: portadaOk, label: 'Portada aprobada' },
    { ok: paymentOk, label: getPaymentStatusLabel(comercio, planInfo) },
  ];
  gateChecklist.innerHTML = checks
    .map((item) => `<li>${item.ok ? '✅' : '⏳'} ${item.label}</li>`)
    .join('');

  if (btnCompletarPagoPlan) {
    btnCompletarPagoPlan.href = `./paquetes.html?id=${idComercio}`;
    btnCompletarPagoPlan.classList.toggle('hidden', paymentOk);
  }

  const horariosCount = getHorariosConfiguradosCount(horarios);
  const direccionCompleta = Boolean(String(direccion?.value || comercio?.direccion || '').trim());
  const direccionRequerida = Number(planInfo.nivel || 0) > 0;
  const storeMode = readStoreModeFromForm();
  const requiereFisica = storeMode.tiendaFisica === true;
  const requisitosActivos = [
    requiereFisica
      ? `Horario configurado: ${horariosCount}/7 días`
      : 'Horario: no requerido (tienda sin presencia física)',
    requiereFisica
      ? (direccionRequerida
        ? `Dirección escrita: ${direccionCompleta ? 'completa' : 'pendiente'}`
        : 'Dirección escrita: opcional para Basic')
      : 'Dirección: no requerida (tienda sin presencia física)',
  ];

  if (gateReady) {
    gateStatusCta.classList.remove('hidden');
    gateStatusCta.classList.remove('border-amber-200', 'bg-amber-50', 'text-amber-900');
    gateStatusCta.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-900');
    const detailHtml = requisitosActivos.map((line) => `<li>${line}</li>`).join('');
    const unlocked = fullFormUnlocked === true;
    const alreadyActive = comercio?.activo === true || String(comercio?.estado_listing || '').toLowerCase() === 'publicado';
    const gateTitle = gateStatusCta.querySelector('p');
    if (gateTitle) {
      gateTitle.textContent = unlocked
        ? 'Ya puedes completar tu perfil y activar el comercio automáticamente.'
        : 'Paso 1 completado. Ahora pulsa "Continuar al formulario completo".';
    }
    gateChecklist.insertAdjacentHTML(
      'beforeend',
      `<li class="mt-1">📋 Siguiente paso: completa el formulario (${requisitosActivos.join(' · ')})</li>`
    );
    btnContinuarFormulario.disabled = false;
    btnContinuarFormulario.textContent = unlocked ? 'Formulario habilitado' : 'Continuar al formulario completo';
    if (unlocked) {
      setFullProfileVisibility(true);
    } else {
      setFullProfileVisibility(false);
    }
    if (verificationCta && unlocked && alreadyActive) {
      verificationCta.classList.remove('hidden');
      verificationCta.innerHTML = '<div class="font-semibold">Comercio activo</div><p class="mt-1">Tu comercio ya está activo y visible según las reglas de tu plan.</p>';
    } else if (detailHtml && unlocked && verificationCta) {
      verificationCta.classList.remove('hidden');
      verificationCta.innerHTML = `<div class="font-semibold">Activación automática pendiente</div><ul class="mt-1 list-disc list-inside">${detailHtml}</ul>`;
    } else if (verificationCta) {
      verificationCta.classList.add('hidden');
      verificationCta.innerHTML = '';
    }
    return;
  }

  gateStatusCta.classList.remove('hidden');
  gateStatusCta.classList.remove('border-emerald-200', 'bg-emerald-50', 'text-emerald-900');
  gateStatusCta.classList.add('border-amber-200', 'bg-amber-50', 'text-amber-900');
  const gateTitle = gateStatusCta.querySelector('p');
  if (gateTitle) gateTitle.textContent = 'Antes de continuar al formulario completo:';
  btnContinuarFormulario.disabled = true;
  btnContinuarFormulario.textContent = 'Completa logo, portada y pago primero';
  setFullProfileVisibility(false);
  if (verificationCta) {
    verificationCta.classList.add('hidden');
    verificationCta.innerHTML = '';
  }
}

async function aplicarEstadoActivacionAutomatica(comercio = {}, planInfo = resolverPlanComercio(comercio), horarios = []) {
  if (!isComercioVerificado(comercio)) return;
  if (!isBrandingGateReady(comercio, planInfo)) return;

  const horariosCount = getHorariosConfiguradosCount(horarios);
  const storeMode = readStoreModeFromForm();
  const requiereFisica = storeMode.tiendaFisica === true;
  const horarioOk = requiereFisica ? horariosCount >= 7 : true;
  const direccionValor = String(direccion?.value || comercio?.direccion || '').trim();
  const direccionOk = !requiereFisica
    ? true
    : (Number(planInfo.nivel || 0) <= 0 ? true : Boolean(direccionValor));
  const readyToActivate = horarioOk && direccionOk;

  const nextListing = readyToActivate ? 'publicado' : 'borrador';
  const nextActivo = readyToActivate;
  const currentListing = String(comercio.estado_listing || '').toLowerCase();
  const currentActivo = comercio.activo === true;

  if (currentListing === nextListing && currentActivo === nextActivo) return;

  const { error } = await supabase
    .from('Comercios')
    .update({
      estado_listing: nextListing,
      activo: nextActivo,
    })
    .eq('id', idComercio);
  if (error) {
    console.error('No se pudo actualizar estado de activación automática:', error);
    if (verificationCta) {
      verificationCta.classList.remove('hidden');
      verificationCta.innerHTML = `<div class="font-semibold">No se pudo activar automáticamente</div><p class="mt-1">${error?.message || 'Revisa requisitos de validación y horario.'}</p>`;
    }
    return;
  }

  if (readyToActivate) {
    alert('Comercio activado automáticamente. Ya aparece activo en Findixi.');
  }
}

function renderHorarios(horarios = []) {
  if (!horariosContainer) return;
  horariosContainer.innerHTML = '';
  dias.forEach((dia, i) => {
    const row = horarios.find((h) => Number(h.diaSemana) === i) || {};
    const apertura = row.apertura?.substring(0, 5) || '';
    const cierre = row.cierre?.substring(0, 5) || '';
    const cerrado = row.cerrado || false;
    const feriado = row.feriado || null;

    const div = document.createElement('div');
    div.className = 'grid grid-cols-12 items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2';
    div.innerHTML = `
      <span class="col-span-3 sm:col-span-2 font-semibold text-sm text-gray-800">${dia}</span>
      <div class="col-span-4 sm:col-span-4">
        <input type="time" class="w-full border rounded px-2 py-1 apertura" value="${apertura}" ${cerrado ? 'disabled' : ''}>
      </div>
      <span class="col-span-1 text-center text-sm text-gray-500">a</span>
      <div class="col-span-4 sm:col-span-4">
        <input type="time" class="w-full border rounded px-2 py-1 cierre" value="${cierre}" ${cerrado ? 'disabled' : ''}>
      </div>
      <label class="col-span-12 sm:col-span-1 flex items-center gap-1 text-xs text-gray-700 justify-end sm:justify-start mt-1 sm:mt-0">
        <input type="checkbox" class="cerrado" ${cerrado ? 'checked' : ''}> Cerrado
      </label>
    `;
    const cb = div.querySelector('.cerrado');
    const ap = div.querySelector('.apertura');
    const ci = div.querySelector('.cierre');
    cb.addEventListener('change', () => {
      ap.disabled = cb.checked;
      ci.disabled = cb.checked;
    });
    horariosContainer.appendChild(div);
  });
}

function renderFeriados(list = []) {
  if (!feriadosContainer) return;
  feriadosContainer.innerHTML = '';
  if (!list.length) {
    feriadosContainer.innerHTML = '<p class="text-sm text-gray-500">No hay feriados registrados.</p>';
    return;
  }
  list.forEach((f) => {
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-3 bg-gray-50 border border-gray-200 rounded px-3 py-2';
    wrap.innerHTML = `
      <input type="date" class="border rounded px-2 py-1 flex-1" value="${f.feriado}" data-id="${f.id}">
      <button class="text-red-600 text-sm" data-id="${f.id}">Eliminar</button>
    `;
    wrap.querySelector('button').addEventListener('click', () => eliminarFeriado(f.id));
    feriadosContainer.appendChild(wrap);
  });
}

async function cargarDatos() {
  if (!idComercio) return;
  fullFormUnlocked = onboardingFlow ? loadOnboardingUnlockState() : true;
  const baseSelect =
    'nombre,logo,portada,latitud,longitud,telefono,direccion,whatsapp,facebook,instagram,tiktok,webpage,descripcion,plan_id,plan_nivel,plan_nombre,plan_status,pago_estado_demo,permite_menu,permite_especiales,permite_ordenes,permite_perfil,aparece_en_cercanos,estado_propiedad,estado_verificacion,propietario_verificado,logo_estado,logo_aprobado,portada_estado,portada_aprobada,estado_listing,activo';
  let { data, error } = await supabase
    .from('Comercios')
    .select(`${baseSelect},tiendaFisica,tiendaOnline`)
    .eq('id', idComercio)
    .maybeSingle();

  if (isMissingStoreColumnsError(error)) {
    const fallback = await supabase
      .from('Comercios')
      .select(baseSelect)
      .eq('id', idComercio)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
    if (!error) {
      setStoreModeFeedback('warning', 'Aún no están creadas las columnas tiendaFisica/tiendaOnline en la base de datos. La modalidad de tienda no se guardará hasta aplicar el SQL.');
    }
  }
  if (!error && data) {
    comercioActual = data;
    renderProtectedFields(data);
    const comercioVerificado = isComercioVerificado(data);
    renderImageValidationCta(data);
    setFieldsLocked([telefono, direccion], !comercioVerificado);

    if (verificationCta) {
      if (!comercioVerificado) {
        verificationCta.classList.remove('hidden');
        verificationCta.innerHTML = `
          <div class="font-semibold">Propiedad pendiente de verificación</div>
          <p class="mt-1">Mientras el comercio no esté verificado, no puedes cambiar teléfono ni dirección, ni publicar módulos avanzados.</p>
        `;
      } else {
        verificationCta.classList.add('hidden');
        verificationCta.innerHTML = '';
      }
    }

    telefono.value = data.telefono || '';
    direccion.value = data.direccion || '';
    whatsapp.value = data.whatsapp || '';
    facebook.value = data.facebook || '';
    instagram.value = data.instagram || '';
    tiktok.value = data.tiktok || '';
    webpage.value = data.webpage || '';
    descripcion.value = data.descripcion || '';
    const storeMode = readStoreModeFromComercio(data);
    if (tiendaFisicaInput) tiendaFisicaInput.checked = storeMode.tiendaFisica;
    if (tiendaOnlineInput) tiendaOnlineInput.checked = storeMode.tiendaOnline;
    applyStoreModeUI(storeMode);

    const planInfo = resolverPlanComercio(data);
    if (planBadge) planBadge.textContent = planInfo.nombre;
    if (planDetails) {
      const basePlan = obtenerPlanPorNivel(planInfo.nivel);
      const resumen = Array.isArray(basePlan.features) ? basePlan.features.slice(0, 3).join(' · ') : '';
      planDetails.textContent = `${formatoPrecio(planInfo.precio)}${resumen ? ` · Incluye: ${resumen}` : ''}`;
    }
    if (btnCambiarPlan) btnCambiarPlan.href = `./paquetes.html?id=${idComercio}`;

    const puedeRedes = planInfo.nivel >= 1;
    const puedeMenu = planInfo.permite_menu;
    const puedeEspeciales = planInfo.permite_especiales;
    const ctaPrincipal = await resolvePrimaryActionCta(data);

    const bloquearInput = (el) => {
      if (!el) return;
      el.disabled = true;
      el.classList.add('bg-gray-100', 'cursor-not-allowed');
    };

    if (!puedeRedes) {
      [whatsapp, facebook, instagram, tiktok, webpage, descripcion].forEach(bloquearInput);
      if (planCta) {
        planCta.classList.remove('hidden');
        planCta.innerHTML = `
          <div class="font-semibold">Tu plan actual no incluye redes ni descripción avanzada.</div>
          <p class="text-sm">Si necesitas estas opciones, puedes cambiar de plan aquí mismo.</p>
        `;
      }
    } else if (planCta) {
      planCta.classList.add('hidden');
      planCta.innerHTML = '';
    }

    if (btnAdminMenu) {
      btnAdminMenu.classList.remove('opacity-60', 'pointer-events-none');
      btnAdminMenu.textContent = ctaPrincipal?.label || 'Menu';
      btnAdminMenu.href = ctaPrincipal?.href || `./adminMenuComercio.html?id=${idComercio}`;
    }

    if (ctaPrincipal?.profileType === 'menu' && !puedeMenu && btnAdminMenu) {
      btnAdminMenu.classList.add('opacity-60', 'pointer-events-none');
      btnAdminMenu.textContent = 'Menu (Plus)';
    }

    if (!puedeEspeciales && btnAdministrarEspeciales) {
      btnAdministrarEspeciales.classList.add('opacity-60', 'pointer-events-none');
      btnAdministrarEspeciales.textContent = 'Especiales (Plus)';
    }

    renderQuickOverview(data, horariosActuales);
  }

  const { data: horarios, error: errHor } = await supabase
    .from('Horarios')
    .select('*')
    .eq('idComercio', idComercio);
  if (!errHor) {
    horariosActuales = horarios || [];
    renderHorarios(horariosActuales);
    const feriados = horariosActuales.filter((h) => h.feriado);
    renderFeriados(feriados);
  }
  renderOnboardingGate(comercioActual || {}, resolverPlanComercio(comercioActual || {}), horariosActuales);
  renderQuickOverview(comercioActual || {}, horariosActuales);

  // links
  if (btnStaffServicios) btnStaffServicios.href = `./staff.html?id=${idComercio}`;
  if (btnAdministrarEspeciales) btnAdministrarEspeciales.href = `./especiales/adminEspeciales.html?id=${idComercio}`;
}

async function guardarPerfil() {
  if (!idComercio) return;
  if (onboardingFlow && !fullFormUnlocked) {
    alert('Primero completa logo, portada y pago del plan. Luego pulsa "Continuar al formulario completo".');
    return;
  }
  const storeMode = readStoreModeFromForm();
  if (!storeMode.tiendaFisica && !storeMode.tiendaOnline) {
    setStoreModeFeedback('error', 'Debes seleccionar al menos una modalidad: tienda física o tienda online.');
    return;
  }

  const payload = {
    telefono: telefono.value.trim() || null,
    direccion: direccion.value.trim() || null,
    whatsapp: whatsapp.value.trim() || null,
    facebook: facebook.value.trim() || null,
    instagram: instagram.value.trim() || null,
    tiktok: tiktok.value.trim() || null,
    webpage: webpage.value.trim() || null,
    descripcion: descripcion.value.trim() || null,
    tiendaFisica: storeMode.tiendaFisica,
    tiendaOnline: storeMode.tiendaOnline,
  };
  let perfilError = null;
  let { error } = await supabase.from('Comercios').update(payload).eq('id', idComercio);
  if (isMissingStoreColumnsError(error)) {
    const { tiendaFisica: _storeFisica, tiendaOnline: _storeOnline, ...fallbackPayload } = payload;
    const fallbackUpdate = await supabase.from('Comercios').update(fallbackPayload).eq('id', idComercio);
    error = fallbackUpdate.error;
    if (!error) {
      setStoreModeFeedback('warning', 'Perfil guardado, pero la modalidad de tienda no se guardó porque faltan columnas en DB. Ejecuta el SQL de tiendaFisica/tiendaOnline.');
    }
  }
  if (error) {
    perfilError = error;
    const errorText = String(error?.message || '').toLowerCase();
    if (errorText.includes('propiedad pendiente de verificacion')) {
      alert('No puedes cambiar teléfono o dirección hasta completar la verificación de propiedad.');
    } else if (errorText.includes('cambios bloqueados')) {
      alert('Este comercio tiene candados activos para nombre/coordenadas/logo. Dirección y horarios sí deben poder guardarse después de aplicar la migración f34.');
    } else {
      alert('No se pudo guardar el perfil');
    }
    console.error(error);
  }

  const horarioError = await guardarHorarios({ silent: true });
  if (horarioError) {
    console.error('Error guardando horarios', horarioError);
    alert('No se pudieron guardar los horarios');
  }

  if (!perfilError && !horarioError) {
    await cargarDatos();
    await aplicarEstadoActivacionAutomatica(
      comercioActual || {},
      resolverPlanComercio(comercioActual || {}),
      horariosActuales
    );
    await cargarDatos();
    alert('Perfil actualizado');
  } else if (!perfilError && horarioError) {
    alert('Perfil actualizado, pero no se pudieron guardar los horarios.');
  } else if (perfilError && !horarioError) {
    alert('Horarios guardados, pero no se pudo actualizar el perfil.');
  }
}

async function subirPrimerLogoConValidacion({ mode = 'validate' } = {}) {
  if (!idComercio) return;
  clearFirstLogoFeedback();

  if (!comercioActual || comercioActual.logo) {
    setFirstLogoFeedback('warning', 'Este flujo aplica cuando el comercio aún no tiene logo.');
    return;
  }

  const file = firstLogoInput?.files?.[0] || null;
  if (!file) {
    setFirstLogoFeedback('warning', 'Selecciona un archivo PNG/JPG/WEBP.');
    return;
  }

  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(String(file.type || '').toLowerCase())) {
    setFirstLogoFeedback('warning', 'Formato no permitido. Usa PNG, JPG o WEBP.');
    return;
  }

  const isUpgradeMode = mode === 'upgrade_demo';
  const previousText = isUpgradeMode
    ? firstLogoUpgradeBtn?.textContent || 'Optimizar automáticamente'
    : firstLogoProcessBtn?.textContent || 'Validar y subir logo';
  if (isUpgradeMode) {
    if (firstLogoUpgradeBtn) {
      firstLogoUpgradeBtn.disabled = true;
      firstLogoUpgradeBtn.textContent = 'Optimizando...';
    }
  } else if (firstLogoProcessBtn) {
    firstLogoProcessBtn.disabled = true;
    firstLogoProcessBtn.textContent = 'Procesando...';
  }

  try {
    const dataUrl = await getPreparedLogoDataUrl(file);
    if (!dataUrl) {
      setFirstLogoFeedback(
        'warning',
        'No se pudo preparar el logo. Ajusta el encuadre o sube otro archivo.'
      );
      return;
    }
    const {
      data: { session } = {},
    } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    if (!token) {
      setFirstLogoFeedback('error', 'Tu sesión expiró. Vuelve a iniciar sesión.');
      return;
    }

    const payload = await callImageProcessEndpoint(
      {
        idComercio: Number(idComercio),
        type: 'logo',
        mode,
        file_base64: dataUrl,
        file_name: file.name || 'logo',
        mime_type: 'image/png',
      },
      token
    );

    if (payload?.aprobado) {
      const suffix = isUpgradeMode
        ? (payload?.demo_mode ? ' (modo demo sin cobro real).' : '.')
        : '.';
      setFirstLogoFeedback('success', `${payload?.nota || 'Logo aprobado y guardado'}${suffix}`);
      hideLogoUpgradeBox();
      clearFirstLogoEditor();
      await cargarDatos();
      return;
    }

    setFirstLogoFeedback(
      'warning',
      payload?.nota || 'Tu logo requiere ajustes. Sube otra imagen con fondo blanco o transparente.'
    );
    showLogoUpgradeBox(payload?.logo_upgrade_offer, payload?.nota || '');
  } catch (error) {
    console.error('Error procesando primer logo:', error);
    setFirstLogoFeedback('error', error?.message || 'No se pudo procesar el logo en este momento.');
  } finally {
    if (isUpgradeMode) {
      if (firstLogoUpgradeBtn) {
        firstLogoUpgradeBtn.disabled = false;
        firstLogoUpgradeBtn.textContent = previousText;
      }
    } else if (firstLogoProcessBtn) {
      firstLogoProcessBtn.disabled = false;
      firstLogoProcessBtn.textContent = previousText;
    }
  }
}

async function subirPrimeraPortadaConValidacion() {
  if (!idComercio) return;
  clearFirstPortadaFeedback();

  if (!comercioActual || comercioActual.portada) {
    setFirstPortadaFeedback('warning', 'Este flujo aplica cuando el comercio aún no tiene portada.');
    return;
  }

  const file = firstPortadaInput?.files?.[0] || null;
  if (!file) {
    setFirstPortadaFeedback('warning', 'Selecciona un archivo PNG/JPG/WEBP.');
    return;
  }

  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(String(file.type || '').toLowerCase())) {
    setFirstPortadaFeedback('warning', 'Formato no permitido. Usa PNG, JPG o WEBP.');
    return;
  }

  const previousText = firstPortadaProcessBtn?.textContent || 'Validar y subir portada';
  if (firstPortadaProcessBtn) {
    firstPortadaProcessBtn.disabled = true;
    firstPortadaProcessBtn.textContent = 'Procesando...';
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    const {
      data: { session } = {},
    } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    if (!token) {
      setFirstPortadaFeedback('error', 'Tu sesión expiró. Vuelve a iniciar sesión.');
      return;
    }

    const payload = await callImageProcessEndpoint(
      {
        idComercio: Number(idComercio),
        type: 'portada',
        mode: 'validate',
        file_base64: dataUrl,
        file_name: file.name || 'portada',
        mime_type: file.type || 'image/png',
      },
      token
    );

    if (payload?.aprobado) {
      setFirstPortadaFeedback('success', payload?.nota || 'Portada aprobada y guardada.');
      await cargarDatos();
      return;
    }

    setFirstPortadaFeedback(
      'warning',
      payload?.nota || 'La portada requiere ajustes. Sube otra imagen con mejor resolución.'
    );
  } catch (error) {
    console.error('Error procesando primera portada:', error);
    setFirstPortadaFeedback('error', error?.message || 'No se pudo procesar la portada en este momento.');
  } finally {
    if (firstPortadaProcessBtn) {
      firstPortadaProcessBtn.disabled = false;
      firstPortadaProcessBtn.textContent = previousText;
    }
  }
}

async function guardarHorarios({ silent = false } = {}) {
  if (!idComercio || !horariosContainer) return;
  const rows = Array.from(horariosContainer.children).map((div, idx) => {
    const apertura = div.querySelector('.apertura').value || null;
    const cierre = div.querySelector('.cierre').value || null;
    const cerrado = div.querySelector('.cerrado').checked;
    return {
      idComercio: idComercio,
      diaSemana: idx,
      apertura: cerrado ? null : apertura,
      cierre: cerrado ? null : cierre,
      cerrado,
    };
  });
  const { error } = await supabase.from('Horarios').upsert(rows, { onConflict: 'idComercio,diaSemana' });
  if (error) {
    if (!silent) {
      console.error('Error guardando horarios', error);
      alert('No se pudieron guardar los horarios');
    }
    return error;
  }
  horariosActuales = rows;
  renderQuickOverview(comercioActual || {}, horariosActuales);
  return null;
}

async function agregarFeriado() {
  const fecha = prompt('Fecha del feriado (YYYY-MM-DD):');
  if (!fecha || isNaN(Date.parse(fecha))) {
    alert('Fecha inválida');
    return;
  }
  const { error } = await supabase.from('Horarios').insert({ idComercio, feriado: fecha });
  if (error) {
    console.error('Error agregando feriado', error);
    alert('No se pudo agregar el feriado');
    return;
  }
  await cargarDatos();
}

async function eliminarFeriado(idRow) {
  const confirmar = confirm('¿Eliminar este feriado?');
  if (!confirmar) return;
  const { error } = await supabase.from('Horarios').update({ feriado: null }).eq('id', idRow);
  if (error) {
    console.error('Error eliminando feriado', error);
    alert('No se pudo eliminar el feriado');
    return;
  }
  await cargarDatos();
}

btnGuardar?.addEventListener('click', (e) => {
  e.preventDefault();
  guardarPerfil();
});

btnAgregarFeriado?.addEventListener('click', (e) => {
  e.preventDefault();
  agregarFeriado();
});

function handleStoreModeToggle(changedInput) {
  const mode = readStoreModeFromForm();
  if (!mode.tiendaFisica && !mode.tiendaOnline && changedInput) {
    changedInput.checked = true;
  }
  const nextMode = readStoreModeFromForm();
  applyStoreModeUI(nextMode);
  renderOnboardingGate(comercioActual || {}, resolverPlanComercio(comercioActual || {}), horariosActuales);
  renderQuickOverview(comercioActual || {}, horariosActuales);
}

tiendaFisicaInput?.addEventListener('change', () => {
  handleStoreModeToggle(tiendaFisicaInput);
});
tiendaOnlineInput?.addEventListener('change', () => {
  handleStoreModeToggle(tiendaOnlineInput);
});
[telefono, direccion, descripcion].forEach((input) => {
  input?.addEventListener('input', () => {
    renderQuickOverview(comercioActual || {}, horariosActuales);
  });
});

btnContinuarFormulario?.addEventListener('click', async (e) => {
  e.preventDefault();
  if (!comercioActual) return;
  const planInfo = resolverPlanComercio(comercioActual);
  if (!isBrandingGateReady(comercioActual, planInfo)) {
    alert('Para continuar debes tener logo y portada aprobados, y el pago del plan confirmado.');
    return;
  }
  fullFormUnlocked = true;
  persistOnboardingUnlockState(true);
  renderOnboardingGate(comercioActual, planInfo, horariosActuales);
  renderQuickOverview(comercioActual || {}, horariosActuales);
});
firstLogoProcessBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  subirPrimerLogoConValidacion({ mode: 'validate' });
});
firstLogoInput?.addEventListener('change', async () => {
  clearFirstLogoFeedback();
  hideLogoUpgradeBox();
  const file = firstLogoInput?.files?.[0] || null;
  if (!file) {
    clearFirstLogoEditor();
    return;
  }
  try {
    await prepareFirstLogoEditor(file);
  } catch (error) {
    console.error('Error preparando editor de logo:', error);
    setFirstLogoFeedback('error', error?.message || 'No se pudo preparar la vista previa del logo.');
  }
});
firstLogoRetryBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  clearFirstLogoFeedback();
  hideLogoUpgradeBox();
  clearFirstLogoEditor();
  if (firstLogoInput) {
    firstLogoInput.value = '';
    firstLogoInput.focus();
  }
});
firstLogoUpgradeBtn?.addEventListener('click', async (e) => {
  e.preventDefault();
  const priceLabel = firstLogoOffer?.label || 'modo demo';
  const ok = confirm(`Logo Upgrade: ${priceLabel}\n\nEn esta etapa correrá en modo demo (sin cobro real). ¿Continuar?`);
  if (!ok) return;
  await subirPrimerLogoConValidacion({ mode: 'upgrade_demo' });
});
firstLogoZoom?.addEventListener('input', () => {
  updateFirstLogoScaleBySlider();
});
firstLogoCenterBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!firstLogoEditorState) return;
  firstLogoEditorState.offsetX = 0;
  firstLogoEditorState.offsetY = 0;
  renderFirstLogoPreview(true);
});
firstLogoPreviewCanvas?.addEventListener('pointerdown', (event) => {
  if (!firstLogoEditorState || !firstLogoPreviewCanvas) return;
  const rect = firstLogoPreviewCanvas.getBoundingClientRect();
  firstLogoEditorState.dragging = true;
  firstLogoEditorState.dragStartX = event.clientX - rect.left;
  firstLogoEditorState.dragStartY = event.clientY - rect.top;
  firstLogoEditorState.startOffsetX = firstLogoEditorState.offsetX;
  firstLogoEditorState.startOffsetY = firstLogoEditorState.offsetY;
  firstLogoPreviewCanvas.setPointerCapture(event.pointerId);
});
firstLogoPreviewCanvas?.addEventListener('pointermove', (event) => {
  if (!firstLogoEditorState?.dragging || !firstLogoPreviewCanvas) return;
  const rect = firstLogoPreviewCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const dx = x - firstLogoEditorState.dragStartX;
  const dy = y - firstLogoEditorState.dragStartY;
  firstLogoEditorState.offsetX = firstLogoEditorState.startOffsetX + dx;
  firstLogoEditorState.offsetY = firstLogoEditorState.startOffsetY + dy;
  renderFirstLogoPreview(true);
});
function stopLogoDrag(event) {
  if (!firstLogoEditorState || !firstLogoPreviewCanvas) return;
  firstLogoEditorState.dragging = false;
  if (event?.pointerId !== undefined && firstLogoPreviewCanvas.hasPointerCapture(event.pointerId)) {
    firstLogoPreviewCanvas.releasePointerCapture(event.pointerId);
  }
}
firstLogoPreviewCanvas?.addEventListener('pointerup', stopLogoDrag);
firstLogoPreviewCanvas?.addEventListener('pointercancel', stopLogoDrag);
firstLogoPreviewCanvas?.addEventListener('pointerleave', stopLogoDrag);
firstPortadaProcessBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  subirPrimeraPortadaConValidacion();
});
firstPortadaInput?.addEventListener('change', () => {
  clearFirstPortadaFeedback();
});

document.addEventListener('DOMContentLoaded', async () => {
  applyStoreModeUI(readStoreModeFromForm());
  await cargarDatos();
});
