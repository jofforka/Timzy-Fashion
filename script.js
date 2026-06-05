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
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot
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

// SECURITY NOTE: Do not paste your CheckoutPay API key here.
// Use a Google Apps Script or backend proxy URL that safely stores the key.
const PAYMENT_PROXY_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

const DEFAULT_CATEGORIES = [
  "Senator",
  "Agbada",
  "Kaftan",
  "Female Wear",
  "Ready-to-Wear",
  "Adire",
  "Aso Oke",
  "Children",
  "Fabrics",
  "Accessories",
  "Bags",
  "Shoes",
  "Men / Senator"
];

let sales = [];
let inventory = [];
let expenses = [];
let catalog = [];
let customers = [];
let orders = [];
let customerProfiles = [];

let currentRole = "public";
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

function driveToImage(url) {
  if (!url) return "";

  const match = String(url).match(/[-\w]{25,}/);

  if (!match) return String(url).trim();

  return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
}

function driveImages(value) {
  if (!value) return [];

  return String(value)
    .split(",")
    .map(link => driveToImage(link.trim()))
    .filter(Boolean);
}

async function getUserRole(email) {
  try {
    const snap = await getDoc(doc(db, "users", email));

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

/* PUBLIC / PRIVATE VIEW */

function hidePublicView() {
  const publicHeader = document.getElementById("publicHeader");
  const publicCatalog = document.getElementById("publicCatalog");

  if (publicHeader) publicHeader.style.display = "none";
  if (publicCatalog) publicCatalog.style.display = "none";
}

function showPublicView() {
  const publicHeader = document.getElementById("publicHeader");
  const publicCatalog = document.getElementById("publicCatalog");
  const appView = document.getElementById("app");

  if (publicHeader) publicHeader.style.display = "grid";
  if (publicCatalog) publicCatalog.style.display = "block";
  if (appView) appView.style.display = "none";
}

window.openLoginModal = function () {
  closeAccessModal();

  const modal = document.getElementById("loginModal");

  if (modal) modal.style.display = "flex";
};

window.closeLoginModal = function () {
  const modal = document.getElementById("loginModal");

  if (modal) modal.style.display = "none";
};

window.showPublicCatalog = function () {
  const publicCatalog = document.getElementById("publicCatalog");

  if (publicCatalog) {
    publicCatalog.scrollIntoView({ behavior: "smooth" });
  }
};

window.openAccessModal = function () {
  const modal = document.getElementById("accessModal");

  if (modal) modal.style.display = "flex";
};

window.closeAccessModal = function () {
  const modal = document.getElementById("accessModal");

  if (modal) modal.style.display = "none";
};

/* AUTH */

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

  currentRole = "public";
  currentUserEmail = "";

  closeLoginModal();
  closeAccessModal();

  showPublicView();
  render();
};

onAuthStateChanged(auth, async user => {
  const appView = document.getElementById("app");

  if (user) {
    currentUserEmail = user.email.toLowerCase();
    currentRole = await getUserRole(currentUserEmail);

    closeLoginModal();
    closeAccessModal();
    hidePublicView();

    if (appView) appView.style.display = "block";

    setupRoleAccess();

    await loadFirestoreData();

    render();
  } else {
    currentUserEmail = "";
    currentRole = "public";

    showPublicView();
    render();
  }
});

/* ROLE ACCESS */

function setupRoleAccess() {
  hideAllSections();

  if (currentRole === "admin") {
    showRoleSections([
      "dashboard",
      "catalog",
      "catalogManager",
      "customerManager",
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

  if (currentRole === "customer") {
    showRoleSections(["catalog", "customers"]);
    showStaffAdminFields(false);
    showTab("catalog");
  }
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
    if (button) button.style.display = "inline-flex";
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

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

/* DATA LOADING */

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

    const uploadedImages = driveImages(
      n["product image"] ||
      n["product images"] ||
      n["image upload"] ||
      n["upload product image"] ||
      n["product photo"] ||
      n["image"] ||
      ""
    );

    const manualImage1 = n["image url"] || n["image 1"] || n["product image url"] || "";
    const manualImage2 = n["image url 2"] || n["image 2"] || "";
    const manualImage3 = n["image url 3"] || n["image 3"] || "";

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
      image1: uploadedImages[0] || driveToImage(manualImage1),
      image2: uploadedImages[1] || driveToImage(manualImage2),
      image3: uploadedImages[2] || driveToImage(manualImage3),
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
  render();
}

async function loadCatalog() {
  try {
    const snap = await getDocs(collection(db, "catalog"));

    const firestoreCatalog = snap.docs.map(docSnap => ({
      id: docSnap.id,
      source: "catalog",
      ...docSnap.data()
    }));

    const inventoryCatalog = inventory
      .filter(x => x.product && x.product !== "-")
      .map(x => ({
        id: `inventory-${x.sku || x.product}`,
        source: "inventory",
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

    catalog = [...firestoreCatalog, ...inventoryCatalog];
  } catch (error) {
    console.error("Catalog load failed:", error);

    catalog = inventory.map(x => ({
      id: `inventory-${x.sku || x.product}`,
      source: "inventory",
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
  }
}

async function loadFirestoreData() {
  if (currentRole === "public") return;

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

    await loadCustomerProfiles();
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
}

async function loadCustomerProfiles() {
  try {
    const snap = await getDocs(collection(db, "users"));

    customerProfiles = snap.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(user => user.role === "customer");
  } catch (error) {
    console.error("Customer profiles failed:", error);
    customerProfiles = [];
  }
}

/* CATALOG MANAGER */

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
    image1: driveToImage(document.getElementById("catImage1").value.trim()),
    image2: driveToImage(document.getElementById("catImage2").value.trim()),
    image3: driveToImage(document.getElementById("catImage3").value.trim()),
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

  clearInputs([
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
  ]);

  await loadAllData();
};

window.deleteCatalogProduct = async function (productId) {
  if (currentRole !== "admin") {
    alert("Only admin can delete catalog products.");
    return;
  }

  if (String(productId).startsWith("inventory-")) {
    alert("This product came from Inventory. Remove it from Inventory instead.");
    return;
  }

  if (!confirm("Delete this product from catalog?")) return;

  await deleteDoc(doc(db, "catalog", productId));

  alert("Product deleted.");

  await loadAllData();
};

/* CUSTOMER MANAGER */

window.saveCustomerProfile = async function () {
  if (currentRole !== "admin") {
    alert("Only admin can create customer profiles.");
    return;
  }

  const name = document.getElementById("newCustomerName").value.trim();
  const email = document.getElementById("newCustomerEmail").value.trim().toLowerCase();
  const phone = document.getElementById("newCustomerPhone").value.trim();
  const tempPassword = document.getElementById("newCustomerPassword").value.trim();

  if (!name || !email) {
    alert("Customer name and email are required.");
    return;
  }

  await setDoc(doc(db, "users", email), {
    role: "customer",
    name,
    email,
    phone,
    status: "active",
    tempPasswordNote: tempPassword || "",
    createdBy: currentUserEmail,
    createdAt: serverTimestamp()
  });

  alert("Customer profile saved. Now create the same email/password in Firebase Authentication.");

  clearInputs([
    "newCustomerName",
    "newCustomerEmail",
    "newCustomerPhone",
    "newCustomerPassword"
  ]);

  await loadCustomerProfiles();
  render();
};

window.toggleCustomerStatus = async function (email, currentStatus) {
  if (currentRole !== "admin") return;

  const nextStatus = currentStatus === "active" ? "disabled" : "active";

  await updateDoc(doc(db, "users", email), {
    status: nextStatus,
    updatedBy: currentUserEmail,
    updatedAt: serverTimestamp()
  });

  await loadCustomerProfiles();
  render();
};

/* CUSTOMER PORTAL */

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

    clearInputs([
      "cmName",
      "cmPhone",
      "cmShoulder",
      "cmChest",
      "cmWaist",
      "cmHip",
      "cmSleeve",
      "cmLength",
      "cmNotes"
    ]);

    await loadFirestoreData();
    render();
  } catch (error) {
    console.error(error);
    alert("Could not save measurement.");
  }
};

window.submitOrder = async function () {
  try {
    const targetEmail = getTargetCustomerEmail("targetCustomerEmailOrder");

    if (!targetEmail) return;

    const customer = document.getElementById("coName").value.trim();
    const phone = document.getElementById("coPhone").value.trim();
    const product = document.getElementById("coStyle").value.trim();
    const delivery = document.getElementById("coDelivery").value;
    const finalAmount = cleanNumber(document.getElementById("coAmount").value);
    const paymentMethod = document.getElementById("coPaymentMethod").value;

    if (!customer || !phone || !product) {
      alert("Customer name, phone, and product/style are required.");
      return;
    }

    if (!finalAmount || finalAmount <= 0) {
      alert("Final amount is required before submitting an order.");
      return;
    }

    if (!paymentMethod) {
      alert("Please select a payment method.");
      return;
    }

    let status = "Pending Payment";
    let paymentStatus = "Pending";

    if (paymentMethod === "Cash on Delivery") {
      status = "COD - Awaiting Fulfillment";
      paymentStatus = "Cash on Delivery";
    }

    if (paymentMethod === "Bank Transfer") {
      status = "Bank Transfer - Awaiting Confirmation";
      paymentStatus = "Pending Confirmation";
    }

    const orderRef = `ORD-${Date.now()}`;

    await addDoc(collection(db, "customerOrders"), {
      orderRef,
      email: targetEmail,
      uploadedBy: currentUserEmail,
      customer,
      phone,
      product,
      status,
      paymentStatus,
      delivery,
      finalAmount,
      paymentMethod,
      adminNote: "",
      transactionId: "",
      paymentAccountNumber: "",
      paymentBankName: "",
      paymentAccountName: "",
      createdAt: serverTimestamp()
    });

    alert("Order submitted successfully.");

    clearInputs([
      "coName",
      "coPhone",
      "coStyle",
      "coDelivery",
      "coAmount",
      "coPaymentMethod"
    ]);

    await loadFirestoreData();
    render();
  } catch (error) {
    console.error(error);
    alert("Could not submit order.");
  }
};

function clearInputs(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);

    if (el) el.value = "";
  });
}

window.requestCatalogOrder = function (productName, price = "") {
  if (currentRole === "public") {
    openAccessModal();
    return;
  }

  showTab("customers");

  const styleInput = document.getElementById("coStyle");
  const amountInput = document.getElementById("coAmount");

  if (styleInput) styleInput.value = productName;
  if (amountInput) amountInput.value = price || "";

  alert("Product selected. Complete your order request below.");
};

/* PRODUCT DETAILS */

window.openProductDetails = function (encodedProduct) {
  const product = JSON.parse(decodeURIComponent(encodedProduct));

  const modal = document.getElementById("productModal");
  const content = document.getElementById("modalProductContent");

  if (!modal || !content) return;

  const images = [product.image1, product.image2, product.image3].filter(Boolean);
  const whatsappText = encodeURIComponent(`Hello, I want to order ${product.name}`);
  const whatsappLink = `https://wa.me/2348118103510?text=${whatsappText}`;

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

    <a class="whatsapp-btn" href="${whatsappLink}" target="_blank">
      WhatsApp Order
    </a>
  `;

  modal.style.display = "flex";
};

window.closeProductModal = function () {
  const modal = document.getElementById("productModal");

  if (modal) modal.style.display = "none";
};

/* ORDERS + CHAT */

window.payOrder = async function (orderId, amount, customerName, phone, productName) {
  try {
    if (!PAYMENT_PROXY_URL || PAYMENT_PROXY_URL.includes("PASTE_")) {
      alert("Payment service is not connected yet. Add your Google Apps Script payment proxy URL first.");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("Payment cannot start because the order amount is missing.");
      return;
    }

    const orderReference = `TIMZY-${orderId}`;

    const response = await fetch(PAYMENT_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "createPaymentRequest",
        orderId,
        order_reference: orderReference,
        amount: Number(amount),
        payer_name: customerName || "Timzy Customer",
        phone: phone || "",
        product: productName || "Timzy Fashion Order",
        service: productName || "Timzy Fashion Order",
        website_url: window.location.origin
      })
    });

    const data = await response.json();

    if (!data.success) {
      console.error(data);
      alert(data.message || "Payment request failed.");
      return;
    }

    const paymentData = data.data || data;
    const transactionId = paymentData.transaction_id || data.transaction_id || "";
    const charges = paymentData.charges || {};
    const amountToPay = charges.amount_to_pay || paymentData.amount || amount;

    await updateDoc(doc(db, "customerOrders", orderId), {
      transactionId,
      paymentStatus: "Payment Requested",
      status: "Pending Payment",
      paymentAccountNumber: paymentData.account_number || "",
      paymentBankName: paymentData.bank_name || "",
      paymentAccountName: paymentData.account_name || "",
      amountToPay: Number(amountToPay || amount),
      adminNote: "Payment request created. Awaiting customer payment confirmation.",
      updatedAt: serverTimestamp()
    });

    alert(
      `Payment Details:

Bank: ${paymentData.bank_name || "-"}
Account Name: ${paymentData.account_name || "-"}
Account Number: ${paymentData.account_number || "-"}
Amount: ₦${Number(amountToPay || amount).toLocaleString()}

After payment is confirmed, your order will move to fulfillment.`
    );

    await loadFirestoreData();
    render();
  } catch (error) {
    console.error(error);
    alert("Payment request error.");
  }
};

window.checkPaymentStatus = async function (orderId, transactionId) {
  try {
    if (!transactionId) {
      alert("No payment transaction found for this order yet.");
      return;
    }

    if (!PAYMENT_PROXY_URL || PAYMENT_PROXY_URL.includes("PASTE_")) {
      alert("Payment verification service is not connected yet.");
      return;
    }

    const response = await fetch(PAYMENT_PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "verifyPayment",
        orderId,
        transactionId
      })
    });

    const data = await response.json();

    if (!data.success) {
      console.error(data);
      alert(data.message || "Payment could not be verified yet.");
      return;
    }

    const paymentData = data.data || data;
    const status = String(paymentData.status || "").toLowerCase();

    if (status === "approved" || status === "paid" || status === "completed") {
      await updateDoc(doc(db, "customerOrders", orderId), {
        paymentStatus: "Paid",
        status: "Paid - Awaiting Fulfillment",
        paidAt: serverTimestamp(),
        adminNote: "Payment confirmed. Awaiting fulfillment approval."
      });

      alert("Payment confirmed successfully.");
    } else {
      alert(`Payment status: ${paymentData.status || "pending"}`);
    }

    await loadFirestoreData();
    render();
  } catch (error) {
    console.error(error);
    alert("Payment verification error.");
  }
};

window.approveFulfillment = async function (orderId) {
  if (currentRole !== "admin") {
    alert("Only admin can approve fulfillment.");
    return;
  }

  const order = orders.find(item => item.id === orderId);

  if (!order) {
    alert("Order not found.");
    return;
  }

  const paymentStatus = String(order.paymentStatus || "").toLowerCase();
  const paymentMethod = order.paymentMethod || "";

  if (paymentMethod === "Online Payment" && paymentStatus !== "paid") {
    alert("Online payment must be confirmed before fulfillment approval.");
    return;
  }

  const note = prompt("Fulfillment note:", "Order approved for production/delivery.");

  await updateDoc(doc(db, "customerOrders", orderId), {
    status: "Approved for Fulfillment",
    adminNote: note || "Order approved for fulfillment.",
    fulfilledBy: currentUserEmail,
    fulfilledAt: serverTimestamp()
  });

  await loadFirestoreData();
  render();
};

window.markReady = async function (orderId) {
  if (currentRole !== "admin") {
    alert("Only admin can mark order ready.");
    return;
  }

  await updateDoc(doc(db, "customerOrders", orderId), {
    status: "Ready for Pickup/Delivery",
    adminNote: "Order is ready for pickup or delivery.",
    updatedAt: serverTimestamp()
  });

  await loadFirestoreData();
  render();
};

window.markDelivered = async function (orderId) {
  if (currentRole !== "admin") {
    alert("Only admin can mark delivered.");
    return;
  }

  await updateDoc(doc(db, "customerOrders", orderId), {
    status: "Delivered",
    adminNote: "Order delivered successfully.",
    deliveredAt: serverTimestamp()
  });

  await loadFirestoreData();
  render();
};

window.cancelOrder = async function (orderId) {
  if (currentRole !== "admin") {
    alert("Only admin can cancel orders.");
    return;
  }

  const note = prompt("Cancellation reason:");

  if (!note) return alert("Cancellation note is required.");

  await updateDoc(doc(db, "customerOrders", orderId), {
    status: "Cancelled",
    adminNote: note,
    cancelledBy: currentUserEmail,
    cancelledAt: serverTimestamp()
  });

  await loadFirestoreData();
  render();
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
    where("orderId", "==", orderId)
  );

  unsubscribeChat = onSnapshot(q, snapshot => {
    const messages = snapshot.docs
      .map(d => d.data())
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

    const html = messages.map(msg => `
      <div class="chat-message ${msg.senderEmail === currentUserEmail ? "mine" : "theirs"}">
        <strong>${msg.senderRole || "user"}:</strong>
        <span>${msg.message || ""}</span>
      </div>
    `).join("") || "<p>No messages yet.</p>";

    if (chatMessages) chatMessages.innerHTML = html;
    if (customerChatMessages) customerChatMessages.innerHTML = html;
  });
};

window.sendChatMessage = async function () {
  const chatInput = document.getElementById("chatInput");
  const customerChatInput = document.getElementById("customerChatInput");

  const input =
    customerChatInput && customerChatInput.value.trim()
      ? customerChatInput
      : chatInput;

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

/* DASHBOARD */

function dashboardStats() {
  const totalSalesAmount = sales.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpensesAmount = expenses.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const netProfitAmount = totalSalesAmount - totalExpensesAmount;
  const inventoryValueAmount = inventory.reduce((sum, item) => sum + Number((item.quantity || 0) * (item.cost || 0)), 0);
  const lowStockCount = inventory.filter(item => Number(item.quantity || 0) <= 5).length;

  return {
    totalSalesAmount,
    totalExpensesAmount,
    netProfitAmount,
    inventoryValueAmount,
    lowStockCount
  };
}

function orderStatusCounts() {
  return {
    pending: orders.filter(o => String(o.status || "").toLowerCase().includes("pending")).length,
    paid: orders.filter(o => String(o.paymentStatus || "").toLowerCase() === "paid").length,
    fulfillment: orders.filter(o => String(o.status || "").toLowerCase().includes("fulfillment")).length,
    delivered: orders.filter(o => String(o.status || "").toLowerCase().includes("delivered")).length,
    cancelled: orders.filter(o => String(o.status || "").toLowerCase().includes("cancelled")).length
  };
}

function drawBarChart(containerId, labels, values) {
  const container = document.getElementById(containerId);

  if (!container) return;

  container.innerHTML = `<canvas></canvas>`;

  const canvas = container.querySelector("canvas");
  const ctx = canvas.getContext("2d");

  const width = container.clientWidth || 420;
  const height = 280;
  const padding = 42;

  canvas.width = width;
  canvas.height = height;

  const max = Math.max(...values, 1);
  const chartHeight = height - 95;
  const chartWidth = width - padding * 2;
  const barGap = 18;
  const barWidth = Math.max(26, chartWidth / values.length - barGap);

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  values.forEach((value, i) => {
    const x = padding + i * (barWidth + barGap);
    const barHeight = (value / max) * chartHeight;
    const y = padding + chartHeight - barHeight;

    const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
    gradient.addColorStop(0, "#f3c86a");
    gradient.addColorStop(1, "#d9a441");

    ctx.fillStyle = gradient;

    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 8);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    ctx.fillStyle = "#f7f7f7";
    ctx.font = "bold 12px Arial";
    ctx.fillText(labels[i], x, height - 28);

    ctx.fillStyle = "#a8a8ad";
    ctx.font = "11px Arial";
    ctx.fillText(Number(value).toLocaleString(), x, y - 8);
  });
}

function renderDashboardCharts() {
  const stats = dashboardStats();
  const orderCounts = orderStatusCounts();

  drawBarChart("financeChart", ["Sales", "Expenses", "Profit"], [
    stats.totalSalesAmount,
    stats.totalExpensesAmount,
    Math.max(stats.netProfitAmount, 0)
  ]);

  drawBarChart("orderStatusChart", ["Pending", "Paid", "Fulfill", "Delivered"], [
    orderCounts.pending,
    orderCounts.paid,
    orderCounts.fulfillment,
    orderCounts.delivered
  ]);

  drawBarChart("inventoryHealthChart", ["Value", "Low"], [
    stats.inventoryValueAmount,
    stats.lowStockCount
  ]);

  const xp = staffXP().slice(0, 5);

  drawBarChart(
    "staffPerformanceChart",
    xp.length ? xp.map(x => x.name.slice(0, 8)) : ["No XP"],
    xp.length ? xp.map(x => x.points) : [0]
  );
}

function renderDashboardInsights() {
  const stats = dashboardStats();
  const orderCounts = orderStatusCounts();

  const financeInsight = document.getElementById("financeInsight");
  const orderInsight = document.getElementById("orderInsight");
  const inventoryInsight = document.getElementById("inventoryInsight");
  const staffInsight = document.getElementById("staffInsight");

  if (financeInsight) {
    financeInsight.textContent =
      stats.netProfitAmount >= 0
        ? "Business is currently profitable based on captured sales and expenses."
        : "Expenses are higher than captured sales. Review cost leakage.";
  }

  if (orderInsight) {
    orderInsight.textContent =
      `${orderCounts.pending} pending payment/review, ${orderCounts.paid} paid, ${orderCounts.fulfillment} in fulfillment, ${orderCounts.delivered} delivered orders.`;
  }

  if (inventoryInsight) {
    inventoryInsight.textContent =
      stats.lowStockCount > 0
        ? `${stats.lowStockCount} product(s) need restocking attention.`
        : "Inventory health looks stable. No low-stock alert currently.";
  }

  if (staffInsight) {
    const topStaff = staffXP()[0];

    staffInsight.textContent = topStaff
      ? `${topStaff.name} is currently leading with ${topStaff.points} XP.`
      : "No staff XP activity captured yet.";
  }
}

function renderActivityPanels() {
  const recentActivity = document.getElementById("recentActivity");
  const criticalAlerts = document.getElementById("criticalAlerts");

  if (recentActivity) {
    recentActivity.innerHTML = orders.slice(0, 5).map(o => `
      <div class="activity-item">
        <strong>${o.customer || "Customer"}</strong>
        <span>${o.product || "Order"} — ${o.status || "Pending"}</span>
      </div>
    `).join("") || `<p class="note">No recent activity yet.</p>`;
  }

  if (criticalAlerts) {
    const lowStock = inventory.filter(i => Number(i.quantity || 0) <= 5).slice(0, 5);

    criticalAlerts.innerHTML = lowStock.map(i => `
      <div class="activity-item danger">
        <strong>${i.product}</strong>
        <span>Low stock: ${i.quantity}</span>
      </div>
    `).join("") || `<p class="note">No critical alerts.</p>`;
  }
}

/* RENDER HELPERS */

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

function statusClass(status = "") {
  const value = status.toLowerCase();

  if (value.includes("cancelled") || value.includes("rejected")) return "status-rejected";
  if (value.includes("delivered") || value.includes("paid") || value.includes("approved") || value.includes("ready")) return "status-approved";

  return "status-pending";
}

function uniqueCategories() {
  const fromCatalog = catalog
    .map(item => item.category)
    .filter(Boolean)
    .filter(category => category !== "-");

  return [...new Set([...DEFAULT_CATEGORIES, ...fromCatalog])];
}

function renderCategoryOptions(selectId) {
  const select = document.getElementById(selectId);

  if (!select) return;

  const current = select.value;
  const categories = uniqueCategories();

  select.innerHTML = `<option value="">All Categories</option>` +
    categories.map(cat => `<option value="${cat}">${cat}</option>`).join("");

  select.value = current;
}

function setCategory(filterId, value) {
  const select = document.getElementById(filterId);

  if (!select) return;

  select.value = value;
  render();
}

function renderCategoryChips(containerId, filterId) {
  const container = document.getElementById(containerId);

  if (!container) return;

  const active = document.getElementById(filterId)?.value || "";

  const chips = [`<button type="button" class="${!active ? "chip active" : "chip"}" onclick="setCatalogCategory('${filterId}', '')">All</button>`]
    .concat(
      uniqueCategories().map(cat => `
        <button type="button" class="${active === cat ? "chip active" : "chip"}" onclick="setCatalogCategory('${filterId}', '${cat}')">
          ${cat}
        </button>
      `)
    );

  container.innerHTML = chips.join("");
}

window.setCatalogCategory = function (filterId, value) {
  setCategory(filterId, value);
};

function renderCatalog(targetId, searchId, categoryId) {
  const grid = document.getElementById(targetId);

  if (!grid) return;

  const searchValue = document.getElementById(searchId)?.value.toLowerCase() || "";
  const categoryValue = document.getElementById(categoryId)?.value || "";

  const filteredCatalog = catalog.filter(item => {
    const name = String(item.name || "").toLowerCase();
    const category = String(item.category || "");
    const description = String(item.description || "").toLowerCase();
    const color = String(item.color || "").toLowerCase();

    return (
      (name.includes(searchValue) || description.includes(searchValue) || color.includes(searchValue)) &&
      (!categoryValue || category === categoryValue)
    );
  });

  grid.innerHTML = filteredCatalog.length
    ? filteredCatalog.map(item => {
        const product = {
          id: item.id,
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
        const whatsappText = encodeURIComponent(`Hello, I want to order ${item.name}`);
        const whatsappLink = `https://wa.me/2348118103510?text=${whatsappText}`;

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
              <span class="category-badge">${item.category || "Fashion"}</span>
              <h3>${item.name}</h3>
              <p>${item.description || "Available product"}</p>
              <small>Color: ${item.color || "-"}</small>
              <small>Sizes: ${item.sizes || "Ask for sizes"}</small>
              <strong>${money(item.price)}</strong>
              <small>Available: ${item.quantity || "Check stock"}</small>

              <button type="button" onclick='openProductDetails("${encoded}")'>View Details</button>

              <button type="button" onclick='requestCatalogOrder(${JSON.stringify(item.name)}, ${JSON.stringify(item.price || "")})'>
                Request Order
              </button>

              <a class="whatsapp-btn" href="${whatsappLink}" target="_blank">
                WhatsApp Order
              </a>

              ${
                currentRole === "admin" && !String(item.id).startsWith("inventory-")
                  ? `<button class="danger-btn" type="button" onclick="deleteCatalogProduct('${item.id}')">Delete Product</button>`
                  : ""
              }
            </div>
          </div>
        `;
      }).join("")
    : `<p class="note">No products found.</p>`;
}

/* MAIN RENDER */

window.render = function () {
  renderCategoryOptions("catalogCategoryFilter");
  renderCategoryOptions("privateCatalogCategoryFilter");

  renderCategoryChips("publicCategoryChips", "catalogCategoryFilter");
  renderCategoryChips("privateCategoryChips", "privateCatalogCategoryFilter");

  renderCatalog("catalogGrid", "catalogSearch", "catalogCategoryFilter");
  renderCatalog("privateCatalogGrid", "privateCatalogSearch", "privateCatalogCategoryFilter");

  const stats = dashboardStats();

  if (document.getElementById("totalSales")) {
    document.getElementById("totalSales").textContent = money(stats.totalSalesAmount);
  }

  if (document.getElementById("totalExpenses")) {
    document.getElementById("totalExpenses").textContent = money(stats.totalExpensesAmount);
  }

  if (document.getElementById("netProfit")) {
    document.getElementById("netProfit").textContent = money(stats.netProfitAmount);
  }

  if (document.getElementById("inventoryValue")) {
    document.getElementById("inventoryValue").textContent = money(stats.inventoryValueAmount);
  }

  if (document.getElementById("lowStock")) {
    document.getElementById("lowStock").textContent = stats.lowStockCount;
  }

  const customerProfilesTable = document.getElementById("customerProfilesTable");

  if (customerProfilesTable) {
    customerProfilesTable.innerHTML = customerProfiles.length
      ? customerProfiles.map(c => `
        <tr>
          <td>${c.name || "-"}</td>
          <td>${c.email || c.id || "-"}</td>
          <td>${c.phone || "-"}</td>
          <td>${c.status || "active"}</td>
          <td>
            <button type="button" onclick="toggleCustomerStatus('${c.email || c.id}', '${c.status || "active"}')">
              ${(c.status || "active") === "active" ? "Disable" : "Activate"}
            </button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="5">No customer profiles yet.</td></tr>`;
  }

  const salesTable = document.getElementById("salesTable");

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

  const expensesTable = document.getElementById("expensesTable");

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

  const inventoryTable = document.getElementById("inventoryTable");

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
        <td class="${statusClass(x.status)}">${x.status || "-"}</td>
        <td class="${statusClass(x.paymentStatus)}">${x.paymentStatus || "Pending"}</td>
        <td>${x.delivery || "-"}</td>
        <td>${money(x.finalAmount || 0)}</td>
        <td>${x.paymentMethod || "-"}</td>
        <td>${x.adminNote || "-"}</td>
        <td>
          ${
            x.paymentMethod === "Online Payment" &&
            String(x.paymentStatus || "").toLowerCase() !== "paid"
              ? `<button type="button" onclick="payOrder('${x.id}', '${x.finalAmount || 0}', '${x.customer || ""}', '${x.phone || ""}', '${x.product || ""}')">Pay Now</button>`
              : ""
          }

          ${
            x.transactionId && String(x.paymentStatus || "").toLowerCase() !== "paid"
              ? `<button type="button" onclick="checkPaymentStatus('${x.id}', '${x.transactionId}')">Check Payment</button>`
              : ""
          }

          ${
            currentRole === "admin"
              ? `
                <button type="button" onclick="approveFulfillment('${x.id}')">Approve Fulfillment</button>
                <button type="button" onclick="markReady('${x.id}')">Mark Ready</button>
                <button type="button" onclick="markDelivered('${x.id}')">Delivered</button>
                <button type="button" class="danger-btn" onclick="cancelOrder('${x.id}')">Cancel</button>
              `
              : ""
          }

          <button type="button" onclick="openOrderChat('${x.id}')">Chat</button>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="10">No orders found.</td></tr>`;

  if (document.getElementById("ordersTable") {
    document.getElementById("ordersTable").innerHTML = orderRows;
  }

  if (document.getElementById("customerOrdersTable")) {
    document.getElementById("customerOrdersTable").innerHTML = orderRows;
  }

  const customersTable = document.getElementById("customersTable");

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

  const leaderboard = document.getElementById("leaderboard");

  if (leaderboard) {
    leaderboard.innerHTML = staffXP().map((x, i) => `
      <div class="rank-card">
        <span>#${i + 1} <b>${x.name}</b><br>${x.rank}</span>
        <strong>${x.points} XP</strong>
      </div>
    `).join("") || "<p>No staff points yet.</p>";
  }

  const formLinks = document.getElementById("formLinks");

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

    if (currentRole === "customer") allowedForms = [];

    formLinks.innerHTML = allowedForms.map(f => `
      <div class="form-card">
        <h3>${f.name}</h3>
        <p>${f.description}</p>
        <a href="${f.url}" target="_blank">Open Form</a>
      </div>
    `).join("");
  }

  renderDashboardCharts();
  renderDashboardInsights();
  renderActivityPanels();
};

loadAllData();
