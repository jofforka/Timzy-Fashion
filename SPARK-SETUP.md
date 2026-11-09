# Timzy on the free Spark plan

The public storefront and WhatsApp enquiry checkout remain on GitHub Pages.
Firebase Email/Password Auth and Firestore support admin, staff and investor accounts without
Cloud Functions or a billing upgrade. Free quotas still apply.

Owner: existing Firebase Auth account admin@timzyfashion.com. Its immutable
UID is checked in both the admin UI and rules; an email match or a writable
legacy role document never grants access. Changing the owner requires a
reviewed rules and frontend update. No passwords are stored in source.

The owner manages products, private settings, manual sales/expenses, account
permissions, and private investor product assignments. Staff can browse published
products and enter/read only their own manual sales. Staff cannot edit products,
read expenses, settings, investor agreed prices or the owner's sales. Investors
can read only their assigned product name/image, agreed unit price and agreement
reference. The investor portal never queries retail sales, expenses or settings.
Public advertised shop prices are still public; private realized sales stay protected.

Permissions live in `access/{firebaseAuthUid}` with role `staff` or `investor`,
an `active` boolean and a non-sensitive account label. Only the fixed owner can
write them; users can only read their own permission profile. Legacy email-keyed
`users` documents and custom role claims grant no privileges. The owner can
disable access or switch role; rules enforce the change even if a stale browser
still shows old controls. Data is cleared on sign-out and delayed responses are
discarded after account switches.

Investor records live at `investorCatalog/{uid}/items/{productId}`. An explicit
field allowlist excludes retail price, profit, margin, private accounts and
unrelated investor IDs. Admin writes the current agreed unit price and reference
after verifying the agreement outside the app. This is a current product list,
not a historical entitlement ledger, payout statement or consent signature.
Removing an assignment only removes it from that investor's view; it does not
cancel an agreement or payment obligation.

Product removal archives as Draft. Bundled examples are never auto-imported and
cannot become real WhatsApp orders. Only Published and Out of Stock listings are
publicly readable. Automatic stock deductions, investor earnings/payout automation
and Cloud Functions from PR #9 remain inactive.

Sales and expenses are append-only manual records tagged with the authenticated
creator UID. Staff cannot impersonate another creator or alter existing receipts.
These records do not move money or inventory. The dashboard shows up to 100 sales
records, not an unlimited all-time accounting balance. Keep separate reconciled
investor sales and payout records. Update product availability manually.
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
6. In Firebase Authentication, create individual email/password accounts or use
   existing ones. Use Firebase's password setup/reset workflow; never invent shared
   passwords or put credentials in source. Copy each actual Auth UID into the
   owner's Account Permissions form; select Staff or Investor and Active. Account
   Permissions grants shop rights but does not create a login or send email.
   The login page's Set or reset my password button requests a Firebase password
   link only after the person enters an email and clicks it. Account import may
   create a new email identity without a password; the person sets their own
   password through this flow. No generated/shared password is required.
   Use Investor Products to choose the investor and genuine product and save the
   agreed price/reference. The first requested investor identity is managed
   privately during rollout; do not commit personal account details.
7. Verify owner, staff and two separate investor identities, product create/edit/
   archive, own sales and denied cross-account reads. Check mobile shop/WhatsApp.
   Unassigned or disabled accounts must be denied. Do not create
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
and `node tests/public-ui.test.cjs`, plus `node tests/role-portals.test.cjs`.
The Spark three-role security workflow installs
isolated test dependencies and runs real Firestore Rules Emulator assertions
for anonymous access, owner, staff, two investors, forged roles, creator spoofing,
email impersonation, disabled accounts and private investor field validation.
