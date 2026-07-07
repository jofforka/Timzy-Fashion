/* Timzy Fashion Lean OS configuration
   Replace the placeholder links below with your real Google Form and published Google Sheet CSV links.
   To publish a sheet as CSV: Google Sheet → File → Share → Publish to web → CSV.
*/
window.TIMZY_CONFIG = {
  brandName: 'Timzy Fashion',
  currency: '₦',
  whatsappNumber: '2348118103510',

  // Product upload flow
  productFormUrl: 'https://forms.gle/REPLACE_PRODUCT_FORM_LINK',
  productSheetUrl: 'https://docs.google.com/spreadsheets/d/REPLACE_PRODUCT_SHEET_ID/edit',
  productSheetCsvUrl: '',

  // Optional: if sales/expenses are captured with Google Forms too, paste the published CSV links here.
  salesFormUrl: 'https://forms.gle/KiSfFM1aJT6jLfv99',
  expensesFormUrl: 'https://forms.gle/V3y2ktxVpgTtyMKj9',
  salesSheetCsvUrl: '',
  expensesSheetCsvUrl: '',

  // Firebase is used only for staff login + simple sales/expenses records.
  firebaseConfig: {
    apiKey: 'AIzaSyBCizR30KTtGXwlelD4Qxdu9IHJdPm-IlU',
    authDomain: 'timzy-fashion-os.firebaseapp.com',
    projectId: 'timzy-fashion-os',
    storageBucket: 'timzy-fashion-os.firebasestorage.app',
    messagingSenderId: '1015146526947',
    appId: '1:1015146526947:web:6d4bd493d6fa9a3c7b65e8'
  }
};
