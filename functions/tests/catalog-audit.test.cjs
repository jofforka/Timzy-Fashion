'use strict';
const assert = require('node:assert/strict');
const { auditProduct, FORBIDDEN } = require('../lib/catalog-audit');
const publicItem = auditProduct('fabric-a', {
  status:'Published', stockOnHand:5, name:'Blue Brocade', price:15000
});
assert.equal(publicItem.published,true);
assert.equal(publicItem.stockVerified,true);
assert.deepEqual(publicItem.sensitiveKeys,[]);
const old = auditProduct('legacy', {
  status:'Published', costPrice:8000, investorUid:'secret_uid',
  wholesalePrice:8000, grossMargin:7000, stockOnHand:'Available'
});
assert.equal(old.stockVerified,false);
for(const key of ['costPrice','investorUid','wholesalePrice','grossMargin']){
  assert.ok(old.sensitiveKeys.includes(key));
}
const unknown= auditProduct('new', {
  status:'Published', investorProposedCost:8000, internalNote:'sensitive'
});
assert.ok(unknown.sensitiveKeys.includes('investorProposedCost'));
assert.ok(unknown.sensitiveKeys.includes('internalNote'));
const draft=auditProduct('draft',{status:'Draft',price:3000});
assert.equal(draft.published,false);
const missingStatus=auditProduct('old',{name:'Old'});
assert.equal(missingStatus.needsStatusReview,true);
assert.ok(FORBIDDEN.includes('payoutPerUnit'));
console.log('PASS: Read-only public product financial exposure checks.');
