const {test}=require('node:test');
const assert=require('node:assert/strict');
const {planSale}=require('../server/investor-payment-plan.cjs');
const input={ledger:{received:10,sold:2,grossSales:10000,investorEarnings:4000},agreement:{productId:'p',agreedPrice:2000},quantity:3,unitKobo:500000,productId:'p',reference:'TF-test'};
test('fixed earnings independent of retail price',()=>{const p=planSale(input);assert.equal(p.ledger.sold,5);assert.equal(p.ledger.investorEarnings,10000);assert.equal(p.ledger.grossSales,25000);});
test('reject oversold allocation',()=>assert.throws(()=>planSale({...input,quantity:9})));
test('reject mismatched agreement',()=>assert.throws(()=>planSale({...input,productId:'other'})));
