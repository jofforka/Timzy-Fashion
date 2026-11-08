'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { asPositiveInt, asNonNegativeInt, saleBreakdown, publicInvestorLine } = require('./lib/finance');

initializeApp();
const db = getFirestore();
const OPTIONS = { region: 'us-central1', cors: ['https://jofforka.github.io'] };
const ROLES = new Set(['super_admin', 'staff', 'investor']);

function fail(message, code = 'invalid-argument') {
  throw new HttpsError(code, message);
}
function textValue(value, label, min = 1, max = 150) {
  if (typeof value !== 'string') fail(label + ' is required.');
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) fail(label + ' is invalid.');
  return trimmed;
}
function validId(value, name = 'Identifier') {
  const id = textValue(value, name, 1, 128);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) fail(name + ' contains invalid characters.');
  return id;
}
function amount(value, name, canBeZero = false) {
  try { return canBeZero ? asNonNegativeInt(value, name) : asPositiveInt(value, name); }
  catch { fail(name + ' must be a whole number of naira.'); }
}
function receiptCode(value) {
  // The same real-world receipt must always use the same Firestore sale ID.
  // A fresh random browser ID on each retry could double-count stock and payouts.
  const code = textValue(value, 'Receipt / invoice number', 6, 64).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{5,63}$/.test(code)) {
    fail('Receipt number must be 6–64 characters (letters, digits, underscore or hyphen).');
  }
  return code;
}
async function profileFor(request, allowed) {
  if (!request.auth?.uid) fail('Sign in to continue.', 'unauthenticated');
  const doc = await db.collection('users').doc(request.auth.uid).get();
  const profile = doc.data();
  if (!doc.exists || profile?.active !== true || !ROLES.has(profile.role)) {
    fail('Account inactive or not assigned.', 'permission-denied');
  }
  if (!allowed.includes(profile.role)) fail('Not authorized for this action.', 'permission-denied');
  return { uid: request.auth.uid, ...profile };
}

exports.provisionUser = onCall(OPTIONS, async request => {
  await profileFor(request, ['super_admin']);
  const data = request.data || {};
  const role = textValue(data.role, 'Role');
  if (!['staff', 'investor'].includes(role)) fail('Only staff and investor accounts may be created here.');
  const email = textValue(data.email, 'Email', 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Invalid email address.');
  const displayName = textValue(data.displayName, 'Display name', 2, 100);
  // The server creates an account WITHOUT a password. Firebase's password-reset
  // email sets the first password. No credentials are stored in code or chat.
  const user = await getAuth().createUser({ email, displayName, disabled: false });
  try {
    await db.collection('users').doc(user.uid).create({
      email, displayName, role, active: true,
      investorId: role === 'investor' ? user.uid : null,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    await getAuth().deleteUser(user.uid).catch(() => {});
    throw error;
  }
  return { uid: user.uid, email, role, onboarding: 'send-password-reset-email' };
});

exports.setAccountActive = onCall(OPTIONS, async request => {
  const actor = await profileFor(request, ['super_admin']);
  const uid = validId(request.data?.uid, 'Account');
  const active = request.data?.active;
  if (typeof active !== 'boolean' || uid === actor.uid) fail('Invalid account status change.');
  const ref = db.collection('users').doc(uid);
  const doc = await ref.get();
  if (!doc.exists || !['staff', 'investor'].includes(doc.data()?.role)) fail('Account not found.');
  await getAuth().updateUser(uid, { disabled: !active });
  await ref.update({ active, updatedAt: FieldValue.serverTimestamp() });
  return { uid, active };
});

exports.saveInvestorAgreement = onCall(OPTIONS, async request => {
  const actor = await profileFor(request, ['super_admin']);
  const productId = validId(request.data?.productId, 'Product ID');
  const investorUid = validId(request.data?.investorUid, 'Investor account');
  const payoutPerUnit = amount(request.data?.payoutPerUnit, 'Agreed payout');
  const active = request.data?.active !== false;
  // Reference the documented investor agreement or written amendment.
  // This note is visible to the investor but never contains the retail margin.
  const changeReason = textValue(request.data?.changeReason, 'Agreement reference / reason', 12, 300);
  const productRef = db.collection('products').doc(productId);
  const investorRef = db.collection('users').doc(investorUid);
  const agreementRef = db.collection('investorAgreements').doc(productId);
  const catalogRef = db.doc('investorCatalog/' + investorUid + '/items/' + productId);

  await db.runTransaction(async tx => {
    const [product, investor, prior, catalog] = await Promise.all([
      tx.get(productRef), tx.get(investorRef), tx.get(agreementRef), tx.get(catalogRef)
    ]);
    if (!product.exists) fail('Product not found.', 'not-found');
    if (!investor.exists || investor.data().role !== 'investor' ||
        investor.data().active !== true || investor.data().investorId !== investorUid) {
      fail('Choose an active investor account.', 'failed-precondition');
    }
    if (prior.exists && prior.data().investorUid !== investorUid) {
      fail('Investor ownership cannot be changed on a product with an existing agreement. Create a distinct product listing.', 'failed-precondition');
    }
    const p = product.data();
    if (p.status === 'Draft' || p.status === 'Deleted') fail('Draft products cannot be assigned.');
    const previous = prior.exists ? prior.data() : null;
    const changed = !previous || previous.payoutPerUnit !== payoutPerUnit || previous.active !== active;
    if (!changed) return;
    // Preserve a distinct amendment record for every actual change.
    const oldVersion = previous
      ? (Number.isSafeInteger(previous.version) && previous.version > 0 ? previous.version : 1)
      : 0;
    const version = oldVersion + 1;
    const amendmentRef = db.doc('investorCatalog/' + investorUid + '/history/' +
      db.collection('auditEvents').doc().id);
    const previousPayoutPerUnit = previous ? previous.payoutPerUnit : null;
    const previousActive = previous ? previous.active : null;
    const change = {
      productId,
      productName: String(p.name || 'Timzy Product').slice(0, 150),
      version, previousPayoutPerUnit, payoutPerUnit,
      previousActive, active,
      changeReason, changedAt: FieldValue.serverTimestamp()
    };
    tx.set(agreementRef, {
      productId, investorUid, payoutPerUnit, active, version,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid
    }, { merge: true });
    tx.set(catalogRef, {
      productId,
      productName: String(p.name || 'Timzy Product').slice(0, 150),
      image: String((Array.isArray(p.images) && p.images[0]) || p.image1 || '').slice(0, 1000),
      colour: String(p.color || 'As shown').slice(0, 80),
      payoutPerUnit, active, version,
      unitsSold: catalog.exists ? Number(catalog.data().unitsSold || 0) : 0,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.create(amendmentRef, change);
    tx.create(db.collection('auditEvents').doc(), {
      action: 'agreement_amended', actorUid: actor.uid, productId, investorUid,
      version, previousPayoutPerUnit, payoutPerUnit,
      previousActive, active, changeReason,
      createdAt: FieldValue.serverTimestamp()
    });
  });
  return { productId, investorUid, payoutPerUnit, active };
});

exports.recordSale = onCall(OPTIONS, async request => {
  const actor = await profileFor(request, ['super_admin', 'staff']);
  const productId = validId(request.data?.productId, 'Product ID');
  const receipt = receiptCode(request.data?.receiptCode);
  // One receipt can have multiple product lines. Each line is individually
  // idempotent across browser retries or multiple cashiers.
  const lineNumber = request.data?.lineNumber === undefined ? 1 : request.data.lineNumber;
  if (!Number.isSafeInteger(lineNumber) || lineNumber < 1 || lineNumber > 99) {
    fail('Invoice line must be a whole number between 1 and 99.');
  }
  const id = 'receipt_' + receipt + '_line_' + lineNumber;
  const quantity = amount(request.data?.quantity, 'Quantity');
  if (quantity > 100) fail('Quantity is too large.');
  const unitSalePrice = amount(request.data?.unitSalePrice, 'Actual unit sale price');
  const customerReference = typeof request.data?.customerReference === 'string'
    ? request.data.customerReference.trim().slice(0, 120) : '';

  const saleRef = db.collection('sales').doc(id);
  const productRef = db.collection('products').doc(productId);
  const agreementRef = db.collection('investorAgreements').doc(productId);
  const financeRef = db.collection('financeSales').doc(id);
  const now = new Date().toISOString().slice(0, 10);

  const result = await db.runTransaction(async tx => {
    const [existing, product, agreement] = await Promise.all([
      tx.get(saleRef), tx.get(productRef), tx.get(agreementRef)
    ]);
    if (existing.exists) {
      const prior = existing.data();
      if (prior.productId !== productId || prior.quantity !== quantity ||
          prior.unitSalePrice !== unitSalePrice) {
        fail('This receipt number has already been used for a different sale.', 'already-exists');
      }
      return { id, alreadyRecorded: true };
    }
    if (!product.exists) fail('Product not found.', 'not-found');
    const p = product.data();
    if (!['published', 'available'].includes(String(p.status || '').toLowerCase())) {
      fail('Product is not currently available.', 'failed-precondition');
    }
    // Legacy "quantity: Available" is not stock accounting. Super Admin must
    // first enter a VERIFIED numeric stockOnHand in the product editor.
    if (!Number.isSafeInteger(p.stockOnHand) || p.stockOnHand < quantity) {
      fail('Insufficient verified stock. Ask Super Admin to set the correct stock quantity.', 'failed-precondition');
    }

    // Once an item belongs to an investor, the entitlement must never be
    // silently bypassed. Pausing the agreement pauses checkout of the item.
    if (agreement.exists && agreement.data().active !== true) {
      fail('Investor agreement is paused. Super Admin must resolve the terms before selling.',
        'failed-precondition');
    }
    const a = agreement.exists ? agreement.data() : null;
    let investorCatalogRef;
    let catalog;
    if (a) {
      investorCatalogRef = db.doc('investorCatalog/' + a.investorUid + '/items/' + productId);
      catalog = await tx.get(investorCatalogRef);
      if (!catalog.exists) fail('Investor agreement needs an investor catalogue entry.', 'failed-precondition');
    }
    const breakdown = saleBreakdown({
      quantity, unitSalePrice, payoutPerUnit: a?.payoutPerUnit || 0
    });
    if (a && breakdown.grossMarginBeforeCosts < 0 && actor.role !== 'super_admin') {
      fail('This sale price needs Super Admin approval.', 'failed-precondition');
    }

    const left = p.stockOnHand - quantity;
    tx.update(productRef, {
      stockOnHand: left,
      status: left === 0 ? 'Out of Stock' : 'Published',
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.create(saleRef, {
      id, productId, productName: String(p.name || 'Timzy Product').slice(0, 150),
      quantity, unitSalePrice,
      amount: breakdown.amount,
      description: String(p.name || 'Timzy Product').slice(0, 150) + ' × ' + quantity,
      receiptCode: receipt, lineNumber, customerReference, date: now, createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp()
    });

    if (a) {
      tx.create(financeRef, {
        id, productId, investorUid: a.investorUid, quantity,
        agreementVersion: Number.isSafeInteger(a.version) ? a.version : 1,
        payoutPerUnit: breakdown.unitInvestorPayout,
        actualRetailTotal: breakdown.amount,
        investorTotalDue: breakdown.investorTotalDue,
        grossMarginBeforeCosts: breakdown.grossMarginBeforeCosts,
        status: 'due', createdAt: FieldValue.serverTimestamp()
      });
      tx.create(db.doc('investorSales/' + a.investorUid + '/entries/' + id), {
        ...publicInvestorLine({
          productId, productName: String(p.name || 'Timzy Product').slice(0, 150),
          units: quantity,
          unitInvestorPayout: breakdown.unitInvestorPayout,
          investorTotalDue: breakdown.investorTotalDue,
          soldAt: now, status: 'due'
        }),
        agreementVersion: Number.isSafeInteger(a.version) ? a.version : 1,
        createdAt: FieldValue.serverTimestamp()
      });
      tx.update(investorCatalogRef, {
        unitsSold: FieldValue.increment(quantity),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    tx.create(db.collection('auditEvents').doc(), {
      action: 'sale_recorded', actorUid: actor.uid, saleId: id, productId,
      createdAt: FieldValue.serverTimestamp()
    });
    return { id, productId, quantity, amount: breakdown.amount, remainingStock: left };
  });
  return result;
});

// Reversals preserve the original sale and amounts for the audit trail.
// They do not send customer refunds or recover money paid to investors.
exports.reverseSale = onCall(OPTIONS, async request => {
  const actor = await profileFor(request, ['super_admin']);
  const saleId = validId(request.data?.saleId, 'Sale ID');
  const reason = textValue(request.data?.reason, 'Reason for reversal', 12, 300);
  const kind = textValue(request.data?.kind, 'Reversal type', 5, 30);
  if (!['entry_error', 'customer_refunded'].includes(kind)) {
    fail('Select mistaken entry or confirmed customer refund.');
  }
  const reference = kind === 'customer_refunded'
    ? textValue(request.data?.refundReference, 'Customer refund reference', 5, 120)
    : null;
  const saleRef = db.collection('sales').doc(saleId);
  const financeRef = db.collection('financeSales').doc(saleId);
  const outcome = await db.runTransaction(async tx => {
    const [saleDoc, financeDoc] = await Promise.all([
      tx.get(saleRef), tx.get(financeRef)
    ]);
    if (!saleDoc.exists) fail('Sale not found.', 'not-found');
    const sale = saleDoc.data();
    if (sale.status === 'reversed') fail('Sale has already been reversed.', 'already-exists');
    if (!sale.receiptCode || !Number.isSafeInteger(sale.quantity) || sale.quantity < 1 ||
        !sale.productId || !Number.isSafeInteger(sale.amount)) {
      fail('Legacy or incomplete sales require a separately reviewed correction.', 'failed-precondition');
    }
    if (financeDoc.exists && financeDoc.data().status !== 'due') {
      fail('An investor payout was already settled or changed. Reconcile that payment before reversing this sale.',
        'failed-precondition');
    }

    const productRef = db.collection('products').doc(sale.productId);
    const productDoc = await tx.get(productRef);
    if (!productDoc.exists || !Number.isSafeInteger(productDoc.data().stockOnHand)) {
      fail('Cannot restore unverified or missing inventory.', 'failed-precondition');
    }
    const restored = productDoc.data().stockOnHand + sale.quantity;
    if (!Number.isSafeInteger(restored) || restored > 1000000000) {
      fail('Inventory correction exceeds supported quantity.', 'failed-precondition');
    }

    let investorRef;
    let investorLineRef;
    if (financeDoc.exists) {
      const finance = financeDoc.data();
      const owner = validId(finance.investorUid, 'Investor UID');
      investorRef = db.doc('investorCatalog/' + owner + '/items/' + sale.productId);
      investorLineRef = db.doc('investorSales/' + owner + '/entries/' + saleId);
      const [catalog, investorLine] = await Promise.all([
        tx.get(investorRef), tx.get(investorLineRef)
      ]);
      if (!catalog.exists || !Number.isSafeInteger(catalog.data().unitsSold) ||
          catalog.data().unitsSold < sale.quantity || !investorLine.exists ||
          investorLine.data().status !== 'due') {
        fail('Investor ledger is inconsistent; review before reversal.', 'failed-precondition');
      }
    }

    tx.update(productRef, {
      stockOnHand: restored,
      status: 'Published',
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(saleRef, {
      status: 'reversed', reversalKind: kind, reversalReason: reason,
      ...(reference ? { refundReference: reference } : {}),
      reversedBy: actor.uid, reversedAt: FieldValue.serverTimestamp()
    });
    if (financeDoc.exists) {
      tx.update(financeRef, {
        status: 'reversed', reversedBy: actor.uid,
        reversedAt: FieldValue.serverTimestamp()
      });
      tx.update(investorLineRef, {
        status: 'reversed', reversedAt: FieldValue.serverTimestamp()
      });
      tx.update(investorRef, {
        unitsSold: FieldValue.increment(-sale.quantity),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    tx.create(db.collection('auditEvents').doc(), {
      action: 'sale_reversed', saleId, productId: sale.productId,
      reason, kind, actorUid: actor.uid, createdAt: FieldValue.serverTimestamp()
    });
    return { saleId, status: 'reversed', restoredStock: restored,
      investorEntitlementCancelled: financeDoc.exists };
  });
  return outcome;
});

exports.markInvestorPayout = onCall(OPTIONS, async request => {
  const actor = await profileFor(request, ['super_admin']);
  const investorUid = validId(request.data?.investorUid, 'Investor account');
  const saleId = validId(request.data?.saleId, 'Sale ID');
  const reference = textValue(request.data?.paymentReference, 'Payment reference', 3, 120);
  const financeRef = db.collection('financeSales').doc(saleId);
  const entryRef = db.doc('investorSales/' + investorUid + '/entries/' + saleId);

  await db.runTransaction(async tx => {
    const [finance, entry] = await Promise.all([tx.get(financeRef), tx.get(entryRef)]);
    if (!finance.exists || !entry.exists || finance.data().investorUid !== investorUid) {
      fail('Investor sale not found.', 'not-found');
    }
    if (finance.data().status === 'paid') fail('Payout already marked paid.', 'already-exists');
    if (finance.data().status !== 'due' || entry.data().status !== 'due') {
      fail('Only an outstanding, non-reversed investor entitlement may be marked paid.',
        'failed-precondition');
    }
    const paid = {
      status: 'paid', paidAt: FieldValue.serverTimestamp(),
      paymentReference: reference, paidBy: actor.uid
    };
    tx.update(financeRef, paid);
    tx.update(entryRef, {
      status: 'paid', paidAt: FieldValue.serverTimestamp(),
      paymentReference: reference
    });
    tx.create(db.collection('auditEvents').doc(), {
      action: 'payout_confirmed', actorUid: actor.uid,
      investorUid, saleId, createdAt: FieldValue.serverTimestamp()
    });
  });
  return { saleId, investorUid, status: 'paid' };
});
