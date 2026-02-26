export function attachFooterViewportFix(footerEl) {
  if (!footerEl) return;

  const updateOffset = () => {
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
}

const autoFooters = document.querySelectorAll('[data-footer-fixed]');
autoFooters.forEach((footer) => attachFooterViewportFix(footer));
