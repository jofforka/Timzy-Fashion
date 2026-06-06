import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const PAYMENT_PROXY_URL = "https://script.google.com/macros/s/AKfycbwMpjON9SbRrtTTFWfR-yBZVPNwrZCnakWI797BBvvoXvlwPTEAwuCoBHnGW1krKhHn/exec";

let sales = [], inventory = [], expenses = [], catalog = [], customers = [], orders = [];
let currentRole = "public", currentUserEmail = "", activeChatOrderId = "", unsubscribeChat = null;

const money = n => "₦" + Number(n || 0).toLocaleString();

function cleanNumber(v){ return Number(String(v || "0").replace(/[₦,\s]/g,"")) || 0; }

function normalize(row){
  const obj = {};
  Object.keys(row || {}).forEach(k => obj[k.trim().toLowerCase()] = row[k]);
  return obj;
}

function driveToImage(url){
  if(!url) return "";
  const match = String(url).match(/[-\w]{25,}/);
  if(!match) return String(url).trim();
  return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w1000`;
}

function driveImages(value){
  if(!value) return [];
  return String(value).split(",").map(x => driveToImage(x.trim())).filter(Boolean);
}

async function getUserRole(email){
  try{
    const snap = await getDoc(doc(db,"users",email));
    if(snap.exists() && snap.data().role) return snap.data().role;
  }catch(e){ console.warn(e); }
  if(email === "admin@timzyfashion.com") return "admin";
  if(email.includes("staff")) return "staff";
  return "customer";
}

window.togglePublicMenu = function(){
  const m = document.getElementById("publicMenu");
  if(m) m.classList.toggle("open");
};

window.toggleAppMenu = function(){
  const m = document.getElementById("appMenu");
  if(m) m.classList.toggle("open");
};

window.selectAppMenu = function(id){
  showTab(id);
  const m = document.getElementById("appMenu");
  if(m) m.classList.remove("open");
};

window.showPublicCatalog = function(){
  document.getElementById("publicCatalog")?.scrollIntoView({behavior:"smooth"});
};

window.openLoginModal = function(){
  closeAccessModal();
  const m = document.getElementById("loginModal");
  if(m) m.style.display = "flex";
};

window.closeLoginModal = function(){
  const m = document.getElementById("loginModal");
  if(m) m.style.display = "none";
};

window.openAccessModal = function(){
  const m = document.getElementById("accessModal");
  if(m) m.style.display = "flex";
};

window.closeAccessModal = function(){
  const m = document.getElementById("accessModal");
  if(m) m.style.display = "none";
};

function hidePublicView(){
  document.getElementById("publicHeader").style.display = "none";
  document.getElementById("publicCatalog").style.display = "none";
}

function showPublicView(){
  document.getElementById("publicHeader").style.display = "block";
  document.getElementById("publicCatalog").style.display = "block";
  document.getElementById("app").style.display = "none";
}

window.loginUser = async function(){
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  try{ await signInWithEmailAndPassword(auth,email,password); }
  catch(e){ alert(e.message); console.error(e); }
};

window.logoutUser = async function(){
  if(unsubscribeChat) unsubscribeChat();
  await signOut(auth);
  currentRole = "public";
  currentUserEmail = "";
  closeLoginModal();
  closeAccessModal();
  showPublicView();
  render();
};

onAuthStateChanged(auth, async user => {
  if(user){
    currentUserEmail = user.email.toLowerCase();
    currentRole = await getUserRole(currentUserEmail);
    closeLoginModal();
    closeAccessModal();
    hidePublicView();
    document.getElementById("app").style.display = "block";
    setupRoleAccess();
    await loadFirestoreData();
    render();
  }else{
    currentRole = "public";
    currentUserEmail = "";
    showPublicView();
    render();
  }
});

function setupRoleAccess(){
  hideAllSections();

  if(currentRole === "admin"){
    showRoleSections(["dashboard","catalog","catalogManager","customerManager","sales","expenses","inventory","orders","customers","staff","forms"]);
    showStaffAdminFields(true);
    showTab("dashboard");
    return;
  }

  if(currentRole === "staff"){
    showRoleSections(["catalog","sales","expenses","orders","customers","forms"]);
    showStaffAdminFields(true);
    showTab("catalog");
    return;
  }

  showRoleSections(["catalog","customers"]);
  showStaffAdminFields(false);
  showTab("catalog");
}

function hideAllSections(){
  document.querySelectorAll(".tab").forEach(t => { t.style.display="none"; t.classList.remove("active"); });
  document.querySelectorAll("#appMenu button").forEach(b => b.style.display="none");
}

function showRoleSections(ids){
  ids.forEach(id => {
    const section = document.getElementById(id);
    const btn = document.querySelector(`#appMenu button[onclick="selectAppMenu('${id}')"]`);
    if(section) section.style.display = "";
    if(btn) btn.style.display = "inline-flex";
  });
}

function showStaffAdminFields(show){
  document.querySelectorAll(".staff-admin-only").forEach(f => f.style.display = show ? "block" : "none");
}

window.showTab = function(id){
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  window.scrollTo({top:0,behavior:"smooth"});
};

async function fetchSheet(api){
  try{
    const r = await fetch(api);
    if(!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  }catch(e){ console.error(e); return []; }
}

async function loadAllData(){
  const [salesData, invData, expData] = await Promise.all([fetchSheet(SALES_API), fetchSheet(INVENTORY_API), fetchSheet(EXPENSES_API)]);

  sales = salesData.map(row => {
    const n = normalize(row);
    const qty = cleanNumber(n["quantity sold"] || n["qty sold"] || n["quantity"] || n["qty"]);
    const unit = cleanNumber(n["unit selling price"] || n["selling price"] || n["total sales"] || n["amount"]);
    return { staff:n["staff name"]||"-", category:n["category"]||"-", product:n["product/vsku"]||n["product/sku"]||n["product name"]||n["product"]||"-", qty, amount: qty * unit || unit };
  });

  inventory = invData.map(row => {
    const n = normalize(row);
    const uploaded = driveImages(n["product image"] || n["product images"] || n["image upload"] || n["upload product image"] || n["product photo"] || n["product picture"] || n["upload product picture"] || n["image"] || "");
    return {
      category:n["category"]||"-",
      product:n["product name"]||n["product"]||n["product/sku"]||"-",
      sku:n["sku"]||n["product/sku"]||"-",
      supplier:n["supplier/vendor"]||n["supplier"]||"-",
      quantity:cleanNumber(n["quantity added"]||n["qty added"]||n["quantity"]||n["qty"]||n["stock"]||n["stock quantity"]),
      cost:cleanNumber(n["cost price"]||n["unit cost"]||n["cost"]),
      selling:cleanNumber(n["selling price"]||n["price"]||n["unit selling price"]),
      color:n["color"]||n["material color"]||"",
      sizes:n["sizes"]||"",
      image1:uploaded[0] || driveToImage(n["image url"]||n["image 1"]||n["product image url"]||""),
      image2:uploaded[1] || driveToImage(n["image url 2"]||n["image 2"]||""),
      image3:uploaded[2] || driveToImage(n["image url 3"]||n["image 3"]||""),
      description:n["description"]||n["product description"]||""
    };
  });

  expenses = expData.map(row => {
    const n = normalize(row);
    const qty = cleanNumber(n["quantity"] || n["qty"] || 1);
    const unit = cleanNumber(n["unit cost"] || n["amount"] || n["cost"]);
    return { staff:n["staff name"]||"-", category:n["category"]||"-", item:n["expense item"]||n["item"]||"-", supplier:n["supplier/vendor"]||n["supplier"]||"-", qty, unitCost:unit, total:qty*unit };
  });

  await loadCatalog();
  render();
}

async function loadCatalog(){
  try{
    const snap = await getDocs(collection(db,"catalog"));
    const firestore = snap.docs.map(d => ({ id:d.id, source:"catalog", ...d.data() }));
    const invCatalog = inventory.filter(x => x.product && x.product !== "-").map(x => ({
      id:`inventory-${x.sku || x.product}`, source:"inventory", name:x.product, category:x.category, price:x.selling, quantity:x.quantity, color:x.color, sizes:x.sizes, image1:x.image1, image2:x.image2, image3:x.image3, description:x.description
    }));
    catalog = [...firestore, ...invCatalog];
  }catch(e){
    console.error(e);
    catalog = inventory.map(x => ({ id:`inventory-${x.sku || x.product}`, name:x.product, category:x.category, price:x.selling, quantity:x.quantity, color:x.color, sizes:x.sizes, image1:x.image1, image2:x.image2, image3:x.image3, description:x.description }));
  }
}

async function loadFirestoreData(){
  if(currentRole === "public") return;
  const mq = currentRole === "customer" ? query(collection(db,"customerMeasurements"), where("email","==",currentUserEmail)) : collection(db,"customerMeasurements");
  const oq = currentRole === "customer" ? query(collection(db,"customerOrders"), where("email","==",currentUserEmail)) : collection(db,"customerOrders");

  const ms = await getDocs(mq);
  customers = ms.docs.map(d => ({id:d.id,...d.data()}));

  const os = await getDocs(oq);
  orders = os.docs.map(d => ({id:d.id,...d.data()}));
}

window.saveCatalogProduct = async function(){
  if(currentRole !== "admin") return alert("Only admin can publish products.");
  const product = {
    name:document.getElementById("catProductName").value.trim(),
    category:document.getElementById("catCategory").value.trim(),
    color:document.getElementById("catColor").value.trim(),
    price:cleanNumber(document.getElementById("catPrice").value),
    quantity:cleanNumber(document.getElementById("catQuantity").value),
    sizes:document.getElementById("catSizes").value.trim(),
    image1:driveToImage(document.getElementById("catImage1").value.trim()),
    image2:driveToImage(document.getElementById("catImage2").value.trim()),
    image3:driveToImage(document.getElementById("catImage3").value.trim()),
    description:document.getElementById("catDescription").value.trim(),
    publishedBy:currentUserEmail,
    createdAt:serverTimestamp()
  };
  if(!product.name) return alert("Product name is required.");
  await addDoc(collection(db,"catalog"), product);
  alert("Product published.");
  await loadAllData();
};

window.deleteCatalogProduct = async function(id){
  if(currentRole !== "admin") return alert("Only admin can delete.");
  if(String(id).startsWith("inventory-")) return alert("This came from Inventory. Remove from Inventory.");
  if(!confirm("Delete product?")) return;
  await deleteDoc(doc(db,"catalog",id));
  await loadAllData();
};

window.openProductDetails = function(encoded){
  const p = JSON.parse(decodeURIComponent(encoded));
  const imgs = [p.image1,p.image2,p.image3].filter(Boolean);
  const whats = `https://wa.me/2348118103510?text=${encodeURIComponent(`Hello, I want to order ${p.name}`)}`;
  document.getElementById("modalProductContent").innerHTML = `
    <h2>${p.name}</h2>
    <div class="product-gallery">${imgs.length ? imgs.map(i=>`<img src="${i}" alt="${p.name}">`).join("") : `<div class="catalog-image"><span>👗</span></div>`}</div>
    <p><strong>Category:</strong> ${p.category||"-"}</p>
    <p><strong>Color:</strong> ${p.color||"-"}</p>
    <p><strong>Sizes:</strong> ${p.sizes||"-"}</p>
    <p><strong>Price:</strong> ${money(p.price)}</p>
    <p>${p.description||"No description available."}</p>
    <div class="action-row">
      <button onclick='requestCatalogOrder(${JSON.stringify(p.name)},${JSON.stringify(p.price||"")})'>Order Now</button>
      <a class="btn success" href="${whats}" target="_blank">WhatsApp</a>
    </div>`;
  document.getElementById("productModal").style.display = "flex";
};

window.closeProductModal = function(){ document.getElementById("productModal").style.display = "none"; };

window.requestCatalogOrder = function(name, price=""){
  if(currentRole === "public") return openAccessModal();
  showTab("customers");
  document.getElementById("coStyle").value = name;
  document.getElementById("coAmount").value = price;
};

function getTargetCustomerEmail(id){
  if(currentRole === "customer") return currentUserEmail;
  const email = document.getElementById(id)?.value.trim().toLowerCase();
  if(!email){ alert("Enter customer email."); return ""; }
  return email;
}

window.submitMeasurement = async function(){
  const email = getTargetCustomerEmail("targetCustomerEmail");
  if(!email) return;
  await addDoc(collection(db,"customerMeasurements"), {
    email, uploadedBy:currentUserEmail,
    name:cmName.value, phone:cmPhone.value, shoulder:cmShoulder.value, chest:cmChest.value,
    waist:cmWaist.value, hip:cmHip.value, sleeve:cmSleeve.value, length:cmLength.value,
    notes:cmNotes.value, createdAt:serverTimestamp()
  });
  alert("Measurement saved.");
  await loadFirestoreData(); render();
};

window.submitOrder = async function(){
  const email = getTargetCustomerEmail("targetCustomerEmailOrder");
  if(!email) return;
  const paymentMethod = coPaymentMethod.value;
  let status = "Pending Payment";
  let paymentStatus = "Pending";
  if(paymentMethod === "Cash on Delivery"){ status = "COD - Awaiting Fulfillment"; paymentStatus = "Cash on Delivery"; }
  if(paymentMethod === "Bank Transfer"){ status = "Bank Transfer - Awaiting Confirmation"; paymentStatus = "Pending Confirmation"; }
  await addDoc(collection(db,"customerOrders"), {
    email, uploadedBy:currentUserEmail, customer:coName.value, phone:coPhone.value, product:coStyle.value,
    status, paymentStatus, delivery:coDelivery.value, finalAmount:cleanNumber(coAmount.value),
    paymentMethod, adminNote:"", paymentProof:"", transactionId:"", createdAt:serverTimestamp()
  });
  alert("Order submitted.");
  await loadFirestoreData(); render();
};

window.payOrder = async function(orderId, amount, customerName, phone, productName){
  try{
    if(!PAYMENT_PROXY_URL || PAYMENT_PROXY_URL.includes("https://script.google.com/macros/s/AKfycbwMpjON9SbRrtTTFWfR-yBZVPNwrZCnakWI797BBvvoXvlwPTEAwuCoBHnGW1krKhHn/exec")) return alert("Payment service is not connected.");
    const r = await fetch(PAYMENT_PROXY_URL, { method:"POST", body:JSON.stringify({ orderId, amount:Number(amount), payer_name:customerName || "Timzy Customer", phone:phone || "", product:productName || "Timzy Fashion Order" }) });
    const data = await r.json();
    if(!data.success) return alert(data.message || "Payment request failed.");

    alert(`Payment Account:\n\nBank: ${data.bank_name}\nAccount Name: ${data.account_name}\nAccount Number: ${data.account_number}\nAmount: ₦${Number(data.amount_to_pay || amount).toLocaleString()}`);

    await updateDoc(doc(db,"customerOrders",orderId), {
      transactionId:data.transaction_id || "", paymentStatus:"Payment Requested", status:"Pending Payment",
      paymentAccountNumber:data.account_number||"", paymentBankName:data.bank_name||"", paymentAccountName:data.account_name||"", updatedAt:serverTimestamp()
    });
    await loadFirestoreData(); render();
  }catch(e){ console.error(e); alert("Payment request error."); }
};

window.submitPaymentProof = async function(orderId){
  const proof = prompt("Enter payment receipt/reference number:");
  if(!proof) return;
  await updateDoc(doc(db,"customerOrders",orderId), {
    paymentProof:proof, paymentStatus:"Proof Submitted", status:"Payment Under Review", updatedAt:serverTimestamp()
  });
  await loadFirestoreData(); render();
};

window.verifyPayment = async function(orderId){
  if(currentRole !== "admin") return alert("Only admin can verify payment.");
  const note = prompt("Payment verification note:", "Payment confirmed.");
  await updateDoc(doc(db,"customerOrders",orderId), {
    paymentStatus:"Paid", status:"Paid - Awaiting Fulfillment", adminNote:note || "Payment confirmed.", verifiedBy:currentUserEmail, verifiedAt:serverTimestamp()
  });
  await loadFirestoreData(); render();
};

window.rejectPayment = async function(orderId){
  if(currentRole !== "admin") return alert("Only admin can reject payment proof.");
  const note = prompt("Reason payment proof was rejected:");
  if(!note) return;
  await updateDoc(doc(db,"customerOrders",orderId), {
    paymentStatus:"Payment Rejected", status:"Pending Payment", adminNote:note, updatedAt:serverTimestamp()
  });
  await loadFirestoreData(); render();
};

window.approveFulfillment = async id => { await updateOrderAdmin(id,"In Production","Order moved to production."); };
window.markReady = async id => { await updateOrderAdmin(id,"Ready for Pickup/Delivery","Order is ready."); };
window.markDelivered = async id => { await updateOrderAdmin(id,"Delivered","Order delivered."); };
window.cancelOrder = async id => {
  const note = prompt("Cancellation reason:");
  if(!note) return;
  await updateOrderAdmin(id,"Cancelled",note);
};

async function updateOrderAdmin(id,status,note){
  if(currentRole !== "admin") return alert("Only admin.");
  await updateDoc(doc(db,"customerOrders",id), { status, adminNote:note, updatedAt:serverTimestamp() });
  await loadFirestoreData(); render();
}

window.openOrderChat = function(orderId){
  activeChatOrderId = orderId;
  if(chatBox) chatBox.style.display="block";
  if(customerChatBox) customerChatBox.style.display="block";
  if(unsubscribeChat) unsubscribeChat();
  const q = query(collection(db,"orderChats"), where("orderId","==",orderId));
  unsubscribeChat = onSnapshot(q, snap => {
    const msgs = snap.docs.map(d=>d.data()).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
    const html = msgs.map(m => `<div class="chat-message ${m.senderEmail===currentUserEmail?"mine":"theirs"}"><strong>${m.senderRole}:</strong> ${m.message}</div>`).join("") || "<p>No messages yet.</p>";
    if(chatMessages) chatMessages.innerHTML = html;
    if(customerChatMessages) customerChatMessages.innerHTML = html;
  });
};

window.sendChatMessage = async function(){
  const input = customerChatInput?.value.trim() ? customerChatInput : chatInput;
  if(!activeChatOrderId) return alert("Open chat first.");
  if(!input?.value.trim()) return;
  await addDoc(collection(db,"orderChats"), { orderId:activeChatOrderId, senderEmail:currentUserEmail, senderRole:currentRole, message:input.value.trim(), createdAt:serverTimestamp() });
  input.value = "";
};

function dashboardStats(){
  const totalSalesAmount = sales.reduce((s,x)=>s+Number(x.amount||0),0);
  const totalExpensesAmount = expenses.reduce((s,x)=>s+Number(x.total||0),0);
  const inventoryValueAmount = inventory.reduce((s,x)=>s+Number((x.quantity||0)*(x.cost||0)),0);
  return { totalSalesAmount, totalExpensesAmount, netProfitAmount:totalSalesAmount-totalExpensesAmount, inventoryValueAmount, lowStockCount:inventory.filter(x=>Number(x.quantity||0)<=5).length };
}

function orderStatusCounts(){
  return {
    pending:orders.filter(o=>String(o.status||"").toLowerCase().includes("pending")).length,
    paid:orders.filter(o=>String(o.paymentStatus||"").toLowerCase()==="paid").length,
    delivered:orders.filter(o=>String(o.status||"").toLowerCase().includes("delivered")).length
  };
}

function drawBarChart(id, labels, values){
  const c = document.getElementById(id); if(!c) return;
  c.innerHTML = "<canvas></canvas>";
  const canvas = c.querySelector("canvas"), ctx = canvas.getContext("2d");
  const w = c.clientWidth || 380, h = 240, pad = 36;
  canvas.width = w; canvas.height = h;
  const max = Math.max(...values,1), bw = Math.max(30,(w-pad*2)/values.length-20);
  values.forEach((v,i)=>{
    const bh = (v/max)*(h-90), x = pad+i*(bw+20), y = h-50-bh;
    const g = ctx.createLinearGradient(0,y,0,y+bh); g.addColorStop(0,"#D4AF37"); g.addColorStop(1,"#7c5cff");
    ctx.fillStyle = g; ctx.fillRect(x,y,bw,bh);
    ctx.fillStyle = "#fff"; ctx.font = "12px Arial"; ctx.fillText(labels[i],x,h-24);
    ctx.fillStyle = "#aaa"; ctx.fillText(Number(v).toLocaleString(),x,y-8);
  });
}

function renderDashboardCharts(){
  const s = dashboardStats(), o = orderStatusCounts();
  drawBarChart("financeChart",["Sales","Expenses","Profit"],[s.totalSalesAmount,s.totalExpensesAmount,Math.max(s.netProfitAmount,0)]);
  drawBarChart("orderStatusChart",["Pending","Paid","Delivered"],[o.pending,o.paid,o.delivered]);
  drawBarChart("inventoryHealthChart",["Value","Low"],[s.inventoryValueAmount,s.lowStockCount]);
  const xp = staffXP().slice(0,5);
  drawBarChart("staffPerformanceChart",xp.length?xp.map(x=>x.name.slice(0,8)):["No XP"],xp.length?xp.map(x=>x.points):[0]);
}

function renderDashboardInsights(){
  const s = dashboardStats(), o = orderStatusCounts();
  financeInsight && (financeInsight.textContent = s.netProfitAmount >= 0 ? "Business is profitable based on captured data." : "Expenses exceed sales.");
  orderInsight && (orderInsight.textContent = `${o.pending} pending, ${o.paid} paid, ${o.delivered} delivered.`);
  inventoryInsight && (inventoryInsight.textContent = s.lowStockCount ? `${s.lowStockCount} low-stock item(s).` : "Inventory is stable.");
  const top = staffXP()[0];
  staffInsight && (staffInsight.textContent = top ? `${top.name} leads with ${top.points} XP.` : "No XP activity yet.");
}

function renderActivityPanels(){
  recentActivity && (recentActivity.innerHTML = orders.slice(0,5).map(o=>`<div class="list-item"><b>${o.customer||"Customer"}</b><span>${o.product||"Order"} — ${o.status||"Pending"}</span></div>`).join("") || "<p>No activity yet.</p>");
  criticalAlerts && (criticalAlerts.innerHTML = inventory.filter(i=>Number(i.quantity||0)<=5).slice(0,5).map(i=>`<div class="list-item danger"><b>${i.product}</b><span>Low stock: ${i.quantity}</span></div>`).join("") || "<p>No alerts.</p>");
}

function staffXP(){
  const xp = {};
  sales.forEach(x=>{ if(x.staff && x.staff!=="-") xp[x.staff]=(xp[x.staff]||0)+10; });
  orders.forEach(x=>{ if(x.uploadedBy && x.status==="Delivered") xp[x.uploadedBy]=(xp[x.uploadedBy]||0)+15; });
  return Object.entries(xp).map(([name,points])=>({name,points})).sort((a,b)=>b.points-a.points);
}

function statusClass(status=""){
  const v = status.toLowerCase();
  if(v.includes("paid") || v.includes("delivered") || v.includes("ready") || v.includes("production")) return "status-approved";
  if(v.includes("rejected") || v.includes("cancelled")) return "status-rejected";
  return "status-pending";
}

function renderCatalog(targetId, searchId, categoryId){
  const grid = document.getElementById(targetId); if(!grid) return;
  const s = document.getElementById(searchId)?.value.toLowerCase() || "";
  const cat = document.getElementById(categoryId)?.value || "";
  const filtered = catalog.filter(i => String(i.name||"").toLowerCase().includes(s) && (!cat || String(i.category||"")===cat));
  grid.innerHTML = filtered.length ? filtered.map(item => {
    const p = { id:item.id,name:item.name,category:item.category,price:item.price,quantity:item.quantity,color:item.color,sizes:item.sizes,image1:item.image1,image2:item.image2,image3:item.image3,description:item.description };
    const enc = encodeURIComponent(JSON.stringify(p));
    const whats = `https://wa.me/2348118103510?text=${encodeURIComponent(`Hello, I want to order ${item.name}`)}`;
    return `<div class="product-card">
      <div class="product-image">${item.image1?`<img src="${item.image1}" alt="${item.name}">`:`<span>👗</span>`}</div>
      <div class="product-info">
        <p class="tag">${item.category||"-"}</p>
        <h3>${item.name}</h3>
        <strong>${money(item.price)}</strong>
        <div class="action-row">
          <button onclick='openProductDetails("${enc}")'>View</button>
          <a class="btn success" href="${whats}" target="_blank">WhatsApp</a>
        </div>
        ${currentRole==="admin" && !String(item.id).startsWith("inventory-") ? `<button class="danger-btn" onclick="deleteCatalogProduct('${item.id}')">Delete</button>` : ""}
      </div>
    </div>`;
  }).join("") : `<p class="note">No products found.</p>`;
}

window.render = function(){
  renderCatalog("catalogGrid","catalogSearch","catalogCategoryFilter");
  renderCatalog("privateCatalogGrid","privateCatalogSearch","privateCatalogCategoryFilter");

  const s = dashboardStats();
  totalSales && (totalSales.textContent = money(s.totalSalesAmount));
  totalExpenses && (totalExpenses.textContent = money(s.totalExpensesAmount));
  netProfit && (netProfit.textContent = money(s.netProfitAmount));
  inventoryValue && (inventoryValue.textContent = money(s.inventoryValueAmount));
  lowStock && (lowStock.textContent = s.lowStockCount);

  salesTable && (salesTable.innerHTML = sales.map(x=>`<tr><td>${x.staff}</td><td>${x.category}</td><td>${x.product}</td><td>${x.qty}</td><td>${money(x.amount)}</td></tr>`).join(""));
  expensesTable && (expensesTable.innerHTML = expenses.map(x=>`<tr><td>${x.staff}</td><td>${x.category}</td><td>${x.item}</td><td>${x.supplier}</td><td>${x.qty}</td><td>${money(x.unitCost)}</td><td>${money(x.total)}</td></tr>`).join(""));
  inventoryTable && (inventoryTable.innerHTML = inventory.map(x=>`<tr><td>${x.category}</td><td>${x.product}</td><td>${x.sku}</td><td>${x.supplier}</td><td>${x.quantity}</td><td>${money(x.cost)}</td><td>${money(x.selling)}</td></tr>`).join(""));

  const rows = orders.length ? orders.map(x=>`<tr>
    <td>${x.customer||"-"}</td><td>${x.phone||"-"}</td><td>${x.product||"-"}</td>
    <td class="${statusClass(x.status)}">${x.status||"-"}</td><td>${x.paymentStatus||"Pending"}</td>
    <td>${x.delivery||"-"}</td><td>${money(x.finalAmount||0)}</td><td>${x.paymentMethod||"-"}</td>
    <td>${x.paymentProof||"-"}</td><td>${x.adminNote||"-"}</td>
    <td class="table-actions">
      ${x.paymentMethod==="Online Payment" && String(x.paymentStatus||"").toLowerCase()!=="paid" ? `<button onclick="payOrder('${x.id}','${x.finalAmount||0}','${x.customer||""}','${x.phone||""}','${x.product||""}')">Pay</button>` : ""}
      ${String(x.paymentStatus||"").toLowerCase() !== "paid" ? `<button onclick="submitPaymentProof('${x.id}')">Proof</button>` : ""}
      ${currentRole==="admin" ? `<button onclick="verifyPayment('${x.id}')">Verify</button><button onclick="rejectPayment('${x.id}')">Reject Pay</button><button onclick="approveFulfillment('${x.id}')">Production</button><button onclick="markReady('${x.id}')">Ready</button><button onclick="markDelivered('${x.id}')">Delivered</button><button class="danger-btn" onclick="cancelOrder('${x.id}')">Cancel</button>` : ""}
      <button onclick="openOrderChat('${x.id}')">Chat</button>
    </td></tr>`).join("") : `<tr><td colspan="11">No orders found.</td></tr>`;

  ordersTable && (ordersTable.innerHTML = rows);
  customerOrdersTable && (customerOrdersTable.innerHTML = rows);

  customersTable && (customersTable.innerHTML = customers.length ? customers.map(x=>`<tr><td>${x.name||"-"}</td><td>${x.phone||"-"}</td><td>Shoulder: ${x.shoulder||"-"}<br>Chest: ${x.chest||"-"}<br>Waist: ${x.waist||"-"}<br>Hip: ${x.hip||"-"}<br>Sleeve: ${x.sleeve||"-"}<br>Length: ${x.length||"-"}</td><td>${x.notes||"-"}</td></tr>`).join("") : `<tr><td colspan="4">No measurements found.</td></tr>`);

  leaderboard && (leaderboard.innerHTML = staffXP().map((x,i)=>`<div class="list-item"><b>#${i+1} ${x.name}</b><span>${x.points} XP</span></div>`).join("") || "<p>No XP yet.</p>");

  formLinks && (formLinks.innerHTML = (window.TIMZY_FORMS||[]).map(f=>`<div class="glass-card"><h3>${f.name}</h3><p>${f.description}</p><a class="btn" href="${f.url}" target="_blank">Open</a></div>`).join(""));

  renderDashboardCharts(); renderDashboardInsights(); renderActivityPanels();
};

loadAllData();
