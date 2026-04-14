import { resolvePath, applyResolvedPaths } from '../shared/pathResolver.js';
import { supabase } from '../shared/supabaseClient.js';

const USER_PLACEHOLDER = 'https://placehold.co/64x64?text=U';
const SUPABASE_PUBLIC_STORAGE = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/galeriacomercios/';

async function fetchHeaderTemplate() {
  const response = await fetch('./shared/adminHeader.html');
  if (!response.ok) {
    throw new Error(`No se pudo cargar el header (${response.status})`);
  }
  return response.text();
}

export async function loadAdminHeader(containerId = 'headerContainer') {
  const container = document.getElementById(containerId);
  if (!container) return;

  try {
    const html = await fetchHeaderTemplate();
    container.innerHTML = html;
  } catch (error) {
    console.error('Error cargando el header de administración:', error);
    return;
  }

  applyResolvedPaths(container);
  markActiveSidebarLink(container);
  hydrateSidebarUser(container).catch((error) => {
    console.warn('No se pudo cargar el usuario en sidebar:', error);
  });

  const toggleBtn = container.querySelector('#menuToggle');
  const sidebar = container.querySelector('#adminSidebar');
  const overlay = container.querySelector('#sidebarOverlay');
  const desktopQuery = window.matchMedia('(min-width: 1024px)');

  if (toggleBtn && sidebar && overlay) {
    let closeTimer = null;

    const isDesktop = () => desktopQuery.matches;
    const isOpen = () => document.body.classList.contains('admin-sidebar-open');

    const syncVisibility = () => {
      const open = isOpen();
      overlay.classList.toggle('hidden', !open || isDesktop());
      sidebar.setAttribute('aria-hidden', open ? 'false' : 'true');
    };

    const openSidebar = () => {
      document.body.classList.add('admin-sidebar-open');
      syncVisibility();
    };

    const closeSidebar = () => {
      document.body.classList.remove('admin-sidebar-open');
      syncVisibility();
    };

    const toggleSidebar = () => {
      if (isOpen()) closeSidebar();
      else openSidebar();
    };

    const queueClose = () => {
      if (!isDesktop()) return;
      if (!isOpen()) return;
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => closeSidebar(), 180);
    };

    const cancelClose = () => {
      window.clearTimeout(closeTimer);
    };

    const openOnHover = () => {
      if (!isDesktop()) return;
      cancelClose();
      openSidebar();
    };

    toggleBtn.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', closeSidebar);
    sidebar.addEventListener('mouseenter', openOnHover);
    sidebar.addEventListener('mouseleave', queueClose);

    // Cerrar el sidebar al navegar mediante enlaces.
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeSidebar);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSidebar();
    });

    const syncByViewport = () => {
      closeSidebar();
      syncVisibility();
    };

    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', syncByViewport);
    } else if (typeof desktopQuery.addListener === 'function') {
      desktopQuery.addListener(syncByViewport);
    }

    syncVisibility();
  }

  // Asegurar que otros elementos con data-resolve-path en el documento también se actualicen.
  applyResolvedPaths(document);
}

function normalizePathname(pathname) {
  let value = String(pathname || '').trim().toLowerCase();
  if (!value) return '/';
  value = value.split('?')[0].split('#')[0];
  if (!value.startsWith('/')) value = `/${value}`;
  value = value.replace(/\/+/g, '/');
  if (value.endsWith('/admin')) value = `${value}/index.html`;
  if (value.endsWith('/')) value = `${value}index.html`;
  return value;
}

function pageKey(pathname) {
  const normalized = normalizePathname(pathname);
  const last = normalized.split('/').filter(Boolean).pop() || 'index.html';
  return last.replace(/\.html$/i, '');
}

function markActiveSidebarLink(container) {
  const links = Array.from(container.querySelectorAll('a[data-sidebar-link]'));
  if (!links.length) return;

  const currentPath = normalizePathname(window.location.pathname);
  const currentKey = pageKey(currentPath);

  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') {
      link.classList.remove('is-active');
      return;
    }

    let targetPath = '';
    try {
      targetPath = normalizePathname(new URL(href, window.location.origin).pathname);
    } catch (_error) {
      link.classList.remove('is-active');
      return;
    }

    const targetKey = pageKey(targetPath);
    const isActive = currentPath === targetPath || currentKey === targetKey;
    link.classList.toggle('is-active', isActive);
  });
}

function resolveUserImagePath(imageValue) {
  const raw = String(imageValue || '').trim();
  if (!raw) return USER_PLACEHOLDER;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${SUPABASE_PUBLIC_STORAGE}${raw}`;
}

async function hydrateSidebarUser(container) {
  const photoEl = container.querySelector('#sidebarUserPhoto');
  const nameEl = container.querySelector('#sidebarUserName');
  const roleEl = container.querySelector('#sidebarUserRole');
  if (!photoEl || !nameEl || !roleEl) return;

  photoEl.src = USER_PLACEHOLDER;
  nameEl.textContent = 'Usuario';
  roleEl.textContent = 'Sin sesión';

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const user = authData?.user;
  if (!user) return;

  let displayName = String(user.user_metadata?.full_name || '').trim() || (user.email || 'Usuario');
  let displayRole = String(user.user_metadata?.rol_app || user.app_metadata?.rol_app || '').trim() || 'Admin';
  let image = String(user.user_metadata?.avatar_url || '').trim();

  const { data: profile, error: profileError } = await supabase
    .from('usuarios')
    .select('nombre, apellido, imagen, rol_app')
    .eq('id', user.id)
    .maybeSingle();

  if (!profileError && profile) {
    const fullName = `${profile.nombre || ''} ${profile.apellido || ''}`.trim();
    if (fullName) displayName = fullName;
    if (profile.rol_app) displayRole = String(profile.rol_app).trim();
    if (profile.imagen) image = profile.imagen;
  }

  photoEl.src = resolveUserImagePath(image);
  photoEl.onerror = () => {
    photoEl.src = USER_PLACEHOLDER;
  };
  nameEl.textContent = displayName;
  roleEl.textContent = displayRole;
}

export { resolvePath };
