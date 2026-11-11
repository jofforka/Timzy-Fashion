/* Progressive product image detail viewer. Image zoom, not a 3D model. */
(() => {
 'use strict';
 if (!document.body.classList.contains('page-product')) return;
 const root = document.getElementById('productDetails');
 if (!root) return;
 let dialog;
 let scale = 1;
 const applyScale = () => { if (dialog) dialog.querySelector('.fabric-zoom-frame img').style.transform = 'scale(' + scale + ')'; };
 const adjust = delta => { scale = Math.max(1, Math.min(3, Math.round((scale + delta) * 10) / 10)); applyScale(); if (dialog) dialog.querySelector('[data-zoom-level]').textContent = Math.round(scale * 100) + '%'; };
 const close = () => { if (dialog?.open) dialog.close(); };
 const setup = () => {
   const main = root.querySelector('#mainImage');
   if (!main || main.dataset.zoomReady) return;
   main.dataset.zoomReady = 'true';
   const trigger = document.createElement('button');
   trigger.type = 'button';
   trigger.className = 'fabric-zoom-trigger';
   trigger.textContent = 'Explore fabric detail';
   trigger.setAttribute('aria-label', 'Enlarge current product image');
   main.closest('.gallery-main')?.appendChild(trigger);
   trigger.addEventListener('click', () => {
     if (!dialog) {
       dialog = document.createElement('dialog');
       dialog.className = 'fabric-zoom-dialog';
       dialog.setAttribute('aria-label', 'Product photograph detail viewer');
       dialog.innerHTML = '<div class="fabric-zoom-toolbar"><strong>Fabric detail · photographic zoom</strong><div class="fabric-zoom-controls"><button type="button" data-zoom-out aria-label="Zoom out">−</button><output data-zoom-level>100%</output><button type="button" data-zoom-in aria-label="Zoom in">+</button><button type="button" data-zoom-reset>Reset</button><button type="button" data-close-zoom aria-label="Close image detail">Close ✕</button></div></div><div class="fabric-zoom-frame"><img alt=""></div><p>Images show the supplied product photography. Confirm color and texture before ordering.</p>';
       document.body.appendChild(dialog);
       dialog.querySelector('[data-close-zoom]').addEventListener('click', close);
       dialog.querySelector('[data-zoom-in]').addEventListener('click', () => adjust(0.25));
       dialog.querySelector('[data-zoom-out]').addEventListener('click', () => adjust(-0.25));
       dialog.querySelector('[data-zoom-reset]').addEventListener('click', () => { scale = 1; applyScale(); dialog.querySelector('[data-zoom-level]').textContent = '100%'; });
       dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
       dialog.addEventListener('keydown', event => {
         if (event.key === '+' || event.key === '=') { event.preventDefault(); adjust(0.25); }
         else if (event.key === '-') { event.preventDefault(); adjust(-0.25); }
         else if (event.key === '0') { event.preventDefault(); scale = 1; applyScale(); dialog.querySelector('[data-zoom-level]').textContent = '100%'; }
       });
     }
     const image = dialog.querySelector('img');
     image.src = main.currentSrc || main.src;
     image.alt = main.alt;
     scale = 1;
     applyScale();
     dialog.querySelector('[data-zoom-level]').textContent = '100%';
     dialog.showModal();
   });
 };
 const observer = new MutationObserver(setup);
 observer.observe(root, {childList:true,subtree:true});
 setup();
})();
