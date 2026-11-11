/* Progressive product image detail viewer. Image zoom, not a 3D model. */
(() => {
 'use strict';
 if (!document.body.classList.contains('page-product')) return;
 const root = document.getElementById('productDetails');
 if (!root) return;
 let dialog;
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
       dialog.innerHTML = '<div class="fabric-zoom-toolbar"><strong>Fabric detail · photographic zoom</strong><button type="button" data-close-zoom aria-label="Close image detail">Close ✕</button></div><div class="fabric-zoom-frame"><img alt=""></div><p>Images show the supplied product photography. Confirm color and texture before ordering.</p>';
       document.body.appendChild(dialog);
       dialog.querySelector('[data-close-zoom]').addEventListener('click', close);
       dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
     }
     const image = dialog.querySelector('img');
     image.src = main.currentSrc || main.src;
     image.alt = main.alt;
     image.style.transform = '';
     dialog.showModal();
   });
 };
 const observer = new MutationObserver(setup);
 observer.observe(root, {childList:true,subtree:true});
 setup();
})();
