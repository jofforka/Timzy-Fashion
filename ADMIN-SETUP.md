# Timzy Fashion Admin v2 Setup

1. In Firebase Authentication, enable Email/Password.
2. Create the staff/admin user in Firebase Authentication.
3. Publish `firestore.rules` and `storage.rules` in Firebase Console.
4. Upload the full project to GitHub Pages.
5. Open `admin/index.html` and sign in.
6. On first login, the current `data/products.json` catalogue is automatically imported into Firestore.
7. Edit a product to upload replacement images and add its Instagram Reel/Post URL.
8. The public storefront reads Firestore first and falls back to `data/products.json` if Firestore is unavailable or empty.

Image uploads are stored in Firebase Storage. Saving a product updates Firestore immediately, so the public Shop and Product pages reflect the changes.
