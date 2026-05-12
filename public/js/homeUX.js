const SECTION_IDS = [
  'categoriasSection',
  'lodehoyTeaserSection',
  'comidaSection',
  'jangueoSection',
  'eventosSection',
  'areasSection',
];

const STATUS_CONFIG = [
  {
    sectionId: 'categoriasSection',
    containerId: 'categoriasContainer',
    statusId: 'categoriasStatus',
    hasContent: (container) => container.querySelectorAll('a[href]').length > 0,
  },
  {
    sectionId: 'lodehoyTeaserSection',
    containerId: 'lodehoyTeaserList',
    statusId: 'lodehoyTeaserStatus',
    hasContent: (container) => container.querySelectorAll('a[href]').length > 0,
  },
  {
    sectionId: 'comidaSection',
    containerId: 'comidaCarousel',
    statusId: 'comidaStatus',
    hasContent: (container) => container.querySelectorAll('.swiper-slide a[href]').length > 0,
  },
  {
    sectionId: 'jangueoSection',
    containerId: 'jangueoCarousel',
    statusId: 'jangueoStatus',
    hasContent: (container) => container.querySelectorAll('.swiper-slide a[href]').length > 0,
  },
  {
    sectionId: 'eventosSection',
    containerId: 'eventosCarousel',
    statusId: 'eventosStatus',
    hasContent: (container) => container.querySelectorAll('.swiper-slide[data-id]').length > 0,
  },
  {
    sectionId: 'areasSection',
    containerId: 'areasGrid',
    statusId: 'areasStatus',
    hasContent: (container) => container.querySelectorAll('a[href]').length > 0,
  },
];

function getSectionFallbackStatus(container) {
  const raw = String(container?.textContent || '').toLowerCase();
  if (raw.includes('error')) return t('home.statusLoadError');
  if (raw.includes('no hay')) return t('home.statusNoContent');
  if (raw.includes('cargando')) return t('common.cargando');
  return t('common.cargando');
}

function updateSectionStatus(config) {
  const section = document.getElementById(config.sectionId);
  const container = document.getElementById(config.containerId);
  const statusEl = document.getElementById(config.statusId);
  if (!container || !statusEl) return;

  if (section && section.classList.contains('hidden')) {
    statusEl.classList.add('hidden');
    return;
  }

  if (config.hasContent(container)) {
    statusEl.classList.add('hidden');
    return;
  }

  statusEl.textContent = getSectionFallbackStatus(container);
  statusEl.classList.remove('hidden');
}

function bindSectionStatus() {
  STATUS_CONFIG.forEach((config) => {
    const section = document.getElementById(config.sectionId);
    const container = document.getElementById(config.containerId);
    if (!container) return;

    const refresh = () => updateSectionStatus(config);
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });

    if (section) {
      const sectionObserver = new MutationObserver(refresh);
      sectionObserver.observe(section, { attributes: true, attributeFilter: ['class'] });
    }

    window.addEventListener('lang:changed', refresh);
  });
}

function setActiveChip(sectionId) {
  document.querySelectorAll('[data-home-chip]').forEach((chip) => {
    chip.classList.toggle('is-active', chip.getAttribute('data-home-chip') === sectionId);
  });
}

function getStickyOffset() {
  const header = document.querySelector('#headerContainer header');
  const nav = document.getElementById('homeSectionNav');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const navHeight = nav ? nav.getBoundingClientRect().height : 0;
  return Math.round(headerHeight + navHeight + 10);
}

function bindStickySectionNav() {
  const chips = Array.from(document.querySelectorAll('[data-home-chip]'));
  if (!chips.length) return;

  SECTION_IDS.forEach((id) => {
    const section = document.getElementById(id);
    if (section) {
      section.style.scrollMarginTop = `${getStickyOffset()}px`;
    }
  });

  chips.forEach((chip) => {
    chip.addEventListener('click', (event) => {
      event.preventDefault();
      const id = chip.getAttribute('data-home-chip');
      const section = document.getElementById(id);
      if (!section) return;

      const top = window.scrollY + section.getBoundingClientRect().top - getStickyOffset();
      window.scrollTo({ top, behavior: 'smooth' });
      setActiveChip(id);
    });
  });

  if ('IntersectionObserver' in window) {
    const visibleRatios = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        if (!SECTION_IDS.includes(id)) return;
        visibleRatios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });

      let bestId = null;
      let bestRatio = 0;
      visibleRatios.forEach((ratio, id) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      });
      if (bestId) setActiveChip(bestId);
    }, {
      root: null,
      rootMargin: '-110px 0px -50% 0px',
      threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
    });

    SECTION_IDS.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  setActiveChip('categoriasSection');
  window.addEventListener('resize', () => {
    SECTION_IDS.forEach((id) => {
      const section = document.getElementById(id);
      if (section) section.style.scrollMarginTop = `${getStickyOffset()}px`;
    });
  });
}

function initHomeUX() {
  bindSectionStatus();
  bindStickySectionNav();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeUX, { once: true });
} else {
  initHomeUX();
}
import { t } from './i18n.js';
