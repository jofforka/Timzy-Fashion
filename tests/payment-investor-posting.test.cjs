'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {postInvestorSale}=require('../server/investor-payment-posting.cjs');
function fixture(mode='live'){
 const rows=new Map(Object.entries({
 'orders/ref':{paymentMode:mode,status:'paid',transactionId:123,lines:[{productId:'p',qty:2,unitKobo:10000},{productId:'p',qty:1,unitKobo:15000}]},
 'paymentInvestorAllocations/p':{investorUid:'i'},
 'investorCatalog/i/items/p':{productId:'p',agreedPrice:40},
 'investorLedger/i/products/p':{received:10,sold:0,grossSales:0,investorEarnings:0}
 }));
 const ref=path=>({path,id:path.split('/').pop(),collection:n=>({doc:id=>ref(path+'/'+n+'/'+id)})});
 const db={collection:n=>({doc:id=>ref(n+'/'+id)}),async runTransaction(fn){
 const writes=[];const result=await fn({get:async r=>({exists:rows.has(r.path),data:()=>rows.get(r.path)}),update:(r,v)=>writes.push([r.path,{...rows.get(r.path),...v}]),create:(r,v)=>{if(rows.has(r.path))throw Error('Duplicate');writes.push([r.path,v]);}});
 for(const [k,v] of writes)rows.set(k,v);return result;
 }};
 return {db,rows};
}
const args={reference:'ref',productId:'p',investorUid:'i'};
test('mixed prices and replay',async()=>{const {db,rows}=fixture();assert.deepEqual(await postInvestorSale(db,args),{posted:true});assert.deepEqual(await postInvestorSale(db,args),{duplicate:true});const l=rows.get('investorLedger/i/products/p');assert.equal(l.sold,3);assert.equal(l.grossSales,350);assert.equal(l.investorEarnings,120);});
test('sandbox cannot post',async()=>{const {db,rows}=fixture('test');await assert.rejects(postInvestorSale(db,args));assert.equal(rows.get('investorLedger/i/products/p').sold,0);});
test('wrong investor cannot post',async()=>{const {db}=fixture();await assert.rejects(postInvestorSale(db,{...args,investorUid:'other'}));});
test('insufficient investor stock leaves balance unchanged',async()=>{const {db,rows}=fixture();rows.get('investorLedger/i/products/p').received=2;await assert.rejects(postInvestorSale(db,args));assert.equal(rows.get('investorLedger/i/products/p').sold,0);});
