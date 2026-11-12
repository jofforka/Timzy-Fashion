'use strict';
/**
 * Server-only payment primitives. No secret keys or payment state belong in the browser.
 * This module is intentionally NOT wired into the public checkout until a secure
 * server runtime and merchant credentials are provisioned.
 */
const crypto = require('node:crypto');

function nairaToKobo(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 ||
      Math.round(amount * 100) !== amount * 100) throw new Error('Invalid NGN amount');
  const kobo = Math.round(amount * 100);
  if (!Number.isSafeInteger(kobo)) throw new Error('Amount exceeds safe range');
  return kobo;
}

function validateCart(items, catalog) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('Invalid cart');
  const byId = new Map(catalog.map(p => [String(p.id), p]));
  let total = 0;
  const lines = [];
  for (const item of items) {
    if (!item || !Number.isSafeInteger(item.qty) || item.qty < 1 || item.qty > 100) throw new Error('Invalid quantity');
    const product = byId.get(String(item.id));
    if (!product || String(product.status).toLowerCase() !== 'published') throw new Error('Unavailable product');
    const price = Number(product.salePrice) > 0 ? Number(product.salePrice) : Number(product.price);
    const unitKobo = nairaToKobo(price);
    const lineKobo = unitKobo * item.qty;
    if (!Number.isSafeInteger(lineKobo) || !Number.isSafeInteger(total + lineKobo)) throw new Error('Amount overflow');
    total += lineKobo;
    lines.push({ productId: String(product.id), quantity: item.qty, unitKobo, lineKobo });
  }
  return { currency: 'NGN', amountKobo: total, lines };
}

function verifyPayment(expected, actual) {
  return !!(expected && actual && actual.status === 'success' &&
    actual.reference === expected.reference && actual.currency === 'NGN' &&
    actual.amount === expected.amountKobo &&
    (actual.domain === 'test' || actual.domain === 'live') &&
    actual.domain === expected.mode);
}

function verifyLegacyWebhook(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof secret !== 'string' || !secret ||
      typeof signature !== 'string' || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const digest = crypto.createHmac('sha512', secret).update(rawBody).digest();
  return crypto.timingSafeEqual(digest, Buffer.from(signature, 'hex'));
}

function verifySignedWebhook(rawBody, header, signingSecret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!Buffer.isBuffer(rawBody) || !signingSecret || typeof header !== 'string') return false;
  const parts = header.split(',').map(x => x.trim());
  const ts = parts.find(x => /^t=\d+$/.test(x));
  if (!ts) return false;
  const timestamp = Number(ts.slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;
  const expected = crypto.createHmac('sha512', signingSecret).update(Buffer.concat([Buffer.from(String(timestamp) + '.'), rawBody])).digest();
  return parts.filter(x => /^v1=whk_[^:]+:[a-f0-9]{128}$/i.test(x)).some(x => {
    const provided = Buffer.from(x.slice(x.indexOf(':') + 1), 'hex');
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  });
}

module.exports = { nairaToKobo, validateCart, verifyPayment, verifyLegacyWebhook, verifySignedWebhook };
