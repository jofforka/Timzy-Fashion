TIMZY FASHION OS v5 LEAN EDITION

What changed:
1. Public homepage is clean and mobile-first.
2. Catalog reads products from Google Sheet CSV.
3. Products are uploaded through Google Form, not through a complex admin dashboard.
4. Admin has only four areas: Dashboard, Products, Sales, Expenses.
5. Sales and Expenses save to Firestore collections: sales and expenses.

IMPORTANT SETUP:
Open timzy-config.js and replace:
- productFormUrl
- productSheetUrl
- productSheetCsvUrl

How to get productSheetCsvUrl:
1. Open your Google Sheet connected to the product upload form.
2. File → Share → Publish to web.
3. Choose the product response sheet/tab.
4. Select CSV.
5. Copy the published CSV link.
6. Paste it into productSheetCsvUrl in timzy-config.js.

Suggested Google Form fields:
- Product Name
- Category
- Price
- Description
- Status / Availability
- Image 1 or Product Images
- Image 2
- Image 3
- Image 4
- Image 5

For images:
Google Form file uploads create Drive links. Make sure the uploaded files/folder can be viewed publicly, otherwise images may not display on the catalog.

Firestore rules needed for sales/expenses:
- users must be authenticated to write sales and expenses.
- products are read from Google Sheet, not Firestore.
