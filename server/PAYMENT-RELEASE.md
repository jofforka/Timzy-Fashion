# Payment release gates

The HTTP adapter is disabled by default and accepts only test-mode Paystack secrets. It is not a deployed service. Do not expose it until all gates are met.

- Choose a trusted Node runtime with Firebase Admin credentials supplied through its secret manager.
- Supply a distributed rate limiter, exact storefront origin, HTTPS callback, and Paystack test secret. Never put secrets in GitHub Pages.
- Integrate verified sales with investor ledger and existing sales records atomically.
- Add checkout and admin UI, including explicit pickup-only limitation and manual fallback.
- Implement initialization idempotency and stock reservation or a documented refund workflow.
- Run real Firestore emulator concurrency tests and Paystack sandbox end-to-end tests.
- Verify webhook retries, callback ownership, authentication, reconciliation, and refund handling.
- Obtain approval before enabling live credentials or incurring hosting charges.
