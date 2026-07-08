from pathlib import Path

app_js = r'''/*!
 * Timzy Fashion Boutique — Production Application Engine
 * File: assets/js/app.js
 * Version: 6.1.0
 *
 * Purpose:
 * One-file JavaScript engine for Timzy Fashion Boutique.
 * Includes:
 * - Core app initialization
 * - Config + feature flags
 * - Navigation
 * - Mobile menu
 * - Toast notifications
 * - Shopping bag/cart
 * - Wishlist
 * - Catalog rendering/search/filter/sort
 * - Product gallery + zoom
 * - Build Your Look engine
 * - Checkout flow
 * - Payment abstraction
 * - WhatsApp order summary
 * - Admin helpers
 * - Sales/expenses/reports storage helpers
 * - Firebase-safe integration hooks
 * - Future-ready modules disabled by feature flags
 */

(() => {
  "use strict";

  /* ==========================================================
     TIMZY APP OBJECT
  ========================================================== */

  const Timzy = {
    version: "6.1.0",

    keys: {
      cart: "timzy.v6.cart",
      wishlist: "timzy.v6.wishlist",
      products: "timzy.v6.products",
      orders: "timzy.v6.orders",
      sales: "timzy.v6.sales",
      expenses: "timzy.v6.expenses",
      settings: "timzy.v6.settings",
      customer: "timzy.v6.customer",
      recentlyViewed: "timzy.v6.recentlyViewed",
      activity: "timzy.v6.activity"
    },

    defaults: {
      whatsapp: "2340000000000",
      currency: "NGN",
      currencySymbol: "₦",
      fallbackImage: "assets/images/backgrounds/placeholder-product.jpg",
      productDataUrl: "data/products.json",
      businessName: "Timzy Fashion",
      businessTagline: "Dress the Complete Gentleman",
      pickupAddress: "Timzy Fashion Studio, Abuja",
      paymentGatewayUrl: "",
      paystackPublicKey: "",
      productFormUrl: "",
      productSheetUrl: ""
    },

    flags: {
      wishlist: true,
      buildLook: true,
      checkout: true,
      payments: true,
      whatsapp: true,
      admin: true,
      firebase: true,
      analytics: false,
      customerAccount: false,
      loyalty: false,
      promoCodes: false,
      giftCards: false,
      aiStylist: false,
      notifications: true,
      appointments: true
    },

    state: {
      products: [],
      activeCategory: "All",
      activeSort: "featured",
      searchTerm: "",
      currentProduct: null,
      galleryIndex: 0,
      initialized: false
    }
  };

  window.Timzy = Timzy;

  /* ==========================================================
     UTILITIES
  ========================================================== */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const cfg = () => ({
    ...Timzy.defaults,
    ...(window.TIMZY_CONFIG || {})
  });

  const safeText = value => String(value ?? "").trim();

  const escapeHtml = value => safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const slugify = value => safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const moneyNum = value => Number(String(value || 0).replace(/[^0-9.-]/g, "")) || 0;

  const formatMoney = value => {
    const symbol = cfg().currencySymbol || "₦";
    return `${symbol}${moneyNum(value).toLocaleString()}`;
  };

  const nowISO = () => new Date().toISOString();

  const generateRef = (prefix = "TF") => `${prefix}-${Date.now().toString().slice(-8)}`;

  const isAdminPath = () => location.pathname.includes("/admin/");
  const isLoginPage = () => location.pathname.endsWith("login.html");
  const currentPage = () => (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const debounce = (fn, delay = 250) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const throttle = (fn, limit = 150) => {
    let waiting = false;
    return (...args) => {
      if (waiting) return;
      fn(...args);
      waiting = true;
      setTimeout(() => waiting = false, limit);
    };
  };

  const storage = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (error) {
        Timzy.core.error("Storage read failed", error);
        return fallback;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        Timzy.core.error("Storage write failed", error);
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        Timzy.core.error("Storage remove failed", error);
      }
    }
  };

  /* ==========================================================
     CORE
  ========================================================== */

  Timzy.core = {
    init() {
      if (Timzy.state.initialized) return;
      Timzy.state.initialized = true;

      Timzy.core.applyConfigLinks();
      Timzy.ui.init();
      Timzy.analytics.pageView();

      Timzy.products.load().then(() => {
        Timzy.catalog.init();
        Timzy.product.init();
        Timzy.checkout.init();
        Timzy.admin.init();
        Timzy.featured.init();
      });

      Timzy.cart.init();
      Timzy.wishlist.init();
      Timzy.future.init();

      document.dispatchEvent(new CustomEvent("timzy:ready", { detail: { version: Timzy.version } }));
    },

    error(message, error) {
      console.error(`[Timzy] ${message}`, error || "");
      if (Timzy.flags.notifications) {
        Timzy.toast.show("Something went wrong. Please try again.", "error");
      }
    },

    applyConfigLinks() {
      $$("[data-form-link]").forEach(link => link.href = cfg().productFormUrl || "#");
      $$("[data-sheet-link]").forEach(link => link.href = cfg().productSheetUrl || "#");
      $$("[data-whatsapp-link]").forEach(link => {
        const number = Timzy.whatsapp.number();
        link.href = `https://wa.me/${number}`;
      });

      const year = $("#year");
      if (year) year.textContent = String(new Date().getFullYear());
    },

    page() {
      return currentPage();
    }
  };

  /* ==========================================================
     UI / NAVIGATION / ANIMATIONS
  ========================================================== */

  Timzy.ui = {
    init() {
      Timzy.ui.mobileMenu();
      Timzy.ui.activeLinks();
      Timzy.ui.stickyHeader();
      Timzy.ui.bottomNav();
      Timzy.ui.revealOnScroll();
      Timzy.ui.escapeToClose();
    },

    mobileMenu() {
      const toggles = $$(".mobile-menu, .nav-toggle");
      const links = $(".nav-links");

      toggles.forEach(btn => {
        btn.addEventListener("click", () => {
          links?.classList.toggle("open");
          document.body.classList.toggle("menu-open");
        });
      });

      $$(".nav-links a").forEach(link => {
        link.addEventListener("click", () => {
          links?.classList.remove("open");
          document.body.classList.remove("menu-open");
        });
      });
    },

    activeLinks() {
      const page = currentPage();
      $$("a[href]").forEach(anchor => {
        const href = anchor.getAttribute("href") || "";
        const hrefPage = href.split("#")[0].split("?")[0].split("/").pop();
        if (hrefPage && hrefPage === page) anchor.classList.add("active");
      });
    },

    stickyHeader() {
      const header = $(".site-header, .topbar");
      if (!header) return;

      const onScroll = throttle(() => {
        header.classList.toggle("is-scrolled", window.scrollY > 12);
      }, 80);

      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    },

    bottomNav() {
      if (isAdminPath() || isLoginPage()) return;
      if ($(".bottom-nav")) return;

      document.body.insertAdjacentHTML("beforeend", `
        <nav class="bottom-nav" aria-label="Mobile bottom navigation">
          <a href="index.html" data-page="index.html"><span>⌂</span><small>Home</small></a>
          <a href="catalog.html" data-page="catalog.html"><span>⌕</span><small>Shop</small></a>
          <button type="button" data-open-bag><span>👜</span><small>Bag</small></button>
          <a href="wishlist.html" data-page="wishlist.html"><span>♡</span><small>Saved</small></a>
          <a href="login.html" data-page="login.html"><span>◎</span><small>Staff</small></a>
        </nav>
      `);

      const page = currentPage();
      $$("[data-page]").forEach(item => {
        if (item.dataset.page === page) item.classList.add("active");
      });
    },

    revealOnScroll() {
      const items = $$("[data-reveal], .section, .product-card, .collection-card, .why-card, .review-card");
      if (!items.length || !("IntersectionObserver" in window)) return;

      items.forEach(item => item.classList.add("reveal-ready"));

      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08 });

      items.forEach(item => observer.observe(item));
    },

    escapeToClose() {
      document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        $(".cart-drawer")?.classList.remove("open");
        $(".modal.open")?.classList.remove("open");
        $(".nav-links.open")?.classList.remove("open");
      });
    }
  };

  /* ==========================================================
     TOAST NOTIFICATIONS
  ========================================================== */

  Timzy.toast = {
    ensure() {
      let host = $("#toastHost");
      if (!host) {
        document.body.insertAdjacentHTML("beforeend", `<div class="toast-host" id="toastHost" aria-live="polite"></div>`);
        host = $("#toastHost");
      }
      return host;
    },

    show(message, type = "success", action = null) {
      const host = Timzy.toast.ensure();
      const id = `toast-${Date.now()}`;

      host.insertAdjacentHTML("beforeend", `
        <div class="toast toast-${type}" id="${id}">
          <div>
            <strong>${type === "error" ? "Notice" : "Timzy Fashion"}</strong>
            <p>${escapeHtml(message)}</p>
          </div>
          ${action ? `<button type="button" class="toast-action">${escapeHtml(action.label)}</button>` : ""}
          <button type="button" class="toast-close" aria-label="Close">×</button>
        </div>
      `);

      const toast = $(`#${id}`);

      $(".toast-close", toast)?.addEventListener("click", () => Timzy.toast.close(toast));
      $(".toast-action", toast)?.addEventListener("click", () => {
        action?.handler?.();
        Timzy.toast.close(toast);
      });

      setTimeout(() => Timzy.toast.close(toast), 4200);
    },

    close(toast) {
      if (!toast) return;
      toast.classList.add("toast-exit");
      setTimeout(() => toast.remove(), 220);
    }
  };

  /* ==========================================================
     PRODUCTS
  ========================================================== */

  Timzy.products = {
    async load() {
      const local = storage.get(Timzy.keys.products, null);
      if (Array.isArray(local)) {
        Timzy.state.products = Timzy.products.clean(local);
        return Timzy.state.products;
      }

      try {
        const response = await fetch(cfg().productDataUrl || Timzy.defaults.productDataUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Product fetch failed: ${response.status}`);
        const data = await response.json();
        Timzy.state.products = Timzy.products.clean(Array.isArray(data) ? data : []);
      } catch (error) {
        Timzy.core.error("Could not load products", error);
        Timzy.state.products = [];
      }

      return Timzy.state.products;
    },

    clean(products) {
      return products
        .filter(product => product && !["hidden", "deleted"].includes(safeText(product.status).toLowerCase()))
        .map((product, index) => ({
          id: product.id || product.sku || `TFP-${index + 1}`,
          sku: product.sku || product.id || `TFP-${index + 1}`,
          name: product.name || product.productName || "Timzy Product",
          category: product.category || "Collection",
          badge: product.badge || "",
          description: product.description || "",
          fabricType: product.fabricType || product.fabric || "",
          sizes: product.sizes || product.size || "Custom",
          color: product.color || product.colour || "As shown",
          price: product.price || 0,
          salePrice: product.salePrice || product.price || 0,
          deliveryEstimate: product.deliveryEstimate || "7–14 working days",
          featured: product.featured === true || String(product.featured).toLowerCase() === "true",
          status: product.status || "Active",
          lookGroup: product.lookGroup || product.category || "General",
          images: Timzy.products.images(product),
          raw: product
        }));
    },

    images(product) {
      const fromArray = Array.isArray(product.images) ? product.images : [];
      const manual = [
        product.image1, product.image2, product.image3, product.image4,
        product.image5, product.image6, product.image7, product.image8,
        product.image9, product.image10, product.image11, product.image12
      ];

      return [...fromArray, ...manual]
        .filter(Boolean)
        .map(item => safeText(item))
        .filter(Boolean);
    },

    find(id) {
      return Timzy.state.products.find(product => String(product.id) === String(id) || String(product.sku) === String(id));
    },

    related(product, limit = 4) {
      if (!product) return [];
      const same = Timzy.state.products.filter(item => item.id !== product.id && item.category === product.category);
      const fallback = Timzy.state.products.filter(item => item.id !== product.id);
      return (same.length ? same : fallback).slice(0, limit);
    },

    categories() {
      return ["All", ...new Set(Timzy.state.products.map(product => product.category).filter(Boolean))];
    },

    saveLocal(products) {
      storage.set(Timzy.keys.products, products);
      Timzy.activity.log("Products updated locally");
    }
  };

  /* ==========================================================
     PRODUCT CARD
  ========================================================== */

  Timzy.components = {
    productCard(product, options = {}) {
      const image = product.images?.[0] || cfg().fallbackImage;
      const price = product.salePrice || product.price;
      const productUrl = `product.html?id=${encodeURIComponent(product.id)}`;

      return `
        <article class="product-card" data-product-id="${escapeHtml(product.id)}">
          <a class="product-card-link" href="${productUrl}" aria-label="View ${escapeHtml(product.name)}">
            <div class="product-media">
              <img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}">
              ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ""}
            </div>
            <div class="product-info">
              <h3>${escapeHtml(product.name)}</h3>
              <div class="product-meta">
                <span>${escapeHtml(product.category)}</span>
                <span class="price">${formatMoney(price)}</span>
              </div>
            </div>
          </a>

          <div class="product-actions">
            <button type="button" class="icon-btn" data-add-wishlist="${escapeHtml(product.id)}" aria-label="Save ${escapeHtml(product.name)}">♡</button>
            <button type="button" class="btn btn-small btn-soft" data-add-bag="${escapeHtml(product.id)}">Add</button>
          </div>
        </article>
      `;
    }
  };

  /* ==========================================================
     FEATURED PRODUCTS
  ========================================================== */

  Timzy.featured = {
    init() {
      const el = $("#featuredProducts");
      if (!el) return;

      const featured = Timzy.state.products
        .filter(product => product.featured || safeText(product.badge).toLowerCase().includes("best"))
        .slice(0, 4);

      const products = (featured.length ? featured : Timzy.state.products.slice(0, 4));

      el.innerHTML = products.length
        ? products.map(product => Timzy.components.productCard(product)).join("")
        : `<div class="empty">No products yet.</div>`;
    }
  };

  /* ==========================================================
     CATALOG
  ========================================================== */

  Timzy.catalog = {
    init() {
      const grid = $("#productGrid");
      if (!grid) return;

      Timzy.catalog.mountFilters();
      Timzy.catalog.bindEvents();
      Timzy.catalog.render();
    },

    mountFilters() {
      const chips = $("#chips");
      if (!chips) return;

      chips.innerHTML = Timzy.products.categories().map(category => `
        <button class="chip ${category === "All" ? "active" : ""}" data-cat="${escapeHtml(category)}">${escapeHtml(category)}</button>
      `).join("");
    },

    bindEvents() {
      $("#chips")?.addEventListener("click", event => {
        const chip = event.target.closest(".chip");
        if (!chip) return;

        Timzy.state.activeCategory = chip.dataset.cat || "All";
        $$(".chip", $("#chips")).forEach(item => item.classList.remove("active"));
        chip.classList.add("active");
        Timzy.catalog.render();
      });

      $("#search")?.addEventListener("input", debounce(event => {
        Timzy.state.searchTerm = event.target.value.toLowerCase().trim();
        Timzy.catalog.render();
      }, 180));

      $("#sortProducts")?.addEventListener("change", event => {
        Timzy.state.activeSort = event.target.value;
        Timzy.catalog.render();
      });

      document.addEventListener("click", event => {
        const addBag = event.target.closest("[data-add-bag]");
        if (addBag) {
          event.preventDefault();
          Timzy.cart.add(addBag.dataset.addBag);
        }

        const addWishlist = event.target.closest("[data-add-wishlist]");
        if (addWishlist) {
          event.preventDefault();
          Timzy.wishlist.toggle(addWishlist.dataset.addWishlist);
        }
      });
    },

    filtered() {
      const category = Timzy.state.activeCategory;
      const query = Timzy.state.searchTerm;

      let products = Timzy.state.products.filter(product => {
        const matchesCategory = category === "All" || product.category === category;
        const haystack = JSON.stringify(product).toLowerCase();
        const matchesSearch = !query || haystack.includes(query);
        return matchesCategory && matchesSearch;
      });

      products = Timzy.catalog.sort(products);
      return products;
    },

    sort(products) {
      const mode = Timzy.state.activeSort;

      if (mode === "price-low") return [...products].sort((a, b) => moneyNum(a.salePrice || a.price) - moneyNum(b.salePrice || b.price));
      if (mode === "price-high") return [...products].sort((a, b) => moneyNum(b.salePrice || b.price) - moneyNum(a.salePrice || a.price));
      if (mode === "name") return [...products].sort((a, b) => a.name.localeCompare(b.name));
      if (mode === "newest") return [...products].reverse();

      return [...products].sort((a, b) => Number(b.featured) - Number(a.featured));
    },

    render() {
      const grid = $("#productGrid");
      if (!grid) return;

      const products = Timzy.catalog.filtered();

      grid.innerHTML = products.length
        ? products.map(product => Timzy.components.productCard(product)).join("")
        : `<div class="empty">No matching products.</div>`;

      const count = $("#productCount");
      if (count) count.textContent = `${products.length} item${products.length === 1 ? "" : "s"}`;
    }
  };

  /* ==========================================================
     PRODUCT PAGE
  ========================================================== */

  Timzy.product = {
    init() {
      const el = $("#productDetails");
      if (!el) return;

      const id = new URLSearchParams(location.search).get("id");
      const product = Timzy.products.find(id) || Timzy.state.products[0];

      if (!product) {
        el.innerHTML = `<div class="empty">Product not found.</div>`;
        return;
      }

      Timzy.state.currentProduct = product;
      Timzy.state.galleryIndex = 0;
      Timzy.product.trackRecentlyViewed(product.id);
      Timzy.product.render(product);
      Timzy.product.bind(product);
      Timzy.product.related(product);
      Timzy.look.render(product);
    },

    render(product) {
      const el = $("#productDetails");
      const images = product.images.length ? product.images : [cfg().fallbackImage];
      const main = images[Timzy.state.galleryIndex] || images[0];

      el.innerHTML = `
        <div class="product-gallery">
          <div class="gallery-main" data-open-zoom>
            <img id="mainImage" src="${escapeHtml(main)}" alt="${escapeHtml(product.name)}">
          </div>

          <div class="thumbs">
            ${images.map((image, index) => `
              <button type="button" class="thumb-btn ${index === 0 ? "active" : ""}" data-gallery-index="${index}">
                <img class="thumb" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)} view ${index + 1}">
              </button>
            `).join("")}
          </div>
        </div>

        <aside class="detail-card">
          <span class="eyebrow">${escapeHtml(product.badge || product.category || "Timzy Collection")}</span>
          <h1>${escapeHtml(product.name)}</h1>
          <p class="lead">${escapeHtml(product.description || "Premium Timzy Fashion piece made for classy, confident dressing.")}</p>

          <div class="detail-list">
            <div class="detail-row"><span>Price</span><b class="gold">${formatMoney(product.salePrice || product.price)}</b></div>
            <div class="detail-row"><span>Category</span><b>${escapeHtml(product.category)}</b></div>
            <div class="detail-row"><span>Fabric</span><b>${escapeHtml(product.fabricType || "Premium Fabric")}</b></div>
            <div class="detail-row"><span>Size</span><b>${escapeHtml(product.sizes || "Custom")}</b></div>
            <div class="detail-row"><span>Colour</span><b>${escapeHtml(product.color || "As shown")}</b></div>
            <div class="detail-row"><span>Delivery</span><b>${escapeHtml(product.deliveryEstimate || "7–14 working days")}</b></div>
          </div>

          <div class="sticky-actions">
            <button class="btn btn-primary" type="button" data-add-bag="${escapeHtml(product.id)}">Add to Bag</button>
            <button class="btn btn-outline" type="button" data-add-wishlist="${escapeHtml(product.id)}">Save</button>
            <a class="btn btn-soft" href="checkout.html">Checkout</a>
          </div>
        </aside>
      `;
    },

    bind(product) {
      const images = product.images.length ? product.images : [cfg().fallbackImage];

      document.addEventListener("click", event => {
        const thumb = event.target.closest("[data-gallery-index]");
        if (thumb) {
          Timzy.state.galleryIndex = Number(thumb.dataset.galleryIndex);
          $("#mainImage").src = images[Timzy.state.galleryIndex];
          $$("[data-gallery-index]").forEach(item => item.classList.remove("active"));
          thumb.classList.add("active");
        }

        if (event.target.closest("[data-open-zoom]")) {
          Timzy.gallery.open(images, Timzy.state.galleryIndex);
        }
      });

      let touchStartX = 0;
      $("#productDetails")?.addEventListener("touchstart", event => {
        touchStartX = event.changedTouches[0].clientX;
      }, { passive: true });

      $("#productDetails")?.addEventListener("touchend", event => {
        const diff = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(diff) < 50) return;
        Timzy.product.move(diff < 0 ? 1 : -1, images);
      }, { passive: true });
    },

    move(delta, images) {
      Timzy.state.galleryIndex = (Timzy.state.galleryIndex + delta + images.length) % images.length;
      const main = $("#mainImage");
      if (main) main.src = images[Timzy.state.galleryIndex];
      $$("[data-gallery-index]").forEach(item => item.classList.toggle("active", Number(item.dataset.galleryIndex) === Timzy.state.galleryIndex));
    },

    related(product) {
      const el = $("#relatedProducts");
      if (!el) return;

      const products = Timzy.products.related(product, 4);

      el.innerHTML = products.length
        ? products.map(item => Timzy.components.productCard(item)).join("")
        : "";
    },

    trackRecentlyViewed(productId) {
      const viewed = storage.get(Timzy.keys.recentlyViewed, []);
      const next = [productId, ...viewed.filter(id => String(id) !== String(productId))].slice(0, 12);
      storage.set(Timzy.keys.recentlyViewed, next);
    }
  };

  /* ==========================================================
     FULLSCREEN GALLERY
  ========================================================== */

  Timzy.gallery = {
    open(images, index = 0) {
      let modal = $("#galleryModal");
      if (!modal) {
        document.body.insertAdjacentHTML("beforeend", `
          <div class="modal gallery-modal" id="galleryModal" aria-hidden="true">
            <button type="button" class="btn btn-small modal-close" data-close-gallery>Close</button>
            <button type="button" class="gallery-arrow prev" data-gallery-prev>‹</button>
            <img alt="Product image zoom" id="galleryModalImage">
            <button type="button" class="gallery-arrow next" data-gallery-next>›</button>
          </div>
        `);

        modal = $("#galleryModal");

        modal.addEventListener("click", event => {
          if (event.target.matches("[data-close-gallery]") || event.target === modal) modal.classList.remove("open");
          if (event.target.matches("[data-gallery-prev]")) Timzy.gallery.move(-1);
          if (event.target.matches("[data-gallery-next]")) Timzy.gallery.move(1);
        });

        document.addEventListener("keydown", event => {
          if (!modal.classList.contains("open")) return;
          if (event.key === "ArrowRight") Timzy.gallery.move(1);
          if (event.key === "ArrowLeft") Timzy.gallery.move(-1);
        });
      }

      Timzy.gallery.images = images;
      Timzy.gallery.index = index;
      Timzy.gallery.paint();
      modal.classList.add("open");
    },

    images: [],
    index: 0,

    move(delta) {
      const images = Timzy.gallery.images;
      Timzy.gallery.index = (Timzy.gallery.index + delta + images.length) % images.length;
      Timzy.gallery.paint();
    },

    paint() {
      const image = $("#galleryModalImage");
      if (image) image.src = Timzy.gallery.images[Timzy.gallery.index];
    }
  };

  /* ==========================================================
     SHOPPING BAG / CART
  ========================================================== */

  Timzy.cart = {
    init() {
      if (isAdminPath() || isLoginPage()) return;
      Timzy.cart.mount();
      Timzy.cart.updateUI();

      document.addEventListener("click", event => {
        const open = event.target.closest("[data-open-bag]");
        if (open) Timzy.cart.open();

        const close = event.target.closest("[data-close-bag]");
        if (close) Timzy.cart.close();

        const remove = event.target.closest("[data-remove-cart]");
        if (remove) Timzy.cart.remove(remove.dataset.removeCart);

        const qty = event.target.closest("[data-cart-qty]");
        if (qty) Timzy.cart.updateQty(qty.dataset.id, Number(qty.dataset.cartQty));
      });
    },

    list() {
      return storage.get(Timzy.keys.cart, []);
    },

    save(cart) {
      storage.set(Timzy.keys.cart, cart);
      Timzy.cart.updateUI();
      Timzy.checkout.renderSummary();
    },

    add(productOrId, quantity = 1) {
      const product = typeof productOrId === "object" ? productOrId : Timzy.products.find(productOrId);
      if (!product) return Timzy.toast.show("Product could not be added.", "error");

      const cart = Timzy.cart.list();
      const existing = cart.find(item => String(item.id) === String(product.id));

      if (existing) {
        existing.qty += quantity;
      } else {
        cart.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          price: product.salePrice || product.price,
          image: product.images?.[0] || cfg().fallbackImage,
          qty: quantity,
          lookGroup: product.lookGroup || product.category
        });
      }

      Timzy.cart.save(cart);
      Timzy.activity.log(`Added to bag: ${product.name}`);
      Timzy.toast.show(`${product.name} added to your shopping bag.`, "success", {
        label: "View Bag",
        handler: () => Timzy.cart.open()
      });
    },

    remove(id) {
      const cart = Timzy.cart.list().filter(item => String(item.id) !== String(id));
      Timzy.cart.save(cart);
      Timzy.toast.show("Item removed from bag.");
    },

    updateQty(id, delta) {
      const cart = Timzy.cart.list()
        .map(item => String(item.id) === String(id) ? { ...item, qty: Math.max(1, item.qty + delta) } : item);
      Timzy.cart.save(cart);
    },

    clear() {
      Timzy.cart.save([]);
      Timzy.toast.show("Shopping bag cleared.");
    },

    count() {
      return Timzy.cart.list().reduce((sum, item) => sum + item.qty, 0);
    },

    total() {
      return Timzy.cart.list().reduce((sum, item) => sum + moneyNum(item.price) * item.qty, 0);
    },

    mount() {
      if ($(".cart-fab")) return;

      document.body.insertAdjacentHTML("beforeend", `
        <button class="cart-fab" id="cartFab" type="button" data-open-bag aria-label="Open shopping bag">
          🛍
          <span class="cart-count" id="cartCount">0</span>
        </button>

        <aside class="cart-drawer" id="cartDrawer" aria-label="Shopping bag">
          <div class="cart-head">
            <div>
              <span class="eyebrow">Shopping Bag</span>
              <h3>Your Look</h3>
            </div>
            <button class="btn btn-small" type="button" data-close-bag>Close</button>
          </div>

          <div class="cart-items" id="cartItems"></div>

          <div class="cart-footer">
            <div class="order-line">
              <b>Total</b>
              <b class="gold" id="cartTotal">₦0</b>
            </div>
            <a class="btn btn-primary btn-block" href="checkout.html">Proceed to Checkout</a>
            <button class="btn btn-outline btn-block" type="button" id="cartWhatsApp">Send to WhatsApp</button>
          </div>
        </aside>
      `);

      $("#cartWhatsApp")?.addEventListener("click", () => Timzy.whatsapp.sendBag());
    },

    open() {
      Timzy.cart.updateUI();
      $("#cartDrawer")?.classList.add("open");
    },

    close() {
      $("#cartDrawer")?.classList.remove("open");
    },

    updateUI() {
      const cart = Timzy.cart.list();
      const count = Timzy.cart.count();

      ["#cartCount", "#bagCount"].forEach(selector => {
        const el = $(selector);
        if (el) el.textContent = String(count);
      });

      const total = $("#cartTotal");
      if (total) total.textContent = formatMoney(Timzy.cart.total());

      const items = $("#cartItems");
      if (!items) return;

      items.innerHTML = cart.length
        ? cart.map(item => `
          <div class="cart-item">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">
            <div>
              <b>${escapeHtml(item.name)}</b>
              <small>${escapeHtml(item.category || "Collection")} • ${formatMoney(item.price)}</small>
              <div class="qty">
                <button type="button" data-cart-qty="-1" data-id="${escapeHtml(item.id)}">−</button>
                <span>${item.qty}</span>
                <button type="button" data-cart-qty="1" data-id="${escapeHtml(item.id)}">+</button>
              </div>
            </div>
            <button class="btn btn-small" type="button" data-remove-cart="${escapeHtml(item.id)}">×</button>
          </div>
        `).join("")
        : `<div class="empty">Your bag is empty. Add clothes, shoes, cufflinks, glasses, fabrics, and accessories to build a complete dress down.</div>`;
    }
  };

  /* ==========================================================
     WISHLIST
  ========================================================== */

  Timzy.wishlist = {
    init() {
      if (!Timzy.flags.wishlist) return;
      Timzy.wishlist.updateUI();
    },

    list() {
      return storage.get(Timzy.keys.wishlist, []);
    },

    save(items) {
      storage.set(Timzy.keys.wishlist, items);
      Timzy.wishlist.updateUI();
    },

    has(id) {
      return Timzy.wishlist.list().some(item => String(item) === String(id));
    },

    toggle(id) {
      const items = Timzy.wishlist.list();
      const exists = Timzy.wishlist.has(id);
      const next = exists ? items.filter(item => String(item) !== String(id)) : [...items, id];
      Timzy.wishlist.save(next);
      Timzy.toast.show(exists ? "Removed from saved items." : "Saved to wishlist.");
    },

    updateUI() {
      const count = Timzy.wishlist.list().length;
      $$("[data-wishlist-count]").forEach(el => el.textContent = String(count));
    }
  };

  /* ==========================================================
     BUILD YOUR LOOK
  ========================================================== */

  Timzy.look = {
    render(product) {
      const el = $("#buildLook, #completeLook");
      if (!el || !Timzy.flags.buildLook || !product) return;

      const accessories = Timzy.state.products
        .filter(item => item.id !== product.id)
        .filter(item => {
          const cat = safeText(item.category).toLowerCase();
          return ["shoes", "shoe", "watch", "belt", "accessories", "cufflinks", "sunglasses", "cap", "perfume"].some(key => cat.includes(key));
        })
        .slice(0, 6);

      if (!accessories.length) {
        el.innerHTML = `
          <div class="panel">
            <span class="eyebrow">Complete the Look</span>
            <h2>Accessories coming soon.</h2>
            <p>Matching shoes, cufflinks, sunglasses, belts, caps, and fragrance can be activated once added to the catalog.</p>
          </div>
        `;
        return;
      }

      el.innerHTML = `
        <div class="section-head">
          <div>
            <span class="eyebrow">Complete the Look</span>
            <h2>Style the full gentleman.</h2>
          </div>
        </div>
        <div class="product-grid">
          ${accessories.map(item => Timzy.components.productCard(item)).join("")}
        </div>
      `;
    }
  };

  /* ==========================================================
     CHECKOUT
  ========================================================== */

  Timzy.checkout = {
    init() {
      const form = $("#checkoutForm");
      if (!form) return;

      Timzy.checkout.renderSummary();
      Timzy.checkout.bindConditionalFields();

      $("#clearCartBtn")?.addEventListener("click", () => Timzy.cart.clear());

      form.addEventListener("submit", event => {
        event.preventDefault();
        Timzy.checkout.submit(form);
      });
    },

    bindConditionalFields() {
      const delivery = $$("[name='delivery']");
      const measurement = $$("[name='measurement']");

      const update = () => {
        const deliveryValue = Timzy.checkout.formValue("delivery");
        const measurementValue = Timzy.checkout.formValue("measurement");

        $$("[data-delivery-section]").forEach(el => {
          el.hidden = el.dataset.deliverySection !== deliveryValue;
        });

        $$("[data-measurement-section]").forEach(el => {
          el.hidden = el.dataset.measurementSection !== measurementValue;
        });
      };

      delivery.forEach(input => input.addEventListener("change", update));
      measurement.forEach(input => input.addEventListener("change", update));
      update();
    },

    formValue(name) {
      return new FormData($("#checkoutForm")).get(name);
    },

    renderSummary() {
      const items = $("#checkoutItems");
      if (!items) return;

      const cart = Timzy.cart.list();

      items.innerHTML = cart.length
        ? cart.map(item => `
          <div class="order-line">
            <span>${escapeHtml(item.name)} × ${item.qty}</span>
            <b>${formatMoney(moneyNum(item.price) * item.qty)}</b>
          </div>
        `).join("")
        : `<p class="notice">Your bag is empty. Go back to the catalog and add items.</p>`;

      const total = $("#checkoutTotal");
      if (total) total.textContent = formatMoney(Timzy.cart.total());
    },

    validate(data) {
      const required = ["name", "phone", "delivery", "measurement", "payment"];
      for (const key of required) {
        if (!safeText(data[key])) return `${key} is required.`;
      }

      if (!Timzy.cart.list().length) return "Your bag is empty.";
      return null;
    },

    submit(form) {
      const data = Object.fromEntries(new FormData(form).entries());
      const error = Timzy.checkout.validate(data);

      if (error) {
        Timzy.toast.show(error, "error");
        return;
      }

      const summary = Timzy.orders.summary(data);
      const order = Timzy.orders.create(data, summary);

      if (data.payment === "Pay Now") {
        Timzy.payment.start(order, data, summary);
      } else {
        Timzy.whatsapp.send(summary);
        Timzy.toast.show("Order created. WhatsApp will open with full details.");
      }
    }
  };

  /* ==========================================================
     ORDERS
  ========================================================== */

  Timzy.orders = {
    list() {
      return storage.get(Timzy.keys.orders, []);
    },

    save(orders) {
      storage.set(Timzy.keys.orders, orders);
    },

    create(data, summary) {
      const order = {
        id: generateRef("TF"),
        createdAt: nowISO(),
        customer: data.name,
        phone: data.phone,
        email: data.email || "",
        delivery: data.delivery,
        address: data.address || "",
        measurement: data.measurement,
        measurements: data.measurements || "",
        payment: data.payment,
        notes: data.notes || "",
        total: Timzy.cart.total(),
        items: Timzy.cart.list(),
        summary,
        status: data.payment === "Pay Now" ? "Payment Started" : "Pending"
      };

      const orders = Timzy.orders.list();
      orders.push(order);
      Timzy.orders.save(orders);
      Timzy.activity.log(`New order created: ${order.id}`);
      return order;
    },

    summary(data) {
      const lines = Timzy.cart.list()
        .map(item => `- ${item.name} x${item.qty} = ${formatMoney(moneyNum(item.price) * item.qty)}`)
        .join("\n");

      return `New Timzy Fashion Order

Customer: ${data.name}
Phone: ${data.phone}
Email: ${data.email || "N/A"}

Items:
${lines}

Total: ${formatMoney(Timzy.cart.total())}

Delivery: ${data.delivery}
Address / Pickup Note: ${data.address || cfg().pickupAddress || "N/A"}

Measurement Option: ${data.measurement}
Measurements / Appointment Note: ${data.measurements || "N/A"}

Payment: ${data.payment}
Notes: ${data.notes || "N/A"}

Order Ref: ${generateRef("TF")}`;
    }
  };

  /* ==========================================================
     PAYMENT ABSTRACTION
  ========================================================== */

  Timzy.payment = {
    start(order, data, summary) {
      if (!Timzy.flags.payments) {
        Timzy.whatsapp.send(`${summary}\n\nPayment status: Pending.`);
        return;
      }

      const amount = Timzy.cart.total();
      const gateway = safeText(cfg().paymentGatewayUrl);
      const paystackKey = safeText(cfg().paystackPublicKey);
      const reference = order.id || generateRef("TF");

      if (gateway) {
        const separator = gateway.includes("?") ? "&" : "?";
        const params = new URLSearchParams({
          amount: String(amount),
          customer: data.name,
          phone: data.phone,
          email: data.email || "",
          ref: reference
        }).toString();

        location.href = `${gateway}${separator}${params}`;
        return;
      }

      if (paystackKey && window.PaystackPop) {
        window.PaystackPop.setup({
          key: paystackKey,
          email: data.email || "customer@timzyfashion.com",
          amount: amount * 100,
          currency: cfg().currency || "NGN",
          ref: reference,
          callback() {
            Timzy.orders.save(Timzy.orders.list().map(item => item.id === order.id ? { ...item, status: "Paid" } : item));
            Timzy.whatsapp.send(`${summary}\n\nPayment: PAID ONLINE\nPayment Ref: ${reference}`);
            Timzy.toast.show("Payment successful. Order sent to Timzy.");
          },
          onClose() {
            Timzy.toast.show("Payment window closed.", "error");
          }
        }).openIframe();

        return;
      }

      Timzy.toast.show("Payment gateway is not configured yet. Sending order as pending payment.", "error");
      Timzy.whatsapp.send(`${summary}\n\nPayment status: Pending online payment setup.`);
    }
  };

  /* ==========================================================
     WHATSAPP
  ========================================================== */

  Timzy.whatsapp = {
    number() {
      return safeText(cfg().whatsapp || Timzy.defaults.whatsapp).replace(/[^0-9]/g, "");
    },

    send(message) {
      if (!Timzy.flags.whatsapp) return;
      const url = `https://wa.me/${Timzy.whatsapp.number()}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank", "noopener");
    },

    sendBag() {
      const cart = Timzy.cart.list();
      const message = cart.length
        ? `Hi Timzy Fashion, I want to order these items:\n\n${cart.map(item => `- ${item.name} x${item.qty}`).join("\n")}\n\nTotal: ${formatMoney(Timzy.cart.total())}`
        : "Hi Timzy Fashion, I would like to make an enquiry.";
      Timzy.whatsapp.send(message);
    }
  };

  /* ==========================================================
     ACTIVITY LOG
  ========================================================== */

  Timzy.activity = {
    list() {
      return storage.get(Timzy.keys.activity, []);
    },

    log(message, meta = {}) {
      const rows = Timzy.activity.list();
      rows.unshift({
        id: generateRef("ACT"),
        message,
        meta,
        date: nowISO()
      });
      storage.set(Timzy.keys.activity, rows.slice(0, 100));
      Timzy.analytics.track("activity", { message, ...meta });
    }
  };

  /* ==========================================================
     ADMIN HELPERS
  ========================================================== */

  Timzy.admin = {
    init() {
      if (!isAdminPath()) return;
      if (!Timzy.flags.admin) return;

      Timzy.admin.dashboard();
      Timzy.admin.products();
      Timzy.admin.sales();
      Timzy.admin.expenses();
      Timzy.admin.reports();
    },

    dashboard() {
      const root = $("#adminDashboard");
      if (!root) return;

      const sales = Timzy.admin.salesList();
      const expenses = Timzy.admin.expenseList();
      const orders = Timzy.orders.list();

      const today = new Date().toISOString().slice(0, 10);
      const todaySales = sales.filter(row => safeText(row.date).startsWith(today)).reduce((sum, row) => sum + moneyNum(row.amount), 0);
      const todayExpenses = expenses.filter(row => safeText(row.date).startsWith(today)).reduce((sum, row) => sum + moneyNum(row.amount), 0);
      const pendingOrders = orders.filter(order => !["Delivered", "Cancelled", "Paid"].includes(order.status)).length;

      root.innerHTML = `
        <div class="kpi-grid">
          <div class="kpi-card"><span>Today's Sales</span><strong>${formatMoney(todaySales)}</strong></div>
          <div class="kpi-card"><span>Today's Expenses</span><strong>${formatMoney(todayExpenses)}</strong></div>
          <div class="kpi-card"><span>Profit Estimate</span><strong>${formatMoney(todaySales - todayExpenses)}</strong></div>
          <div class="kpi-card"><span>Pending Orders</span><strong>${pendingOrders}</strong></div>
        </div>
      `;
    },

    products() {
      const root = $("#adminProducts");
      if (!root) return;

      const render = () => {
        root.innerHTML = Timzy.state.products.length
          ? Timzy.state.products.map(product => `
            <article class="admin-product-row" data-id="${escapeHtml(product.id)}">
              <img src="${escapeHtml(product.images?.[0] || cfg().fallbackImage)}" alt="${escapeHtml(product.name)}">
              <div>
                <b>${escapeHtml(product.name)}</b>
                <small>${escapeHtml(product.category)} • ${formatMoney(product.salePrice || product.price)}</small>
              </div>
              <div class="admin-row-actions">
                <button class="btn btn-small" data-admin-edit="${escapeHtml(product.id)}">Edit</button>
                <button class="btn btn-small" data-admin-duplicate="${escapeHtml(product.id)}">Duplicate</button>
                <button class="btn btn-small" data-admin-delete="${escapeHtml(product.id)}">Delete</button>
              </div>
            </article>
          `).join("")
          : `<div class="empty">No products yet.</div>`;
      };

      render();

      root.addEventListener("click", event => {
        const edit = event.target.closest("[data-admin-edit]");
        const duplicate = event.target.closest("[data-admin-duplicate]");
        const del = event.target.closest("[data-admin-delete]");

        if (edit) Timzy.admin.editProduct(edit.dataset.adminEdit);
        if (duplicate) Timzy.admin.duplicateProduct(duplicate.dataset.adminDuplicate, render);
        if (del) Timzy.admin.deleteProduct(del.dataset.adminDelete, render);
      });
    },

    editProduct(id) {
      const product = Timzy.products.find(id);
      if (!product) return;

      const name = prompt("Product name", product.name);
      if (name === null) return;

      const price = prompt("Price", product.salePrice || product.price);
      if (price === null) return;

      Timzy.state.products = Timzy.state.products.map(item => item.id === product.id ? { ...item, name, price, salePrice: price } : item);
      Timzy.products.saveLocal(Timzy.state.products);
      Timzy.toast.show("Product updated.");
      location.reload();
    },

    duplicateProduct(id, callback) {
      const product = Timzy.products.find(id);
      if (!product) return;

      const copy = {
        ...product,
        id: `${product.id}-copy-${Date.now()}`,
        sku: `${product.sku || product.id}-COPY`,
        name: `${product.name} Copy`
      };

      Timzy.state.products.unshift(copy);
      Timzy.products.saveLocal(Timzy.state.products);
      Timzy.toast.show("Product duplicated.");
      callback?.();
    },

    deleteProduct(id, callback) {
      if (!confirm("Delete this product?")) return;
      Timzy.state.products = Timzy.state.products.filter(product => String(product.id) !== String(id));
      Timzy.products.saveLocal(Timzy.state.products);
      Timzy.toast.show("Product deleted.");
      callback?.();
    },

    salesList() {
      return storage.get(Timzy.keys.sales, []);
    },

    expenseList() {
      return storage.get(Timzy.keys.expenses, []);
    },

    sales() {
      const form = $("#salesForm");
      if (!form) return;

      form.addEventListener("submit", event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const rows = Timzy.admin.salesList();
        rows.unshift({ ...data, id: generateRef("SALE"), date: data.date || nowISO() });
        storage.set(Timzy.keys.sales, rows);
        Timzy.activity.log(`Sale recorded: ${data.customer || data.product || "Sale"}`);
        Timzy.toast.show("Sale recorded.");
        form.reset();
      });
    },

    expenses() {
      const form = $("#expensesForm");
      if (!form) return;

      form.addEventListener("submit", event => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        const rows = Timzy.admin.expenseList();
        rows.unshift({ ...data, id: generateRef("EXP"), date: data.date || nowISO() });
        storage.set(Timzy.keys.expenses, rows);
        Timzy.activity.log(`Expense recorded: ${data.title || "Expense"}`);
        Timzy.toast.show("Expense recorded.");
        form.reset();
      });
    },

    reports() {
      const root = $("#reportsTable");
      if (!root) return;

      const sales = Timzy.admin.salesList();
      const expenses = Timzy.admin.expenseList();

      root.innerHTML = `
        <div class="report-grid">
          <div class="panel"><span class="eyebrow">Sales</span><h2>${formatMoney(sales.reduce((s, r) => s + moneyNum(r.amount), 0))}</h2></div>
          <div class="panel"><span class="eyebrow">Expenses</span><h2>${formatMoney(expenses.reduce((s, r) => s + moneyNum(r.amount), 0))}</h2></div>
        </div>
      `;
    }
  };

  /* ==========================================================
     FIREBASE HOOKS
  ========================================================== */

  Timzy.firebase = {
    enabled() {
      return Timzy.flags.firebase && window.firebase && window.TIMZY_FIREBASE_READY;
    },

    async saveOrder(order) {
      if (!Timzy.firebase.enabled()) return null;
      try {
        // Hook point for Firestore order save.
        // Implement with your Firebase SDK setup:
        // await addDoc(collection(db, "orders"), order)
        return order;
      } catch (error) {
        Timzy.core.error("Firebase order save failed", error);
        return null;
      }
    },

    async uploadProductImage(file) {
      if (!Timzy.firebase.enabled()) return null;
      try {
        // Hook point for Firebase Storage upload.
        return null;
      } catch (error) {
        Timzy.core.error("Firebase image upload failed", error);
        return null;
      }
    }
  };

  /* ==========================================================
     ANALYTICS HOOKS
  ========================================================== */

  Timzy.analytics = {
    pageView() {
      Timzy.analytics.track("page_view", { page: currentPage(), path: location.pathname });
    },

    track(eventName, payload = {}) {
      if (!Timzy.flags.analytics) return;
      try {
        console.info("[Timzy Analytics]", eventName, payload);
      } catch {}
    }
  };

  /* ==========================================================
     FUTURE MODULES — DISABLED UNTIL ACTIVATED
  ========================================================== */

  Timzy.future = {
    init() {
      if (Timzy.flags.aiStylist) Timzy.future.aiStylist();
      if (Timzy.flags.loyalty) Timzy.future.loyalty();
      if (Timzy.flags.promoCodes) Timzy.future.promoCodes();
      if (Timzy.flags.giftCards) Timzy.future.giftCards();
      if (Timzy.flags.customerAccount) Timzy.future.customerAccount();
    },

    aiStylist() {
      console.info("AI Stylist module is ready to activate.");
    },

    loyalty() {
      console.info("Loyalty module is ready to activate.");
    },

    promoCodes() {
      console.info("Promo code module is ready to activate.");
    },

    giftCards() {
      console.info("Gift card module is ready to activate.");
    },

    customerAccount() {
      console.info("Customer account module is ready to activate.");
    }
  };

  /* ==========================================================
     GLOBAL EXPORTS FOR INLINE HTML COMPATIBILITY
  ========================================================== */

  window.updateQty = (id, delta) => Timzy.cart.updateQty(id, delta);
  window.removeCart = id => Timzy.cart.remove(id);
  window.addToCart = productOrId => Timzy.cart.add(productOrId);

  /* ==========================================================
     INIT
  ========================================================== */

  document.addEventListener("DOMContentLoaded", () => Timzy.core.init());

})();
'''

out = Path("/mnt/data/app.production.js")
out.write_text(app_js, encoding="utf-8")
print(out)
