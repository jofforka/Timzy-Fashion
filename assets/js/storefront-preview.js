/* Timzy Fashion — small, clearly labelled catalogue preview.
 * The live Firestore collection may have no products mapped to the new Outfit
 * or Materials section. Supply examples from bundled sample data ONLY when a
 * section is empty, so the two-section journey can be tested. Do not overwrite
 * or impersonate real stock and do not use these examples for actual orders.
 */
(() => {
  'use strict';

  const app = window.Timzy;
  if (!app) return;
  const onShop = document.body.classList.contains('page-shop');
  const onProduct = document.body.classList.contains('page-product');
  if (!onShop && !onProduct) return;

  const previewCatalog = Object.freeze([
    { sourceId: 'hausa-classic-kaftan-senator', section: 'Outfits' },
    { sourceId: 'hausa-royal-senator-wear', section: 'Outfits' },
    { sourceId: 'brocade-senator-fabric', section: 'Materials' }
  ]);

  const isMaterial = product => /^(fabrics?|materials?)$/i.test(String(product.category || '').trim()) ||
    /^(fabric\s*\/\s*material|materials?)$/i.test(String(product.productType || '').trim());
  const isOutfit = product => !isMaterial(product) &&
    (/^(senator|agbada|outfits?|ready-made|clothing)$/i.test(String(product.category || '').trim()) ||
      /^(ready-made|custom sewing)$/i.test(String(product.productType || '').trim()));

  function selectedPreviewRecords(rows) {
    const byId = new Map(Array.isArray(rows) ? rows.map(row => [String(row.id), row]) : []);
    return previewCatalog.flatMap(({ sourceId, section }) => {
      const source = byId.get(sourceId);
      if (!source) return [];
      return [{
        ...source,
        id: 'preview-' + sourceId,
        status: 'Published',
        badge: 'Sample · not confirmed stock',
        sampleListing: true,
        previewSection: section,
        featured: sourceId === 'hausa-classic-kaftan-senator',
        description: source.description +
          ' This is a sample catalogue record for testing. Stock, photos and prices must be confirmed with Timzy Fashion.'
      }];
    });
  }

  function addWhenMissing(current, sampleRows, queryId, page) {
    const output = [...current];
    const available = new Set(output.map(item => String(item.id)));
    const add = item => {
      if (!available.has(String(item.id))) {
        output.push(item);
        available.add(String(item.id));
      }
    };

    if (page === 'product') {
      // Direct sample product links must open, and related sample fabric should
      // also exist so its detail link works.
      if (queryId && previewCatalog.some(x => 'preview-' + x.sourceId === queryId)) {
        sampleRows.forEach(add);
      }
    } else {
      const hasOutfits = output.some(isOutfit);
      const hasMaterials = output.some(isMaterial);
      if (!hasOutfits) sampleRows.filter(isOutfit).forEach(add);
      if (!hasMaterials || !hasOutfits) sampleRows.filter(isMaterial).forEach(add);
    }
    return output;
  }

  const previousLoad = app.loadProducts.bind(app);
  app.loadProducts = async () => {
    await previousLoad();
    const existing = app.products;
    const queryId = onProduct ? new URLSearchParams(location.search).get('id') : null;
    const needSamples = onShop
      ? !existing.some(isOutfit) || !existing.some(isMaterial)
      : Boolean(queryId && previewCatalog.some(x => 'preview-' + x.sourceId === queryId));
    if (!needSamples) return;

    try {
      const response = await fetch(window.TIMZY_CONFIG?.productDataUrl || 'data/products.json',
        { cache: 'no-store' });
      if (!response.ok) throw new Error('Sample catalogue unavailable');
      const data = await response.json();
      const samples = app.normalize(selectedPreviewRecords(data));
      app.products = addWhenMissing(existing, samples, queryId, onProduct ? 'product' : 'shop');
      if (app.products.some(p => p.raw?.sampleListing)) {
        const note = document.querySelector('#catalogSampleNotice');
        if (note) note.hidden = false;
      }
    } catch (error) {
      console.warn('Sample catalogue unavailable:', error);
    }
  };

  window.TimzyPreviewCatalog = { isMaterial, isOutfit, selectedPreviewRecords, addWhenMissing };
})();