# Contact settings and investor login recovery

## Contact details
The public Contact page previously contained hard-coded WhatsApp links, telephone, email and address. The new public page reads `publicContact/store`, a strictly limited public document. Admin **Settings** writes private `settings/store` and then publishes only five public contact fields: `whatsappNumber`, `contactPhone`, `contactEmail`, `pickupAddress`, `businessHours`. No bank account, upload URL or upload token is copied to the public document.

**Release order:** publish and test the reviewed `firestore.rules` first, then deploy the HTML/JS/admin changes. Sign in as owner, open Admin → Settings, fill in the real public contact fields and save. Refresh Contact and verify phone/WhatsApp links, email, address, business hours and enquiry WhatsApp routing. If the public document is missing, the page uses site defaults. Do not put sensitive data in public contact fields. Note that updating the private settings document alone will not update the public site until the new code/rules are deployed and the owner saves settings again.

## Investor NS account
The login `ns@teamzfashion.com` is a Firebase Authentication **email identifier**, not proof that a working mailbox exists. Do not try email reset on an unmonitored address. The account must be recovered through an authorized Firebase project administrator.

1. Firebase Console → Authentication → Users. Find the existing NS account and copy/confirm its **UID**. In Firestore check the `access/{uid}` investor role and `investorCatalog/{uid}/items` assignments. Do not create a new user until these are accounted for.
2. **Preferred:** change the email on the **existing Firebase Auth user** to an email the investor actually controls, using an authorized Admin SDK workflow or the Console if the edit is available. Keep the same UID. Verify the email and then use normal password-reset email delivery.
3. **Alternative:** an authorized backend administrator can use the Firebase Admin SDK `updateUser(uid, { password: temporaryStrongPassword })` to set a temporary password without sending an email. Share it through a secure out-of-band channel and have the investor change it immediately. Never place passwords in source code, Firestore, issue comments, PRs or logs.
4. If a new Auth user is unavoidable, investor access and product assignments are keyed to the UID; migrate those carefully and revoke the old account. A new email by itself does not transfer access.
5. Re-test login and investor-only views; ensure the investor cannot access admin settings, other investors' records, or customer-visible investor data.

No investor credentials have been changed by this PR.
