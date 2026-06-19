import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs
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
   STATE
========================= */

let products = [];
let filteredProducts = [];

/* =========================
   DEMO PRODUCTS
   These show with your real products.
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
   RENDER FEATURED
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
   RENDER PRODUCT GRID
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

  const modal = document.getElementById("productModal");
  const body = document.getElementById("modalBody");

  if (!modal || !body) return;

  const images = productImages(item);

  const whatsappLink =
    "https://wa.me/2348118103510?text=" +
    encodeURIComponent(`Hello, I want to order ${item.name}`);

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

      <div class="modal-actions">
        <button onclick="requestOrder()">Request Order</button>
        <a href="${whatsappLink}" target="_blank">WhatsApp</a>
      </div>
    </div>
  `;

  modal.style.display = "flex";
};

window.requestOrder = function () {
  alert("Login required to place order. Please request login details or sign in through Timzy Fashion OS.");
  window.location.href = "index.html";
};

window.closeModal = function () {
  const modal = document.getElementById("productModal");
  if (modal) modal.style.display = "none";
};

/* =========================
   MODAL OUTSIDE CLICK
========================= */

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