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
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy
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
let catalog = [];
let customers = [];
let orders = [];

let currentRole = "customer";
let currentUserEmail = "";
let activeChatOrderId = "";
let unsubscribeChat = null;

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
    const snap = await getDoc(doc(db, "users", email));
    if (snap.exists() && snap.data().role) return snap.data().role;
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
  if (unsubscribeChat) unsubscribeChat();
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
    currentUserEmail = "";
    currentRole = "customer";
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
      "catalogManager",
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
      "expenses",
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
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("SheetDB error:", error);
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
    const qty = cleanNumber(n["quantity sold"] || n["qty sold"] || n["quantity"] || n["qty"]);
    const unitPrice = cleanNumber(n["unit selling price"] || n["selling price"] || n["total sales"] || n["total sales ₦"] || n["amount"]);

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
    const quantity = cleanNumber(n["quantity added"] || n["qty added"] || n["quantity"] || n["qty"] || n["stock"] || n["stock quantity"]);

    return {
      category: n["category"] || "-",
      product: n["product name"] || n["product"] || n["product/sku"] || "-",
      sku: n["sku"] || n["product/sku"] || "-",
      supplier: n["supplier/vendor"] || n["supplier"] || "-",
      quantity,
      cost: cleanNumber(n["cost price"] || n["unit cost"] || n["cost"]),
      selling: cleanNumber(n["selling price"] || n["price"] || n["unit selling price"]),
      color: n["color"] || n["material color"] || "",
      sizes: n["sizes"] || "",
      image1: n["image url"] || n["image 1"] || n["product image"] || n["image"] || "",
      image2: n["image url 2"] || n["image 2"] || "",
      image3: n["image url 3"] || n["image 3"] || "",
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

  await loadCatalog();
  await loadFirestoreData();
}

async function loadCatalog() {
  const snap = await getDocs(collection(db, "catalog"));

  catalog = snap.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  const inventoryCatalog = inventory
    .filter(x => x.product && x.product !== "-")
    .map(x => ({
      id: `inventory-${x.sku || x.product}`,
      name: x.product,
      category: x.category,
      price: x.selling,
      quantity: x.quantity,
      color: x.color,
      sizes: x.sizes,
      image1: x.image1,
      image2: x.image2,
      image3: x.image3,
      description: x.description
    }));

  catalog = [...catalog, ...inventoryCatalog];
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
  customers = measurementSnapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  const orderSnapshot = await getDocs(orderQuery);
  orders = orderSnapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  render();
}

window.saveCatalogProduct = async function () {
  if (currentRole !== "admin") {
    alert("Only admin can publish catalog products.");
    return;
  }

  const product = {
    name: document.getElementById("catProductName").value.trim(),
    category: document.getElementById("catCategory").value.trim(),
    color: document.getElementById("catColor").value.trim(),
    price: cleanNumber(document.getElementById("catPrice").value),
    quantity: cleanNumber(document.getElementById("catQuantity").value),
    sizes: document.getElementById("catSizes").value.trim(),
    image1: document.getElementById("catImage1").value.trim(),
    image2: document.getElementById("catImage2").value.trim(),
    image3: document.getElementById("catImage3").value.trim(),
    description: document.getElementById("catDescription").value.trim(),
    publishedBy: currentUserEmail,
    createdAt: serverTimestamp()
  };

  if (!product.name) {
    alert("Product name is required.");
    return;
  }

  await addDoc(collection(db, "catalog"), product);

  alert("Product published successfully.");
  clearCatalogForm();
  await loadAllData();
};

function clearCatalogForm() {
  [
    "catProductName",
    "catCategory",
    "catColor",
    "catPrice",
    "catQuantity",
    "catSizes",
    "catImage1",
    "catImage2",
    "catImage3",
    "catDescription"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function getTargetCustomerEmail(inputId) {
  if (currentRole === "customer") return currentUserEmail;

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
      createdAt: serverTimestamp()
    });

    alert("Measurement saved successfully.");
    clearMeasurementForm();
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

    const finalAmount = cleanNumber(document.getElementById("coAmount").value);
    const paymentMethod = document.getElementById("coPaymentMethod").value;

    await addDoc(collection(db, "customerOrders"), {
      email: targetEmail,
      uploadedBy: currentUserEmail,
      customer: document.getElementById("coName").value,
      phone: document.getElementById("coPhone").value,
      product: document.getElementById("coStyle").value,
      status: "Pending Review",
      delivery: document.getElementById("coDelivery").value,
      finalAmount,
      paymentMethod,
      adminNote: "",
      createdAt: serverTimestamp()
    });

    alert("Order request submitted successfully.");
    clearOrderForm();
    await loadFirestoreData();
  } catch (error) {
    console.error(error);
    alert("Could not submit order.");
  }
};

function clearMeasurementForm() {
  [
    "cmName",
    "cmPhone",
    "cmShoulder",
    "cmChest",
    "cmWaist",
    "cmHip",
    "cmSleeve",
    "cmLength",
    "cmNotes"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function clearOrderForm() {
  [
    "coName",
    "coPhone",
    "coStyle",
    "coDelivery",
    "coAmount",
    "coPaymentMethod"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

window.requestCatalogOrder = function (productName, price = "") {
  showTab("customers");

  const styleInput = document.getElementById("coStyle");
  const amountInput = document.getElementById("coAmount");

  if (styleInput) styleInput.value = productName;
  if (amountInput) amountInput.value = price || "";

  alert("Product selected. Complete your order request below.");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

window.openProductDetails = function (encodedProduct) {
  const product = JSON.parse(decodeURIComponent(encodedProduct));
  const modal = document.getElementById("productModal");
  const content = document.getElementById("modalProductContent");

  const images = [product.image1, product.image2, product.image3].filter(Boolean);

  content.innerHTML = `
    <h2>${product.name}</h2>

    <div class="product-gallery">
      ${
        images.length
          ? images.map(img => `<img src="${img}" alt="${product.name}">`).join("")
          : `<div class="catalog-image"><span>👗</span></div>`
      }
    </div>

    <p><strong>Category:</strong> ${product.category || "-"}</p>
    <p><strong>Color:</strong> ${product.color || "-"}</p>
    <p><strong>Sizes:</strong> ${product.sizes || "-"}</p>
    <p><strong>Price:</strong> ${money(product.price)}</p>
    <p><strong>Available:</strong> ${product.quantity || "Check stock"}</p>
    <p>${product.description || "No description available."}</p>

    <button type="button" onclick='requestCatalogOrder(${JSON.stringify(product.name)}, ${JSON.stringify(product.price || "")})'>
      Request Order
    </button>
  `;

  modal.style.display = "flex";
};

window.closeProductModal = function () {
  const modal = document.getElementById("productModal");
  if (modal) modal.style.display = "none";
};

window.approveOrder = async function (orderId) {
  if (currentRole !== "admin") {
    alert("Only admin can approve orders.");
    return;
  }

  const amount = prompt("Enter final amount:");
  const note = prompt("Approval note:", "Order approved.");

  await updateDoc(doc(db, "customerOrders", orderId), {
    status: "Approved",
    finalAmount: cleanNumber(amount),
    adminNote: note || "Order approved.",
    reviewedBy: currentUserEmail,
    reviewedAt: serverTimestamp()
  });

  await loadFirestoreData();
};

window.rejectOrder = async function (orderId) {
  if (currentRole !== "admin") {
    alert("Only admin can reject orders.");
    return;
  }

  const note = prompt("Rejection reason:");

  if (!note) {
    alert("Rejection note is required.");
    return;
  }

  await updateDoc(doc(db, "customerOrders", orderId), {
    status: "Rejected",
    adminNote: note,
    reviewedBy: currentUserEmail,
    reviewedAt: serverTimestamp()
  });

  await loadFirestoreData();
};

window.openOrderChat = function (orderId) {
  activeChatOrderId = orderId;

  const chatBox = document.getElementById("chatBox");
  const customerChatBox = document.getElementById("customerChatBox");
  const chatMessages = document.getElementById("chatMessages");
  const customerChatMessages = document.getElementById("customerChatMessages");

  if (chatBox) chatBox.style.display = "block";
  if (customerChatBox) customerChatBox.style.display = "block";

  if (chatMessages) chatMessages.innerHTML = "Loading chat...";
  if (customerChatMessages) customerChatMessages.innerHTML = "Loading chat...";

  if (unsubscribeChat) unsubscribeChat();

  const q = query(
    collection(db, "orderChats"),
    where("orderId", "==", orderId),
    orderBy("createdAt", "asc")
  );

  unsubscribeChat = onSnapshot(q, snapshot => {
    const html = snapshot.docs.map(d => {
      const msg = d.data();

      return `
        <div class="chat-message">
          <strong>${msg.senderRole || "user"}:</strong>
          <span>${msg.message || ""}</span>
        </div>
      `;
    }).join("") || "<p>No messages yet.</p>";

    if (chatMessages) chatMessages.innerHTML = html;
    if (customerChatMessages) customerChatMessages.innerHTML = html;
  });
};

window.sendChatMessage = async function () {
  const input =
    document.getElementById("chatInput") ||
    document.getElementById("customerChatInput");

  if (!activeChatOrderId) {
    alert("Open an order chat first.");
    return;
  }

  if (!input || !input.value.trim()) return;

  await addDoc(collection(db, "orderChats"), {
    orderId: activeChatOrderId,
    senderEmail: currentUserEmail,
    senderRole: currentRole,
    message: input.value.trim(),
    createdAt: serverTimestamp()
  });

  input.value = "";
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
    catalogGrid.innerHTML = catalog.length
      ? catalog.map(item => {
          const product = {
            name: item.name,
            category: item.category,
            price: item.price,
            quantity: item.quantity,
            color: item.color,
            sizes: item.sizes,
            image1: item.image1,
            image2: item.image2,
            image3: item.image3,
            description: item.description
          };

          const encoded = encodeURIComponent(JSON.stringify(product));

          return `
            <div class="catalog-card">
              <div class="catalog-image">
                ${
                  item.image1
                    ? `<img src="${item.image1}" alt="${item.name}">`
                    : `<span>👗</span>`
                }
              </div>

              <div class="catalog-body">
                <h3>${item.name}</h3>
                <p>${item.category || "-"}</p>
                <small>Color: ${item.color || "-"}</small>
                <small>${item.description || "Available product"}</small>
                <strong>${money(item.price)}</strong>
                <small>Available: ${item.quantity || "Check stock"}</small>

                <button type="button" onclick='openProductDetails("${encoded}")'>
                  View Details
                </button>

                <button type="button" onclick='requestCatalogOrder(${JSON.stringify(item.name)}, ${JSON.stringify(item.price || "")})'>
                  Request Order
                </button>
              </div>
            </div>
          `;
        }).join("")
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
        <td>${money(x.finalAmount || 0)}</td>
        <td>${x.paymentMethod || "-"}</td>
        <td>${x.adminNote || "-"}</td>
        <td>
          ${
            currentRole === "admin"
              ? `
                <button type="button" onclick="approveOrder('${x.id}')">Approve</button>
                <button type="button" onclick="rejectOrder('${x.id}')">Reject</button>
              `
              : ""
          }

          <button type="button" onclick="openOrderChat('${x.id}')">Chat</button>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="9">No orders found.</td></tr>`;

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
        f.name.includes("Expense") ||
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
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy
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
let activeChatOrderId = "";
let unsubscribeChat = null;

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
    return Array.isArray(data) ? data : [];
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
    const qty = cleanNumber(n["quantity sold"] || n["qty sold"] || n["quantity"] || n["qty"]);
    const unitPrice = cleanNumber(n["unit selling price"] || n["selling price"] || n["total sales"] || n["total sales ₦"] || n["amount"]);

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
    const quantity = cleanNumber(n["quantity added"] || n["qty added"] || n["quantity"] || n["qty"] || n["stock"] || n["stock quantity"]);

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
  customers = measurementSnapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  const orderSnapshot = await getDocs(orderQuery);
  orders = orderSnapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  render();
}

function getTargetCustomerEmail(inputId) {
  if (currentRole === "customer") return currentUserEmail;

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
      createdAt: serverTimestamp()
    });

    alert("Measurement saved successfully.");
    clearMeasurementForm();
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

    const finalAmount = cleanNumber(document.getElementById("coAmount").value);
    const paymentMethod = document.getElementById("coPaymentMethod").value;

    await addDoc(collection(db, "customerOrders"), {
      email: targetEmail,
      uploadedBy: currentUserEmail,
      customer: document.getElementById("coName").value,
      phone: document.getElementById("coPhone").value,
      product: document.getElementById("coStyle").value,
      status: "Pending Review",
      delivery: document.getElementById("coDelivery").value,
      finalAmount,
      paymentMethod,
      adminNote: "",
      createdAt: serverTimestamp()
    });

    alert("Order request submitted successfully.");
    clearOrderForm();
    await loadFirestoreData();
  } catch (error) {
    console.error(error);
    alert("Could not submit order.");
  }
};

function clearMeasurementForm() {
  ["cmName", "cmPhone", "cmShoulder", "cmChest", "cmWaist", "cmHip", "cmSleeve", "cmLength", "cmNotes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

function clearOrderForm() {
  ["coName", "coPhone", "coStyle", "coDelivery", "coAmount", "coPaymentMethod"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

window.requestCatalogOrder = function (product) {
  showTab("customers");

  const styleInput = document.getElementById("coStyle");
  const amountInput = document.getElementById("coAmount");
  const paymentInput = document.getElementById("coPaymentMethod");

  if (styleInput) styleInput.value = product;
  if (amountInput) amountInput.value = "";
  if (paymentInput) paymentInput.value = "";

  alert("Product selected. Complete your order request below.");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

window.approveOrder = async function (orderId) {
  const note = prompt("Approval note:", "Order approved.");

  await updateDoc(doc(db, "customerOrders", orderId), {
    status: "Approved",
    adminNote: note || "Order approved.",
    reviewedBy: currentUserEmail,
    reviewedAt: serverTimestamp()
  });

  await loadFirestoreData();
};

window.rejectOrder = async function (orderId) {
  const note = prompt("Rejection reason:");

  if (!note) {
    alert("Rejection note is required.");
    return;
  }

  await updateDoc(doc(db, "customerOrders", orderId), {
    status: "Rejected",
    adminNote: note,
    reviewedBy: currentUserEmail,
    reviewedAt: serverTimestamp()
  });

  await loadFirestoreData();
};

window.openOrderChat = function (orderId) {
  activeChatOrderId = orderId;

  const chatBox = document.getElementById("chatBox");
  const chatMessages = document.getElementById("chatMessages");

  if (chatBox) chatBox.style.display = "block";
  if (chatMessages) chatMessages.innerHTML = "Loading chat...";

  if (unsubscribeChat) unsubscribeChat();

  const q = query(
    collection(db, "orderChats"),
    where("orderId", "==", orderId),
    orderBy("createdAt", "asc")
  );

  unsubscribeChat = onSnapshot(q, snapshot => {
    if (!chatMessages) return;

    chatMessages.innerHTML = snapshot.docs.map(d => {
      const msg = d.data();

      return `
        <div class="chat-message">
          <strong>${msg.senderRole || "user"}:</strong>
          <span>${msg.message || ""}</span>
        </div>
      `;
    }).join("") || "<p>No messages yet.</p>";
  });
};

window.sendChatMessage = async function () {
  const input = document.getElementById("chatInput");

  if (!activeChatOrderId) {
    alert("Open an order chat first.");
    return;
  }

  if (!input || !input.value.trim()) return;

  await addDoc(collection(db, "orderChats"), {
    orderId: activeChatOrderId,
    senderEmail: currentUserEmail,
    senderRole: currentRole,
    message: input.value.trim(),
    createdAt: serverTimestamp()
  });

  input.value = "";
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
    const products = inventory.filter(item => item.product && item.product !== "-");

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
        <td>${money(x.finalAmount || 0)}</td>
        <td>${x.paymentMethod || "-"}</td>
        <td>${x.adminNote || "-"}</td>
        <td>
          ${
            currentRole === "admin"
              ? `
                <button type="button" onclick="approveOrder('${x.id}')">Approve</button>
                <button type="button" onclick="rejectOrder('${x.id}')">Reject</button>
              `
              : ""
          }

          <button type="button" onclick="openOrderChat('${x.id}')">
            Chat
          </button>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="9">No orders found.</td></tr>`;

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
