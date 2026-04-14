const INTRO_KEY = 'findixi_intro_last_shown';
const INTRO_BG = '#fb8500';
const INTRO_LOGO = 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoFindixiBlanco.png';
const ROTATE_EVERY_MS = 1600;
const FADE_MS = 280;

const LANG_CHOICES = [
  { code: 'es', flag: '🇵🇷', name: 'Español', slogan: '¡Explora lo local!', choose: 'Selecciona tu idioma' },
  { code: 'en', flag: '🇺🇸', name: 'English', slogan: 'Explore local', choose: 'Select your language' },
  { code: 'fr', flag: '🇫🇷', name: 'Français', slogan: 'Explorez local', choose: 'Sélectionnez votre langue' },
  { code: 'pt', flag: '🇧🇷', name: 'Português', slogan: 'Explore o local', choose: 'Selecione seu idioma' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch', slogan: 'Entdecke Lokales', choose: 'Wähle deine Sprache' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano', slogan: 'Esplora il locale', choose: 'Seleziona la tua lingua' },
  { code: 'zh', flag: '🇨🇳', name: '中文', slogan: '探索本地', choose: '选择你的语言' },
  { code: 'ko', flag: '🇰🇷', name: '한국어', slogan: '로컬을 탐험하세요', choose: '언어를 선택하세요' },
  { code: 'ja', flag: '🇯🇵', name: '日本語', slogan: 'ローカルを探索', choose: '言語を選択してください' },
];

const BETA_TEXT = {
  es: { title: 'Estamos en versión beta', body: 'Findixi está en pruebas. Algunos comercios y funciones están siendo cargados. Tu experiencia nos ayuda a mejorar.' },
  en: { title: "We're in beta", body: 'Findixi is being tested. Some businesses and features are still loading. Your experience helps us improve.' },
  zh: { title: '我们正处于测试阶段', body: 'Findixi 正在测试中。部分商家和功能仍在加载。您的体验有助于我们改进。' },
  fr: { title: 'Nous sommes en version bêta', body: 'Findixi est en cours de test. Certains commerces et fonctionnalités sont en cours de chargement. Votre expérience nous aide à améliorer.' },
  pt: { title: 'Estamos em versão beta', body: 'O Findixi está em testes. Alguns comerciantes e funções ainda estão sendo carregados. Sua experiência nos ajuda a melhorar.' },
  de: { title: 'Wir sind in der Beta-Phase', body: 'Findixi wird getestet. Einige Geschäfte und Funktionen werden noch geladen. Deine Erfahrung hilft uns zu verbessern.' },
  it: { title: 'Siamo in versione beta', body: 'Findixi è in fase di test. Alcuni commercianti e funzionalità sono ancora in caricamento. La tua esperienza ci aiuta a migliorare.' },
  ko: { title: '베타 버전입니다', body: 'Findixi는 테스트 중입니다. 일부 상점과 기능이 아직 로드 중입니다. 귀하의 경험이 개선에 도움이 됩니다.' },
  ja: { title: 'ベータ版です', body: 'Findixiはテスト中です。一部のお店や機能はまだ読み込み中です。あなたの体験が改善に役立ちます。' },
};

const WELCOME_TEXT = {
  es: '¡Bienvenido!', en: 'Welcome!', zh: '欢迎!',
  fr: 'Bienvenue!', pt: 'Bem-vindo!', de: 'Willkommen!',
  it: 'Benvenuto!', ko: '환영합니다!', ja: 'ようこそ!',
};

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
      width: min(380px, 88vw);
    }
    #intro-splash .intro-welcome {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
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
      min-height: 24px;
    }
    #intro-splash .intro-text.fade {
      opacity: 0;
    }
    #intro-splash .intro-beta {
      width: 100%;
      background: #023047;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 16px;
      padding: 12px 14px;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-sizing: border-box;
    }
    #intro-splash .intro-beta-title {
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
    }
    #intro-splash .intro-beta-body {
      font-size: 13px;
      font-weight: 500;
      line-height: 1.35;
      opacity: 0.98;
    }
    #intro-splash .intro-lang-select {
      width: min(320px, 80vw);
      border: 1px solid rgba(255, 255, 255, 0.5);
      background: #023047;
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      padding: 10px 14px;
      border-radius: 999px;
      letter-spacing: 0.2px;
      box-sizing: border-box;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      text-align: center;
      text-align-last: center;
    }
    #intro-splash .intro-lang-select option {
      color: #0f172a;
      background: #ffffff;
      font-weight: 600;
    }
    #intro-splash .intro-hidden {
      display: none;
    }
  `;
  document.head.appendChild(style);
}

function getIndexUrl() {
  const isLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  const path = location.pathname || '';
  if (path.includes('/public/')) return '/public/index.html';
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

function getLangChoice(code) {
  return LANG_CHOICES.find((lang) => lang.code === code) || LANG_CHOICES[0];
}

function showIntro() {
  injectStyles();
  markIntroShown();

  const overlay = document.createElement('div');
  overlay.id = 'intro-splash';
  overlay.innerHTML = `
    <div class="intro-content">
      <div id="intro-splash-welcome" class="intro-welcome"></div>
      <img class="intro-logo" src="${INTRO_LOGO}" alt="Findixi" />
      <div id="intro-splash-text" class="intro-text"></div>
      <div class="intro-beta">
        <div id="intro-splash-beta-title" class="intro-beta-title"></div>
        <div id="intro-splash-beta-body" class="intro-beta-body"></div>
      </div>
      <select id="intro-lang-select" class="intro-lang-select intro-hidden" aria-label="Selector de idioma"></select>
    </div>
  `;

  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);

  const welcomeEl = document.getElementById('intro-splash-welcome');
  const textEl = document.getElementById('intro-splash-text');
  const betaTitleEl = document.getElementById('intro-splash-beta-title');
  const betaBodyEl = document.getElementById('intro-splash-beta-body');
  const selectEl = document.getElementById('intro-lang-select');

  if (!selectEl) {
    document.body.style.overflow = previousOverflow;
    overlay.remove();
    return;
  }

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  selectEl.appendChild(placeholderOption);

  LANG_CHOICES.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = `${lang.flag} ${lang.name} · ${lang.code}`;
    selectEl.appendChild(option);
  });

  const updateCopy = (langCode, syncSelect = true) => {
    const lang = getLangChoice(langCode);
    const beta = BETA_TEXT[lang.code] || BETA_TEXT.es;

    if (welcomeEl) {
      welcomeEl.textContent = WELCOME_TEXT[lang.code] || WELCOME_TEXT.es;
    }
    if (textEl) {
      textEl.textContent = lang.slogan;
    }
    if (betaTitleEl) {
      betaTitleEl.textContent = beta.title;
    }
    if (betaBodyEl) {
      betaBodyEl.textContent = beta.body;
    }
    placeholderOption.textContent = `🌐 ${lang.choose}`;
    if (syncSelect) {
      selectEl.value = '';
    }
  };

  const showLanguageOptions = () => {
    selectEl.classList.remove('intro-hidden');
    selectEl.value = '';
  };

  let index = 0;
  let shownCount = 1;
  let optionsShown = false;
  let intervalId = null;

  updateCopy(LANG_CHOICES[index].code);
  showLanguageOptions();

  const openSelection = () => {
    if (optionsShown) return;
    optionsShown = true;
    if (intervalId) clearInterval(intervalId);
    updateCopy('es');
    showLanguageOptions();
  };

  const rotate = () => {
    if (!textEl || optionsShown) return;
    textEl.classList.add('fade');
    setTimeout(() => {
      index = (index + 1) % LANG_CHOICES.length;
      updateCopy(LANG_CHOICES[index].code);
      textEl.classList.remove('fade');
      shownCount += 1;
      if (shownCount >= LANG_CHOICES.length) {
        if (intervalId) clearInterval(intervalId);
        setTimeout(openSelection, ROTATE_EVERY_MS);
      }
    }, FADE_MS);
  };

  intervalId = setInterval(rotate, ROTATE_EVERY_MS);

  selectEl.addEventListener('change', () => {
    const selected = selectEl.value || 'es';
    updateCopy(selected, false);
    applyLangSelection(selected);
    window.location.assign(getIndexUrl());
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === selectEl) return;
    openSelection();
  });
}

if (!shouldSkipIntro()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showIntro);
  } else {
    showIntro();
  }
}
