'use strict';
// Financial terms never belong in /products because customers can read published listings.
const FORBIDDEN = Object.freeze([
  'investorId','investorUid','investorPayout','payoutPerUnit','agreedPayout',
  'costPrice','supplierCost','grossMargin','margin','profit','investorAgreement',
  'wholesalePrice','purchasePrice','supplierPrice','unitCost','cost',
  'internalCost','investorRate','investorPayoutPerUnit',
  'investorEmail','investorAgreementId','settlementBankAccount'
]);
const forbiddenKeys = new Set(FORBIDDEN);
function auditProduct(id, data) {
  const item = data && typeof data === 'object' ? data : {};
  const sensitiveKeys = Object.keys(item).filter(key =>
    forbiddenKeys.has(key) || /^(private|internal|investor|supplier|wholesale)[A-Z_]/.test(key)
  ).sort();
  const published = ['Published','Out of Stock'].includes(String(item.status || ''));
  const stockVerified = Number.isSafeInteger(item.stockOnHand) && item.stockOnHand >= 0;
  return { id, published, sensitiveKeys, stockVerified,
    needsStatusReview: !['Published','Out of Stock','Draft'].includes(String(item.status || '')) };
}
module.exports = { FORBIDDEN, auditProduct };
