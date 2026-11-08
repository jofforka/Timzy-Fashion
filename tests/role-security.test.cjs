'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const rules=read('firestore.rules');
const previous=read('firestore-rules-v5.rules');
const server=read('functions/index.js');
const admin=read('admin/admin.js');
const portal=read('admin/role-portal.js');
const html=read('admin/index.html');
const firebase=read('assets/js/firebase.js');
const config=read('firebase.json');

assert.equal(rules,previous,'Deprecated rules file cannot keep permissive policies');
assert.ok(rules.includes("role() == 'super_admin'"),'Super Admin role is enforced');
assert.ok(rules.includes("role() == 'staff'"),'Staff role is enforced');
assert.ok(rules.includes("role() == 'investor'"),'Investor role is enforced');
assert.match(rules,/match \/users\/\{uid\}/);
assert.match(rules,/allow create, update, delete: if false;/,'Profiles can only be written by server');
for(const name of ['investorAgreements','financeSales','investorCatalog','investorSales','auditEvents']){
 assert.ok(rules.includes('match /'+name+'/'),name+' has explicit rules');
}
assert.match(rules,/request\.auth\.uid == ownerUid/,'Investors see only their own ledger');
assert.match(rules,/match \/settings\/\{id\} \{\s*allow read, write: if superAdmin\(\);/,
  'Secret-bearing settings must not be public');
assert.match(rules,/match \/sales\/\{id\} \{\s*allow read: if operations\(\);\s*allow write: if false;/,
  'Staff cannot directly spoof retail sales');
assert.match(rules,/match \/\{document=\*\*\} \{\s*allow read, write: if false;/,
  'Unknown database paths default-denied');
assert.ok(!rules.includes('allow write: if request.auth != null'),
  'Never grant writes to every logged-in user');
for(const secret of ['payoutPerUnit','agreedPayout','costPrice','margin','profit']){
 assert.ok(rules.includes("'"+secret+"'"), 'Prevent '+secret+' on public products');
}

assert.ok(server.includes("exports.recordSale = onCall"),'Sales are written server-side');
assert.ok(server.includes("exports.saveInvestorAgreement = onCall"));
assert.ok(server.includes("exports.provisionUser = onCall"));
assert.ok(server.includes("exports.markInvestorPayout = onCall"));
assert.ok(server.includes('tx.update(productRef'),'Sale updates verified inventory atomically');
assert.ok(server.includes('tx.create(saleRef'),'Sale records are immutable client-side');
assert.ok(server.includes('tx.create(financeRef'),'Actual retail and margin saved privately');
assert.ok(server.includes('publicInvestorLine('),'Investor data is separately projected');
assert.ok(server.includes("getAuth().createUser({ email, displayName, disabled: false })"),
  'Accounts are provisioned without hardcoded passwords');
assert.ok(server.includes("unitSalePrice"),'Actual transaction price retained');

assert.ok(admin.includes('portal.getProfile(user)'),'Login must resolve authorized role');
assert.ok(admin.includes('profile.role === "investor"'),'Investors use separate UI');
assert.ok(!admin.includes('Existing products imported into the admin.'),
  'Bundled demo items must not be auto-written to production');
assert.ok(admin.includes('state.role !== "super_admin"'),'Product edits must be role-gated');
assert.ok(admin.includes('stockOnHand'),'Verified inventory input required');
assert.ok(portal.includes('firebase')===false || portal.includes('httpsCallable'),
  'Portal must use authenticated callables');
assert.ok(portal.includes('fb.functions.httpsCallable'),'Mutations go to server');
assert.ok(portal.includes('investorCatalog'),'Investor reads safe projection only');
assert.ok(portal.includes('investorSales'),'Investor reads own payout entries');
assert.ok(portal.includes('financeSales'),'Super Admin can reconcile actual margin');
assert.ok(!portal.includes('window.TIMZY_CONFIG.paystackSecret'),'No embedded financial secret');
for(const elem of ['investorApp','accountsView','investorsView','saleForm','financeMargin','investorAmountDue']){
 assert.ok(html.includes(elem),elem+' is in portal UI');
}
assert.ok(firebase.includes('functions: cloudFunctions'),'Firebase functions are initialized when loaded');
assert.ok(config.includes('"rules": "firestore.rules"'),'Deployment uses strict current policy');
assert.ok(config.includes('"functions"'),'Callable backend is in deploy config');
console.log('PASS: Role-based authorization policy and safe investor-facing data separation.');
