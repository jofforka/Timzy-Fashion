/* Public contact details only; private settings/store is never read by visitors. */
(() => {
  'use strict';
  const fb = window.TIMZY_FIREBASE;
  if (!fb?.db) return;
  const safeUrl = value => {
    try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; }
    catch { return ''; }
  };
  fb.db.collection('publicSettings').doc('contact').get().then(doc => {
    if (!doc.exists) return;
    const c = doc.data();
    const setText = (selector, value) => { if (value) document.querySelectorAll(selector).forEach(el => { el.textContent = value; }); };
    const setHref = (selector, value) => { if (value) document.querySelectorAll(selector).forEach(el => { el.href = value; }); };
    const digits = typeof c.whatsapp === 'string' && /^[0-9]{8,15}$/.test(c.whatsapp) ? c.whatsapp : '';
    if (digits) {
      window.TIMZY_CONFIG.whatsappNumber = digits;
      setHref('a[href^="https://wa.me/"]', 'https://wa.me/' + digits);
    }
    if (typeof c.phone === 'string' && /^[+0-9 ()-]{7,30}$/.test(c.phone)) {
      setText('[data-public-contact="phone"]', c.phone);
      setHref('a[data-public-contact-link="phone"]', 'tel:' + c.phone.replace(/[^+0-9]/g,''));
    }
    if (typeof c.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
      setText('[data-public-contact="email"]', c.email);
      setHref('a[data-public-contact-link="email"]', 'mailto:' + c.email);
    }
    if (typeof c.address === 'string' && c.address.trim()) setText('[data-public-contact="address"]', c.address);
    if (typeof c.hours === 'string' && c.hours.trim()) setText('[data-public-contact="hours"]', c.hours);
    const map = safeUrl(c.mapsUrl);
    if (map) { const link = document.querySelector('[data-public-contact-link="maps"]'); if (link) { link.href = map; link.hidden = false; } }
    for (const network of ['instagram','facebook','tiktok']) {
      const url = safeUrl(c[network+'Url']);
      const link = document.querySelector('[data-public-contact-link="'+network+'"]');
      if (url && link) { link.href = url; link.hidden = false; }
    }
  }).catch(error => console.warn('Public contact settings unavailable; using website defaults.',error.code || error.message));
})();
