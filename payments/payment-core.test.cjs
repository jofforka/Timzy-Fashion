'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { nairaToKobo, validateCart, verifyPayment, verifyLegacyWebhook, verifySignedWebhook } = require('./payment-core.cjs');
test('money converts NGN to integer kobo and rejects invalid input', () => {
  assert.equal(nairaToKobo(1500.5), 150050);
  for (const bad of [0,-1,NaN,Infinity,'100',1.001]) assert.throws(() => nairaToKobo(bad));
});
test('server catalog is price authority, never customer price', () => {
  const catalog = [{id:'a',status:'Published',price:1200,salePrice:1000}];
  assert.deepEqual(validateCart([{id:'a',qty:2,price:1}],catalog),{
    currency:'NGN',amountKobo:200000,lines:[{productId:'a',quantity:2,unitKobo:100000,lineKobo:200000}]
  });
  assert.throws(() => validateCart([{id:'a',qty:0}],catalog));
  assert.throws(() => validateCart([{id:'missing',qty:1}],catalog));
});
test('payment verification checks status, amount, reference, currency and mode', () => {
  const expected={reference:'ref-1',amountKobo:100000,mode:'test'};
  const good={reference:'ref-1',amount:100000,currency:'NGN',status:'success',domain:'test'};
  assert.equal(verifyPayment(expected,good),true);
  for (const patch of [{amount:1},{reference:'other'},{currency:'USD'},{status:'pending'},{domain:'live'}]) {
    assert.equal(verifyPayment(expected,{...good,...patch}),false);
  }
});
test('legacy webhook signature authenticates raw payload',()=>{
  const raw=Buffer.from('{"event":"charge.success"}'),key='test-secret';
  const signature=crypto.createHmac('sha512',key).update(raw).digest('hex');
  assert.equal(verifyLegacyWebhook(raw,signature,key),true);
  assert.equal(verifyLegacyWebhook(Buffer.from('tampered'),signature,key),false);
});
test('timestamped webhook rejects altered payload and replay',()=>{
  const raw=Buffer.from('{"event":"charge.success"}'),key='whsec_test',timestamp=1700000000;
  const sig=crypto.createHmac('sha512',key).update(Buffer.concat([Buffer.from(timestamp+'.'),raw])).digest('hex');
  const header='t='+timestamp+',v1=whk_abc:'+sig;
  assert.equal(verifySignedWebhook(raw,header,key,timestamp),true);
  assert.equal(verifySignedWebhook(raw,header,key,timestamp+301),false);
  assert.equal(verifySignedWebhook(Buffer.from('changed'),header,key,timestamp),false);
});
