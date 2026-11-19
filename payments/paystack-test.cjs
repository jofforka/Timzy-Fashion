'use strict';
// Server-side Paystack transport. Never import this module into public pages.
const { verifyPayment } = require('./payment-core.cjs');
const API = 'https://api.paystack.co';
function testSecret(key) {
  if (typeof key !== 'string' || !/^sk_test_[A-Za-z0-9]+$/.test(key)) throw new Error('Test secret key required');
  return key;
}
async function request(path, { key, method = 'GET', body, fetchImpl = fetch } = {}) {
  testSecret(key);
  const response = await fetchImpl(API + path, {
    method, headers: { Authorization: 'Bearer ' + key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('Payment provider request failed');
  const result = await response.json();
  if (!result || result.status !== true || !result.data) throw new Error('Invalid provider response');
  return result.data;
}
async function initializeTestPayment({ key, email, amountKobo, reference, callbackUrl, fetchImpl }) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Invalid email');
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) throw new Error('Invalid amount');
  if (typeof reference !== 'string' || !/^[A-Za-z0-9.=-]{8,100}$/.test(reference)) throw new Error('Invalid reference');
  if (callbackUrl && (!/^https:\/\//.test(callbackUrl) || callbackUrl.length > 2048)) throw new Error('Invalid callback URL');
  const data = await request('/transaction/initialize', {
    key, method: 'POST', fetchImpl,
    body: { email, amount: String(amountKobo), currency: 'NGN', reference, ...(callbackUrl ? {callback_url: callbackUrl} : {}) }
  });
  if (data.reference !== reference || typeof data.authorization_url !== 'string' ||
      !/^https:\/\/checkout\.paystack\.com\//.test(data.authorization_url)) throw new Error('Invalid checkout response');
  return { reference, authorizationUrl: data.authorization_url };
}
async function verifyTestPayment({ key, expected, fetchImpl }) {
  if (!expected || expected.mode !== 'test' || typeof expected.reference !== 'string' ||
      !/^[A-Za-z0-9.=-]{8,100}$/.test(expected.reference)) throw new Error('Invalid pending order');
  const data = await request('/transaction/verify/' + encodeURIComponent(expected.reference), {key, fetchImpl});
  return { verified: verifyPayment(expected, data), status: data.status, reference: expected.reference };
}
module.exports = { initializeTestPayment, verifyTestPayment };
