'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {initializeTestPayment,verifyTestPayment}=require('./paystack-test.cjs');
const key='sk_test_example';
const expected={reference:'TFTEST-12345678',amountKobo:100000,mode:'test'};
test('test-only credentials and server-calculated amounts required',async()=>{
  await assert.rejects(()=>initializeTestPayment({key:'sk_live_no',email:'a@b.com',amountKobo:100000,reference:expected.reference,fetchImpl:async()=>{throw Error('should not fetch')}}));
  await assert.rejects(()=>initializeTestPayment({key,email:'a@b.com',amountKobo:1.5,reference:expected.reference}));
});
test('initialize uses NGN kobo and refuses provider reference substitution',async()=>{
  const fetchImpl=async(url,opts)=>{
    assert.match(url,/\/transaction\/initialize$/);
    assert.equal(opts.headers.Authorization,'Bearer '+key);
    assert.deepEqual(JSON.parse(opts.body),{email:'a@b.com',amount:'100000',currency:'NGN',reference:expected.reference});
    return {ok:true,json:async()=>({status:true,data:{reference:expected.reference,authorization_url:'https://checkout.paystack.com/test123'}})};
  };
  const result=await initializeTestPayment({key,email:'a@b.com',amountKobo:100000,reference:expected.reference,fetchImpl});
  assert.equal(result.reference,expected.reference);
});
test('verification rejects incorrect amount, live mode, and unsuccessful transactions',async()=>{
  const base={reference:expected.reference,amount:100000,currency:'NGN',domain:'test',status:'success'};
  for(const [change,verified] of [[{},true],[{amount:10},false],[{domain:'live'},false],[{status:'pending'},false]]) {
    const fetchImpl=async()=>({ok:true,json:async()=>({status:true,data:{...base,...change}})});
    assert.equal((await verifyTestPayment({key,expected,fetchImpl})).verified,verified);
  }
});
