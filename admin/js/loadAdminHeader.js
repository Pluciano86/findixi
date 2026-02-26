import { resolvePath, applyResolvedPaths } from '../shared/pathResolver.js';

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

  const toggleBtn = container.querySelector('#menuToggle');
  const sidebar = container.querySelector('#adminSidebar');
  const overlay = container.querySelector('#sidebarOverlay');

  if (toggleBtn && sidebar && overlay) {
    const closeSidebar = () => {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    };

    toggleBtn.addEventListener('click', () => {
      const isHidden = sidebar.classList.contains('-translate-x-full');
      sidebar.classList.toggle('-translate-x-full');
      overlay.classList.toggle('hidden', !isHidden);
    });

    overlay.addEventListener('click', closeSidebar);

    // Cerrar el sidebar al navegar mediante enlaces.
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeSidebar);
    });
  }

  // Asegurar que otros elementos con data-resolve-path en el documento también se actualicen.
  applyResolvedPaths(document);
}

export { resolvePath };
