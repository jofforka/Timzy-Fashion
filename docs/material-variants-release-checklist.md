# Material catalogue release gates

## Implemented in PR #13

- Three unpublished families with 14 prepared 1000 × 1000 WebP assets committed under `assets/img/materials/`.
- Canonical family/variant IDs, galleries and cover images in `data/material-variants.draft.json`.
- Admin preparation imports missing drafts atomically, preserves existing documents, and refuses name/SKU collisions under other IDs. Presets load committed image paths without requiring a separate media service. Admin previews resolve paths relative to `/admin/`.
- Merchant-editable variant JSON retains IDs, price, stock, images and size/selling unit labels. Unknown commercial values remain null/blank, never fabricated.
- Storefront color selection controls image, price, selling units and purchase availability. Basket records retain family, variant, color and unit; stock limits apply across unit/size rows. Shared checkout/WhatsApp validation rejects unknown commerce and stale product data. Checkout reloads public products before submission.
- Firestore variant validation permits only public fields. Owner-only product writes and private investor/finance permissions remain enforced. Rules bound each family to 8 colors and 40 string unit labels per color; `~` is reserved in labels.

## Verification commands

```sh
node --test tests/*.test.cjs
npm ci --prefix tests/spark-rules --no-audit --no-fund
tests/spark-rules/node_modules/.bin/firebase emulators:exec --project demo-timzy-spark --only firestore "node tests/spark-rules/test.cjs"
tests/spark-rules/node_modules/.bin/playwright install --with-deps chromium
tests/spark-rules/node_modules/.bin/firebase emulators:exec --project demo-timzy-spark --only firestore "node tests/spark-rules/material-browser.cjs"
```

The Chromium test uses the real admin/storefront DOM and Firestore SDK with local emulator identities. Prices, units and quantities in tests are isolated fixtures. They are never written to production. The browser bootstrap is intercepted by the test only; production configuration is unchanged.

## Required before production release

1. All GitHub checks must pass on the final commit. Keep PR draft until reviewed.
2. Merchant must compare every prepared shade to physical samples. These recolored pictures are provisional; filenames and successful loading do not prove shade accuracy (the white preview appears gray).
3. An authorized owner must back up live products and apply the reviewed Firestore rules through the existing release process. Current live rules and owner login have not been verified by this branch.
4. After reviewed code is released, use **Prepare missing fabric drafts**. Existing products are preserved; if one already exists, edit it or load its preset deliberately. Reconcile collisions rather than creating duplicate families.
5. Confirm real prices, stock and selling units before publishing. Do not expose investor identity or agreements in public product fields. Keep private assignments under `investorCatalog`.
6. Verify all 14 asset responses and each published product on the actual hosted site. Check mobile, admin save/reload, legacy outfits, basket, WhatsApp and investor isolation using authorized test accounts.
7. Orders currently use WhatsApp enquiries; there is no server-side payment, stock reservation or concurrent inventory decrement. Staff must confirm final stock and price before accepting payment. Browser validation does not provide a stock reservation guarantee.

No merge, hosting deployment, rules deployment or live Firebase import is performed by these tests.
