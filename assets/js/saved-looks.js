/* Timzy saved looks: device-local only; no customer or investor data stored remotely. */
(() => {
  'use strict';
  const app = window.Timzy;
  if (!app || !document.body.classList.contains('page-shop')) return;
  const key = 'timzy.savedLooks.v1';
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.length <= 200).slice(0, 100) : [];
    } catch { return []; }
  };
  let saved = new Set(read()), onlySaved = false;
  const originalCard = app.card;
  const originalFiltered = app.catalog.filtered;
  const safe = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const updateCount = () => {
    const button = document.getElementById('savedLooksFilter');
    if (button) {
      button.textContent = 'Saved looks (' + saved.size + ')';
      button.setAttribute('aria-pressed', String(onlySaved));
    }
  };
  app.card = p => {
    const id = String(p.id);
    const active = saved.has(id);
    return originalCard(p).replace('</article>', '<button class="saved-look-btn" type="button" data-save-look="' +
      safe(id) + '" aria-pressed="' + active + '" aria-label="' +
      (active ? 'Remove from saved looks: ' : 'Save look: ') + safe(p.name) + '">' +
      (active ? '♥ Saved' : '♡ Save look') + '</button></article>');
  };
  app.catalog.filtered = () => {
    const rows = originalFiltered();
    return onlySaved ? rows.filter(p => saved.has(String(p.id))) : rows;
  };
  const controls = document.querySelector('.shop-controls');
  if (!controls) return;
  const filter = document.createElement('button');
  filter.type = 'button';
  filter.id = 'savedLooksFilter';
  filter.className = 'saved-looks-filter';
  filter.setAttribute('aria-pressed', 'false');
  controls.appendChild(filter);
  updateCount();
  filter.addEventListener('click', () => {
    onlySaved = !onlySaved;
    updateCount();
    app.catalog.render();
  });
  document.getElementById('productGrid')?.addEventListener('click', event => {
    const button = event.target.closest('[data-save-look]');
    if (!button) return;
    const id = button.getAttribute('data-save-look');
    if (!app.products.some(p => String(p.id) === id)) return;
    if (saved.has(id)) saved.delete(id);
    else saved.add(id);
    try { localStorage.setItem(key, JSON.stringify([...saved])); }
    catch { window.alert('Your browser could not save this look. Check storage settings.'); return; }
    updateCount();
    app.catalog.render();
  });
})();
