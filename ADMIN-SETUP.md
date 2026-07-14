# Timzy Fashion OS v8.5 Admin Setup

## Firebase

1. Enable Email/Password Authentication.
2. Create the admin user.
3. Publish `firestore.rules`.
4. Firebase Storage is not required.

## Google Drive media

Follow:

`google-apps-script/SETUP.md`

The Google Apps Script uploads images into Google Drive and returns a public image URL. Product records and image URLs are saved in Firestore.

## Admin URL

Open:

`admin/index.html`

On first login, the existing JSON catalogue is imported into Firestore.
