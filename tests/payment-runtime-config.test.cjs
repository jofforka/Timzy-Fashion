'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runtimeConfig}=require('../server/payment-runtime-config.cjs');
const env={PAYMENT_SANDBOX_PROJECT_ID:'timzy-sandbox',PRODUCTION_FIREBASE_PROJECT_ID:'timzy-production',PAYSTACK_SECRET:'sk_test_example'};
test('defaults to sandbox',()=>assert.deepEqual(runtimeConfig(env),{projectId:'timzy-sandbox',mode:'test'}));
const live={...env,PAYMENT_MODE:'live',PAYMENT_LIVE_APPROVED:'true',PAYSTACK_SECRET:'sk_live_example'};
test('explicit live approval selects production',()=>assert.deepEqual(runtimeConfig(live),{projectId:'timzy-production',mode:'live'}));
for(const patch of [{PAYMENT_LIVE_APPROVED:'false'},{PAYSTACK_SECRET:'sk_test_example'},{PAYMENT_SANDBOX_PROJECT_ID:'timzy-production'},{PAYMENT_MODE:'unknown'}])test('rejects '+JSON.stringify(patch),()=>assert.throws(()=>runtimeConfig({...live,...patch})));
