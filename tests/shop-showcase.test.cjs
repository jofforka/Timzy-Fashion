/* node tests/shop-showcase.test.cjs
 * Mobile two-column catalogue and product-first buying regression tests.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const products = JSON.parse(read('data/products.json'));
const shop = read('shop.html');
const productPage = read('product.html');
const checkout = read('checkout.html');
const css = read('assets/css/shop-showcase.css');
const productCss = read('assets/css/product-purchase.css');

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
  addEventListener(event, callback) { (listeners[event] ||= []).push(callback); },
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
assert.ok(app, 'Timzy app initializes');
app.products = app.normalize(products);
assert.equal(app.products.length, 35, 'All published product records retained');
assert.equal(app.products[0].price, 185000, 'Product prices unchanged');

const first = app.products[0];
const card = app.card(first);
assert.match(card, /showcase-card__media/, 'Card has photo');
assert.match(card, /showcase-card__buy/, 'Card has Buy Now');
assert.match(card, /₦185,000/, 'Card has Naira price');
assert.match(card, /product.html\?id=/, 'Card navigates to product detail');
assert.doesNotMatch(card, /data-buy-now=|data-add-bag=/, 'Card cannot bypass variant selection');
const detailHref = app.url(first);
assert.ok(card.includes('href="' + detailHref + '"'), 'Photo, title and Buy Now open the correct product');
assert.equal(app.cart.count(), 0, 'Browsing the collection does not add items to basket');

const injected = app.card({ ...first, name: '<script>bad()</script>', id: 'x"><img src=x>' });
assert.doesNotMatch(injected, /<script>/, 'Product names must be escaped');
assert.doesNotMatch(injected, /data-product-id="x"><img/, 'Product IDs must be escaped');

app.catalog.chips();
assert.match(nodes['#chips'].innerHTML, /aria-pressed="true"/, 'Selected category announced');
app.activeCategory = 'Agbada';
assert.ok(app.catalog.filtered().every(p => p.category === 'Agbada'), 'Category filter');
app.activeCategory = 'All';
app.search = 'hausa royal senator';
assert.ok(app.catalog.filtered().some(p => p.id === first.id), 'Search filter');
app.search = '';
app.sort = 'price-low';
const sorted = app.catalog.filtered();
assert.ok(sorted.every((p, i) => !i || Number(sorted[i - 1].price) <= Number(p.price)), 'Price sort');

assert.equal(nodes['.floating-whatsapp'].href, 'https://wa.me/' + window.TIMZY_CONFIG.whatsappNumber);
assert.match(shop, /shop-showcase\.css\?v=2/, 'Shop v2 stylesheet');
assert.match(shop, /shop-showcase\.js\?v=2/, 'Shop v2 script');
assert.match(shop, /showcase-skip-link/, 'Keyboard skip link');
const mobile = css.slice(css.lastIndexOf('@media (max-width: 620px)'));
assert.match(mobile, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  'Two product cards per line at mobile widths');
const veryNarrow = css.slice(css.lastIndexOf('@media (max-width: 350px)'));
assert.match(veryNarrow, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  'Two product cards per line on narrow phones');

assert.match(productPage, /product-purchase\.js\?v=1/, 'Product purchase script linked');
assert.match(productPage, /product-purchase\.css\?v=1/, 'Product purchase styles linked');
assert.match(productPage, /Back to collection/, 'Return to shop link');
assert.match(productCss, /product-purchase-actions/, 'Product purchase buttons styled');

document.body.classList.contains = value => value === 'page-product';
vm.runInContext(read('assets/js/product-purchase.js'), context, { filename: 'product-purchase.js' });
const purchase = window.TimzyPurchase;
assert.ok(purchase, 'Product purchase flow initializes');
assert.equal(JSON.stringify(purchase.sizeOptions('M, L, XL, XXL')),
  JSON.stringify(['M', 'L', 'XL', 'XXL']), 'Ready-made size selector');
assert.equal(purchase.sizeOptions('40–46').length, 7, 'Shoe size range selector');
assert.equal(purchase.sizeOptions('Custom')[0], 'Custom', 'Custom tailoring selection');

assert.equal(purchase.addSelectedItem(first, 'Custom', 2), true, 'Selected product added');
assert.equal(app.cart.count(), 2, 'Quantity retained');
assert.equal(purchase.addSelectedItem(first, 'Custom', 1), true, 'Same variant combines quantities');
assert.equal(app.cart.count(), 3);
assert.equal(purchase.addSelectedItem(first, '', 1), false, 'Size required');
assert.equal(purchase.addSelectedItem(first, 'Custom', 0), false, 'Quantity must be positive');
assert.equal(purchase.addSelectedItem(first, 'Custom', 100), false, 'Quantity bounded');
const readyMade = app.products.find(p => String(p.sizes).includes('M, L'));
assert.ok(readyMade && purchase.addSelectedItem(readyMade, 'L', 1), 'Ready-made size can be added');
assert.ok(app.cart.list().some(x => x.name.includes(' — L')), 'Selection preserved for checkout');
assert.ok(app.checkout.message({ name: 'Example', phone: '0800000000' }).includes(' — L'),
  'Order message includes selected size');

assert.doesNotMatch(checkout, /0000000000|BANK NAME/, 'No dummy bank account in checkout');
assert.match(checkout, /Files are not uploaded through this checkout form/, 'File handling is accurate');
assert.match(checkout, /Continue to WhatsApp/, 'Checkout accurately describes order handoff');

console.log('PASS: Two-column mobile shop, details-first shopping, sizes, cart and checkout.');
