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
const WISHLIST_KEY = "timzyWishlist";
const RECENT_KEY = "timzyRecentlyViewed";

let products = [], filteredProducts = [], activeProduct = null, activeImages = [], activeSlideIndex = 0;

const money = v => "₦" + Number(v || 0).toLocaleString();
const cleanNumber = v => Number(String(v || "0").replace(/[₦,\s]/g,"")) || 0;

function driveToImage(url){
  if(!url) return "";
  const s = String(url).trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m && m[1] ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200` : s;
}
function productImages(p){ return [p.image1,p.image2,p.image3,p.image4,p.image5,p.image6,p.image7,p.image8,p.image9,p.image10,p.image11,p.image12].map(driveToImage).filter(Boolean); }
function effectivePrice(p){ return Number(p.salePrice || p.price || 0); }
function getList(k){ try{return JSON.parse(localStorage.getItem(k)||"[]")}catch{return[]} }
function setList(k,v){ localStorage.setItem(k, JSON.stringify(v)); }

function normalizeProduct(id,d){
  return {
    id, name:d.name||d.product||d.productName||"Untitled Product", category:d.category||"Fashion",
    productType:d.productType||d.type||"Ready-Made", status:d.status||"Published",
    price:Number(d.price||d.selling||d.sellingPrice||0), salePrice:Number(d.salePrice||d.discountPrice||0),
    quantity:d.quantity||d.stock||"", color:d.color||d.materialColor||"", sizes:d.sizes||"",
    badge:d.badge||"", featured:Boolean(d.featured), tags:d.tags||"", videoUrl:d.videoUrl||d.video||"",
    image1:driveToImage(d.image1||d.image||d.productImage||""), image2:driveToImage(d.image2||""), image3:driveToImage(d.image3||""),
    image4:driveToImage(d.image4||""), image5:driveToImage(d.image5||""), image6:driveToImage(d.image6||""),
    image7:driveToImage(d.image7||""), image8:driveToImage(d.image8||""), image9:driveToImage(d.image9||""),
    image10:driveToImage(d.image10||""), image11:driveToImage(d.image11||""), image12:driveToImage(d.image12||""),
    description:d.description||d.productDescription||""
  };
}

async function loadCatalog(){
  try{
    const snap = await getDocs(collection(db,"catalog"));
    products = snap.docs.map(x=>normalizeProduct(x.id,x.data())).filter(p=>String(p.status||"Published")==="Published");
    filteredProducts = [...products];
  }catch(e){ console.error(e); products=[]; filteredProducts=[]; }
  renderFeatured(); renderRecentlyViewed(); renderProducts(); updateWishlistHeader();
}

window.quickCategory = function(c){ const s=document.getElementById("categoryFilter"); if(s)s.value=c; filterProducts(); document.getElementById("allProducts")?.scrollIntoView({behavior:"smooth"}); };
window.filterProducts = function(){
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
  const cat = document.getElementById("categoryFilter")?.value || "";
  const type = document.getElementById("typeFilter")?.value || "";
  filteredProducts = products.filter(p => (`${p.name} ${p.category} ${p.productType} ${p.color} ${p.description} ${p.tags}`).toLowerCase().includes(search) && (!cat || p.category===cat) && (!type || p.productType===type));
  renderProducts();
};

function isWishlisted(id){ return getList(WISHLIST_KEY).includes(id); }
window.toggleWishlist = function(id){
  let list = getList(WISHLIST_KEY);
  list = list.includes(id) ? list.filter(x=>x!==id) : [id,...list];
  setList(WISHLIST_KEY,list); updateWishlistHeader(); renderProducts(); renderFeatured();
  const b=document.getElementById("modalWishlistBtn"); if(b && activeProduct?.id===id)b.textContent=isWishlisted(id)?"♥ Saved":"♡ Save";
};
function updateWishlistHeader(){ const b=document.getElementById("wishlistHeaderBtn"); if(b){ const c=getList(WISHLIST_KEY).length; b.textContent=c?`♥ Wishlist (${c})`:"♡ Wishlist"; } }
window.toggleWishlistPanel = function(){
  const p=document.getElementById("wishlistPanel"), c=document.getElementById("wishlistPanelItems");
  if(!p||!c)return;
  if(p.style.display==="none"){
    const items=getList(WISHLIST_KEY).map(id=>products.find(x=>x.id===id)).filter(Boolean);
    c.innerHTML = items.length ? items.map(x=>`<div class="wishlist-row" onclick="openProduct('${x.id}')"><img src="${productImages(x)[0]||""}"><div><b>${x.name}</b><span>${money(effectivePrice(x))}</span></div></div>`).join("") : "<p>No saved items.</p>";
    p.style.display="flex";
  } else p.style.display="none";
};

function productCard(p,mini=false){
  const imgs=productImages(p), img=imgs[0], wished=isWishlisted(p.id);
  return `<article class="${mini?'mini-product-card':'product-card'}" onclick="openProduct('${p.id}')">
    <div class="${mini?'mini-product-image':'product-image'}">${img?`<img src="${img}" alt="${p.name}" loading="lazy">`:"<span>👗</span>"}${p.badge?`<span class="product-badge">${p.badge}</span>`:""}${imgs.length>1?`<span class="image-count">+${imgs.length-1}</span>`:""}${wished?`<span class="wish-pill">♥</span>`:""}</div>
    <div class="${mini?'mini-product-info':'product-info'}"><p>${p.category}</p><h3>${p.name}</h3><div class="price-line"><strong>${money(effectivePrice(p))}</strong>${p.salePrice?`<small class="old-price">${money(p.price)}</small>`:""}</div><small>${p.productType}${p.color?" • "+p.color:""}</small></div>
  </article>`;
}
function renderFeatured(){ const g=document.getElementById("featuredGrid"); if(!g)return; const f=products.filter(p=>p.featured).slice(0,3); g.innerHTML=f.length?f.map(p=>productCard(p)).join(""):`<div class="empty-featured"><h3>No featured products yet.</h3><p>Mark premium products as featured in admin.</p></div>`; }
function renderProducts(){ const g=document.getElementById("catalogGrid"); if(!g)return; g.innerHTML=filteredProducts.length?filteredProducts.map(p=>productCard(p)).join(""):`<div class="empty-state"><h3>No products found.</h3><p>Try another search or category.</p></div>`; }
function renderRecentlyViewed(){ const s=document.getElementById("recentlyViewedSection"), g=document.getElementById("recentlyViewedGrid"); if(!s||!g)return; const items=getList(RECENT_KEY).map(id=>products.find(p=>p.id===id)).filter(Boolean).slice(0,6); s.style.display=items.length?"block":"none"; g.innerHTML=items.map(p=>productCard(p,true)).join(""); }
function addRecent(id){ let r=getList(RECENT_KEY).filter(x=>x!==id); r.unshift(id); setList(RECENT_KEY,r.slice(0,8)); renderRecentlyViewed(); }

window.openProduct = function(id){
  const p=products.find(x=>x.id===id); if(!p)return;
  activeProduct=p; activeImages=productImages(p); activeSlideIndex=0; addRecent(id);
  const modal=document.getElementById("productModal"), body=document.getElementById("modalBody");
  const wa = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello Timzy Fashion, I want to chat about "+p.name)}`;
  body.innerHTML=`<div class="product-modal-layout">
    <div class="carousel-shell">${p.videoUrl?`<div class="video-box"><a href="${p.videoUrl}" target="_blank">▶ View Product Video</a></div>`:""}<div class="carousel-main"><button class="carousel-arrow left" onclick="prevSlide()" ${activeImages.length<=1?"disabled":""}>‹</button><div id="carouselImageWrap" class="carousel-image-wrap">${activeImages.length?`<img id="carouselMainImage" src="${activeImages[0]}" alt="${p.name}">`:"<div class='modal-placeholder'>👗</div>"}</div><button class="carousel-arrow right" onclick="nextSlide()" ${activeImages.length<=1?"disabled":""}>›</button></div><div id="carouselDots" class="carousel-dots">${dots()}</div><div id="carouselThumbs" class="carousel-thumbs">${thumbs()}</div></div>
    <div class="modal-details"><p class="product-category">${p.category} • ${p.productType}</p><h2>${p.name}</h2><div class="modal-price-line"><strong class="modal-price">${money(effectivePrice(p))}</strong>${p.salePrice?`<span class="old-price large">${money(p.price)}</span>`:""}</div><div class="meta-grid"><div><span>Color</span><b>${p.color||"Ask"}</b></div><div><span>Sizes</span><b>${p.sizes||"Custom / Confirm"}</b></div><div><span>Stock</span><b>${p.quantity||"Confirm"}</b></div></div><p class="modal-description">${p.description||"Premium Timzy Fashion product."}</p>
    <div class="quick-checkout"><h3>Quick Order</h3><p>No login required.</p><input id="buyerName" placeholder="Your Name"><input id="buyerPhone" placeholder="Phone / WhatsApp"><input id="buyerQuantity" type="number" min="1" value="1"><select id="orderType" onchange="toggleOrderFields()"><option value="Ready-Made">Ready-Made / Size Order</option><option value="Fabric / Material">Fabric / Material Order</option><option value="Custom Sewing">Custom Sewing / Measurement Order</option><option value="Accessory">Accessory Order</option></select><div id="sizeFields"><select id="buyerSize"><option value="">Select Size</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option><option>Custom / Not sure</option></select></div><div id="fabricFields" style="display:none"><input id="fabricLength" placeholder="Yards / meters"><input id="preferredColor" placeholder="Preferred color"></div><div id="measurementFields" style="display:none"><input id="mShoulder" placeholder="Shoulder"><input id="mChest" placeholder="Chest / Bust"><input id="mWaist" placeholder="Waist"><input id="mHip" placeholder="Hip"><input id="mSleeve" placeholder="Sleeve"><input id="mLength" placeholder="Length"></div><textarea id="styleNotes" placeholder="Style notes / delivery request"></textarea></div><div id="paymentResult" class="payment-result" style="display:none"></div><div class="modal-actions"><button onclick="buyNow()">Buy Now</button><a href="${wa}" target="_blank">WhatsApp Chat</a></div><div class="future-row"><button id="modalWishlistBtn" onclick="toggleWishlist('${p.id}')">${isWishlisted(p.id)?"♥ Saved":"♡ Save"}</button><button onclick="document.getElementById('reviewsBox').scrollIntoView({behavior:'smooth'})">Reviews</button><button disabled>360° Ready</button></div><div id="reviewsBox" class="reviews-box"><h3>Product Reviews</h3><p>Reviews engine ready. Connect verified buyer reviews next.</p><div class="review-sample"><b>Timzy Quality Check</b><span>Premium finishing • Accurate sizing • Fast response</span></div></div><div class="similar-products">${similar(p)}</div></div></div>`;
  document.getElementById("orderType").value=p.productType||"Ready-Made"; toggleOrderFields(); swipe(); modal.style.display="flex";
};

function similar(p){ const items=products.filter(x=>x.id!==p.id&&(x.category===p.category||x.productType===p.productType)).slice(0,4); return items.length?`<h3>You May Also Like</h3><div class="similar-grid">${items.map(x=>`<div class="similar-card" onclick="openProduct('${x.id}')"><img src="${productImages(x)[0]||""}"><b>${x.name}</b><small>${money(effectivePrice(x))}</small></div>`).join("")}</div>`:""; }
function dots(){ return activeImages.map((_,i)=>`<button class="carousel-dot ${i===activeSlideIndex?'active':''}" onclick="goToSlide(${i})"></button>`).join(""); }
function thumbs(){ return activeImages.map((img,i)=>`<button class="carousel-thumb ${i===activeSlideIndex?'active':''}" onclick="goToSlide(${i})"><img src="${img}"></button>`).join(""); }
function updateCarousel(){ const m=document.getElementById("carouselMainImage"); if(m&&activeImages[activeSlideIndex])m.src=activeImages[activeSlideIndex]; const d=document.getElementById("carouselDots"), t=document.getElementById("carouselThumbs"); if(d)d.innerHTML=dots(); if(t)t.innerHTML=thumbs(); }
window.nextSlide=()=>{ if(activeImages.length){activeSlideIndex=(activeSlideIndex+1)%activeImages.length; updateCarousel();}};
window.prevSlide=()=>{ if(activeImages.length){activeSlideIndex=(activeSlideIndex-1+activeImages.length)%activeImages.length; updateCarousel();}};
window.goToSlide=i=>{ if(activeImages[i]){activeSlideIndex=i; updateCarousel();}};
function swipe(){ const w=document.getElementById("carouselImageWrap"); if(!w||activeImages.length<=1)return; let sx=0,ex=0; w.addEventListener("touchstart",e=>sx=e.touches[0].clientX,{passive:true}); w.addEventListener("touchmove",e=>ex=e.touches[0].clientX,{passive:true}); w.addEventListener("touchend",()=>{ const diff=sx-ex; if(Math.abs(diff)>45) diff>0?nextSlide():prevSlide();}); }

window.toggleOrderFields=function(){ const type=document.getElementById("orderType")?.value||"Ready-Made"; document.getElementById("sizeFields").style.display=(type==="Ready-Made"||type==="Accessory")?"block":"none"; document.getElementById("fabricFields").style.display=type==="Fabric / Material"?"block":"none"; document.getElementById("measurementFields").style.display=type==="Custom Sewing"?"grid":"none"; };
window.buyNow=async function(){
  if(!activeProduct)return;
  const name=document.getElementById("buyerName").value.trim(), phone=document.getElementById("buyerPhone").value.trim(), qty=cleanNumber(document.getElementById("buyerQuantity").value||1);
  if(!name||!phone)return alert("Please enter your name and phone number.");
  const amount=effectivePrice(activeProduct)*qty, ref=`TIMZY-CAT-${Date.now()}`;
  if(!amount)return alert("This product does not have a valid price.");
  try{
    const res=await fetch(PAYMENT_PROXY_URL,{method:"POST",body:JSON.stringify({orderId:ref,amount,payer_name:name,phone,product:`${activeProduct.name} x${qty}`})});
    const data=await res.json(); if(!data.success)return alert(data.message||"Payment failed.");
    await addDoc(collection(db,"publicCatalogOrders"),{orderReference:ref,customerName:name,phone,productId:activeProduct.id,productName:activeProduct.name,category:activeProduct.category,productType:document.getElementById("orderType").value,quantity:qty,unitPrice:effectivePrice(activeProduct),totalAmount:amount,selectedSize:document.getElementById("buyerSize")?.value||"",fabricLength:document.getElementById("fabricLength")?.value||"",preferredColor:document.getElementById("preferredColor")?.value||"",measurements:{shoulder:document.getElementById("mShoulder")?.value||"",chest:document.getElementById("mChest")?.value||"",waist:document.getElementById("mWaist")?.value||"",hip:document.getElementById("mHip")?.value||"",sleeve:document.getElementById("mSleeve")?.value||"",length:document.getElementById("mLength")?.value||""},styleNotes:document.getElementById("styleNotes").value,paymentStatus:"Payment Requested",orderStatus:"Pending Payment",productionStage:"Pending Payment",transactionId:data.transaction_id||"",paymentBankName:data.bank_name||"",paymentAccountName:data.account_name||"",paymentAccountNumber:data.account_number||"",checkoutStatus:data.status||"",createdAt:serverTimestamp()});
    const wa=`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello Timzy Fashion, I just created order ${ref} for ${activeProduct.name}.`)}`;
    const box=document.getElementById("paymentResult"); box.innerHTML=`<h3>Payment Details Generated</h3><div class="payment-card"><p><span>Order Ref</span><b>${ref}</b></p><p><span>Bank</span><b>${data.bank_name||"-"}</b></p><p><span>Account Name</span><b>${data.account_name||"-"}</b></p><p><span>Account Number</span><b>${data.account_number||"-"}</b></p><p><span>Amount</span><b>${money(data.amount_to_pay||amount)}</b></p></div><a class="payment-whatsapp" href="${wa}" target="_blank">Chat on WhatsApp</a>`; box.style.display="block";
  }catch(e){console.error(e); alert("Payment request error.");}
};
window.closeModal=()=>{ const m=document.getElementById("productModal"); if(m)m.style.display="none"; activeImages=[]; activeSlideIndex=0; };
window.addEventListener("click",e=>{ const m=document.getElementById("productModal"); if(e.target===m)closeModal();});
window.addEventListener("keydown",e=>{ if(e.key==="Escape")closeModal(); if(e.key==="ArrowRight")nextSlide(); if(e.key==="ArrowLeft")prevSlide();});
loadCatalog();
