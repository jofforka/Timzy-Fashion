import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

const SALES_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Sales%20Responses";
const INVENTORY_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Inventory%20Restock";
const ORDERS_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Orders";
const CUSTOMERS_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Customer%20Measurements";

let sales = [];
let inventory = [];
let orders = [];
let customers = [];
let currentRole = "customer";

const money = n => "₦" + Number(n || 0).toLocaleString();

function cleanNumber(value) {
  return Number(String(value || "0").replace(/[₦,\s]/g, "")) || 0;
}

function normalize(row) {
  const obj = {};
  Object.keys(row).forEach(key => {
    obj[key.trim().toLowerCase()] = row[key];
  });
  return obj;
}

window.loginUser = async function () {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(error.message);
  }
};

window.logoutUser = async function () {
  await signOut(auth);
};

onAuthStateChanged(auth, user => {
  const loginPage = document.getElementById("loginPage");
  const appView = document.getElementById("app");

  if (!loginPage || !appView) return;

  if (user) {
    loginPage.style.display = "none";
    appView.style.display = "block";

    setupRoleAccess(user.email.toLowerCase());
    loadAllData();
  } else {
    loginPage.style.display = "flex";
    appView.style.display = "none";
  }
});

function setupRoleAccess(email) {
  hideAllSections();

  if (email === "admin@timzyfashion.com") {
    currentRole = "admin";
    showRoleSections(["dashboard", "sales", "inventory", "orders", "customers", "staff", "forms"]);
    showTab("dashboard");
    return;
  }

  if (email.includes("staff")) {
    currentRole = "staff";
    showRoleSections(["sales", "orders", "customers", "forms"]);
    showTab("sales");
    return;
  }

  currentRole = "customer";
  showRoleSections(["forms"]);
  showTab("forms");
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

window.showTab = function (id) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.remove("active");
  });

  const selectedTab = document.getElementById(id);

  if (selectedTab) {
    selectedTab.classList.add("active");
  }
};

async function fetchSheet(api) {
  const response = await fetch(api);
  return await response.json();
}

async function loadAllData() {
  try {
    const [salesData, inventoryData, ordersData, customersData] = await Promise.all([
      fetchSheet(SALES_API),
      fetchSheet(INVENTORY_API),
      fetchSheet(ORDERS_API),
      fetchSheet(CUSTOMERS_API)
    ]);

    sales = salesData.map(row => {
      const n = normalize(row);
      const qty = cleanNumber(n["quantity sold"] || n["qty sold"] || n["quantity"]);
      const unitPrice = cleanNumber(n["unit selling price"] || n["selling price"] || n["total sales"] || n["total sales ₦"]);

      return {
        staff: n["staff name"] || "-",
        category: n["category"] || "-",
        product: n["product/vsku"] || n["product/sku"] || "-",
        qty,
        amount: qty * unitPrice
      };
    });

    inventory = inventoryData.map(row => {
      const n = normalize(row);

      return {
        staff: n["staff name"] || "-",
        category: n["category"] || "-",
        product: n["product name"] || "-",
        sku: n["sku"] || "-",
        supplier: n["supplier/vendor"] || "-",
        quantity: cleanNumber(n["quantity added"]),
        cost: cleanNumber(n["cost price"]),
        selling: cleanNumber(n["selling price"])
      };
    });

    orders = ordersData.map(row => {
      const n = normalize(row);

      return {
        orderId: n["order id"] || "-",
        customer: n["customer name"] || "-",
        phone: n["phone number"] || "-",
        category: n["category"] || "-",
        product: n["product/style"] || "-",
        staff: n["assigned staff/tailor"] || "-",
        status: n["order status"] || "-",
        delivery: n["delivery date"] || "-",
        amount: cleanNumber(n["total amount"]),
        deposit: cleanNumber(n["deposit"]),
        balance: cleanNumber(n["balance"])
      };
    });

    customers = customersData.map(row => {
      const n = normalize(row);

      return {
        name: n["customer name"] || "-",
        phone: n["phone number"] || "-",
        shoulder: n["shoulder"] || "-",
        chest: n["chest/bust"] || "-",
        waist: n["waist"] || "-",
        hip: n["hip"] || "-",
        sleeve: n["sleeve"] || "-",
        length: n["length"] || "-",
        notes: n["style notes"] || "-"
      };
    });

    render();
  } catch (error) {
    console.error("Data loading error:", error);
    alert("Could not load one or more Google Form sheets.");
  }
}

function staffXP() {
  let xp = {};

  sales.forEach(x => {
    if (x.staff && x.staff !== "-") {
      xp[x.staff] = (xp[x.staff] || 0) + 10;
    }
  });

  orders.forEach(x => {
    if (x.staff && x.status.toLowerCase() === "completed") {
      xp[x.staff] = (xp[x.staff] || 0) + 15;
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
  const salesTable = document.getElementById("salesTable");
  const inventoryTable = document.getElementById("inventoryTable");
  const ordersTable = document.getElementById("ordersTable");
  const customersTable = document.getElementById("customersTable");
  const leaderboard = document.getElementById("leaderboard");
  const formLinks = document.getElementById("formLinks");

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

  if (ordersTable) {
    ordersTable.innerHTML = orders.map(x => `
      <tr>
        <td>${x.orderId}</td>
        <td>${x.customer}</td>
        <td>${x.phone}</td>
        <td>${x.product}</td>
        <td>${x.staff}</td>
        <td>${x.status}</td>
        <td>${x.delivery}</td>
        <td>${money(x.amount)}</td>
      </tr>
    `).join("");
  }

  if (customersTable) {
    customersTable.innerHTML = customers.map(x => `
      <tr>
        <td>${x.name}</td>
        <td>${x.phone}</td>
        <td>
          Shoulder: ${x.shoulder}<br>
          Chest/Bust: ${x.chest}<br>
          Waist: ${x.waist}<br>
          Hip: ${x.hip}<br>
          Sleeve: ${x.sleeve}<br>
          Length: ${x.length}
        </td>
        <td>${x.notes}</td>
      </tr>
    `).join("");
  }

  const totalSalesAmount = sales.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const inventoryValueAmount = inventory.reduce((sum, item) => sum + Number(item.quantity * item.cost || 0), 0);
  const lowStockCount = inventory.filter(item => item.quantity <= 5).length;

  const totalSales = document.getElementById("totalSales");
  const netProfit = document.getElementById("netProfit");
  const inventoryValue = document.getElementById("inventoryValue");
  const lowStock = document.getElementById("lowStock");

  if (totalSales) totalSales.textContent = money(totalSalesAmount);
  if (netProfit) netProfit.textContent = money(totalSalesAmount);
  if (inventoryValue) inventoryValue.textContent = money(inventoryValueAmount);
  if (lowStock) lowStock.textContent = lowStockCount;

  if (leaderboard) {
    leaderboard.innerHTML = staffXP().map((x, i) => `
      <div class="rank-card">
        <span>
          #${i + 1}
          <b>${x.name}</b>
          <br>
          ${x.rank}
        </span>
        <strong>${x.points} XP</strong>
      </div>
    `).join("") || "<p>No staff points yet.</p>";
  }

  if (formLinks) {
    let allowedForms = window.TIMZY_FORMS || [];

    if (currentRole === "customer") {
      allowedForms = allowedForms.filter(f =>
        f.name.includes("Customer Measurement") ||
        f.name.includes("Order")
      );
    }

    if (currentRole === "staff") {
      allowedForms = allowedForms.filter(f =>
        f.name.includes("Sales") ||
        f.name.includes("Customer Measurement") ||
        f.name.includes("Order")
      );
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
