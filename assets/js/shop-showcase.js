/* Timzy Fashion — compact shop cards.
   Browse first. Open the product detail page to select options before checkout. */
(() => {
  'use strict';

  const app = window.Timzy;
  if (!app || !document.body.classList.contains('page-shop')) return;

  // Keep the contact shortcut consistent with the checkout WhatsApp number.
  const contact = document.querySelector('.floating-whatsapp');
  const phone = String(window.TIMZY_CONFIG?.whatsappNumber || '').replace(/[^0-9]/g, '');
  if (contact && phone) {
    contact.href = 'https://wa.me/' + phone;
    contact.rel = 'noopener noreferrer';
  }

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const money = value => {
    const amount = Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
    return (window.TIMZY_CONFIG?.currency || '₦') + amount.toLocaleString('en-NG');
  };

  // Links (not "data-buy-now") deliberately route to details rather than
  // immediately changing the basket or bypassing size/quantity selection.
  app.card = p => {
    const name = esc(p.name), url = app.url(p), image = esc(app.image(p));
    return `<article class="showcase-card" data-product-id="${esc(p.id)}">
      <a class="showcase-card__media" href="${url}" aria-label="View ${name}">
        <img src="${image}" alt="${name}" loading="lazy" decoding="async"
          onerror="this.onerror=null;this.src='assets/img/hero-senator-grey.jpg'">
        ${p.badge ? `<span class="showcase-card__badge">${esc(p.badge)}</span>` : ''}
      </a>
      <div class="showcase-card__body">
        <p class="showcase-card__kicker">${esc(p.category)}</p>
        <h3 class="showcase-card__title"><a href="${url}">${name}</a></h3>
        <strong class="showcase-card__price">${money(p.price)}</strong>
        <a class="showcase-card__buy" href="${url}" aria-label="View ${name} and buy">
          Buy Now <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>`;
  };

  app.catalog.chips = () => {
    const el = document.querySelector('#chips');
    if (!el) return;
    el.innerHTML = app.catalog.categories().map(category => {
      const count = category === 'All' ? app.products.length :
        app.products.filter(p => p.category === category).length;
      const active = category === app.activeCategory;
      return `<button class="chip ${active ? 'active' : ''}" type="button"
        data-category="${esc(category)}" aria-pressed="${active}">
        ${esc(category)} <span class="chip-count">${count}</span>
      </button>`;
    }).join('');
  };
})();