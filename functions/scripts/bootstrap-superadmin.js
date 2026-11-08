'use strict';
// ONE-TIME OWNER BOOTSTRAP — run only with a trusted Firebase Admin identity.
// Example (after npm install inside functions/):
// TIMZY_BOOTSTRAP_CONFIRM=timzy-fashion-os:super_admin \\
// GOOGLE_CLOUD_PROJECT=timzy-fashion-os \\
// node functions/scripts/bootstrap-superadmin.js owner@example.com
//
// Never commit service account keys. Use Google Cloud Application Default
// Credentials or a trusted, short-lived impersonated identity instead.
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

async function main() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  const email = process.argv[2];
  if (projectId !== 'timzy-fashion-os' ||
      process.env.TIMZY_BOOTSTRAP_CONFIRM !== 'timzy-fashion-os:super_admin' ||
      typeof email !== 'string' || !/^[^ @]+@[^ @]+[.][^ @]+$/.test(email)) {
    throw Error('Requires project timzy-fashion-os, explicit confirmation, and an existing Firebase Auth email.');
  }
  initializeApp({ projectId });
  const user = await getAuth().getUserByEmail(email);
  if (user.disabled) throw Error('Firebase Authentication user must be enabled.');
  const db = getFirestore();
  const existing = await db.collection('users').where('role', '==', 'super_admin').limit(2).get();
  if (existing.docs.some(doc => doc.id !== user.uid)) {
    throw Error('A different Super Admin already exists; use authorized account management.');
  }
  await db.collection('users').doc(user.uid).set({
    role: 'super_admin',
    active: true,
    email: user.email,
    displayName: user.displayName || 'Timzy Owner',
    investorId: null,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  process.stdout.write('Existing Firebase Auth user assigned Super Admin role. UID: ' + user.uid + '\\n');
}
main().catch(error => {
  process.stderr.write(error.message + '\\n');
  process.exitCode = 1;
});
