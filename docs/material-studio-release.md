# Timzy Fabric Studio — first release

## Included

- Published-material comparison: colors, composition, weight, texture, breathability, care, uses and occasion tags. Blank details say that Timzy has not provided them.
- Occasion browsing uses merchant-selected tags, never guesses suitability from a material name or photograph. Existing outfit browsing remains independent of the material filter.
- Product fabric information and optional HTTPS MP4/WebM movement video, with native controls, no autoplay and no automatic media download.
- Color-aware “Create a look” link into a fabric-first style brief. The builder now initializes Firebase and reads the same published catalogue as the shop.
- Browser-local saved brief, explicit clear control, and user-initiated WhatsApp enquiry. No measurements, account creation, stock reservation, automatic messages or confirmed purchase is implied.
- Admin fields for merchant-entered fabric details, videos and occasions. Existing product data has no automatic defaults for fabric properties.

## Data and privacy

`fabricProfiles/{productId}` is an optional public display map. Its allowed keys are composition, weight, feel, breathability, care, uses, videoUrl and occasions. One display-only collection is added. No role or third-party integration is introduced. Public profile reads require the parent product to be published; only the owner can write. Draft products remain private. Investor collection permissions are unchanged. The new Firestore collection requires publishing the reviewed rule change before admin profile saves can succeed.

Occasion IDs: wedding, work, festive, graduation and everyday. They are discovery tags, not claims about availability or tailoring inclusion. Specs are merchant-supplied; the software cannot independently verify physical properties. No prices, stock, sizes, specs or videos are seeded into production.

## Checks and release order

1. Run all `tests/*.test.cjs`, the Firestore Emulator suite and the Chromium/Firestore browser suite in GitHub Actions.
2. Review the optional public profile schema and its privacy/validation tests, including an eight-color product with complete profile data.
3. Publish the matching reviewed rules through the authorized production process; then release the frontend/admin code. No deployment is performed by this branch.
4. Owner adds accurate specs, occasion tags and genuine movement videos. All three prepared fabrics currently remain Draft until commercial data and shade approval are ready.
5. Check compare, occasion filtering, product details, color links, brief save/reload/clear and WhatsApp enquiry on the live site after release. Enquiry text must be reviewed and sent by the customer.

Not included in this first release: physical sample fulfilment, customer measurement accounts, tailoring progress, wedding group ordering, restock notifications or customer review moderation. These need separate operational and privacy workflows.
