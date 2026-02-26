import { supabase } from '../shared/supabaseClient.js';

const getLoginUrl = () => {
  const basePath = window.location.href.includes('127.0.0.1') ? '/public/logearse.html' : '/logearse.html';
  return `${window.location.origin}${basePath}`;
};
const LOGO_ENPR_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoFindixi.png';
const LOGO_UP_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/imagenesapp/enpr/Logo%20UP.png';

export const ACTION_MESSAGES = {
  favoriteCommerce: '✋🏼 Los favoritos son pal Corillo de EnPeErre. Debes iniciar sesión para agregar este lugar a tus favoritos, Crea tu cuenta ahora pa’ que no pierdas tus favoritos cada vez que cierres la app.',
  favoritePlace: '✋🏼Los favoritos son pal Corillo de EnPeErre. Debes iniciar sesión para agregar este lugar a tus favoritos, Crea tu cuenta ahora pa’ que no pierdas tus favoritos cada vez que cierres la app.',
  favoriteBeach: '✋🏼Los favoritos son pal Corillo de EnPeErre. Debes iniciar sesión para agregar esta Playa a tus favoritos, Crea tu cuenta ahora pa’ que no pierdas tus favoritos cada vez que cierres la app.',
  saveCoupon: '😎⬆️ Este privilegio es solo pa’ la gente UP... <br> Ahora mismo está GRATIS, pero solo hasta el 31 de enero. Métele ahora… Después no digas que no te avisé… 😏🔥',
  default: 'Debes iniciar sesión para continuar.'
};

let modalOverlay = null;
let modalMessageEl = null;
let modalLogoEl = null;

function ensureModal() {
  if (modalOverlay) return;

  modalOverlay = document.createElement('div');
  modalOverlay.id = 'auth-guard-modal';
  modalOverlay.className =
    'fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 hidden';

  modalOverlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-5 relative">
      <button type="button" class="auth-guard-close absolute top-3 right-3 text-gray-400 hover:text-gray-600" aria-label="Cerrar modal">
        <i class="fas fa-times text-lg"></i>
      </button>
      <div class="flex flex-col items-center gap-3">
        <div class="flex items-center justify-center">
          <img src="${LOGO_ENPR_URL}" alt="Logo En Pe Erre" class="auth-guard-logo object-contain" loading="lazy" />
        </div>
        <p id="auth-guard-message" class="text-sm text-gray-700 leading-relaxed"></p>
      </div>
      <div class="space-y-3">
        <button type="button" class="auth-guard-login w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition">
          Iniciar sesión
        </button>
        <button type="button" class="auth-guard-close w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition">
          Cerrar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  modalMessageEl = modalOverlay.querySelector('#auth-guard-message');
  modalLogoEl = modalOverlay.querySelector('.auth-guard-logo');
  modalOverlay.querySelectorAll('.auth-guard-close').forEach((btn) => {
    btn.addEventListener('click', hideAuthModal);
  });
  modalOverlay.querySelector('.auth-guard-login')?.addEventListener('click', () => {
    hideAuthModal();
    window.location.href = getLoginUrl();
  });

  modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
      hideAuthModal();
    }
  });
}

export function showAuthModal(message, actionKey) {
  ensureModal();
  if (modalMessageEl) {
    modalMessageEl.innerHTML = message || ACTION_MESSAGES.default;
  }
  if (modalLogoEl) {
    const isCouponAction = actionKey === 'saveCoupon';
    modalLogoEl.src = isCouponAction ? LOGO_UP_URL : LOGO_ENPR_URL;
    modalLogoEl.alt = isCouponAction ? 'Logo Up' : 'Logo En Pe Erre';
    if (isCouponAction) {
      modalLogoEl.style.width = '100px';
      modalLogoEl.style.height = 'auto';
    } else {
      modalLogoEl.style.width = '150px';
      modalLogoEl.style.height = 'auto';
    }
  }
  modalOverlay?.classList.remove('hidden');
}

function hideAuthModal() {
  modalOverlay?.classList.add('hidden');
}

/**
 * Verifica si hay un usuario autenticado. Si no lo hay, muestra el modal y lanza un error.
 * @param {'favoriteCommerce'|'favoritePlace'|'favoriteBeach'|'saveCoupon'} actionKey
 */
export async function requireAuth(actionKey) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      return data.user;
    }
  } catch (err) {
    console.warn('⚠️ No se pudo obtener el usuario actual:', err);
  }

  const message = ACTION_MESSAGES[actionKey] || ACTION_MESSAGES.default;
  showAuthModal(message, actionKey);
  throw new Error('AUTH_REQUIRED');
}

/**
 * Variante silenciosa: sólo devuelve false si no hay usuario, sin mostrar modal.
 * @param {'favoriteCommerce'|'favoritePlace'|'favoriteBeach'|'saveCoupon'} actionKey
 */
export async function requireAuthSilent(actionKey) {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      return data.user;
    }
  } catch (err) {
    console.warn('⚠️ No se pudo obtener el usuario actual:', err);
  }
  return false;
}
