'use strict';
// Read-only preflight to catch private investor rates accidentally stored in
// public product documents. Never print values, emails, or monetary amounts.
// Use only with authorized Google Cloud Application Default Credentials.
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { auditProduct } = require('../lib/catalog-audit');
(async () => {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (projectId !== 'timzy-fashion-os' || process.env.TIMZY_AUDIT_CONFIRM !== 'read-only') {
    throw Error('Set GOOGLE_CLOUD_PROJECT=timzy-fashion-os and TIMZY_AUDIT_CONFIRM=read-only.');
  }
  initializeApp({ projectId });
  const snap = await getFirestore().collection('products').get();
  const review = snap.docs.map(doc => auditProduct(doc.id, doc.data()));
  let risky = 0;
  for (const result of review) {
    if (result.sensitiveKeys.length) {
      risky += 1;
      process.stdout.write('PRIVATE FIELD WARNING | product id: ' +
        result.id + ' | fields: ' + result.sensitiveKeys.join(', ') + '\n');
    }
    if (result.needsStatusReview) {
      process.stdout.write('STATUS REVIEW | product id: ' + result.id + '\n');
    }
  }
  process.stdout.write('Read-only audit: ' + review.length + ' product(s), ' +
    risky + ' with private-field risks, ' +
    review.filter(x => x.published && !x.stockVerified).length +
    ' published product(s) without verified stock.\n');
  if (risky > 0) {
    process.stderr.write('BLOCK: Remove sensitive values from public product docs via an approved migration before deploying public rules.\n');
    process.exitCode = 2;
  }
})().catch(error => {
  process.stderr.write('Product audit could not complete: ' + error.message + '\n');
  process.exitCode = 1;
});
