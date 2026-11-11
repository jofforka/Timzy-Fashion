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
   refresh();
 };
 new MutationObserver(setup).observe(root, {childList:true,subtree:true});
 setup();
})();
