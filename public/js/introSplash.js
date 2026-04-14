const INTRO_BG = '#fb8500';
const INTRO_LOTTIE =
  'https://lottie.host/4913d3f3-45ac-4ffe-bfda-ea79af23752c/M5vGOz4SSZ.lottie';
const INTRO_SESSION_KEY = 'findixi_intro_seen_session';

// 4s 29f (asumiendo 30fps)
const INTRO_DURATION_MS = Math.round(((4 * 30 + 29) / 30) * 1000);

async function ensureLottieRuntime() {
  if (customElements.get('dotlottie-wc')) return;

  const scriptId = 'dotlottie-runtime';
  let script = document.getElementById(scriptId);

  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'module';
    script.src =
      'https://unpkg.com/@lottiefiles/dotlottie-wc@0.9.10/dist/dotlottie-wc.js';
    document.head.appendChild(script);
  }

  await new Promise((resolve) => {
    if (customElements.get('dotlottie-wc')) {
      resolve();
      return;
    }
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', resolve, { once: true });
  });
}

function injectStyles() {
  if (document.getElementById('intro-splash-styles')) return;

  const style = document.createElement('style');
  style.id = 'intro-splash-styles';
  style.textContent = `
    #intro-splash {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: ${INTRO_BG};
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      transition: opacity 300ms ease;
    }
    #intro-splash.fade-out {
      opacity: 0;
      pointer-events: none;
    }
    #intro-splash .intro-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      width: min(380px, 88vw);
    }
    #intro-splash .intro-animation {
      width: 500px;
      height: 500px;
      max-width: 88vw;
      max-height: 58vh;
      display: block;
    }
  `;

  document.head.appendChild(style);
}

async function showIntro() {
  injectStyles();
  await ensureLottieRuntime();

  const overlay = document.createElement('div');
  overlay.id = 'intro-splash';
  overlay.innerHTML = `
    <div class="intro-content">
      <dotlottie-wc
        class="intro-animation"
        src="${INTRO_LOTTIE}"
        autoplay
        loop
      ></dotlottie-wc>
    </div>
  `;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.remove();
      document.body.style.overflow = previousOverflow;
    }, 320);
  }, INTRO_DURATION_MS);
}

function wasShownThisSession() {
  try {
    return sessionStorage.getItem(INTRO_SESSION_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function markShownThisSession() {
  try {
    sessionStorage.setItem(INTRO_SESSION_KEY, '1');
  } catch (_) {
    // noop
  }
}

function initIntroSplash() {
  if (wasShownThisSession()) return;
  markShownThisSession();
  showIntro();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIntroSplash);
} else {
  initIntroSplash();
}
