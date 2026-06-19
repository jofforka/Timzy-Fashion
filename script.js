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
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================
   FIREBASE CONFIG
========================= */

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

/* =========================
   APIs
========================= */

const SALES_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Sales%20Responses";
const INVENTORY_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Inventory%20Restock";
const EXPENSES_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Expense%20Responses";

const PAYMENT_PROXY_URL =
  "https://script.google.com/macros/s/AKfycbwMpjON9SbRrtTTFWfR-yBZVPNwrZCnakWI797BBvvoXvlwPTEAwuCoBHnGW1krKhHn/exec";

/* =========================
   STATE
========================= */

let sales = [];
let inventory = [];
let expenses = [];
let catalog = [];
let customers = [];
let orders = [];
let publicOrders = [];

let currentRole = "public";
let currentUserEmail = "";

const $ = id => document.getElementById(id);
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

function safeValue(id) {
  return $(id)?.value?.trim() || "";
}

function driveToImage(url) {
  if (!url) return "";

  const str = String(url).trim();

  const idMatch =
    str.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    str.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1200`;
  }

  return str;
}

function driveImages(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map(link => driveToImage(link.trim()))
    .filter(Boolean);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(inputId) {
  const input = $(inputId);
  const file = input && input.files && input.files[0] ? input.files[0] : null;

  if (!file) return "";

  if ($("uploadStatus")) $("uploadStatus").textContent = `Uploading ${file.name}...`;

  const base64 = await fileToBase64(file);

  const response = await fetch(PAYMENT_PROXY_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "uploadImage",
      fileName: `timzy-${Date.now()}-${file.name}`,
      mimeType: file.type || "image/jpeg",
      base64
    })
  });

  const data = await response.json();

  if (!data.success) {
    console.error(data);
    throw new Error(data.message || "Image upload failed.");
  }

  return data.image_url;
}

/* =========================
   AUTH
========================= */

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

window.openLoginModal = function () {
  const modal = $("loginModal");
  if (modal) modal.style.display = "flex";
};

window.closeLoginModal = function () {
  const modal = $("loginModal");
  if (modal) modal.style.display = "none";
};

window.loginUser = async function () {
  const email = safeValue("loginEmail");
  const password = $("loginPassword")?.value || "";

  if (!email || !password) {
    alert("Enter email and password.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
};

window.logoutUser = async function () {
  await signOut(auth);
  currentRole = "public";
  currentUserEmail = "";

  if ($("app")) $("app").style.display = "none";
  if ($("publicHeader")) $("publicHeader").style.display = "flex";
  closeLoginModal();
};

onAuthStateChanged(auth, async user => {
  if (user) {
    currentUserEmail = user.email.toLowerCase();
    currentRole = await getUserRole(currentUserEmail);

    closeLoginModal();

    if ($("publicHeader")) $("publicHeader").style.display = "none";
    if ($("publicCatalog")) $("publicCatalog").style.display = "none";
    if ($("app")) $("app").style.display = "block";

    setupRoleAccess();

    await loadAllData();
    await loadFirestoreData();

    render();
    return;
  }

  currentRole = "public";
  currentUserEmail = "";

  if ($("publicHeader")) $("publicHeader").style.display = "flex";
  if ($("app")) $("app").style.display = "none";
});

/* =========================
   MENU / ROLE ACCESS
========================= */

window.handleAppMenu = function (value) {
  if (!value) return;

  if (value === "openCatalog") {
    window.open("catalog.html", "_blank");
    $("appMenuSelect").value = "";
    return;
  }

  if (value === "logout") {
    logoutUser();
    $("appMenuSelect").value = "";
    return;
  }

  showTab(value);

  const menu = $("appMenuSelect");
  if (menu) menu.value = "";
};

window.selectAppMenu = function (id) {
  showTab(id);
};

window.showTab = function (id) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));

  const selected = $(id);

  if (selected) selected.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });
};

function setupRoleAccess() {
  const adminSections = [
    "dashboard",
    "catalogManager",
    "customerManager",
    "sales",
    "expenses",
    "inventory",
    "orders",
    "publicOrders",
    "customers",
    "staff",
    "forms"
  ];

  const staffSections = [
    "sales",
    "expenses",
    "inventory",
    "orders",
    "publicOrders",
    "customers",
    "forms"
  ];

  const customerSections = ["customers"];

  document.querySelectorAll(".tab").forEach(section => {
    section.style.display = "none";
  });

  const allowed =
    currentRole === "admin"
      ? adminSections
      : currentRole === "staff"
        ? staffSections
        : customerSections;

  allowed.forEach(id => {
    const section = $(id);
    if (section) section.style.display = "";
  });

  document.querySelectorAll(".staff-admin-only").forEach(field => {
    field.style.display = currentRole === "customer" ? "none" : "block";
  });

  showTab(allowed[0] || "dashboard");
}

/* =========================
   DATA LOADERS
========================= */

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
    const unit = cleanNumber(n["unit selling price"] || n["selling price"] || n["total sales"] || n["amount"]);

    return {
      staff: n["staff name"] || "-",
      category: n["category"] || "-",
      product: n["product/vsku"] || n["product/sku"] || n["product name"] || n["product"] || "-",
      qty,
      amount: qty * unit || unit
    };
  });

  inventory = inventoryData.map(row => {
    const n = normalize(row);

    const uploaded = driveImages(
      n["product image"] ||
      n["product images"] ||
      n["image upload"] ||
      n["upload product image"] ||
      n["product photo"] ||
      n["product picture"] ||
      n["upload product picture"] ||
      n["image"] ||
      ""
    );

    return {
      category: n["category"] || "-",
      product: n["product name"] || n["product"] || n["product/sku"] || "-",
      sku: n["sku"] || n["product/sku"] || "-",
      supplier: n["supplier/vendor"] || n["supplier"] || "-",
      quantity: cleanNumber(n["quantity added"] || n["qty added"] || n["quantity"] || n["qty"] || n["stock"] || n["stock quantity"]),
      cost: cleanNumber(n["cost price"] || n["unit cost"] || n["cost"]),
      selling: cleanNumber(n["selling price"] || n["price"] || n["unit selling price"]),
      color: n["color"] || n["material color"] || "",
      sizes: n["sizes"] || "",
      image1: uploaded[0] || driveToImage(n["image url"] || n["image 1"] || n["product image url"] || ""),
      image2: uploaded[1] || driveToImage(n["image url 2"] || n["image 2"] || ""),
      image3: uploaded[2] || driveToImage(n["image url 3"] || n["image 3"] || ""),
      description: n["description"] || n["product description"] || ""
    };
  });

  expenses = expensesData.map(row => {
    const n = normalize(row);
    const qty = cleanNumber(n["quantity"] || n["qty"] || 1);
    const unit = cleanNumber(n["unit cost"] || n["amount"] || n["cost"]);

    return {
      staff: n["staff name"] || "-",
      category: n["category"] || "-",
      item: n["expense item"] || n["item"] || "-",
      supplier: n["supplier/vendor"] || n["supplier"] || "-",
      qty,
      unitCost: unit,
      total: qty * unit
    };
  });

  await loadCatalog();
}

async function loadCatalog() {
  try {
    const snap = await getDocs(collection(db, "catalog"));

    const firestoreCatalog = snap.docs.map(d => ({
      id: d.id,
      source: "catalog",
      ...d.data()
    }));

    const inventoryCatalog = inventory
      .filter(x => x.product && x.product !== "-")
      .map(x => ({
        id: `inventory-${x.sku || x.product}`,
        source: "inventory",
        name: x.product,
        category: x.category,
        productType: "Ready-Made",
        status: "Published",
        price: x.selling,
        salePrice: 0,
        quantity: x.quantity,
        color: x.color,
        sizes: x.sizes,
        image1: x.image1,
        image2: x.image2,
        image3: x.image3,
        image4: "",
        image5: "",
        image6: "",
        videoUrl: "",
        tags: "",
        description: x.description
      }));

    const map = new Map();

    [...inventoryCatalog, ...firestoreCatalog].forEach(item => {
      const key = `${String(item.name || "").toLowerCase()}-${String(item.category || "").toLowerCase()}`;
      map.set(key, item);
    });

    catalog = [...map.values()];
  } catch (error) {
    console.error("Catalog load failed:", error);
    catalog = [];
  }
}

async function loadFirestoreData() {
  if (currentRole === "public") return;

  const measurementQuery =
    currentRole === "customer"
      ? query(collection(db, "customerMeasurements"), where("email", "==", currentUserEmail))
      : collection(db, "customerMeasurements");

  const orderQuery =
    currentRole === "customer"
      ? query(collection(db, "customerOrders"), where("email", "==", currentUserEmail))
      : collection(db, "customerOrders");

  const ms = await getDocs(measurementQuery);
  customers = ms.docs.map(d => ({ id: d.id, ...d.data() }));

  const os = await getDocs(orderQuery);
  orders = os.docs.map(d => ({ id: d.id, ...d.data() }));

  if (currentRole === "admin" || currentRole === "staff") {
    const ps = await getDocs(collection(db, "publicCatalogOrders"));
    publicOrders = ps.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

/* =========================
   CATALOG MANAGER
========================= */

window.saveCatalogProduct = async function () {
  if (currentRole !== "admin") {
    alert("Only admin can publish products.");
    return;
  }

  try {
    if ($("uploadStatus")) $("uploadStatus").textContent = "Checking images...";

    const imageFields = [
      ["catFile1", "catImage1"],
      ["catFile2", "catImage2"],
      ["catFile3", "catImage3"],
      ["catFile4", "catImage4"],
      ["catFile5", "catImage5"],
      ["catFile6", "catImage6"]
    ];

    for (const [fileId, urlId] of imageFields) {
      const uploaded = await uploadImageFile(fileId);

      if (uploaded && $(urlId)) {
        $(urlId).value = uploaded;
      }
    }

    const editingId = safeValue("editingProductId");

    const product = {
      name: safeValue("catProductName"),
      category: safeValue("catCategory"),
      productType: safeValue("catProductType") || "Ready-Made",
      status: safeValue("catStatus") || "Published",
      color: safeValue("catColor"),
      price: cleanNumber(safeValue("catPrice")),
      salePrice: cleanNumber(safeValue("catSalePrice")),
      quantity: cleanNumber(safeValue("catQuantity")),
      sizes: safeValue("catSizes"),
      badge: safeValue("catBadge"),
      featured: !!$("catFeatured")?.checked,
      image1: driveToImage(safeValue("catImage1")),
      image2: driveToImage(safeValue("catImage2")),
      image3: driveToImage(safeValue("catImage3")),
      image4: driveToImage(safeValue("catImage4")),
      image5: driveToImage(safeValue("catImage5")),
      image6: driveToImage(safeValue("catImage6")),
      videoUrl: safeValue("catVideoUrl"),
      tags: safeValue("catTags"),
      description: safeValue("catDescription"),
      updatedAt: serverTimestamp(),
      updatedBy: currentUserEmail
    };

    if (!product.name) {
      alert("Product name is required.");
      return;
    }

    if (editingId) {
      await updateDoc(doc(db, "catalog", editingId), product);
      alert("Product updated.");
    } else {
      await addDoc(collection(db, "catalog"), {
        ...product,
        createdAt: serverTimestamp(),
        publishedBy: currentUserEmail
      });

      alert("Product published.");
    }

    if ($("uploadStatus")) $("uploadStatus").textContent = "Saved successfully.";

    resetCatalogForm();
    await loadAllData();
    await loadFirestoreData();
    render();
  } catch (error) {
    console.error(error);
    alert(error.message || "Could not save product.");

    if ($("uploadStatus")) $("uploadStatus").textContent = "Upload/save failed.";
  }
};

window.editCatalogProduct = function (id) {
  const item = catalog.find(p => p.id === id);

  if (!item || item.source === "inventory") {
    alert("Inventory products must be edited from inventory/source.");
    return;
  }

  $("editingProductId").value = item.id;
  $("catProductName").value = item.name || "";
  $("catCategory").value = item.category || "";
  $("catProductType").value = item.productType || "Ready-Made";

  if ($("catStatus")) $("catStatus").value = item.status || "Published";

  $("catColor").value = item.color || "";
  $("catPrice").value = item.price || "";

  if ($("catSalePrice")) $("catSalePrice").value = item.salePrice || "";

  $("catQuantity").value = item.quantity || "";
  $("catSizes").value = item.sizes || "";
  $("catBadge").value = item.badge || "";
  $("catImage1").value = item.image1 || "";
  $("catImage2").value = item.image2 || "";
  $("catImage3").value = item.image3 || "";

  if ($("catImage4")) $("catImage4").value = item.image4 || "";
  if ($("catImage5")) $("catImage5").value = item.image5 || "";
  if ($("catImage6")) $("catImage6").value = item.image6 || "";
  if ($("catVideoUrl")) $("catVideoUrl").value = item.videoUrl || "";
  if ($("catTags")) $("catTags").value = item.tags || "";

  $("catDescription").value = item.description || "";
  $("catFeatured").checked = !!item.featured;

  showTab("catalogManager");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.resetCatalogForm = function () {
  const ids = [
    "editingProductId",
    "catProductName",
    "catCategory",
    "catColor",
    "catPrice",
    "catSalePrice",
    "catQuantity",
    "catSizes",
    "catBadge",
    "catImage1",
    "catImage2",
    "catImage3",
    "catImage4",
    "catImage5",
    "catImage6",
    "catVideoUrl",
    "catTags",
    "catDescription",
    "catFile1",
    "catFile2",
    "catFile3",
    "catFile4",
    "catFile5",
    "catFile6"
  ];

  ids.forEach(id => {
    const el = $(id);

    if (el) el.value = "";
  });

  if ($("catProductType")) $("catProductType").value = "Ready-Made";
  if ($("catStatus")) $("catStatus").value = "Published";
  if ($("catFeatured")) $("catFeatured").checked = false;
};

window.deleteCatalogProduct = async function (id) {
  if (currentRole !== "admin") {
    alert("Only admin can delete.");
    return;
  }

  if (String(id).startsWith("inventory-")) {
    alert("This product came from Inventory. Remove it from Inventory.");
    return;
  }

  if (!confirm("Delete product?")) return;

  await deleteDoc(doc(db, "catalog", id));

  await loadAllData();
  render();
};

/* =========================
   PORTAL ACTIONS
========================= */

window.submitMeasurement = async function () {
  const targetEmail =
    currentRole === "customer"
      ? currentUserEmail
      : safeValue("targetCustomerEmail");

  const data = {
    email: targetEmail,
    name: safeValue("cmName"),
    phone: safeValue("cmPhone"),
    shoulder: safeValue("cmShoulder"),
    chest: safeValue("cmChest"),
    waist: safeValue("cmWaist"),
    hip: safeValue("cmHip"),
    sleeve: safeValue("cmSleeve"),
    length: safeValue("cmLength"),
    notes: safeValue("cmNotes"),
    createdAt: serverTimestamp(),
    createdBy: currentUserEmail
  };

  if (!data.name || !data.phone) {
    alert("Name and phone are required.");
    return;
  }

  await addDoc(collection(db, "customerMeasurements"), data);

  alert("Measurement saved.");
  await loadFirestoreData();
  render();
};

window.submitOrder = async function () {
  const targetEmail =
    currentRole === "customer"
      ? currentUserEmail
      : safeValue("targetCustomerEmailOrder");

  const amount = cleanNumber(safeValue("coAmount"));

  const data = {
    email: targetEmail,
    customer: safeValue("coName"),
    phone: safeValue("coPhone"),
    product: safeValue("coStyle"),
    delivery: safeValue("coDelivery"),
    finalAmount: amount,
    paymentMethod: safeValue("coPaymentMethod"),
    status: "Pending Payment",
    paymentStatus: "Pending",
    adminNote: "",
    createdAt: serverTimestamp(),
    uploadedBy: currentUserEmail
  };

  if (!data.customer || !data.phone || !data.product) {
    alert("Customer, phone, and product/style are required.");
    return;
  }

  await addDoc(collection(db, "customerOrders"), data);

  alert("Order submitted.");
  await loadFirestoreData();
  render();
};

window.sendChatMessage = function () {
  alert("Portal chat placeholder. Public catalog uses WhatsApp chat.");
};

/* =========================
   RENDERERS
========================= */

function dashboardStats() {
  const totalSalesAmount = sales.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpensesAmount = expenses.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const inventoryValueAmount = inventory.reduce((sum, item) => sum + Number((item.quantity || 0) * (item.cost || 0)), 0);

  return {
    totalSalesAmount,
    totalExpensesAmount,
    netProfitAmount: totalSalesAmount - totalExpensesAmount,
    inventoryValueAmount,
    lowStockCount: inventory.filter(item => Number(item.quantity || 0) <= 5).length
  };
}

function drawBarChart(id, labels, values) {
  const container = $(id);
  if (!container) return;

  container.innerHTML = "<canvas></canvas>";

  const canvas = container.querySelector("canvas");
  const ctx = canvas.getContext("2d");

  const width = container.clientWidth || 380;
  const height = 240;
  const padding = 36;

  canvas.width = width;
  canvas.height = height;

  const max = Math.max(...values, 1);
  const barWidth = Math.max(30, (width - padding * 2) / values.length - 20);

  values.forEach((value, index) => {
    const barHeight = (value / max) * (height - 90);
    const x = padding + index * (barWidth + 20);
    const y = height - 50 - barHeight;

    const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
    gradient.addColorStop(0, "#D4AF37");
    gradient.addColorStop(1, "#7c5cff");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#fff";
    ctx.font = "12px Arial";
    ctx.fillText(labels[index], x, height - 24);

    ctx.fillStyle = "#aaa";
    ctx.fillText(Number(value).toLocaleString(), x, y - 8);
  });
}

function renderDashboardCharts() {
  const stats = dashboardStats();

  drawBarChart(
    "financeChart",
    ["Sales", "Expenses", "Profit"],
    [stats.totalSalesAmount, stats.totalExpensesAmount, Math.max(stats.netProfitAmount, 0)]
  );

  drawBarChart(
    "orderStatusChart",
    ["Portal", "Public", "Customers"],
    [orders.length, publicOrders.length, customers.length]
  );

  drawBarChart(
    "inventoryHealthChart",
    ["Value", "Low"],
    [stats.inventoryValueAmount, stats.lowStockCount]
  );

  const xp = staffXP().slice(0, 5);

  drawBarChart(
    "staffPerformanceChart",
    xp.length ? xp.map(x => x.name.slice(0, 8)) : ["No XP"],
    xp.length ? xp.map(x => x.points) : [0]
  );
}

function staffXP() {
  const xp = {};

  sales.forEach(item => {
    if (item.staff && item.staff !== "-") xp[item.staff] = (xp[item.staff] || 0) + 10;
  });

  orders.forEach(order => {
    if (order.uploadedBy && order.status === "Delivered") xp[order.uploadedBy] = (xp[order.uploadedBy] || 0) + 15;
  });

  return Object.entries(xp)
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points);
}

function statusClass(status = "") {
  const value = status.toLowerCase();

  if (value.includes("paid") || value.includes("delivered") || value.includes("ready") || value.includes("production")) {
    return "status-approved";
  }

  if (value.includes("rejected") || value.includes("cancelled")) {
    return "status-rejected";
  }

  return "status-pending";
}

window.render = function () {
  const stats = dashboardStats();

  if ($("totalSales")) $("totalSales").textContent = money(stats.totalSalesAmount);
  if ($("totalExpenses")) $("totalExpenses").textContent = money(stats.totalExpensesAmount);
  if ($("netProfit")) $("netProfit").textContent = money(stats.netProfitAmount);
  if ($("inventoryValue")) $("inventoryValue").textContent = money(stats.inventoryValueAmount);
  if ($("lowStock")) $("lowStock").textContent = stats.lowStockCount;

  renderDashboardCharts();
  renderCatalogManagerGrid();
  renderPublicOrders();
  renderTables();
  renderForms();

  if ($("financeInsight")) $("financeInsight").textContent = stats.netProfitAmount >= 0 ? "Business is profitable based on captured data." : "Expenses exceed sales.";
  if ($("orderInsight")) $("orderInsight").textContent = `${publicOrders.length} public catalog order(s), ${orders.length} portal order(s).`;
  if ($("inventoryInsight")) $("inventoryInsight").textContent = stats.lowStockCount ? `${stats.lowStockCount} low-stock item(s).` : "Inventory is stable.";
  if ($("staffInsight")) $("staffInsight").textContent = staffXP()[0] ? `${staffXP()[0].name} leads with ${staffXP()[0].points} XP.` : "No XP activity yet.";
  if ($("recentActivity")) $("recentActivity").innerHTML = publicOrders.slice(0, 5).map(o => `<div class="list-item"><b>${o.customerName || "Customer"}</b><span>${o.productName || "Order"} — ${o.orderStatus || "Pending"}</span></div>`).join("") || "<p>No activity yet.</p>";
  if ($("criticalAlerts")) $("criticalAlerts").innerHTML = inventory.filter(i => Number(i.quantity || 0) <= 5).slice(0, 5).map(i => `<div class="list-item danger"><b>${i.product}</b><span>Low stock: ${i.quantity}</span></div>`).join("") || "<p>No alerts.</p>";
};

function renderCatalogManagerGrid() {
  const grid = $("catalogManagerGrid");
  if (!grid) return;

  grid.innerHTML = catalog.length ? catalog.map(item => {
    const img = item.image1 ? driveToImage(item.image1) : "";

    return `
      <div class="manager-card">
        <div class="manager-img">
          ${img ? `<img src="${img}" alt="${item.name}">` : `<span>👗</span>`}
        </div>

        <div class="manager-body">
          <b>${item.name || "-"}</b>
          <small>${item.category || "-"} • ${item.productType || "Ready-Made"} • ${item.status || "Published"}</small>
          <strong>${money(item.salePrice || item.price || 0)}</strong>

          <div class="table-actions">
            ${
              item.source === "inventory"
                ? `<button disabled>Inventory Item</button>`
                : `<button onclick="editCatalogProduct('${item.id}')">Edit</button><button class="danger-btn" onclick="deleteCatalogProduct('${item.id}')">Delete</button>`
            }
          </div>
        </div>
      </div>
    `;
  }).join("") : `<p class="note">No catalog products yet.</p>`;
}

function renderPublicOrders() {
  const table = $("publicOrdersTable");
  if (!table) return;

  table.innerHTML = publicOrders.length ? publicOrders.map(order => {
    const m = order.measurements || {};

    return `
      <tr>
        <td>${order.orderReference || "-"}</td>
        <td>${order.customerName || "-"}</td>
        <td>${order.phone || "-"}</td>
        <td>${order.productName || "-"}</td>
        <td>${order.productType || "-"}</td>
        <td>${order.quantity || "-"}</td>
        <td>${money(order.totalAmount || 0)}</td>
        <td>Size: ${order.selectedSize || "-"}<br>Fabric: ${order.fabricLength || "-"}<br>Color: ${order.preferredColor || "-"}</td>
        <td>Shoulder: ${m.shoulder || "-"}<br>Chest: ${m.chest || "-"}<br>Waist: ${m.waist || "-"}<br>Hip: ${m.hip || "-"}<br>Sleeve: ${m.sleeve || "-"}<br>Length: ${m.length || "-"}</td>
        <td>${order.paymentStatus || "-"}</td>
        <td>${order.orderStatus || "-"}</td>
        <td>${order.paymentBankName || "-"}<br>${order.paymentAccountNumber || "-"}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="12">No public catalog orders yet.</td></tr>`;
}

function renderTables() {
  if ($("salesTable")) {
    $("salesTable").innerHTML = sales.map(x => `
      <tr>
        <td>${x.staff}</td>
        <td>${x.category}</td>
        <td>${x.product}</td>
        <td>${x.qty}</td>
        <td>${money(x.amount)}</td>
      </tr>
    `).join("");
  }

  if ($("expensesTable")) {
    $("expensesTable").innerHTML = expenses.map(x => `
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

  if ($("inventoryTable")) {
    $("inventoryTable").innerHTML = inventory.map(x => `
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

  const orderRows = orders.length ? orders.map(order => `
    <tr>
      <td>${order.customer || "-"}</td>
      <td>${order.phone || "-"}</td>
      <td>${order.product || "-"}</td>
      <td class="${statusClass(order.status)}">${order.status || "-"}</td>
      <td>${order.paymentStatus || "Pending"}</td>
      <td>${order.delivery || "-"}</td>
      <td>${money(order.finalAmount || 0)}</td>
      <td>${order.paymentMethod || "-"}</td>
      <td>${order.paymentProof || "-"}</td>
      <td>${order.adminNote || "-"}</td>
      <td class="table-actions"><button onclick="sendChatMessage()">Chat</button></td>
    </tr>
  `).join("") : `<tr><td colspan="11">No orders found.</td></tr>`;

  if ($("ordersTable")) $("ordersTable").innerHTML = orderRows;
  if ($("customerOrdersTable")) $("customerOrdersTable").innerHTML = orderRows;

  if ($("customersTable")) {
    $("customersTable").innerHTML = customers.length ? customers.map(customer => `
      <tr>
        <td>${customer.name || "-"}</td>
        <td>${customer.phone || "-"}</td>
        <td>Shoulder: ${customer.shoulder || "-"}<br>Chest: ${customer.chest || "-"}<br>Waist: ${customer.waist || "-"}<br>Hip: ${customer.hip || "-"}<br>Sleeve: ${customer.sleeve || "-"}<br>Length: ${customer.length || "-"}</td>
        <td>${customer.notes || "-"}</td>
      </tr>
    `).join("") : `<tr><td colspan="4">No measurements found.</td></tr>`;
  }

  if ($("leaderboard")) {
    $("leaderboard").innerHTML = staffXP().map((item, index) => `
      <div class="list-item"><b>#${index + 1} ${item.name}</b><span>${item.points} XP</span></div>
    `).join("") || "<p>No XP yet.</p>";
  }
}

function renderForms() {
  if (!$("formLinks")) return;

  $("formLinks").innerHTML = (window.TIMZY_FORMS || []).map(form => `
    <div class="glass-card">
      <h3>${form.name}</h3>
      <p>${form.description}</p>
      <a class="btn" href="${form.url}" target="_blank">Open</a>
    </div>
  `).join("");
}

/* =========================
   INIT
========================= */

loadAllData();

