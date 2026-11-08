/* node tests/public-ui.test.cjs
 * Public-facing pages share one responsive design without changing the admin UI.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const pages = [
  'index.html', 'shop.html', 'product.html', 'checkout.html',
  'training.html', 'contact.html',
  'build-your-look.html', 'build-your-style.html'
];
for (const file of pages) {
  const html = read(file);
  assert.match(html, /class="[^"]*timzy-public/, file + ': shared body');
  assert.match(html, /assets\/css\/storefront-ui\.css\?v=1/, file + ': shared CSS');
  assert.match(html, /assets\/js\/storefront-ui\.js\?v=1/, file + ': shared navigation JS');
  assert.match(html, /class="site-header"/, file + ': shared header');
  assert.match(html, /class="shop-bag-btn"/, file + ': same basket control');
  assert.match(html, /class="container shop-footer"/, file + ': same footer');
  assert.match(html, /href="shop\.html"/, file + ': shop link');
  assert.match(html, /aria-controls="navLinks"/, file + ': mobile menu semantics');
  assert.equal((html.match(/id="bagCount"/g) || []).length, 1,
    file + ': one accessible basket counter');
  assert.doesNotMatch(html, /class="floating-bag"/,
    file + ': avoid duplicate floating bag controls');
  assert.match(html, /assets\/js\/app\.js\?v=8\.5/,
    file + ': same commerce application version');
  assert.equal((html.match(/<header class="site-header">/g) || []).length, 1);
}

const shop = read('shop.html');
const product = read('product.html');
const checkout = read('checkout.html');
const training = read('training.html');
const contact = read('contact.html');
const builder = read('build-your-look.html');
const sharedStyles = read('assets/css/storefront-ui.css');
const sharedJS = read('assets/js/storefront-ui.js');
const shopStyles = read('assets/css/shop-showcase.css');
const productStyles = read('assets/css/product-purchase.css');
const catalog = read('catalog.html');
const login = read('login.html');

assert.match(sharedStyles, /body\.timzy-public/);
assert.match(sharedStyles, /font-family: Inter/);
assert.match(sharedStyles, /@media\(max-width: 620px\)/);
assert.match(sharedStyles, /\.shop-bag-btn/);
assert.match(sharedStyles, /\.site-header/);
assert.match(sharedStyles, /\.site-footer/);
assert.match(sharedStyles, /\.hero-title/);
assert.match(sharedStyles, /\.field/);
assert.match(sharedStyles, /focus-visible/);
assert.match(sharedJS, /aria-expanded/);
assert.match(sharedJS, /Escape/);
assert.doesNotMatch(sharedJS, /checkout|loadProducts|cart\.save/,
  'Shared JS must not overwrite core commerce logic');
assert.match(shopStyles, /repeat\(2,minmax\(0,1fr\)\)/,
  'Shop still has two mobile columns');
assert.match(productStyles, /product-material-link/,
  'Product page keeps material cross-link');

assert.match(shop, /storefront-preview\.js\?v=1/,
  'Shop can show safe examples for empty live categories');
assert.match(product, /storefront-preview\.js\?v=1/,
  'Product detail can resolve example IDs');
assert.match(shop, /catalogSampleNotice/,
  'Shop clearly labels sample catalogue');
assert.match(catalog, /location\.replace\('shop\.html'/,
  'Old catalogue URL redirects to the new shop');
assert.match(catalog, /storefront-ui\.css/, 'Old catalogue fallback is styled');
assert.match(login, /storefront-ui\.css/, 'Staff redirect fallback is styled');
assert.match(checkout, /id="checkoutForm"/, 'Checkout form is preserved');
assert.match(training, /training/i);
assert.match(contact, /contact/i);
assert.match(builder, /builder/i);

const core = read('assets/js/app.js');
assert.match(core, /sampleListing===true/, 'Checkout blocks preview submissions');
assert.match(core, /Remove sample preview items before sending an order/,
  'Direct WhatsApp basket action also blocks preview submissions');
assert.match(core, /sampleListing:p\.raw\?\.sampleListing===true/,
  'Global basket addition keeps sample flag');

const admin = read('admin/index.html');
assert.doesNotMatch(admin, /storefront-ui\.(?:js|css)/,
  'Private admin design stays separate from storefront');

console.log('PASS: Timzy shared public UI, consistent header and cart, preserved features.');
