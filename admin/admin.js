(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const cfg = window.TIMZY_CONFIG || {};
  const fb = window.TIMZY_FIREBASE;
  const placement = window.TimzyProductPlacement;
  let editorTrigger = null;
  const collections = cfg.collections || {
    products: "products",
    orders: "orders",
    sales: "sales",
    expenses: "expenses",
    settings: "settings"
  };

  const state = {
    role: null,
    uid: null,
    session: 0,
    products: [],
    sales: [],
    expenses: [],
    expenseRequests: [],
    restockRequests: [],
    settings: {},
    editingId: null,
    images: [],
    pendingFiles: [],
    replaceAll: false,
    view: "dashboard"
  };

  const money = value => `${cfg.currency || "₦"}${Number(value || 0).toLocaleString()}`;
  const slugify = value => String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const escapeHTML = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function toast(message) {
    const el = $("#adminToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function withDeadline(promise, milliseconds, message) {
    let timer;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
    ]).finally(() => clearTimeout(timer));
  }

  function requireFirebase() {
    if (!fb?.auth || !fb?.db) {
      $("#loginMessage").textContent = "Firebase Authentication or Firestore is unavailable. Check the SDK and configuration.";
      return false;
    }
    return true;
  }

  function timestampValue(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (value.seconds) return value.seconds * 1000;
    return Date.parse(value) || 0;
  }

  function imageOf(product) {
    const image = product.images?.[0] || product.image1 || "assets/img/hero-senator-grey.jpg";
    return image.startsWith("assets/") ? "../" + image : image;
  }

  function instagramEmbed(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "");
      if (host !== "instagram.com") return "";
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (!["p", "reel", "tv"].includes(parts[0]) || !parts[1]) return "";
      return `https://www.instagram.com/${parts[0]}/${parts[1]}/embed/captioned/`;
    } catch {
      return "";
    }
  }

  const OWNER_UID = "sCkXSrVIlHNGBoufFtirvLBvaTi1";

  function showApp(user) {
    $("#adminLogin").hidden = true;
    $("#adminApp").hidden = false;
    document.body.dataset.role = state.role;
    document.querySelectorAll('[data-admin-only]').forEach(el => el.hidden = state.role !== 'admin');
    document.querySelectorAll('[data-operations-only]').forEach(el => el.hidden = state.role === 'investor');
    document.querySelectorAll('[data-investor-only]').forEach(el => el.hidden = state.role !== 'investor');
    $("#currentRole").textContent = state.role === 'admin' ? 'Super Admin' : state.role === 'staff' ? 'Shop Staff' : 'Investor';
    switchView(state.role === 'investor' ? 'portfolio' : 'dashboard');
    if (state.role !== 'investor') loadAll().catch(() => toast("Could not load records. Check your connection and account access."));
  }

  function showLogin() {
    $("#adminApp").hidden = true;
    $("#adminLogin").hidden = false;
    state.role = null;
    state.uid = null;
    state.products = []; state.sales = []; state.expenses = []; state.settings = {};
    $("#productModal").hidden = true;
    document.body.classList.remove('editor-open');
    $("#productForm").reset(); $("#settingsForm").reset();
    for (const id of ['statProducts','statPublished','statSales','statExpenses']) document.getElementById(id).textContent = '0';
    for (const id of ['productTable','latestProducts','recentActivity','salesList','expensesList','portfolioItems','accountList','allocationList']) {
      const el = document.getElementById(id); if (el) el.replaceChildren();
    }
  }

  async function loadAll() {
    const session = state.session;
    await Promise.all([
      loadProducts(),
      loadRecords("sales"),
      ...(state.role === 'admin' ? [loadRecords("expenses"), loadSettings()] : []),
      loadOperationsRequests()
    ]);
    if (session === state.session) renderAll();
  }

  async function loadProducts() {
    const session = state.session;
    const source = fb.db.collection(collections.products);
    const snapshot = await (state.role === 'admin' ? source : source.where('status','in',['Published','Out of Stock'])).get();
    if (session !== state.session) return;

    // An empty live catalogue stays empty; bundled examples are never imported.

    state.products = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => timestampValue(b.updatedAt) - timestampValue(a.updatedAt));
    await Promise.all(state.products.filter(p => window.TimzyFabric.isMaterial(p)).map(async product => {
      try { const profile = await fb.db.collection('fabricProfiles').doc(product.id).get();
        if (session === state.session) {product.fabricProfile = profile.exists ? profile.data() : {}; product.profileUnavailable = false;}
      } catch { if (session === state.session) {product.fabricProfile = {}; product.profileUnavailable = true;} }
    }));
  }

  async function loadRecords(type) {
    const session = state.session;
    const collection = collections[type];
    const source = fb.db.collection(collection);
    const records = state.role === 'staff' ? source.where('createdBy','==',state.uid) : source;
    try {
      const snapshot = await records.orderBy("date", "desc").limit(100).get();
      if (session !== state.session) return;
      state[type] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch {
      if (session !== state.session) return;
      const snapshot = await records.limit(100).get();
      if (session !== state.session) return;
      state[type] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  }

  async function loadSettings() {
    const session = state.session;
    const doc = await fb.db.collection(collections.settings).doc("store").get();
    if (session !== state.session) return;
    state.settings = doc.exists ? doc.data() : {};
    const publicDoc = await fb.db.collection("publicSettings").doc("contact").get();
    if (session !== state.session) return;
    state.publicContact = publicDoc.exists ? publicDoc.data() : {};
  }


  async function loadOperationsRequests() {
    const session = state.session;
    const scoped = source => state.role === 'staff' ? source.where('createdBy','==',state.uid) : source;
    const [expenses,restocks] = await Promise.allSettled([
      scoped(fb.db.collection('expenseRequests')).limit(100).get(),
      scoped(fb.db.collection('restockRequests')).limit(100).get()
    ]);
    if (session !== state.session) return;
    state.expenseRequests = expenses.status === 'fulfilled' ? expenses.value.docs.map(d=>({id:d.id,...d.data()})) : [];
    state.restockRequests = restocks.status === 'fulfilled' ? restocks.value.docs.map(d=>({id:d.id,...d.data()})) : [];
    for (const [name,result] of [['expenseRequests',expenses],['restockRequests',restocks]]) {
      if (result.status === 'rejected') {
        console.error('Timzy Firestore read failed:',name,result.reason);
        toast('Could not load '+name+' ('+(result.reason?.code || 'unknown')+'). Check deployed Firebase rules.');
      }
    }
  }
  function renderOperations() {
    const approved = state.expenseRequests.filter(x=>x.status==='approved').reduce((a,x)=>a+Number(x.amount||0),0);
    const legacy = state.role==='admin' ? state.expenses.reduce((a,x)=>a+Number(x.amount||0),0) : 0;
    const today = new Date().toLocaleDateString('en-CA');
    const todaySales = state.sales.filter(x=>x.date===today).reduce((a,x)=>a+Number(x.amount||0),0);
    const todayExpenses = state.expenseRequests.filter(x=>x.date===today && x.status==='approved').reduce((a,x)=>a+Number(x.amount||0),0) +
      (state.role==='admin' ? state.expenses.filter(x=>x.date===today).reduce((a,x)=>a+Number(x.amount||0),0) : 0);
    $('#dailyShopSummary').textContent = 'Today ('+today+'): recorded sales '+money(todaySales)+' · approved expenses '+money(todayExpenses)+
      ' · difference '+money(todaySales-todayExpenses)+'. This is not net profit; records are limited to the latest 100 per source'+
      (state.role==='staff' ? ' and your own submissions.' : '.') ;
    $('#expenseSummary').textContent = 'Approved expenses in loaded records: '+money(approved+legacy)+
      ' · Awaiting approval: '+state.expenseRequests.filter(x=>x.status==='pending').length;
    $('#expensesList').innerHTML = state.expenseRequests.slice().sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0))
      .map(x=>'<div class="record-item"><div><b>'+escapeHTML(x.date)+'</b><small>'+escapeHTML(x.description)+
        '</small></div><strong>'+money(x.amount)+' · '+escapeHTML(x.status)+'</strong>'+
        (state.role==='admin' && x.status==='pending' ? '<button type="button" data-expense-review="'+escapeHTML(x.id)+'" data-decision="approved">Approve</button>'+
        '<button type="button" data-expense-review="'+escapeHTML(x.id)+'" data-decision="rejected">Reject</button>' : '')+'</div>').join('')+
      (state.role==='admin' ? state.expenses.map(x=>'<div class="record-item"><b>Legacy expense · '+escapeHTML(x.date)+'</b> '+escapeHTML(x.description)+' · '+money(x.amount)+'</div>').join('') : '');
    $('#restockProduct').innerHTML = state.products.map(p=>'<option value="'+escapeHTML(p.id)+'">'+escapeHTML(p.name)+'</option>').join('');
    $('#restockList').innerHTML = state.restockRequests.map(x=>'<div class="record-item"><div><b>'+escapeHTML(x.productName)+
      '</b><small>'+escapeHTML(x.note)+'</small></div><strong>'+escapeHTML(x.status)+'</strong>'+
      (state.role==='admin' && x.status==='pending' ? '<button type="button" data-restock-review="'+escapeHTML(x.id)+'" data-decision="resolved">Mark resolved</button>'+
      '<button type="button" data-restock-review="'+escapeHTML(x.id)+'" data-decision="dismissed">Dismiss</button>' : '')+'</div>').join('') || '<p>No restock requests.</p>';
  }
  async function submitRestock(event) {
    event.preventDefault();
    if (state.role!=='staff') return;
    const d=Object.fromEntries(new FormData(event.currentTarget));
    const product=state.products.find(p=>p.id===d.productId);
    if (!product || !d.note.trim()) return toast('Choose a product and enter a reason.');
    await fb.db.collection('restockRequests').add({productId:product.id,productName:product.name,note:d.note.trim(),
      status:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:state.uid});
    event.currentTarget.reset();
    $('#restockMessage').textContent='Restock request submitted for administrator review.';
    await loadOperationsRequests();renderOperations();
  }
  async function reviewRequest(collection,id,decision) {
    if (state.role!=='admin') return;
    const record=collection==='expenseRequests' ? state.expenseRequests.find(x=>x.id===id) : state.restockRequests.find(x=>x.id===id);
    if (!record || record.status!=='pending') return;
    if (!confirm('Confirm '+decision+' for this request?')) return;
    await fb.db.collection(collection).doc(id).update({status:decision,reviewedAt:firebase.firestore.FieldValue.serverTimestamp(),reviewedBy:state.uid});
    await loadOperationsRequests();renderOperations();
  }

  function renderAll() {
    renderStats();
    renderProducts();
    renderLatestProducts();
    renderActivity();
    renderRecords("sales");
    renderRecords("expenses");
    renderSettings();
    renderCategoryFilter();
    renderOperations();
  }

  function renderStats() {
    $("#statProducts").textContent = state.products.length;
    $("#statPublished").textContent = state.products.filter(p => String(p.status).toLowerCase() === "published").length;
    $("#salesStatLabel").textContent = state.role === 'staff' ? 'Your recorded sales (up to 100 records)' : 'Recorded sales (up to 100 records)';
    $("#statSales").textContent = money(state.sales.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    $("#statExpenses").textContent = money(state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0) + state.expenseRequests.filter(x=>x.status==="approved").reduce((sum,x)=>sum+Number(x.amount||0),0));
  }

  function renderCategoryFilter() {
    const select = $("#productFilter");
    const current = select.value;
    const section = $("#productSectionFilter")?.value || "All";
    const categories = [...new Set(state.products.filter(p => section === 'All' || placement.sectionOf(p) === section).map(p => p.category).filter(Boolean))].sort();
    select.innerHTML = `<option value="All">All categories</option>${categories.map(c => `<option>${escapeHTML(c)}</option>`).join("")}`;
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function filteredProducts() {
    const search = $("#productSearch")?.value.trim().toLowerCase() || "";
    const category = $("#productFilter")?.value || "All";
    const section = $("#productSectionFilter")?.value || "All";
    return state.products.filter(product => {
      const matchesSearch = !search || JSON.stringify(product).toLowerCase().includes(search);
      const matchesCategory = category === "All" || product.category === category;
      return matchesSearch && matchesCategory && (section === "All" || placement.sectionOf(product) === section);
    });
  }

  function renderProducts() {
    const root = $("#productTable");
    if (!root) return;
    const rows = filteredProducts();

    root.innerHTML = rows.length ? rows.map(product => `
      <article class="product-row">
        <img src="${escapeHTML(imageOf(product))}" alt="${escapeHTML(product.name)}" onerror="this.src='../assets/img/hero-senator-grey.jpg'">
        <div>
          <h3>${escapeHTML(product.name || "Untitled Product")}</h3>
          <p>${escapeHTML(product.sku || product.id)}</p>
          <small>Stock: ${Number.isSafeInteger(product.stockOnHand) ? product.stockOnHand + ' units' : 'Not recorded'}${Array.isArray(product.variants) && product.variants.length ? ' · Variants: ' + product.variants.map(v=>escapeHTML(v.color||'')+': '+(Number.isSafeInteger(v.stockOnHand)?v.stockOnHand:'not recorded')).join(', ') : ''}</small>
          ${product.instagramVideoUrl ? `<small>Instagram video linked</small>` : ""}
        </div>
        <div class="hide-tablet">
          <small>${escapeHTML(placement.labels[placement.sectionOf(product)])}</small>
          <b>${escapeHTML(product.category || "—")}</b>
        </div>
        <div class="hide-tablet">
          <small>Price</small>
          <b>${product.price == null ? "Unconfirmed" : money(product.salePrice > 0 ? product.salePrice : product.price)}</b>
        </div>
        <div class="hide-tablet">
          <span class="status-pill">${escapeHTML(product.status || "Published")}</span>
        </div>
        <div class="row-actions" ${state.role !== "admin" ? "hidden" : ""}>
          <button type="button" data-edit-product="${escapeHTML(product.id)}">Edit</button>
          <button type="button" data-duplicate-product="${escapeHTML(product.id)}">Duplicate</button>
        </div>
      </article>
    `).join("") : `<div class="admin-card empty-state"><h2>No products found</h2><p>Add your first product or adjust the filters.</p></div>`;
  }

  function renderLatestProducts() {
    const root = $("#latestProducts");
    root.innerHTML = state.products.slice(0, 5).map(product => `
      <div class="compact-item">
        <img src="${escapeHTML(imageOf(product))}" alt="${escapeHTML(product.name)}" onerror="this.src='../assets/img/hero-senator-grey.jpg'">
        <div><b>${escapeHTML(product.name)}</b><small>${escapeHTML(product.category || "Collection")}</small></div>
        <strong>${product.price == null ? "Unconfirmed" : money(product.salePrice > 0 ? product.salePrice : product.price)}</strong>
      </div>
    `).join("") || `<p>No products yet.</p>`;
  }

  function renderActivity() {
    const rows = [
      ...state.sales.map(x => ({ ...x, type: "Sale" })),
      ...state.expenses.map(x => ({ ...x, type: "Expense" }))
    ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 6);

    $("#recentActivity").innerHTML = rows.map(row => `
      <div class="record-item">
        <div><b>${escapeHTML(row.type)}</b><small>${escapeHTML(row.date || "")}</small></div>
        <div>${escapeHTML(row.description || "")}</div>
        <strong>${money(row.amount)}</strong>
      </div>
    `).join("") || `<p>No activity yet.</p>`;
  }

  function renderRecords(type) {
    const root = $(`#${type}List`);
    if (!root) return;
    root.innerHTML = state[type].map(row => `
      <div class="record-item">
        <div><b>${escapeHTML(row.date || "")}</b></div>
        <div>${escapeHTML(row.description || "")}</div>
        <strong>${money(row.amount)}</strong>
      </div>
    `).join("") || `<p>No ${type} recorded yet.</p>`;
  }

  function renderSettings() {
    const form = $("#settingsForm");
    if (!form) return;
    const publicForm = $("#publicContactForm");
    if (publicForm) for (const [key, value] of Object.entries(state.publicContact || {})) {
      if (publicForm.elements[key]) publicForm.elements[key].value = value ?? "";
    }
    for (const [key, value] of Object.entries(state.settings)) {
      if (form.elements[key]) form.elements[key].value = value ?? "";
    }
  }

  function switchView(view) {
    const allowed = state.role === 'admin' ? ['dashboard','products','orders','sales','expenses','restock','settings','accounts','allocations'] : state.role === 'staff' ? ['dashboard','products','orders','sales','expenses','restock'] : ['portfolio'];
    if (!allowed.includes(view)) return;
    state.view = view;
    if (view === 'accounts' || view === 'allocations') window.TimzyRoles?.loadAccounts().catch(error => toast(error.message));
    $$(".admin-view").forEach(section => section.hidden = section.id !== `${view}View`);
    $$("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    $("#viewTitle").textContent = view.charAt(0).toUpperCase() + view.slice(1);
    $(".sidebar")?.classList.remove("open");
  }

  function populateMaterialOptions(selected = "") {
    const select = $("#productForm")?.elements?.materialProductId;
    if (!select) return;
    const fabrics = state.products.filter(p =>
      /^(fabrics?|materials?)$/i.test(String(p.category || "")) &&
      !["draft", "hidden", "deleted"].includes(String(p.status || "").toLowerCase())
    );
    select.innerHTML = '<option value="">Not linked yet</option>' +
      fabrics.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} · ${escapeHTML(p.color || "Colour unspecified")}</option>`).join("");
    select.value = selected;
  }

  function syncPlacement(section, category = '', type = '') {
    const form = $("#productForm");
    const data = placement.normalize(section, category, type);
    form.elements.storeSection.value = section;
    const categories = [...placement.groups[section]];
    if (!categories.includes(data.category)) categories.push(data.category);
    form.elements.category.innerHTML = categories.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
    form.elements.category.value = data.category;
    const types = section === 'outfits' ? [['Ready-Made','Ready-made'],['Custom Sewing','Made to measure / custom sewing']] : [[data.productType,section === 'materials' ? 'Fabric / Material' : 'Accessory']];
    form.elements.productType.innerHTML = types.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
    form.elements.productType.value = data.productType;
    $("#fabricProfileFields").hidden = section !== "materials";
    form.elements.price.required = section !== "materials";
    form.elements.sizes.required = section !== "materials";
    $("#productTypeCaption").textContent = section === 'outfits' ? 'Outfit type' : 'Product type';
    form.elements.measurementRequired.checked = data.productType === 'Custom Sewing';
    $("#productPlacementHint").textContent = section === 'accessories' ? 'Appears in accessory suggestions, outside the two main shop tabs.' : `Appears in the ${placement.labels[section]} tab.`;
    $("#materialLinkField").hidden = section !== 'outfits';
    if (section !== 'outfits') form.elements.materialProductId.value = '';
    if (data.productType === 'Custom Sewing' && !form.elements.sizes.value.trim()) form.elements.sizes.value = 'Custom';
    if (data.productType !== 'Custom Sewing' && form.elements.sizes.value === 'Custom') form.elements.sizes.value = '';
  }

  function revealEditor() {
    editorTrigger = document.activeElement;
    $("#productModal").hidden = false;
    document.body.classList.add('editor-open');
    $(".editor-grid").scrollTop = 0;
    $("#productStoreSection").focus();
  }

  function resetEditor() {
    state.editingId = null;
    state.images = [];
    if ($("#productForm")?.elements?.variantsJson) $("#productForm").elements.variantsJson.value = "[]";
    state.pendingFiles = [];
    state.replaceAll = false;
    $("#productForm").reset();
    $("#productForm").elements.variantsJson.value = "[]";
    $("#productForm").elements.status.value = "Published";
    $("#productForm").elements.sizes.value = "";
    populateMaterialOptions();
    syncPlacement('outfits', 'Senator', 'Ready-Made');
    $("#productModalTitle").textContent = "Add Product";
    $("#deleteProductBtn").hidden = true;
    $("#uploadProgress").hidden = true;
    renderImagePreviews();
  }

  function openNewProduct() {
    if (state.role !== "admin") return;
    resetEditor();
    revealEditor();
  }

  function openEditProduct(id) {
    if (state.role !== "admin") return;
    const product = state.products.find(p => p.id === id);
    if (!product) return;

    resetEditor();
    state.editingId = id;
    if ($("#productForm")?.elements?.variantsJson) $("#productForm").elements.variantsJson.value = JSON.stringify(product.variants || [], null, 2);
    state.images = Array.isArray(product.images) && product.images.length
      ? [...product.images]
      : [product.image1, product.image2, product.image3, product.image4].filter(Boolean);

    const form = $("#productForm");
    const profile = window.TimzyFabric.profile(product);
    for (const key of [...Object.keys(window.TimzyFabric.fields), 'videoUrl']) form.elements['fabric_'+key].value = profile[key];
    Array.from(form.elements.fabric_occasions.options).forEach(option => {option.selected = profile.occasions.includes(option.value);});
    const fields = [
      "id", "name", "sku", "category", "productType", "price", "salePrice",
      "fabricType", "materialProductId", "color", "sizes", "deliveryEstimate", "status", "badge",
      "description", "tags", "instagramVideoUrl"
    ];
    fields.forEach(field => {
      if (form.elements[field]) form.elements[field].value = Array.isArray(product[field]) ? product[field].join(", ") : product[field] ?? "";
    });
    syncPlacement(placement.sectionOf(product), product.category, product.productType);
    form.elements.id.value = id;
    form.elements.featured.checked = Boolean(product.featured);
    form.elements.measurementRequired.checked = Boolean(product.measurementRequired);

    $("#productModalTitle").textContent = "Edit Product";
    $("#deleteProductBtn").hidden = false;
    renderImagePreviews();
    revealEditor();
  }

  function closeEditor() {
    $("#productModal").hidden = true;
    document.body.classList.remove('editor-open');
    resetEditor();
    editorTrigger?.focus?.();
  }

  function renderImagePreviews() {
    const root = $("#imagePreviewGrid");
    const current = state.images.map((url, index) => ({ type: "saved", url, index }));
    const pending = state.pendingFiles.map((file, index) => ({ type: "pending", url: URL.createObjectURL(file), index }));

    const all = state.replaceAll ? pending : [...current, ...pending];

    root.innerHTML = all.length ? all.map((item, visualIndex) => `
      <div class="image-tile">
        <img src="${escapeHTML(item.url.startsWith("assets/") ? "../" + item.url : item.url)}" alt="Product image">
        ${visualIndex === 0 ? `<span class="cover-badge">Cover</span>` : ""}
        <button type="button" data-remove-image="${item.type}:${item.index}">×</button>
      </div>
    `).join("") : `<div class="empty-state"><p>No product images selected.</p></div>`;
  }

  function handleImageFiles(files) {
    const valid = [...files].filter(file => file.type.startsWith("image/"));
    if (!valid.length) return toast("Please choose image files.");
    state.pendingFiles.push(...valid);
    renderImagePreviews();
  }

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || "");
        resolve(value.includes(",") ? value.split(",")[1] : value);
      };
      reader.onerror = () => reject(reader.error || new Error("The image could not be read."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadPendingImages(productId) {
    if (!state.pendingFiles.length) return [];

    const endpoint = String(state.settings.googleDriveUploadUrl || cfg.googleDriveUploadUrl || "").trim();
    const uploadToken = String(state.settings.googleDriveUploadToken || cfg.googleDriveUploadToken || "").trim();

    if (!endpoint) {
      throw new Error("Google Drive upload is not configured. Add the deployed Apps Script URL to googleDriveUploadUrl in assets/js/config.js.");
    }

    const progress = $("#uploadProgress");
    const bar = $("span", progress);
    progress.hidden = false;
    bar.style.width = "0%";

    const urls = [];

    for (let index = 0; index < state.pendingFiles.length; index += 1) {
      const file = state.pendingFiles[index];
      const base64 = await fileToBase64(file);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "uploadProductImage",
          token: uploadToken,
          productId,
          category: $("#productForm").elements.category.value || "Products",
          fileName: file.name,
          mimeType: file.type,
          base64
        })
      });

      if (!response.ok) {
        throw new Error(`Google Drive upload failed with status ${response.status}.`);
      }

      const result = await response.json();

      if (!result.ok || !result.url) {
        throw new Error(result.error || "Google Drive did not return an image URL.");
      }

      urls.push(result.url);
      bar.style.width = `${Math.round(((index + 1) / state.pendingFiles.length) * 100)}%`;
    }

    return urls;
  }

  function formProductData() {
    const form = $("#productForm");
    const data = Object.fromEntries(new FormData(form).entries());

    return {
      name: data.name.trim(),
      sku: data.sku.trim(),
      ...placement.normalize(data.storeSection, data.category, data.productType),
      price: data.price.trim() === "" ? null : Number(data.price),
      salePrice: data.salePrice.trim() === "" ? null : Number(data.salePrice),
      fabricType: data.fabricType.trim(),
      materialProductId: String(data.materialProductId || "").trim(),
      color: data.color.trim(),
      sizes: data.sizes.trim() || (data.storeSection === "outfits" ? "Custom" : ""),
      deliveryEstimate: data.deliveryEstimate.trim() || "7–14 business days after confirmation",
      status: data.status,
      badge: data.badge,
      description: data.description.trim(),
      tags: data.tags.trim(),
      instagramVideoUrl: data.instagramVideoUrl.trim(),
      featured: form.elements.featured.checked,
      measurementRequired: form.elements.measurementRequired.checked,
      fabricProfile: (() => {
        const profile = {};
        for (const key of Object.keys(window.TimzyFabric.fields)) { profile[key] = String(data['fabric_'+key] || '').trim().slice(0,400); }
        const video = String(data.fabric_videoUrl || '').trim();
        if(video && !window.TimzyFabric.safeVideo(video)) throw Error('Use a direct HTTPS MP4 or WebM video URL.');
        profile.videoUrl = window.TimzyFabric.safeVideo(video);
        profile.occasions = Array.from(form.elements.fabric_occasions.selectedOptions).map(option=>option.value);
        return profile;
      })(),
      variants: (() => { const raw = form.elements.variantsJson?.value?.trim(); if (!raw) return []; const list = JSON.parse(raw); if (!Array.isArray(list) || list.length > 8) throw Error("Enter up to 8 color variants."); if(new Set(list.map(v=>String(v?.color||"").trim().toLowerCase())).size!==list.length) throw Error("Color names must be unique."); return list.map(v => { if (!v || !String(v.color || "").trim()) throw Error("Each variant needs a color."); const stock = v.stockOnHand == null || v.stockOnHand === "" ? null : Number(v.stockOnHand); if (stock !== null && (!Number.isSafeInteger(stock) || stock < 0)) throw Error("Stock must be a nonnegative integer."); if(v.sizes != null && (!Array.isArray(v.sizes) || v.sizes.length>40 || v.sizes.some(s=>typeof s!=="string" || s.includes("~")))) throw Error("Enter up to 40 size / selling unit labels per color."); const price = v.price == null || v.price === "" ? null : Number(v.price); if (price !== null && (!Number.isFinite(price) || price < 0)) throw Error("Price must be nonnegative."); const image=String(v.image || "").trim(); if(image && !/^(https:\/\/|assets\/img\/)/i.test(image)) throw Error("Use an HTTPS image URL or an assets/img path."); return {...(v.id ? {id:String(v.id)} : {}),color:String(v.color).trim(),image,stockOnHand:stock,price,sizes:Array.isArray(v.sizes)?v.sizes.map(String).map(x=>x.trim()).filter(Boolean):[]}; }); })(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function saveProduct(event) {
    if (state.role !== "admin") { event?.preventDefault?.(); return; }
    event.preventDefault();
    let product;
    try { product = formProductData(); } catch (error) { return toast(error.message || "Invalid variants."); }
    if (state.editingId && placement.sectionOf(product) === 'materials' && state.products.find(p=>p.id===state.editingId)?.profileUnavailable) return toast('Fabric details could not load. Reload before saving to preserve existing details.');
    if (product.productType === 'Ready-Made' && (!$("#productForm").elements.sizes.value.trim() || product.sizes.toLowerCase() === 'custom')) {
      return toast('Enter the ready-made sizes you actually stock, or choose made to measure.');
    }
    if (!product.name || !product.category || product.price !== null && (!Number.isFinite(product.price) || product.price < 0)) {
      return toast("Complete the required product fields.");
    }

    if (product.materialProductId) {
      const match = state.products.find(p => p.id === product.materialProductId);
      if (!match || !/^(fabrics?|materials?)$/i.test(String(match.category || "")) ||
          ["draft", "hidden", "deleted"].includes(String(match.status || "").toLowerCase())) {
        return toast("Choose a published material product before linking this outfit.");
      }
    }

    const productId = state.editingId || slugify(product.name) || `product-${Date.now()}`;
    const uploadedFileNames = state.pendingFiles.map(file => file.name);
    const newUrls = await uploadPendingImages(productId);
    if (product.variants.length && newUrls.length) {
      const normalizeName = value => slugify(String(value || "").replace(/\.[^.]+$/, ""));
      product.variants = product.variants.map(variant => {
        const color = slugify(variant.color);
        const index = uploadedFileNames.findIndex(name => { const stem = normalizeName(name); return stem === color || stem === `${productId}--${color}` || stem.endsWith(`--${color}`); });
        return index >= 0 ? { ...variant, image: newUrls[index] } : variant;
      });
    }
    const images = state.replaceAll ? newUrls : [...state.images, ...newUrls];

    product.images = images;
    product.image1 = images[0] || "";
    product.image2 = images[1] || "";
    product.image3 = images[2] || "";
    product.image4 = images[3] || "";
    product.createdAt = state.editingId
      ? state.products.find(p => p.id === state.editingId)?.createdAt || firebase.firestore.FieldValue.serverTimestamp()
      : firebase.firestore.FieldValue.serverTimestamp();

    const {fabricProfile, ...productDocument} = product;
    const batch = fb.db.batch();
    batch.set(fb.db.collection(collections.products).doc(productId), productDocument, { merge: true });
    if (placement.sectionOf(product) === 'materials') batch.set(fb.db.collection('fabricProfiles').doc(productId), fabricProfile);
    await batch.commit();
    toast(state.editingId ? "Product updated." : "Product created.");
    closeEditor();
    await loadProducts();
    renderAll();
  }

  async function deleteProduct() {
    if (state.role !== "admin") return;
    if (!state.editingId) return;
    const product = state.products.find(p => p.id === state.editingId);
    if (!confirm(`Archive "${product?.name || "this product"}" as a draft?`)) return;

    await fb.db.collection(collections.products).doc(state.editingId).update({status: "Draft", updatedAt: firebase.firestore.FieldValue.serverTimestamp()});
    toast("Product archived as a draft.");
    closeEditor();
    await loadProducts();
    renderAll();
  }

  async function duplicateProduct(id) {
    if (state.role !== "admin") return;
    const product = state.products.find(p => p.id === id);
    if (!product) return;
    const copyId = `${id}-copy-${Date.now().toString().slice(-5)}`;
    const copy = {
      ...product,
      name: `${product.name} Copy`,
      sku: `${product.sku || id}-COPY`,
      status: "Draft",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    delete copy.id;
    delete copy.stockOnHand;
    copy.quantity = "Verify availability before publishing";
    delete copy.fabricProfile;
    delete copy.profileUnavailable;
    await fb.db.collection(collections.products).doc(copyId).set(copy);
    toast("Product duplicated.");
    await loadProducts();
    renderAll();
  }

  async function submitRecord(type, event) {
    event.preventDefault();
    if (!['admin','staff'].includes(state.role)) return;
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (!data.description.trim() || !Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0 || Number(data.amount) > 1000000000) {
      return toast("Enter a description and a positive amount up to ₦1,000,000,000.");
    }
    const form = event.currentTarget;
    const targetCollection = type === "expenses" ? "expenseRequests" : collections[type];
    try {
      await fb.db.collection(targetCollection).add({
        description: data.description.trim(),
        amount: Number(data.amount || 0),
        date: data.date,
        createdBy: state.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ...(type === "expenses" ? {status:"pending"} : {})
      });
    } catch (error) {
      console.error('Timzy Firestore create failed:',targetCollection,error);
      toast(error.code === 'permission-denied'
        ? 'Permission denied writing '+targetCollection+'. Check published Firebase rules and account access.'
        : 'Could not save '+type+': '+(error.code || 'unknown error'));
      return;
    }
    form.reset();
    initDates();
    toast(type === "sales" ? "Sale recorded." : "Expense submitted for approval.");
    if (type === "expenses") await loadOperationsRequests(); else await loadRecords(type);
    renderStats();
    renderRecords(type);
    renderActivity();
    renderOperations();
  }

  async function saveSettings(event) {
    if (state.role !== "admin") { event?.preventDefault?.(); return; }
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    await fb.db.collection(collections.settings).doc("store").set({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    state.settings = data;
    toast("Settings saved.");
  }

  async function savePublicContact(event) {
    event.preventDefault();
    if (state.role !== "admin") return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    for (const [key,value] of Object.entries(data)) data[key] = value.trim();
    for (const key of ["mapsUrl","instagramUrl","facebookUrl","tiktokUrl"]) {
      if (data[key] && (!/^https:\/\//i.test(data[key]) || !/^https:$/.test(new URL(data[key]).protocol))) throw new Error(key+" must use HTTPS.");
    }
    await fb.db.collection("publicSettings").doc("contact").set({...data,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    state.publicContact = data;
    toast("Public contact information saved.");
  }

  function previewInstagram() {
    const url = $("#productForm").elements.instagramVideoUrl.value.trim();
    const embed = instagramEmbed(url);
    if (!embed) return toast("Enter a valid Instagram post or Reel URL.");
    $("#adminInstagramFrame").src = embed;
    $("#videoPreviewModal").hidden = false;
  }

  function bindEvents() {
    $("#resetPasswordBtn").addEventListener("click", async () => {
      if (!requireFirebase()) return;
      const email = $("#adminLoginForm").elements.email;
      if (!email.value.trim() || !email.reportValidity()) return;
      try {
        await fb.auth.sendPasswordResetEmail(email.value.trim());
        $("#loginMessage").textContent = "If this email has an account, a password setup link has been requested. Check your inbox and spam folder.";
      } catch {
        $("#loginMessage").textContent = "Could not request a password link. Check your connection and try again later.";
      }
    });
    $("#adminLoginForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!requireFirebase()) return;
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      $("#loginMessage").textContent = "Signing in...";
      try {
        await withDeadline(fb.auth.signInWithEmailAndPassword(data.email, data.password), 15000, "Sign-in timed out. Check your connection and Firebase Authentication settings, then try again.");
        // Do not clear the authorization error set by onAuthStateChanged.
        // Firebase sign-in success does not imply a valid active access/{uid} role.
      } catch (error) {
        $("#loginMessage").textContent = error.message;
      }
    });

    $("#logoutBtn").addEventListener("click", () => fb.auth.signOut());
    $("#mobileSidebarBtn").addEventListener("click", () => $(".sidebar").classList.toggle("open"));

    document.addEventListener("click", event => {
      const viewButton = event.target.closest("[data-view]");
      if (viewButton) switchView(viewButton.dataset.view);

      const edit = event.target.closest("[data-edit-product]");
      if (edit) openEditProduct(edit.dataset.editProduct);

      const duplicate = event.target.closest("[data-duplicate-product]");
      if (duplicate) duplicateProduct(duplicate.dataset.duplicateProduct);

      const remove = event.target.closest("[data-remove-image]");
      if (remove) {
        const [type, indexValue] = remove.dataset.removeImage.split(":");
        const index = Number(indexValue);
        if (type === "saved") state.images.splice(index, 1);
        if (type === "pending") state.pendingFiles.splice(index, 1);
        renderImagePreviews();
      }

      if (event.target.closest("[data-close-video]")) {
        $("#videoPreviewModal").hidden = true;
        $("#adminInstagramFrame").src = "";
      }
    });

    $("#quickAddProduct").addEventListener("click", openNewProduct);
    $("#addProductBtn").addEventListener("click", openNewProduct);
    $("#closeProductModal").addEventListener("click", closeEditor);
    $("#cancelProductBtn").addEventListener("click", closeEditor);
    $("#seedFabricDrafts")?.addEventListener("click", async () => {
      if (state.role !== "admin") return;
      const button = $("#seedFabricDrafts");
      button.disabled = true;
      try {
        const response = await fetch("../data/material-variants.draft.json", {cache:"no-store"});
        if (!response.ok) throw Error("Could not load material catalogue.");
        const {products} = await response.json();
        const collection = fb.db.collection(collections.products);
        const current = await collection.get();
        const conflicts = current.docs.filter(doc => products.some(p => p.id !== doc.id &&
          (String(doc.data().name || "").toLowerCase() === p.name.toLowerCase() || doc.data().sku === p.sku)));
        if (conflicts.length) throw Error("A matching fabric already exists under another ID. Edit that product to avoid duplicates.");
        await fb.db.runTransaction(async transaction => {
          const refs = products.map(p => collection.doc(p.id));
          const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
          snapshots.forEach((snapshot, i) => {
            if (snapshot.exists) return; // Never overwrite merchant data or existing images.
            const {id, ...product} = products[i];
            product.variants = product.variants.map(({imageStatus, ...variant}) => variant);
            transaction.set(refs[i], {...product,
              createdAt:firebase.firestore.FieldValue.serverTimestamp(),
              updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
          });
        });
        await loadProducts(); renderAll();
        toast("Missing fabric drafts prepared with all 14 images. Existing products preserved.");
      } catch (error) { toast(error.message || "Could not prepare fabrics."); }
      finally { button.disabled = false; }
    });
    $("#productForm").addEventListener("submit", event => saveProduct(event).catch(error => toast(error.message)));
    $("#loadFabricPreset")?.addEventListener("click", () => {
      const id = $("#fabricPreset")?.value;
      if (!id) return toast("Choose a material preset.");
      if (state.editingId && !confirm("Replace this product's color list with the prepared draft?")) return;
      fetch("../data/material-variants.draft.json", {cache:"no-store"}).then(response => {
        if (!response.ok) throw Error("Could not load material catalogue.");
        return response.json();
      }).then(({products}) => {
        const preset = products.find(p => p.id === id);
        if (!preset) throw Error("Material preset not found.");
        const form = $("#productForm");
        syncPlacement("materials");
        form.elements.name.value = preset.name;
        form.elements.sku.value = id;
        form.elements.status.value = "Draft";
        form.elements.price.value = ""; form.elements.salePrice.value = "";
        form.elements.sizes.value = "";
        form.elements.variantsJson.value = JSON.stringify(preset.variants.map(({imageStatus,...v}) => v),null,2);
        state.images = [...preset.images]; renderImagePreviews();
        toast("Prepared images loaded. Confirm commercial values before publishing.");
      }).catch(error => toast(error.message));
    });
    $("#deleteProductBtn").addEventListener("click", () => deleteProduct().catch(error => toast(error.message)));
    $("#imageUploadInput").addEventListener("change", event => handleImageFiles(event.target.files));
    $("#replaceAllImages").addEventListener("click", () => {
      state.replaceAll = true;
      state.images = [];
      renderImagePreviews();
      toast("New uploads will replace all current images.");
    });
    $("#clearImages").addEventListener("click", () => {
      state.images = [];
      state.pendingFiles = [];
      state.replaceAll = true;
      renderImagePreviews();
    });
    $("#previewInstagramBtn").addEventListener("click", previewInstagram);
    $("#productSectionFilter").addEventListener("change", () => { renderCategoryFilter(); renderProducts(); });
    $("#productStoreSection").addEventListener("change", event => { $("#productForm").elements.sizes.value = ''; syncPlacement(event.target.value); });
    $("#productForm").elements.productType.addEventListener("change", event => syncPlacement($("#productForm").elements.storeSection.value, $("#productForm").elements.category.value, event.target.value));
    document.addEventListener('keydown', event => {
      if ($("#productModal").hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeEditor(); }
      if (event.key === 'Tab') {
        const controls = $$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])', $("#productModal")).filter(el => el.offsetParent !== null);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    $("#productSearch").addEventListener("input", renderProducts);
    $("#productFilter").addEventListener("change", renderProducts);
    $("#saleForm").addEventListener("submit", event => submitRecord("sales", event).catch(error => toast(error.message)));
    $("#expenseForm").addEventListener("submit", event => submitRecord("expenses", event).catch(error => toast(error.message)));
    $("#restockForm").addEventListener("submit", event => submitRestock(event).catch(error => toast(error.message)));
    document.addEventListener("click",event=>{const e=event.target.closest("[data-expense-review]");const r=event.target.closest("[data-restock-review]");if(e)reviewRequest("expenseRequests",e.dataset.expenseReview,e.dataset.decision).catch(x=>toast(x.message));if(r)reviewRequest("restockRequests",r.dataset.restockReview,r.dataset.decision).catch(x=>toast(x.message));});
    $("#settingsForm").addEventListener("submit", event => saveSettings(event).catch(error => toast(error.message)));
    $("#publicContactForm").addEventListener("submit", event => savePublicContact(event).catch(error => toast(error.message)));
  }

  function initDates() {
    const today = new Date().toISOString().slice(0, 10);
    $("#saleForm").elements.date.value = today;
    $("#expenseForm").elements.date.value = today;
  }

  function init() {
    bindEvents();
    initDates();

    if (!requireFirebase()) return;

    // All portals use the same authenticated identity; UI visibility is not authorization.
    fb.auth.onAuthStateChanged(async user => {
      const session = ++state.session;
      showLogin();
      if (!user) return;
      state.uid = user.uid;
      try {
        if (user.uid === OWNER_UID) state.role = 'admin';
        else {
          const profile = await withDeadline(fb.db.collection('access').doc(user.uid).get({source: 'server'}), 12000, 'Signed in, but investor permissions could not be verified. Check Firestore connectivity and rules, then try again.');
          if (session !== state.session) return;
          const data = profile.exists ? profile.data() : {};
          if (data.active !== true || !['staff','investor'].includes(data.role)) throw Error('Your account has not been granted active shop access. Contact the administrator.');
          state.role = data.role;
        }
        if (session !== state.session) return;
        $('#loginMessage').textContent = '';
        showApp(user);
        if (state.role === 'investor') await window.TimzyRoles.loadPortfolio(user.uid);
      } catch (error) {
        if (session !== state.session) return;
        showLogin();
        $('#loginMessage').textContent = error.message;
        console.warn("Timzy account authorization failed:", error.code || error.name || "access-check");
      }
    });
  }

  window.TimzyAdmin = {state, escapeHTML, money, toast, imageOf};
  document.addEventListener("DOMContentLoaded", init);
})();
