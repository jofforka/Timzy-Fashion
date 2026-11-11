/* Public contact display: reads only the whitelisted publicContact/store document. */
(() => {
  'use strict';
  const fallback = window.TIMZY_CONFIG || {};
  const digits = value => String(value || '').replace(/\D/g, '');
  const setText = (selector, value) => { const el = document.querySelector(selector); if (el && value) el.textContent = value; };
  const apply = data => {
    const wa = digits(data.whatsappNumber || fallback.whatsappNumber);
    const phone = String(data.contactPhone || (wa ? '+' + wa : '')).trim();
    const email = String(data.contactEmail || '').trim();
    const address = String(data.pickupAddress || fallback.pickupAddress || '').trim();
    const hours = String(data.businessHours || '').trim();
    if (wa && /^\d{8,15}$/.test(wa)) {
      document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a => { a.href = 'https://wa.me/' + wa; });
      // The enquiry form uses the shared WhatsApp sender, which reads this config.
      window.TIMZY_CONFIG.whatsappNumber = wa;
    }
    if (phone) {
      const card = document.querySelector('.contact-grid a[href^="tel:"]');
      if (card) { card.href = 'tel:' + digits(phone); const value = card.querySelector('strong'); if (value) value.textContent = phone; }
    }
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const card = document.querySelector('.contact-grid a[href^="mailto:"]');
      if (card) { card.href = 'mailto:' + email; const value = card.querySelector('strong'); if (value) value.textContent = email; }
    }
    if (address) {
      setText('.contact-grid .contact-card:last-child strong', address);
      setText('.business-list p:first-child', 'Location: ' + address);
      setText('.map-placeholder strong', address);
    }
    if (hours) setText('.business-list p:nth-child(2)', 'Business Hours: ' + hours);
  };
  const run = async () => {
    apply({});
    try {
      const db = window.TIMZY_FIREBASE?.db;
      if (!db) return;
      const snapshot = await db.collection('publicContact').doc('store').get();
      if (snapshot.exists) apply(snapshot.data() || {});
    } catch (error) { console.warn('Public contact settings unavailable; using site defaults.'); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
