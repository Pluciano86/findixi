const container = document.getElementById('headerContainer');
const headerScrollConfig = {
  threshold: 8,
  hideOffset: '-100%',
  transition: 'transform 180ms ease',
};
const headerLayoutConfig = {
  maxWidth: '28rem',
};

// Detectar si estamos en Live Server y ajustar ruta base
const isLiveServer = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const ruta = location.pathname;

let nivel = 0;
if (isLiveServer && ruta.includes('/public/')) {
  nivel = ruta.split('/public/')[1].split('/').filter(x => x && !x.includes('.')).length;
} else {
  nivel = ruta.split('/').filter(x => x && !x.includes('.')).length;
}

const base = nivel === 0 ? './' : '../'.repeat(nivel);

const LANGS = [
  { code: 'es', short: 'ES', native: 'ES', flag: '🇵🇷' },
  { code: 'en', short: 'EN', native: 'EN', flag: '🇺🇸' },
  { code: 'zh', short: 'ZH', native: '中文', flag: '🇨🇳' },
  { code: 'fr', short: 'FR', native: 'FR', flag: '🇫🇷' },
  { code: 'pt', short: 'PT', native: 'PT', flag: '🇧🇷' },
  { code: 'de', short: 'DE', native: 'DE', flag: '🇩🇪' },
  { code: 'it', short: 'IT', native: 'IT', flag: '🇮🇹' },
  { code: 'ko', short: 'KO', native: '한국어', flag: '🇰🇷' },
  { code: 'ja', short: 'JA', native: '日本語', flag: '🇯🇵' },
];

const findLang = (code) => LANGS.find(l => l.code === code) || LANGS[0];

// Inyectar fuentes Noto solo una vez
(() => {
  const id = 'lang-fonts-link';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600&family=Noto+Sans+KR:wght@400;600&family=Noto+Sans+SC:wght@400;600&display=swap';
    document.head.appendChild(link);
  }
  const styleId = 'lang-fonts-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html[data-lang="ja"] { font-family: 'Noto Sans JP', system-ui, -apple-system, sans-serif; }
      html[data-lang="ko"] { font-family: 'Noto Sans KR', system-ui, -apple-system, sans-serif; }
      html[data-lang="zh"] { font-family: 'Noto Sans SC', system-ui, -apple-system, sans-serif; }
    `;
    document.head.appendChild(style);
  }
})();

container.innerHTML = `
  <header class="bg-[#EC7F25] text-white flex items-center justify-between p-4 shadow-md gap-2 relative">
    <button id="btnBack" class="text-xl invisible w-6">&#8592;</button>
    <a href="${base}index.html" class="absolute left-1/2 -translate-x-1/2 text-center">
      <img
        src="https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoBlanco.png"
        alt="Logo"
        class="h-8 inline-block"
      >
    </a>
    <div class="relative">
      <button id="langToggle" aria-label="Cambiar idioma" class="flex items-center gap-1 text-sm bg-white/60 text-[#231F20] border border-black/10 rounded px-2 py-1.5">
        <span class="text-lg" aria-hidden="true">🌐</span>
        <span id="langCurrent" class="text-xl leading-none">🇵🇷</span>
      </button>
      <div id="langMenu" class="bg-white text-[#231F20] border border-black/10 rounded shadow-lg hidden min-w-[120px]" style="z-index: 1300;"></div>
    </div>
  </header>
`;

const headerEl = container?.querySelector('header');
if (headerEl) {
  headerEl.style.position = 'fixed';
  headerEl.style.top = '0';
  headerEl.style.left = '50%';
  headerEl.style.width = '100%';
  headerEl.style.maxWidth = headerLayoutConfig.maxWidth;
  headerEl.style.zIndex = '1200';
  headerEl.style.transform = 'translate3d(-50%, 0, 0)';
  headerEl.style.transition = headerScrollConfig.transition;
  headerEl.style.willChange = 'transform';

  const syncContainerHeight = () => {
    const height = headerEl.getBoundingClientRect().height;
    if (height > 0) {
      container.style.height = `${height}px`;
    }
  };

  syncContainerHeight();
  window.addEventListener('resize', syncContainerHeight);
  window.addEventListener('load', syncContainerHeight);

  let lastScrollY = window.scrollY;
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY;
      const movedEnough = Math.abs(delta) >= headerScrollConfig.threshold;

      if (currentY <= 0) {
        headerEl.style.transform = 'translate3d(-50%, 0, 0)';
        lastScrollY = currentY;
        ticking = false;
        return;
      }

      if (movedEnough) {
        if (delta > 0) {
          headerEl.style.transform = `translate3d(-50%, ${headerScrollConfig.hideOffset}, 0)`;
        } else {
          headerEl.style.transform = 'translate3d(-50%, 0, 0)';
        }
        lastScrollY = currentY;
      }

      ticking = false;
    });
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  const btnBack = document.getElementById('btnBack');
  if (window.history.length > 1) {
    btnBack.classList.remove('invisible');
    btnBack.addEventListener('click', () => history.back());
  }

  // Sincronizar selector de idioma
  const langToggle = document.getElementById('langToggle');
  const langMenu = document.getElementById('langMenu');
  const langCurrent = document.getElementById('langCurrent');
  const stored = (localStorage.getItem('lang') || document.documentElement.lang || 'es').toLowerCase();
  const setCurrent = (code) => {
    const lang = findLang(code);
    if (langCurrent && lang) {
      langCurrent.textContent = `${lang.flag}`;
    }
  };

  // Construir menú
  if (langMenu) {
    langMenu.innerHTML = LANGS.map(l => `
      <button data-lang="${l.code}" class="flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/10 w-full">
        <span>${l.flag}</span><span>${l.native}</span>
      </button>
    `).join('');
  }

  setCurrent(stored);

  if (langToggle && langMenu) {
    const portalLangMenu = () => {
      if (langMenu.dataset.portal === '1') return;
      document.body.appendChild(langMenu);
      langMenu.dataset.portal = '1';
      langMenu.style.position = 'fixed';
      langMenu.style.zIndex = '2000';
      langMenu.style.marginTop = '0';
    };

    const positionLangMenu = () => {
      const rect = langToggle.getBoundingClientRect();
      const top = Math.round(rect.bottom + 6);
      const right = Math.round(window.innerWidth - rect.right);
      langMenu.style.top = `${top}px`;
      langMenu.style.right = `${right}px`;
    };

    langToggle.addEventListener('click', () => {
      portalLangMenu();
      positionLangMenu();
      langMenu.classList.toggle('hidden');
    });

    langMenu.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-lang');
        localStorage.setItem('lang', val);
        setCurrent(val);
        langMenu.classList.add('hidden');
        if (window.setLang) {
          window.setLang(val);
        } else {
          location.reload();
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!langMenu.contains(e.target) && !langToggle.contains(e.target)) {
        langMenu.classList.add('hidden');
      }
    });

    window.addEventListener('resize', () => {
      if (!langMenu.classList.contains('hidden')) {
        positionLangMenu();
      }
    });
    window.addEventListener('scroll', () => {
      if (!langMenu.classList.contains('hidden')) {
        positionLangMenu();
      }
    }, { passive: true });
  }
});
