/* node tests/shop-showcase.test.cjs
 * Minimal two-section storefront, material relationships, size selection and checkout.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const products = JSON.parse(read('data/products.json'));
const shop = read('shop.html');
const productHTML = read('product.html');
const checkoutHTML = read('checkout.html');
const shopCSS = read('assets/css/shop-showcase.css');
const productCSS = read('assets/css/product-purchase.css');
const adminHTML = read('admin/index.html');
const adminJS = read('admin/admin.js');

const storage = {};
const callbacks = {};
function button(category) {
  const attrs = {};
  const classes = { active: false };
  return {
    dataset: { category },
    classList: { toggle(name, enabled) { classes[name] = Boolean(enabled); } },
    setAttribute(name, value) { attrs[name] = value; },
    get pressed() { return attrs['aria-pressed']; },
    get active() { return classes.active; }
  };
}
const outfitsTab = button('Outfits');
const materialsTab = button('Materials');
const nodes = {
  '#chips': { querySelectorAll() { return [outfitsTab, materialsTab]; },
    addEventListener(name, cb) { (callbacks['chips:' + name] ||= []).push(cb); } },
  '#productGrid': { innerHTML: '' },
  '#productCount': { textContent: '' },
  '#sectionTitle': { textContent: '' },
  '#search': { addEventListener() {} },
  '#sortProducts': { addEventListener() {} },
  '.floating-whatsapp': { href: '', rel: '' },
  '#toastHost': { insertAdjacentHTML() {} }
};
const location = { href: 'https://test.example/shop.html', pathname: '/shop.html', search: '' };
const doc = {
  body: { classList: { contains(name) { return name === 'page-shop'; } }, insertAdjacentHTML() {} },
  querySelector(selector) { return nodes[selector] || null; },
  querySelectorAll(selector) {
    if (selector === '#productGrid [data-product-id]') return nodes.cards || [];
    return [];
  },
  addEventListener(name, cb) { (callbacks[name] ||= []).push(cb); }
};
const win = { location, TIMZY_FIREBASE: null, history: { replaceState() {} } };
const ctx = vm.createContext({
  window: win, document: doc, location, console: { log() {}, warn() {}, error() {} },
  localStorage: {
    getItem(key) { return storage[key] ?? null; },
    setItem(key, value) { storage[key] = value; }
  },
  URL, URLSearchParams, Date, setTimeout() {}, clearTimeout() {}
});

vm.runInContext(read('assets/js/config.js'), ctx);
vm.runInContext(read('assets/js/app.js'), ctx);
vm.runInContext(read('assets/js/shop-showcase.js'), ctx);
const app = win.Timzy;
assert.ok(app);
app.products = app.normalize(products);
assert.equal(app.products.length, 35, 'All published products remain intact');
assert.equal(app.products[0].price, 185000, 'Prices unchanged');
assert.equal(JSON.stringify(Array.from(app.catalog.categories())),
  JSON.stringify(['Outfits', 'Materials']), 'Exactly two main collections');
assert.equal(app.activeCategory, 'Outfits', 'Outfits is the default landing section');

app.catalog.init();
assert.equal(app.catalog.filtered().length, 20, 'Senator and Agbada outfits shown');
assert.ok(app.catalog.filtered().every(x => ['Senator','Agbada'].includes(x.category)));
assert.equal(outfitsTab.pressed, 'true');
assert.equal(materialsTab.pressed, 'false');
assert.match(nodes['#productCount'].textContent, /20 products/);
assert.equal(nodes['#sectionTitle'].textContent, 'Ready-made & Outfits');

const first = app.products[0];
const card = app.card(first);
assert.match(card, /showcase-card__media/);
assert.match(card, /showcase-card__price/);
assert.match(card, /View &amp; Buy/);
assert.match(card, /product.html\?id=/, 'Product and CTA open detail');
assert.doesNotMatch(card, /data-buy-now=|data-add-bag=/, 'Catalogue never skips choices');
assert.equal(app.cart.count(), 0, 'Browsing does not modify bag');
assert.match(card, /Made to measure/, 'Custom sewing is not represented as ready-made');
const readyMade = app.products.find(p => p.productType === 'Ready-Made');
assert.doesNotMatch(app.card(readyMade), /Made to measure/);
const injected = app.card({ ...first, id: 'x"><img src=x>', name:'<script>alert(1)</script>' });
assert.doesNotMatch(injected, /<script>/, 'Product names escaped');
assert.doesNotMatch(injected, /data-product-id="x"><img/, 'IDs escaped');

for (const click of callbacks['chips:click']) {
  click({ target: { closest(sel) { return sel === '[data-category]' ? materialsTab : null; } } });
}
assert.equal(app.activeCategory, 'Materials');
assert.equal(materialsTab.pressed, 'true');
assert.equal(outfitsTab.pressed, 'false');
assert.equal(app.catalog.filtered().length, 5, 'Only five listed material products');
assert.ok(app.catalog.filtered().every(p => p.category === 'Fabrics'));
assert.equal(nodes['#sectionTitle'].textContent, 'Fabrics & Materials');
assert.match(nodes['#productCount'].textContent, /5 products/);
assert.ok(!nodes['#productGrid'].innerHTML.includes('executive-gold-wristwatch'),
  'Accessories not mislabelled as clothing or fabrics');

app.search = 'swiss';
assert.equal(app.catalog.filtered().length, 1, 'Search respects active section');
app.search = '';
app.sort = 'price-low';
const ordered = app.catalog.filtered();
assert.ok(ordered.every((p,i) => !i || Number(ordered[i-1].price) <= Number(p.price)));
assert.equal(nodes['.floating-whatsapp'].href, 'https://wa.me/' + win.TIMZY_CONFIG.whatsappNumber);

assert.match(shop, /Ready-made &amp; Outfits/);
assert.match(shop, /Fabrics &amp; Materials/);
assert.match(shop, /shop-showcase\.css\?v=4/);
assert.match(shop, /shop-showcase\.js\?v=4/);
assert.match(shop, /class="shop-bag-btn" data-open-bag/);
assert.match(shop, /id="products"/);
assert.doesNotMatch(shop, /Find your next|signature style|showcase-intro-note/,
  'Large editorial hero and redundant banner content removed');
const smallMobileCSS = shopCSS.slice(shopCSS.lastIndexOf('@media (max-width: 620px)'));
assert.match(smallMobileCSS, /grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/,
  'Two product cards on mobile');
assert.match(shopCSS.slice(shopCSS.lastIndexOf('@media (max-width: 350px)')),
  /grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/,
  'Two cards on very narrow screens');
assert.doesNotMatch(shopCSS, /linear-gradient|radial-gradient/,
  'No busy decorative gradients in shop design');

// Deep link from an outfit to a specific material focuses the real product card.
location.search = '?section=materials&product=brocade-senator-fabric';
location.href = 'https://test.example/shop.html' + location.search;
let highlighted = false, scrolled = false, focused = false;
nodes.cards = [{
  getAttribute(name) { return name === 'data-product-id' ? 'brocade-senator-fabric' : null; },
  classList: { add(cls) { highlighted = cls === 'showcase-card--target'; } },
  focus() { focused = true; }, scrollIntoView() { scrolled = true; }
}];
vm.runInContext(read('assets/js/shop-showcase.js'), ctx);
app.catalog.init();
assert.equal(app.activeCategory, 'Materials', 'Material deep link selects material section');
assert.ok(highlighted && scrolled && focused, 'Linked material receives accessible focus and scroll');

doc.body.classList.contains = name => name === 'page-product';
vm.runInContext(read('assets/js/product-purchase.js'), ctx);
const purchase = win.TimzyPurchase;
assert.ok(purchase, 'Product purchase functionality retained');
assert.equal(JSON.stringify(Array.from(purchase.sizeOptions('M, L, XL, XXL'))),
  JSON.stringify(['M','L','XL','XXL']));
assert.equal(purchase.sizeOptions('40–46').length, 7);
assert.equal(purchase.sizeOptions('Custom')[0], 'Custom');

const exact = purchase.resolveMaterial({
  raw: { materialProductId: 'brocade-senator-fabric' },
  fabricType: 'Verified Brocade'
}, app.products);
assert.equal(exact.product.id, 'brocade-senator-fabric');
assert.equal(exact.exact, true, 'Admin-picked ID gives exact material link');
const related = purchase.resolveMaterial(first, app.products);
assert.equal(related.product.id, 'brocade-senator-fabric');
assert.equal(related.exact, false, 'Similar Brocade offered, not described as exact');
const unlisted = app.products.find(p => p.fabricType === 'Luxury Jacquard');
assert.equal(purchase.resolveMaterial(unlisted, app.products), null,
  'Unavailable materials do not invent product matches');
assert.equal(purchase.resolveMaterial({raw:{materialProductId:'missing-id'}, fabricType:'Brocade'}, app.products), null,
  'Invalid explicit reference cannot silently fall back to a misleading match');

assert.equal(purchase.addSelectedItem(first, 'Custom', 2), true);
assert.equal(app.cart.count(), 2);
assert.equal(purchase.addSelectedItem(first, 'Custom', 1), true);
assert.equal(app.cart.count(), 3);
assert.equal(purchase.addSelectedItem(first, '', 1), false);
assert.equal(purchase.addSelectedItem(first, 'Custom', 100), false);
assert.ok(app.cart.list().some(item => item.name.includes(' — Custom')));
assert.ok(app.checkout.message({name:'Example',phone:'0800000000'}).includes(' — Custom'));

assert.match(productHTML, /product-purchase\.js\?v=3/);
assert.match(productHTML, /product-purchase\.css\?v=3/);
assert.doesNotMatch(productHTML, /muted-section|Care &amp; Finishing|Care & Finishing/,
  'Redundant product details section removed');
assert.match(productCSS, /product-material-link/);
assert.match(productCSS, /product-optional-extras/);
assert.match(read('assets/js/product-purchase.js'), /shop\.html\?section=materials&product=/,
  'Outfit material hyperlink deep-links to specific material card');
assert.match(adminHTML, /name="materialProductId"/,
  'Admin can select matching material');
assert.match(adminJS, /populateMaterialOptions/);
assert.match(adminJS, /materialProductId: String\(data\.materialProductId/,
  'Admin saves material relationship');

assert.doesNotMatch(checkoutHTML, /0000000000|BANK NAME/);
assert.match(checkoutHTML, /Continue to WhatsApp/);
console.log('PASS: Minimal dual-collection shop, precise material links, cart and checkout.');


assert.ok(shop.includes('storefront-preview.js?v=1'), 'Sample script installed in shop');
assert.ok(productHTML.includes('storefront-preview.js?v=1'), 'Sample script installed in product');
assert.ok(shop.includes('catalogSampleNotice'), 'Sample disclosure exists');
assert.ok(read('assets/js/app.js').includes('sampleListing===true'), 'Demo orders cannot be sent');
assert.ok(read('assets/js/product-purchase.js').includes('sampleListing: p.raw?.sampleListing'), 'Demo cart flag retained');
