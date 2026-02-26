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

// Otros valores
const hora = new Date().getHours();
const esAlmuerzo = hora >= 6 && hora < 15;

const icono = esAlmuerzo ? 'cutlery.svg' : 'beer.svg';
const texto = esAlmuerzo ? 'Almuerzos' : 'Happy Hours';

const iconBase = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/appicon/';

const defaultCuentaImg = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png';
const defaultCuentaTexto = t('footer.cuenta');

function renderFooter() {
  if (!container) return;

  const maxWidth = '28rem'; // igual que max-w-md para alinear con el header/columna
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
        <a href="${base}index.html" class="flex flex-col items-center text-sm font-extralight w-1/4">
          <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoHome.png" class="w-8 h-8 mb-1" alt="Inicio">
          <span data-i18n="footer.inicio">Inicio</span>
        </a>
        <a href="${base}cercaDeMi.html" class="flex flex-col items-center text-sm font-extralight w-1/4">
          <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoNearMe.png" class="w-8 h-8 mb-1" alt="Cerca de Mi">
          <span data-i18n="footer.cerca">Cerca de Mi</span>
        </a>
        <a href="${base}listadoEventos.html" class="flex flex-col items-center text-sm font-extralight w-1/4">
          <img src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoEventos.png" class="w-8 h-8 mb-1" alt="Eventos">
          <span data-i18n="footer.eventos">Eventos</span>
        </a>
        <a id="enlaceMiCuenta" href="${loginPath}" class="flex flex-col items-center text-sm font-extralight w-1/4">
          <img 
            id="footerImagen"
            src="${defaultCuentaImg}"
            class="w-8 h-8 mb-1"
            alt="Cuenta">
          <span id="footerTexto" data-i18n="footer.cuenta">${defaultCuentaTexto}</span>
        </a>
      </nav>
      <div class="flex flex-wrap justify-center gap-x-3 gap-y-1 px-3 pb-2 text-[11px] text-white/80 border-t border-white/10">
        <a href="${privacyPath}" class="hover:text-white underline-offset-2 hover:underline">Privacy Policy</a>
        <span class="opacity-60">•</span>
        <a href="${termsPath}" class="hover:text-white underline-offset-2 hover:underline">Terms of Service</a>
        <span class="opacity-60">•</span>
        <a href="mailto:info@findixi.com" class="hover:text-white underline-offset-2 hover:underline">info@findixi.com</a>
      </div>
    </footer>
  `;
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
    } else {
      cuentaImagen.src = defaultCuentaImg;
      cuentaTexto.textContent = defaultCuentaTexto;
      enlaceMiCuenta.href = loginPath;
    }
  } catch (error) {
    console.error('Error verificando sesión:', error);
    cuentaImagen.src = defaultCuentaImg;
    cuentaTexto.textContent = defaultCuentaTexto;
    enlaceMiCuenta.href = loginPath;
  }
});
