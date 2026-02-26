import { supabase } from '../shared/supabaseClient.js';
import { formatearTelefonoDisplay, formatearTelefonoHref, getPublicBase } from '../shared/utils.js';

const ORDER_HISTORY_KEY = 'findixi_orders';
const tabActivos = document.getElementById('tabActivos');
const tabPasados = document.getElementById('tabPasados');
const ordersContainer = document.getElementById('ordersContainer');
const ordersEmpty = document.getElementById('ordersEmpty');
const ordersLoading = document.getElementById('ordersLoading');
const btnRefresh = document.getElementById('btnRefresh');

const STATUS_ACTIVE = new Set([
  'pending',
  'sent',
  'open',
  'confirmed',
  'preparing',
  'ready',
  'paid',
]);
const STATUS_PAST = new Set([
  'cancelled',
  'canceled',
  'completed',
  'delivered',
  'refunded',
]);

const statusLabels = {
  pending: 'Recibida',
  sent: 'Recibida',
  open: 'Recibida',
  confirmed: 'Confirmada',
  preparing: 'En preparación',
  ready: 'Lista para recoger',
  paid: 'Pagada',
  delivered: 'Entregado',
  completed: 'Completada',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
  refunded: 'Reembolsada',
};

function normalizeStatus(status) {
  const raw = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  if (!raw) return 'pending';

  if (raw.includes('cancel')) return 'cancelled';
  if (raw.includes('refund') || raw.includes('reembols')) return 'refunded';
  if (raw.includes('deliver') || raw.includes('entreg')) return 'delivered';
  if (raw.includes('complete') || raw.includes('complet') || raw.includes('closed') || raw.includes('done')) return 'completed';
  if (raw.includes('ready') || raw.includes('list')) return 'ready';
  if (raw.includes('prepar')) return 'preparing';
  if (raw.includes('confirm')) return 'confirmed';
  if (raw.includes('paid') || raw.includes('pagad')) return 'paid';
  if (raw.includes('open') || raw.includes('sent') || raw.includes('pending') || raw.includes('recib')) return 'pending';

  return raw;
}

function getStatusLabel(status) {
  const normalized = normalizeStatus(status);
  if (statusLabels[normalized]) return statusLabels[normalized];

  const raw = String(status || '').trim();
  if (!raw) return 'En proceso';

  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function loadOrderHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        if (typeof item === 'number' || typeof item === 'string') return { id: Number(item) };
        return item && typeof item === 'object' ? item : null;
      })
      .filter((item) => item && Number.isFinite(Number(item.id)));
  } catch {
    return [];
  }
}

function getTokenParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token') || '';
}

async function fetchOrdersByToken(token) {
  if (!token) return [];
  const { data, error } = await supabase
    .from('ordenes')
    .select('id, idcomercio, clover_order_id, checkout_url, total, status, created_at, order_type, mesa, source, order_link_expires_at')
    .eq('order_link_token', token)
    .maybeSingle();
  if (error || !data) return [];
  const expired = data.order_link_expires_at && new Date(data.order_link_expires_at).getTime() < Date.now();
  const status = normalizeStatus(data.status);
  if (expired || STATUS_PAST.has(status)) {
    return [{ ...data, link_expired: true }];
  }
  return [data];
}

async function fetchOrdersByEmail(email) {
  if (!email) return [];
  const { data, error } = await supabase
    .from('ordenes')
    .select('id, idcomercio, clover_order_id, checkout_url, total, status, created_at, order_type, mesa, source')
    .eq('customer_email', email)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

async function fetchOrdersByUserId(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('ordenes')
    .select('id, idcomercio, clover_order_id, checkout_url, total, status, created_at, order_type, mesa, source')
    .eq('customer_user_id', userId)
    .order('created_at', { ascending: false });

  if (!error && data) return data;

  const msg = String(error?.message || '').toLowerCase();
  const missingCol = msg.includes('customer_user_id') && msg.includes('does not exist');
  if (missingCol) return [];
  return [];
}

function setLoading(isLoading) {
  if (ordersLoading) {
    ordersLoading.classList.toggle('hidden', !isLoading);
  }
}

function setEmpty(isEmpty) {
  if (ordersEmpty) {
    ordersEmpty.classList.toggle('hidden', !isEmpty);
  }
}

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-PR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusToStep(status) {
  const s = normalizeStatus(status);
  if (STATUS_PAST.has(s)) return 3;
  if (s === 'ready') return 3;
  if (s === 'preparing') return 2;
  if (s === 'confirmed') return 2;
  return 1;
}

function isActiveStatus(status) {
  const s = normalizeStatus(status);
  if (STATUS_PAST.has(s)) return false;
  if (STATUS_ACTIVE.has(s)) return true;
  return true;
}

function buildMapsUrl(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

function buildWazeUrl(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
}

function resolveLogoUrl(rawValue) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  return getPublicBase(`galeriacomercios/${raw}`);
}

function buildOrderCard(order, commerce, items) {
  const status = normalizeStatus(order.status);
  const isActiveOrder = isActiveStatus(status);
  const step = statusToStep(status);
  const statusLabel = getStatusLabel(order.status);
  const created = formatDate(order.created_at || order.created_at_local);
  const total = Number(order.total) || items.reduce((sum, item) => sum + item.lineTotal, 0);
  const lat = Number(commerce?.latitud);
  const lon = Number(commerce?.longitud);
  const mapUrl = buildMapsUrl(lat, lon);
  const wazeUrl = buildWazeUrl(lat, lon);
  const telefonoDisplay = commerce?.telefono ? formatearTelefonoDisplay(commerce.telefono) : '';
  const telefonoHref = commerce?.telefono ? formatearTelefonoHref(commerce.telefono) : '';

  const card = document.createElement('article');
  card.className = 'order-card bg-white rounded-3xl overflow-hidden';

  const logoUrl = commerce?.logoUrl;
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${commerce?.nombre || 'Comercio'}" class="w-full h-full object-contain">`
    : `<div class="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-medium">Sin logo</div>`;

  const itemsHtml = items.map((item) => {
    const mods = item.modifiers?.items || [];
    const grouped = new Map();
    mods.forEach((m) => {
      const group = (m.grupo || m.grupo_nombre || 'Opciones').trim();
      const list = grouped.get(group) || [];
      list.push(m);
      grouped.set(group, list);
    });
    const modsHtml = Array.from(grouped.entries()).map(([group, list]) => {
      const lines = list.map((m) => {
        const extra = Number(m.precio_extra);
        const extraLabel = Number.isFinite(extra) && extra > 0 ? ` (+$${extra.toFixed(2)})` : '';
        return `• ${m.nombre || 'Opción'}${extraLabel}`;
      }).join('<br>');
      return `
        <div class="text-xs text-gray-500">
          <span class="font-medium text-gray-600">${group}:</span><br>${lines}
        </div>
      `;
    }).join('');
    const noteHtml = item.modifiers?.nota ? `<div class="text-sm font-medium text-gray-500">Nota: ${item.modifiers.nota}</div>` : '';
    return `
      <div class="flex justify-between gap-2">
        <div class="text-left">
          <div class="text-base font-medium text-slate-800">${item.nombre}</div>
          ${modsHtml}
          ${noteHtml}
        </div>
        <div class="text-base font-medium text-slate-800">${formatMoney(item.lineTotal)}</div>
      </div>
    `;
  }).join('');

  const steps = [
    { icon: 'fa-circle-check', label: 'Confirmado' },
    { icon: 'fa-kitchen-set', label: 'En preparación' },
    { icon: 'fa-bag-shopping', label: 'Lista para recoger' },
  ];

  const stepPieces = steps.map((s, index) => {
    const active = step >= index + 1;
    const iconClass = active ? 'text-green-600' : 'text-gray-400';
    const textClass = active ? 'text-green-700' : 'text-gray-500';
    const circleClass = active ? 'bg-green-100 border-green-200' : 'bg-gray-100 border-gray-200';
    return `
      <div class="flex flex-col items-center text-center gap-2">
        <div class="w-11 h-11 rounded-full border ${circleClass} flex items-center justify-center">
          <i class="fa-solid ${s.icon} ${iconClass}"></i>
        </div>
        <div class="text-xs font-medium leading-tight ${textClass}">${s.label}</div>
      </div>
    `;
  });
  const stepsHtml = stepPieces
    .map((piece, index) => {
      if (index === stepPieces.length - 1) return piece;
      const active = step >= index + 2;
      const arrowClass = active ? 'text-green-400' : 'text-gray-300';
      return `
        ${piece}
        <div class="flex items-center justify-center ${arrowClass} text-xs px-1">
          <i class="fa-solid fa-chevron-right"></i>
          <i class="fa-solid fa-chevron-right"></i>
          <i class="fa-solid fa-chevron-right"></i>
        </div>
      `;
    })
    .join('');

  const detailsId = `order-details-${order.id}`;
  const mapsActionsHtml = (mapUrl || wazeUrl)
    ? `
      <div class="flex justify-center gap-3">
        ${mapUrl ? `<a href="${mapUrl}" target="_blank" class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm hover:bg-slate-50 transition">
          <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios//google%20map.jpg" alt="Google Maps" class="rounded-full h-7">
        </a>` : ''}
        ${wazeUrl ? `<a href="${wazeUrl}" target="_blank" class="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm hover:bg-slate-50 transition">
          <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios//waze.jpg" alt="Waze" class="rounded-full h-7">
        </a>` : ''}
      </div>
    `
    : '';
  const finalStatusText = status === 'delivered' ? 'Orden Entregada' : `Orden ${statusLabel}`;
  const compactStatusText = status === 'delivered' ? 'Orden Entregada' : `Último status: ${statusLabel}`;
  const orderStatusHtml = isActiveOrder
    ? `
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3">
          <div class="text-sm font-medium text-slate-700 text-center">Status de la orden</div>
          <div class="flex items-center justify-center gap-2">${stepsHtml}</div>
        </div>
      `
    : `
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <p class="text-sm font-medium text-emerald-700 text-center">${finalStatusText}</p>
        </div>
      `;

  card.innerHTML = `
    <button type="button" data-order-toggle aria-expanded="false" aria-controls="${detailsId}" class="w-full px-4 py-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition">
      <div class="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 bg-white p-1 flex-shrink-0">${logoHtml}</div>
      <div class="flex-1 min-w-0">
        <p class="text-base font-medium text-slate-800 truncate">${commerce?.nombre || 'Comercio'}</p>
        <p class="text-sm font-medium text-slate-500 truncate">${created || 'Fecha no disponible'}</p>
        <p class="text-sm font-medium text-slate-600 truncate">${compactStatusText}</p>
      </div>
      <div class="text-right flex-shrink-0 pl-2">
        <p class="text-xs font-medium text-slate-500">Total</p>
        <p class="text-base font-semibold text-slate-900">${formatMoney(total)}</p>
        <i data-order-chevron class="fa-solid fa-chevron-down text-xs text-slate-400 mt-1 transition-transform duration-200"></i>
      </div>
    </button>

    <div id="${detailsId}" data-order-details class="hidden px-4 pb-4">
      <div class="pt-4 border-t border-slate-100 space-y-4">
        ${telefonoDisplay ? `
          <div class="flex justify-center">
            <a href="${telefonoHref}" class="inline-flex items-center justify-center gap-2 text-white text-base font-medium bg-red-600 rounded-full px-6 py-2 shadow hover:bg-red-700 transition">
              <i class="fa-solid fa-phone text-base"></i> ${telefonoDisplay}
            </a>
          </div>` : ''}

        <div class="flex flex-col items-center text-center gap-2">
          ${order.order_type === 'mesa' && order.mesa ? `<div class="text-sm font-medium text-slate-500">Mesa ${order.mesa}</div>` : ''}
          ${commerce?.direccion ? `<div class="inline-flex items-center justify-center gap-2 text-sky-700 font-medium text-sm leading-snug"><i class="fas fa-map-pin"></i> ${commerce.direccion}</div>` : ''}
          ${mapsActionsHtml}
        </div>

        ${orderStatusHtml}

        <div class="rounded-2xl border border-slate-200 p-3 space-y-3">
          <div class="text-sm font-medium text-slate-700 text-center">Resumen del pedido</div>
          ${itemsHtml || '<div class="text-sm font-medium text-gray-400 text-center">Sin detalles de items.</div>'}
          <div class="flex items-center justify-between text-base font-medium pt-2 border-t border-slate-100">
            <span class="text-slate-700">Total</span>
            <span class="text-slate-900">${formatMoney(total)}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const toggleBtn = card.querySelector('[data-order-toggle]');
  const detailsEl = card.querySelector('[data-order-details]');
  const chevronEl = card.querySelector('[data-order-chevron]');

  toggleBtn?.addEventListener('click', () => {
    if (!detailsEl) return;
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
    detailsEl.classList.toggle('hidden', isExpanded);
    chevronEl?.classList.toggle('rotate-180', !isExpanded);
  });

  return card;
}

async function loadOrders() {
  setLoading(true);
  setEmpty(false);
  if (ordersContainer) ordersContainer.innerHTML = '';

  const token = getTokenParam();
  let orders = [];
  if (token) {
    orders = await fetchOrdersByToken(token);
  }

  if (!orders.length) {
    const history = loadOrderHistory();
    const orderIds = history.map((h) => Number(h.id)).filter((id) => Number.isFinite(id));
    if (orderIds.length) {
      const resp = await supabase
        .from('ordenes')
        .select('id, idcomercio, clover_order_id, checkout_url, total, status, created_at, order_type, mesa, source')
        .in('id', orderIds)
        .order('created_at', { ascending: false });
      if (!resp.error && resp.data) {
        orders = resp.data;
      }
    }
  }

  if (!orders.length) {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || '';
    const userEmail = user?.email || '';
    if (userId) {
      orders = await fetchOrdersByUserId(userId);
    }
    if (!orders.length && userEmail) {
      orders = await fetchOrdersByEmail(userEmail);
    }
  }

  if (!orders.length) {
    setLoading(false);
    setEmpty(true);
    return;
  }

  const comercioIds = [...new Set(orders.map((o) => o.idcomercio).filter(Boolean))];
  const { data: comercios } = await supabase
    .from('Comercios')
    .select('id, nombre, direccion, telefono, latitud, longitud, logo')
    .in('id', comercioIds);

  const comercioLogoMap = new Map();
  if (comercioIds.length) {
    const { data: logosData } = await supabase
      .from('imagenesComercios')
      .select('idComercio, imagen')
      .in('idComercio', comercioIds)
      .eq('logo', true);

    (logosData || []).forEach((entry) => {
      comercioLogoMap.set(entry.idComercio, resolveLogoUrl(entry.imagen));
    });
  }

  const comercioMap = new Map();
  (comercios || []).forEach((c) => {
    let logoUrl = null;
    if (c.logo) {
      logoUrl = resolveLogoUrl(c.logo);
    } else if (comercioLogoMap.has(c.id)) {
      logoUrl = comercioLogoMap.get(c.id);
    }
    comercioMap.set(c.id, { ...c, logoUrl });
  });

  const { data: orderItems } = await supabase
    .from('orden_items')
    .select('idorden, idproducto, qty, price_snapshot, modifiers')
    .in('idorden', orders.map((o) => o.id));

  const productIds = [...new Set((orderItems || []).map((i) => i.idproducto).filter(Boolean))];
  const { data: products } = await supabase
    .from('productos')
    .select('id, nombre, imagen')
    .in('id', productIds);

  const productMap = new Map();
  (products || []).forEach((p) => productMap.set(p.id, p));

  const itemsByOrder = new Map();
  (orderItems || []).forEach((item) => {
    const list = itemsByOrder.get(item.idorden) || [];
    const product = productMap.get(item.idproducto);
    const unitPrice = Number(item.price_snapshot) || 0;
    const qty = Number(item.qty) || 0;
    list.push({
      nombre: product?.nombre || `Producto ${item.idproducto}`,
      lineTotal: unitPrice * qty,
      modifiers: item.modifiers || null,
    });
    itemsByOrder.set(item.idorden, list);
  });

  const currentTab = getCurrentTab();
  const filtered = orders.filter((order) => {
    const active = isActiveStatus(order.status);
    return currentTab === 'activos' ? active : !active;
  });

  if (!filtered.length) {
    setLoading(false);
    setEmpty(true);
    return;
  }

  filtered.forEach((order) => {
    const commerce = comercioMap.get(order.idcomercio) || {};
    const items = itemsByOrder.get(order.id) || [];
    const card = buildOrderCard(order, commerce, items);
    if (order.link_expired) {
      const msg = document.createElement('div');
      msg.className = 'text-xs text-red-500 font-semibold mt-2';
      msg.textContent = 'Este enlace de pedido ya expiró.';
      card.appendChild(msg);
    }
    ordersContainer.appendChild(card);
  });

  setLoading(false);
}

function setActiveTab(tab) {
  const setTabState = (btn, isActive) => {
    if (!btn) return;
    btn.classList.toggle('bg-white', isActive);
    btn.classList.toggle('shadow-sm', isActive);
    btn.classList.toggle('border-slate-200', isActive);
    btn.classList.toggle('text-slate-900', isActive);
    btn.classList.toggle('bg-transparent', !isActive);
    btn.classList.toggle('border-transparent', !isActive);
    btn.classList.toggle('text-gray-500', !isActive);
  };

  setTabState(tabActivos, tab === 'activos');
  setTabState(tabPasados, tab === 'pasados');
}

function getCurrentTab() {
  const params = new URLSearchParams(window.location.search);
  return params.get('tab') === 'pasados' ? 'pasados' : 'activos';
}

function updateTab(tab) {
  const params = new URLSearchParams(window.location.search);
  params.set('tab', tab);
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', next);
  setActiveTab(tab);
  loadOrders();
}

tabActivos?.addEventListener('click', () => updateTab('activos'));
tabPasados?.addEventListener('click', () => updateTab('pasados'));
btnRefresh?.addEventListener('click', loadOrders);

setActiveTab(getCurrentTab());
loadOrders();
