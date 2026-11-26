const test=require('node:test');const assert=require('node:assert/strict');const {paymentApi}=require('../server/payment-api.cjs');
function setup(){
 const orders=new Map();
 return paymentApi({callbackUrl:'https://example.com/checkout',secret:'test',authenticate:async token=>({uid:token,email:'test@example.com',email_verified:token!=='unverified'}),repo:{create:async(reference,items,uid)=>{const o={reference,uid,amountKobo:10000,status:'pending_payment'};orders.set(reference,o);return o;},find:async r=>orders.get(r)},provider:{initialize:async o=>({reference:o.reference,authorization_url:'https://checkout.paystack.com/test'})}});
}
test('checkout returns provider URL and server amount',async()=>{const api=setup();const result=await api.initialize('alice',[]);assert.equal(result.amountKobo,10000);assert.match(result.reference,/^TF-/);assert.equal((await api.status('alice',result.reference)).status,'pending_payment');await assert.rejects(api.status('bob',result.reference),/not found/);});
test('unverified customer cannot initialize',async()=>{await assert.rejects(setup().initialize('unverified',[]),/Verified email/);});
