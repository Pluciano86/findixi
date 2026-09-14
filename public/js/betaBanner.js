const GROWTH_BANNER_ENABLED = true;

const GROWTH_MESSAGES = {
  es: {
    title: 'Findixi está creciendo',
    body: 'Cada día sumamos más negocios, lugares y experiencias cerca de ti.',
  },
  en: {
    title: 'Findixi is growing',
    body: 'Every day we add more businesses, places, and experiences near you.',
  },
  zh: {
    title: 'Findixi 正在成长',
    body: '我们每天都在增加您附近的商家、地点和体验。',
  },
  fr: {
    title: 'Findixi grandit',
    body: 'Chaque jour, nous ajoutons davantage de commerces, de lieux et d’expériences près de chez vous.',
  },
  pt: {
    title: 'Findixi está crescendo',
    body: 'Todos os dias adicionamos mais negócios, lugares e experiências perto de você.',
  },
  de: {
    title: 'Findixi wächst',
    body: 'Jeden Tag kommen weitere Geschäfte, Orte und Erlebnisse in deiner Nähe hinzu.',
  },
  it: {
    title: 'Findixi sta crescendo',
    body: 'Ogni giorno aggiungiamo nuove attività, luoghi ed esperienze vicino a te.',
  },
  ko: {
    title: 'Findixi가 성장하고 있어요',
    body: '매일 가까운 곳의 비즈니스, 장소와 경험을 더하고 있습니다.',
  },
  ja: {
    title: 'Findixiは成長中です',
    body: '毎日、あなたの近くのお店、場所、体験を追加しています。',
  },
};

function getLang() {
  try {
    const lang = (localStorage.getItem('lang') || 'es').toLowerCase().split('-')[0];
    return Object.prototype.hasOwnProperty.call(GROWTH_MESSAGES, lang) ? lang : 'es';
  } catch (_) {
    return 'es';
  }
}

function injectStyles() {
  if (document.getElementById('findixi-growth-styles')) return;

  const style = document.createElement('style');
  style.id = 'findixi-growth-styles';
  style.textContent = `
    #findixi-beta-banner-wrapper {
      position: sticky;
      top: 0;
      z-index: 9997;
      width: 100%;
      background: #1a1a2e;
    }

    #findixi-beta-banner {
      width: 100%;
      max-width: 480px;
      min-height: 54px;
      margin: 0 auto;
      padding: 7px 16px 8px;
      box-sizing: border-box;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      text-align: center;
      font-family: 'Kanit', sans-serif;
    }

    #findixi-beta-banner .growth-title {
      margin: 0;
      color: #7dd3fc;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.15;
    }

    #findixi-beta-banner .growth-body {
      margin: 0;
      color: #e2e8f0;
      font-size: 12px;
      font-weight: 300;
      line-height: 1.25;
      text-wrap: balance;
    }
  `;

  document.head.appendChild(style);
}

function createBanner() {
  const text = GROWTH_MESSAGES[getLang()] || GROWTH_MESSAGES.es;
  const banner = document.createElement('div');
  banner.id = 'findixi-beta-banner';

  const title = document.createElement('p');
  title.className = 'growth-title';
  title.textContent = text.title;

  const body = document.createElement('p');
  body.className = 'growth-body';
  body.textContent = text.body;

  banner.append(title, body);
  return banner;
}

function injectBanner(wrapper) {
  const headerContainer = document.getElementById('headerContainer');
  if (headerContainer) {
    headerContainer.insertAdjacentElement('afterend', wrapper);
    return;
  }

  document.body.prepend(wrapper);
}

function adjustBannerTop(wrapper, headerRef) {
  const header = headerRef || document.querySelector('header');
  if (!header) return;

  const syncTop = () => {
    const rect = header.getBoundingClientRect();
    wrapper.style.top = `${Math.max(0, Math.round(rect.bottom))}px`;
  };

  syncTop();

  const resizeObserver = new ResizeObserver(syncTop);
  resizeObserver.observe(header);

  const mutationObserver = new MutationObserver(syncTop);
  mutationObserver.observe(header, {
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  window.addEventListener('scroll', syncTop, { passive: true });
  window.addEventListener('resize', syncTop, { passive: true });
  header.addEventListener('transitionrun', syncTop);
  header.addEventListener('transitionend', syncTop);
}

function waitForHeader(callback) {
  const container = document.getElementById('headerContainer');
  if (!container) {
    callback();
    return;
  }

  const existing = container.querySelector('header');
  if (existing) {
    callback(existing);
    return;
  }

  const observer = new MutationObserver(() => {
    const header = container.querySelector('header');
    if (!header) return;
    observer.disconnect();
    callback(header);
  });
  observer.observe(container, { childList: true, subtree: true });
}

function initGrowthBanner() {
  if (!GROWTH_BANNER_ENABLED || !document.body) return;
  if (document.getElementById('findixi-beta-banner')) return;

  injectStyles();

  const wrapper = document.createElement('div');
  wrapper.id = 'findixi-beta-banner-wrapper';
  wrapper.appendChild(createBanner());
  injectBanner(wrapper);
  waitForHeader((header) => adjustBannerTop(wrapper, header));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGrowthBanner, { once: true });
} else {
  initGrowthBanner();
}
