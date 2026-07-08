# Timzy Fashion OS v5 — State-of-the-Art Lean Build

This is a fresh, working mobile-first build with a premium dark/gold customer storefront and a simple staff operations area.

## Pages

- `index.html` — premium homepage
- `catalog.html` — product catalog
- `product.html?id=...` — product details/gallery
- `login.html` — staff login
- `admin/index.html` — dashboard
- `admin/products.html` — product list + Google Form/Sheet links
- `admin/sales.html` — sales entry
- `admin/expenses.html` — expense entry
- `admin/reports.html` — report + CSV export

## Important setup

Edit `assets/js/config.js`:

```js
window.TIMZY_CONFIG = {
  whatsapp: '2340000000000',
  productFormUrl: 'YOUR_GOOGLE_FORM_LINK',
  productSheetUrl: 'YOUR_GOOGLE_SHEET_LINK',
  sheetCsvUrl: 'YOUR_PUBLISHED_SHEET_CSV_URL',
  brandName: 'Timzy Fashion'
};
```

If `sheetCsvUrl` is empty, the website uses `data/products.json`.

## Google Sheet CSV format

The catalog can read column names such as:

- Product Name / name
- Category / category
- Price / price
- Description / description
- Image1 / image1
- Image2 / image2
- Image3 / image3
- Status / status
- Featured / featured

## Staff login

Current build uses demo login mode. Any email/password opens the admin area. Replace with Firebase Authentication when ready.

## CSS path note

All CSS paths are verified for GitHub Pages:

- public pages use `assets/css/timzy.css`
- admin pages use `css/admin.css`
- admin pages load images with `../assets/img/...`

