# Timzy Fashion OS v8.5

A premium fashion storefront and lightweight business operating system.

## Architecture

- GitHub Pages — public website and admin frontend
- Firebase Authentication — secure staff login
- Cloud Firestore — products, settings, sales, expenses and orders
- Google Drive — product image storage
- Google Apps Script — secure media upload bridge
- Instagram embeds — product motion/video previews

## Included

- Premium Home, Shop, Product, Checkout, Training and Contact pages
- Floating cart and compact notifications
- Product accessory accordions
- Measurement options
- Instagram product video modal
- Product CMS
- Image replacement and gallery uploads
- Sales and expense records
- Store settings
- Firestore fallback to `data/products.json`

## Setup order

1. Upload the complete bundle to GitHub Pages.
2. Configure Firebase Authentication and Firestore.
3. Publish `firestore.rules`.
4. Configure the Google Apps Script using `google-apps-script/SETUP.md`.
5. Sign into `admin/index.html`.
6. Save the Apps Script URL and upload token under Admin Settings.
