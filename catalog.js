import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
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
const db = getFirestore(app);

/* =========================
   CONFIG
========================= */

const PAYMENT_PROXY_URL =
  "https://script.google.com/macros/s/AKfycbwMpjON9SbRrtTTFWfR-yBZVPNwrZCnakWI797BBvvoXvlwPTEAwuCoBHnGW1krKhHn/exec";

const WHATSAPP_NUMBER = "2348118103510";

/* =========================
   STATE
========================= */

let products = [];
let filteredProducts = [];
let activeProduct = null;

/* =========================
   DEMO PRODUCTS
   Remove later from code if you want only admin-created products.
========================= */

const demoProducts = [
  {
    id: "demo-senator-blue",
    name: "Royal Blue Senator",
    category: "Senator",
    productType: "Ready-Made",
    price: 45000,
    color: "Royal Blue",
    sizes: "M, L, XL",
    badge: "New Arrival",
    featured: true,
    image1: "https://images.unsplash.com/photo-1617137968427-85924c800a22?q=80&w=1200&auto=format&fit=crop",
    image2: "",
    image3: "",
    description: "Premium senator wear with clean finishing, suitable for events, church, and formal outings."
  },
  {
    id: "demo-agbada-gold",
    name: "Luxury Gold Agbada",
    category: "Agbada",
    productType: "Custom Sewing",
    price: 95000,
    color: "Gold",
    sizes: "Custom",
    badge: "Featured",
    featured: true,
    image1: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=1200&auto=format&fit=crop",
    image2: "",
    image3: "",
    description: "Premium occasion wear for weddings, celebrations, and traditional events."
  },
  {
    id: "demo-fabric-adire",
    name: "Premium Adire Fabric",
    category: "Fabrics",
    productType: "Fabric / Material",
    price: 15000,
    color: "Blue Pattern",
    sizes: "Per yard",
    badge: "Popular",
    featured: true,
    image1: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1200&auto=format&fit=crop",
    image2: "",
    image3: "",
    description: "Premium fabric option. Select quantity/yards and chat with Timzy for styling guidance."
  }
];

/* =========================
   HELPERS
========================= */

const money = value => "₦" + Number(value || 0).toLocaleString();

function cleanNumber(value) {
  return Number(String(value || "0").replace(/[₦,\s]/g, "")) || 0;
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

function productImages(product) {
  return [product.image1, product.image2, product.image3]
    .map(driveToImage)
    .filter(Boolean);
}

function normalizeProduct(docId, data) {
  return {
    id: docId,
    name: data.name || data.product || data.productName || "Untitled Product",
    category: data.category || "Fashion",
    productType: data.productType || data.type || "Ready-Made",
    price: Number(data.price || data.selling || data.sellingPrice || 0),
    quantity: data.quantity || data.stock || "",
    color: data.color || data.materialColor || "",
    sizes: data.sizes || "",
    badge: data.badge || "",
    featured: Boolean(data.featured),
    image1: driveToImage(data.image1 || data.image || data.productImage || ""),
    image2: driveToImage(data.image2 || ""),
    image3: driveToImage(data.image3 || ""),
    description: data.description || data.productDescription || ""
  };
}

function buildWhatsAppLink(productName, customerName = "", phone = "", orderRef = "") {
  const message = `
Hello Timzy Fashion,

I want to chat about this product/order.

Product: ${productName}
Customer Name: ${customerName || "Not provided"}
Phone: ${phone || "Not provided"}
Order Reference: ${orderRef || "Not generated yet"}

Please assist me.
  `.trim();

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function customerOrderRef() {
  return `TIMZY-CAT-${Date.now()}`;
}

/* =========================
   LOAD PRODUCTS
========================= */

async function loadCatalog() {
  try {
    const snap = await getDocs(collection(db, "catalog"));

    const firebaseProducts = snap.docs.map(docSnap =>
      normalizeProduct(docSnap.id, docSnap.data())
    );

    const merged = [...demoProducts, ...firebaseProducts];

    const dedupe = new Map();

    merged.forEach(item => {
      const key = `${String(item.name || "").toLowerCase()}-${String(item.category || "").toLowerCase()}`;
      dedupe.set(key, item);
    });

    products = [...dedupe.values()];
    filteredProducts = [...products];

    renderFeatured();
    renderProducts();
  } catch (error) {
    console.error("Catalog load failed:", error);

    products = [...demoProducts];
    filteredProducts = [...demoProducts];

    renderFeatured();
    renderProducts();
  }
}

/* =========================
   FILTER
========================= */

window.filterProducts = function () {
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");

  const search = searchInput ? searchInput.value.toLowerCase() : "";
  const category = categoryFilter ? categoryFilter.value : "";

  filteredProducts = products.filter(item => {
    const searchable = `
      ${item.name || ""}
      ${item.category || ""}
      ${item.productType || ""}
      ${item.color || ""}
      ${item.description || ""}
    `.toLowerCase();

    return searchable.includes(search) && (!category || item.category === category);
  });

  renderProducts();
};

/* =========================
   RENDER FEATURED
========================= */

function renderFeatured() {
  const featuredGrid = document.getElementById("featuredGrid");
  if (!featuredGrid) return;

  const featured = products.filter(item => item.featured).slice(0, 3);

  featuredGrid.innerHTML = featured.map(item => {
    const image = productImages(item)[0];

    return `
      <article class="featured-card" onclick="openProduct('${item.id}')">
        <div class="featured-image">
          ${image ? `<img src="${image}" alt="${item.name}" loading="lazy">` : `<span>👗</span>`}
        </div>

        <div class="featured-info">
          <p>${item.category} • ${item.productType || "Ready-Made"}</p>
          <h3>${item.name}</h3>
          <strong>${money(item.price)}</strong>
        </div>
      </article>
    `;
  }).join("");
}

/* =========================
   RENDER PRODUCT GRID
========================= */

function renderProducts() {
  const grid = document.getElementById("catalogGrid");
  if (!grid) return;

  if (!filteredProducts.length) {
    grid.innerHTML = `<p class="empty-state">No products found.</p>`;
    return;
  }

  grid.innerHTML = filteredProducts.map(item => {
    const image = productImages(item)[0];

    return `
      <article class="product-card" onclick="openProduct('${item.id}')">
        <div class="product-image">
          ${image ? `<img src="${image}" alt="${item.name}" loading="lazy">` : `<span>👗</span>`}
          ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ""}
        </div>

        <div class="product-info">
          <p class="product-category">${item.category || "Timzy Fashion"}</p>
          <h3>${item.name || "Untitled Product"}</h3>
          <strong>${money(item.price)}</strong>
          <small>${item.productType || "Ready-Made"} ${item.color ? "• " + item.color : ""}</small>
        </div>
      </article>
    `;
  }).join("");
}

/* =========================
   PRODUCT MODAL
========================= */

window.openProduct = function (id) {
  const item = products.find(product => product.id === id);
  if (!item) return;

  activeProduct = item;

  const modal = document.getElementById("productModal");
  const body = document.getElementById("modalBody");

  if (!modal || !body) return;

  const images = productImages(item);
  const whatsappLink = buildWhatsAppLink(item.name);

  body.innerHTML = `
    <div class="modal-gallery">
      ${
        images.length
          ? images.map(image => `<img src="${image}" alt="${item.name}" loading="lazy">`).join("")
          : `<div class="modal-placeholder">👗</div>`
      }
    </div>

    <div class="modal-details">
      <p class="product-category">${item.category || "Timzy Fashion"} • ${item.productType || "Ready-Made"}</p>
      <h2>${item.name}</h2>
      <strong class="modal-price">${money(item.price)}</strong>

      <div class="meta-grid">
        <div>
          <span>Color</span>
          <b>${item.color || "Ask for availability"}</b>
        </div>

        <div>
          <span>Sizes</span>
          <b>${item.sizes || "Custom / Confirm"}</b>
        </div>

        <div>
          <span>Stock</span>
          <b>${item.quantity || "Confirm availability"}</b>
        </div>
      </div>

      <p class="modal-description">
        ${item.description || "Premium Timzy Fashion product. Contact us for order details and sizing."}
      </p>

      <div class="quick-checkout">
        <h3>Quick Order</h3>
        <p>No login required. Fill only what applies to this product.</p>

        <input id="buyerName" placeholder="Your Name" />
        <input id="buyerPhone" placeholder="Phone Number / WhatsApp" />
        <input id="buyerQuantity" type="number" min="1" value="1" placeholder="Quantity" />

        <select id="orderType" onchange="toggleOrderFields()">
          <option value="Ready-Made">Ready-Made / Size Order</option>
          <option value="Fabric / Material">Fabric / Material Order</option>
          <option value="Custom Sewing">Custom Sewing / Measurement Order</option>
          <option value="Accessory">Accessory Order</option>
        </select>

        <div id="sizeFields" class="conditional-fields">
          <select id="buyerSize">
            <option value="">Select Size</option>
            <option>XS</option>
            <option>S</option>
            <option>M</option>
            <option>L</option>
            <option>XL</option>
            <option>XXL</option>
            <option>Custom / Not sure</option>
          </select>
        </div>

        <div id="fabricFields" class="conditional-fields" style="display:none;">
          <input id="fabricLength" placeholder="Yards / meters needed e.g. 5 yards" />
          <input id="preferredColor" placeholder="Preferred color / pattern" />
        </div>

        <div id="measurementFields" class="conditional-fields" style="display:none;">
          <input id="mShoulder" placeholder="Shoulder" />
          <input id="mChest" placeholder="Chest / Bust" />
          <input id="mWaist" placeholder="Waist" />
          <input id="mHip" placeholder="Hip" />
          <input id="mSleeve" placeholder="Sleeve" />
          <input id="mLength" placeholder="Length" />
        </div>

        <textarea id="styleNotes" placeholder="Style notes, delivery notes, or special request"></textarea>
      </div>

      <div id="paymentResult" class="payment-result" style="display:none;"></div>

      <div class="modal-actions">
        <button onclick="buyNow()">Buy Now</button>
        <a href="${whatsappLink}" target="_blank">WhatsApp Chat</a>
      </div>
    </div>
  `;

  const orderType = document.getElementById("orderType");
  if (orderType) orderType.value = item.productType || "Ready-Made";
  toggleOrderFields();

  modal.style.display = "flex";
};

/* =========================
   CONDITIONAL ORDER FIELDS
========================= */

window.toggleOrderFields = function () {
  const orderType = document.getElementById("orderType")?.value || "Ready-Made";

  const sizeFields = document.getElementById("sizeFields");
  const fabricFields = document.getElementById("fabricFields");
  const measurementFields = document.getElementById("measurementFields");

  if (sizeFields) sizeFields.style.display = orderType === "Ready-Made" || orderType === "Accessory" ? "block" : "none";
  if (fabricFields) fabricFields.style.display = orderType === "Fabric / Material" ? "block" : "none";
  if (measurementFields) measurementFields.style.display = orderType === "Custom Sewing" ? "grid" : "none";
};

/* =========================
   BUY NOW
========================= */

window.buyNow = async function () {
  if (!activeProduct) return alert("No product selected.");

  const buyerName = document.getElementById("buyerName")?.value.trim() || "";
  const buyerPhone = document.getElementById("buyerPhone")?.value.trim() || "";
  const quantity = cleanNumber(document.getElementById("buyerQuantity")?.value || 1);
  const orderType = document.getElementById("orderType")?.value || activeProduct.productType || "Ready-Made";

  if (!buyerName || !buyerPhone) {
    alert("Please enter your name and phone number.");
    return;
  }

  if (!quantity || quantity < 1) {
    alert("Enter a valid quantity.");
    return;
  }

  const amount = Number(activeProduct.price || 0) * quantity;

  if (!amount || amount <= 0) {
    alert("This product does not have a valid price.");
    return;
  }

  const orderReference = customerOrderRef();

  const orderDetails = {
    orderReference,
    customerName: buyerName,
    phone: buyerPhone,
    productId: activeProduct.id,
    productName: activeProduct.name,
    category: activeProduct.category,
    productType: orderType,
    quantity,
    unitPrice: Number(activeProduct.price || 0),
    totalAmount: amount,
    selectedSize: document.getElementById("buyerSize")?.value || "",
    fabricLength: document.getElementById("fabricLength")?.value || "",
    preferredColor: document.getElementById("preferredColor")?.value || "",
    measurements: {
      shoulder: document.getElementById("mShoulder")?.value || "",
      chest: document.getElementById("mChest")?.value || "",
      waist: document.getElementById("mWaist")?.value || "",
      hip: document.getElementById("mHip")?.value || "",
      sleeve: document.getElementById("mSleeve")?.value || "",
      length: document.getElementById("mLength")?.value || ""
    },
    styleNotes: document.getElementById("styleNotes")?.value || "",
    paymentStatus: "Payment Requested",
    orderStatus: "Pending Payment",
    source: "catalog.html",
    createdAt: serverTimestamp()
  };

  try {
    const response = await fetch(PAYMENT_PROXY_URL, {
      method: "POST",
      body: JSON.stringify({
        orderId: orderReference,
        amount,
        payer_name: buyerName,
        phone: buyerPhone,
        product: `${activeProduct.name} x${quantity}`
      })
    });

    const data = await response.json();

    if (!data.success) {
      console.error(data);
      alert(data.message || "Payment request failed.");
      return;
    }

    await addDoc(collection(db, "publicCatalogOrders"), {
      ...orderDetails,
      transactionId: data.transaction_id || "",
      paymentBankName: data.bank_name || "",
      paymentAccountName: data.account_name || "",
      paymentAccountNumber: data.account_number || "",
      checkoutStatus: data.status || ""
    });

    showPaymentResult(data, amount, buyerName, buyerPhone, activeProduct.name, orderReference);
  } catch (error) {
    console.error(error);
    alert("Payment request error. Please try again or contact Timzy Fashion on WhatsApp.");
  }
};

function showPaymentResult(data, amount, buyerName, buyerPhone, productName, orderReference) {
  const resultBox = document.getElementById("paymentResult");
  if (!resultBox) return;

  const whatsappLink = buildWhatsAppLink(productName, buyerName, buyerPhone, orderReference);

  resultBox.innerHTML = `
    <h3>Payment Details Generated</h3>

    <div class="payment-card">
      <p><span>Order Ref</span><b>${orderReference}</b></p>
      <p><span>Bank</span><b>${data.bank_name || "-"}</b></p>
      <p><span>Account Name</span><b>${data.account_name || "-"}</b></p>
      <p><span>Account Number</span><b>${data.account_number || "-"}</b></p>
      <p><span>Amount</span><b>${money(data.amount_to_pay || amount)}</b></p>
      <p><span>Status</span><b>${data.status || "pending"}</b></p>
    </div>

    <p class="payment-note">
      After payment, chat with Timzy Fashion on WhatsApp using your order reference.
    </p>

    <a class="payment-whatsapp" href="${whatsappLink}" target="_blank">
      Chat on WhatsApp
    </a>
  `;

  resultBox.style.display = "block";
}

/* =========================
   MODAL CONTROL
========================= */

window.closeModal = function () {
  const modal = document.getElementById("productModal");
  if (modal) modal.style.display = "none";
};

window.addEventListener("click", event => {
  const modal = document.getElementById("productModal");

  if (event.target === modal) {
    closeModal();
  }
});

/* =========================
   INIT
========================= */

loadCatalog();
