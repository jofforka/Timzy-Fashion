const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const memory=new Map();
const context=vm.createContext({
 window:{},document:{addEventListener(){},body:{classList:{contains:n=>n==='page-product'}},
 querySelector:s=>s==='#fabricColor'?{value:'0'}:null,querySelectorAll:()=>[]},
 localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},
 URLSearchParams,location:{search:''},console,setTimeout
});
vm.runInContext(fs.readFileSync('assets/js/app.js','utf8'),context);
vm.runInContext(fs.readFileSync('assets/js/product-purchase.js','utf8'),context);
const app=context.window.Timzy, purchase=context.window.TimzyPurchase;
let rows=[];app.cart.list=()=>rows;app.cart.save=value=>{rows=value;};
const prepared=JSON.parse(fs.readFileSync('data/material-variants.draft.json')).products;
assert.equal(app.normalize(prepared).length,0,'Draft materials stay private');
for(const product of prepared){
 const p=app.normalize([{...product,status:'Published'}])[0];
 assert.equal(p.images.length,p.variants.length,'Gallery covers every color once');
 assert.equal(purchase.addSelectedItem(p,'yard',1),false,'Unknown commerce cannot be purchased');
 assert.equal(rows.length,0);
}
// Isolated fixtures, never production values.
const p=app.normalize([{...prepared[0],status:'Published',variants:[{
 ...prepared[0].variants[0],price:100,stockOnHand:3,sizes:['yard','metre']
}]}])[0];app.products=[p];
assert.equal(purchase.addSelectedItem(p,'yard',2),true);
assert.equal(purchase.addSelectedItem(p,'metre',2),false,'Stock applies across selling units');
assert.equal(purchase.addSelectedItem(p,'invalid',1),false);
assert.equal(purchase.addSelectedItem(p,'metre',1),true);
assert.equal(app.cart.validationError(),'');
assert(app.checkout.message({name:'Test',phone:'Test'}).includes('Teal Green — yard x2'));
p.variants[0].price=101;assert.match(app.cart.validationError(),/changed price/);
p.variants[0].price=100;p.variants[0].stockOnHand=2;
assert.match(app.cart.validationError(),/changed stock/);
p.variants[0].stockOnHand=null;assert.match(app.cart.validationError(),/changed stock/);
p.variants[0].stockOnHand=3;p.variants[0].sizes=[];
assert.match(app.cart.validationError(),/selling unit changed/);
p.status='Out of Stock';assert.equal(purchase.addSelectedItem(p,'yard',1),false);
const legacy=app.normalize([{id:'legacy',name:'Existing outfit',category:'Senator',status:'Published',price:500,sizes:'M, L'}])[0];
rows=[];app.products=[legacy];
assert.equal(purchase.addSelectedItem(legacy,'M',1),true);
assert.equal(app.cart.validationError(),'','Legacy selected-size IDs still validate');
rows[0].qty=0;assert.match(app.cart.validationError(),/changed availability/);
console.log('PASS: Draft visibility, all three families, unknown commerce, cross-unit stock, color/unit WhatsApp retention, stale commerce and legacy basket.');
