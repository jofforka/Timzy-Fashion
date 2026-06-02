import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCizR30KTtGXwlelD4Qxdu9IHJdPm-IlU",
  authDomain: "timzy-fashion-os.firebaseapp.com",
  projectId: "timzy-fashion-os",
  storageBucket: "timzy-fashion-os.firebasestorage.app",
  messagingSenderId: "515655826693",
  appId: "1:515655826693:web:4085b86651f39ffa03cb6c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SALES_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Sales%20Responses";
const INVENTORY_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Inventory%20Restock";
const EXPENSES_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Expense%20Responses";

let sales = [];
let inventory = [];
let expenses = [];
let orders = [];
let customers = [];

let currentRole = "customer";
let currentUserEmail = "";

const money = n => "₦" + Number(n || 0).toLocaleString();

function cleanNumber(value) {
  return Number(String(value || "0").replace(/[₦,\s]/g, "")) || 0;
}

function normalize(row) {
  const obj = {};
  Object.keys(row || {}).forEach(key => {
    obj[key.trim().toLowerCase()] = row[key];
  });
  return obj;
}

async function getUserRole(email) {
  try {
    const userRef = doc(db, "users", email);
    const snap = await getDoc(userRef);

    if (snap.exists() && snap.data().role) {
      return snap.data().role;
    }
  } catch (error) {
    console.warn("Role lookup failed:", error);
  }

  if (email === "admin@timzyfashion.com") return "admin";
  if (email.includes("staff")) return "staff";
  return "customer";
}

window.loginUser = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(error.message);
    console.error(error);
  }
};

window.logoutUser = async function () {
  await signOut(auth);
};

onAuthStateChanged(auth, async user => {
  const loginPage = document.getElementById("loginPage");
  const appView = document.getElementById("app");

  if (!loginPage || !appView) return;

  if (user) {
    currentUserEmail = user.email.toLowerCase();
    currentRole = await getUserRole(currentUserEmail);

    loginPage.style.display = "none";
    appView.style.display = "block";

    setupRoleAccess();
    await loadAllData();
  } else {
    loginPage.style.display = "flex";
    appView.style.display = "none";
  }
});

function setupRoleAccess() {
  hideAllSections();

  if (currentRole === "admin") {
    showRoleSections([
      "dashboard",
      "catalog",
      "sales",
      "expenses",
      "inventory",
      "orders",
      "customers",
      "staff",
      "forms"
    ]);
    showStaffAdminFields(true);
    showTab("dashboard");
    return;
  }

  if (currentRole === "staff") {
    showRoleSections([
      "catalog",
      "sales",
      "orders",
      "customers",
      "forms"
    ]);
    showStaffAdminFields(true);
    showTab("catalog");
    return;
  }

  showRoleSections([
    "catalog",
    "customers"
  ]);
  showStaffAdminFields(false);
  showTab("catalog");
}

function hideAllSections() {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.style.display = "none";
    tab.classList.remove("active");
  });

  document.querySelectorAll("nav button").forEach(btn => {
    btn.style.display = "none";
  });
}

function showRoleSections(sectionIds) {
  sectionIds.forEach(id => {
    const section = document.getElementById(id);
    const button = document.querySelector(`button[onclick="showTab('${id}')"]`);

    if (section) section.style.display = "";
    if (button) button.style.display = "inline-block";
  });
}

function showStaffAdminFields(show) {
  document.querySelectorAll(".staff-admin-only").forEach(field => {
    field.style.display = show ? "block" : "none";
  });
}

window.showTab = function (id) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.remove("active");
  });

  const selected = document.getElementById(id);
  if (selected) selected.classList.add("active");
};

async function fetchSheet(api) {
  try {
    const response = await fetch(api);

    if (!response.ok) {
      console.warn("SheetDB fetch failed:", api, response.status);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn("SheetDB did not return an array:", data);
      return [];
    }

    return data;
  } catch (error) {
    console.error("SheetDB error:", api, error);
    return [];
  }
}

async function loadAllData() {
  const [salesData, inventoryData, expensesData] = await Promise.all([
    fetchSheet(SALES_API),
    fetchSheet(INVENTORY_API),
    fetchSheet(EXPENSES_API)
  ]);

  sales = salesData.map(row => {
    const n = normalize(row);

    const qty = cleanNumber(
      n["quantity sold"] ||
      n["qty sold"] ||
      n["quantity"] ||
      n["qty"]
    );

    const unitPrice = cleanNumber(
      n["unit selling price"] ||
      n["selling price"] ||
      n["total sales"] ||
      n["total sales ₦"] ||
      n["amount"]
    );

    return {
      staff: n["staff name"] || "-",
      category: n["category"] || "-",
      product: n["product/vsku"] || n["product/sku"] || n["product name"] || n["product"] || "-",
      qty,
      amount: qty * unitPrice || unitPrice
    };
  });

  inventory = inventoryData.map(row => {
    const n = normalize(row);

    const quantity = cleanNumber(
      n["quantity added"] ||
      n["qty added"] ||
      n["quantity"] ||
      n["qty"] ||
      n["stock"] ||
      n["stock quantity"]
    );

    return {
      category: n["category"] || "-",
      product: n["product name"] || n["product"] || n["product/sku"] || "-",
      sku: n["sku"] || n["product/sku"] || "-",
      supplier: n["supplier/vendor"] || n["supplier"] || "-",
      quantity,
      cost: cleanNumber(n["cost price"] || n["unit cost"] || n["cost"]),
      selling: cleanNumber(n["selling price"] || n["price"] || n["unit selling price"]),
      image: n["image url"] || n["product image"] || n["image"] || "",
      description: n["description"] || n["product description"] || ""
    };
  });

  expenses = expensesData.map(row => {
    const n = normalize(row);

    const qty = cleanNumber(n["quantity"] || n["qty"] || 1);
    const unitCost = cleanNumber(n["unit cost"] || n["amount"] || n["cost"]);

    return {
      staff: n["staff name"] || "-",
      category: n["category"] || "-",
      item: n["expense item"] || n["item"] || "-",
      supplier: n["supplier/vendor"] || n["supplier"] || "-",
      qty,
      unitCost,
      total: qty * unitCost
    };
  });

  console.log("Inventory loaded:", inventory);

  await loadFirestoreData();
}

async function loadFirestoreData() {
  let measurementQuery;
  let orderQuery;

  if (currentRole === "customer") {
    measurementQuery = query(
      collection(db, "customerMeasurements"),
      where("email", "==", currentUserEmail)
    );

    orderQuery = query(
      collection(db, "customerOrders"),
      where("email", "==", currentUserEmail)
    );
  } else {
    measurementQuery = collection(db, "customerMeasurements");
    orderQuery = collection(db, "customerOrders");
  }

  const measurementSnapshot = await getDocs(measurementQuery);
  customers = measurementSnapshot.docs.map(doc => doc.data());

  const orderSnapshot = await getDocs(orderQuery);
  orders = orderSnapshot.docs.map(doc => doc.data());

  render();
}

function getTargetCustomerEmail(inputId) {
  if (currentRole === "customer") {
    return currentUserEmail;
  }

  const field = document.getElementById(inputId);
  const email = field ? field.value.trim().toLowerCase() : "";

  if (!email) {
    alert("Enter customer email.");
    return "";
  }

  return email;
}

window.submitMeasurement = async function () {
  try {
    const targetEmail = getTargetCustomerEmail("targetCustomerEmail");
    if (!targetEmail) return;

    await addDoc(collection(db, "customerMeasurements"), {
      email: targetEmail,
      uploadedBy: currentUserEmail,
      name: document.getElementById("cmName").value,
      phone: document.getElementById("cmPhone").value,
      shoulder: document.getElementById("cmShoulder").value,
      chest: document.getElementById("cmChest").value,
      waist: document.getElementById("cmWaist").value,
      hip: document.getElementById("cmHip").value,
      sleeve: document.getElementById("cmSleeve").value,
      length: document.getElementById("cmLength").value,
      notes: document.getElementById("cmNotes").value,
      createdAt: new Date()
    });

    alert("Measurement saved successfully.");
    await loadFirestoreData();
  } catch (error) {
    console.error(error);
    alert("Could not save measurement.");
  }
};

window.submitOrder = async function () {
  try {
    const targetEmail = getTargetCustomerEmail("targetCustomerEmailOrder");
    if (!targetEmail) return;

    const amount = cleanNumber(document.getElementById("coAmount").value);
    const deposit = cleanNumber(document.getElementById("coDeposit").value);

    await addDoc(collection(db, "customerOrders"), {
      email: targetEmail,
      uploadedBy: currentUserEmail,
      customer: document.getElementById("coName").value,
      phone: document.getElementById("coPhone").value,
      product: document.getElementById("coStyle").value,
      status: "Pending Review",
      delivery: document.getElementById("coDelivery").value,
      amount,
      deposit,
      balance: amount - deposit,
      createdAt: new Date()
    });

    alert("Order request submitted successfully.");
    await loadFirestoreData();
  } catch (error) {
    console.error(error);
    alert("Could not submit order.");
  }
};

window.requestCatalogOrder = function (product) {
  showTab("customers");

  const styleInput = document.getElementById("coStyle");
  const amountInput = document.getElementById("coAmount");
  const depositInput = document.getElementById("coDeposit");

  if (styleInput) styleInput.value = product;
  if (amountInput) amountInput.value = "";
  if (depositInput) depositInput.value = "";

  alert("Product selected. Complete your order request below.");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

function staffXP() {
  let xp = {};

  sales.forEach(x => {
    if (x.staff && x.staff !== "-") {
      xp[x.staff] = (xp[x.staff] || 0) + 10;
    }
  });

  orders.forEach(x => {
    if (x.uploadedBy && x.status === "Completed") {
      xp[x.uploadedBy] = (xp[x.uploadedBy] || 0) + 15;
    }
  });

  return Object.entries(xp)
    .map(([name, points]) => ({
      name,
      points,
      rank:
        points >= 700 ? "Fashion Master" :
        points >= 300 ? "Gold Stylist" :
        points >= 100 ? "Silver Stylist" :
        "Bronze Stylist"
    }))
    .sort((a, b) => b.points - a.points);
}

function render() {
  const catalogGrid = document.getElementById("catalogGrid");
  const salesTable = document.getElementById("salesTable");
  const expensesTable = document.getElementById("expensesTable");
  const inventoryTable = document.getElementById("inventoryTable");
  const ordersTable = document.getElementById("ordersTable");
  const customerOrdersTable = document.getElementById("customerOrdersTable");
  const customersTable = document.getElementById("customersTable");
  const leaderboard = document.getElementById("leaderboard");
  const formLinks = document.getElementById("formLinks");

  if (catalogGrid) {
    const products = inventory.filter(item =>
      item.product &&
      item.product !== "-"
    );

    catalogGrid.innerHTML = products.length
      ? products.map(item => `
        <div class="catalog-card">
          <div class="catalog-image">
            ${
              item.image
                ? `<img src="${item.image}" alt="${item.product}">`
                : `<span>👗</span>`
            }
          </div>

          <div class="catalog-body">
            <h3>${item.product}</h3>
            <p>${item.category}</p>
            <small>${item.description || "Available product"}</small>
            <strong>${money(item.selling)}</strong>
            <small>Available: ${item.quantity || "Check stock"}</small>

            <button type="button" onclick='requestCatalogOrder(${JSON.stringify(item.product)})'>
              Request Order
            </button>
          </div>
        </div>
      `).join("")
      : `<p class="note">No products available yet.</p>`;
  }

  if (salesTable) {
    salesTable.innerHTML = sales.map(x => `
      <tr>
        <td>${x.staff}</td>
        <td>${x.category}</td>
        <td>${x.product}</td>
        <td>${x.qty}</td>
        <td>${money(x.amount)}</td>
      </tr>
    `).join("");
  }

  if (expensesTable) {
    expensesTable.innerHTML = expenses.map(x => `
      <tr>
        <td>${x.staff}</td>
        <td>${x.category}</td>
        <td>${x.item}</td>
        <td>${x.supplier}</td>
        <td>${x.qty}</td>
        <td>${money(x.unitCost)}</td>
        <td>${money(x.total)}</td>
      </tr>
    `).join("");
  }

  if (inventoryTable) {
    inventoryTable.innerHTML = inventory.map(x => `
      <tr>
        <td>${x.category}</td>
        <td>${x.product}</td>
        <td>${x.sku}</td>
        <td>${x.supplier}</td>
        <td>${x.quantity}</td>
        <td>${money(x.cost)}</td>
        <td>${money(x.selling)}</td>
      </tr>
    `).join("");
  }

  const orderRows = orders.length
    ? orders.map(x => `
      <tr>
        <td>${x.customer || "-"}</td>
        <td>${x.phone || "-"}</td>
        <td>${x.product || "-"}</td>
        <td>${x.status || "-"}</td>
        <td>${x.delivery || "-"}</td>
        <td>${money(x.amount)}</td>
        <td>${money(x.deposit)}</td>
        <td>${money(x.balance)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="8">No orders found.</td></tr>`;

  if (ordersTable) ordersTable.innerHTML = orderRows;
  if (customerOrdersTable) customerOrdersTable.innerHTML = orderRows;

  if (customersTable) {
    customersTable.innerHTML = customers.length
      ? customers.map(x => `
        <tr>
          <td>${x.name || "-"}</td>
          <td>${x.phone || "-"}</td>
          <td>
            Shoulder: ${x.shoulder || "-"}<br>
            Chest: ${x.chest || "-"}<br>
            Waist: ${x.waist || "-"}<br>
            Hip: ${x.hip || "-"}<br>
            Sleeve: ${x.sleeve || "-"}<br>
            Length: ${x.length || "-"}
          </td>
          <td>${x.notes || "-"}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="4">No measurements found.</td></tr>`;
  }

  const totalSalesAmount = sales.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpensesAmount = expenses.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const netProfitAmount = totalSalesAmount - totalExpensesAmount;
  const inventoryValueAmount = inventory.reduce((sum, item) => sum + Number((item.quantity || 0) * (item.cost || 0)), 0);
  const lowStockCount = inventory.filter(item => Number(item.quantity || 0) <= 5).length;

  if (document.getElementById("totalSales")) document.getElementById("totalSales").textContent = money(totalSalesAmount);
  if (document.getElementById("totalExpenses")) document.getElementById("totalExpenses").textContent = money(totalExpensesAmount);
  if (document.getElementById("netProfit")) document.getElementById("netProfit").textContent = money(netProfitAmount);
  if (document.getElementById("inventoryValue")) document.getElementById("inventoryValue").textContent = money(inventoryValueAmount);
  if (document.getElementById("lowStock")) document.getElementById("lowStock").textContent = lowStockCount;

  if (leaderboard) {
    leaderboard.innerHTML = staffXP().map((x, i) => `
      <div class="rank-card">
        <span>#${i + 1} <b>${x.name}</b><br>${x.rank}</span>
        <strong>${x.points} XP</strong>
      </div>
    `).join("") || "<p>No staff points yet.</p>";
  }

  if (formLinks) {
    let allowedForms = window.TIMZY_FORMS || [];

    if (currentRole === "staff") {
      allowedForms = allowedForms.filter(f =>
        f.name.includes("Sales") ||
        f.name.includes("Customer Measurement") ||
        f.name.includes("Order")
      );
    }

    if (currentRole === "customer") {
      allowedForms = [];
    }

    formLinks.innerHTML = allowedForms.map(f => `
      <div class="form-card">
        <h3>${f.name}</h3>
        <p>${f.description}</p>
        <a href="${f.url}" target="_blank">Open Form</a>
      </div>
    `).join("");
  }
}
