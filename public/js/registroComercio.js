import { supabase } from '../shared/supabaseClient.js';
import { PLANES_PRELIMINARES, formatoPrecio, obtenerPlanPorNivel } from '../shared/planes.js';

const planesGrid = document.getElementById('planesGrid');
const planLabel = document.getElementById('planActualLabel');
const planInput = document.getElementById('planSeleccionado');
const loginModal = document.getElementById('loginModal');
const loginModalClose = document.getElementById('loginModalClose');
const formModal = document.getElementById('formModal');
const formModalClose = document.getElementById('formModalClose');
const planSeleccionadoLabel = document.getElementById('planSeleccionadoLabel');
const form = document.getElementById('comercioForm');
const submitRegistroBtn = document.getElementById('submitRegistroBtn');
const inputNombreComercio = document.getElementById('inputNombreComercio');
const selectMunicipio = document.getElementById('selectMunicipio');
const inputLatitud = document.getElementById('inputLatitud');
const inputLongitud = document.getElementById('inputLongitud');
const btnToggleMapPicker = document.getElementById('btnToggleMapPicker');
const mapPickerPanel = document.getElementById('mapPickerPanel');
const mapAddressSearch = document.getElementById('mapAddressSearch');
const btnMapSearchAddress = document.getElementById('btnMapSearchAddress');
const btnMapUseMyLocation = document.getElementById('btnMapUseMyLocation');
const mapPickerHint = document.getElementById('mapPickerHint');
const formFeedback = document.getElementById('formFeedback');
const googleMatchConfirmBox = document.getElementById('googleMatchConfirmBox');
const googleMatchCard = document.getElementById('googleMatchCard');
const btnMatchConfirmYes = document.getElementById('btnMatchConfirmYes');
const btnMatchConfirmNo = document.getElementById('btnMatchConfirmNo');
const btnVerOtrosMatches = document.getElementById('btnVerOtrosMatches');
const googleOtherMatches = document.getElementById('googleOtherMatches');
const noEsMiComercioBox = document.getElementById('noEsMiComercioBox');
const noEsMiComercioHint = document.getElementById('noEsMiComercioHint');
const btnNoFlowVerOtros = document.getElementById('btnNoFlowVerOtros');
const btnNoFlowAjustarPin = document.getElementById('btnNoFlowAjustarPin');
const btnNoFlowBuscarDeNuevo = document.getElementById('btnNoFlowBuscarDeNuevo');
const btnNoFlowNoAparece = document.getElementById('btnNoFlowNoAparece');
const nuevoComercioFlowBox = document.getElementById('nuevoComercioFlowBox');
const inputNuevoComercioPhone = document.getElementById('inputNuevoComercioPhone');
const btnNoFlowCrearNuevo = document.getElementById('btnNoFlowCrearNuevo');
const modoProteccionBox = document.getElementById('modoProteccionBox');
const btnProteccionVerificarTelefono = document.getElementById('btnProteccionVerificarTelefono');
const btnProteccionManual = document.getElementById('btnProteccionManual');
const btnProteccionVolver = document.getElementById('btnProteccionVolver');
const disputaActivoBox = document.getElementById('disputaActivoBox');
const otpVerificationBox = document.getElementById('otpVerificationBox');
const otpIntroText = document.getElementById('otpIntroText');
const otpMetaText = document.getElementById('otpMetaText');
const otpCodeInput = document.getElementById('otpCodeInput');
const btnOtpVerify = document.getElementById('btnOtpVerify');
const otpActionsRow = document.getElementById('otpActionsRow');
const btnOtpResend = document.getElementById('btnOtpResend');
const btnOtpVoice = document.getElementById('btnOtpVoice');
const btnOtpNoRecibi = document.getElementById('btnOtpNoRecibi');
const otpFeedback = document.getElementById('otpFeedback');
const otpVerifiedSummary = document.getElementById('otpVerifiedSummary');
const otpVerifiedMessage = document.getElementById('otpVerifiedMessage');
const otpVerifiedHint = document.getElementById('otpVerifiedHint');
const btnOtpContinue = document.getElementById('btnOtpContinue');
const planNextModal = document.getElementById('planNextModal');
const planNextModalClose = document.getElementById('planNextModalClose');
const planNextModalTitle = document.getElementById('planNextModalTitle');
const planNextModalText = document.getElementById('planNextModalText');
const planNextModalContinue = document.getElementById('planNextModalContinue');
const brandingSetupModal = document.getElementById('brandingSetupModal');
const brandingSetupClose = document.getElementById('brandingSetupClose');
const brandingSetupStatus = document.getElementById('brandingSetupStatus');
const brandingLogoInput = document.getElementById('brandingLogoInput');
const brandingLogoValidateBtn = document.getElementById('brandingLogoValidateBtn');
const brandingLogoUpgradeBox = document.getElementById('brandingLogoUpgradeBox');
const brandingLogoUpgradeText = document.getElementById('brandingLogoUpgradeText');
const brandingLogoRetryBtn = document.getElementById('brandingLogoRetryBtn');
const brandingLogoUpgradeBtn = document.getElementById('brandingLogoUpgradeBtn');
const brandingLogoFeedback = document.getElementById('brandingLogoFeedback');
const brandingPortadaInput = document.getElementById('brandingPortadaInput');
const brandingPortadaValidateBtn = document.getElementById('brandingPortadaValidateBtn');
const brandingPortadaFeedback = document.getElementById('brandingPortadaFeedback');
const brandingContinueBtn = document.getElementById('brandingContinueBtn');
const comercioActivoModal = document.getElementById('comercioActivoModal');
const comercioActivoModalClose = document.getElementById('comercioActivoModalClose');
const comercioActivoCard = document.getElementById('comercioActivoCard');
const comercioActivoTitulo = document.getElementById('comercioActivoTitulo');
const btnAbrirDisputaDesdeActivo = document.getElementById('btnAbrirDisputaDesdeActivo');
const disputaModal = document.getElementById('disputaModal');
const disputaModalClose = document.getElementById('disputaModalClose');
const disputaForm = document.getElementById('disputaForm');
const disputaComercioInfo = document.getElementById('disputaComercioInfo');
const disputaNombre = document.getElementById('disputaNombre');
const disputaEmail = document.getElementById('disputaEmail');
const disputaTelefono = document.getElementById('disputaTelefono');
const disputaMensaje = document.getElementById('disputaMensaje');
const disputaFeedback = document.getElementById('disputaFeedback');
const disputaSubmitBtn = document.getElementById('disputaSubmitBtn');

const authState = {
  user: null,
  loggedIn: false,
};

const DEFAULT_MAP_CENTER = { lat: 18.2208, lng: -66.5901 };
const DEFAULT_MAP_ZOOM = 9;
const ACTIVE_MAP_ZOOM = 17;
const GOOGLE_MATCH_RADII_METERS = [200, 500, 800];
const MATCH_STRONG_DISTANCE_M = 150;
const MATCH_MEDIUM_DISTANCE_M = 400;
const PIN_MOVE_ALLOW_NEW_M = 250;
const DUPLICATE_DISTANCE_M = 200;
const COMERCIO_LOGIN_BASE_URL =
  String(window.FINDIXI_COMERCIO_LOGIN_BASE_URL || 'https://comercio.enpe-erre.com').trim() ||
  'https://comercio.enpe-erre.com';

let selectedNivel = null;
let mapPickerInstance = null;
let mapPickerMarker = null;
let mapAutocomplete = null;
let googleMapsScriptPromise = null;
let googleMapsApiKeyCache = '';
let municipiosLoaded = false;
let googleMatchState = {
  matches: [],
  selectedPlaceId: null,
  searchCenter: null,
};
let lastGoogleSearchResult = null;
let disputaContext = null;
let otpState = {
  idComercio: null,
  challengeId: null,
  cooldownSeconds: 0,
  expiresIn: 0,
  channelUsed: null,
  maskedDestination: null,
  comercioNombre: null,
  timerId: null,
  verified: false,
};
let brandingState = {
  logoAprobado: false,
  portadaAprobada: false,
  logoOffer: null,
  idComercio: null,
};

function toFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(' ').filter(Boolean);
}

function overlapRatio(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const bSet = new Set(bTokens);
  let hits = 0;
  aTokens.forEach((token) => {
    if (bSet.has(token)) hits += 1;
  });
  return hits / Math.max(aTokens.length, bTokens.length);
}

function isValidCoordinatePair(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1);
  const aLon = Number(lon1);
  const bLat = Number(lat2);
  const bLon = Number(lon2);
  if (!isValidCoordinatePair(aLat, aLon) || !isValidCoordinatePair(bLat, bLon)) return null;

  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadius * c;
}

function computeNameSimilarityScore(inputName, candidateName) {
  const inputNorm = normalizeText(inputName);
  const candidateNorm = normalizeText(candidateName);
  if (!inputNorm || !candidateNorm) return 0;
  if (inputNorm === candidateNorm) return 100;

  let score = 0;
  if (candidateNorm.includes(inputNorm) || inputNorm.includes(candidateNorm)) {
    score += 50;
  }
  const ratio = overlapRatio(tokenize(inputNorm), tokenize(candidateNorm));
  score += Math.round(ratio * 50);
  return Math.max(0, Math.min(100, score));
}

function computeDistanceScore(meters) {
  if (!Number.isFinite(meters)) return 0;
  if (meters <= 60) return 100;
  if (meters <= 120) return 95;
  if (meters <= 200) return 90;
  if (meters <= 350) return 80;
  if (meters <= 500) return 70;
  if (meters <= 800) return 55;
  if (meters <= 1200) return 35;
  return 10;
}

function classifyMatchStrength({ distanceM, nameScore, municipioMatch }) {
  const distanceBand = Number.isFinite(distanceM)
    ? distanceM <= MATCH_STRONG_DISTANCE_M
      ? 'fuerte'
      : distanceM <= MATCH_MEDIUM_DISTANCE_M
        ? 'medio'
        : 'debil'
    : 'debil';
  const nameStrong = Number(nameScore || 0) >= 70;
  const isStrong = distanceBand === 'fuerte' && nameStrong && Boolean(municipioMatch);

  if (isStrong) {
    return { match_strength: 'fuerte', is_match_fuerte: true, distance_band: distanceBand };
  }
  if (distanceBand === 'debil' || Number(nameScore || 0) < 55) {
    return { match_strength: 'debil', is_match_fuerte: false, distance_band: distanceBand };
  }
  return { match_strength: 'medio', is_match_fuerte: false, distance_band: distanceBand };
}

function getTopMatch() {
  return Array.isArray(googleMatchState.matches) && googleMatchState.matches.length
    ? googleMatchState.matches[0]
    : null;
}

function getCurrentPinMovementFromSearchCenterMeters() {
  const center = lastGoogleSearchResult?.center || googleMatchState.searchCenter;
  if (!center) return 0;

  const current = getStep1Payload();
  const moved = distanceMeters(current.latitud, current.longitud, center.latitud, center.longitud);
  return Number.isFinite(moved) ? Math.round(moved) : 0;
}

function getAuthUserPhone() {
  const metadata = authState.user?.user_metadata || {};
  return (
    authState.user?.phone ||
    metadata.phone ||
    metadata.telefono ||
    metadata.phone_number ||
    ''
  );
}

function normalizePhoneDigits(phoneRaw) {
  const digits = String(phoneRaw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function phonesLikelyMatch(a, b) {
  const x = normalizePhoneDigits(a);
  const y = normalizePhoneDigits(b);
  if (!x || !y) return false;
  return x === y;
}

function parseMissingColumn(error) {
  const message = String(error?.message || '');
  const details = String(error?.details || '');
  const source = `${message} ${details}`;
  const patterns = [
    /column\s+"([a-zA-Z0-9_]+)"\s+does not exist/i,
    /column\s+'([a-zA-Z0-9_]+)'\s+does not exist/i,
    /Could not find the '([a-zA-Z0-9_]+)' column/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function insertComercioWithFallback(payload) {
  let body = { ...payload };
  for (let i = 0; i < 18; i += 1) {
    const { data, error } = await supabase
      .from('Comercios')
      .insert(body)
      .select('id, nombre, owner_user_id, estado_propiedad, estado_verificacion')
      .single();
    if (!error) return { data, usedPayload: body };

    const missingColumn = parseMissingColumn(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(body, missingColumn)) {
      delete body[missingColumn];
      continue;
    }
    return { error };
  }
  return { error: new Error('No se pudo insertar el comercio con el esquema actual.') };
}

async function updateComercioWithFallback(idComercio, payload) {
  let body = { ...payload };
  for (let i = 0; i < 18; i += 1) {
    const { error } = await supabase.from('Comercios').update(body).eq('id', idComercio);
    if (!error) return { usedPayload: body };

    const missingColumn = parseMissingColumn(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(body, missingColumn)) {
      delete body[missingColumn];
      continue;
    }
    return { error };
  }
  return { error: new Error('No se pudo actualizar el comercio con el esquema actual.') };
}

function setMapHint(message, type = 'info') {
  if (!mapPickerHint) return;
  const tone = {
    info: 'text-gray-500',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    error: 'text-red-600',
  };
  mapPickerHint.className = `text-[11px] mt-2 ${tone[type] || tone.info}`;
  mapPickerHint.textContent = message;
}

function showFeedback(type, message) {
  if (!formFeedback) return;
  const classesByType = {
    success: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-900',
    error: 'bg-red-50 border border-red-200 text-red-700',
    info: 'bg-sky-50 border border-sky-200 text-sky-800',
  };
  formFeedback.className = `text-xs rounded-lg px-3 py-2 ${classesByType[type] || classesByType.info}`;
  formFeedback.textContent = message;
  formFeedback.classList.remove('hidden');
}

function hideFeedback() {
  if (!formFeedback) return;
  formFeedback.classList.add('hidden');
  formFeedback.textContent = '';
}

function setOtpFeedback(type, message) {
  if (!otpFeedback) return;
  const classesByType = {
    success: 'bg-sky-100 border border-sky-300 text-sky-800',
    warning: 'bg-amber-100 border border-amber-300 text-amber-900',
    error: 'bg-red-100 border border-red-300 text-red-700',
    info: 'bg-sky-100 border border-sky-300 text-sky-800',
  };
  otpFeedback.className = `text-xs rounded-lg px-2 py-2 mt-2 ${classesByType[type] || classesByType.info}`;
  otpFeedback.textContent = message;
  otpFeedback.classList.remove('hidden');
}

function clearOtpFeedback() {
  if (!otpFeedback) return;
  otpFeedback.classList.add('hidden');
  otpFeedback.textContent = '';
}

function setDisputaFeedback(type, message) {
  if (!disputaFeedback) return;
  const classesByType = {
    success: 'bg-emerald-100 border border-emerald-300 text-emerald-800',
    warning: 'bg-amber-100 border border-amber-300 text-amber-900',
    error: 'bg-red-100 border border-red-300 text-red-700',
    info: 'bg-sky-100 border border-sky-300 text-sky-800',
  };
  disputaFeedback.className = `text-xs rounded-lg px-2 py-2 ${classesByType[type] || classesByType.info}`;
  disputaFeedback.textContent = message;
  disputaFeedback.classList.remove('hidden');
}

function clearDisputaFeedback() {
  if (!disputaFeedback) return;
  disputaFeedback.classList.add('hidden');
  disputaFeedback.textContent = '';
}

function setInlineFeedback(element, type, message) {
  if (!element) return;
  const classesByType = {
    success: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border border-amber-200 text-amber-900',
    error: 'bg-red-50 border border-red-200 text-red-700',
    info: 'bg-sky-50 border border-sky-200 text-sky-800',
  };
  element.className = `text-xs rounded-lg px-3 py-2 ${classesByType[type] || classesByType.info}`;
  element.textContent = message;
  element.classList.remove('hidden');
}

function clearInlineFeedback(element) {
  if (!element) return;
  element.classList.add('hidden');
  element.textContent = '';
}

function hideDisputaActivoBox() {
  disputaActivoBox?.classList.add('hidden');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCreatedAtLabel(value) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Fecha no disponible';
  return date.toLocaleDateString('es-PR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildComercioAddressText(snapshot = {}) {
  if (snapshot.direccion && snapshot.municipio) return `${snapshot.direccion}, ${snapshot.municipio}`;
  if (snapshot.direccion) return snapshot.direccion;
  if (snapshot.direccion_google) return snapshot.direccion_google;
  if (snapshot.municipio) return snapshot.municipio;
  return 'Dirección no disponible';
}

async function fetchComercioActivoSnapshot(comercioId) {
  if (!comercioId) return null;
  let columns = [
    'id',
    'nombre',
    'direccion',
    'direccion_google',
    'telefono',
    'whatsapp',
    'logo',
    'portada',
    'municipio',
    'created_at',
  ];

  for (let i = 0; i < 8; i += 1) {
    const selectClause = columns.join(', ');
    const { data, error } = await supabase
      .from('Comercios')
      .select(selectClause)
      .eq('id', comercioId)
      .limit(1)
      .maybeSingle();

    if (!error) return data || null;

    const missingColumn = parseMissingColumn(error);
    if (!missingColumn || !columns.includes(missingColumn)) {
      throw error;
    }
    columns = columns.filter((col) => col !== missingColumn);
    if (!columns.length) return null;
  }

  return null;
}

function renderComercioActivoCard(snapshot = {}) {
  if (!comercioActivoCard) return;
  const nombre = snapshot.nombre || disputaContext?.comercioNombre || 'Comercio';
  const telefono = formatPhone(snapshot.telefono || snapshot.whatsapp || snapshot.telefono_referencia_google);
  const direccion = buildComercioAddressText(snapshot);
  const creado = formatCreatedAtLabel(snapshot.created_at);
  const logo = String(snapshot.logo || '').trim();
  const portada = String(snapshot.portada || '').trim();
  const inicial = escapeHtml(nombre.charAt(0).toUpperCase() || 'C');

  const portadaHtml = portada
    ? `<img src="${escapeHtml(portada)}" alt="Portada ${escapeHtml(nombre)}" class="h-full w-full object-cover">`
    : '<div class="h-full w-full bg-gradient-to-r from-sky-100 to-slate-100"></div>';
  const logoHtml = logo
    ? `<img src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(nombre)}" class="h-20 w-20 rounded-full border-2 border-white bg-white object-cover shadow-lg p-0.5">`
    : `<div class="h-20 w-20 rounded-full border-2 border-white bg-white text-sky-700 flex items-center justify-center text-xl font-bold shadow-lg">${inicial}</div>`;

  comercioActivoCard.innerHTML = `
    <div class="relative h-28 overflow-hidden bg-gray-100">${portadaHtml}</div>
    <div class="relative px-4 pb-4 pt-12 text-center">
      <div class="absolute left-1/2 -top-10 z-10 -translate-x-1/2">${logoHtml}</div>
      <p class="mt-1 text-xl font-extrabold text-gray-900">${escapeHtml(nombre)}</p>
      <p class="mt-2 text-sm text-gray-700 inline-flex items-center justify-center gap-1 w-full"><i class="fa-solid fa-phone text-gray-500"></i>${escapeHtml(telefono)}</p>
      <p class="mt-1 text-sm text-gray-700 inline-flex items-center justify-center gap-1 w-full"><i class="fa-solid fa-location-dot text-gray-500"></i>${escapeHtml(direccion)}</p>
      <p class="mt-1 text-xs text-gray-500 inline-flex items-center justify-center gap-1 w-full"><i class="fa-regular fa-calendar"></i>Creado: ${escapeHtml(creado)}</p>
    </div>
  `;
}

async function openComercioActivoModal({ comercioId, comercioNombre, placeId, selectedMatch = null }) {
  disputaContext = {
    comercioId: Number(comercioId || 0) || null,
    comercioNombre: comercioNombre || getComercioNombreActual(),
    placeId: placeId || getSelectedGoogleMatch()?.place_id || null,
  };

  let snapshot = null;
  try {
    snapshot = await fetchComercioActivoSnapshot(disputaContext.comercioId);
  } catch (error) {
    console.error('No se pudo cargar el detalle del comercio activo:', error);
  }

  const merged = {
    ...(snapshot || {}),
    nombre: snapshot?.nombre || disputaContext.comercioNombre,
    telefono:
      snapshot?.telefono ||
      snapshot?.whatsapp ||
      selectedMatch?.telefono_google ||
      null,
    direccion_google: snapshot?.direccion_google || selectedMatch?.direccion_google || null,
  };

  renderComercioActivoCard(merged);
  if (comercioActivoTitulo) {
    comercioActivoTitulo.textContent = `${merged.nombre || 'Este comercio'} ya está activo en Findixi.`;
  }
  hideFeedback();
  closeDisputaModal();
  hideDisputaActivoBox();
  comercioActivoModal?.classList.remove('hidden');
  comercioActivoModal?.classList.add('flex');
}

function closeComercioActivoModal() {
  comercioActivoModal?.classList.add('hidden');
  comercioActivoModal?.classList.remove('flex');
}

function openDisputaModal() {
  if (!disputaModal) return;
  closeComercioActivoModal();
  const comercioNombre = disputaContext?.comercioNombre || getComercioNombreActual();
  if (disputaComercioInfo) {
    disputaComercioInfo.value = disputaContext?.comercioId
      ? `${comercioNombre} (ID ${disputaContext.comercioId})`
      : comercioNombre;
  }
  if (disputaNombre && !disputaNombre.value.trim()) {
    disputaNombre.value =
      authState.user?.user_metadata?.full_name ||
      authState.user?.user_metadata?.nombre ||
      '';
  }
  if (disputaEmail && !disputaEmail.value.trim()) {
    disputaEmail.value = authState.user?.email || '';
  }
  if (disputaTelefono && !disputaTelefono.value.trim()) {
    disputaTelefono.value = getAuthUserPhone();
  }

  clearDisputaFeedback();
  disputaModal.classList.remove('hidden');
  disputaModal.classList.add('flex');
}

function closeDisputaModal() {
  if (!disputaModal) return;
  disputaModal.classList.add('hidden');
  disputaModal.classList.remove('flex');
}

function clearOtpSessionState() {
  sessionStorage.removeItem('findixiRegistroOtpState');
}

function setSubmitButtonVisibility(isVisible) {
  if (!submitRegistroBtn) return;
  submitRegistroBtn.classList.toggle('hidden', !isVisible);
}

function setOtpAssistanceVisibility(isVisible) {
  otpActionsRow?.classList.toggle('hidden', !isVisible);
  btnOtpNoRecibi?.classList.toggle('hidden', !isVisible);
}

function setOtpFocusedMode(isEnabled) {
  if (!form) return;
  const keepVisible = new Set(['otpVerificationBox', 'formFeedback', 'planSeleccionado']);
  const blocks = Array.from(form.children || []);

  blocks.forEach((block) => {
    if (!(block instanceof HTMLElement)) return;
    if (keepVisible.has(block.id)) return;
    if (isEnabled) {
      if (!block.classList.contains('hidden')) {
        block.dataset.otpCollapsed = 'true';
      }
      block.classList.add('hidden');
    } else if (block.dataset.otpCollapsed === 'true') {
      block.classList.remove('hidden');
      delete block.dataset.otpCollapsed;
    }
  });
}

function getComercioNombreActual() {
  const selected = getSelectedGoogleMatch();
  if (selected?.nombre_google) return selected.nombre_google;
  return getStep1Payload().nombre || 'Comercio';
}

function openPlanNextModal(detail = {}) {
  if (!planNextModal) return;
  const nivel = Number(detail.planNivel ?? selectedNivel ?? 0);
  const plan = obtenerPlanPorNivel(nivel);
  const nombreComercio = detail.nombreComercio || getComercioNombreActual();

  const byPlan = {
    0: 'Vamos a continuar con los datos esenciales para tu perfil Basic.',
    1: 'Vamos a continuar con tu perfil completo para activar tu plan Regular.',
    2: 'Vamos a continuar con tu configuración Plus para menú y especiales.',
    3: 'Vamos a continuar con tu configuración Premium para órdenes y pickup.',
  };

  if (planNextModalTitle) {
    planNextModalTitle.textContent = `${plan.nombre} activado`;
  }
  if (planNextModalText) {
    planNextModalText.textContent = `¡Listo! ${nombreComercio} ya está verificado. ${byPlan[nivel] || byPlan[0]}`;
  }

  planNextModal.classList.remove('hidden');
  planNextModal.classList.add('flex');
}

function closePlanNextModal() {
  if (!planNextModal) return;
  planNextModal.classList.add('hidden');
  planNextModal.classList.remove('flex');
}

function resetBrandingState() {
  brandingState = {
    logoAprobado: false,
    portadaAprobada: false,
    logoOffer: null,
    idComercio: Number(otpState.idComercio || 0) || null,
  };
}

function updateBrandingStatusBadge() {
  if (!brandingSetupStatus) return;
  if (brandingState.logoAprobado && brandingState.portadaAprobada) {
    setInlineFeedback(
      brandingSetupStatus,
      'success',
      'Logo y portada aprobados. Ya puedes continuar al panel de comercio.'
    );
    return;
  }

  const pending = [];
  if (!brandingState.logoAprobado) pending.push('logo');
  if (!brandingState.portadaAprobado) pending.push('portada');
  setInlineFeedback(
    brandingSetupStatus,
    'warning',
    `Aún faltan imágenes por aprobar: ${pending.join(' y ')}.`
  );
}

function hideBrandingLogoUpgradeBox() {
  brandingLogoUpgradeBox?.classList.add('hidden');
  brandingState.logoOffer = null;
}

function showBrandingLogoUpgradeBox(offer, nota = '') {
  if (!brandingLogoUpgradeBox) return;
  brandingState.logoOffer = offer || null;
  const label = offer?.label || 'Incluido en tu plan';
  if (brandingLogoUpgradeText) {
    brandingLogoUpgradeText.textContent = nota
      ? `${nota} Puedes subir otro archivo o usar Logo Upgrade (${label}).`
      : `Puedes subir otro archivo o usar Logo Upgrade (${label}).`;
  }
  brandingLogoUpgradeBox.classList.remove('hidden');
}

function openBrandingSetupModal() {
  if (!brandingSetupModal) return;
  resetBrandingState();
  clearInlineFeedback(brandingLogoFeedback);
  clearInlineFeedback(brandingPortadaFeedback);
  clearInlineFeedback(brandingSetupStatus);
  hideBrandingLogoUpgradeBox();
  if (brandingLogoInput) brandingLogoInput.value = '';
  if (brandingPortadaInput) brandingPortadaInput.value = '';
  brandingSetupModal.classList.remove('hidden');
  brandingSetupModal.classList.add('flex');
}

function closeBrandingSetupModal() {
  if (!brandingSetupModal) return;
  brandingSetupModal.classList.add('hidden');
  brandingSetupModal.classList.remove('flex');
}

async function fetchComercioBrandingSnapshot(comercioId) {
  if (!comercioId) return null;
  let columns = [
    'id',
    'logo',
    'portada',
    'logo_aprobado',
    'portada_aprobada',
    'logo_estado',
    'portada_estado',
  ];

  for (let i = 0; i < 8; i += 1) {
    const { data, error } = await supabase
      .from('Comercios')
      .select(columns.join(', '))
      .eq('id', comercioId)
      .maybeSingle();
    if (!error) return data || null;

    const missingColumn = parseMissingColumn(error);
    if (!missingColumn || !columns.includes(missingColumn)) throw error;
    columns = columns.filter((column) => column !== missingColumn);
    if (!columns.length) return null;
  }
  return null;
}

async function syncBrandingStateFromComercio() {
  const idComercio = Number(brandingState.idComercio || otpState.idComercio || 0);
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    updateBrandingStatusBadge();
    return;
  }

  try {
    const snapshot = await fetchComercioBrandingSnapshot(idComercio);
    brandingState.logoAprobado = Boolean(
      snapshot?.logo_aprobado === true || String(snapshot?.logo_estado || '').toLowerCase() === 'aprobado'
    );
    brandingState.portadaAprobado = Boolean(
      snapshot?.portada_aprobada === true || String(snapshot?.portada_estado || '').toLowerCase() === 'aprobado'
    );

    if (brandingState.logoAprobado) {
      setInlineFeedback(brandingLogoFeedback, 'success', 'Logo aprobado.');
      hideBrandingLogoUpgradeBox();
    }
    if (brandingState.portadaAprobado) {
      setInlineFeedback(brandingPortadaFeedback, 'success', 'Portada aprobada.');
    }
  } catch (error) {
    console.warn('No se pudo sincronizar estado de branding:', error?.message || error);
  }

  updateBrandingStatusBadge();
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function processBrandingImage({ type, mode = 'validate' }) {
  const isLogo = type === 'logo';
  const fileInput = isLogo ? brandingLogoInput : brandingPortadaInput;
  const feedbackEl = isLogo ? brandingLogoFeedback : brandingPortadaFeedback;
  const actionBtn = isLogo
    ? mode === 'upgrade_demo'
      ? brandingLogoUpgradeBtn
      : brandingLogoValidateBtn
    : brandingPortadaValidateBtn;
  const actionLabel = isLogo
    ? mode === 'upgrade_demo'
      ? 'Aplicando...'
      : 'Validando...'
    : 'Validando...';

  clearInlineFeedback(feedbackEl);
  if (!isLogo) hideBrandingLogoUpgradeBox();

  const idComercio = Number(brandingState.idComercio || otpState.idComercio || 0);
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    setInlineFeedback(feedbackEl, 'error', 'No encontramos el comercio para procesar la imagen.');
    return;
  }

  const file = fileInput?.files?.[0] || null;
  if (!file) {
    setInlineFeedback(feedbackEl, 'warning', `Selecciona un archivo de ${type}.`);
    return;
  }

  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(String(file.type || '').toLowerCase())) {
    setInlineFeedback(feedbackEl, 'warning', 'Formato no permitido. Usa PNG, JPG o WEBP.');
    return;
  }

  const prevText = actionBtn?.textContent || '';
  if (actionBtn) {
    actionBtn.disabled = true;
    actionBtn.textContent = actionLabel;
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    const token = await getAccessToken();
    if (!token) throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');

    const response = await fetch('/.netlify/functions/image-validate-process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        idComercio,
        type,
        mode,
        file_base64: dataUrl,
        file_name: file.name || type,
        mime_type: file.type || 'image/png',
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `No se pudo validar ${type}.`);
    }

    if (payload?.aprobado) {
      if (isLogo) {
        brandingState.logoAprobado = true;
        hideBrandingLogoUpgradeBox();
      } else {
        brandingState.portadaAprobado = true;
      }
      setInlineFeedback(
        feedbackEl,
        'success',
        `${payload?.nota || `${type === 'logo' ? 'Logo' : 'Portada'} aprobado`}.${
          payload?.demo_mode ? ' (modo demo)' : ''
        }`
      );
    } else {
      if (isLogo) {
        brandingState.logoAprobado = false;
        showBrandingLogoUpgradeBox(payload?.logo_upgrade_offer, payload?.nota || '');
      } else {
        brandingState.portadaAprobado = false;
      }
      setInlineFeedback(
        feedbackEl,
        'warning',
        payload?.nota || `${type === 'logo' ? 'El logo' : 'La portada'} requiere ajustes.`
      );
    }

    updateBrandingStatusBadge();
  } catch (error) {
    console.error(`Error procesando ${type}:`, error);
    setInlineFeedback(feedbackEl, 'error', error?.message || `No se pudo procesar ${type}.`);
  } finally {
    if (actionBtn) {
      actionBtn.disabled = false;
      actionBtn.textContent = prevText;
    }
  }
}

function showOtpVerifiedSummary(nombreComercio) {
  if (!otpVerifiedSummary) return;
  otpVerifiedSummary.classList.remove('hidden');
  if (otpVerifiedMessage) {
    otpVerifiedMessage.textContent = `¡Listo! ${nombreComercio} verificado correctamente.`;
  }
  if (otpVerifiedHint) {
    const loginHost = getComercioLoginHostLabel();
    otpVerifiedHint.textContent = `Para completar la información del comercio, pulsa Siguiente e inicia sesión en ${loginHost} con el mismo usuario y contraseña de tu cuenta Findixi.`;
  }
}

function getComercioLoginHostLabel() {
  const hostname = String(window.location.hostname || '').toLowerCase();
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    return `${window.location.host}/comercio/login.html`;
  }
  try {
    const configured = new URL(COMERCIO_LOGIN_BASE_URL);
    return configured.host || 'comercio.enpe-erre.com';
  } catch (_error) {
    return 'comercio.enpe-erre.com';
  }
}

function buildComercioLoginUrl(idComercio) {
  const id = Number(idComercio || 0);
  const query = new URLSearchParams({
    id: String(id),
    onboarding: '1',
    nuevo: '1',
  });
  const hostname = String(window.location.hostname || '').toLowerCase();

  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    const returnTo = `/comercio/editarPerfilComercio.html?${query.toString()}`;
    const loginUrl = new URL('/comercio/login.html', window.location.origin);
    loginUrl.searchParams.set('returnTo', returnTo);
    return loginUrl.toString();
  }

  let baseUrl;
  try {
    baseUrl = new URL(COMERCIO_LOGIN_BASE_URL);
  } catch (_error) {
    baseUrl = new URL('https://comercio.enpe-erre.com');
  }
  const loginUrl = new URL('/login.html', baseUrl.origin);
  loginUrl.searchParams.set('returnTo', `./editarPerfilComercio.html?${query.toString()}`);
  return loginUrl.toString();
}

function irAlPanelComercioPostRegistro() {
  const idComercio = Number(otpState.idComercio || 0);
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    showFeedback('error', 'No encontramos el comercio recién validado para continuar.');
    return;
  }

  window.location.href = buildComercioLoginUrl(idComercio);
}

function resetOtpState({ clearSession = true } = {}) {
  if (otpState.timerId) {
    clearInterval(otpState.timerId);
  }
  otpState = {
    idComercio: null,
    challengeId: null,
    cooldownSeconds: 0,
    expiresIn: 0,
    channelUsed: null,
    maskedDestination: null,
    comercioNombre: null,
    timerId: null,
    verified: false,
  };
  if (clearSession) clearOtpSessionState();
  if (btnOtpResend) {
    btnOtpResend.disabled = true;
    btnOtpResend.textContent = 'Reenviar';
  }
}

function persistOtpState() {
  const payload = {
    idComercio: otpState.idComercio,
    challengeId: otpState.challengeId,
    cooldownSeconds: otpState.cooldownSeconds,
    expiresIn: otpState.expiresIn,
    channelUsed: otpState.channelUsed,
    maskedDestination: otpState.maskedDestination,
    comercioNombre: otpState.comercioNombre,
    verified: otpState.verified,
    savedAt: new Date().toISOString(),
  };
  sessionStorage.setItem('findixiRegistroOtpState', JSON.stringify(payload));
}

function restoreOtpStateFromSession() {
  const raw = sessionStorage.getItem('findixiRegistroOtpState');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.idComercio || !parsed.challengeId) return;
    otpState = {
      ...otpState,
      idComercio: Number(parsed.idComercio) || null,
      challengeId: parsed.challengeId || null,
      cooldownSeconds: Number(parsed.cooldownSeconds || 0),
      expiresIn: Number(parsed.expiresIn || 0),
      channelUsed: parsed.channelUsed || null,
      maskedDestination: parsed.maskedDestination || null,
      comercioNombre: parsed.comercioNombre || null,
      verified: Boolean(parsed.verified),
      timerId: null,
    };

    showOtpVerificationBox();
    if (otpIntroText) {
      otpIntroText.textContent = `Código enviado por ${
        otpState.channelUsed === 'voice' ? 'llamada' : 'SMS'
      } al teléfono ${otpState.maskedDestination || 'registrado'}.`;
    }
    if (otpMetaText) {
      otpMetaText.textContent = otpState.verified
        ? `Verificado por ${otpState.channelUsed || 'otp'}.`
        : `Código expira en ${Math.max(1, Math.round((otpState.expiresIn || 600) / 60))} minutos.`;
    }
    if (otpState.verified) {
      if (otpCodeInput) otpCodeInput.disabled = true;
      if (btnOtpVerify) {
        btnOtpVerify.disabled = true;
        btnOtpVerify.textContent = 'Verificado';
      }
      if (btnOtpResend) btnOtpResend.disabled = true;
      if (btnOtpVoice) btnOtpVoice.disabled = true;
      setOtpAssistanceVisibility(false);
      showOtpVerifiedSummary(otpState.comercioNombre || getComercioNombreActual());
      setOtpFeedback('success', 'OTP ya verificado en esta sesión.');
    } else if (otpState.cooldownSeconds > 0) {
      startOtpCooldown(otpState.cooldownSeconds);
    } else if (btnOtpResend) {
      btnOtpResend.disabled = false;
    }
  } catch (_error) {
    clearOtpSessionState();
  }
}

function hideOtpVerificationBox({ clearSession = true } = {}) {
  resetOtpState({ clearSession });
  setOtpFocusedMode(false);
  if (otpVerificationBox) otpVerificationBox.classList.add('hidden');
  if (otpCodeInput) {
    otpCodeInput.value = '';
    otpCodeInput.disabled = false;
  }
  if (btnOtpVerify) {
    btnOtpVerify.disabled = false;
    btnOtpVerify.textContent = 'Verificar';
  }
  if (btnOtpVoice) btnOtpVoice.disabled = false;
  setOtpAssistanceVisibility(true);
  otpVerifiedSummary?.classList.add('hidden');
  if (otpMetaText) otpMetaText.textContent = 'Código expira en 10 minutos.';
  if (otpIntroText) otpIntroText.textContent = 'Enviamos un código al teléfono verificado de este negocio.';
  clearOtpFeedback();
}

function showOtpVerificationBox() {
  if (!otpVerificationBox) return;
  otpVerificationBox.classList.remove('hidden');
  otpVerificationBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function startOtpCooldown(seconds) {
  if (!btnOtpResend) return;
  otpState.cooldownSeconds = Math.max(0, Number(seconds || 0));
  if (otpState.timerId) clearInterval(otpState.timerId);

  const update = () => {
    if (!btnOtpResend) return;
    if (otpState.cooldownSeconds <= 0) {
      btnOtpResend.disabled = false;
      btnOtpResend.textContent = 'Reenviar';
      if (otpState.timerId) {
        clearInterval(otpState.timerId);
        otpState.timerId = null;
      }
      persistOtpState();
      return;
    }
    btnOtpResend.disabled = true;
    btnOtpResend.textContent = `Reenviar (${otpState.cooldownSeconds}s)`;
    otpState.cooldownSeconds -= 1;
    persistOtpState();
  };

  update();
  otpState.timerId = setInterval(update, 1000);
}

function applyOtpSendResult(data) {
  otpState.challengeId = data.challenge_id || null;
  otpState.expiresIn = Number(data.expires_in || 0);
  otpState.channelUsed = data.channel_used || null;
  otpState.maskedDestination = data.destination_masked || null;
  otpState.verified = false;
  otpState.comercioNombre = otpState.comercioNombre || getComercioNombreActual();
  if (otpCodeInput) otpCodeInput.value = '';
  otpVerifiedSummary?.classList.add('hidden');
  setOtpAssistanceVisibility(true);
  setOtpFocusedMode(true);
  setSubmitButtonVisibility(false);

  const channelText = otpState.channelUsed === 'voice' ? 'llamada de voz' : 'SMS';
  if (otpIntroText) {
    otpIntroText.textContent = `Enviamos un código por ${channelText} al teléfono ${otpState.maskedDestination || 'registrado'}.`;
  }
  if (otpMetaText) {
    otpMetaText.textContent = `Código expira en ${Math.max(1, Math.round((otpState.expiresIn || 600) / 60))} minutos.`;
  }
  startOtpCooldown(Number(data.cooldown_seconds || 0));
  persistOtpState();
  showOtpVerificationBox();
}

function formatPhone(value) {
  const text = String(value || '').trim();
  return text || 'No disponible';
}

function hideNoEsMiComercioFlow() {
  noEsMiComercioBox?.classList.add('hidden');
  nuevoComercioFlowBox?.classList.add('hidden');
  if (inputNuevoComercioPhone) {
    inputNuevoComercioPhone.value = '';
  }
}

function hideProtectionModeBox() {
  modoProteccionBox?.classList.add('hidden');
}

function showNoEsMiComercioFlow() {
  const selected = getSelectedGoogleMatch() || getTopMatch();
  const movedMeters = getCurrentPinMovementFromSearchCenterMeters();
  const strength = selected?.match_strength || 'debil';
  const othersCount = Math.max(0, (googleMatchState.matches || []).length - 1);

  let hint = 'Puedes ver otros resultados o ajustar el pin para mejorar la coincidencia.';
  if (strength === 'fuerte' && movedMeters <= PIN_MOVE_ALLOW_NEW_M) {
    hint =
      'Encontramos una coincidencia fuerte. Si no es tu comercio, te pediremos una verificación adicional.';
  } else if (strength === 'medio') {
    hint = 'La coincidencia es intermedia. Recomendamos ajustar el pin y volver a buscar.';
  }

  if (noEsMiComercioHint) {
    noEsMiComercioHint.textContent = hint;
  }
  if (btnNoFlowVerOtros) {
    btnNoFlowVerOtros.disabled = othersCount === 0;
    btnNoFlowVerOtros.classList.toggle('opacity-60', othersCount === 0);
    btnNoFlowVerOtros.classList.toggle('cursor-not-allowed', othersCount === 0);
  }
  noEsMiComercioBox?.classList.remove('hidden');
  hideProtectionModeBox();
}

function showProtectionModeBox() {
  hideNoEsMiComercioFlow();
  modoProteccionBox?.classList.remove('hidden');
  scrollToGoogleMatchConfirmation();
}

function hideGoogleMatchConfirmation() {
  googleMatchState = { matches: [], selectedPlaceId: null, searchCenter: null };
  lastGoogleSearchResult = null;
  disputaContext = null;
  if (googleMatchConfirmBox) googleMatchConfirmBox.classList.add('hidden');
  if (googleMatchCard) googleMatchCard.innerHTML = '';
  if (googleOtherMatches) {
    googleOtherMatches.classList.add('hidden');
    googleOtherMatches.innerHTML = '';
  }
  if (btnVerOtrosMatches) {
    btnVerOtrosMatches.classList.add('hidden');
    btnVerOtrosMatches.textContent = 'Ver otros resultados';
  }
  btnMatchConfirmYes?.classList.remove('hidden');
  btnMatchConfirmNo?.classList.remove('hidden');
  if (btnMatchConfirmNo) btnMatchConfirmNo.textContent = 'No es mi comercio';
  hideNoEsMiComercioFlow();
  hideProtectionModeBox();
  hideDisputaActivoBox();
  hideOtpVerificationBox();
  closeComercioActivoModal();
}

function scrollToGoogleMatchConfirmation() {
  if (!googleMatchConfirmBox) return;
  window.setTimeout(() => {
    googleMatchConfirmBox.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }, 80);
}

function getSelectedGoogleMatch() {
  const { matches, selectedPlaceId } = googleMatchState;
  if (!Array.isArray(matches) || !matches.length) return null;
  return matches.find((item) => item.place_id === selectedPlaceId) || matches[0] || null;
}

function renderSelectedGoogleMatchCard() {
  if (!googleMatchCard) return;
  const selected = getSelectedGoogleMatch();
  if (!selected) {
    googleMatchCard.innerHTML = '<p class="text-sm text-gray-500">Sin resultados para mostrar.</p>';
    return;
  }

  const photoHtml = selected.photo_url
    ? `<img src="${selected.photo_url}" alt="${selected.nombre_google || 'Comercio'}" class="w-full h-28 object-cover rounded-lg border border-gray-100">`
    : '<div class="w-full h-28 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-400 text-xs">Sin foto disponible</div>';

  googleMatchCard.innerHTML = `
    ${photoHtml}
    <div class="mt-2 space-y-1">
      <p class="text-sm font-semibold text-gray-900">${selected.nombre_google || 'Comercio'}</p>
      <p class="text-xs text-gray-600">${selected.direccion_google || 'Dirección no disponible'}</p>
      <p class="text-xs text-gray-600"><i class="fa-solid fa-phone mr-1"></i>${formatPhone(selected.telefono_google)}</p>
      ${
        Number.isFinite(selected.distance_m)
          ? `<p class="text-[11px] text-sky-700">A ${selected.distance_m}m del pin</p>`
          : ''
      }
      ${
        selected?.match_strength
          ? `<p class="text-[11px] ${
              selected.match_strength === 'fuerte'
                ? 'text-emerald-700'
                : selected.match_strength === 'medio'
                  ? 'text-amber-700'
                  : 'text-gray-600'
            }">Coincidencia ${selected.match_strength}</p>`
          : ''
      }
    </div>
  `;
}

function renderOtherGoogleMatches() {
  if (!googleOtherMatches || !btnVerOtrosMatches) return;
  const selected = getSelectedGoogleMatch();
  const others = (googleMatchState.matches || []).filter((item) => item.place_id !== selected?.place_id);

  if (!others.length) {
    btnVerOtrosMatches.classList.add('hidden');
    btnVerOtrosMatches.textContent = 'Ver otros resultados';
    googleOtherMatches.classList.add('hidden');
    googleOtherMatches.innerHTML = '';
    return;
  }

  btnVerOtrosMatches.classList.remove('hidden');
  btnVerOtrosMatches.textContent = 'Ver otros resultados';
  googleOtherMatches.classList.add('hidden');
  googleOtherMatches.innerHTML = others
    .map(
      (item) => `
        <article class="rounded-xl border border-gray-200 bg-white p-2">
          <p class="text-sm font-semibold text-gray-900">${item.nombre_google || 'Comercio'}</p>
          <p class="text-xs text-gray-600 mt-1">${item.direccion_google || 'Dirección no disponible'}</p>
          <button type="button" data-select-place-id="${item.place_id}" class="mt-2 w-full rounded-lg border border-sky-200 bg-sky-50 text-sky-700 py-1.5 text-xs font-semibold">
            Seleccionar este resultado
          </button>
        </article>
      `
    )
    .join('');
}

function renderGoogleMatchConfirmation(matches = []) {
  if (!googleMatchConfirmBox) return;
  if (!Array.isArray(matches) || !matches.length) {
    hideGoogleMatchConfirmation();
    return;
  }

  googleMatchState = {
    matches,
    selectedPlaceId: matches[0]?.place_id || null,
    searchCenter: lastGoogleSearchResult?.center || null,
  };
  googleMatchConfirmBox.classList.remove('hidden');
  btnMatchConfirmYes?.classList.remove('hidden');
  btnMatchConfirmNo?.classList.remove('hidden');
  if (btnMatchConfirmNo) btnMatchConfirmNo.textContent = 'No es mi comercio';
  hideNoEsMiComercioFlow();
  hideProtectionModeBox();
  hideDisputaActivoBox();
  renderSelectedGoogleMatchCard();
  renderOtherGoogleMatches();
  scrollToGoogleMatchConfirmation();
}

function selectGoogleMatch(placeId) {
  if (!placeId) return;
  googleMatchState.selectedPlaceId = placeId;
  hideProtectionModeBox();
  renderSelectedGoogleMatchCard();
  renderOtherGoogleMatches();
}

function persistGoogleMatchSelection({ confirmed }) {
  const selected = getSelectedGoogleMatch();
  const basePayload = getStep1Payload();
  const payload = {
    ...basePayload,
    google_match: selected || null,
    google_match_confirmed: Boolean(confirmed),
    google_match_decision_at: new Date().toISOString(),
  };

  window.findixiRegistroPaso1 = payload;
  sessionStorage.setItem('findixiRegistroPaso1', JSON.stringify(payload));
  return payload;
}

async function buscarComercioPorGooglePlaceId(placeId) {
  if (!placeId) return null;
  let columns = [
    'id',
    'nombre',
    'activo',
    'owner_user_id',
    'estado_propiedad',
    'estado_verificacion',
    'google_place_id',
  ];

  for (let i = 0; i < 6; i += 1) {
    const selectClause = columns.join(', ');
    const { data, error } = await supabase
      .from('Comercios')
      .select(selectClause)
      .eq('google_place_id', placeId)
      .limit(1)
      .maybeSingle();

    if (!error) return data || null;

    const missingColumn = parseMissingColumn(error);
    if (!missingColumn) throw error;

    if (missingColumn === 'google_place_id') {
      return null;
    }
    columns = columns.filter((col) => col !== missingColumn);
    if (!columns.length) return null;
  }

  return null;
}

async function listarComerciosSimilares(stepPayload, selectedMatch = null, options = {}) {
  if (!stepPayload?.municipio) return null;
  const onlyActive = Boolean(options?.onlyActive);

  let query = supabase
    .from('Comercios')
    .select('id, nombre, nombre_normalizado, telefono, telefono_publico, whatsapp, municipio, latitud, longitud, activo, owner_user_id')
    .eq('municipio', stepPayload.municipio)
    .limit(220);
  if (onlyActive) query = query.eq('activo', true);

  const { data, error } = await query;
  if (error) throw error;

  const inputName = stepPayload.nombre || '';
  const googleName = selectedMatch?.nombre_google || '';
  const refPhone = selectedMatch?.telefono_google || selectedMatch?.telefono || '';
  const normalizedInputName = normalizeText(inputName || '');
  const normalizedGoogleName = normalizeText(googleName || '');
  const hasGoogleCoords =
    Number.isFinite(Number(selectedMatch?.latitud_google)) &&
    Number.isFinite(Number(selectedMatch?.longitud_google));

  const candidatos = (data || [])
    .map((item) => {
      const distancia = distanceMeters(stepPayload.latitud, stepPayload.longitud, item.latitud, item.longitud);
      const distanciaGoogle = hasGoogleCoords
        ? distanceMeters(selectedMatch?.latitud_google, selectedMatch?.longitud_google, item.latitud, item.longitud)
        : null;
      const nameScoreInput = computeNameSimilarityScore(inputName, item.nombre || '');
      const nameScoreGoogle = googleName
        ? computeNameSimilarityScore(googleName, item.nombre || '')
        : 0;
      const nameScore = Math.max(nameScoreInput, nameScoreGoogle);
      const normalizedItemName = normalizeText(item.nombre_normalizado || item.nombre || '');
      const phoneMatch =
        phonesLikelyMatch(refPhone, item.telefono) ||
        phonesLikelyMatch(refPhone, item.telefono_publico) ||
        phonesLikelyMatch(refPhone, item.whatsapp) ||
        phonesLikelyMatch(stepPayload?.telefono, item.telefono);
      const exactNameMatch =
        (normalizedInputName && normalizedItemName === normalizedInputName) ||
        (normalizedGoogleName && normalizedItemName === normalizedGoogleName);

      const strongByNameDistance = Number.isFinite(distancia) && distancia <= 220 && nameScore >= 65;
      const strongByPhoneDistance = Number.isFinite(distancia) && distancia <= 450 && phoneMatch;
      const strongByGoogleCoords =
        Number.isFinite(distanciaGoogle) &&
        distanciaGoogle <= 220 &&
        (phoneMatch || nameScore >= 60);
      const strongByExactSignals = phoneMatch && exactNameMatch;
      const isLikelySame =
        strongByNameDistance ||
        strongByPhoneDistance ||
        strongByGoogleCoords ||
        strongByExactSignals;

      return {
        ...item,
        distancia_m: Number.isFinite(distancia) ? Math.round(distancia) : null,
        distancia_google_m: Number.isFinite(distanciaGoogle) ? Math.round(distanciaGoogle) : null,
        name_score: nameScore,
        phone_match: phoneMatch,
        exact_name_match: exactNameMatch,
        is_likely_same: isLikelySame,
      };
    })
    .filter((item) => item.is_likely_same)
    .sort((a, b) => {
      if (Number(b.phone_match) !== Number(a.phone_match)) {
        return Number(b.phone_match) - Number(a.phone_match);
      }
      if ((a.distancia_m ?? Infinity) !== (b.distancia_m ?? Infinity)) {
        return (a.distancia_m ?? Infinity) - (b.distancia_m ?? Infinity);
      }
      return (b.name_score ?? 0) - (a.name_score ?? 0);
    });

  return candidatos;
}

async function buscarComercioActivoSimilar(stepPayload, selectedMatch = null) {
  const candidatos = await listarComerciosSimilares(stepPayload, selectedMatch, { onlyActive: true });
  return candidatos?.[0] || null;
}

function buildGoogleReferencePayload(stepPayload, selectedMatch, options = {}) {
  const protectionMode = Boolean(options.protectionMode);
  const manualReview = Boolean(options.manualReview);

  return {
    nombre: selectedMatch?.nombre_google || stepPayload.nombre || null,
    nombre_normalizado: normalizeText(selectedMatch?.nombre_google || stepPayload.nombre || ''),
    idMunicipio: stepPayload.idMunicipio || null,
    municipio: stepPayload.municipio || null,
    latitud: stepPayload.latitud ?? null,
    longitud: stepPayload.longitud ?? null,
    telefono: selectedMatch?.telefono_google || null,
    telefono_publico: options.telefonoPublico || selectedMatch?.telefono_google || null,
    owner_user_id: stepPayload.user_id || null,
    plan_nivel: stepPayload.plan_nivel ?? null,
    plan_nombre: stepPayload.plan_nombre ?? null,
    google_place_id: selectedMatch?.place_id || null,
    telefono_referencia_google: selectedMatch?.telefono_google || null,
    direccion_google: selectedMatch?.direccion_google || null,
    latitud_google: selectedMatch?.latitud_google ?? null,
    longitud_google: selectedMatch?.longitud_google ?? null,
    google_match_score: selectedMatch?.match_score ?? null,
    google_matched_at: new Date().toISOString(),
    estado_propiedad: 'reclamacion_pendiente',
    estado_verificacion: manualReview ? 'manual_pendiente' : 'otp_pendiente',
    propietario_verificado: false,
    metodo_verificacion: manualReview ? 'manual' : null,
    telefono_verificado: false,
    bloqueo_datos_criticos: true,
    bandera_posible_duplicado: protectionMode,
    google_place_id_posible_match: protectionMode ? selectedMatch?.place_id || null : null,
    posible_match_strength: protectionMode ? selectedMatch?.match_strength || null : null,
    posible_match_distancia_m: protectionMode ? selectedMatch?.distance_m ?? null : null,
    posible_match_metadata: protectionMode
      ? {
          selected_place_id: selectedMatch?.place_id || null,
          match_score: selectedMatch?.match_score ?? null,
          name_score: selectedMatch?.name_score ?? null,
          distance_m: selectedMatch?.distance_m ?? null,
          municipio_match: selectedMatch?.municipio_match ?? null,
        }
      : {},
    activo: false,
    permite_perfil: false,
    aparece_en_cercanos: false,
    permite_menu: false,
    permite_especiales: false,
    permite_ordenes: false,
  };
}

async function guardarReferenciaGoogleConfirmada(options = {}) {
  const selected = getSelectedGoogleMatch();
  const stepPayload = getStep1Payload();

  if (!selected || !selected.place_id) {
    throw new Error('No hay un match de Google seleccionado.');
  }
  if (!stepPayload.user_id) {
    throw new Error('Necesitas sesión activa para continuar.');
  }

  const payload = buildGoogleReferencePayload(stepPayload, selected, options);
  const existente = await buscarComercioPorGooglePlaceId(selected.place_id);
  const similares = await listarComerciosSimilares(stepPayload, selected, { onlyActive: false });
  const similarActivo = (similares || []).find((item) => item.activo === true) || null;
  const similarInactivo = (similares || []).find((item) => item.activo !== true) || null;

  if (existente?.id) {
    if (existente.activo === true) {
      return {
        mode: 'activo_no_reclamable',
        id: existente.id,
        nombre: existente.nombre || selected?.nombre_google || stepPayload.nombre || null,
        place_id: selected.place_id,
      };
    }

    if (similarActivo?.id && Number(similarActivo.id) !== Number(existente.id)) {
      return {
        mode: 'activo_no_reclamable',
        id: similarActivo.id,
        nombre: similarActivo.nombre || selected?.nombre_google || stepPayload.nombre || null,
        place_id: selected.place_id,
        match_evidence: {
          distance_m: similarActivo.distancia_m,
          phone_match: similarActivo.phone_match,
          name_score: similarActivo.name_score,
        },
      };
    }

    if (similarInactivo?.id && Number(similarInactivo.id) !== Number(existente.id)) {
      if (similarInactivo.owner_user_id && similarInactivo.owner_user_id !== stepPayload.user_id) {
        const { error } = await updateComercioWithFallback(similarInactivo.id, {
          estado_propiedad: 'en_disputa',
          estado_verificacion: 'manual_pendiente',
          bloqueo_datos_criticos: true,
        });
        if (error) throw error;
        return { mode: 'disputa', id: similarInactivo.id };
      }

      const { error, usedPayload } = await updateComercioWithFallback(similarInactivo.id, payload);
      if (error) throw error;
      return {
        mode: 'updated',
        id: similarInactivo.id,
        payload: usedPayload,
        duplicate_reused: true,
      };
    }

    if (existente.owner_user_id && existente.owner_user_id !== stepPayload.user_id) {
      const { error } = await updateComercioWithFallback(existente.id, {
        estado_propiedad: 'en_disputa',
        estado_verificacion: 'manual_pendiente',
        bloqueo_datos_criticos: true,
      });
      if (error) throw error;
      return { mode: 'disputa', id: existente.id };
    }

    const { error, usedPayload } = await updateComercioWithFallback(existente.id, payload);
    if (error) throw error;
    return { mode: 'updated', id: existente.id, payload: usedPayload };
  }

  if (similarActivo?.id) {
    return {
      mode: 'activo_no_reclamable',
      id: similarActivo.id,
      nombre: similarActivo.nombre || stepPayload.nombre || null,
      place_id: selected.place_id || null,
      match_evidence: {
        distance_m: similarActivo.distancia_m,
        phone_match: similarActivo.phone_match,
        name_score: similarActivo.name_score,
      },
    };
  }

  if (similarInactivo?.id) {
    if (similarInactivo.owner_user_id && similarInactivo.owner_user_id !== stepPayload.user_id) {
      const { error } = await updateComercioWithFallback(similarInactivo.id, {
        estado_propiedad: 'en_disputa',
        estado_verificacion: 'manual_pendiente',
        bloqueo_datos_criticos: true,
      });
      if (error) throw error;
      return { mode: 'disputa', id: similarInactivo.id };
    }

    const { error, usedPayload } = await updateComercioWithFallback(similarInactivo.id, payload);
    if (error) throw error;
    return {
      mode: 'updated',
      id: similarInactivo.id,
      payload: usedPayload,
      duplicate_reused: true,
    };
  }

  const { data, error, usedPayload } = await insertComercioWithFallback(payload);
  if (error) throw error;
  return { mode: 'inserted', id: data?.id || null, payload: usedPayload };
}

async function buscarPosibleDuplicadoPorNombreYCercania(stepPayload) {
  const nombreNormalizado = normalizeText(stepPayload.nombre || '');
  if (!nombreNormalizado || !stepPayload.municipio) return null;

  const { data, error } = await supabase
    .from('Comercios')
    .select('id, nombre, municipio, latitud, longitud, owner_user_id, estado_propiedad')
    .eq('municipio', stepPayload.municipio)
    .limit(80);
  if (error) throw error;

  const candidatos = (data || []).filter((item) => normalizeText(item.nombre) === nombreNormalizado);
  if (!candidatos.length) return null;

  return (
    candidatos.find((item) => {
      const d = distanceMeters(stepPayload.latitud, stepPayload.longitud, item.latitud, item.longitud);
      return Number.isFinite(d) && d <= DUPLICATE_DISTANCE_M;
    }) || null
  );
}

async function crearComercioNuevoPendienteOtp({ telefonoOtp }) {
  const stepPayload = getStep1Payload();
  if (!stepPayload.user_id) throw new Error('Necesitas sesión activa para continuar.');

  const selected = getSelectedGoogleMatch();
  if (selected?.place_id) {
    const existenteGoogle = await buscarComercioPorGooglePlaceId(selected.place_id);
    if (existenteGoogle?.id) {
      throw new Error('Encontramos este comercio en Findixi. Debes reclamarlo en lugar de crear uno nuevo.');
    }
  }

  const posibleDuplicado = await buscarPosibleDuplicadoPorNombreYCercania(stepPayload);
  if (posibleDuplicado?.id) {
    throw new Error(
      `Ya existe un comercio muy similar cerca (${posibleDuplicado.nombre}). Te recomendamos reclamar ese comercio.`
    );
  }

  const telefonoNormalizado = String(telefonoOtp || '').trim();
  if (!telefonoNormalizado) {
    throw new Error('Ingresa un teléfono para continuar con la verificación.');
  }

  const payload = {
    nombre: stepPayload.nombre,
    nombre_normalizado: normalizeText(stepPayload.nombre),
    idMunicipio: stepPayload.idMunicipio || null,
    municipio: stepPayload.municipio || null,
    latitud: stepPayload.latitud ?? null,
    longitud: stepPayload.longitud ?? null,
    telefono: telefonoNormalizado,
    telefono_publico: telefonoNormalizado,
    owner_user_id: stepPayload.user_id,
    plan_nivel: stepPayload.plan_nivel ?? null,
    plan_nombre: stepPayload.plan_nombre ?? null,
    estado_propiedad: 'reclamacion_pendiente',
    estado_verificacion: 'otp_pendiente',
    propietario_verificado: false,
    metodo_verificacion: null,
    telefono_verificado: false,
    telefono_publico_verificado: false,
    bloqueo_datos_criticos: true,
    bandera_posible_duplicado: false,
    activo: false,
    permite_perfil: false,
    aparece_en_cercanos: false,
    permite_menu: false,
    permite_especiales: false,
    permite_ordenes: false,
  };

  const similares = await listarComerciosSimilares(stepPayload, {
    nombre_google: stepPayload.nombre,
    telefono_google: telefonoNormalizado,
  }, { onlyActive: false });
  const similarActivo = (similares || []).find((item) => item.activo === true) || null;
  const similarInactivo = (similares || []).find((item) => item.activo !== true) || null;
  if (similarActivo?.id) {
    const distanciaLabel = Number.isFinite(similarActivo.distancia_m) ? ` a ${similarActivo.distancia_m}m` : '';
    const error = new Error(
      `Encontramos un comercio activo muy similar (${similarActivo.nombre}${distanciaLabel}). No podemos crear uno nuevo; abre una disputa en Findixi.`
    );
    error.similarActivo = similarActivo;
    throw error;
  }

  if (similarInactivo?.id) {
    if (similarInactivo.owner_user_id && similarInactivo.owner_user_id !== stepPayload.user_id) {
      const error = new Error(
        `Encontramos un comercio similar ya registrado (${similarInactivo.nombre}). Debes abrir una disputa para revisión.`
      );
      error.similarInactivo = similarInactivo;
      throw error;
    }

    const { error, usedPayload } = await updateComercioWithFallback(similarInactivo.id, payload);
    if (error) throw error;
    return { id: similarInactivo.id, payload: usedPayload, duplicate_reused: true };
  }

  const { data, error, usedPayload } = await insertComercioWithFallback(payload);
  if (error) throw error;
  return { id: data?.id || null, payload: usedPayload };
}

function canContinueAsNewBusinessWithoutProtection() {
  const selected = getSelectedGoogleMatch() || getTopMatch();
  if (!selected) return true;
  if (selected.match_strength !== 'fuerte') return true;
  const movedMeters = getCurrentPinMovementFromSearchCenterMeters();
  return movedMeters > PIN_MOVE_ALLOW_NEW_M;
}

async function iniciarOtpParaComercio({
  idComercio,
  comercioNombre,
  channelPreference = 'auto',
  destinationPhone = null,
}) {
  const commerceId = Number(idComercio || 0);
  if (!Number.isFinite(commerceId) || commerceId <= 0) {
    throw new Error('No se recibió el ID del comercio para iniciar OTP.');
  }

  otpState.idComercio = commerceId;
  otpState.comercioNombre = comercioNombre || getComercioNombreActual();
  hideNoEsMiComercioFlow();
  hideProtectionModeBox();
  const otpResponse = await sendOtp({
    channelPreference,
    resend: false,
    destinationPhone,
  });
  applyOtpSendResult(otpResponse);
  googleMatchConfirmBox?.classList.add('hidden');
  setOtpFeedback('info', `Código enviado por ${otpResponse.channel_used === 'voice' ? 'llamada' : 'SMS'}.`);
}

function getMunicipioLabel() {
  return selectMunicipio?.selectedOptions?.[0]?.textContent?.trim() || '';
}

function getStep1Payload() {
  const nombre = (inputNombreComercio?.value || '').trim();
  const latitud = toFiniteNumber(inputLatitud?.value);
  const longitud = toFiniteNumber(inputLongitud?.value);
  const idMunicipio = toFiniteNumber(selectMunicipio?.value);
  const municipio = getMunicipioLabel();

  return {
    nombre,
    idMunicipio,
    municipio,
    latitud,
    longitud,
    plan_nivel: selectedNivel,
    plan_nombre: selectedNivel !== null ? obtenerPlanPorNivel(selectedNivel).nombre : null,
    user_id: authState.user?.id || null,
  };
}

function isStep1Valid() {
  const payload = getStep1Payload();
  return Boolean(payload.nombre) && Boolean(payload.idMunicipio) && isValidCoordinatePair(payload.latitud, payload.longitud);
}

function updateStepButtonState() {
  if (!submitRegistroBtn) return;
  submitRegistroBtn.disabled = !isStep1Valid();
}

function buildFeaturesList(features) {
  const list = Array.isArray(features) ? features : [];
  if (!list.length) return '<p class="text-xs text-gray-400">Sin beneficios definidos.</p>';
  return `
    <ul class="mt-3 space-y-1 text-sm text-gray-700 text-left inline-block">
      ${list.map((f) => `<li class="flex items-start gap-2"><span class="text-emerald-500 mt-[3px]">●</span>${f}</li>`).join('')}
    </ul>
  `;
}

const PLAN_COPY = {
  basic: {
    badge: 'Arranca hoy',
    tagline: 'Presencia esencial para comenzar',
    desc: 'Ideal para que te encuentren y te contacten rápidamente.',
    tone: 'gray',
  },
  regular: {
    badge: 'Más elegido',
    tagline: 'Tu perfil completo con galería y redes',
    desc: 'Aumenta visibilidad y confianza desde el primer día.',
    tone: 'sky',
  },
  plus: {
    badge: 'Impulsa ventas',
    tagline: 'Menú completo y especiales destacados',
    desc: 'Perfecto para restaurantes que quieren destacar su oferta.',
    tone: 'amber',
  },
  premium: {
    badge: 'Máxima exposición',
    tagline: 'Órdenes online y presencia total',
    desc: 'Para negocios listos para vender y recibir pedidos.',
    tone: 'emerald',
  },
};

const TONE_CLASSES = {
  gray: {
    card: 'border-gray-300 bg-white',
    badge: 'bg-gray-200 text-gray-700',
    price: 'text-gray-900',
  },
  sky: {
    card: 'border-sky-300 bg-sky-50',
    badge: 'bg-sky-200 text-sky-800',
    price: 'text-sky-700',
  },
  amber: {
    card: 'border-amber-300 bg-amber-50',
    badge: 'bg-amber-200 text-amber-800',
    price: 'text-amber-700',
  },
  emerald: {
    card: 'border-emerald-300 bg-emerald-50',
    badge: 'bg-emerald-200 text-emerald-800',
    price: 'text-emerald-700',
  },
};

function createPlanCard(plan, selectedPlanNivel) {
  const nivel = Number(plan.nivel ?? plan.plan_nivel ?? 0);
  const base = obtenerPlanPorNivel(nivel);
  const nombre = plan.nombre || base.nombre;
  const isGratis = Number(plan.precio ?? base.precio) <= 0;
  const precio = formatoPrecio(plan.precio ?? base.precio);
  const features = Array.isArray(plan.features) ? plan.features : base.features;
  const isSelected = Number(selectedPlanNivel) === Number(nivel);
  const slug = plan.slug || base.slug || '';
  const copy = PLAN_COPY[slug] || PLAN_COPY.basic;
  const tone = TONE_CLASSES[copy.tone] || TONE_CLASSES.gray;

  const card = document.createElement('button');
  card.type = 'button';
  card.className = `text-center border rounded-3xl p-5 transition shadow-md ${tone.card} ${
    isSelected ? 'ring-2 ring-gray-900/15' : 'hover:border-gray-400'
  }`;
  card.innerHTML = `
    <div class="flex flex-col items-center gap-2">
      <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${tone.badge}">
        ${copy.badge}
      </span>
      <h3 class="text-xl font-semibold text-gray-900">${nombre}</h3>
      <p class="text-base text-gray-700">${copy.tagline}</p>
      <p class="text-3xl font-semibold ${tone.price}">${precio}</p>
      ${isGratis ? '' : '<p class="text-[11px] uppercase tracking-[0.2em] text-gray-400">Plan mensual</p>'}
    </div>
    ${buildFeaturesList(features)}
    <p class="text-sm text-gray-700 mt-3 text-center">${copy.desc}</p>
  `;

  card.addEventListener('click', () => {
    selectPlan(plan);
  });

  return card;
}

function renderPlanes(selectedPlanNivel = null) {
  if (!planesGrid) return;
  planesGrid.innerHTML = '';
  PLANES_PRELIMINARES.forEach((plan) => {
    planesGrid.appendChild(createPlanCard(plan, selectedPlanNivel));
  });
}

function openFormModal() {
  if (!formModal) return;
  formModal.classList.remove('hidden');
  formModal.classList.add('flex');
}

function closeFormModal() {
  if (!formModal) return;
  formModal.classList.add('hidden');
  formModal.classList.remove('flex');
  closeDisputaModal();
  closeBrandingSetupModal();
  mapPickerPanel?.classList.add('hidden');
  hideGoogleMatchConfirmation();
  setSubmitButtonVisibility(true);
}

function selectPlan(plan) {
  if (!plan) return;

  if (!authState.loggedIn) {
    loginModal?.classList.remove('hidden');
    loginModal?.classList.add('flex');
    return;
  }

  const nivel = Number(plan.nivel ?? plan.plan_nivel ?? 0);
  const base = obtenerPlanPorNivel(nivel);
  const nombre = plan.nombre || base.nombre;
  const precio = formatoPrecio(plan.precio ?? base.precio);

  selectedNivel = nivel;
  if (planInput) planInput.value = String(nivel);
  if (planLabel) {
    planLabel.textContent = nombre;
    planLabel.classList.remove('hidden');
  }
  if (planSeleccionadoLabel) {
    planSeleccionadoLabel.textContent = `${nombre} · ${precio}`;
  }

  hideFeedback();
  hideGoogleMatchConfirmation();
  closePlanNextModal();
  openFormModal();
  renderPlanes(nivel);
  updateStepButtonState();
}

async function cargarUsuario() {
  try {
    const {
      data: { session } = {},
    } = await supabase.auth.getSession();
    authState.user = session?.user || null;
    authState.loggedIn = Boolean(session?.user);
  } catch (error) {
    console.warn('No se pudo cargar la sesión:', error?.message || error);
    authState.user = null;
    authState.loggedIn = false;
  }
}

async function cargarMunicipios() {
  if (municipiosLoaded || !selectMunicipio) return;

  try {
    const { data, error } = await supabase
      .from('Municipios')
      .select('id, nombre')
      .order('nombre', { ascending: true });
    if (error) throw error;

    selectMunicipio.innerHTML = '<option value="">Selecciona un municipio</option>';
    (data || []).forEach((municipio) => {
      const option = document.createElement('option');
      option.value = String(municipio.id);
      option.textContent = municipio.nombre || '';
      selectMunicipio.appendChild(option);
    });
    municipiosLoaded = true;
  } catch (error) {
    console.warn('No se pudieron cargar municipios:', error?.message || error);
    showFeedback('error', 'No se pudieron cargar los municipios. Intenta recargar.');
  }
}

function getGoogleMapsKeyFromWindow() {
  const browserEnv = typeof window !== 'undefined' ? window.__ENV__ || window.ENV || {} : {};
  const fromWindow =
    browserEnv.GOOGLE_MAPS_BROWSER_KEY ||
    browserEnv.GOOGLE_MAPS_API_KEY ||
    browserEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    browserEnv.VITE_GOOGLE_MAPS_API_KEY;
  return typeof fromWindow === 'string' ? fromWindow.trim() : '';
}

function isLocalHostRuntime() {
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function isLikelyNetlifyDevRuntime() {
  const port = String(window.location.port || '');
  return port === '8888' || port === '8889';
}

async function tryLoadLocalMapsConfig() {
  const keyFromStorage = String(localStorage.getItem('GOOGLE_MAPS_BROWSER_KEY') || '').trim();
  if (keyFromStorage) {
    window.__ENV__ = window.__ENV__ || {};
    window.__ENV__.GOOGLE_MAPS_BROWSER_KEY = keyFromStorage;
    return keyFromStorage;
  }

  try {
    await import('../shared/localMapsConfig.js');
  } catch (error) {
    return '';
  }

  return getGoogleMapsKeyFromWindow();
}

async function fetchMapsKeyFromEndpoint(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    return '';
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    return typeof payload?.googleMapsKey === 'string' ? payload.googleMapsKey.trim() : '';
  }

  const raw = await response.text();
  const maybeJson = String(raw || '').trim();
  if (maybeJson.startsWith('{') && maybeJson.endsWith('}')) {
    try {
      const payload = JSON.parse(maybeJson);
      return typeof payload?.googleMapsKey === 'string' ? payload.googleMapsKey.trim() : '';
    } catch {
      return '';
    }
  }

  console.warn(`[Maps] Endpoint ${url} devolvió HTML/no JSON. Revisa función y redirects.`);
  return '';
}

async function getGoogleMapsApiKey() {
  if (googleMapsApiKeyCache) return googleMapsApiKeyCache;

  const keyFromWindow = getGoogleMapsKeyFromWindow();
  if (keyFromWindow) {
    googleMapsApiKeyCache = keyFromWindow;
    return googleMapsApiKeyCache;
  }

  if (isLocalHostRuntime()) {
    const localKey = await tryLoadLocalMapsConfig();
    if (localKey) {
      googleMapsApiKeyCache = localKey;
      return googleMapsApiKeyCache;
    }
  }

  if (isLocalHostRuntime() && !isLikelyNetlifyDevRuntime()) return '';

  const endpoints = ['/.netlify/functions/maps-browser-config', '/api/maps-browser-config'];
  for (const endpoint of endpoints) {
    try {
      const key = await fetchMapsKeyFromEndpoint(endpoint);
      if (key) {
        googleMapsApiKeyCache = key;
        return googleMapsApiKeyCache;
      }
    } catch (error) {
      console.warn(`No se pudo leer configuración de Google Maps desde ${endpoint}:`, error?.message || error);
    }
  }

  return '';
}

async function ensureGoogleMapsLoaded() {
  if (window.google?.maps?.Map && window.google?.maps?.places) return true;

  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = (async () => {
    const apiKey = await getGoogleMapsApiKey();
    if (!apiKey) {
      throw new Error(
        'Falta GOOGLE_MAPS_BROWSER_KEY. Configura maps-browser-config (Netlify Function) o window.__ENV__.GOOGLE_MAPS_BROWSER_KEY.'
      );
    }

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-maps="registro-comercio"]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Maps.')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = 'registro-comercio';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps.'));
      document.head.appendChild(script);
    });

    if (!window.google?.maps?.Map) throw new Error('Google Maps no está disponible después de cargar el script.');
    return true;
  })();

  try {
    return await googleMapsScriptPromise;
  } catch (error) {
    googleMapsScriptPromise = null;
    throw error;
  }
}

function getPlacesServiceHost() {
  return mapPickerInstance || document.createElement('div');
}

function nearbySearchPromise(service, request) {
  return new Promise((resolve, reject) => {
    service.nearbySearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK) {
        resolve(results || []);
        return;
      }
      if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
        return;
      }
      reject(new Error(`nearbySearch status: ${status}`));
    });
  });
}

function textSearchPromise(service, request) {
  return new Promise((resolve, reject) => {
    service.textSearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK) {
        resolve(results || []);
        return;
      }
      if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        resolve([]);
        return;
      }
      reject(new Error(`textSearch status: ${status}`));
    });
  });
}

function placeDetailsPromise(service, placeId) {
  return new Promise((resolve, reject) => {
    service.getDetails(
      {
        placeId,
        fields: ['name', 'formatted_address', 'formatted_phone_number', 'geometry', 'photos', 'place_id'],
      },
      (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          resolve(result || null);
          return;
        }
        if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve(null);
          return;
        }
        reject(new Error(`placeDetails status: ${status}`));
      }
    );
  });
}

function mapCandidateWithScore(place, payload) {
  const point = place?.geometry?.location;
  const placeLat = point?.lat?.();
  const placeLng = point?.lng?.();
  const meters = distanceMeters(payload.latitud, payload.longitud, placeLat, placeLng);
  const nameScore = computeNameSimilarityScore(payload.nombre, place?.name || '');
  const distanceScore = computeDistanceScore(meters);

  const municipioNorm = normalizeText(payload.municipio);
  const addressNorm = normalizeText(place?.vicinity || place?.formatted_address || '');
  const municipioMatch = Boolean(municipioNorm && addressNorm.includes(municipioNorm));
  const municipioBoost = municipioMatch ? 8 : 0;

  const matchScore = Math.round(nameScore * 0.75 + distanceScore * 0.25 + municipioBoost);
  const strength = classifyMatchStrength({
    distanceM: meters,
    nameScore,
    municipioMatch,
  });

  return {
    place_id: place.place_id || '',
    nombre_google: place.name || '',
    direccion_google: place.vicinity || place.formatted_address || '',
    telefono_google: place.formatted_phone_number || null,
    latitud_google: Number.isFinite(placeLat) ? placeLat : null,
    longitud_google: Number.isFinite(placeLng) ? placeLng : null,
    photo_url: null,
    distance_m: Number.isFinite(meters) ? Math.round(meters) : null,
    rating: Number.isFinite(place.rating) ? Number(place.rating) : null,
    user_ratings_total: Number.isFinite(place.user_ratings_total) ? Number(place.user_ratings_total) : null,
    types: Array.isArray(place.types) ? place.types : [],
    business_status: place.business_status || null,
    name_score: nameScore,
    distance_score: distanceScore,
    municipio_match: municipioMatch,
    match_score: matchScore,
    match_strength: strength.match_strength,
    is_match_fuerte: strength.is_match_fuerte,
    distance_band: strength.distance_band,
  };
}

async function enrichTopMatchesWithDetails(candidates, service) {
  const top = Array.isArray(candidates) ? candidates.slice(0, 3) : [];
  const enriched = [];

  for (const candidate of top) {
    let details = null;
    try {
      details = await placeDetailsPromise(service, candidate.place_id);
    } catch (error) {
      console.warn('No se pudo cargar place details:', candidate.place_id, error?.message || error);
    }

    const detailLocation = details?.geometry?.location;
    const detailLat = detailLocation?.lat?.();
    const detailLng = detailLocation?.lng?.();
    const detailPhoto = details?.photos?.[0];
    const photoUrl = detailPhoto?.getUrl
      ? detailPhoto.getUrl({ maxWidth: 720, maxHeight: 360 })
      : null;

    enriched.push({
      ...candidate,
      nombre_google: details?.name || candidate.nombre_google,
      direccion_google: details?.formatted_address || candidate.direccion_google,
      telefono_google: details?.formatted_phone_number || candidate.telefono_google || null,
      latitud_google: Number.isFinite(detailLat) ? detailLat : candidate.latitud_google,
      longitud_google: Number.isFinite(detailLng) ? detailLng : candidate.longitud_google,
      photo_url: photoUrl || candidate.photo_url || null,
    });
  }

  return enriched;
}

async function buscarCoincidenciasGoogleNombreCoords(payload) {
  await ensureGoogleMapsLoaded();

  const service = new window.google.maps.places.PlacesService(getPlacesServiceHost());
  const location = new window.google.maps.LatLng(payload.latitud, payload.longitud);
  const resultsById = new Map();

  for (const radius of GOOGLE_MATCH_RADII_METERS) {
    const nearby = await nearbySearchPromise(service, {
      location,
      radius,
      keyword: payload.nombre,
    });
    nearby.forEach((place) => {
      if (!place?.place_id) return;
      resultsById.set(place.place_id, place);
    });
  }

  const textQuery = `${payload.nombre} ${payload.municipio || ''} Puerto Rico`.trim();
  const textResults = await textSearchPromise(service, {
    location,
    radius: GOOGLE_MATCH_RADII_METERS[GOOGLE_MATCH_RADII_METERS.length - 1],
    query: textQuery,
  });
  textResults.forEach((place) => {
    if (!place?.place_id) return;
    resultsById.set(place.place_id, place);
  });

  const scoredMatches = Array.from(resultsById.values())
    .map((place) => mapCandidateWithScore(place, payload))
    .filter((candidate) => candidate.name_score >= 35)
    .filter((candidate) => !Number.isFinite(candidate.distance_m) || candidate.distance_m <= 1500)
    .sort((a, b) => {
      if (b.match_score !== a.match_score) return b.match_score - a.match_score;
      return (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity);
    });

  const topMatchesRaw = await enrichTopMatchesWithDetails(scoredMatches, service);
  const topMatches = topMatchesRaw.map((candidate) => {
    const meters = distanceMeters(
      payload.latitud,
      payload.longitud,
      candidate.latitud_google,
      candidate.longitud_google
    );
    const municipioNorm = normalizeText(payload.municipio);
    const addressNorm = normalizeText(candidate?.direccion_google || '');
    const municipioMatch = Boolean(municipioNorm && addressNorm.includes(municipioNorm));
    const strength = classifyMatchStrength({
      distanceM: meters,
      nameScore: candidate.name_score,
      municipioMatch,
    });
    return {
      ...candidate,
      distance_m: Number.isFinite(meters) ? Math.round(meters) : candidate.distance_m,
      municipio_match: municipioMatch,
      match_strength: strength.match_strength,
      is_match_fuerte: strength.is_match_fuerte,
      distance_band: strength.distance_band,
    };
  });

  return {
    searched_at: new Date().toISOString(),
    center: {
      latitud: payload.latitud,
      longitud: payload.longitud,
    },
    radii: GOOGLE_MATCH_RADII_METERS,
    query_nombre: payload.nombre,
    total_raw: resultsById.size,
    total_scored: scoredMatches.length,
    best_match: topMatches[0] || null,
    matches: topMatches,
  };
}

function setCoordinatesFromPicker(lat, lon, { centerMap = true, zoom = ACTIVE_MAP_ZOOM } = {}) {
  if (!isValidCoordinatePair(lat, lon)) {
    setMapHint('Coordenadas inválidas. Verifica el formato.', 'error');
    return;
  }

  if (inputLatitud) inputLatitud.value = lat.toFixed(6);
  if (inputLongitud) inputLongitud.value = lon.toFixed(6);
  syncMapMarkerFromInputs({ centerMap, zoom });
  hideFeedback();
  updateStepButtonState();
}

function bindMarkerDragEvents() {
  if (!mapPickerMarker) return;
  mapPickerMarker.addListener('dragend', () => {
    const point = mapPickerMarker.getPosition();
    if (!point) return;
    setCoordinatesFromPicker(point.lat(), point.lng(), { centerMap: false });
    setMapHint('Pin ajustado manualmente. Coordenadas actualizadas.', 'success');
  });
}

function syncMapMarkerFromInputs({ centerMap = false, zoom = ACTIVE_MAP_ZOOM } = {}) {
  if (!mapPickerInstance) return;
  const lat = toFiniteNumber(inputLatitud?.value);
  const lon = toFiniteNumber(inputLongitud?.value);
  if (!isValidCoordinatePair(lat, lon)) return;

  if (!mapPickerMarker) {
    mapPickerMarker = new window.google.maps.Marker({
      map: mapPickerInstance,
      position: { lat, lng: lon },
      draggable: true,
    });
    bindMarkerDragEvents();
  } else {
    mapPickerMarker.setPosition({ lat, lng: lon });
  }

  if (centerMap) {
    mapPickerInstance.setCenter({ lat, lng: lon });
    mapPickerInstance.setZoom(zoom);
  }
}

function initAddressAutocomplete() {
  if (!window.google?.maps?.places || !mapAddressSearch || mapAutocomplete) return;

  mapAutocomplete = new window.google.maps.places.Autocomplete(mapAddressSearch, {
    componentRestrictions: { country: 'pr' },
    fields: ['formatted_address', 'geometry', 'name'],
  });

  mapAutocomplete.addListener('place_changed', () => {
    const place = mapAutocomplete.getPlace();
    if (!place?.geometry?.location) {
      setMapHint('Esa dirección no tiene ubicación exacta. Intenta con más detalle.', 'warning');
      return;
    }
    const lat = place.geometry.location.lat();
    const lon = place.geometry.location.lng();
    setCoordinatesFromPicker(lat, lon, { centerMap: true, zoom: ACTIVE_MAP_ZOOM });
    setMapHint('Dirección aplicada. Ajusta el pin si necesitas más precisión.', 'success');
  });
}

async function initMapPickerIfNeeded() {
  await ensureGoogleMapsLoaded();

  if (mapPickerInstance) {
    window.google.maps.event.trigger(mapPickerInstance, 'resize');
    syncMapMarkerFromInputs({ centerMap: true, zoom: ACTIVE_MAP_ZOOM });
    initAddressAutocomplete();
    return true;
  }

  mapPickerInstance = new window.google.maps.Map(document.getElementById('mapPicker'), {
    center: DEFAULT_MAP_CENTER,
    zoom: DEFAULT_MAP_ZOOM,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
  });

  mapPickerInstance.addListener('click', (event) => {
    const point = event?.latLng;
    if (!point) return;
    setCoordinatesFromPicker(point.lat(), point.lng(), { centerMap: false });
    setMapHint('Ubicación marcada en el mapa.', 'success');
  });

  initAddressAutocomplete();
  syncMapMarkerFromInputs({ centerMap: true, zoom: ACTIVE_MAP_ZOOM });
  setTimeout(() => {
    if (mapPickerInstance) window.google.maps.event.trigger(mapPickerInstance, 'resize');
  }, 80);

  return true;
}

async function searchAddressOnMap() {
  if (!mapAddressSearch) return;

  try {
    await initMapPickerIfNeeded();
    const manualQuery = String(mapAddressSearch.value || '').trim();
    const municipio = getMunicipioLabel();
    const fallbackQuery = [inputNombreComercio?.value || '', municipio || '', 'Puerto Rico']
      .filter(Boolean)
      .join(', ');
    const query = manualQuery || fallbackQuery;

    if (!query) {
      setMapHint('Escribe una dirección para buscar en el mapa.', 'warning');
      return;
    }

    setMapHint('Buscando dirección...', 'info');

    const service = new window.google.maps.places.AutocompleteService();
    const predictions = await new Promise((resolve, reject) => {
      service.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'pr' },
        },
        (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) return resolve(results || []);
          if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) return resolve([]);
          return reject(new Error(`Autocomplete status: ${status}`));
        }
      );
    });

    if (!predictions.length) {
      setMapHint('No encontramos resultados para esa dirección.', 'warning');
      return;
    }

    const placesService = new window.google.maps.places.PlacesService(mapPickerInstance);
    const details = await new Promise((resolve, reject) => {
      placesService.getDetails(
        {
          placeId: predictions[0].place_id,
          fields: ['formatted_address', 'geometry'],
        },
        (result, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) return resolve(result);
          return reject(new Error(`Place details status: ${status}`));
        }
      );
    });

    const location = details?.geometry?.location;
    const lat = location?.lat?.();
    const lon = location?.lng?.();
    if (!isValidCoordinatePair(lat, lon)) {
      setMapHint('La dirección encontrada no devolvió coordenadas válidas.', 'warning');
      return;
    }

    setCoordinatesFromPicker(lat, lon, { centerMap: true, zoom: ACTIVE_MAP_ZOOM });
    setMapHint('Dirección encontrada. Ajusta el pin si es necesario.', 'success');
  } catch (error) {
    console.warn('Error buscando dirección:', error);
    setMapHint('No pudimos buscar la dirección en este momento.', 'error');
  }
}

function useCurrentLocationOnMap({ onFailToAddressSearch = false } = {}) {
  if (!navigator.geolocation) {
    setMapHint('Tu navegador no soporta geolocalización.', 'error');
    return;
  }

  setMapHint('Obteniendo tu ubicación...', 'info');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      setCoordinatesFromPicker(lat, lon, { centerMap: true, zoom: ACTIVE_MAP_ZOOM });
      setMapHint('Ubicación detectada. Ajusta el pin si es necesario.', 'success');
    },
    (error) => {
      console.warn('Error geolocation:', error);
      setMapHint('No pude acceder a tu ubicación. Usa Buscar dirección o mueve el pin.', 'warning');
      if (onFailToAddressSearch && mapAddressSearch && !mapAddressSearch.value.trim()) {
        searchAddressOnMap();
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function validateCoordinateInputsAndSync() {
  const rawLat = String(inputLatitud?.value || '').trim();
  const rawLon = String(inputLongitud?.value || '').trim();
  if (!rawLat && !rawLon) {
    updateStepButtonState();
    return;
  }

  const lat = toFiniteNumber(rawLat);
  const lon = toFiniteNumber(rawLon);
  if (!isValidCoordinatePair(lat, lon)) {
    setMapHint('Latitud o longitud inválida. Verifica los valores.', 'error');
    updateStepButtonState();
    return;
  }

  syncMapMarkerFromInputs({ centerMap: true, zoom: ACTIVE_MAP_ZOOM });
  setMapHint('Coordenadas actualizadas manualmente.', 'success');
  updateStepButtonState();
}

function toggleMapPickerPanel(forceOpen = null) {
  if (!mapPickerPanel) return;

  const isOpen = !mapPickerPanel.classList.contains('hidden');
  const shouldOpen = forceOpen === null ? !isOpen : Boolean(forceOpen);
  if (!shouldOpen) {
    mapPickerPanel.classList.add('hidden');
    return;
  }

  mapPickerPanel.classList.remove('hidden');
  btnToggleMapPicker?.setAttribute('disabled', 'true');
  const prevLabel = btnToggleMapPicker?.textContent || 'Marcar ubicación en el mapa';
  if (btnToggleMapPicker) btnToggleMapPicker.textContent = 'Cargando mapa...';

  initMapPickerIfNeeded()
    .then(() => {
      const lat = toFiniteNumber(inputLatitud?.value);
      const lon = toFiniteNumber(inputLongitud?.value);
      if (isValidCoordinatePair(lat, lon)) {
        syncMapMarkerFromInputs({ centerMap: true, zoom: ACTIVE_MAP_ZOOM });
        return;
      }
      useCurrentLocationOnMap({ onFailToAddressSearch: true });
    })
    .catch((error) => {
      console.warn('Error inicializando mapa:', error);
      setMapHint('No pudimos iniciar Google Maps. Intenta nuevamente.', 'error');
    })
    .finally(() => {
      btnToggleMapPicker?.removeAttribute('disabled');
      if (btnToggleMapPicker) btnToggleMapPicker.textContent = prevLabel;
    });
}

async function getAccessToken() {
  const {
    data: { session } = {},
  } = await supabase.auth.getSession();
  return session?.access_token || '';
}

async function callOtpEndpoint(pathOrPaths, payload) {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Sesión expirada. Inicia sesión nuevamente.');
  }

  const paths = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths];
  let lastError = null;

  for (const path of paths) {
    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;

    const msg = data?.error || `OTP endpoint error ${response.status}`;
    const error = new Error(msg);
    error.payload = data;
    error.status = response.status;
    lastError = error;

    if (response.status !== 404) {
      throw error;
    }
  }

  throw lastError || new Error('No se pudo contactar endpoint OTP.');
}

function humanizeOtpError(error) {
  const status = Number(error?.status || 0);
  const code = error?.payload?.code || '';
  const attemptsLeft = error?.payload?.attempts_left;
  if (status === 400 && Number.isFinite(Number(attemptsLeft))) {
    return `Código incorrecto. Intentos restantes: ${attemptsLeft}.`;
  }
  if (status === 410) return 'Código expirado. Solicita uno nuevo.';
  if (status === 429 && error?.payload?.blocked) return 'Demasiados intentos. Challenge bloqueado temporalmente.';
  if (status === 404) {
    return 'No encontramos el endpoint OTP. En local usa `netlify dev` para habilitar funciones.';
  }
  if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (code === 'cooldown_active') {
    const secs = error?.payload?.cooldown_seconds || 0;
    return `Debes esperar ${secs}s antes de reenviar el código.`;
  }
  if (code?.startsWith('rate_limit_')) {
    return 'Llegaste al límite de intentos OTP. Espera antes de intentar otra vez.';
  }
  return error?.message || 'No se pudo completar la operación OTP.';
}

async function sendOtp({ channelPreference = 'auto', resend = false, destinationPhone = null }) {
  if (!otpState.idComercio) {
    throw new Error('No hay comercio vinculado para OTP.');
  }

  const endpoint = resend
    ? ['/.netlify/functions/resend_otp', '/.netlify/functions/otp-resend']
    : ['/.netlify/functions/send_otp', '/.netlify/functions/otp-send'];
  const payload = {
    idComercio: otpState.idComercio,
    purpose: 'owner_verification',
    channel_preference: channelPreference,
    destination_phone: destinationPhone || undefined,
  };

  return callOtpEndpoint(endpoint, payload);
}

async function verifyOtp() {
  if (!otpState.challengeId) {
    throw new Error('No hay challenge OTP activo.');
  }

  const code = String(otpCodeInput?.value || '').replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) {
    throw new Error('Ingresa un código de 6 dígitos.');
  }

  return callOtpEndpoint(['/.netlify/functions/verify_otp', '/.netlify/functions/otp-verify'], {
    challenge_id: otpState.challengeId,
    code,
  });
}

async function handleStep1Submit(event) {
  event.preventDefault();
  hideFeedback();

  if (!authState.loggedIn) {
    loginModal?.classList.remove('hidden');
    loginModal?.classList.add('flex');
    return;
  }

  if (selectedNivel === null) {
    showFeedback('warning', 'Selecciona un paquete antes de continuar.');
    return;
  }

  if (!isStep1Valid()) {
    showFeedback('warning', 'Completa nombre, municipio y ubicación válida para continuar.');
    updateStepButtonState();
    return;
  }

  const payload = {
    ...getStep1Payload(),
    captured_at: new Date().toISOString(),
  };

  const previousLabel = submitRegistroBtn?.textContent || 'Siguiente';
  if (submitRegistroBtn) {
    submitRegistroBtn.disabled = true;
    submitRegistroBtn.textContent = 'Buscando coincidencias...';
  }

  try {
    const googleMatches = await buscarCoincidenciasGoogleNombreCoords(payload);
    lastGoogleSearchResult = googleMatches;
    const enrichedPayload = {
      ...payload,
      google_match: googleMatches?.best_match || null,
      google_match_count: googleMatches?.total_scored || 0,
    };

    window.findixiRegistroPaso1 = enrichedPayload;
    window.findixiRegistroGoogleMatches = googleMatches;
    sessionStorage.setItem('findixiRegistroPaso1', JSON.stringify(enrichedPayload));
    sessionStorage.setItem('findixiRegistroGoogleMatches', JSON.stringify(googleMatches));

    if (googleMatches.best_match) {
      renderGoogleMatchConfirmation(googleMatches.matches || []);
      showFeedback(
        'success',
        `Encontramos un posible comercio. Confirma si es correcto.`
      );
    } else {
      googleMatchState = {
        matches: [],
        selectedPlaceId: null,
        searchCenter: googleMatches?.center || null,
      };
      googleMatchConfirmBox?.classList.remove('hidden');
      if (googleMatchCard) {
        googleMatchCard.innerHTML =
          '<p class="text-sm text-gray-600 text-center">No encontramos coincidencias claras en Google para este nombre y ubicación.</p>';
      }
      btnMatchConfirmYes?.classList.add('hidden');
      btnMatchConfirmNo?.classList.remove('hidden');
      if (btnMatchConfirmNo) btnMatchConfirmNo.textContent = 'Continuar';
      showNoEsMiComercioFlow();
      showFeedback('info', 'No encontramos coincidencias cercanas. Puedes continuar como comercio nuevo.');
    }

    console.log('F2.2 resultado:', { payload: enrichedPayload, googleMatches });
  } catch (error) {
    console.error('Error en F2.2:', error);
    showFeedback('error', `No se pudo completar la búsqueda de coincidencias: ${error?.message || 'error desconocido'}`);
  } finally {
    if (submitRegistroBtn) submitRegistroBtn.textContent = previousLabel;
    updateStepButtonState();
  }
}

async function enviarDisputa(event) {
  event.preventDefault();
  clearDisputaFeedback();

  const nombre = String(disputaNombre?.value || '').trim();
  const email = String(disputaEmail?.value || '').trim();
  const telefono = String(disputaTelefono?.value || '').trim();
  const mensaje = String(disputaMensaje?.value || '').trim();

  if (!disputaContext?.comercioId) {
    setDisputaFeedback('error', 'No hay comercio seleccionado para disputar.');
    return;
  }
  if (!nombre || !email || !telefono) {
    setDisputaFeedback('warning', 'Completa nombre, email y teléfono.');
    return;
  }

  const prevText = disputaSubmitBtn?.textContent || 'Enviar disputa';
  if (disputaSubmitBtn) {
    disputaSubmitBtn.disabled = true;
    disputaSubmitBtn.textContent = 'Enviando...';
  }

  try {
    const payload = {
      idComercio: disputaContext.comercioId,
      google_place_id: disputaContext.placeId || null,
      nombre_comercio: disputaContext.comercioNombre || null,
      user_id: authState.user?.id || null,
      contacto_nombre: nombre,
      contacto_email: email,
      contacto_telefono: telefono,
      mensaje,
      estado: 'pendiente',
      metadata: {
        source: 'registroComercio',
        selected_plan_nivel: selectedNivel,
        submitted_at: new Date().toISOString(),
      },
    };

    const { error } = await supabase.from('disputas_comercio').insert(payload);
    if (error) throw error;

    setDisputaFeedback('success', 'Disputa enviada. El equipo Findixi te contactará pronto.');
    showFeedback(
      'success',
      'Recibimos tu disputa de propiedad. Nuestro equipo te contactará para validar evidencias.'
    );
    setTimeout(() => closeDisputaModal(), 900);
  } catch (error) {
    console.error('Error enviando disputa:', error);
    setDisputaFeedback(
      'error',
      'No pudimos enviar la disputa ahora mismo. Intenta nuevamente o contáctanos directamente.'
    );
  } finally {
    if (disputaSubmitBtn) {
      disputaSubmitBtn.disabled = false;
      disputaSubmitBtn.textContent = prevText;
    }
  }
}

function wireEvents() {
  form?.addEventListener('submit', handleStep1Submit);

  [inputNombreComercio, selectMunicipio].forEach((el) => {
    el?.addEventListener('input', () => {
      hideFeedback();
      hideGoogleMatchConfirmation();
      updateStepButtonState();
    });
    el?.addEventListener('change', () => {
      hideFeedback();
      hideGoogleMatchConfirmation();
      updateStepButtonState();
    });
  });

  [inputLatitud, inputLongitud].forEach((el) => {
    el?.addEventListener('input', () => {
      hideFeedback();
      hideGoogleMatchConfirmation();
      updateStepButtonState();
    });
    el?.addEventListener('change', validateCoordinateInputsAndSync);
  });

  btnToggleMapPicker?.addEventListener('click', () => toggleMapPickerPanel());
  btnMapUseMyLocation?.addEventListener('click', () => {
    toggleMapPickerPanel(true);
    useCurrentLocationOnMap();
  });
  btnMapSearchAddress?.addEventListener('click', () => {
    toggleMapPickerPanel(true);
    searchAddressOnMap();
  });
  mapAddressSearch?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      toggleMapPickerPanel(true);
      searchAddressOnMap();
    }
  });

  btnMatchConfirmYes?.addEventListener('click', async () => {
    const selected = getSelectedGoogleMatch();
    if (!selected) {
      showFeedback('warning', 'No hay comercio seleccionado para confirmar.');
      return;
    }

    const prevYesText = btnMatchConfirmYes.textContent;
    const prevNoText = btnMatchConfirmNo?.textContent || 'No es mi comercio';
    btnMatchConfirmYes.disabled = true;
    if (btnMatchConfirmNo) btnMatchConfirmNo.disabled = true;
    btnMatchConfirmYes.textContent = 'Guardando referencia...';
    if (btnMatchConfirmNo) btnMatchConfirmNo.textContent = 'Espera...';

    try {
      const persisted = persistGoogleMatchSelection({ confirmed: true });
      const resultado = await guardarReferenciaGoogleConfirmada();

      const claimPayload = {
        ...persisted,
        claim_result: resultado,
      };
      window.findixiRegistroPaso1 = claimPayload;
      sessionStorage.setItem('findixiRegistroPaso1', JSON.stringify(claimPayload));
      window.findixiRegistroClaimRecord = resultado;

      if (resultado.mode === 'activo_no_reclamable') {
        hideOtpVerificationBox();
        hideNoEsMiComercioFlow();
        hideProtectionModeBox();
        await openComercioActivoModal({
          comercioId: resultado.id,
          comercioNombre: resultado.nombre || selected?.nombre_google || getStep1Payload().nombre || 'Comercio',
          placeId: resultado.place_id || selected?.place_id,
          selectedMatch: selected,
        });
      } else if (resultado.mode === 'disputa') {
        showFeedback(
          'warning',
          'Este comercio ya tiene otro propietario. Se marcó en disputa para revisión manual.'
        );
        hideOtpVerificationBox();
      } else {
        showFeedback(
          'success',
          'Referencia Google guardada. Estado actualizado a reclamación pendiente y OTP pendiente.'
        );
        hideNoEsMiComercioFlow();
        hideProtectionModeBox();
        await iniciarOtpParaComercio({
          idComercio: resultado.id,
          comercioNombre: selected?.nombre_google || getStep1Payload().nombre || 'Comercio',
        });
      }
    } catch (error) {
      console.error('Error guardando referencia Google:', error);
      const msg = humanizeOtpError(error);
      showFeedback('error', `No se pudo completar la confirmación: ${msg}`);
      setOtpFeedback('error', msg);
    } finally {
      btnMatchConfirmYes.disabled = false;
      if (btnMatchConfirmNo) btnMatchConfirmNo.disabled = false;
      btnMatchConfirmYes.textContent = prevYesText;
      if (btnMatchConfirmNo) btnMatchConfirmNo.textContent = prevNoText;
    }
  });

  btnMatchConfirmNo?.addEventListener('click', () => {
    persistGoogleMatchSelection({ confirmed: false });
    showNoEsMiComercioFlow();
    showFeedback('info', 'Selecciona una opción para continuar sin crear duplicados.');
  });

  btnVerOtrosMatches?.addEventListener('click', () => {
    if (!googleOtherMatches) return;
    const hidden = googleOtherMatches.classList.contains('hidden');
    googleOtherMatches.classList.toggle('hidden', !hidden);
    btnVerOtrosMatches.textContent = hidden ? 'Ocultar otros resultados' : 'Ver otros resultados';
  });

  googleOtherMatches?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-select-place-id]');
    if (!button) return;
    const placeId = button.getAttribute('data-select-place-id');
    if (!placeId) return;
    selectGoogleMatch(placeId);
    hideNoEsMiComercioFlow();
    hideProtectionModeBox();
    showFeedback('info', 'Resultado alterno seleccionado. Confirma si corresponde a tu comercio.');
  });

  btnNoFlowVerOtros?.addEventListener('click', () => {
    const othersCount = Math.max(0, (googleMatchState.matches || []).length - 1);
    if (!othersCount) {
      showFeedback('warning', 'No hay otros resultados por mostrar. Ajusta el pin y vuelve a buscar.');
      return;
    }
    googleOtherMatches?.classList.remove('hidden');
    btnVerOtrosMatches?.classList.remove('hidden');
    showFeedback('info', 'Selecciona otro resultado y confirma con “Correcto, es mi comercio”.');
  });

  btnNoFlowAjustarPin?.addEventListener('click', async () => {
    toggleMapPickerPanel(true);
    setMapHint('Mueve el pin a la entrada del negocio y luego pulsa “Buscar de nuevo”.', 'info');
    hideProtectionModeBox();
    showFeedback('info', 'Ajusta el pin y usa “Buscar de nuevo” para re-ejecutar la búsqueda.');
  });

  btnNoFlowBuscarDeNuevo?.addEventListener('click', async () => {
    await handleStep1Submit({
      preventDefault() {},
    });
  });

  btnNoFlowNoAparece?.addEventListener('click', () => {
    if (canContinueAsNewBusinessWithoutProtection()) {
      hideProtectionModeBox();
      noEsMiComercioBox?.classList.remove('hidden');
      nuevoComercioFlowBox?.classList.remove('hidden');
      const suggestedPhone = getAuthUserPhone();
      if (inputNuevoComercioPhone && !inputNuevoComercioPhone.value.trim() && suggestedPhone) {
        inputNuevoComercioPhone.value = suggestedPhone;
      }
      showFeedback('info', 'Continuaremos como comercio nuevo con OTP a tu teléfono.');
      return;
    }
    showProtectionModeBox();
    showFeedback(
      'warning',
      'Detectamos una coincidencia fuerte. Necesitamos una verificación adicional para evitar duplicados.'
    );
  });

  btnNoFlowCrearNuevo?.addEventListener('click', async () => {
    const telefonoOtp = String(inputNuevoComercioPhone?.value || getAuthUserPhone() || '').trim();
    if (!telefonoOtp) {
      showFeedback('warning', 'Ingresa un teléfono válido para continuar como comercio nuevo.');
      return;
    }

    const prevText = btnNoFlowCrearNuevo.textContent;
    btnNoFlowCrearNuevo.disabled = true;
    btnNoFlowCrearNuevo.textContent = 'Creando...';
    try {
      const created = await crearComercioNuevoPendienteOtp({ telefonoOtp });
      await iniciarOtpParaComercio({
        idComercio: created.id,
        comercioNombre: getStep1Payload().nombre || 'Comercio',
        destinationPhone: telefonoOtp,
      });
      showFeedback('success', 'Comercio nuevo creado. Completa la verificación por código.');
    } catch (error) {
      if (error?.similarActivo?.id) {
        await openComercioActivoModal({
          comercioId: error.similarActivo.id,
          comercioNombre: error.similarActivo.nombre || getStep1Payload().nombre || 'Comercio',
          placeId: getSelectedGoogleMatch()?.place_id || null,
          selectedMatch: getSelectedGoogleMatch(),
        });
        showFeedback('info', 'Este comercio ya aparece activo. Puedes abrir una disputa para revisión.');
        return;
      }
      showFeedback('error', error?.message || 'No se pudo crear el comercio nuevo.');
      setOtpFeedback('error', error?.message || 'No se pudo iniciar OTP para comercio nuevo.');
    } finally {
      btnNoFlowCrearNuevo.disabled = false;
      btnNoFlowCrearNuevo.textContent = prevText;
    }
  });

  btnProteccionVerificarTelefono?.addEventListener('click', async () => {
    const selected = getSelectedGoogleMatch() || getTopMatch();
    if (!selected) {
      showFeedback('warning', 'No hay coincidencia seleccionada para verificar.');
      return;
    }

    const prevText = btnProteccionVerificarTelefono.textContent;
    btnProteccionVerificarTelefono.disabled = true;
    btnProteccionVerificarTelefono.textContent = 'Preparando verificación...';
    try {
      const persisted = persistGoogleMatchSelection({ confirmed: false });
      const resultado = await guardarReferenciaGoogleConfirmada({ protectionMode: true });
      window.findixiRegistroPaso1 = { ...persisted, claim_result: resultado, protection_mode: true };
      sessionStorage.setItem('findixiRegistroPaso1', JSON.stringify(window.findixiRegistroPaso1));

      if (resultado.mode === 'activo_no_reclamable') {
        hideOtpVerificationBox();
        await openComercioActivoModal({
          comercioId: resultado.id,
          comercioNombre: resultado.nombre || selected?.nombre_google || getStep1Payload().nombre || 'Comercio',
          placeId: resultado.place_id || selected?.place_id,
          selectedMatch: selected,
        });
        return;
      }

      if (resultado.mode === 'disputa') {
        showFeedback('warning', 'Este comercio ya tiene propietario. Se envió a disputa para revisión manual.');
        return;
      }

      await iniciarOtpParaComercio({
        idComercio: resultado.id,
        comercioNombre: selected?.nombre_google || getStep1Payload().nombre || 'Comercio',
      });
      showFeedback('success', 'Modo protección activo. Verifica con el teléfono del negocio para continuar.');
    } catch (error) {
      showFeedback('error', error?.message || 'No se pudo activar modo protección.');
      setOtpFeedback('error', error?.message || 'No se pudo iniciar verificación.');
    } finally {
      btnProteccionVerificarTelefono.disabled = false;
      btnProteccionVerificarTelefono.textContent = prevText;
    }
  });

  btnProteccionManual?.addEventListener('click', async () => {
    const selected = getSelectedGoogleMatch() || getTopMatch();
    if (!selected) {
      showFeedback('warning', 'No hay coincidencia seleccionada para enviar a revisión.');
      return;
    }

    const prevText = btnProteccionManual.textContent;
    btnProteccionManual.disabled = true;
    btnProteccionManual.textContent = 'Enviando...';
    try {
      const resultado = await guardarReferenciaGoogleConfirmada({ protectionMode: true, manualReview: true });
      if (resultado?.mode === 'activo_no_reclamable') {
        await openComercioActivoModal({
          comercioId: resultado.id,
          comercioNombre: resultado.nombre || selected?.nombre_google || getStep1Payload().nombre || 'Comercio',
          placeId: resultado.place_id || selected?.place_id,
          selectedMatch: selected,
        });
        return;
      }
      showFeedback(
        'success',
        'Solicitud enviada a revisión manual. Mantendremos el comercio en modo protegido hasta verificar propiedad.'
      );
      hideOtpVerificationBox();
      hideProtectionModeBox();
    } catch (error) {
      showFeedback('error', error?.message || 'No se pudo solicitar revisión manual.');
    } finally {
      btnProteccionManual.disabled = false;
      btnProteccionManual.textContent = prevText;
    }
  });

  btnProteccionVolver?.addEventListener('click', () => {
    hideProtectionModeBox();
    showNoEsMiComercioFlow();
    toggleMapPickerPanel(true);
    setMapHint('Ajusta el pin y vuelve a buscar para mejorar coincidencias.', 'info');
  });

  otpCodeInput?.addEventListener('input', () => {
    const digits = String(otpCodeInput.value || '').replace(/\D/g, '').slice(0, 6);
    otpCodeInput.value = digits;
    clearOtpFeedback();
  });

  btnOtpVerify?.addEventListener('click', async () => {
    clearOtpFeedback();
    btnOtpVerify.disabled = true;
    const prevText = btnOtpVerify.textContent;
    btnOtpVerify.textContent = 'Verificando...';
    try {
      const result = await verifyOtp();
      otpState.verified = true;
      persistOtpState();
      setOtpFeedback('success', 'Código verificado correctamente. La propiedad del comercio quedó verificada.');
      showFeedback('success', 'Verificación completada. El comercio está listo para continuar.');
      setOtpAssistanceVisibility(false);
      showOtpVerifiedSummary(otpState.comercioNombre || getComercioNombreActual());
      if (otpMetaText) {
        otpMetaText.textContent = `Verificado por ${result?.metodo_verificacion || otpState.channelUsed || 'otp'}.`;
      }
      if (btnOtpResend) btnOtpResend.disabled = true;
      if (btnOtpVoice) btnOtpVoice.disabled = true;
      if (otpCodeInput) otpCodeInput.disabled = true;
    } catch (error) {
      setOtpFeedback('error', humanizeOtpError(error));
    } finally {
      if (otpState.verified) {
        btnOtpVerify.disabled = true;
        btnOtpVerify.textContent = 'Verificado';
      } else {
        btnOtpVerify.disabled = false;
        btnOtpVerify.textContent = prevText;
      }
    }
  });

  btnOtpResend?.addEventListener('click', async () => {
    clearOtpFeedback();
    btnOtpResend.disabled = true;
    const prevText = btnOtpResend.textContent;
    btnOtpResend.textContent = 'Reenviando...';
    let success = false;
    try {
      const result = await sendOtp({ channelPreference: 'auto', resend: true });
      applyOtpSendResult(result);
      setOtpFeedback('info', 'Código reenviado.');
      success = true;
    } catch (error) {
      setOtpFeedback('error', humanizeOtpError(error));
    } finally {
      if (!success) {
        btnOtpResend.disabled = false;
        btnOtpResend.textContent = prevText;
      }
    }
  });

  btnOtpVoice?.addEventListener('click', async () => {
    clearOtpFeedback();
    btnOtpVoice.disabled = true;
    const prevText = btnOtpVoice.textContent;
    btnOtpVoice.textContent = 'Llamando...';
    let success = false;
    try {
      const result = await sendOtp({ channelPreference: 'voice', resend: true });
      applyOtpSendResult(result);
      setOtpFeedback('info', 'Se envió OTP por llamada de voz.');
      success = true;
    } catch (error) {
      setOtpFeedback('error', humanizeOtpError(error));
    } finally {
      btnOtpVoice.disabled = false;
      btnOtpVoice.textContent = success ? 'Probar llamada' : prevText;
    }
  });

  btnOtpNoRecibi?.addEventListener('click', () => {
    setOtpFeedback('warning', 'Si no te llega por SMS, usa "Probar llamada" o vuelve a reenviar al terminar el cooldown.');
  });

  btnOtpContinue?.addEventListener('click', () => {
    if (!otpState.verified) {
      setOtpFeedback('warning', 'Primero verifica el código del comercio.');
      return;
    }
    const prevText = btnOtpContinue.textContent;
    btnOtpContinue.disabled = true;
    btnOtpContinue.textContent = 'Abriendo panel...';
    try {
      irAlPanelComercioPostRegistro();
    } finally {
      btnOtpContinue.disabled = false;
      btnOtpContinue.textContent = prevText || 'Siguiente';
    }
  });

  loginModal?.addEventListener('click', (event) => {
    if (event.target === loginModal) {
      loginModal.classList.add('hidden');
      loginModal.classList.remove('flex');
    }
  });
  loginModalClose?.addEventListener('click', () => {
    loginModal?.classList.add('hidden');
    loginModal?.classList.remove('flex');
  });

  formModal?.addEventListener('click', (event) => {
    if (event.target === formModal) closeFormModal();
  });
  formModalClose?.addEventListener('click', closeFormModal);

  planNextModal?.addEventListener('click', (event) => {
    if (event.target === planNextModal) closePlanNextModal();
  });
  planNextModalClose?.addEventListener('click', closePlanNextModal);
  planNextModalContinue?.addEventListener('click', closePlanNextModal);

  brandingSetupModal?.addEventListener('click', (event) => {
    if (event.target === brandingSetupModal) closeBrandingSetupModal();
  });
  brandingSetupClose?.addEventListener('click', closeBrandingSetupModal);
  brandingLogoInput?.addEventListener('change', () => {
    clearInlineFeedback(brandingLogoFeedback);
    hideBrandingLogoUpgradeBox();
  });
  brandingPortadaInput?.addEventListener('change', () => {
    clearInlineFeedback(brandingPortadaFeedback);
  });
  brandingLogoValidateBtn?.addEventListener('click', async () => {
    await processBrandingImage({ type: 'logo', mode: 'validate' });
  });
  brandingPortadaValidateBtn?.addEventListener('click', async () => {
    await processBrandingImage({ type: 'portada', mode: 'validate' });
  });
  brandingLogoRetryBtn?.addEventListener('click', () => {
    hideBrandingLogoUpgradeBox();
    clearInlineFeedback(brandingLogoFeedback);
    brandingLogoInput?.focus();
  });
  brandingLogoUpgradeBtn?.addEventListener('click', async () => {
    const label = brandingState.logoOffer?.label || 'modo demo';
    const ok = confirm(`Logo Upgrade: ${label}\n\nEn esta etapa correrá en modo demo (sin cobro real). ¿Continuar?`);
    if (!ok) return;
    await processBrandingImage({ type: 'logo', mode: 'upgrade_demo' });
  });
  brandingContinueBtn?.addEventListener('click', async () => {
    const pending = [];
    if (!brandingState.logoAprobado) pending.push('logo');
    if (!brandingState.portadaAprobado) pending.push('portada');

    if (pending.length) {
      const ok = confirm(
        `Aún faltan imágenes por aprobar (${pending.join(
          ' y '
        )}). Podrás subirlas luego en tu panel, pero no podrás publicar hasta aprobarlas.\n\n¿Continuar al panel comercio?`
      );
      if (!ok) return;
    }

    closeBrandingSetupModal();
    await irAlPanelComercioPostRegistro();
  });

  btnAbrirDisputaDesdeActivo?.addEventListener('click', openDisputaModal);
  comercioActivoModal?.addEventListener('click', (event) => {
    if (event.target === comercioActivoModal) closeComercioActivoModal();
  });
  comercioActivoModalClose?.addEventListener('click', closeComercioActivoModal);
  disputaModal?.addEventListener('click', (event) => {
    if (event.target === disputaModal) closeDisputaModal();
  });
  disputaModalClose?.addEventListener('click', closeDisputaModal);
  disputaForm?.addEventListener('submit', enviarDisputa);
}

async function init() {
  wireEvents();
  await cargarUsuario();
  await cargarMunicipios();
  renderPlanes(selectedNivel);
  hideOtpVerificationBox({ clearSession: false });
  restoreOtpStateFromSession();
  updateStepButtonState();
}

init();
