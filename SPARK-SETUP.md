# Timzy on the free Spark plan

The public storefront and WhatsApp enquiry checkout remain on GitHub Pages.
Firebase Email/Password Auth and Firestore support one owner admin without
Cloud Functions or a billing upgrade. Free quotas still apply.

Owner: existing Firebase Auth account admin@timzyfashion.com. Its immutable
UID is checked in both the admin UI and rules; an email match or a writable
legacy role document never grants access. Changing the owner requires a
reviewed rules and frontend update. No passwords are stored in source.

The owner manages products, private settings, and append-only manual sales
and expense records. Product removal archives as Draft. Bundled JSON examples
are never auto-imported and cannot become real WhatsApp orders. Only Published
and Out of Stock listings are publicly readable. Staff/investor portals,
automatic stock deduction, investor entitlements, payouts and account
provisioning from PR #9 are deliberately not activated.

Sales and expenses do not move money or inventory. Keep separate reconciled
investor agreements and payout records. Update product availability manually.
WhatsApp enquiries are not saved as database orders or verified payments.
Historical local-storage demo dashboards redirect to the real admin.

## Release order

1. Back up affected Firestore records, deployed rules and Auth accounts to a
   private location outside the public repository. Backups may contain personal,
   financial or credential data; restrict access and do not commit them.
2. Confirm the existing owner can sign in. Check live products for private
   financial fields before allowing public catalogue reads. Four existing
   published products passed the field-name audit on 9 November 2026.
3. Run storefront regressions and the actual Firestore emulator suite in CI.
4. Deploy only these Firestore rules to timzy-fashion-os. Do not deploy
   Functions or change billing. Owner access uses the already-existing Auth UID
   and requires no live profile write. All unspecified collections remain denied.
5. Merge/publish the matching frontend. During rollout old unfiltered public
   queries will fall back to non-orderable examples until the new query loads.
6. Verify owner sign-in, product create/edit/archive, manual entries and denied
   non-owner access. Check the shop and WhatsApp flow on mobile. Do not create
   financial test records or change real stock without explicit approval.

Settings were publicly readable under the previous deployed rules. Any real
upload token previously stored there needs review and rotation through its
provider. Closing Firestore reads does not invalidate an already-copied token.
Image uploads keep the existing Google Apps Script integration; Firebase Cloud
Storage is not provisioned. Payment and public contact details come from the
existing storefront configuration; saving private admin settings does not
automatically publish those details.

## Verification

Run `node tests/shop-showcase.test.cjs`, `node tests/storefront-preview.test.cjs`
and `node tests/public-ui.test.cjs`. The Spark owner security workflow installs
isolated test dependencies and runs real Firestore Rules Emulator assertions
for anonymous access, owner, staff, forged roles and email impersonation.
