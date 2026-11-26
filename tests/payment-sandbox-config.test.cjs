'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sandboxConfig}=require('../server/payment-sandbox-config.cjs');
const env={PAYMENT_SANDBOX_PROJECT_ID:'timzy-sandbox',PRODUCTION_FIREBASE_PROJECT_ID:'timzy-production',PAYSTACK_SECRET:'sk_test_example'};
test('accepts distinct valid projects and test key',()=>assert.deepEqual(sandboxConfig(env),{projectId:'timzy-sandbox'}));
for(const [key,value] of [['PAYMENT_SANDBOX_PROJECT_ID','timzy-production'],['PAYMENT_SANDBOX_PROJECT_ID',''],['PRODUCTION_FIREBASE_PROJECT_ID',undefined],['PAYMENT_SANDBOX_PROJECT_ID',' invalid '],['PAYSTACK_SECRET','sk_live_example'],['PAYSTACK_SECRET','sk_test_']]){
 test('rejects invalid '+key+' '+String(value),()=>assert.throws(()=>sandboxConfig({...env,[key]:value})));
}
