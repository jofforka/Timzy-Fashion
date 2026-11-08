/* Shared public-site interactions; product/shop-specific scripts stay scoped.
 * Existing Timzy core owns cart operations, checkout, and catalogue data.
 */
(() => {
  'use strict';
  const ready = () => {
    const navButton = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (navButton && links) {
      navButton.setAttribute('aria-controls', 'navLinks');
      navButton.setAttribute('aria-expanded', String(links.classList.contains('open')));
      navButton.addEventListener('click', () => {
        navButton.setAttribute('aria-expanded', String(links.classList.contains('open')));
      });
      links.addEventListener('click', e => {
        if (e.target.closest('a')) {
          links.classList.remove('open');
          navButton.setAttribute('aria-expanded', 'false');
        }
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && links.classList.contains('open')) {
          links.classList.remove('open');
          navButton.setAttribute('aria-expanded', 'false');
          navButton.focus();
        }
      });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
