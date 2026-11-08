/* node tests/shop-showcase.test.cjs
 * Offline regression checks for catalogue, filters, Buy Now and safe checkout messaging.
 * Node built-ins only. No Firebase credentials or external services needed.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const products = JSON.parse(read('data/products.json'));
const shop = read('shop.html');
const checkout = read('checkout.html');
const css = read('assets/css/shop-showcase.css');

const listeners = {};
const store = {};
const nodes = {
  '#chips': { innerHTML: '' },
  '.floating-whatsapp': { href: '', rel: '' },
  '#toastHost': { insertAdjacentHTML() {} }
};
const location = { href: 'https://test.example/shop.html', pathname: '/shop.html', search: '' };
const document = {
  body: {
    classList: { contains(value) { return value === 'page-shop'; } },
    insertAdjacentHTML() {}
  },
  addEventListener(event, callback) {
    (listeners[event] ||= []).push(callback);
  },
  querySelector(selector) { return nodes[selector] || null; },
  querySelectorAll() { return []; }
};
const window = { location, TIMZY_FIREBASE: null };
const localStorage = {
  getItem(key) { return store[key] ?? null; },
  setItem(key, value) { store[key] = value; }
};
const context = vm.createContext({
  window, document, location, localStorage,
  console: { log() {}, warn() {}, error() {} },
  setTimeout() {}, clearTimeout() {},
  URLSearchParams, URL, Date
});

vm.runInContext(read('assets/js/config.js'), context, { filename: 'config.js' });
vm.runInContext(read('assets/js/app.js'), context, { filename: 'app.js' });
vm.runInContext(read('assets/js/shop-showcase.js'), context, { filename: 'shop-showcase.js' });

const app = window.Timzy;
assert.ok(app, 'Store application must initialize');
app.products = app.normalize(products);
assert.equal(app.products.length, products.length, 'All published fallback products remain available');
assert.equal(app.products[0].price, 185000, 'Catalogue prices are unchanged');

const first = app.products[0];
const sample = app.card(first);
assert.match(sample, /showcase-card__media/, 'Cards show portrait images');
assert.match(sample, /data-buy-now=/, 'Cards include Buy Now');
assert.match(sample, /data-add-bag=/, 'Cards include Add to Bag');
assert.match(sample, /₦185,000/, 'Prices display in naira');
assert.match(sample, /product.html\?id=/, 'Product details remain accessible');

const injected = app.card({ ...first, name: '<script>bad()</script>', id: 'x"><img src=x>' });
assert.doesNotMatch(injected, /<script>/, 'Product names must be escaped');
assert.doesNotMatch(injected, /data-buy-now="x"><img/, 'IDs must not escape HTML attributes');

app.catalog.chips();
assert.match(nodes['#chips'].innerHTML, /aria-pressed="true"/, 'Current filter is announced');
app.activeCategory = 'Agbada';
assert.ok(app.catalog.filtered().every(item => item.category === 'Agbada'), 'Category filter works');
app.activeCategory = 'All';
app.search = 'hausa royal senator';
assert.ok(app.catalog.filtered().some(item => item.id === first.id), 'Search works');
app.search = '';
app.sort = 'price-low';
const sorted = app.catalog.filtered();
assert.ok(sorted.every((item, index) => !index || Number(sorted[index - 1].price) <= Number(item.price)), 'Price sorting works');

app.bindGlobalActions();
const click = (selector, field, id) => {
  const target = { closest(requested) { return requested === selector ? { dataset: { [field]: id } } : null; } };
  for (const listener of listeners.click || []) {
    listener({ target, preventDefault() {}, stopPropagation() {} });
  }
};
click('[data-add-bag]', 'addBag', first.id);
assert.equal(app.cart.count(), 1, 'Add to Bag increments basket');
click('[data-buy-now]', 'buyNow', first.id);
assert.equal(app.cart.count(), 2, 'Buy Now puts product in basket');
assert.equal(window.location.href, 'checkout.html', 'Buy Now goes to checkout');
assert.equal(nodes['.floating-whatsapp'].href, 'https://wa.me/' + window.TIMZY_CONFIG.whatsappNumber, 'Contact link uses central config');
assert.equal(nodes['.floating-whatsapp'].rel, 'noopener noreferrer');

assert.match(shop, /shop-showcase\.css\?v=1/, 'Shop loads its scoped CSS');
assert.match(shop, /shop-showcase\.js\?v=1/, 'Shop loads its scoped script');
assert.match(shop, /showcase-skip-link/, 'Keyboard users can skip the navigation');
assert.match(css, /max-width:\s*620px/, 'Mobile layout rules exist');
assert.doesNotMatch(checkout, /0000000000|BANK NAME/, 'Fake transfer details must not appear');
assert.match(checkout, /Files are not uploaded through this checkout form/, 'Measurement upload expectations are clear');
assert.match(checkout, /Do not send money to an unverified account/, 'Bank transfer instructions are explicit');

console.log('PASS: Timzy shop showcase, catalogue, basket and checkout regression checks.');
