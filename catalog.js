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
   PAYMENT PROXY
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
========================= */

const demoProducts = [
  {
    id: "demo-senator-blue",
    name: "Royal Blue Senator",
    category: "Senator",
    price: 45000,
    color: "Royal Blue",
    sizes: "M, L, XL",
    badge: "New Arrival",
    featured: true,
    image1: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1200&auto=format&fit=crop",
    image2: "",
    image3: "",
    description: "Premium senator wear with clean finishing, suitable for events, church, and formal outings."
  },
  {
    id: "demo-agbada-gold",
    name: "Luxury Gold Agbada",
    category: "Agbada",
    price: 95000,
    color: "Gold",
    sizes: "Custom",
    badge: "Featured",
    featured: true,
    image1: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=1200&auto=format&fit=crop",
    image2: "",
    image3: "",
    description: "Luxury agbada-inspired premium occasion wear for weddings, celebrations, and traditional events."
  },
  {
    id: "demo-black-kaftan",
    name: "Black Premium Kaftan",
    category: "Kaftan",
    price: 38000,
    color: "Black",
    sizes: "M, L, XL",
    badge: "Popular",
    featured: true,
    image1: "https://images.unsplash.com/photo-1617137968427-85924c800a22?q=80&w=1200&auto=format&fit=crop",
    image2: "",
    image3: "",
    description: "Simple, elegant black kaftan style with modern tailoring and premium comfort."
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
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
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

function buildWhatsAppLink(productName, customerName = "", phone = "") {
  const message = `
Hello Timzy Fashion,

I want to ask about this product:

Product: ${productName}
Customer Name: ${customerName || "Not provided"}
Phone: ${phone || "Not provided"}

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
      ${item.color || ""}
      ${item.description || ""}
    `.toLowerCase();

    const matchesSearch = searchable.includes(search);
    const matchesCategory = !category || item.category === category;

    return matchesSearch && matchesCategory;
  });

  renderProducts();
};

/* =========================
   FEATURED
========================= */

function renderFeatured() {
  const featuredGrid = document.getElementById("featuredGrid");

  if (!featuredGrid) return;

  const featured = products.filter(item => item.featured).slice(0, 3);

  featuredGrid.innerHTML = featured
    .map(item => {
      const image = productImages(item)[0];

      return `
        <article class="featured-card" onclick="openProduct('${item.id}')">
          <div class="featured-image">
            ${
              image
                ? `<img src="${image}" alt="${item.name}" loading="lazy">`
                : `<span>👗</span>`
            }
          </div>

          <div class="featured-info">
            <p>${item.category}</p>
            <h3>${item.name}</h3>
            <strong>${money(item.price)}</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================
   PRODUCT GRID
========================= */

function renderProducts() {
  const grid = document.getElementById("catalogGrid");

  if (!grid) return;

  if (!filteredProducts.length) {
    grid.innerHTML = `<p class="empty-state">No products found.</p>`;
    return;
  }

  grid.innerHTML = filteredProducts
    .map(item => {
      const image = productImages(item)[0];

      return `
        <article class="product-card" onclick="openProduct('${item.id}')">
          <div class="product-image">
            ${
              image
                ? `<img src="${image}" alt="${item.name}" loading="lazy">`
                : `<span>👗</span>`
            }

            ${
              item.badge
                ? `<span class="product-badge">${item.badge}</span>`
                : ""
            }
          </div>

          <div class="product-info">
            <p class="product-category">${item.category || "Timzy Fashion"}</p>
            <h3>${item.name || "Untitled Product"}</h3>
            <strong>${money(item.price)}</strong>
            <small>${item.color ? "Color: " + item.color : "Available Style"}</small>
          </div>
        </article>
      `;
    })
    .join("");
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
          ? images
              .map(
                image =>
                  `<img src="${image}" alt="${item.name}" loading="lazy">`
              )
              .join("")
          : `<div class="modal-placeholder">👗</div>`
      }
    </div>

    <div class="modal-details">
      <p class="product-category">${item.category || "Timzy Fashion"}</p>
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
        <h3>Buy This Product</h3>
        <p>Enter your details to generate CheckoutPay payment details.</p>

        <input id="buyerName" placeholder="Your Name" />
        <input id="buyerPhone" placeholder="Phone Number / WhatsApp" />
        <input id="buyerQuantity" type="number" min="1" value="1" placeholder="Quantity" />
      </div>

      <div id="paymentResult" class="payment-result" style="display:none;"></div>

      <div class="modal-actions">
        <button onclick="buyNow()">Buy Now</button>
        <a href="${whatsappLink}" target="_blank">WhatsApp Chat</a>
        <button class="secondary-btn" onclick="loginForMeasurements()">Login for Measurements</button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
};

/* =========================
   BUY NOW
========================= */

window.buyNow = async function () {
  if (!activeProduct) {
    alert("No product selected.");
    return;
  }

  const buyerName = document.getElementById("buyerName")?.value.trim() || "";
  const buyerPhone = document.getElementById("buyerPhone")?.value.trim() || "";
  const quantity = cleanNumber(document.getElementById("buyerQuantity")?.value || 1);

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
      orderReference,
      customerName: buyerName,
      phone: buyerPhone,
      productId: activeProduct.id,
      productName: activeProduct.name,
      category: activeProduct.category,
      quantity,
      unitPrice: Number(activeProduct.price || 0),
      totalAmount: amount,
      paymentStatus: "Payment Requested",
      orderStatus: "Pending Payment",
      transactionId: data.transaction_id || "",
      paymentBankName: data.bank_name || "",
      paymentAccountName: data.account_name || "",
      paymentAccountNumber: data.account_number || "",
      checkoutStatus: data.status || "",
      source: "catalog.html",
      createdAt: serverTimestamp()
    });

    showPaymentResult(data, amount, buyerName, buyerPhone, activeProduct.name);
  } catch (error) {
    console.error(error);
    alert("Payment request error. Please try again or contact Timzy Fashion on WhatsApp.");
  }
};

function showPaymentResult(data, amount, buyerName, buyerPhone, productName) {
  const resultBox = document.getElementById("paymentResult");

  if (!resultBox) return;

  const whatsappLink = buildWhatsAppLink(productName, buyerName, buyerPhone);

  resultBox.innerHTML = `
    <h3>Payment Details Generated</h3>

    <div class="payment-card">
      <p><span>Bank</span><b>${data.bank_name || "-"}</b></p>
      <p><span>Account Name</span><b>${data.account_name || "-"}</b></p>
      <p><span>Account Number</span><b>${data.account_number || "-"}</b></p>
      <p><span>Amount</span><b>${money(data.amount_to_pay || amount)}</b></p>
      <p><span>Status</span><b>${data.status || "pending"}</b></p>
    </div>

    <p class="payment-note">
      After payment, chat with Timzy Fashion on WhatsApp with your payment reference.
    </p>

    <a class="payment-whatsapp" href="${whatsappLink}" target="_blank">
      Chat on WhatsApp
    </a>
  `;

  resultBox.style.display = "block";
}

/* =========================
   LOGIN FOR MEASUREMENTS
========================= */

window.loginForMeasurements = function () {
  window.location.href = "index.html";
};

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