const POPUP_STORAGE_KEY = 'findixi_daily_beta_popup_seen_date';
const POPUP_CONTAINER_ID = 'findixi-daily-popup-overlay';
const LOGO_URL = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoFindixi.png';
const POPUP_DELAY_AFTER_SPLASH_MS = 10000;

function getLocalDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function alreadyShownToday() {
  try {
    return localStorage.getItem(POPUP_STORAGE_KEY) === getLocalDateKey();
  } catch (_) {
    return false;
  }
}

function markShownToday() {
  try {
    localStorage.setItem(POPUP_STORAGE_KEY, getLocalDateKey());
  } catch (_) {
    // noop
  }
}

function injectStyles() {
  if (document.getElementById('findixi-daily-popup-styles')) return;

  const style = document.createElement('style');
  style.id = 'findixi-daily-popup-styles';
  style.textContent = `
    #${POPUP_CONTAINER_ID} {
      position: fixed;
      inset: 0;
      z-index: 11050;
      background: rgba(2, 6, 23, 0.72);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      animation: findixiDailyPopupFadeIn 220ms ease;
    }

    #${POPUP_CONTAINER_ID} .findixi-daily-popup-card {
      width: min(440px, 92vw);
      background: linear-gradient(160deg, #ffffff 0%, #fff7ed 100%);
      border: 1px solid rgba(236, 127, 37, 0.26);
      border-radius: 20px;
      padding: 22px 20px 18px;
      box-shadow: 0 30px 90px rgba(2, 6, 23, 0.35);
      text-align: center;
      font-family: 'Kanit', sans-serif;
      color: #1f2937;
      animation: findixiDailyPopupPop 260ms ease;
    }

    #${POPUP_CONTAINER_ID} .findixi-daily-popup-logo {
      width: 150px;
      max-width: 65%;
      height: auto;
      display: block;
      margin: 0 auto 14px;
    }

    #${POPUP_CONTAINER_ID} .findixi-daily-popup-title {
      margin: 0;
      font-size: 23px;
      line-height: 1.2;
      font-weight: 700;
      color: #0f172a;
    }

    #${POPUP_CONTAINER_ID} .findixi-daily-popup-subtitle {
      margin: 8px 0 0;
      font-size: 16px;
      font-weight: 700;
      color: #EC7F25;
    }

    #${POPUP_CONTAINER_ID} .findixi-daily-popup-body {
      margin: 12px 0 0;
      font-size: 14px;
      line-height: 1.5;
      color: #374151;
      text-wrap: pretty;
    }

    #${POPUP_CONTAINER_ID} .findixi-daily-popup-body + .findixi-daily-popup-body {
      margin-top: 8px;
    }

    #${POPUP_CONTAINER_ID} .findixi-daily-popup-btn {
      margin-top: 18px;
      border: 0;
      border-radius: 999px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
      background: linear-gradient(135deg, #FB8500 0%, #EC7F25 100%);
      box-shadow: 0 12px 28px rgba(236, 127, 37, 0.35);
      cursor: pointer;
      font-family: inherit;
    }

    @keyframes findixiDailyPopupFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes findixiDailyPopupPop {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;

  document.head.appendChild(style);
}

function closePopup() {
  const overlay = document.getElementById(POPUP_CONTAINER_ID);
  if (overlay) overlay.remove();
}

function showPopup() {
  if (!document.body) return;
  if (document.getElementById(POPUP_CONTAINER_ID)) return;

  markShownToday();
  injectStyles();

  const overlay = document.createElement('div');
  overlay.id = POPUP_CONTAINER_ID;

  const card = document.createElement('div');
  card.className = 'findixi-daily-popup-card';
  card.innerHTML = `
    <img src="${LOGO_URL}" alt="Findixi" class="findixi-daily-popup-logo" />
    <h2 class="findixi-daily-popup-title">¡Hola, Estamos construyendo algo especial!</h2>
    <p class="findixi-daily-popup-subtitle">Findixi está creciendo, nos encontramos en Modo Beta.</p>
    <p class="findixi-daily-popup-body">Comercios, lugares y experiencias locales se están uniendo cada día. Explora lo que hay hoy y vuelve pronto.</p>
    <p class="findixi-daily-popup-body">Si ves poco contenido por ahora, es porque apenas estamos comenzando — Agradecemos que estés aquí desde el principio. 🙌</p>
    <button type="button" class="findixi-daily-popup-btn" id="findixiDailyPopupClose">Entendido</button>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closePopup();
  });

  const closeBtn = document.getElementById('findixiDailyPopupClose');
  closeBtn?.addEventListener('click', closePopup);
}

function waitForIntroToFinishAndShow() {
  const intro = document.getElementById('intro-splash');
  if (!intro) {
    setTimeout(showPopup, POPUP_DELAY_AFTER_SPLASH_MS);
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById('intro-splash')) {
      observer.disconnect();
      setTimeout(showPopup, POPUP_DELAY_AFTER_SPLASH_MS);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function initDailyBetaPopup() {
  if (window.__findixiDailyPopupInitialized) return;
  window.__findixiDailyPopupInitialized = true;

  if (alreadyShownToday()) return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForIntroToFinishAndShow, { once: true });
  } else {
    waitForIntroToFinishAndShow();
  }
}

initDailyBetaPopup();

export { initDailyBetaPopup };
