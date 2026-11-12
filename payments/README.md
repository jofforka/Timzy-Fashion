# Timzy Fashion payment infrastructure — test-mode staging

**Status: server-only foundation, NOT deployed and NOT enabled for customers.**
The existing WhatsApp/bank-transfer/pay-on-delivery/pay-on-pickup checkout is unchanged.
No real or simulated transaction is marked paid by this PR.

## Test locally
Run `node --test payments/payment-core.test.cjs` (Node.js 18+). No merchant account or secrets needed.

## Backend integration contract
1. Deploy an authenticated, rate-limited HTTPS server endpoint (e.g. Firebase Functions on an eligible billing plan). Never serve this module from GitHub Pages.
2. On checkout, accept product IDs, quantities, selected variants, delivery info, and customer email. Ignore browser-supplied totals, prices, payment statuses, and references. Load the **authoritative** Firestore catalog and stock, validate availability/variants and recalculate NGN total on the server. `validateCart` provides basic line-item arithmetic only; variant and inventory validation MUST be added before enabling checkout.
3. Create an immutable order snapshot with server-generated unguessable reference, pending status, total in kobo, currency NGN, customer info, and inventory reservation policy. Use server-only privileges and idempotency to prevent double orders.
4. When test merchant credentials become available, store `sk_test_...` and webhook signing secret in a server-side secrets manager. Call Paystack `POST /transaction/initialize` from the server only, passing verified amount, email, currency NGN and unique reference. Redirect customer to returned Paystack checkout URL.
5. Receive webhook on HTTPS and verify signature against **raw bytes** (prefer timestamped `Paystack-Signature`; legacy `x-paystack-signature` only when necessary). Deduplicate events and verify transaction server-side using `GET /transaction/verify/:reference`. Only transition an order to paid when reference, amount, NGN currency, mode and success status match the immutable order. Do not rely on redirect query parameters or browser callbacks.
6. Restrict payment/order records in Firestore to appropriate owner/staff roles; customers must never write `paid` or financial fields. Keep sensitive customer info out of public collections. Audit failed/replayed webhooks, refunds, and reconciliation.
7. Use a server-only test environment and test credentials for provider sandbox. Do **not** fake successful Paystack payments in production. Leave payment gateway UI disabled until backend, security rules, provider integration, and end-to-end tests pass.
8. Enable live payments only after separate merchant verification, production secret provisioning, webhook registration, rollback plan, and explicit release approval.

## Security boundaries
Never commit API secret keys, webhook signing secrets, or customer payment data. GitHub Pages is static and cannot securely initialize or verify payments. A Paystack public key is not a substitute for server verification.

References: https://paystack.com/docs/api/transaction/ and https://paystack.com/docs/payments/webhooks/
