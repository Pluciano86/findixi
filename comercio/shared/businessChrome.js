import { supabase } from './supabaseClient.js';
import { resolverCtaPrincipalComercio } from './utils.js';

const BUSINESS_LOGO_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/FindixiBusiness.png';
const DEFAULT_PRIMARY = {
  profileType: 'menu',
  label: 'Menu',
};
const SELECT_COMERCIO_BASE = 'id, categoria';
let categoriasProfilePromise = null;
const RESTAURANTE_KEYWORDS = [
  'restaurante',
  'restaurantes',
  'restaurant',
  'restaurants',
  'restaurantes y jangueo',
  'comida',
  'food',
  'cafe',
  'cafeteria',
  'bar',
  'panaderia',
  'pizzeria',
  'pizza',
  'burger',
  'taco',
  'sushi',
];
const JANGUEO_KEYWORDS = [
  'jangueo',
  'jangueos',
  'night',
  'nightlife',
  'discoteca',
  'club',
  'lounge',
  'pub',
  'cocktail',
  'coctel',
  'barra',
];
const BEAUTY_KEYWORDS = [
  'beauty',
  'belleza',
  'barber',
  'barberia',
  'salon',
  'studio',
  'estudio',
  'spa',
  'nails',
  'unas',
  'estetica',
  'cosmetica',
  'maquillaje',
];
const FASHION_KEYWORDS = [
  'ropa',
  'accesorio',
  'accesorios',
  'moda',
  'boutique',
  'fashion',
  'zapateria',
  'joyeria',
  'cartera',
  'carteras',
];

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function addStylesOnce() {
  if (document.getElementById('fx-business-chrome-styles')) return;

  const style = document.createElement('style');
  style.id = 'fx-business-chrome-styles';
  style.textContent = `
    body.fx-business-shell {
      padding-top: 84px;
      padding-bottom: 84px;
    }
    body.fx-business-shell.fx-business-shell-no-footer {
      padding-bottom: 16px;
    }
    .fx-business-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 40;
      background: #023047;
      border-bottom: 3px solid #EC7F25;
      color: #fff;
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
    }
    .fx-business-logo {
      width: 210px;
      height: 52px;
      object-fit: contain;
      max-width: calc(100vw - 180px);
    }
    .fx-business-header-btn {
      position: absolute;
      top: 0;
      bottom: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      color: #fff;
      border: 0;
      background: transparent;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      text-decoration: none;
    }
    .fx-business-header-btn.back {
      left: 12px;
      font-size: 24px;
      line-height: 1;
      font-weight: 700;
    }
    .fx-business-header-btn.logout {
      right: 14px;
      font-size: 13px;
      line-height: 1;
    }
    .fx-business-footer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      background: #023047;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding: 8px 12px 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    .fx-business-nav-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      min-width: 96px;
      padding: 0 10px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      color: #e2e8f0;
      background: rgba(255, 255, 255, 0.08);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
      border-top-color: rgba(255, 255, 255, 0.55);
      border-left-color: rgba(255, 255, 255, 0.55);
      border-bottom-color: rgba(2, 6, 23, 0.45);
      border-right-color: rgba(2, 6, 23, 0.45);
      box-shadow: 0 2px 2px rgba(2, 6, 23, 0.2);
      transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease;
    }
    .fx-business-nav-btn:active {
      transform: translateY(1px);
      border-top-color: #b45309;
      border-left-color: #b45309;
      border-bottom-color: #fdba74;
      border-right-color: #fdba74;
    }
    .fx-business-nav-btn.active {
      border-color: #EC7F25;
      background: #EC7F25;
      color: #fff;
      font-weight: 600;
      box-shadow: none;
    }
    .fx-business-nav-btn.disabled {
      opacity: 0.7;
      cursor: not-allowed;
      box-shadow: none;
      transform: none !important;
    }
    .fx-business-footer.compact .fx-business-nav-btn {
      width: 31%;
      min-width: 92px;
    }
    @media (min-width: 760px) {
      .fx-business-footer.compact .fx-business-nav-btn {
        width: calc(16.666% - 8px);
        min-width: 128px;
      }
    }
  `;
  document.head.appendChild(style);
}

function withBasePath(basePath = '.', fileName = '', idComercio = 0) {
  const base = String(basePath || '.').replace(/\/+$/, '') || '.';
  const id = Number(idComercio);
  const prefix = base === '.' ? './' : `${base}/`;
  const suffix = Number.isFinite(id) && id > 0 ? `?id=${id}` : '';
  return `${prefix}${String(fileName || '').replace(/^\/+/, '')}${suffix}`;
}

function parseCategoriaTokens(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => parseCategoriaTokens(item));
  if (typeof value === 'object') {
    const id = Number(value?.id);
    if (Number.isFinite(id) && id > 0) return [String(id)];
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

function isMissingColumnError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

async function fetchCategoriasProfileMap() {
  if (!categoriasProfilePromise) {
    categoriasProfilePromise = (async () => {
      const byIdType = new Map();
      const byNameType = new Map();
      const byIdName = new Map();
      const attempts = [
        { select: 'id, nombre, tipo_perfil', hasTipoPerfil: true },
        { select: 'id, nombre', hasTipoPerfil: false },
      ];

      for (const attempt of attempts) {
        const { data, error } = await supabase.from('Categorias').select(attempt.select);
        if (error) {
          if (isMissingColumnError(error)) continue;
          return { byIdType, byNameType, byIdName };
        }

        (Array.isArray(data) ? data : []).forEach((row) => {
          const id = Number(row?.id);
          const nombre = String(row?.nombre || '').trim();
          const tipo = attempt.hasTipoPerfil ? normalizeText(row?.tipo_perfil) : '';
          if (Number.isFinite(id) && id > 0 && nombre) byIdName.set(id, normalizeText(nombre));
          if (!['menu', 'servicios', 'tienda'].includes(tipo)) return;
          if (Number.isFinite(id) && id > 0) byIdType.set(id, tipo);
          if (nombre) byNameType.set(normalizeText(nombre), tipo);
        });
        return { byIdType, byNameType, byIdName };
      }

      return { byIdType, byNameType, byIdName };
    })();
  }
  return categoriasProfilePromise;
}

async function fetchComercioLite(idComercio) {
  const id = Number(idComercio);
  if (!Number.isFinite(id) || id <= 0) return null;

  const attempts = [
    `${SELECT_COMERCIO_BASE}, nombre, idCategoria, idcategoria, categorias, subCategorias, tipo_perfil, tiendaFisica, tiendaOnline`,
    `${SELECT_COMERCIO_BASE}, nombre, idCategoria, idcategoria, categorias, subCategorias, tipo_perfil`,
    `${SELECT_COMERCIO_BASE}, nombre, idCategoria, idcategoria, categorias, subCategorias`,
    `${SELECT_COMERCIO_BASE}, nombre, idCategoria, idcategoria`,
    `${SELECT_COMERCIO_BASE}, nombre, idCategoria`,
    `${SELECT_COMERCIO_BASE}, nombre, idcategoria`,
    `${SELECT_COMERCIO_BASE}, nombre`,
    SELECT_COMERCIO_BASE,
  ];

  for (const selectExpr of attempts) {
    const { data, error } = await supabase.from('Comercios').select(selectExpr).eq('id', id).maybeSingle();
    if (!error) return data || null;
    if (!isMissingColumnError(error)) return null;
  }

  return null;
}

function resolveCategoryProfileTypes(comercio = null, categoriasMap = { byIdType: new Map(), byNameType: new Map() }) {
  if (!comercio) return [];
  const tokens = [
    ...parseCategoriaTokens(comercio?.idCategoria),
    ...parseCategoriaTokens(comercio?.idcategoria),
    ...parseCategoriaTokens(comercio?.categoria),
    ...parseCategoriaTokens(comercio?.categorias),
    ...parseCategoriaTokens(comercio?.subCategorias),
    ...parseCategoriaTokens(comercio?.nombre),
  ];

  const profileTypes = [];
  tokens.forEach((token) => {
    const asNumber = Number(token);
    if (Number.isFinite(asNumber) && categoriasMap.byIdType.has(asNumber)) {
      profileTypes.push(categoriasMap.byIdType.get(asNumber));
      return;
    }
    const typeByName = categoriasMap.byNameType.get(normalizeText(token));
    if (typeByName) profileTypes.push(typeByName);
  });

  return Array.from(new Set(profileTypes.filter((item) => ['menu', 'servicios', 'tienda'].includes(item))));
}

function resolveCategorySignals(comercio = null, categoriasMap = { byIdName: new Map() }) {
  if (!comercio) {
    return {
      isRestaurantOrJangueo: false,
      isBeauty: false,
      isFashion: false,
    };
  }

  const tokens = [
    ...parseCategoriaTokens(comercio?.idCategoria),
    ...parseCategoriaTokens(comercio?.idcategoria),
    ...parseCategoriaTokens(comercio?.categoria),
    ...parseCategoriaTokens(comercio?.categorias),
    ...parseCategoriaTokens(comercio?.subCategorias),
    ...parseCategoriaTokens(comercio?.nombre),
  ];

  const normalizedTokens = [];
  tokens.forEach((token) => {
    const normalized = normalizeText(token);
    if (normalized) normalizedTokens.push(normalized);
    const asNumber = Number(token);
    if (Number.isFinite(asNumber) && categoriasMap.byIdName.has(asNumber)) {
      normalizedTokens.push(categoriasMap.byIdName.get(asNumber));
    }
  });

  const allText = normalizedTokens.join(' ');
  const hasAny = (keywords = []) => keywords.some((term) => allText.includes(term));

  const isRestaurantOrJangueo = hasAny(RESTAURANTE_KEYWORDS) || hasAny(JANGUEO_KEYWORDS);
  const isBeauty = hasAny(BEAUTY_KEYWORDS);
  const isFashion = hasAny(FASHION_KEYWORDS);

  return {
    isRestaurantOrJangueo,
    isBeauty,
    isFashion,
  };
}

async function resolvePrimaryCta({ idComercio = 0, basePath = '.' } = {}) {
  const id = Number(idComercio);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      ...DEFAULT_PRIMARY,
      href: withBasePath(basePath, 'adminMenuComercio.html', 0),
      isRestaurantOrJangueo: false,
      isBeauty: false,
      isFashion: false,
    };
  }

  const [comercio, categoriasMap] = await Promise.all([fetchComercioLite(id), fetchCategoriasProfileMap()]);
  const categoryProfileTypes = resolveCategoryProfileTypes(comercio, categoriasMap);
  const categorySignals = resolveCategorySignals(comercio, categoriasMap);
  const resolved = resolverCtaPrincipalComercio(comercio || { id }, { idComercio: id, categoryProfileTypes });
  let profileType = ['menu', 'servicios', 'tienda'].includes(resolved?.profileType) ? resolved.profileType : 'menu';
  if (profileType === 'menu' && categorySignals.isBeauty) profileType = 'servicios';
  if (profileType === 'menu' && categorySignals.isFashion) profileType = 'tienda';
  const label = String(resolved?.label || DEFAULT_PRIMARY.label);

  if (profileType === 'servicios') {
    return {
      profileType,
      label,
      href: withBasePath(basePath, 'staffServicios.html', id),
      ...categorySignals,
    };
  }

  if (profileType === 'tienda') {
    return {
      profileType,
      label,
      href: withBasePath(basePath, 'editarPerfilComercio.html', id),
      ...categorySignals,
    };
  }

  return {
    profileType: 'menu',
    label,
    href: withBasePath(basePath, 'adminMenuComercio.html', id),
    ...categorySignals,
  };
}

function buildNavItems({ idComercio = 0, basePath = '.', primaryCta, active = '' }) {
  const profileType = String(primaryCta?.profileType || 'menu');
  const isRestaurantOrJangueo = primaryCta?.isRestaurantOrJangueo === true;
  const isFashion = primaryCta?.isFashion === true;
  const isServicesMode = profileType === 'servicios';
  const isFashionStore = profileType === 'tienda' && isFashion;
  const showSpecials = isRestaurantOrJangueo || profileType === 'menu';

  const primaryLabel =
    profileType === 'servicios'
      ? 'Staff'
      : profileType === 'tienda'
        ? 'Tienda'
        : String(primaryCta?.label || DEFAULT_PRIMARY.label);
  const primaryHref =
    profileType === 'servicios'
      ? `${withBasePath(basePath, 'staffServicios.html', idComercio)}#staff`
      : profileType === 'tienda'
        ? withBasePath(basePath, 'editarPerfilComercio.html', idComercio)
        : String(primaryCta?.href || withBasePath(basePath, 'adminMenuComercio.html', idComercio));

  const ordersLabel = isServicesMode ? 'Citas' : 'Pedidos';
  const ordersHref = isServicesMode
    ? `${withBasePath(basePath, 'staffServicios.html', idComercio)}#citas`
    : withBasePath(basePath, 'ordenesPickup.html', idComercio);

  const navItems = [
    { key: 'stats', label: 'Estadísticas', href: withBasePath(basePath, 'estadisticas.html', idComercio) },
    ...(isFashionStore ? [] : [{ key: 'orders', label: ordersLabel, href: ordersHref }]),
    { key: 'profile', label: 'Perfil', href: withBasePath(basePath, 'editarPerfilComercio.html', idComercio) },
    { key: 'primary', label: primaryLabel, href: primaryHref },
    ...(showSpecials
      ? [{ key: 'specials', label: 'Especiales', href: withBasePath(basePath, 'especiales/adminEspeciales.html', idComercio) }]
      : []),
    { key: 'today', label: 'Lo de Hoy', href: withBasePath(basePath, 'publicacionesHoy.html', idComercio) },
  ];

  const activeKey = String(active || '').trim();
  return navItems.map((item) => ({ ...item, active: item.key === activeKey }));
}

function mountHeader({ basePath = '.', title = '', showBack = true } = {}) {
  const host = document.getElementById('businessChromeHeader');
  if (!host) return;

  const fallbackHref = withBasePath(basePath, 'index.html');
  host.innerHTML = `
    <header class="fx-business-header">
      ${
        showBack
          ? `<button type="button" class="fx-business-header-btn back" id="fxBusinessBackBtn" aria-label="Volver">←</button>`
          : ''
      }
      <img src="${BUSINESS_LOGO_URL}" alt="Findixi Business" class="fx-business-logo" />
      <button type="button" class="fx-business-header-btn logout" id="fxBusinessLogoutBtn">Cerrar sesión</button>
    </header>
  `;

  const backBtn = document.getElementById('fxBusinessBackBtn');
  const logoutBtn = document.getElementById('fxBusinessLogoutBtn');

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = fallbackHref;
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await supabase.auth.signOut();
      } catch (_error) {
        // noop
      }
      window.location.href = withBasePath(basePath, 'login.html');
    });
  }

  if (title) {
    document.title = String(title).trim();
  }
}

function mountFooter(navItems = []) {
  const host = document.getElementById('businessChromeFooter');
  if (!host) return;
  const compact = Array.isArray(navItems) && navItems.length > 3;

  host.innerHTML = `
    <nav class="fx-business-footer${compact ? ' compact' : ''}">
      ${navItems
        .map(
          (item) =>
            item?.disabled
              ? `<button type="button" class="fx-business-nav-btn disabled" data-key="${item.key}" aria-disabled="true" title="Coming soon">${item.label}</button>`
              : `<a href="${item.href}" class="fx-business-nav-btn${item.active ? ' active' : ''}" data-key="${item.key}">${item.label}</a>`
        )
        .join('')}
    </nav>
  `;
}

export async function renderBusinessChrome({
  active = '',
  idComercio = 0,
  basePath = '.',
  title = '',
  showBack = true,
  showFooter = true,
} = {}) {
  addStylesOnce();
  document.body.classList.add('fx-business-shell');
  document.body.classList.toggle('fx-business-shell-no-footer', !showFooter);

  const primaryCta = await resolvePrimaryCta({ idComercio, basePath });
  const navItems = buildNavItems({ idComercio, basePath, primaryCta, active });

  mountHeader({ basePath, title, showBack });
  if (showFooter) {
    mountFooter(navItems);
  } else {
    const host = document.getElementById('businessChromeFooter');
    if (host) host.innerHTML = '';
  }

  return { primaryCta, navItems };
}
