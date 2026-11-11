/* Product photo angle explorer: only shows merchant-provided images, never synthesizes 360° frames. */
(() => {
 'use strict';
 if (!document.body.classList.contains('page-product')) return;
 const root = document.getElementById('productDetails');
 if (!root) return;
 const setup = () => {
   const gallery = root.querySelector('.product-gallery');
   const thumbs = [...(gallery?.querySelectorAll('.thumb-btn') || [])];
   const image = gallery?.querySelector('#mainImage');
   if (!gallery || !image || gallery.dataset.angleExplorer || thumbs.length < 2) return;
   gallery.dataset.angleExplorer = 'ready';
   const controls = document.createElement('div');
   controls.className = 'angle-explorer';
   controls.innerHTML = '<button type="button" data-angle-prev aria-label="Previous product photograph">← Previous</button><span data-angle-status role="status" aria-live="polite"></span><button type="button" data-angle-next aria-label="Next product photograph">Next →</button>';
   const status = controls.querySelector('[data-angle-status]');
   const selected = () => Math.max(0, thumbs.findIndex(b => b.classList.contains('active')));
   const refresh = () => { status.textContent = 'Photo ' + (selected() + 1) + ' of ' + thumbs.length + ' · supplied images'; };
   const go = delta => { thumbs[(selected() + delta + thumbs.length) % thumbs.length].click(); refresh(); };
   controls.querySelector('[data-angle-prev]').addEventListener('click', () => go(-1));
   controls.querySelector('[data-angle-next]').addEventListener('click', () => go(1));
   gallery.querySelector('.thumbs')?.insertAdjacentElement('afterend', controls);
   gallery.querySelector('.thumbs')?.addEventListener('click', () => queueMicrotask(refresh));
   const color = root.querySelector('#fabricColor');
   color?.addEventListener('change', () => queueMicrotask(refresh));
   let touchStart = null;
   image.addEventListener('touchstart', event => {
     if (event.touches.length !== 1) { touchStart = null; return; }
     touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
   }, { passive: true });
   image.addEventListener('touchend', event => {
     if (!touchStart || event.changedTouches.length !== 1) { touchStart = null; return; }
     const dx = event.changedTouches[0].clientX - touchStart.x;
     const dy = event.changedTouches[0].clientY - touchStart.y;
     touchStart = null;
     if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
   }, { passive: true });
   image.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
   refresh();
 };
 new MutationObserver(setup).observe(root, {childList:true,subtree:true});
 setup();
})();
