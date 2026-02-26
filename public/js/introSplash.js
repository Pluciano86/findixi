const INTRO_KEY = 'findixi_intro_last_shown';
const INTRO_BG = '#fb8500';
const INTRO_LOGO = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoFindixiBlanco.png';
const ROTATE_EVERY_MS = 1600;
const FADE_MS = 280;

const LANG_CHOICES = [
  { code: 'es', slogan: '¡Explora lo local!', choose: 'Escoge tu idioma' },
  { code: 'en', slogan: 'Explore local', choose: 'Choose your language' },
  { code: 'zh', slogan: '探索本地', choose: '选择你的语言' },
  { code: 'fr', slogan: 'Explorez local', choose: 'Choisissez votre langue' },
  { code: 'pt', slogan: 'Explore o local', choose: 'Escolha seu idioma' },
  { code: 'de', slogan: 'Entdecke Lokales', choose: 'Wähle deine Sprache' },
  { code: 'it', slogan: 'Esplora il locale', choose: 'Scegli la tua lingua' },
  { code: 'ko', slogan: '로컬을 탐험하세요', choose: '언어를 선택하세요' },
  { code: 'ja', slogan: 'ローカルを探索', choose: '言語を選んでください' },
];

function shouldSkipIntro() {
  try {
    if (window.location.pathname.includes('/menu/menuComercio.html')) return true;
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem(INTRO_KEY);
    return lastShown === today;
  } catch (_) {
    return false;
  }
}

function markIntroShown() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(INTRO_KEY, today);
  } catch (_) {
    // noop
  }
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
      text-align: center;
    }
    #intro-splash .intro-logo {
      width: 180px;
      max-width: 70vw;
      height: auto;
      display: block;
    }
    #intro-splash .intro-text {
      color: #ffffff;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.2px;
      transition: opacity 250ms ease;
    }
    #intro-splash .intro-text.fade {
      opacity: 0;
    }
    #intro-splash .intro-lang-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 4px;
      width: min(320px, 80vw);
    }
    #intro-splash .intro-lang-btn {
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      padding: 10px 14px;
      border-radius: 999px;
      letter-spacing: 0.2px;
      transition: background 200ms ease, transform 200ms ease;
    }
    #intro-splash .intro-lang-btn:hover {
      background: rgba(255, 255, 255, 0.22);
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(style);
}

function getIndexUrl() {
  const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  return isLocal ? '/public/index.html' : '/index.html';
}

function applyLangSelection(code) {
  const lang = code || 'es';
  try {
    localStorage.setItem('lang', lang);
  } catch (_) {
    // noop
  }
  if (typeof window.setLang === 'function') {
    window.setLang(lang);
  } else {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);
  }
}

function showIntro() {
  injectStyles();
  markIntroShown();

  const overlay = document.createElement('div');
  overlay.id = 'intro-splash';
  overlay.innerHTML = `
    <div class="intro-content">
      <img class="intro-logo" src="${INTRO_LOGO}" alt="Findixi" />
      <div id="intro-splash-text" class="intro-text"></div>
    </div>
  `;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);

  const textEl = document.getElementById('intro-splash-text');
  const contentEl = overlay.querySelector('.intro-content');
  let index = 0;
  let shownCount = 1;
  let optionsShown = false;
  if (textEl) {
    textEl.textContent = LANG_CHOICES[index].slogan;
  }

  const showLanguageOptions = () => {
    if (optionsShown || !contentEl) return;
    optionsShown = true;

    const list = document.createElement('div');
    list.className = 'intro-lang-list';
    LANG_CHOICES.forEach((lang) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'intro-lang-btn';
      btn.textContent = lang.choose;
      btn.addEventListener('click', () => {
        applyLangSelection(lang.code);
        window.location.href = getIndexUrl();
      });
      list.appendChild(btn);
    });
    if (textEl) {
      textEl.classList.add('fade');
      setTimeout(() => {
        textEl.style.display = 'none';
        contentEl.appendChild(list);
      }, FADE_MS);
    } else {
      contentEl.appendChild(list);
    }
  };

  const rotate = () => {
    if (!textEl) return;
    textEl.classList.add('fade');
    setTimeout(() => {
      index = (index + 1) % LANG_CHOICES.length;
      textEl.textContent = LANG_CHOICES[index].slogan;
      textEl.classList.remove('fade');
      shownCount += 1;
      if (shownCount >= LANG_CHOICES.length) {
        clearInterval(intervalId);
        setTimeout(showLanguageOptions, ROTATE_EVERY_MS);
      }
    }, FADE_MS);
  };

  const intervalId = setInterval(rotate, ROTATE_EVERY_MS);

  overlay.addEventListener('click', () => {
    if (!optionsShown) {
      clearInterval(intervalId);
      showLanguageOptions();
    }
  });
}

if (!shouldSkipIntro()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showIntro);
  } else {
    showIntro();
  }
}
