// BETA MODE — cambiar BETA_MODE a false para desactivar completamente el banner
// No requiere otros cambios en el código
import { supabase } from '../shared/supabaseClient.js';

const BETA_MODE = true; // Cambiar a false para desactivar el banner

const BETA_MESSAGES = {
  es: 'Findixi está en modo beta — versión de prueba',
  en: 'Findixi is in beta mode — test version',
  zh: 'Findixi 处于测试模式',
  fr: 'Findixi est en mode bêta — version de test',
  pt: 'Findixi está em modo beta — versão de teste',
  de: 'Findixi ist im Beta-Modus — Testversion',
  it: 'Findixi è in modalità beta — versione di test',
  ko: 'Findixi 베타 모드 — 테스트 버전',
  ja: 'Findixiはベータモードです',
};

const FEEDBACK_LABEL = {
  es: 'Opinión', en: 'Feedback', zh: '反馈', fr: 'Avis',
  pt: 'Opinião', de: 'Feedback', it: 'Feedback', ko: '의견', ja: 'フィードバック',
};

const FEEDBACK_MODAL = {
  es: { title: '¿Cómo fue tu experiencia?', placeholder: 'Cuéntanos qué mejorarías o qué te gustó...', btn: 'Enviar' },
  en: { title: 'How was your experience?', placeholder: 'Tell us what you liked or would improve...', btn: 'Send' },
  zh: { title: '您的体验如何？', placeholder: '告诉我们您喜欢什么或会改进什么...', btn: '发送' },
  fr: { title: 'Comment était votre expérience?', placeholder: 'Dites-nous ce que vous avez aimé ou amélioreriez...', btn: 'Envoyer' },
  pt: { title: 'Como foi sua experiência?', placeholder: 'Conte-nos o que gostou ou melhoraria...', btn: 'Enviar' },
  de: { title: 'Wie war deine Erfahrung?', placeholder: 'Erzähl uns, was dir gefallen hat oder was du verbessern würdest...', btn: 'Senden' },
  it: { title: "Com'è stata la tua esperienza?", placeholder: 'Dicci cosa ti è piaciuto o miglioreresti...', btn: 'Invia' },
  ko: { title: '경험이 어떠셨나요?', placeholder: '좋았던 점이나 개선할 점을 알려주세요...', btn: '보내기' },
  ja: { title: '体験はいかがでしたか？', placeholder: '良かった点や改善点を教えてください...', btn: '送信' },
};

const THANKS_TEXT = {
  es: 'Gracias por tu opinión',
  en: 'Thanks for your feedback',
  zh: '感谢您的反馈',
  fr: 'Merci pour votre avis',
  pt: 'Obrigado pelo seu feedback',
  de: 'Danke für dein Feedback',
  it: 'Grazie per il tuo feedback',
  ko: '의견 감사합니다',
  ja: 'フィードバックありがとうございます',
};

function getLang() {
  const lang = (localStorage.getItem('lang') || 'es').toLowerCase().split('-')[0];
  return Object.prototype.hasOwnProperty.call(BETA_MESSAGES, lang) ? lang : 'es';
}

function injectStyles() {
  if (document.getElementById('findixi-beta-styles')) return;

  const style = document.createElement('style');
  style.id = 'findixi-beta-styles';
  style.textContent = `
    #findixi-beta-banner-wrapper {
      position: sticky;
      top: 0;
      z-index: 9997;
      width: 100%;
      background: #1a1a2e;
    }

    #findixi-beta-banner {
      position: sticky;
      top: 0;
      z-index: 9997;
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
      left: 0;
      right: 0;
      color: #a8d8ff;
      font-size: 12px;
      padding: 5px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 32px;
      box-sizing: border-box;
      font-family: 'Kanit', sans-serif;
    }

    #findixi-beta-banner .beta-pill {
      background: #23b4e9;
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      line-height: 1;
      flex-shrink: 0;
    }

    #findixi-beta-banner .beta-message {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    #findixi-beta-banner .beta-feedback {
      color: #23b4e9;
      text-decoration: underline;
      cursor: pointer;
      margin-left: auto;
      font-size: 11px;
      border: 0;
      background: transparent;
      padding: 0;
      font-family: inherit;
      flex-shrink: 0;
    }

    #findixi-feedback-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 99999;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    }

    #findixi-feedback-overlay.open {
      display: flex;
    }

    #findixi-feedback-modal {
      background: white;
      border-radius: 16px;
      padding: 24px;
      width: 90%;
      max-width: 360px;
      font-family: 'Kanit', sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    #findixi-feedback-title {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      color: #1f2937;
      text-align: center;
      font-weight: 700;
    }

    #findixi-feedback-stars {
      display: flex;
      justify-content: center;
      gap: 6px;
    }

    .findixi-star {
      font-size: 30px;
      line-height: 1;
      color: #d1d5db;
      cursor: pointer;
      user-select: none;
      transition: color 120ms ease;
    }

    .findixi-star.active {
      color: #f59e0b;
    }

    #findixi-feedback-comment {
      width: 100%;
      min-height: 100px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
    }

    #findixi-feedback-submit {
      border: 0;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 14px;
      font-weight: 700;
      background: #23b4e9;
      color: #fff;
      cursor: pointer;
      font-family: inherit;
    }

    #findixi-feedback-submit:disabled {
      opacity: 0.7;
      cursor: wait;
    }

    #findixi-feedback-status {
      min-height: 18px;
      text-align: center;
      margin: 0;
      font-size: 12px;
      color: #1f2937;
    }

    #findixi-feedback-status.error {
      color: #b91c1c;
    }
  `;

  document.head.appendChild(style);
}

function createBanner(lang) {
  const banner = document.createElement('div');
  banner.id = 'findixi-beta-banner';
  banner.style.cssText = `
    max-width: 480px;
    margin: 0 auto;
    padding: 5px 16px;
    display: flex;
    align-items: center;
    height: 32px;
    box-sizing: border-box;
  `;

  const pill = document.createElement('span');
  pill.className = 'beta-pill';
  pill.textContent = 'BETA';

  const message = document.createElement('span');
  message.className = 'beta-message';
  message.textContent = BETA_MESSAGES[lang] || BETA_MESSAGES.es;

  const feedback = document.createElement('button');
  feedback.type = 'button';
  feedback.className = 'beta-feedback';
  feedback.textContent = FEEDBACK_LABEL[lang] || FEEDBACK_LABEL.es;

  banner.append(pill, message, feedback);
  return { banner, feedback };
}

function createBannerWrapper(banner) {
  const wrapper = document.createElement('div');
  wrapper.id = 'findixi-beta-banner-wrapper';
  wrapper.style.cssText = `
    position: sticky;
    top: 0;
    z-index: 9997;
    width: 100%;
    background: #1a1a2e;
  `;
  wrapper.appendChild(banner);
  return wrapper;
}

function injectBanner(wrapper) {
  const headerContainer = document.getElementById('headerContainer');
  if (headerContainer) {
    headerContainer.insertAdjacentElement('afterend', wrapper);
    return;
  }

  const body = document.body;
  if (!body) return;

  if (body.firstChild) {
    body.insertBefore(wrapper, body.firstChild);
  } else {
    body.appendChild(wrapper);
  }
}

function adjustBannerTop(wrapper, headerRef) {
  const header = headerRef || document.querySelector('header');
  if (!header) {
    wrapper.style.top = '0px';
    return;
  }

  const syncTop = () => {
    const rect = header.getBoundingClientRect();
    const visibleBottom = Math.max(0, Math.round(rect.bottom));
    wrapper.style.top = `${visibleBottom}px`;
  };

  syncTop();

  const resizeObserver = new ResizeObserver(syncTop);
  resizeObserver.observe(header);

  const mutationObserver = new MutationObserver(syncTop);
  mutationObserver.observe(header, { attributes: true, attributeFilter: ['style', 'class'] });

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

  const observer = new MutationObserver(() => {
    const header = container.querySelector('header');
    if (header) {
      observer.disconnect();
      callback(header);
    }
  });
  observer.observe(container, { childList: true, subtree: true });

  const existing = container.querySelector('header');
  if (existing) {
    observer.disconnect();
    callback(existing);
  }
}

function createModal() {
  const overlay = document.createElement('div');
  overlay.id = 'findixi-feedback-overlay';

  const modal = document.createElement('div');
  modal.id = 'findixi-feedback-modal';

  const title = document.createElement('h3');
  title.id = 'findixi-feedback-title';

  const starsWrap = document.createElement('div');
  starsWrap.id = 'findixi-feedback-stars';

  const textarea = document.createElement('textarea');
  textarea.id = 'findixi-feedback-comment';

  const submit = document.createElement('button');
  submit.id = 'findixi-feedback-submit';
  submit.type = 'button';

  const status = document.createElement('p');
  status.id = 'findixi-feedback-status';

  modal.append(title, starsWrap, textarea, submit, status);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);

  return { overlay, title, starsWrap, textarea, submit, status };
}

function setupStars(container) {
  let rating = 0;
  let hoverRating = 0;

  const stars = Array.from({ length: 5 }, (_, i) => {
    const star = document.createElement('span');
    star.className = 'findixi-star';
    star.textContent = '★';
    star.dataset.value = String(i + 1);
    return star;
  });

  function paint(activeCount) {
    stars.forEach((star, index) => {
      star.classList.toggle('active', index < activeCount);
    });
  }

  stars.forEach((star) => {
    star.addEventListener('mouseenter', () => {
      hoverRating = Number(star.dataset.value || '0');
      paint(hoverRating);
    });

    star.addEventListener('click', () => {
      rating = Number(star.dataset.value || '0');
      paint(rating);
    });
  });

  container.addEventListener('mouseleave', () => {
    hoverRating = 0;
    paint(rating);
  });

  stars.forEach((star) => container.appendChild(star));

  return {
    get rating() {
      return rating;
    },
    reset() {
      rating = 0;
      hoverRating = 0;
      paint(0);
    },
  };
}

function setModalLanguage(lang, ui) {
  const text = FEEDBACK_MODAL[lang] || FEEDBACK_MODAL.es;
  ui.title.textContent = text.title;
  ui.textarea.placeholder = text.placeholder;
  ui.submit.textContent = text.btn;
}

function openModal(overlay) {
  overlay.classList.add('open');
}

function closeModal(overlay, ui, starsCtrl, lang) {
  overlay.classList.remove('open');
  ui.status.classList.remove('error');
  ui.status.textContent = '';
  ui.textarea.value = '';
  setModalLanguage(lang, ui);
  starsCtrl.reset();
}

function wireModal(lang, feedbackButton) {
  const ui = createModal();
  const starsCtrl = setupStars(ui.starsWrap);

  setModalLanguage(lang, ui);

  feedbackButton.addEventListener('click', () => {
    setModalLanguage(getLang(), ui);
    openModal(ui.overlay);
  });

  ui.overlay.addEventListener('click', (event) => {
    if (event.target === ui.overlay) {
      closeModal(ui.overlay, ui, starsCtrl, getLang());
    }
  });

  ui.submit.addEventListener('click', async () => {
    const currentLang = getLang();
    const rating = starsCtrl.rating;
    const comentario = ui.textarea.value || '';

    if (!rating) {
      ui.status.classList.add('error');
      ui.status.textContent = currentLang === 'es' ? 'Selecciona una calificación' : 'Select a rating';
      return;
    }

    ui.submit.disabled = true;
    ui.status.classList.remove('error');
    ui.status.textContent = '...';

    const { error } = await supabase
      .from('feedback_beta')
      .insert({
        estrellas: rating,
        comentario: comentario.trim() || null,
        idioma: currentLang,
        pagina: window.location.pathname,
        user_agent: navigator.userAgent,
      });

    ui.submit.disabled = false;

    if (error) {
      ui.status.classList.add('error');
      ui.status.textContent = currentLang === 'es'
        ? 'No se pudo enviar tu opinión. Inténtalo de nuevo.'
        : 'Could not send feedback. Please try again.';
      return;
    }

    ui.status.classList.remove('error');
    ui.status.textContent = THANKS_TEXT[currentLang] || THANKS_TEXT.es;

    setTimeout(() => {
      closeModal(ui.overlay, ui, starsCtrl, getLang());
    }, 2000);
  });
}

function initBetaBanner() {
  if (!BETA_MODE) return;
  if (!document.body) return;
  if (document.getElementById('findixi-beta-banner')) return;

  const lang = getLang();

  injectStyles();

  const { banner, feedback } = createBanner(lang);
  const wrapper = createBannerWrapper(banner);
  injectBanner(wrapper);
  waitForHeader((header) => {
    adjustBannerTop(wrapper, header);
  });
  wireModal(lang, feedback);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBetaBanner);
} else {
  initBetaBanner();
}
