'use strict';
// Firebase Cloud Functions v2 — staging only, not deployed.
// Set PAYMENTS_TEST_ENABLED=true and provision PAYSTACK_TEST_SECRET in Secret Manager.
// Admin-only endpoints intentionally prevent customers from using unfinished checkout.
const crypto = require('node:crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { validateCart, verifySignedWebhook, verifyLegacyWebhook } = require('../payments/payment-core.cjs');
const { initializeTestPayment, verifyTestPayment } = require('../payments/paystack-test.cjs');
admin.initializeApp();
const db = admin.firestore();
const testSecret = defineSecret('PAYSTACK_TEST_SECRET');
const webhookSecret = defineSecret('PAYSTACK_TEST_WEBHOOK_SECRET');
const OWNER_UID = 'sCkXSrVIlHNGBoufFtirvLBvaTi1';
function enabled() { return process.env.PAYMENTS_TEST_ENABLED === 'true'; }
function sendError(res, code, message) { res.status(code).json({error: message}); }
async function ownerOnly(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) return false;
  const token = await admin.auth().verifyIdToken(match[1], true);
  return token.uid === OWNER_UID;
}
async function getOwner(req,res) {
  try { if (!(await ownerOnly(req))) {sendError(res,403,'Forbidden');return false;} return true; }
  catch (_) {sendError(res,401,'Invalid authentication');return false;}
}
exports.initializeTimzyTestPayment = onRequest({region:'us-central1',secrets:[testSecret],maxInstances:2,invoker:'public'},async(req,res)=>{
  if (!enabled()) return sendError(res,503,'Payment test mode disabled');
  if (req.method !== 'POST') return sendError(res,405,'Method not allowed');
  if (!(await getOwner(req,res))) return;
  try {
    const { items, email } = req.body || {};
    if (!Array.isArray(items) || !items.length || items.length > 50) return sendError(res,400,'Invalid items');
    const ids = items.map(i => String(i.id));
    if (new Set(ids).size !== ids.length || ids.some(id=>!/^[A-Za-z0-9_-]{1,100}$/.test(id))) return sendError(res,400,'Invalid product identifiers');
    const snapshots = await Promise.all(ids.map(id=>db.collection('products').doc(id).get()));
    if (snapshots.some(s=>!s.exists)) return sendError(res,400,'Unknown product');
    const catalog = snapshots.map(s=>({...s.data(),id:s.id}));
    const order = validateCart(items,catalog);
    // Material variant and inventory rules vary by product. Fail closed until integrated.
    if (items.some(i=>i.variantId || i.color || i.size) || catalog.some(p=>p.variants || p.stock != null || p.inventory != null))
      return sendError(res,409,'Variant and inventory validation not yet available');
    const reference = 'TFTEST-' + crypto.randomBytes(16).toString('hex');
    const record = {reference,mode:'test',status:'pending',amountKobo:order.amountKobo,currency:'NGN',lines:order.lines,
      email,createdAt:admin.firestore.FieldValue.serverTimestamp()};
    await db.collection('paymentTestOrders').doc(reference).create(record);
    try {
      const checkout = await initializeTestPayment({key:testSecret.value(),email,amountKobo:order.amountKobo,reference});
      res.status(200).json({reference,authorizationUrl:checkout.authorizationUrl});
    } catch(e) {
      await db.collection('paymentTestOrders').doc(reference).update({status:'initialization_failed'});
      sendError(res,502,'Unable to initialize test transaction');
    }
  } catch(e) {sendError(res,400,'Invalid order');}
});
exports.verifyTimzyTestPayment = onRequest({region:'us-central1',secrets:[testSecret],maxInstances:2,invoker:'public'},async(req,res)=>{
  if (!enabled()) return sendError(res,503,'Payment test mode disabled');
  if (req.method !== 'POST') return sendError(res,405,'Method not allowed');
  if (!(await getOwner(req,res))) return;
  const reference = req.body?.reference;
  if (typeof reference !== 'string' || !/^TFTEST-[a-f0-9]{32}$/.test(reference)) return sendError(res,400,'Invalid reference');
  const ref = db.collection('paymentTestOrders').doc(reference);
  const snap = await ref.get();
  if (!snap.exists) return sendError(res,404,'Unknown reference');
  try {
    const outcome = await verifyTestPayment({key:testSecret.value(),expected:snap.data()});
    if (outcome.verified) await db.runTransaction(async tx=>{
      const current=await tx.get(ref);
      if (current.exists && current.data().status === 'pending')
        tx.update(ref,{status:'paid_test',verifiedAt:admin.firestore.FieldValue.serverTimestamp()});
    });
    res.status(200).json({reference,verified:outcome.verified,status:outcome.verified?'paid_test':'unverified'});
  } catch(e) {sendError(res,502,'Verification unavailable');}
});
exports.timzyTestWebhook = onRequest({region:'us-central1',secrets:[testSecret,webhookSecret],maxInstances:2,invoker:'public',rawBody:true},async(req,res)=>{
  if (!enabled()) return sendError(res,503,'Payment test mode disabled');
  if (req.method !== 'POST') return sendError(res,405,'Method not allowed');
  const raw=req.rawBody;
  const signed=req.get('Paystack-Signature');
  const legacy=req.get('x-paystack-signature');
  const verified=signed ? verifySignedWebhook(raw,signed,webhookSecret.value()) :
    verifyLegacyWebhook(raw,legacy,testSecret.value());
  if (!verified) return sendError(res,401,'Invalid signature');
  const event=req.body;
  if (event?.event !== 'charge.success' || typeof event?.data?.reference !== 'string') return res.status(200).send('ok');
  const reference=event.data.reference;
  if (!/^TFTEST-[a-f0-9]{32}$/.test(reference)) return res.status(200).send('ok');
  const ref=db.collection('paymentTestOrders').doc(reference);
  const snap=await ref.get();
  if (!snap.exists) return res.status(200).send('ok');
  try {
    const outcome=await verifyTestPayment({key:testSecret.value(),expected:snap.data()});
    if (!outcome.verified) return sendError(res,409,'Transaction not verified');
    await db.runTransaction(async tx=>{
      const current=await tx.get(ref);
      if (current.exists && current.data().status==='pending')
        tx.update(ref,{status:'paid_test',verifiedAt:admin.firestore.FieldValue.serverTimestamp()});
    });
    res.status(200).send('ok');
  } catch(e) {sendError(res,503,'Verification temporarily unavailable');}
});
