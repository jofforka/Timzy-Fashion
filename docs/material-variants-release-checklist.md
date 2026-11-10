# Timzy material variants: release checklist

## Current status
This branch is a **draft implementation**, not a release. The 14 planned asset URLs in `data/material-variants.draft.json` are placeholders until files are uploaded. Do not import draft products as published or merge before completing verification.

## Media preparation
1. Obtain and visually approve each of the 14 shade images against physical fabric samples; recolored images are provisional.
2. Upload images through the existing authorized media workflow, or commit the approved WebP files to `assets/img/materials/` using an authenticated binary-capable Git client.
3. Confirm every asset URL returns HTTP 200 with image/webp and loads on mobile. Avoid external Google Drive sharing links that do not return direct image content.
4. Update each variant's `image` to its verified permanent URL. Never expose private Drive credentials or investor data.

## Firebase
1. Sign in as an authorized administrator; back up existing `products` documents.
2. Check for preexisting versions of the three fabrics by name/SKU before creating anything. Update existing products instead of duplicating them.
3. Create or update exactly three products in category `Fabrics`, each with an array of color variants; keep them Draft until approved.
4. Set actual stock, sizes and prices from the merchant. Do not invent values. Variant images should match their shade names.
5. Verify Firestore rules: only authorized staff can write product documents, and customer queries cannot access investor or finance records.

## Customer flow
1. In the shop's Fabrics & Materials section, verify exactly three product cards appear when published.
2. Open each product, change every color, verify the image and displayed price/stock, and test keyboard/mobile access.
3. Confirm unknown prices and out-of-stock colors cannot be purchased.
4. Confirm the selected color is retained in the bag and WhatsApp order details.
5. Test changing price/stock after adding to bag; checkout must block stale items.
6. Check that fabric-only products never claim tailoring is included.
7. Verify legacy outfits and accessories still work.

## Final gates
- Run GitHub Actions checks and browser tests.
- Review checkout, Firestore rules, admin role boundaries, and stock concurrency; client-side checks alone cannot guarantee inventory reservation.
- Obtain approval for real prices, quantities and images.
- Merge after successful review, deploy through the existing deployment pipeline, and verify production URLs.
