// FIREBASE IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBCizR30KTtGXwlelD4Qxdu9IHJdPm-IlU",
  authDomain: "timzy-fashion-os.firebaseapp.com",
  projectId: "timzy-fashion-os",
  storageBucket: "timzy-fashion-os.firebasestorage.app",
  messagingSenderId: "515655826693",
  appId: "1:515655826693:web:4085b86651f39ffa03cb6c"
};


// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


// GLOBALS
window.currentUser = null;


// LOGIN
window.loginUser = async function () {

  const email =
    document.getElementById("loginEmail").value;

  const password =
    document.getElementById("loginPassword").value;

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  } catch (error) {

    alert(error.message);

    console.error(error);

  }

};


// LOGOUT
window.logoutUser = async function () {

  await signOut(auth);

};


// AUTH STATE
onAuthStateChanged(auth, async (user) => {

  if (user) {

    window.currentUser = user;

    document.getElementById("loginPage").style.display = "none";

    document.getElementById("app").style.display = "block";

    setupRoleAccess(user.email);

    loadSales();

    loadExpenses();

    loadInventory();

    loadOrders();

    loadMeasurements();

    loadForms();

  } else {

    document.getElementById("loginPage").style.display = "flex";

    document.getElementById("app").style.display = "none";

  }

});


// ROLE ACCESS
function setupRoleAccess(email) {

  const inventoryBtn =
    document.getElementById("inventoryBtn");

  const expensesBtn =
    document.getElementById("expensesBtn");

  const salesBtn =
    document.getElementById("salesBtn");

  if (email.includes("customer")) {

    inventoryBtn.style.display = "none";

    expensesBtn.style.display = "none";

    salesBtn.style.display = "none";

  }

  if (email.includes("staff")) {

    inventoryBtn.style.display = "none";

  }

}


// TAB SWITCHER
window.showTab = function (tabId) {

  document
    .querySelectorAll(".tab")
    .forEach(tab => {
      tab.classList.remove("active");
    });

  document
    .getElementById(tabId)
    .classList.add("active");

};


// LOAD SALES
async function loadSales() {

  const table =
    document.getElementById("salesTable");

  if (!table) return;

  table.innerHTML = "";

  const snapshot =
    await getDocs(collection(db, "sales"));

  snapshot.forEach(doc => {

    const data = doc.data();

    table.innerHTML += `
      <tr>
        <td>${data.staff || ""}</td>
        <td>${data.category || ""}</td>
        <td>${data.product || ""}</td>
        <td>${data.qty || ""}</td>
        <td>₦${data.amount || 0}</td>
      </tr>
    `;

  });

}


// LOAD EXPENSES
async function loadExpenses() {

  const table =
    document.getElementById("expensesTable");

  if (!table) return;

  table.innerHTML = "";

  const snapshot =
    await getDocs(collection(db, "expenses"));

  snapshot.forEach(doc => {

    const data = doc.data();

    table.innerHTML += `
      <tr>
        <td>${data.staff || ""}</td>
        <td>${data.category || ""}</td>
        <td>${data.item || ""}</td>
        <td>${data.supplier || ""}</td>
        <td>${data.qty || ""}</td>
        <td>₦${data.unitCost || 0}</td>
        <td>₦${data.total || 0}</td>
      </tr>
    `;

  });

}


// LOAD INVENTORY
async function loadInventory() {

  const table =
    document.getElementById("inventoryTable");

  if (!table) return;

  table.innerHTML = "";

  const snapshot =
    await getDocs(collection(db, "inventory"));

  snapshot.forEach(doc => {

    const data = doc.data();

    table.innerHTML += `
      <tr>
        <td>${data.category || ""}</td>
        <td>${data.product || ""}</td>
        <td>${data.sku || ""}</td>
        <td>${data.supplier || ""}</td>
        <td>${data.qty || ""}</td>
        <td>₦${data.costPrice || 0}</td>
        <td>₦${data.sellingPrice || 0}</td>
      </tr>
    `;

  });

}


// LOAD ORDERS
async function loadOrders() {

  const table =
    document.getElementById("ordersTable");

  if (!table) return;

  table.innerHTML = "";

  const snapshot =
    await getDocs(collection(db, "orders"));

  snapshot.forEach(doc => {

    const data = doc.data();

    table.innerHTML += `
      <tr>
        <td>${data.customerName || ""}</td>
        <td>${data.phone || ""}</td>
        <td>${data.style || ""}</td>
        <td>${data.status || "Pending"}</td>
        <td>${data.delivery || ""}</td>
        <td>₦${data.amount || 0}</td>
        <td>₦${data.deposit || 0}</td>
        <td>₦${data.balance || 0}</td>
      </tr>
    `;

  });

}


// LOAD MEASUREMENTS
async function loadMeasurements() {

  const table =
    document.getElementById("customersTable");

  if (!table) return;

  table.innerHTML = "";

  const snapshot =
    await getDocs(collection(db, "measurements"));

  snapshot.forEach(doc => {

    const data = doc.data();

    table.innerHTML += `
      <tr>
        <td>${data.name || ""}</td>
        <td>${data.phone || ""}</td>
        <td>
          Shoulder: ${data.shoulder || ""}<br>
          Chest: ${data.chest || ""}<br>
          Waist: ${data.waist || ""}<br>
          Hip: ${data.hip || ""}
        </td>
        <td>${data.notes || ""}</td>
      </tr>
    `;

  });

}


// LOAD GOOGLE FORMS
function loadForms() {

  const container =
    document.getElementById("formLinks");

  if (!container) return;

  container.innerHTML = "";

  window.TIMZY_FORMS.forEach(form => {

    container.innerHTML += `
      <div class="form-card">
        <h3>${form.name}</h3>
        <p>${form.description}</p>

        <a href="${form.url}" target="_blank">
          Open Form
        </a>
      </div>
    `;

  });

}
