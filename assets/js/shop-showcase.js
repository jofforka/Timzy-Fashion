/* Timzy Fashion — shop-only card renderer.
   The existing Firebase/JSON catalog, basket, filters and checkout stay in charge. */
(() => {
  'use strict';

  const app = window.Timzy;
  if (!app || !document.body.classList.contains('page-shop')) return;

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const priceText = value => {
    const amount = Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
    const currency = window.TIMZY_CONFIG?.currency || '₦';
    return currency + amount.toLocaleString('en-NG');
  };

  // Intentionally override only the renderer on this page.
  // The existing global click listener handles data-buy-now by adding to basket,
  // then opening the existing checkout page.
  app.card = product => {
    const p = product;
    const id = escapeHtml(p.id);
    const name = escapeHtml(p.name);
    const url = app.url(p);
    const image = escapeHtml(app.image(p));
    const category = escapeHtml(p.category);
    const badge = escapeHtml(p.badge || '');
    const type = escapeHtml(p.productType || '');
    const detail = escapeHtml(p.fabricType || p.color || '');
    const label = [category, type].filter(Boolean).join(' · ');
    return `<article class="showcase-card" data-product-id="${id}">
      <a class="showcase-card__media" href="${url}" aria-label="View ${name} details">
        <img src="${image}" alt="${name}" loading="lazy" decoding="async"
             onerror="this.onerror=null;this.src='assets/img/hero-senator-grey.jpg'">
        ${badge ? `<span class="showcase-card__badge">${badge}</span>` : ''}
      </a>
      <div class="showcase-card__body">
        <div class="showcase-card__kicker"><span>${category}</span>${type ? `<span>${type}</span>` : ''}</div>
        <h3 class="showcase-card__title"><a href="${url}">${name}</a></h3>
        <p class="showcase-card__detail">${detail || '&nbsp;'}</p>
        <strong class="showcase-card__price">${priceText(p.price)}</strong>
        <div class="showcase-card__actions">
          <button type="button" class="showcase-card__buy" data-buy-now="${id}" aria-label="Buy ${name} now">Buy Now <span aria-hidden="true">→</span></button>
          <button type="button" class="showcase-card__add" data-add-bag="${id}" aria-label="Add ${name} to bag" title="Add to bag">+</button>
        </div>
        <p class="showcase-card__footer"><a href="${url}">View details &amp; measurements</a></p>
      </div>
    </article>`;
  };

  // Reuse the existing category behavior while making filter state readable
  // and showing the number of published items in each category.
  app.catalog.chips = () => {
    const el = document.querySelector('#chips');
    if (!el) return;
    el.innerHTML = app.catalog.categories().map(category => {
      const count = category === 'All'
        ? app.products.length
        : app.products.filter(product => product.category === category).length;
      const active = category === app.activeCategory;
      return `<button class="chip ${active ? 'active' : ''}" type="button"
        data-category="${escapeHtml(category)}" aria-pressed="${active}">
        ${escapeHtml(category)} <span class="chip-count">${count}</span>
      </button>`;
    }).join('');
  };
})();
