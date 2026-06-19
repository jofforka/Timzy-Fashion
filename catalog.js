import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const PAYMENT_PROXY_URL = "https://script.google.com/macros/s/AKfycbwMpjON9SbRrtTTFWfR-yBZVPNwrZCnakWI797BBvvoXvlwPTEAwuCoBHnGW1krKhHn/exec";
const WHATSAPP_NUMBER = "2348118103510";

let products = [];
let filteredProducts = [];
let activeProduct = null;
let activeImages = [];
let activeSlideIndex = 0;

const money = value => "₦" + Number(value || 0).toLocaleString();

function cleanNumber(value){ return Number(String(value || "0").replace(/[₦,\s]/g,"")) || 0; }

function driveToImage(url){
  if(!url) return "";
  const str = String(url).trim();
  const idMatch = str.match(/\/d\/([a-zA-Z0-9_-]+)/) || str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch && idMatch[1] ? `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1200` : str;
}

function productImages(product){
  return [product.image1, product.image2, product.image3, product.image4, product.image5, product.image6]
    .map(driveToImage)
    .filter(Boolean);
}

function normalizeProduct(id, data){
  return {
    id,
    name: data.name || data.product || "Untitled Product",
    category: data.category || "Fashion",
    productType: data.productType || "Ready-Made",
    price: Number(data.price || data.selling || 0),
    quantity: data.quantity || data.stock || "",
    color: data.color || "",
    sizes: data.sizes || "",
    badge: data.badge || "",
    featured: Boolean(data.featured),
    status: data.status || "Published",
    image1: driveToImage(data.image1 || ""),
    image2: driveToImage(data.image2 || ""),
    image3: driveToImage(data.image3 || ""),
    image4: driveToImage(data.image4 || ""),
    image5: driveToImage(data.image5 || ""),
    image6: driveToImage(data.image6 || ""),
    description: data.description || ""
  };
}

function buildWhatsAppLink(productName, customerName = "", phone = "", orderRef = ""){
  const message = `Hello Timzy Fashion,\n\nProduct: ${productName}\nCustomer: ${customerName || "Not provided"}\nPhone: ${phone || "Not provided"}\nOrder Ref: ${orderRef || "Not generated yet"}\n\nPlease assist me.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function customerOrderRef(){ return `TIMZY-CAT-${Date.now()}`; }

async function loadCatalog(){
  try{
    const snap = await getDocs(collection(db,"catalog"));
    products = snap.docs
      .map(d => normalizeProduct(d.id, d.data()))
      .filter(p => (p.status || "Published") === "Published");
    filteredProducts = [...products];
    renderFeatured();
    renderProducts();
  }catch(error){
    console.error(error);
    products = [];
    filteredProducts = [];
    renderFeatured();
    renderProducts();
  }
}

window.filterProducts = function(){
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const category = document.getElementById("categoryFilter")?.value || "";
  filteredProducts = products.filter(item => {
    const searchable = `${item.name} ${item.category} ${item.productType} ${item.color} ${item.description}`.toLowerCase();
    return searchable.includes(search) && (!category || item.category === category);
  });
  renderProducts();
};

function renderFeatured(){
  const grid = document.getElementById("featuredGrid");
  if(!grid) return;
  const featured = products.filter(p => p.featured).slice(0,3);
  grid.innerHTML = featured.length ? featured.map(productCard).join("") : `<div class="empty-featured"><h3>No featured products yet.</h3><p>Mark products as featured in Catalog Manager.</p></div>`;
}

function renderProducts(){
  const grid = document.getElementById("catalogGrid");
  if(!grid) return;
  grid.innerHTML = filteredProducts.length ? filteredProducts.map(productCard).join("") : `<div class="empty-state"><h3>No products yet.</h3><p>Admin should upload products from Catalog Manager.</p></div>`;
}

function productCard(item){
  const images = productImages(item);
  const image = images[0];
  return `
    <article class="product-card" onclick="openProduct('${item.id}')">
      <div class="product-image">
        ${image ? `<img src="${image}" alt="${item.name}" loading="lazy">` : `<span>👗</span>`}
        ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ""}
        ${images.length > 1 ? `<span class="image-count">+${images.length - 1}</span>` : ""}
      </div>
      <div class="product-info">
        <p>${item.category}</p>
        <h3>${item.name}</h3>
        <strong>${money(item.price)}</strong>
        <small>${item.productType}${item.color ? " • " + item.color : ""}</small>
      </div>
    </article>
  `;
}

window.openProduct = function(id){
  const item = products.find(p => p.id === id);
  if(!item) return;
  activeProduct = item;
  activeImages = productImages(item);
  activeSlideIndex = 0;

  const modal = document.getElementById("productModal");
  const body = document.getElementById("modalBody");
  const whatsappLink = buildWhatsAppLink(item.name);

  body.innerHTML = `
    <div class="product-modal-layout">
      <div>
        <div class="carousel-main">
          <button class="carousel-arrow left" onclick="prevSlide()" ${activeImages.length <= 1 ? "disabled" : ""}>‹</button>
          <div id="carouselImageWrap" class="carousel-image-wrap">${activeImages.length ? `<img id="carouselMainImage" src="${activeImages[0]}" alt="${item.name}">` : `<div class="modal-placeholder">👗</div>`}</div>
          <button class="carousel-arrow right" onclick="nextSlide()" ${activeImages.length <= 1 ? "disabled" : ""}>›</button>
        </div>
        <div id="carouselDots" class="carousel-dots">${renderCarouselDots()}</div>
        <div id="carouselThumbs" class="carousel-thumbs">${renderCarouselThumbs()}</div>
      </div>

      <div>
        <p class="product-category">${item.category} • ${item.productType}</p>
        <h2>${item.name}</h2>
        <strong class="modal-price">${money(item.price)}</strong>
        <p class="modal-description">${item.description || "Premium Timzy Fashion product."}</p>

        <div class="quick-checkout">
          <h3>Quick Order</h3>
          <input id="buyerName" placeholder="Your Name">
          <input id="buyerPhone" placeholder="Phone / WhatsApp">
          <input id="buyerQuantity" type="number" min="1" value="1">
          <select id="orderType" onchange="toggleOrderFields()">
            <option>Ready-Made</option>
            <option>Fabric / Material</option>
            <option>Custom Sewing</option>
            <option>Accessory</option>
          </select>
          <div id="sizeFields"><select id="buyerSize"><option value="">Select Size</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option><option>Custom / Not sure</option></select></div>
          <div id="fabricFields" style="display:none;"><input id="fabricLength" placeholder="Yards / meters"><input id="preferredColor" placeholder="Preferred color"></div>
          <div id="measurementFields" style="display:none;"><input id="mShoulder" placeholder="Shoulder"><input id="mChest" placeholder="Chest/Bust"><input id="mWaist" placeholder="Waist"><input id="mHip" placeholder="Hip"><input id="mSleeve" placeholder="Sleeve"><input id="mLength" placeholder="Length"></div>
          <textarea id="styleNotes" placeholder="Style/delivery notes"></textarea>
        </div>

        <div id="paymentResult" class="payment-result" style="display:none;"></div>
        <div class="modal-actions"><button onclick="buyNow()">Buy Now</button><a href="${whatsappLink}" target="_blank">WhatsApp</a></div>
        <div class="future-row"><button disabled>♡ Wishlist Coming</button><button disabled>Reviews Coming</button><button disabled>360° Coming</button></div>
        <div id="similarProducts" class="similar-products">${renderSimilarProducts(item)}</div>
      </div>
    </div>
  `;

  document.getElementById("orderType").value = item.productType || "Ready-Made";
  toggleOrderFields();
  enableSwipeCarousel();
  modal.style.display = "flex";
};

function renderSimilarProducts(item){
  const similar = products.filter(p => p.id !== item.id && p.category === item.category).slice(0,4);
  if(!similar.length) return "";
  return `<h3>You May Also Like</h3><div class="similar-grid">${similar.map(p => {
    const image = productImages(p)[0];
    return `<div class="similar-card" onclick="openProduct('${p.id}')">${image ? `<img src="${image}">` : ""}<b>${p.name}</b><span>${money(p.price)}</span></div>`;
  }).join("")}</div>`;
}

function renderCarouselDots(){
  return activeImages.map((_,i) => `<button class="carousel-dot ${i===activeSlideIndex ? "active" : ""}" onclick="goToSlide(${i})"></button>`).join("");
}

function renderCarouselThumbs(){
  return activeImages.map((img,i) => `<button class="carousel-thumb ${i===activeSlideIndex ? "active" : ""}" onclick="goToSlide(${i})"><img src="${img}"></button>`).join("");
}

function updateCarousel(){
  const main = document.getElementById("carouselMainImage");
  if(main && activeImages[activeSlideIndex]) main.src = activeImages[activeSlideIndex];
  const dots = document.getElementById("carouselDots");
  const thumbs = document.getElementById("carouselThumbs");
  if(dots) dots.innerHTML = renderCarouselDots();
  if(thumbs) thumbs.innerHTML = renderCarouselThumbs();
}

window.nextSlide = function(){ if(activeImages.length){ activeSlideIndex = (activeSlideIndex + 1) % activeImages.length; updateCarousel(); } };
window.prevSlide = function(){ if(activeImages.length){ activeSlideIndex = (activeSlideIndex - 1 + activeImages.length) % activeImages.length; updateCarousel(); } };
window.goToSlide = function(i){ if(activeImages[i]){ activeSlideIndex = i; updateCarousel(); } };

function enableSwipeCarousel(){
  const wrap = document.getElementById("carouselImageWrap");
  if(!wrap || activeImages.length <= 1) return;
  let startX = 0, endX = 0;
  wrap.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
  wrap.addEventListener("touchmove", e => endX = e.touches[0].clientX, {passive:true});
  wrap.addEventListener("touchend", () => {
    const diff = startX - endX;
    if(Math.abs(diff) > 45) diff > 0 ? nextSlide() : prevSlide();
  });
}

window.toggleOrderFields = function(){
  const type = document.getElementById("orderType")?.value || "Ready-Made";
  document.getElementById("sizeFields").style.display = type === "Ready-Made" || type === "Accessory" ? "block" : "none";
  document.getElementById("fabricFields").style.display = type === "Fabric / Material" ? "block" : "none";
  document.getElementById("measurementFields").style.display = type === "Custom Sewing" ? "grid" : "none";
};

window.buyNow = async function(){
  if(!activeProduct) return alert("No product selected.");
  const buyerName = document.getElementById("buyerName")?.value.trim() || "";
  const buyerPhone = document.getElementById("buyerPhone")?.value.trim() || "";
  const quantity = cleanNumber(document.getElementById("buyerQuantity")?.value || 1);
  const orderType = document.getElementById("orderType")?.value || activeProduct.productType;
  if(!buyerName || !buyerPhone) return alert("Please enter your name and phone number.");
  if(!quantity || quantity < 1) return alert("Enter a valid quantity.");
  const amount = Number(activeProduct.price || 0) * quantity;
  if(!amount) return alert("This product does not have a valid price.");

  const orderReference = customerOrderRef();

  const orderDetails = {
    orderReference, customerName: buyerName, phone: buyerPhone,
    productId: activeProduct.id, productName: activeProduct.name,
    category: activeProduct.category, productType: orderType,
    quantity, unitPrice: Number(activeProduct.price || 0), totalAmount: amount,
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
    paymentStatus: "Payment Requested", orderStatus: "Pending Payment",
    source: "catalog.html", createdAt: serverTimestamp()
  };

  try{
    const response = await fetch(PAYMENT_PROXY_URL, { method:"POST", body: JSON.stringify({ orderId: orderReference, amount, payer_name: buyerName, phone: buyerPhone, product: `${activeProduct.name} x${quantity}` }) });
    const data = await response.json();
    if(!data.success) return alert(data.message || "Payment request failed.");

    await addDoc(collection(db,"publicCatalogOrders"), { ...orderDetails, transactionId: data.transaction_id || "", paymentBankName: data.bank_name || "", paymentAccountName: data.account_name || "", paymentAccountNumber: data.account_number || "", checkoutStatus: data.status || "" });

    const whatsappLink = buildWhatsAppLink(activeProduct.name, buyerName, buyerPhone, orderReference);
    document.getElementById("paymentResult").innerHTML = `<h3>Payment Details Generated</h3><div class="payment-card"><p><span>Order Ref</span><b>${orderReference}</b></p><p><span>Bank</span><b>${data.bank_name || "-"}</b></p><p><span>Account Name</span><b>${data.account_name || "-"}</b></p><p><span>Account Number</span><b>${data.account_number || "-"}</b></p><p><span>Amount</span><b>${money(data.amount_to_pay || amount)}</b></p></div><a class="payment-whatsapp" href="${whatsappLink}" target="_blank">Chat on WhatsApp</a>`;
    document.getElementById("paymentResult").style.display = "block";
  }catch(error){
    console.error(error);
    alert("Payment request error. Please try again.");
  }
};

window.closeModal = function(){
  const modal = document.getElementById("productModal");
  if(modal) modal.style.display = "none";
  activeImages = [];
  activeSlideIndex = 0;
};

window.addEventListener("click", e => { const modal = document.getElementById("productModal"); if(e.target === modal) closeModal(); });
window.addEventListener("keydown", e => { if(e.key === "Escape") closeModal(); if(e.key === "ArrowRight") nextSlide(); if(e.key === "ArrowLeft") prevSlide(); });

loadCatalog();
