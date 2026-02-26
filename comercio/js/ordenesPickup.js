import { supabase } from '../shared/supabaseClient.js';

const SENT_STATUSES = new Set(['paid', 'sent', 'confirmed']);
const ACTIVE_STATUSES = new Set(['paid', 'sent', 'confirmed', 'preparing', 'ready']);

const tituloComercio = document.getElementById('tituloComercio');
const btnEnableSound = document.getElementById('btnEnableSound');
const btnRefreshOrders = document.getElementById('btnRefreshOrders');
const alarmBanner = document.getElementById('alarmBanner');
const ordersContainer = document.getElementById('ordersContainer');
const ordersEmpty = document.getElementById('ordersEmpty');
const ordersLoading = document.getElementById('ordersLoading');

const statActivas = document.getElementById('statActivas');
const statNuevas = document.getElementById('statNuevas');
const statPreparando = document.getElementById('statPreparando');
const statListas = document.getElementById('statListas');

const boxActivas = document.getElementById('boxActivas');
const boxEnviadas = document.getElementById('boxEnviadas');
const boxPreparando = document.getElementById('boxPreparando');
const boxTerminadas = document.getElementById('boxTerminadas');

const params = new URLSearchParams(window.location.search);
const idComercio = Number(params.get('id') || params.get('idComercio') || 0);

let realtimeChannel = null;
let timerInterval = null;
let pollTimer = null;
let reloadTimer = null;
let actionInFlight = false;

let currentOrders = [];
let currentItemsByOrder = new Map();
let currentFilter = 'all';

let audioCtx = null;
let soundEnabled = true;
let alarmInterval = null;

function setLoading(isLoading) {
  ordersLoading?.classList.toggle('hidden', !isLoading);
}

function setEmpty(isEmpty) {
  ordersEmpty?.classList.toggle('hidden', !isEmpty);
}

function getFilterLabel(filter) {
  if (filter === 'sent') return 'enviadas';
  if (filter === 'preparing') return 'en preparación';
  if (filter === 'ready') return 'terminadas';
  return 'activas';
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-PR', { dateStyle: 'medium', timeStyle: 'short' });
}

function elapsedSeconds(createdAt) {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 1000));
}

function formatElapsed(createdAt) {
  const total = elapsedSeconds(createdAt);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getStage(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ready') return 'ready';
  if (s === 'preparing') return 'preparing';
  if (s === 'delivered') return 'delivered';
  if (SENT_STATUSES.has(s)) return 'sent';
  return null;
}

function getStatusLabel(stage) {
  if (stage === 'ready') return 'Terminada';
  if (stage === 'preparing') return 'En preparación';
  if (stage === 'sent') return 'Enviada';
  if (stage === 'delivered') return 'Entregada';
  return 'En proceso';
}

function getNextAction(stage) {
  if (stage === 'sent') {
    return {
      nextStatus: 'preparing',
      label: 'Orden Aceptada',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700',
    };
  }
  if (stage === 'preparing') {
    return {
      nextStatus: 'ready',
      label: 'Terminada',
      btnClass: 'bg-amber-500 hover:bg-amber-600',
    };
  }
  if (stage === 'ready') {
    return {
      nextStatus: 'delivered',
      label: 'Orden Entregada',
      btnClass: 'bg-slate-800 hover:bg-slate-900',
    };
  }
  return null;
}

function getAlertConfig(stage, createdAt, updatedAt) {
  if (stage === 'preparing') {
    const mins = elapsedSeconds(createdAt) / 60;
    if (mins >= 55) return { level: 'red', blink: true };
    if (mins >= 30) return { level: 'yellow', blink: true };
    return { level: null, blink: false };
  }

  if (stage === 'ready') {
    const mins = elapsedSeconds(updatedAt || createdAt) / 60;
    if (mins >= 20) return { level: 'green', blink: true };
    return { level: null, blink: false };
  }

  return { level: null, blink: false };
}

function applyAlertClasses(el, level, blink) {
  if (!el) return;
  el.classList.remove('alert-yellow', 'alert-red', 'alert-green', 'blink-yellow', 'blink-red', 'blink-green');
  if (level === 'yellow') el.classList.add('alert-yellow');
  if (level === 'red') el.classList.add('alert-red');
  if (level === 'green') el.classList.add('alert-green');
  if (blink && level === 'yellow') el.classList.add('blink-yellow');
  if (blink && level === 'red') el.classList.add('blink-red');
  if (blink && level === 'green') el.classList.add('blink-green');
}

function isActiveStatus(status) {
  const s = String(status || '').toLowerCase();
  return ACTIVE_STATUSES.has(s);
}

function parseOrderModifiers(raw) {
  if (!raw || typeof raw !== 'object') return { grouped: [], note: null };
  const list = Array.isArray(raw.items) ? raw.items : [];
  const grouped = new Map();
  list.forEach((mod) => {
    const groupName = String(mod?.grupo || mod?.grupo_nombre || 'Opciones').trim() || 'Opciones';
    const items = grouped.get(groupName) || [];
    items.push(mod);
    grouped.set(groupName, items);
  });
  return { grouped: Array.from(grouped.entries()), note: raw.nota || null };
}

function renderOrderItem(item) {
  const parsed = parseOrderModifiers(item.modifiers);
  const modifiersHtml = parsed.grouped.map(([group, mods]) => {
    const lines = mods.map((m) => {
      const extra = Number(m?.precio_extra);
      const extraLabel = Number.isFinite(extra) && extra > 0 ? ` (+$${extra.toFixed(2)})` : '';
      return `<div class="text-xs text-gray-600">• ${m?.nombre || 'Opción'}${extraLabel}</div>`;
    }).join('');
    return `<div class="mt-1"><div class="text-xs font-semibold text-gray-700">${group}:</div>${lines}</div>`;
  }).join('');

  const noteHtml = parsed.note ? `<div class="text-xs text-gray-600 mt-1">Nota: ${parsed.note}</div>` : '';

  return `
    <div class="py-2 border-b border-dashed border-gray-200 last:border-b-0">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-gray-900">${Number(item.qty) || 1} x ${item.nombre}</div>
          ${modifiersHtml}
          ${noteHtml}
        </div>
        <div class="text-sm font-semibold text-gray-900">${formatMoney(item.lineTotal)}</div>
      </div>
    </div>
  `;
}

function renderOrders(orders, itemsByOrder) {
  ordersContainer.innerHTML = '';
  if (!orders.length) {
    if (ordersEmpty) ordersEmpty.textContent = `No hay órdenes ${getFilterLabel(currentFilter)}.`;
    setEmpty(true);
    return;
  }
  setEmpty(false);

  orders.forEach((order) => {
    const stage = getStage(order.status) || 'sent';
    const label = getStatusLabel(stage);
    const action = getNextAction(stage);
    const items = itemsByOrder.get(order.id) || [];
    const totalFromItems = items.reduce((acc, i) => acc + i.lineTotal, 0);
    const total = Number(order.total);
    const totalFinal = Number.isFinite(total) ? total : totalFromItems;
    const created = formatDate(order.created_at);

    const actionHtml = action
      ? `<button type="button"
            data-action="change-status"
            data-order-id="${order.id}"
            data-next-status="${action.nextStatus}"
            class="px-4 py-2 rounded-lg text-white text-sm font-semibold ${action.btnClass}">
            ${action.label}
         </button>`
      : '';

    const card = document.createElement('article');
    card.className = 'bg-white border border-gray-200 rounded-2xl shadow-sm p-4 ticket-border';
    card.dataset.orderId = String(order.id);
    card.dataset.stage = stage;
    card.dataset.createdAt = order.created_at || '';
    card.dataset.updatedAt = order.updated_at || '';
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-gray-500">Ticket</p>
          <h2 class="text-lg font-semibold text-gray-900">#${order.id}</h2>
          <p class="text-xs text-gray-500">${created}</p>
          <p class="text-xs text-gray-500">${order.clover_order_id ? `Clover: ${order.clover_order_id}` : 'Clover ID pendiente'}</p>
        </div>
        <div class="text-left sm:text-right">
          <div class="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold" data-status-chip>${label}</div>
          <div class="mt-2 text-xs text-gray-500">Tiempo activo</div>
          <div class="text-2xl font-bold text-gray-800" data-elapsed>${formatElapsed(order.created_at)}</div>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600">
        <div><span class="font-semibold">Tipo:</span> ${order.order_type || 'pickup'}</div>
        <div><span class="font-semibold">Canal:</span> ${order.source || 'app'}</div>
        <div><span class="font-semibold">Mesa:</span> ${order.mesa || '—'}</div>
      </div>
      <div class="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
        <div class="text-xs font-semibold text-gray-700">Cliente</div>
        <div class="text-sm text-gray-900">${order.customer_name || 'Sin nombre'}</div>
        <div class="text-xs text-gray-600">${order.customer_phone || order.customer_email || 'Sin contacto'}</div>
      </div>
      <div class="mt-3">
        ${items.length ? items.map(renderOrderItem).join('') : '<div class="text-sm text-gray-500">Sin items cargados.</div>'}
      </div>
      <div class="mt-3 pt-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div class="flex items-center gap-2">
          <div class="text-sm font-semibold text-gray-700">Total</div>
          <div class="text-xl font-bold text-gray-900">${formatMoney(totalFinal)}</div>
        </div>
        <div>${actionHtml}</div>
      </div>
    `;
    ordersContainer.appendChild(card);
  });
}

function stopAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  alarmBanner?.classList.add('hidden');
}

function beep(duration = 220, frequency = 920) {
  if (!audioCtx) return;
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = frequency;
  gainNode.gain.value = 0.08;
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  setTimeout(() => oscillator.stop(), duration);
}

function playAlarmPulse() {
  beep(200, 980);
  setTimeout(() => beep(200, 760), 240);
}

function startAlarmLoop() {
  if (alarmInterval) return;
  playAlarmPulse();
  alarmInterval = setInterval(playAlarmPulse, 1800);
}

function updateAlarmByOrders() {
  const sentCount = currentOrders.filter((o) => getStage(o.status) === 'sent').length;
  if (sentCount > 0) {
    alarmBanner.textContent = `${sentCount} orden(es) enviada(s) sin aceptar.`;
    alarmBanner.classList.remove('hidden');
    if (soundEnabled) startAlarmLoop();
  } else {
    stopAlarm();
  }
}

function resetBoxStyles() {
  [boxActivas, boxEnviadas, boxPreparando, boxTerminadas].forEach((box) => {
    if (!box) return;
    box.classList.remove('alert-yellow', 'alert-red', 'alert-green', 'blink-yellow', 'blink-red', 'blink-green');
  });
}

function applyActiveFilterBox() {
  [boxActivas, boxEnviadas, boxPreparando, boxTerminadas].forEach((box) => {
    if (!box) return;
    const boxFilter = box.dataset.filter || 'all';
    box.classList.toggle('filter-active', boxFilter === currentFilter);
  });
}

function getFilteredOrders() {
  if (currentFilter === 'all') return currentOrders;
  return currentOrders.filter((order) => getStage(order.status) === currentFilter);
}

function getSeverityRank(level) {
  if (level === 'red') return 2;
  if (level === 'yellow') return 1;
  return 0;
}

function updateLiveVisuals() {
  const stageCounters = {
    sent: 0,
    preparing: 0,
    ready: 0,
  };
  const stageAlerts = {
    sent: { level: null, blink: false },
    preparing: { level: null, blink: false },
    ready: { level: null, blink: false },
  };

  document.querySelectorAll('[data-order-id]').forEach((card) => {
    const stage = card.dataset.stage || 'sent';
    const createdAt = card.dataset.createdAt || '';
    const updatedAt = card.dataset.updatedAt || '';
    const elapsedEl = card.querySelector('[data-elapsed]');
    if (elapsedEl) elapsedEl.textContent = formatElapsed(createdAt);

    const alertCfg = getAlertConfig(stage, createdAt, updatedAt);
    const blink = Boolean(alertCfg.blink);

    card.classList.remove('ticket-border', 'ticket-border-warm', 'ticket-border-cool');
    if (stage === 'preparing') card.classList.add('ticket-border-warm');
    else if (stage === 'ready') card.classList.add('ticket-border-cool');
    else card.classList.add('ticket-border');

    applyAlertClasses(card, alertCfg.level, blink);
    if (elapsedEl) applyAlertClasses(elapsedEl, alertCfg.level, blink);
  });

  currentOrders.forEach((order) => {
    const stage = getStage(order.status);
    if (!stage || stage === 'delivered') return;
    stageCounters[stage] = (stageCounters[stage] || 0) + 1;

    const alertCfg = getAlertConfig(stage, order.created_at || '', order.updated_at || '');
    if (stage === 'preparing') {
      const prevRank = getSeverityRank(stageAlerts.preparing.level);
      const nextRank = getSeverityRank(alertCfg.level);
      if (nextRank > prevRank) stageAlerts.preparing.level = alertCfg.level;
      stageAlerts.preparing.blink = stageAlerts.preparing.blink || Boolean(alertCfg.blink);
    } else if (stage === 'ready') {
      if (alertCfg.level) stageAlerts.ready.level = alertCfg.level;
      stageAlerts.ready.blink = stageAlerts.ready.blink || Boolean(alertCfg.blink);
    }
  });

  if (statActivas) statActivas.textContent = String((stageCounters.sent || 0) + (stageCounters.preparing || 0) + (stageCounters.ready || 0));
  if (statNuevas) statNuevas.textContent = String(stageCounters.sent || 0);
  if (statPreparando) statPreparando.textContent = String(stageCounters.preparing || 0);
  if (statListas) statListas.textContent = String(stageCounters.ready || 0);

  resetBoxStyles();
  applyActiveFilterBox();
  applyAlertClasses(boxPreparando, stageAlerts.preparing.level, stageAlerts.preparing.blink);
  applyAlertClasses(boxTerminadas, stageAlerts.ready.level, stageAlerts.ready.blink);

  const activeWorstRank = Math.max(getSeverityRank(stageAlerts.preparing.level), getSeverityRank(stageAlerts.ready.level));
  if (activeWorstRank === 2) applyAlertClasses(boxActivas, 'red', stageAlerts.preparing.blink || stageAlerts.ready.blink);
  else if (activeWorstRank === 1) applyAlertClasses(boxActivas, 'yellow', stageAlerts.preparing.blink || stageAlerts.ready.blink);
}

async function unlockSound(silent = false) {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    soundEnabled = true;
    if (btnEnableSound) {
      btnEnableSound.innerHTML = '<i class="fa-solid fa-volume-high"></i> Sonido activo';
    }
    updateAlarmByOrders();
  } catch (err) {
    console.warn('No se pudo activar audio', err);
    if (!silent) {
      alert('No se pudo activar el sonido en este navegador.');
    }
  }
}

function setupAudioAutoUnlock() {
  const tryUnlock = () => unlockSound(true);
  const options = { passive: true };

  window.addEventListener('pointerdown', tryUnlock, options);
  window.addEventListener('touchstart', tryUnlock, options);
  window.addEventListener('keydown', tryUnlock);
  window.addEventListener('focus', tryUnlock);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryUnlock();
  });
}

async function validateAccessOrRedirect() {
  if (!Number.isFinite(idComercio) || idComercio <= 0) {
    window.location.href = './index.html';
    return null;
  }

  const { data: userResp, error: userErr } = await supabase.auth.getUser();
  const user = userResp?.user;
  if (userErr || !user) {
    window.location.href = './login.html';
    return null;
  }

  const relResp = await supabase
    .from('UsuarioComercios')
    .select('idComercio')
    .eq('idUsuario', user.id)
    .eq('idComercio', idComercio)
    .limit(1);

  const hasRelation = Array.isArray(relResp.data) && relResp.data.length > 0;
  if (!hasRelation) {
    const ownerResp = await supabase
      .from('Comercios')
      .select('id')
      .eq('id', idComercio)
      .eq('owner_user_id', user.id)
      .maybeSingle();
    if (ownerResp.error || !ownerResp.data) {
      alert('No tienes acceso a este comercio.');
      window.location.href = './index.html';
      return null;
    }
  }

  const comercioResp = await supabase
    .from('Comercios')
    .select('id, nombre')
    .eq('id', idComercio)
    .maybeSingle();

  if (comercioResp.data?.nombre && tituloComercio) {
    tituloComercio.textContent = `Órdenes activas · ${comercioResp.data.nombre}`;
  }

  return { user };
}

async function fetchOrdersForComercio() {
  const buildSelect = ({ camelCaseId = false, withCustomers = true, withUpdatedAt = true }) => {
    const idCol = camelCaseId ? 'idComercio' : 'idcomercio';
    const cols = ['id', idCol, 'clover_order_id', 'total', 'status', 'created_at'];
    if (withUpdatedAt) cols.push('updated_at');
    cols.push('order_type', 'mesa', 'source');
    if (withCustomers) cols.push('customer_name', 'customer_email', 'customer_phone');
    return cols.join(',');
  };

  const attempts = [
    { camelCaseId: false, withCustomers: true, withUpdatedAt: true },
    { camelCaseId: false, withCustomers: false, withUpdatedAt: true },
    { camelCaseId: false, withCustomers: true, withUpdatedAt: false },
    { camelCaseId: false, withCustomers: false, withUpdatedAt: false },
    { camelCaseId: true, withCustomers: true, withUpdatedAt: true },
    { camelCaseId: true, withCustomers: false, withUpdatedAt: true },
    { camelCaseId: true, withCustomers: true, withUpdatedAt: false },
    { camelCaseId: true, withCustomers: false, withUpdatedAt: false },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    const idCol = attempt.camelCaseId ? 'idComercio' : 'idcomercio';
    const resp = await supabase
      .from('ordenes')
      .select(buildSelect(attempt))
      .eq(idCol, idComercio)
      .eq('order_type', 'pickup')
      .order('created_at', { ascending: true });

    if (!resp.error) {
      return (resp.data || []).map((row) => ({
        ...row,
        idcomercio: row.idcomercio ?? row.idComercio ?? null,
      }));
    }

    lastError = resp.error;
    const msg = String(resp.error?.message || '').toLowerCase();
    if (!(msg.includes('column') && msg.includes('does not exist'))) break;
  }

  throw lastError || new Error('No se pudo cargar órdenes.');
}

async function fetchOrderItemsMap(orderIds) {
  if (!orderIds.length) return new Map();

  const itemsResp = await supabase
    .from('orden_items')
    .select('idorden,idproducto,qty,price_snapshot,modifiers')
    .in('idorden', orderIds);
  if (itemsResp.error) throw itemsResp.error;
  const orderItems = itemsResp.data || [];

  const productIds = [...new Set(orderItems.map((item) => item.idproducto).filter(Boolean))];
  const prodResp = productIds.length
    ? await supabase.from('productos').select('id,nombre').in('id', productIds)
    : { data: [], error: null };
  if (prodResp.error) throw prodResp.error;

  const productMap = new Map((prodResp.data || []).map((p) => [p.id, p]));
  const itemsByOrder = new Map();

  orderItems.forEach((item) => {
    const product = productMap.get(item.idproducto);
    const unit = Number(item.price_snapshot) || 0;
    const qty = Number(item.qty) || 1;
    const row = {
      nombre: product?.nombre || `Producto ${item.idproducto}`,
      qty,
      lineTotal: unit * qty,
      modifiers: item.modifiers || null,
    };
    const list = itemsByOrder.get(item.idorden) || [];
    list.push(row);
    itemsByOrder.set(item.idorden, list);
  });

  return itemsByOrder;
}

async function updateOrderStatus(orderId, nextStatus) {
  const payload = { status: nextStatus, updated_at: new Date().toISOString() };
  let resp = await supabase
    .from('ordenes')
    .update(payload)
    .eq('id', orderId)
    .eq('idcomercio', idComercio)
    .eq('order_type', 'pickup')
    .select('id,status')
    .maybeSingle();

  if (!resp.error) return true;

  const msg = String(resp.error?.message || '').toLowerCase();
  const missingSnakeCase = msg.includes('idcomercio') && msg.includes('does not exist');
  if (!missingSnakeCase) {
    if (msg.includes('updated_at') && msg.includes('does not exist')) {
      const retry = await supabase
        .from('ordenes')
        .update({ status: nextStatus })
        .eq('id', orderId)
        .select('id,status')
        .maybeSingle();
      if (!retry.error) return true;
      throw retry.error;
    }
    throw resp.error;
  }

  resp = await supabase
    .from('ordenes')
    .update(payload)
    .eq('id', orderId)
    .eq('idComercio', idComercio)
    .eq('order_type', 'pickup')
    .select('id,status')
    .maybeSingle();
  if (!resp.error) return true;

  const msg2 = String(resp.error?.message || '').toLowerCase();
  if (msg2.includes('updated_at') && msg2.includes('does not exist')) {
    const retry = await supabase
      .from('ordenes')
      .update({ status: nextStatus })
      .eq('id', orderId)
      .eq('idComercio', idComercio)
      .eq('order_type', 'pickup')
      .select('id,status')
      .maybeSingle();
    if (!retry.error) return true;
    throw retry.error;
  }

  throw resp.error;
}

async function loadOrders() {
  setLoading(true);
  try {
    const allOrders = await fetchOrdersForComercio();
    currentOrders = allOrders.filter((o) => isActiveStatus(o.status));
    currentItemsByOrder = await fetchOrderItemsMap(currentOrders.map((o) => o.id));
    renderOrders(getFilteredOrders(), currentItemsByOrder);
    updateLiveVisuals();
    updateAlarmByOrders();
  } catch (err) {
    console.error('Error cargando órdenes pickup', err);
    alert(`No se pudo cargar órdenes: ${err.message || err}`);
  } finally {
    setLoading(false);
  }
}

function setFilter(nextFilter) {
  const normalized = ['all', 'sent', 'preparing', 'ready'].includes(nextFilter) ? nextFilter : 'all';
  currentFilter = normalized;
  renderOrders(getFilteredOrders(), currentItemsByOrder);
  updateLiveVisuals();
}

function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => loadOrders(), 450);
}

function subscribeRealtime() {
  realtimeChannel = supabase
    .channel(`ordenes-pickup-${idComercio}-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ordenes' }, (payload) => {
      const row = payload?.new || payload?.old || {};
      const rowComercio = Number(row.idcomercio ?? row.idComercio ?? 0);
      if (rowComercio !== idComercio) return;
      scheduleReload();
    })
    .subscribe();
}

function bindEvents() {
  btnEnableSound?.addEventListener('click', unlockSound);
  btnRefreshOrders?.addEventListener('click', () => loadOrders());
  boxActivas?.addEventListener('click', () => setFilter('all'));
  boxEnviadas?.addEventListener('click', () => setFilter('sent'));
  boxPreparando?.addEventListener('click', () => setFilter('preparing'));
  boxTerminadas?.addEventListener('click', () => setFilter('ready'));

  ordersContainer?.addEventListener('click', async (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('[data-action="change-status"]')
      : null;
    if (!target) return;
    if (actionInFlight) return;

    const orderId = Number(target.getAttribute('data-order-id') || 0);
    const nextStatus = String(target.getAttribute('data-next-status') || '').trim();
    if (!orderId || !nextStatus) return;

    actionInFlight = true;
    const originalText = target.textContent;
    target.setAttribute('disabled', 'disabled');
    target.textContent = 'Actualizando...';

    try {
      await updateOrderStatus(orderId, nextStatus);
      await loadOrders();
    } catch (err) {
      console.error('No se pudo actualizar estado de orden', err);
      alert(`No se pudo actualizar estado: ${err.message || err}`);
      target.textContent = originalText || 'Reintentar';
      target.removeAttribute('disabled');
    } finally {
      actionInFlight = false;
    }
  });
}

async function init() {
  const access = await validateAccessOrRedirect();
  if (!access) return;

  setupAudioAutoUnlock();
  await unlockSound(true);
  bindEvents();
  await loadOrders();
  subscribeRealtime();

  timerInterval = setInterval(() => {
    updateLiveVisuals();
    updateAlarmByOrders();
  }, 1000);
  pollTimer = setInterval(() => loadOrders(), 15000);
}

window.addEventListener('beforeunload', () => {
  if (timerInterval) clearInterval(timerInterval);
  if (pollTimer) clearInterval(pollTimer);
  if (reloadTimer) clearTimeout(reloadTimer);
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  stopAlarm();
});

init();
