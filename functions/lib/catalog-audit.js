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
const PUBLIC_FIELDS = Object.freeze(["badge","category","color","colour","deliveryEstimate","description","ethnicStyle","fabric","fabricType","featured","id","image","image1","image2","image3","image4","image5","image6","image7","image8","imageSource","images","instagramVideoUrl","materialProductId","measurementRequired","name","originInfluence","price","productName","productType","quantity","salePrice","size","sizes","sku","status","stockOnHand","tags","videoUrl","createdAt","updatedAt"]);
const publicFields = new Set(PUBLIC_FIELDS);
function auditProduct(id, data) {
  const item = data && typeof data === 'object' ? data : {};
  const sensitiveKeys = Object.keys(item).filter(key =>
    !publicFields.has(key) || forbiddenKeys.has(key)
  ).sort();
  const published = ['Published','Out of Stock'].includes(String(item.status || ''));
  const stockVerified = Number.isSafeInteger(item.stockOnHand) && item.stockOnHand >= 0;
  return { id, published, sensitiveKeys, stockVerified,
    needsStatusReview: !['Published','Out of Stock','Draft'].includes(String(item.status || '')) };
}
module.exports = { FORBIDDEN, PUBLIC_FIELDS, auditProduct };
