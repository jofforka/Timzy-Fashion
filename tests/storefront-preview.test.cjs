/* node tests/storefront-preview.test.cjs
 * Ensure real stock takes priority, but empty sections display a safe example.
 */
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const seed = JSON.parse(read('data/products.json'));
const script = read('assets/js/storefront-preview.js');

const reference = {
  outfit: 'preview-hausa-classic-kaftan-senator',
  custom: 'preview-hausa-royal-senator-wear',
  fabric: 'preview-brocade-senator-fabric'
};

async function scenario(page, current, query = '') {
  const body = { classList: { contains(name) { return name === 'page-' + page; } } };
  const notice = { hidden: true };
  const document = {
    body,
    querySelector(selector) { return selector === '#catalogSampleNotice' ? notice : null; }
  };
  const location = { search: query };
  const window = { TIMZY_CONFIG: { productDataUrl: 'data/products.json' } };
  let fetched = false;
  const app = {
    products: [],
    normalize(rows) { return rows.filter(p => p.status !== 'Draft').map(p => ({
      ...p,
      raw: p,
      images: [p.image1].filter(Boolean)
    })); },
    async loadProducts() { this.products = current.slice(); }
  };
  window.Timzy = app;
  const context = vm.createContext({
    window, document, location, URLSearchParams,
    fetch: async (url) => {
      assert.equal(url, 'data/products.json');
      fetched = true;
      return { ok: true, async json() { return seed; } };
    },
    console: { warn() {} }
  });
  vm.runInContext(script, context);
  await app.loadProducts();
  return { rows: app.products, api: window.TimzyPreviewCatalog, notice, fetched };
}

(async () => {
  const empty = await scenario('shop', []);
  assert.equal(empty.rows.length, 3, 'Two outfit previews and a fabric preview appear');
  assert.ok(empty.rows.some(p => p.id === reference.outfit));
  assert.ok(empty.rows.some(p => p.id === reference.custom));
  assert.ok(empty.rows.some(p => p.id === reference.fabric));
  assert.ok(empty.rows.every(p => p.raw.sampleListing && p.badge.includes('Sample')));
  assert.equal(empty.notice.hidden, false, 'Demo warning is shown');

  const oneMaterial = await scenario('shop', [{ id: 'real-fabric', category: 'Fabrics', name: 'Live fabric' }]);
  assert.ok(oneMaterial.rows.some(p => p.id === 'real-fabric'), 'Do not remove real fabric');
  assert.ok(oneMaterial.rows.some(p => p.id === reference.outfit), 'Add missing ready-made preview');
  assert.ok(oneMaterial.rows.some(p => p.id === reference.custom), 'Add a custom outfit to test fabric link');
  assert.ok(!oneMaterial.rows.some(p => p.id === reference.fabric), 'Do not add sample fabric alongside real materials; direct preview pages resolve their own related samples');

  const oneOutfit = await scenario('shop', [{ id: 'real-outfit', category: 'Senator', name: 'Live outfit' }]);
  assert.ok(oneOutfit.rows.some(p => p.id === 'real-outfit'));
  assert.ok(oneOutfit.rows.some(p => p.id === reference.fabric), 'Add missing fabric preview');
  assert.ok(!oneOutfit.rows.some(p => p.id === reference.outfit), 'Do not add unnecessary outfit preview');

  const full = await scenario('shop', [
    { id: 'real-outfit', category: 'Senator', name: 'Live outfit' },
    { id: 'real-fabric', category: 'Fabrics', name: 'Live fabric' }
  ]);
  assert.equal(full.rows.length, 2, 'Never replace or clutter a complete live catalog');
  assert.equal(full.fetched, false, 'Avoid unnecessary fallback requests');
  assert.equal(full.notice.hidden, true);

  const direct = await scenario('product', [], '?id=' + reference.outfit);
  assert.ok(direct.rows.some(p => p.id === reference.outfit), 'Sample outfit detail URL resolves');
  assert.ok(direct.rows.some(p => p.id === reference.custom), 'Other outfit preview is accessible');
  assert.ok(direct.rows.some(p => p.id === reference.fabric), 'Related fabric detail URL resolves');
  const fabricDetail = await scenario('product', [], '?id=' + reference.fabric);
  assert.ok(fabricDetail.rows.some(p => p.id === reference.fabric), 'Sample fabric detail URL resolves');

  const realDetail = await scenario('product', [{ id: 'live-outfit', category: 'Senator' }], '?id=live-outfit');
  assert.equal(realDetail.rows.length, 1, 'Real product details remain unchanged');
  assert.equal(realDetail.fetched, false);

  const noWrongDuplicate = empty.api.addWhenMissing(
    [{ id: reference.outfit, name: 'Real record' }],
    empty.rows,
    null, 'shop'
  );
  assert.equal(noWrongDuplicate.filter(x => x.id === reference.outfit).length, 1,
    'Preview may not overwrite an ID already in real data');

  const sampleOutfit = empty.rows.find(x => x.id === reference.custom);
  assert.match(sampleOutfit.fabricType, /brocade/i, 'Demo outfit uses Brocade family');
  const sampleFabric = empty.rows.find(x => x.id === reference.fabric);
  assert.match(sampleFabric.name, /Brocade/, 'Matching material family is available');
  assert.ok(sampleOutfit.raw.sampleListing && sampleFabric.raw.sampleListing,
    'Source data clearly declares both as previews');

  console.log('PASS: Shop preview outfits, fabric, links, live-stock preservation and demo labels.');
})().catch(err => { console.error(err); process.exitCode = 1; });
