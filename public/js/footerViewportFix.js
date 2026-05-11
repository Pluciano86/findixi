export function attachFooterViewportFix(footerEl) {
  if (!footerEl) return;

  const isEditableTarget = (target) => {
    if (!(target instanceof Element)) return false;
    if (target instanceof HTMLInputElement) {
      const type = String(target.type || '').toLowerCase();
      const nonText = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'date', 'datetime-local', 'month', 'time', 'week']);
      return !nonText.has(type);
    }
    return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable === true;
  };

  const shouldHideForKeyboard = () => {
    const visual = window.visualViewport?.height ?? window.innerHeight;
    const layout = document.documentElement.clientHeight;
    const keyboardLikelyOpen = (layout - visual) > 120;
    const focusedEditable = isEditableTarget(document.activeElement);
    return keyboardLikelyOpen && focusedEditable;
  };

  const updateOffset = () => {
    if (shouldHideForKeyboard()) {
      footerEl.style.setProperty('--footer-offset', '0px');
      footerEl.style.setProperty('display', 'none');
      return;
    }

    footerEl.style.removeProperty('display');
    const visual = window.visualViewport?.height ?? window.innerHeight;
    const layout = document.documentElement.clientHeight;
    const offset = visual - layout;
    footerEl.style.setProperty('--footer-offset', `${offset}px`);
  };

  updateOffset();

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateOffset);
    window.visualViewport.addEventListener('scroll', updateOffset);
  }

  window.addEventListener('resize', updateOffset);
  document.addEventListener('focusin', updateOffset);
  document.addEventListener('focusout', updateOffset);
}

const autoFooters = document.querySelectorAll('[data-footer-fixed]');
autoFooters.forEach((footer) => attachFooterViewportFix(footer));
