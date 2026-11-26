const test=require('node:test');const assert=require('node:assert/strict');const {quote,paystackClient}=require('../server/payment-order-service.cjs');
const products=new Map([['a',{status:'Published',price:1500,stockOnHand:3}]]);
test('server prices ignore client amounts',()=>assert.equal(quote([{productId:'a',qty:2,price:1}],products).amountKobo,300000));
test('duplicate lines cannot exceed stock',()=>assert.throws(()=>quote([{productId:'a',qty:2},{productId:'a',qty:2}],products)));
test('unknown or untracked products fail closed',()=>{assert.throws(()=>quote([{productId:'b',qty:1}],products));assert.throws(()=>quote([{productId:'a',qty:1}],new Map([['a',{status:'Published',price:100}]])));});
test('live secrets are rejected',()=>assert.throws(()=>paystackClient('sk_live_example')));
