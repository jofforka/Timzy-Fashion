TIMZY FASHION OS v5 - LEAN BUILD
=================================

This build keeps the system simple:

PUBLIC SIDE
- index.html: premium mobile-first homepage
- catalog.html: Google Sheet-powered catalog
- product.html: dedicated product detail page with gallery

STAFF SIDE
- login.html: Firebase staff login
- admin/index.html: dashboard
- admin/products.html: products view + Google Form/Sheet buttons
- admin/sales.html: record sales into Firestore
- admin/expenses.html: record expenses into Firestore

CONFIGURATION
Edit timzy-config.js:
1. productFormUrl: paste your Google Form link
2. productSheetUrl: paste your Google Sheet edit link
3. productSheetCsvUrl: paste your published CSV link
4. whatsappNumber: set your WhatsApp number without + sign
5. firebaseConfig: already populated from your project

GOOGLE SHEET HEADERS SUPPORTED
Product Name, Name, Product, Item
Category, Product Category, Collection
Price, Amount, Selling Price
Description, Product Description, Notes
Images, Image, Photo, Photos, Product Images, Upload product images
Image 1, Image 2, Image 3 ... Image 10
Status, Availability
Sizes, Available Sizes
Colours, Colors, Available Colours, Available Colors
Fabric, Material

IMAGE NOTES
If Google Form uploads images to Drive, make sure the files/folder are viewable by anyone with the link. The code converts Google Drive file links into thumbnail links automatically.

FIREBASE NOTES
Sales and expenses are stored in Firestore collections:
- sales
- expenses

Deploy this folder to GitHub Pages as usual.
