import { supabase } from '../shared/supabaseClient.js';
import { translateDom, t } from './i18n.js';
import { attachFooterViewportFix } from './footerViewportFix.js';

const container = document.getElementById('footerContainer');

// Detectar si estamos en Live Server y ajustar ruta base
const isLiveServer = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const ruta = location.pathname;
const loginPath = isLiveServer ? '/public/logearse.html' : '/logearse.html';
const cuentaPath = isLiveServer ? '/public/usuarios/cuentaUsuario.html' : '/usuarios/cuentaUsuario.html';
const privacyPath = isLiveServer ? '/public/privacy-policy.html' : '/privacy-policy.html';
const termsPath = isLiveServer ? '/public/terms-of-service.html' : '/terms-of-service.html';

let nivel = 0;
if (isLiveServer && ruta.includes('/public/')) {
  nivel = ruta.split('/public/')[1].split('/').filter(x => x && !x.includes('.')).length;
} else {
  nivel = ruta.split('/').filter(x => x && !x.includes('.')).length;
}

const base = nivel === 0 ? './' : '../'.repeat(nivel);

const defaultCuentaImg = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png';
const defaultCuentaTexto = t('footer.cuenta');
let footerMensajesRealtimeChannels = [];
let footerMensajesRefreshTimer = null;
const footerState = {
  activeKey: '',
  disabledKeys: new Set(),
  unreadKeys: new Set(),
};

function detectActiveFooterKey() {
  const pathname = String(location.pathname || '').toLowerCase().replace(/\/+$/, '');
  const parts = pathname.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1] || '';
  const fileName = !lastPart || !lastPart.includes('.') ? 'index.html' : lastPart;

  if (fileName === 'index.html') return 'inicio';
  if (fileName === 'cercademi.html') return 'cerca';
  if (fileName === 'lodehoy.html') return 'lodehoy';
  if (fileName === 'cuentausuario.html') return 'cuenta';
  return '';
}

function applyFooterNavStates() {
  const links = container?.querySelectorAll('[data-footer-key]');
  if (!links?.length) return;

  links.forEach((link) => {
    const key = String(link.getAttribute('data-footer-key') || '').trim();
    const isActive = key && footerState.activeKey === key;
    const isDisabled = key && footerState.disabledKeys.has(key);
    const hasUnread = key && footerState.unreadKeys.has(key);

    const linkClasses = [
      'footer-nav-item',
      'group',
      'flex',
      'flex-col',
      'items-center',
      'w-1/4',
      'text-xs',
      'sm:text-sm',
      'transition-all',
      'duration-150',
    ];

    if (isDisabled) {
      linkClasses.push('pointer-events-none', 'opacity-45');
    } else if (isActive) {
      linkClasses.push('text-white', 'font-semibold');
    } else {
      linkClasses.push('text-white/90', 'hover:text-white');
    }

    link.className = linkClasses.join(' ');

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
    if (isDisabled) {
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('tabindex', '-1');
    } else {
      link.removeAttribute('aria-disabled');
      link.removeAttribute('tabindex');
    }

    const iconWrap = link.querySelector('.footer-icon-wrap');
    if (iconWrap) {
      const iconWrapClasses = [
        'footer-icon-wrap',
        'relative',
        'inline-flex',
        'items-center',
        'justify-center',
        'w-9',
        'h-9',
        'rounded-full',
        'mb-1',
        'transition-all',
        'duration-150',
      ];
      if (isActive) iconWrapClasses.push('bg-white/15', 'ring-1', 'ring-white/25');
      if (hasUnread) iconWrapClasses.push('ring-2', 'ring-cyan-300');
      iconWrap.className = iconWrapClasses.join(' ');
    }

    const icon = link.querySelector('.footer-icon');
    if (icon) {
      icon.className = `footer-icon w-7 h-7${key === 'cuenta' ? ' object-cover rounded-full' : ''}`;
    }

    const label = link.querySelector('.footer-label');
    if (label) {
      const labelClasses = ['footer-label', 'leading-tight'];
      if (hasUnread && !isActive) labelClasses.push('font-semibold', 'text-cyan-200');
      label.className = labelClasses.join(' ');
    }
  });
}

function setFooterDisabled(key, isDisabled) {
  if (!key) return;
  if (isDisabled) footerState.disabledKeys.add(key);
  else footerState.disabledKeys.delete(key);
  applyFooterNavStates();
}

function setFooterUnread(key, hasUnread) {
  if (!key) return;
  if (hasUnread) footerState.unreadKeys.add(key);
  else footerState.unreadKeys.delete(key);
  applyFooterNavStates();
}

function setFooterMensajesBadge(count = 0) {
  const badge = document.getElementById('footerMensajesBadge');
  if (!badge) return;

  const total = Number(count || 0);
  if (!Number.isFinite(total) || total <= 0) {
    badge.textContent = '0';
    badge.classList.add('hidden');
    setFooterUnread('cuenta', false);
    return;
  }

  badge.textContent = total > 99 ? '99+' : String(total);
  badge.classList.remove('hidden');
  setFooterUnread('cuenta', true);
}

async function obtenerConteoMensajesPendientes({ userId, email }) {
  const uid = String(userId || '').trim();
  const userEmail = String(email || '').trim().toLowerCase();
  if (!uid && !userEmail) return 0;

  const orParts = [];
  if (uid) orParts.push(`destino_usuario.eq.${uid}`);
  if (userEmail) orParts.push(`destino_email.eq.${userEmail}`);
  if (!orParts.length) return 0;

  const { count, error } = await supabase
    .from('Mensajes')
    .select('id', { head: true, count: 'exact' })
    .eq('estado', 'pendiente')
    .not('tipo', 'ilike', 'invitacion%')
    .or(orParts.join(','));

  if (error) throw error;
  return Number(count || 0);
}

function clearFooterMensajesRealtime() {
  if (footerMensajesRefreshTimer) {
    clearTimeout(footerMensajesRefreshTimer);
    footerMensajesRefreshTimer = null;
  }
  footerMensajesRealtimeChannels.forEach((channel) => {
    try {
      supabase.removeChannel(channel);
    } catch (error) {
      console.warn('No se pudo limpiar canal realtime del footer:', error?.message || error);
    }
  });
  footerMensajesRealtimeChannels = [];
}

function scheduleFooterMensajesRefresh({ userId, email }) {
  if (footerMensajesRefreshTimer) clearTimeout(footerMensajesRefreshTimer);
  footerMensajesRefreshTimer = setTimeout(async () => {
    try {
      const totalPendientes = await obtenerConteoMensajesPendientes({ userId, email });
      setFooterMensajesBadge(totalPendientes);
    } catch (error) {
      console.warn('No se pudo refrescar badge realtime del footer:', error?.message || error);
    }
  }, 250);
}

function setupFooterMensajesRealtime({ userId, email }) {
  clearFooterMensajesRealtime();
  const uid = String(userId || '').trim();
  const userEmail = String(email || '').trim().toLowerCase();
  if (!uid && !userEmail) return;

  const onChange = () => scheduleFooterMensajesRefresh({ userId: uid, email: userEmail });
  const channels = [];

  if (uid) {
    channels.push(
      supabase
        .channel(`footer-mensajes-user-${uid}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'Mensajes',
          filter: `destino_usuario=eq.${uid}`,
        }, onChange)
        .subscribe()
    );
  }

  if (userEmail) {
    channels.push(
      supabase
        .channel(`footer-mensajes-email-${uid || 'anon'}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'Mensajes',
          filter: `destino_email=eq.${userEmail}`,
        }, onChange)
        .subscribe()
    );
  }

  footerMensajesRealtimeChannels = channels;
}

function renderFooter() {
  if (!container) return;

  const maxWidth = '28rem'; // igual que max-w-md para alinear con el header/columna
  footerState.activeKey = detectActiveFooterKey();
  container.innerHTML = `
    <footer
      data-footer-fixed
      class="fixed bottom-0 z-50 text-white bg-[#023047] border-t border-gray-700 shadow-lg"
      style="
        padding-bottom: env(safe-area-inset-bottom);
        width: 100%;
        max-width: ${maxWidth};
        left: 50%;
        transform: translate(-50%, var(--footer-offset, 0px));
      ">
      <nav class="flex justify-around py-2">
        <a href="${base}index.html" data-footer-key="inicio" class="footer-nav-item group flex flex-col items-center w-1/4 text-xs sm:text-sm">
          <span class="footer-icon-wrap relative inline-flex items-center justify-center w-9 h-9 rounded-full mb-1">
            <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoHome.png" class="footer-icon w-7 h-7" alt="Inicio">
          </span>
          <span class="footer-label leading-tight" data-i18n="footer.inicio">Inicio</span>
        </a>
        <a href="${base}cercaDeMi.html" data-footer-key="cerca" class="footer-nav-item group flex flex-col items-center w-1/4 text-xs sm:text-sm">
          <span class="footer-icon-wrap relative inline-flex items-center justify-center w-9 h-9 rounded-full mb-1">
            <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoNearMe.png" class="footer-icon w-7 h-7" alt="Cerca de Mi">
          </span>
          <span class="footer-label leading-tight" data-i18n="footer.cerca">Cerca de Mi</span>
        </a>
        <a href="${base}lodehoy.html" data-footer-key="lodehoy" class="footer-nav-item group flex flex-col items-center w-1/4 text-xs sm:text-sm">
          <span class="footer-icon-wrap relative inline-flex items-center justify-center w-9 h-9 rounded-full mb-1">
            <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/botonLodeHoy.svg" class="footer-icon w-7 h-7" alt="Lo de Hoy">
          </span>
          <span class="footer-label leading-tight" data-i18n="footer.lodehoy">Lo de Hoy</span>
        </a>
        <a id="enlaceMiCuenta" href="${loginPath}" data-footer-key="cuenta" class="footer-nav-item group flex flex-col items-center w-1/4 text-xs sm:text-sm">
          <span class="footer-icon-wrap relative inline-flex items-center justify-center w-9 h-9 rounded-full mb-1">
            <img 
              id="footerImagen"
              src="${defaultCuentaImg}"
              class="footer-icon w-7 h-7 object-cover rounded-full"
              alt="Cuenta">
            <span
              id="footerMensajesBadge"
              class="hidden absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[10px] leading-[16px] font-semibold text-center"
            >0</span>
          </span>
          <span id="footerTexto" class="footer-label leading-tight" data-i18n="footer.cuenta">${defaultCuentaTexto}</span>
        </a>
      </nav>
      <div class="flex flex-wrap justify-center gap-x-3 gap-y-1 px-3 pb-2 text-[12px] text-white/95 border-t border-white/10">
        <a href="${privacyPath}" data-i18n="footer.privacyPolicy" class="hover:text-white underline-offset-2 hover:underline">Privacy Policy</a>
        <span class="opacity-60">•</span>
        <a href="${termsPath}" data-i18n="footer.termsOfService" class="hover:text-white underline-offset-2 hover:underline">Terms of Service</a>
        <span class="opacity-60">•</span>
        <a href="mailto:info@findixi.com" class="hover:text-white underline-offset-2 hover:underline">info@findixi.com</a>
      </div>
    </footer>
  `;
  applyFooterNavStates();
}

renderFooter();
translateDom(container);
attachFooterViewportFix(container?.querySelector('footer'));

window.addEventListener('lang:changed', () => {
  translateDom(container);
  const cuentaTexto = document.getElementById('footerTexto');
  if (cuentaTexto && cuentaTexto.getAttribute('data-i18n') === 'footer.cuenta') {
    cuentaTexto.textContent = t('footer.cuenta');
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  // Lazy-load para medios pesados (si no se especificó)
  document.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
  });

  const enlaceMiCuenta = document.getElementById('enlaceMiCuenta');
  const cuentaImagen = document.getElementById('footerImagen');
  const cuentaTexto = document.getElementById('footerTexto');
  setFooterMensajesBadge(0);
  setFooterDisabled('cuenta', true);

  if (!enlaceMiCuenta) return;

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (session?.user) {
      const user = session.user;
      enlaceMiCuenta.href = cuentaPath;

      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('nombre, imagen')
        .eq('id', user.id)
        .maybeSingle();

      if (!perfilError && perfil) {
        if (perfil.imagen) {
          cuentaImagen.src = perfil.imagen;
          cuentaImagen.classList.add('rounded-full', 'object-cover');
        }
        cuentaTexto.textContent = perfil.nombre || user.email.split('@')[0];
      } else {
        cuentaTexto.textContent = user.email.split('@')[0];
      }

      const totalPendientes = await obtenerConteoMensajesPendientes({
        userId: user.id,
        email: user.email,
      });
      setFooterMensajesBadge(totalPendientes);
      setupFooterMensajesRealtime({ userId: user.id, email: user.email });
      setFooterDisabled('cuenta', false);
    } else {
      cuentaImagen.src = defaultCuentaImg;
      cuentaImagen.classList.add('rounded-full', 'object-cover');
      cuentaTexto.textContent = defaultCuentaTexto;
      enlaceMiCuenta.href = loginPath;
      setFooterMensajesBadge(0);
      clearFooterMensajesRealtime();
      setFooterDisabled('cuenta', false);
    }
  } catch (error) {
    console.error('Error verificando sesión:', error);
    cuentaImagen.src = defaultCuentaImg;
    cuentaImagen.classList.add('rounded-full', 'object-cover');
    cuentaTexto.textContent = defaultCuentaTexto;
    enlaceMiCuenta.href = loginPath;
    setFooterMensajesBadge(0);
    clearFooterMensajesRealtime();
    setFooterDisabled('cuenta', false);
  }
});

window.addEventListener('beforeunload', () => {
  clearFooterMensajesRealtime();
});
