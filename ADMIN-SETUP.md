# Timzy Fashion — Secure Accounts, Shop Sales & Investor Portal

## What is implemented in source

Firebase Authentication (email + individual password) is paired with an authorization profile in `users/{firebaseUid}`.

| Role | Backend rights | Dashboard |
| --- | --- | --- |
| `super_admin` | Product CMS, verified stock, actual sales, investor agreements, financial margins, expenses, settings, staff/investor account provisioning and payment reconciliation | Full admin |
| `staff` | Read stock and operational sales. Record a verified sale via the callable function only. Cannot edit public products, terms, expenses or private margins | Shop operations |
| `investor` | Read **only their own** `investorCatalog/{uid}/items` and `investorSales/{uid}/entries` | Products, agreed payout per unit, units sold, due, paid |

This is one private login URL: `https://jofforka.github.io/Timzy-Fashion/admin/`. There are no shared passwords and no investor credentials embedded in the website.

**Important business distinction:** An investor entitlement is **not** a statement of the customer selling price. The public shop's advertised prices remain visible to anyone who browses the shop. Actual realized sales prices and gross margins remain restricted to authorized operations / Super Admin according to role.

### Example

For one material with an agreed payout of **₦8,000** that sells to a customer for **₦15,000**:

- `sales/{saleId}`: retail sale **₦15,000**, quantity, staff, date; staff and Super Admin can read.
- `financeSales/{saleId}`: retail **₦15,000**; investor obligation **₦8,000**; gross margin before expenses **₦7,000**; Super Admin only.
- `investorSales/{investorUid}/entries/{saleId}`: **₦8,000 agreed entitlement**, quantity 1, status `due`; the investor and Super Admin can read. **No retail price or margin in this document.**
- `products/{productId}.stockOnHand`: decremented atomically, from the previously verified count.
- Investor dashboard displays **Agreed payout ₦8,000**, **Amount due ₦8,000**. Never describe this as the actual retail sale price.

## Deployment — not complete merely by merging the pull request

The repository currently uses GitHub Pages for static hosting and Firebase for its backend. GitHub deployment alone **does not deploy Cloud Functions or Firestore Rules**. The source changes must not be treated as production security until Firebase deployment and authorization testing are verified.

1. Confirm you control Firebase project **`timzy-fashion-os`**, have IAM permissions and a trusted administrator, and have a working backup of products, existing financial records and Auth users. Verify project billing: **Firebase Cloud Functions requires the Blaze plan**. Enable billing alerts and sensible Cloud Run function instance limits.
2. Install Firebase CLI and login locally: `npm install -g firebase-tools`, then `firebase login`. Ensure Firebase Email/Password Authentication is enabled.
3. Verify your existing **owner** account exists under Firebase Console → Authentication → Users. Do **not** type owner passwords or upload service-account keys into GitHub or this chat.
4. With a trusted Firebase Admin identity (Google Cloud Application Default Credentials from your authorized machine), install dependencies: `cd functions && npm install && npm run check && npm test && cd ..`. Bootstrap your **existing** owner Auth account to `super_admin` by running the guarded `functions/scripts/bootstrap-superadmin.js` with explicit project ID, confirmation environment variable and owner email:
   ```bash
   GOOGLE_CLOUD_PROJECT=timzy-fashion-os \
   TIMZY_BOOTSTRAP_CONFIRM=timzy-fashion-os:super_admin \
   node functions/scripts/bootstrap-superadmin.js OWNER_EMAIL_HERE
   ```
   Run only after obtaining a trusted application-default credential via `gcloud auth application-default login` or equivalent authorized service identity. Bootstrap refuses to displace a different existing Super Admin.
5. **Before deployment, inspect existing Firestore product records for private investor data.** With the same authorized Admin credentials, run:
   ```bash
   GOOGLE_CLOUD_PROJECT=timzy-fashion-os \\
   TIMZY_AUDIT_CONFIRM=read-only \\
   node functions/scripts/audit-public-products.js
   ```
   The script is read-only. It reports product IDs and sensitive **field names only**, not values. Stop deployment if any legacy public product contains `costPrice`, `payoutPerUnit` or another financial field. Clean data via an explicitly reviewed migration, not by deleting records.

6. Deploy Cloud Functions and rules to the intended project, verifying the command and project ID before execution:
   ```bash
   firebase deploy --project timzy-fashion-os --only functions
   firebase deploy --project timzy-fashion-os --only firestore:rules
   ```
   This changes production privileges. Run this during a maintenance window; existing users without `users/{uid}` roles will be denied access once the rules are deployed.
7. Verify the **rules themselves** with Firebase Emulator Suite / test accounts, not only the frontend. Confirm: investors cannot query `sales`, `financeSales`, `settings`, `users` of others or another investor's ledger; staff cannot read costs, create accounts or edit stock directly; unauthenticated browsers cannot write `orders` or `sales`; only the Super Admin can edit products and investor terms.
8. Merge the frontend/admin PR **only after** functions, rules and Super Admin bootstrap are verified. Then log in to `/admin/`, create an individual Staff and Investor account, and send password setup emails. Do not invent shared demo logins. In the Super Admin editor, set **Verified Stock on Hand** on an actual material product, then save an Investor Agreement with the investor's negotiated payout per unit.
9. Perform end-to-end test with **non-production test accounts and products**, including **multiple sale attempts** and duplicate reference protections. Staff records one sale; stock decreases; investor ledger shows entitlement only; Super Admin shows true sale and margin; payout can only be marked paid by Super Admin after a verified transfer.

## Legacy data cautions

- Product removal uses **Archive (Draft)** rather than deleting historic sales-linked data. Duplicating a product creates a new Draft without cloning physical stock or investor terms; the Super Admin must verify quantity and ownership before publishing.
- The product editor now saves through a **Firestore transaction**. If a staff sale or another admin's edit changes the product after it was opened, the stale save is rejected and the editor reloads. This prevents silently restoring a sold item's old stock count. If images were uploaded immediately before a rejected save, the media folder may contain unused files that should be reviewed manually.
- Current bundled `data/products.json` contains **sample/demo** listings and images. The admin no longer automatically imports those into production. A stock value must be verified by Super Admin; the old string `quantity: "Available"` is not a trustworthy inventory count.
- Old manual `sales` records are descriptive amounts without product-level stock or investor agreement metadata. They remain in the collection but **are not automatically converted into investor liabilities**; they require a reviewed migration with reconciliation and approval.
- Public Firebase catalogue reads must be restricted to `Published` and `Out of Stock`. Drafts and hidden products must not be public; legacy records missing `status` need explicit review.
- Bundled JSON fallback records are treated as non-orderable samples if Firestore data is unavailable.
- The checkout still hands off via WhatsApp; it **does not automatically receive a verified payment event**. Shop staff must record a sale only when payment/completion has actually been confirmed. Every sale requires a **unique receipt/invoice code plus line number**; for multi-product receipts use line 1, line 2 etc. Repeat the same code + line after a network uncertainty, rather than inventing a second receipt.
- Investor payout `paid` is a ledger state, **not a bank transfer**. A payment reference is required; this app does not send funds.
- Investor agreements now retain **immutable, version-numbered amendments**. The Super Admin must enter the written agreement reference/reason when creating or changing a payout rate or pausing the agreement; each historical rate is visible to that investor. The system cannot verify signatures or consent automatically—verify the agreed terms outside the platform before recording an amendment.
- An agreement can be paused. **A product with a paused investor agreement cannot be sold by staff or Super Admin as store-owned inventory.** A separate, genuinely Timzy-owned product may be sold normally if no investor agreement exists.
- Each investor sale stores its contracted payout per unit and agreement version at the time of sale. Changes to a future rate do not recalculate existing dues; a product cannot silently switch ownership from one investor to another. Use separate product SKUs for separate investors, even for identical fabric.
- Discounts below an investor's agreed payout require a Super Admin role to enter; nothing may silently reduce an investor's contractual entitlement.
- A **Super Admin-only reversal workflow** now preserves the original transaction, reverses an **unpaid** investor entitlement and restores stock **only for mistaken entries or for physically returned, inspected and resellable goods**. A correction must be categorized as an incorrectly entered sale (no money movement) or an **already completed** customer refund with a payment reference. The system **never transfers refund money**.
- Investor payouts already marked paid cannot be automatically reversed; they require a separate reviewed recovery/accounting process. Legacy unstructured sales also require a separate reconciliation before they can be corrected.
- Customer refund reversal defaults to **no restock** unless physically returned and verified. Archived products remain archived even when stock is restored. Investor obligations after damage/returns depend on the signed agreement and require review; the system cannot adjudicate that contract.
- Current reversal is an all-units correction for a single invoice line; partial returns or exchanges are not yet supported. Do not misrepresent the correction as a payment refund.

## Production safety checklist

- [ ] Firebase project and billing verified; backup exported
- [ ] Read-only product audit has confirmed no sensitive investor terms in existing public documents
- [ ] Owner Auth user safely bootstrapped to Super Admin
- [ ] Cloud Functions and Firestore Rules deployed and tested
- [ ] Old broad authenticated-user access confirmed removed from the **deployed** rules
- [ ] Staff account created, verified and tested for denied privileges
- [ ] Investor account created, verified and tested against other investor data
- [ ] Real product stock entered, a sale recorded and quantity decremented
- [ ] Exact investor agreement verified and entitlement calculated
- [ ] Agreement version and history confirmed visible to correct investor; no cross-investor reads
- [ ] Paused investor agreement tested: no sales, no inventory deduction, no missing investor entitlement
- [ ] Margin visible to Super Admin; absent from investor documents and UI
- [ ] Payment reference and confirmation tested
- [ ] Sale reversal tested for entry error, confirmed refund, double-reversal protection and paid-investor rejection
- [ ] Frontend PR merged after secure backend rollout; real device QA completed

This project uses Firebase and a GitHub Pages static frontend. **Do not replace it with a separate unconnected backend or store investor payout rates in the public `products` collection.**
