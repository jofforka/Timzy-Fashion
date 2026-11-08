'use strict';
// Lightweight callable integration test without Firebase credentials.
// Tests the real server-side functions against an isolated fake Firestore.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../functions/index.js'), 'utf8');
const finance = require('../functions/lib/finance');
const docs = new Map();
let serial = 0;
const clone = value => JSON.parse(JSON.stringify(value));
const now = '2026-11-08T12:00:00Z';
const fieldValue = {
  serverTimestamp: () => now,
  increment: value => ({ __increment__: value })
};
const snapshot = path => {
  const doc = docs.get(path);
  return { exists: Boolean(doc), id: path.split('/').pop(), data() { return clone(doc); } };
};
function write(path, changes, merge, isUpdate) {
  const old = docs.get(path) || {};
  if (isUpdate && !docs.has(path)) throw Error('Missing doc ' + path);
  const dest = merge || isUpdate ? { ...old } : {};
  for (const [key, value] of Object.entries(changes)) {
    dest[key] = value && typeof value === 'object' && '__increment__' in value
      ? Number(old[key] || 0) + value.__increment__ : value;
  }
  docs.set(path, clone(dest));
}
class Ref {
  constructor(id) { this.id = id.split('/').pop(); this.path = id; }
  async get() { return snapshot(this.path); }
  async create(data) { if (docs.has(this.path)) throw Error('exists'); write(this.path, data); }
  async set(data, opts) { write(this.path, data, Boolean(opts?.merge)); }
  async update(data) { write(this.path, data, true, true); }
}
const ref = path => new Ref(path);
const db = {
  doc: ref,
  collection(name) {
    return { doc(id) { return ref(name + '/' + (id || ('generated_' + ++serial))); } };
  },
  async runTransaction(body) {
    const writes = [];
    const tx = {
      get: async ref => snapshot(ref.path),
      create(ref, data) { writes.push(() => {
        if (docs.has(ref.path)) throw Error('already exists');
        write(ref.path, data);
      }); },
      update(ref, data) { writes.push(() => write(ref.path, data, true, true)); },
      set(ref, data, options) { writes.push(() => write(ref.path, data, Boolean(options?.merge))); }
    };
    const result = await body(tx);
    for (const op of writes) op();
    return result;
  }
};
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
const auth = {
  created: [],
  async createUser(data) {
    assert.equal(data.password, undefined, 'Never assign default/shared passwords');
    const user = { uid: 'created_' + (++serial), ...data };
    this.created.push(user);
    return user;
  },
  async deleteUser() {},
  async updateUser() {}
};
const callableExports = {};
const context = vm.createContext({
  require(name) {
    if (name === 'firebase-admin/app') return { initializeApp() {} };
    if (name === 'firebase-admin/auth') return { getAuth: () => auth };
    if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: fieldValue };
    if (name === 'firebase-functions/v2/https') return {
      onCall(options, handler) {
        assert.equal(options.region, 'us-central1');
        return handler;
      }, HttpsError
    };
    if (name === './lib/finance') return finance;
    throw Error('Unexpected require ' + name);
  },
  exports: callableExports, Date, console, Number, String, Boolean, Array, Object, RegExp, Set, Promise
});
vm.runInContext(code, context, { filename: 'functions/index.js' });
const call = (name, actor, data) => callableExports[name]({ auth: actor ? { uid: actor } : null, data });
const receipt = 'TIMZY-2026-0001';
const id = 'receipt_' + receipt + '_line_1';

function reset() {
  docs.clear();
  docs.set('users/owner', { role: 'super_admin', active: true });
  docs.set('users/clerk', { role: 'staff', active: true });
  docs.set('users/investor1', { role: 'investor', active: true, investorId: 'investor1' });
  docs.set('users/investor2', { role: 'investor', active: true, investorId: 'investor2' });
  docs.set('products/fabric1', { name: 'Sample Brocade', status: 'Published', stockOnHand: 3, color: 'Navy', price: 15000 });
  docs.set('investorAgreements/fabric1', { productId:'fabric1', investorUid:'investor1', payoutPerUnit:8000, active:true });
  docs.set('investorCatalog/investor1/items/fabric1', { productId:'fabric1', payoutPerUnit:8000, unitsSold:0, active:true });
}
async function main() {
  reset();
  await assert.rejects(call('recordSale','investor1',{productId:'fabric1',quantity:1,unitSalePrice:15000,receiptCode:receipt}),
    e => e.code === 'permission-denied');
  await assert.rejects(call('recordSale','clerk',{productId:'fabric1',quantity:1,unitSalePrice:7000,receiptCode:receipt}),
    e => e.code === 'failed-precondition');
  assert.equal(docs.get('products/fabric1').stockOnHand,3,'Rejected price must not change inventory');

  const recorded = await call('recordSale','clerk',{productId:'fabric1',quantity:1,unitSalePrice:15000,receiptCode:receipt});
  assert.equal(recorded.amount,15000);
  assert.equal(recorded.remainingStock,2);
  assert.equal(docs.get('products/fabric1').stockOnHand,2);
  assert.equal(docs.get('sales/'+id).amount,15000);
  assert.equal(docs.get('sales/'+id).createdBy,'clerk');
  assert.equal(docs.get('sales/'+id).receiptCode,receipt);
  const financeLine=docs.get('financeSales/'+id);
  assert.equal(financeLine.actualRetailTotal,15000);
  assert.equal(financeLine.investorTotalDue,8000);
  assert.equal(financeLine.grossMarginBeforeCosts,7000);
  const investorLine=docs.get('investorSales/investor1/entries/'+id);
  assert.equal(investorLine.totalDue,8000);
  assert.ok(!('actualRetailTotal' in investorLine),'Investor projection cannot contain real selling price');
  assert.ok(!('grossMarginBeforeCosts' in investorLine),'Investor projection cannot contain profit');
  assert.equal(docs.get('investorCatalog/investor1/items/fabric1').unitsSold,1);

  const again = await call('recordSale','clerk',{productId:'fabric1',quantity:1,unitSalePrice:15000,receiptCode:receipt});
  assert.equal(again.alreadyRecorded,true);
  await assert.rejects(
    call('recordSale','clerk',{productId:'fabric1',quantity:2,unitSalePrice:15000,receiptCode:receipt}),
    e=>e.code==='already-exists'
  );
  await assert.rejects(
    call('recordSale','clerk',{productId:'fabric1',quantity:1,unitSalePrice:13000,receiptCode:receipt.toLowerCase()}),
    e=>e.code==='already-exists'
  );
  assert.equal(docs.get('products/fabric1').stockOnHand,2,'Duplicate must not decrement stock');
  await assert.rejects(call('markInvestorPayout','clerk',{investorUid:'investor1',saleId:id,paymentReference:'BANK-123'}),
    e=>e.code==='permission-denied');
  const paid=await call('markInvestorPayout','owner',{investorUid:'investor1',saleId:id,paymentReference:'BANK-123'});
  assert.equal(paid.status,'paid');
  assert.equal(docs.get('investorSales/investor1/entries/'+id).status,'paid');
  assert.equal(docs.get('financeSales/'+id).status,'paid');
  const line2 = await call('recordSale','clerk',{
    productId:'fabric1',quantity:1,unitSalePrice:17000,receiptCode:receipt,lineNumber:2
  });
  assert.equal(line2.id,'receipt_'+receipt+'_line_2');
  assert.equal(docs.get('products/fabric1').stockOnHand,1,
    'A second product line on the same invoice reduces one additional unit');
  await assert.rejects(call('recordSale','clerk',{
    productId:'fabric1',quantity:1,unitSalePrice:17000,receiptCode:receipt,lineNumber:100
  }),e=>e.code==='invalid-argument');
  await assert.rejects(call('markInvestorPayout','owner',{investorUid:'investor1',saleId:id,paymentReference:'BANK-123'}),
    e=>e.code==='already-exists');
  const id2='receipt_'+receipt+'_line_2';
  await assert.rejects(
    call('reverseSale','clerk',{saleId:id2,kind:'entry_error',reason:'The sale was entered twice.'}),
    e=>e.code==='permission-denied'
  );
  await assert.rejects(
    call('reverseSale','investor1',{saleId:id2,kind:'entry_error',reason:'The sale was entered twice.'}),
    e=>e.code==='permission-denied'
  );
  await assert.rejects(
    call('reverseSale','owner',{saleId:id,kind:'customer_refunded',reason:'The client returned the material.',refundReference:'BANKREF42'}),
    e=>e.code==='failed-precondition'
  );
  await assert.rejects(
    call('reverseSale','owner',{saleId:id2,kind:'customer_refunded',reason:'The client returned the material.'}),
    e=>e.code==='invalid-argument'
  );
  const correction=await call('reverseSale','owner',{
    saleId:id2,kind:'entry_error',reason:'This second line was mistakenly recorded.'
  });
  assert.equal(correction.status,'reversed');
  assert.equal(correction.restoredStock,2);
  assert.equal(correction.investorEntitlementCancelled,true);
  assert.equal(docs.get('products/fabric1').stockOnHand,2,'Reversal returns physical stock');
  assert.equal(docs.get('sales/'+id2).status,'reversed','Sale remains intact with reversed status');
  assert.equal(docs.get('sales/'+id2).amount,17000,'Original retail amount is retained for audit');
  assert.equal(docs.get('financeSales/'+id2).status,'reversed','Financial obligation is reversed');
  assert.equal(docs.get('investorSales/investor1/entries/'+id2).status,'reversed');
  assert.equal(docs.get('investorCatalog/investor1/items/fabric1').unitsSold,1,
    'Reversal cancels only the unpaid units and leaves paid units unchanged');
  assert.equal(docs.get('investorSales/investor1/entries/'+id).status,'paid',
    'Previously settled transaction is unchanged');
  await assert.rejects(
    call('reverseSale','owner',{saleId:id2,kind:'entry_error',reason:'This second line was mistakenly recorded.'}),
    e=>e.code==='already-exists'
  );
  assert.equal(docs.get('products/fabric1').stockOnHand,2,
    'Duplicate reversal must never restore stock twice');

  await assert.rejects(call('provisionUser','clerk',{role:'investor',email:'example@demo.com',displayName:'Investor'}),
    e=>e.code==='permission-denied');
  const user=await call('provisionUser','owner',{role:'investor',email:'example@demo.com',displayName:'Investor'});
  assert.equal(user.onboarding,'send-password-reset-email');
  assert.equal(docs.get('users/'+user.uid).investorId,user.uid);
  assert.equal(auth.created.at(-1).password,undefined);

  reset();
  docs.set('sales/old_sale', { amount:3000, description:'Legacy manual sale' });
  await assert.rejects(
    call('reverseSale','owner',{saleId:'old_sale',kind:'entry_error',
      reason:'Old sale needs a manual account review.'}),
    e=>e.code==='failed-precondition'
  );

  reset();
  delete docs.get('products/fabric1').stockOnHand;
  await assert.rejects(call('recordSale','clerk',{productId:'fabric1',quantity:1,unitSalePrice:15000,receiptCode:receipt}),
    e=>e.code==='failed-precondition');
  assert.ok(!docs.has('sales/'+id),'Unverified stock cannot be sold via backend');

  reset();
  await assert.rejects(call('saveInvestorAgreement','clerk',{productId:'fabric1',investorUid:'investor1',payoutPerUnit:9000}),
    e=>e.code==='permission-denied');
  await assert.rejects(call('saveInvestorAgreement','owner',{productId:'fabric1',investorUid:'investor2',payoutPerUnit:9000}),
    e=>e.code==='failed-precondition');
  const ok=await call('saveInvestorAgreement','owner',{productId:'fabric1',investorUid:'investor1',payoutPerUnit:9000});
  assert.equal(ok.payoutPerUnit,9000);
  assert.equal(docs.get('investorCatalog/investor1/items/fabric1').payoutPerUnit,9000);
  process.stdout.write('PASS: Role backend, stock transaction, true retail sale, investor projection, payout and identity controls.\n');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
