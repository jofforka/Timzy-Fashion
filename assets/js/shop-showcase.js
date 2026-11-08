/* Minimal two-collection store.
   The existing Timzy catalogue, checkout and Firebase loading remain unchanged.
   Section tabs are virtual filters over the source product categories. */
(() => {
  'use strict';

  const app = window.Timzy;
  if (!app || !document.body.classList.contains('page-shop')) return;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
  const money = value => {
    const n = Number(String(value ?? 0).replace(/[^0-9.-]/g, '')) || 0;
    return (window.TIMZY_CONFIG?.currency || '₦') + n.toLocaleString('en-NG');
  };

  const materials = p => /^(fabrics?|materials?)$/i.test(String(p.category || ''))
    || /^(fabrics?\s*\/\s*materials?)$/i.test(String(p.productType || ''));
  const outfits = p => /^(senator|agbada|outfits?|ready-made|clothing)$/i.test(String(p.category || ''))
    || (/^(ready-made|custom sewing)$/i.test(String(p.productType || '')) && !materials(p));

  const params = new URLSearchParams(location.search);
  const section = String(params.get('section') || params.get('category') || '').toLowerCase();
  app.activeCategory = section === 'materials' || section === 'fabrics' ? 'Materials' : 'Outfits';

  const contact = document.querySelector('.floating-whatsapp');
  const phone = String(window.TIMZY_CONFIG?.whatsappNumber || '').replace(/[^0-9]/g, '');
  if (contact && phone) {
    contact.href = 'https://wa.me/' + phone;
    contact.rel = 'noopener noreferrer';
  }

  app.card = p => {
    const name = esc(p.name);
    const url = app.url(p);
    const image = esc(app.image(p));
    const preview = p.raw?.sampleListing === true;
    const tag = preview
      ? '<span class="showcase-card__badge">Sample preview</span>'
      : outfits(p) && /custom sewing/i.test(String(p.productType || ''))
        ? '<span class="showcase-card__badge">Made to measure</span>' : '';
    return `<article class="showcase-card" data-product-id="${esc(p.id)}" tabindex="-1">
      <a class="showcase-card__media" href="${url}" aria-label="View ${name}">
        <img src="${image}" alt="${name}" loading="lazy" decoding="async"
          onerror="this.onerror=null;this.src='assets/img/hero-senator-grey.jpg'">
        ${tag}
      </a>
      <div class="showcase-card__body">
        <h3 class="showcase-card__title"><a href="${url}">${name}</a></h3>
        <strong class="showcase-card__price">${money(p.price)}</strong>
        <a class="showcase-card__buy" href="${url}" aria-label="View ${name} and buy">View &amp; Buy <span aria-hidden="true">→</span></a>
      </div>
    </article>`;
  };

  app.catalog.categories = () => ['Outfits', 'Materials'];
  app.catalog.chips = () => {
    const root = document.querySelector('#chips');
    if (!root) return;
    root.querySelectorAll('[data-category]').forEach(el => {
      const active = el.dataset.category === app.activeCategory;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', String(active));
    });
  };

  app.catalog.filtered = () => {
    const active = app.activeCategory === 'Materials' ? materials : outfits;
    let rows = app.products.filter(p => active(p) &&
      (!app.search || JSON.stringify(p).toLowerCase().includes(app.search)));
    const num = value => Number(String(value || 0).replace(/[^0-9.-]/g, '')) || 0;
    if (app.sort === 'price-low') rows.sort((a, b) => num(a.price) - num(b.price));
    if (app.sort === 'price-high') rows.sort((a, b) => num(b.price) - num(a.price));
    if (app.sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
    if (app.sort === 'newest') rows.reverse();
    if (app.sort === 'featured') rows.sort((a, b) => Number(b.featured) - Number(a.featured));
    return rows;
  };

  app.catalog.init = () => {
    if (!document.querySelector('#productGrid')) return;
    app.catalog.chips();
    app.catalog.bind();
    app.catalog.render();
    const title = document.querySelector('#sectionTitle');
    const heading = () => {
      if (title) title.textContent = app.activeCategory === 'Materials' ? 'Fabrics & Materials' : 'Ready-made & Outfits';
    };
    heading();

    const root = document.querySelector('#chips');
    root?.addEventListener('click', e => {
      const tab = e.target.closest('[data-category]');
      if (tab) {
        heading();
        const url = new URL(location.href);
        url.searchParams.set('section', tab.dataset.category.toLowerCase());
        url.searchParams.delete('product');
        url.searchParams.delete('category');
        if (window.history?.replaceState) window.history.replaceState(null, '', url.pathname + url.search);
      }
    });

    const productId = params.get('product');
    if (productId && app.activeCategory === 'Materials') {
      const target = Array.from(document.querySelectorAll('#productGrid [data-product-id]'))
        .find(el => el.getAttribute('data-product-id') === productId);
      if (target) {
        target.classList.add('showcase-card--target');
        target.focus({ preventScroll: true });
        target.scrollIntoView?.({ behavior: 'auto', block: 'center' });
      }
    }
  };
})();
