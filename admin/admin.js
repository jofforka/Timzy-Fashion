(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const cfg = window.TIMZY_CONFIG || {};
  const fb = window.TIMZY_FIREBASE;
  const collections = cfg.collections || {
    products: "products",
    orders: "orders",
    sales: "sales",
    expenses: "expenses",
    settings: "settings"
  };

  const state = {
    products: [],
    sales: [],
    expenses: [],
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
    return product.images?.[0] || product.image1 || "../assets/img/hero-senator-grey.jpg";
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

  function showApp(user) {
    $("#adminLogin").hidden = true;
    $("#adminApp").hidden = false;
    loadAll();
  }

  function showLogin() {
    $("#adminApp").hidden = true;
    $("#adminLogin").hidden = false;
  }

  async function loadAll() {
    await Promise.all([
      loadProducts(),
      loadRecords("sales"),
      loadRecords("expenses"),
      loadSettings()
    ]);
    renderAll();
  }

  async function loadProducts() {
    let snapshot = await fb.db.collection(collections.products).get();

    if (snapshot.empty) {
      try {
        const response = await fetch("../data/products.json", { cache: "no-store" });
        const seedProducts = await response.json();

        if (Array.isArray(seedProducts) && seedProducts.length) {
          const batches = [];
          let batch = fb.db.batch();
          let count = 0;

          for (const raw of seedProducts) {
            const id = raw.id || slugify(raw.name) || `product-${Date.now()}-${count}`;
            const images = Array.isArray(raw.images) && raw.images.length
              ? raw.images
              : [raw.image1, raw.image2, raw.image3, raw.image4].filter(Boolean);

            const doc = {
              ...raw,
              images,
              image1: images[0] || "",
              image2: images[1] || "",
              image3: images[2] || "",
              image4: images[3] || "",
              instagramVideoUrl: raw.instagramVideoUrl || raw.videoUrl || "",
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            batch.set(fb.db.collection(collections.products).doc(id), doc);
            count += 1;

            if (count % 400 === 0) {
              batches.push(batch.commit());
              batch = fb.db.batch();
            }
          }

          batches.push(batch.commit());
          await Promise.all(batches);
          snapshot = await fb.db.collection(collections.products).get();
          toast("Existing products imported into the admin.");
        }
      } catch (error) {
        console.warn("Initial product import failed:", error);
      }
    }

    state.products = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => timestampValue(b.updatedAt) - timestampValue(a.updatedAt));
  }

  async function loadRecords(type) {
    const collection = collections[type];
    try {
      const snapshot = await fb.db.collection(collection).orderBy("date", "desc").limit(100).get();
      state[type] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch {
      const snapshot = await fb.db.collection(collection).limit(100).get();
      state[type] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  }

  async function loadSettings() {
    const doc = await fb.db.collection(collections.settings).doc("store").get();
    state.settings = doc.exists ? doc.data() : {};
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
  }

  function renderStats() {
    $("#statProducts").textContent = state.products.length;
    $("#statPublished").textContent = state.products.filter(p => String(p.status).toLowerCase() === "published").length;
    $("#statSales").textContent = money(state.sales.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    $("#statExpenses").textContent = money(state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  }

  function renderCategoryFilter() {
    const select = $("#productFilter");
    const current = select.value;
    const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))].sort();
    select.innerHTML = `<option value="All">All categories</option>${categories.map(c => `<option>${escapeHTML(c)}</option>`).join("")}`;
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function filteredProducts() {
    const search = $("#productSearch")?.value.trim().toLowerCase() || "";
    const category = $("#productFilter")?.value || "All";
    return state.products.filter(product => {
      const matchesSearch = !search || JSON.stringify(product).toLowerCase().includes(search);
      const matchesCategory = category === "All" || product.category === category;
      return matchesSearch && matchesCategory;
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
          ${product.instagramVideoUrl ? `<small>Instagram video linked</small>` : ""}
        </div>
        <div class="hide-tablet">
          <small>Category</small>
          <b>${escapeHTML(product.category || "—")}</b>
        </div>
        <div class="hide-tablet">
          <small>Price</small>
          <b>${money(product.salePrice > 0 ? product.salePrice : product.price)}</b>
        </div>
        <div class="hide-tablet">
          <span class="status-pill">${escapeHTML(product.status || "Published")}</span>
        </div>
        <div class="row-actions">
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
        <strong>${money(product.salePrice > 0 ? product.salePrice : product.price)}</strong>
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
    for (const [key, value] of Object.entries(state.settings)) {
      if (form.elements[key]) form.elements[key].value = value ?? "";
    }
  }

  function switchView(view) {
    state.view = view;
    $$(".admin-view").forEach(section => section.hidden = section.id !== `${view}View`);
    $$("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === view));
    $("#viewTitle").textContent = view.charAt(0).toUpperCase() + view.slice(1);
    $(".sidebar")?.classList.remove("open");
  }

  function resetEditor() {
    state.editingId = null;
    state.images = [];
    state.pendingFiles = [];
    state.replaceAll = false;
    $("#productForm").reset();
    $("#productForm").elements.status.value = "Published";
    $("#productForm").elements.sizes.value = "Custom";
    $("#productModalTitle").textContent = "Add Product";
    $("#deleteProductBtn").hidden = true;
    $("#uploadProgress").hidden = true;
    renderImagePreviews();
  }

  function openNewProduct() {
    resetEditor();
    $("#productModal").hidden = false;
  }

  function openEditProduct(id) {
    const product = state.products.find(p => p.id === id);
    if (!product) return;

    resetEditor();
    state.editingId = id;
    state.images = Array.isArray(product.images) && product.images.length
      ? [...product.images]
      : [product.image1, product.image2, product.image3, product.image4].filter(Boolean);

    const form = $("#productForm");
    const fields = [
      "id", "name", "sku", "category", "productType", "price", "salePrice",
      "fabricType", "color", "sizes", "deliveryEstimate", "status", "badge",
      "description", "tags", "instagramVideoUrl"
    ];
    fields.forEach(field => {
      if (form.elements[field]) form.elements[field].value = product[field] ?? "";
    });
    form.elements.id.value = id;
    form.elements.featured.checked = Boolean(product.featured);
    form.elements.measurementRequired.checked = Boolean(product.measurementRequired);

    $("#productModalTitle").textContent = "Edit Product";
    $("#deleteProductBtn").hidden = false;
    renderImagePreviews();
    $("#productModal").hidden = false;
  }

  function closeEditor() {
    $("#productModal").hidden = true;
    resetEditor();
  }

  function renderImagePreviews() {
    const root = $("#imagePreviewGrid");
    const current = state.images.map((url, index) => ({ type: "saved", url, index }));
    const pending = state.pendingFiles.map((file, index) => ({ type: "pending", url: URL.createObjectURL(file), index }));

    const all = state.replaceAll ? pending : [...current, ...pending];

    root.innerHTML = all.length ? all.map((item, visualIndex) => `
      <div class="image-tile">
        <img src="${escapeHTML(item.url)}" alt="Product image">
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
      category: data.category,
      productType: data.productType.trim(),
      price: Number(data.price || 0),
      salePrice: Number(data.salePrice || 0),
      fabricType: data.fabricType.trim(),
      color: data.color.trim(),
      sizes: data.sizes.trim() || "Custom",
      deliveryEstimate: data.deliveryEstimate.trim() || "7–14 business days after confirmation",
      status: data.status,
      badge: data.badge,
      description: data.description.trim(),
      tags: data.tags.trim(),
      instagramVideoUrl: data.instagramVideoUrl.trim(),
      featured: form.elements.featured.checked,
      measurementRequired: form.elements.measurementRequired.checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function saveProduct(event) {
    event.preventDefault();
    const product = formProductData();
    if (!product.name || !product.category || product.price < 0) {
      return toast("Complete the required product fields.");
    }

    const productId = state.editingId || slugify(product.name) || `product-${Date.now()}`;
    const newUrls = await uploadPendingImages(productId);
    const images = state.replaceAll ? newUrls : [...state.images, ...newUrls];

    product.images = images;
    product.image1 = images[0] || "";
    product.image2 = images[1] || "";
    product.image3 = images[2] || "";
    product.image4 = images[3] || "";
    product.createdAt = state.editingId
      ? state.products.find(p => p.id === state.editingId)?.createdAt || firebase.firestore.FieldValue.serverTimestamp()
      : firebase.firestore.FieldValue.serverTimestamp();

    await fb.db.collection(collections.products).doc(productId).set(product, { merge: true });
    toast(state.editingId ? "Product updated." : "Product created.");
    closeEditor();
    await loadProducts();
    renderAll();
  }

  async function deleteProduct() {
    if (!state.editingId) return;
    const product = state.products.find(p => p.id === state.editingId);
    if (!confirm(`Delete "${product?.name || "this product"}"?`)) return;

    await fb.db.collection(collections.products).doc(state.editingId).delete();
    toast("Product deleted.");
    closeEditor();
    await loadProducts();
    renderAll();
  }

  async function duplicateProduct(id) {
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
    await fb.db.collection(collections.products).doc(copyId).set(copy);
    toast("Product duplicated.");
    await loadProducts();
    renderAll();
  }

  async function submitRecord(type, event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    await fb.db.collection(collections[type]).add({
      description: data.description.trim(),
      amount: Number(data.amount || 0),
      date: data.date,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    event.currentTarget.reset();
    toast(`${type === "sales" ? "Sale" : "Expense"} added.`);
    await loadRecords(type);
    renderStats();
    renderRecords(type);
    renderActivity();
  }

  async function saveSettings(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    await fb.db.collection(collections.settings).doc("store").set({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    state.settings = data;
    toast("Settings saved.");
  }

  function previewInstagram() {
    const url = $("#productForm").elements.instagramVideoUrl.value.trim();
    const embed = instagramEmbed(url);
    if (!embed) return toast("Enter a valid Instagram post or Reel URL.");
    $("#adminInstagramFrame").src = embed;
    $("#videoPreviewModal").hidden = false;
  }

  function bindEvents() {
    $("#adminLoginForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!requireFirebase()) return;
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      $("#loginMessage").textContent = "Signing in...";
      try {
        await fb.auth.signInWithEmailAndPassword(data.email, data.password);
        $("#loginMessage").textContent = "";
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
    $("#productForm").addEventListener("submit", saveProduct);
    $("#deleteProductBtn").addEventListener("click", deleteProduct);
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
    $("#productSearch").addEventListener("input", renderProducts);
    $("#productFilter").addEventListener("change", renderProducts);
    $("#saleForm").addEventListener("submit", event => submitRecord("sales", event));
    $("#expenseForm").addEventListener("submit", event => submitRecord("expenses", event));
    $("#settingsForm").addEventListener("submit", saveSettings);
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

    fb.auth.onAuthStateChanged(user => {
      if (user) showApp(user);
      else showLogin();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
