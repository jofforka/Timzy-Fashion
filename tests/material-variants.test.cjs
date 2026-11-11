const fs = require('node:fs');
const assert = require('node:assert/strict');
const app = fs.readFileSync('assets/js/app.js','utf8');
const admin = fs.readFileSync('admin/admin.js','utf8');
const html = fs.readFileSync('admin/index.html','utf8');
const manifest = JSON.parse(fs.readFileSync('data/material-variants.draft.json','utf8'));
assert.equal(manifest.products.length,3);
assert.equal(manifest.products.reduce((n,p)=>n+p.variants.length,0),14);
assert.equal(new Set(manifest.products.flatMap(p=>p.variants.map(v=>v.id))).size,14);
assert(manifest.products.every(p=>p.status==='Draft'));
assert(manifest.products.every(p=>p.variants.every(v=>v.price===null&&v.stockOnHand===null)));
assert(html.includes('name="variantsJson"'));
assert(admin.includes('form.elements.variantsJson'));
assert(app.includes('variantColor'));
assert(app.includes('stockLimit'));
assert(app.includes('Price and stock must be confirmed'));
console.log('Material manifest and integration smoke checks passed.');
// Verify committed media bytes and family mappings, not only planned paths.
for (const product of manifest.products) {
  assert.equal(product.images.length, product.variants.length);
  assert.equal(product.image1, product.variants[0].image);
  for (const variant of product.variants) {
    assert(variant.id.startsWith(product.id + '--'));
    assert(product.images.includes(variant.image));
    const bytes=fs.readFileSync(variant.image);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert(bytes.length>1000);
  }
}
assert.equal(fs.readdirSync('assets/img/materials').filter(f=>f.endsWith('.webp')).length,14);
console.log('PASS: All 14 committed WebP assets match three material families and gallery covers.');
