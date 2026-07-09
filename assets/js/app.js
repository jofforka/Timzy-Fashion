/*!
 * Timzy Fashion Boutique — Lightweight Public Engine
 * File: assets/js/app.js
 * Purpose: Home, Shop/Catalog, Product, Bag, Checkout
 * Keep this file lightweight. Admin will be handled later.
 */

(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const CONFIG = () => {
    const c = window.TIMZY_CONFIG || {};
    return {
      brandName: c.brandName || "Timzy Fashion",
      currencySymbol: c.currencySymbol || c.currency || "₦",
      whatsapp: c.whatsapp || c.whatsappNumber || "2348118103510",
      productDataUrl: c.productDataUrl || "data/products.json",
      productSheetCsvUrl: c.productSheetCsvUrl || "",
      paymentGatewayUrl: c.paymentGatewayUrl || "",
      paystackPublicKey: c.paystackPublicKey || "",
      pickupAddress: c.pickupAddress || "Timzy Fashion Studio, Abuja"
    };
  };

  const KEYS = {
    cart: "timzy.cart.v1",
    wishlist: "timzy.wishlist.v1",
    orders: "timzy.orders.v1"
  };

  const escapeHTML = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const toNumber = value => Number(String(value || 0).replace(/[^0-9.-]/g, "")) || 0;
  const money = value => `${CONFIG().currencySymbol}${toNumber(value).toLocaleString()}`;

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  const toast = (message) => {
    let host = $("#toastHost");
    if (!host) {
      document.body.insertAdjacentHTML("beforeend", `<div class="toast-host" id="toastHost"></div>`);
      host = $("#toastHost");
    }
    const id = `toast-${Date.now()}`;
    host.insertAdjacentHTML("beforeend", `
      <div class="toast" id="${id}">
        <strong>Timzy Fashion</strong>
        <p>${escapeHTML(message)}</p>
      </div>
    `);
    const el = $(`#${id}`);
    setTimeout(() => el?.remove(), 3200);
  };

  const App = {
    products: [],
    activeCategory: "All",
    search: "",
    sort: "featured",

    async init() {
      App.nav();
      App.year();
      App.cart.mount();
      App.cart.render();

      await App.loadProducts();

      App.featured();
      App.catalog.init();
      App.product.init();
      App.checkout.init();
      App.builder.init();
    },

    year() {
      const y = $("#year");
      if (y) y.textContent = new Date().getFullYear();
    },

    nav() {
      const toggle = $(".nav-toggle, .mobile-menu");
      const links = $(".nav-links");

      toggle?.addEventListener("click", () => links?.classList.toggle("open"));

      const page = location.pathname.split("/").pop() || "index.html";
      $$("a[href]").forEach(a => {
        const href = (a.getAttribute("href") || "").split("?")[0].split("#")[0].split("/").pop();
        if (href === page) a.classList.add("active");
      });
    },

    async loadProducts() {
      // 1. Local override from admin later
      const local = store.get("timzy_products", null);
      if (Array.isArray(local) && local.length) {
        App.products = App.normalize(local);
        return;
      }

      // 2. Google Sheet CSV if configured later
      if (CONFIG().productSheetCsvUrl) {
        try {
          const res = await fetch(CONFIG().productSheetCsvUrl, { cache: "no-store" });
          if (res.ok) {
            const csv = await res.text();
            App.products = App.normalize(App.csvToProducts(csv));
            return;
          }
        } catch (err) {
          console.warn("CSV product load failed. Falling back to JSON.", err);
        }
      }

      // 3. Main products.json
      try {
        const res = await fetch(CONFIG().productDataUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${CONFIG().productDataUrl}`);
        const data = await res.json();
        App.products = App.normalize(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Products failed to load:", err);
        const grid = $("#productGrid");
        if (grid) {
          grid.innerHTML = `
            <div class="empty">
              Products could not load. Confirm this file exists: <b>${escapeHTML(CONFIG().productDataUrl)}</b>
            </div>
          `;
        }
      }
    },

    normalize(products) {
      return products
        .filter(p => p && !["hidden", "deleted", "draft"].includes(String(p.status || "").toLowerCase()))
        .map((p, index) => {
          const id = p.id || p.sku || `TF-${index + 1}`;
          const images = [
            ...(Array.isArray(p.images) ? p.images : []),
            p.image1, p.image2, p.image3, p.image4, p.image5, p.image6, p.image7, p.image8, p.videoUrl
          ]
            .filter(Boolean)
            .map(x => String(x).trim())
            .filter(Boolean);

          return {
            id,
            sku: p.sku || id,
            name: p.name || p.productName || "Timzy Product",
            category: p.category || "Collection",
            productType: p.productType || "",
            status: p.status || "Published",
            price: toNumber(p.salePrice) > 0 ? p.salePrice : p.price,
            originalPrice: p.price || 0,
            color: p.color || p.colour || "As shown",
            sizes: p.sizes || p.size || "Custom",
            badge: p.badge || "",
            featured: p.featured === true || String(p.featured).toLowerCase() === "true",
            tags: p.tags || "",
            fabricType: p.fabricType || p.fabric || "",
            measurementRequired: p.measurementRequired === true || String(p.measurementRequired).toLowerCase() === "true",
            deliveryEstimate: p.deliveryEstimate || "7–14 business days after confirmation",
            description: p.description || "Premium Timzy Fashion piece.",
            images,
            raw: p
          };
        });
    },

    csvToProducts(csv) {
      const lines = csv.trim().split(/\r?\n/);
      if (lines.length < 2) return [];
      const headers = lines[0].split(",").map(h => h.trim());
      return lines.slice(1).map(line => {
        const values = line.split(",");
        const row = {};
        headers.forEach((h, i) => row[h] = values[i] || "");
        return row;
      });
    },

    image(product) {
      return product.images?.[0] || "assets/images/backgrounds/placeholder-product.jpg";
    },

    productURL(product) {
      return `product.html?id=${encodeURIComponent(product.id)}`;
    },

    card(product) {
      return `
        <article class="product-card" data-product-id="${escapeHTML(product.id)}">
          <a class="product-card-link" href="${App.productURL(product)}">
            <div class="product-media">
              <img loading="lazy" src="${escapeHTML(App.image(product))}" alt="${escapeHTML(product.name)}">
              ${product.badge ? `<span class="product-badge">${escapeHTML(product.badge)}</span>` : ""}
            </div>
            <div class="product-info">
              <h3>${escapeHTML(product.name)}</h3>
              <div class="product-meta">
                <span>${escapeHTML(product.category)}</span>
                <span class="price">${money(product.price)}</span>
              </div>
            </div>
          </a>
          <div class="product-actions">
            <button type="button" class="icon-btn" data-wishlist="${escapeHTML(product.id)}">♡</button>
            <button type="button" class="btn btn-small btn-soft" data-add-bag="${escapeHTML(product.id)}">Add</button>
          </div>
        </article>
      `;
    },

    featured() {
      const el = $("#featuredProducts");
      if (!el) return;
      const products = App.products.filter(p => p.featured).slice(0, 4);
      const fallback = App.products.slice(0, 4);
      el.innerHTML = (products.length ? products : fallback).map(App.card).join("") || `<div class="empty">No products yet.</div>`;
    },

    catalog: {
      init() {
        if (!$("#productGrid")) return;

        App.catalog.applyCategoryFromURL();
        App.catalog.renderChips();
        App.catalog.bind();
        App.catalog.render();
      },

      applyCategoryFromURL() {
        const c = new URLSearchParams(location.search).get("category");
        if (c) App.activeCategory = c;
      },

      categories() {
        return ["All", ...new Set(App.products.map(p => p.category).filter(Boolean))];
      },

      renderChips() {
        const chips = $("#chips");
        if (!chips) return;
        chips.innerHTML = App.catalog.categories().map(cat => `
          <button class="chip ${cat === App.activeCategory ? "active" : ""}" type="button" data-category="${escapeHTML(cat)}">${escapeHTML(cat)}</button>
        `).join("");
      },

      bind() {
        $("#chips")?.addEventListener("click", e => {
          const btn = e.target.closest("[data-category]");
          if (!btn) return;
          App.activeCategory = btn.dataset.category;
          App.catalog.renderChips();
          App.catalog.render();
        });

        $("#search")?.addEventListener("input", e => {
          App.search = e.target.value.trim().toLowerCase();
          App.catalog.render();
        });

        $("#sortProducts")?.addEventListener("change", e => {
          App.sort = e.target.value;
          App.catalog.render();
        });

        document.addEventListener("click", e => {
          const add = e.target.closest("[data-add-bag]");
          if (add) {
            e.preventDefault();
            App.cart.add(add.dataset.addBag);
          }

          const wish = e.target.closest("[data-wishlist]");
          if (wish) {
            e.preventDefault();
            App.wishlist.toggle(wish.dataset.wishlist);
          }
        });
      },

      filtered() {
        let rows = App.products.filter(p => {
          const cat = App.activeCategory === "All" || p.category === App.activeCategory;
          const text = JSON.stringify(p).toLowerCase();
          return cat && (!App.search || text.includes(App.search));
        });

        if (App.sort === "price-low") rows.sort((a, b) => toNumber(a.price) - toNumber(b.price));
        if (App.sort === "price-high") rows.sort((a, b) => toNumber(b.price) - toNumber(a.price));
        if (App.sort === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
        if (App.sort === "newest") rows.reverse();
        if (App.sort === "featured") rows.sort((a, b) => Number(b.featured) - Number(a.featured));

        return rows;
      },

      render() {
        const grid = $("#productGrid");
        if (!grid) return;

        const rows = App.catalog.filtered();
        grid.innerHTML = rows.length ? rows.map(App.card).join("") : `<div class="empty">No matching products.</div>`;

        const count = $("#productCount");
        if (count) count.textContent = `${rows.length} product${rows.length === 1 ? "" : "s"}`;
      }
    },

    product: {
      init() {
        const root = $("#productDetails");
        if (!root) return;

        const id = new URLSearchParams(location.search).get("id");
        const product = App.products.find(p => String(p.id) === String(id)) || App.products[0];

        if (!product) {
          root.innerHTML = `<div class="empty">Product not found.</div>`;
          return;
        }

        const images = product.images.length ? product.images : [App.image(product)];

        root.innerHTML = `
          <div class="product-gallery">
            <div class="gallery-main">
              <img id="mainImage" src="${escapeHTML(images[0])}" alt="${escapeHTML(product.name)}">
            </div>
            <div class="thumbs">
              ${images.map((img, i) => `
                <button type="button" class="thumb-btn ${i === 0 ? "active" : ""}" data-thumb="${i}">
                  <img class="thumb" src="${escapeHTML(img)}" alt="${escapeHTML(product.name)} view ${i + 1}">
                </button>
              `).join("")}
            </div>
          </div>

          <aside class="detail-card">
            <span class="eyebrow">${escapeHTML(product.badge || product.category)}</span>
            <h1>${escapeHTML(product.name)}</h1>
            <p class="lead">${escapeHTML(product.description)}</p>

            <div class="detail-list">
              <div class="detail-row"><span>Price</span><b class="gold">${money(product.price)}</b></div>
              <div class="detail-row"><span>Category</span><b>${escapeHTML(product.category)}</b></div>
              <div class="detail-row"><span>Fabric</span><b>${escapeHTML(product.fabricType || "Premium Fabric")}</b></div>
              <div class="detail-row"><span>Size</span><b>${escapeHTML(product.sizes)}</b></div>
              <div class="detail-row"><span>Colour</span><b>${escapeHTML(product.color)}</b></div>
              <div class="detail-row"><span>Delivery</span><b>${escapeHTML(product.deliveryEstimate)}</b></div>
            </div>

            <div class="sticky-actions">
              <button class="btn btn-primary" type="button" data-add-bag="${escapeHTML(product.id)}">Add to Bag</button>
              <a class="btn btn-outline" href="checkout.html">Checkout</a>
            </div>
          </aside>
        `;

        $("[data-add-bag]", root)?.addEventListener("click", () => App.cart.add(product.id));

        $$(".thumb-btn", root).forEach(btn => {
          btn.addEventListener("click", () => {
            const i = Number(btn.dataset.thumb);
            $("#mainImage").src = images[i];
            $$(".thumb-btn", root).forEach(x => x.classList.remove("active"));
            btn.classList.add("active");
          });
        });

        const rel = $("#relatedProducts");
        if (rel) {
          const related = App.products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4);
          rel.innerHTML = related.map(App.card).join("");
        }
      }
    },

    wishlist: {
      list() {
        return store.get(KEYS.wishlist, []);
      },
      toggle(id) {
        const list = App.wishlist.list();
        const exists = list.includes(id);
        const next = exists ? list.filter(x => x !== id) : [...list, id];
        store.set(KEYS.wishlist, next);
        toast(exists ? "Removed from saved items." : "Saved to wishlist.");
      }
    },

    cart: {
      list() {
        return store.get(KEYS.cart, []);
      },

      save(items) {
        store.set(KEYS.cart, items);
        App.cart.render();
        App.checkout.renderSummary();
      },

      add(id) {
        const product = App.products.find(p => String(p.id) === String(id));
        if (!product) return toast("Product not found.");

        const cart = App.cart.list();
        const existing = cart.find(item => String(item.id) === String(product.id));

        if (existing) existing.qty += 1;
        else {
          cart.push({
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            image: App.image(product),
            qty: 1
          });
        }

        App.cart.save(cart);
        toast(`${product.name} added to bag.`);
        App.cart.open();
      },

      remove(id) {
        App.cart.save(App.cart.list().filter(item => String(item.id) !== String(id)));
      },

      qty(id, delta) {
        App.cart.save(App.cart.list().map(item => String(item.id) === String(id) ? {
          ...item,
          qty: Math.max(1, item.qty + delta)
        } : item));
      },

      total() {
        return App.cart.list().reduce((sum, item) => sum + toNumber(item.price) * item.qty, 0);
      },

      count() {
        return App.cart.list().reduce((sum, item) => sum + item.qty, 0);
      },

      mount() {
        if ($(".cart-drawer")) return;

        document.body.insertAdjacentHTML("beforeend", `
          <aside class="cart-drawer" id="cartDrawer">
            <div class="cart-head">
              <div>
                <span class="eyebrow">Shopping Bag</span>
                <h3>Your Look</h3>
              </div>
              <button class="btn btn-small" type="button" data-cart-close>Close</button>
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

        document.addEventListener("click", e => {
          if (e.target.closest("[data-open-bag], .floating-bag, .cart-fab")) App.cart.open();
          if (e.target.closest("[data-cart-close]")) App.cart.close();

          const minus = e.target.closest("[data-cart-minus]");
          if (minus) App.cart.qty(minus.dataset.cartMinus, -1);

          const plus = e.target.closest("[data-cart-plus]");
          if (plus) App.cart.qty(plus.dataset.cartPlus, 1);

          const remove = e.target.closest("[data-cart-remove]");
          if (remove) App.cart.remove(remove.dataset.cartRemove);
        });

        $("#cartWhatsApp")?.addEventListener("click", App.whatsapp.sendBag);
      },

      open() {
        $("#cartDrawer")?.classList.add("open");
      },

      close() {
        $("#cartDrawer")?.classList.remove("open");
      },

      render() {
        const count = App.cart.count();

        ["#bagCount", "#cartCount"].forEach(sel => {
          const el = $(sel);
          if (el) el.textContent = String(count);
        });

        const total = $("#cartTotal");
        if (total) total.textContent = money(App.cart.total());

        const items = $("#cartItems");
        if (!items) return;

        const cart = App.cart.list();

        items.innerHTML = cart.length ? cart.map(item => `
          <div class="cart-item">
            <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}">
            <div>
              <b>${escapeHTML(item.name)}</b>
              <small>${escapeHTML(item.category)} • ${money(item.price)}</small>
              <div class="qty">
                <button type="button" data-cart-minus="${escapeHTML(item.id)}">−</button>
                <span>${item.qty}</span>
                <button type="button" data-cart-plus="${escapeHTML(item.id)}">+</button>
              </div>
            </div>
            <button class="btn btn-small" type="button" data-cart-remove="${escapeHTML(item.id)}">×</button>
          </div>
        `).join("") : `<div class="empty">Your bag is empty.</div>`;
      }
    },

    checkout: {
      init() {
        const form = $("#checkoutForm");
        if (!form) return;

        App.checkout.renderSummary();

        form.addEventListener("submit", e => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(form).entries());

          if (!App.cart.list().length) return toast("Your bag is empty.");
          if (!data.name || !data.phone) return toast("Name and phone number are required.");

          const summary = App.checkout.summary(data);
          const orders = store.get(KEYS.orders, []);
          orders.push({
            id: `TF-${Date.now().toString().slice(-7)}`,
            date: new Date().toISOString(),
            customer: data.name,
            phone: data.phone,
            total: App.cart.total(),
            payment: data.payment,
            delivery: data.delivery,
            summary
          });
          store.set(KEYS.orders, orders);

          if (data.payment === "Pay Now" && CONFIG().paymentGatewayUrl) {
            location.href = CONFIG().paymentGatewayUrl;
          } else {
            App.whatsapp.send(summary);
            toast("Order created. WhatsApp will open with full order details.");
          }
        });

        $("#clearCartBtn")?.addEventListener("click", () => {
          App.cart.save([]);
          App.checkout.renderSummary();
        });
      },

      renderSummary() {
        const el = $("#checkoutItems");
        if (!el) return;

        const cart = App.cart.list();
        el.innerHTML = cart.length ? cart.map(item => `
          <div class="order-line">
            <span>${escapeHTML(item.name)} × ${item.qty}</span>
            <b>${money(toNumber(item.price) * item.qty)}</b>
          </div>
        `).join("") : `<p class="notice">Your bag is empty. Go back to the shop and add items.</p>`;

        const total = $("#checkoutTotal");
        if (total) total.textContent = money(App.cart.total());
      },

      summary(data) {
        const items = App.cart.list().map(item => `- ${item.name} x${item.qty} = ${money(toNumber(item.price) * item.qty)}`).join("\\n");
        return `New Timzy Fashion Order

Customer: ${data.name}
Phone: ${data.phone}
Email: ${data.email || "N/A"}

Items:
${items}

Total: ${money(App.cart.total())}

Delivery: ${data.delivery || "N/A"}
Address/Pickup Note: ${data.address || CONFIG().pickupAddress}

Measurement Option: ${data.measurement || "N/A"}
Measurements/Notes: ${data.measurements || data.notes || "N/A"}

Payment: ${data.payment || "N/A"}

Order Ref: TF-${Date.now().toString().slice(-7)}`;
      }
    },

    builder: {
      init() {
        if (!document.getElementById("mainOutfitGrid")) return;
        const outfits = App.products.filter(p => ["senator","agbada","kaftan","wear","fabric"].some(k => String(p.category + " " + p.productType + " " + p.tags).toLowerCase().includes(k))).slice(0, 8);
        const accessories = App.products.filter(p => String(p.category).toLowerCase().includes("accessor"));
        const by = term => accessories.filter(p => JSON.stringify(p).toLowerCase().includes(term)).slice(0, 4);
        const fill = (id, rows) => { const el=document.getElementById(id); if(el) el.innerHTML = rows.length ? rows.map(App.card).join("") : '<div class="empty">Coming soon.</div>'; };
        fill("mainOutfitGrid", outfits.length ? outfits : App.products.slice(0,8));
        fill("builderShoes", by("shoe").concat(by("sandals")).slice(0,4));
        fill("builderWatches", by("watch"));
        fill("builderCufflinks", by("cufflink"));
        fill("builderGlasses", by("sunglass"));
        fill("builderCaps", by("cap"));
        fill("builderBelts", by("belt"));
        fill("builderPerfumes", by("perfume"));
      }
    },

    whatsapp: {
      number() {
        return String(CONFIG().whatsapp).replace(/[^0-9]/g, "");
      },

      send(message) {
        window.open(`https://wa.me/${App.whatsapp.number()}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
      },

      sendBag() {
        const cart = App.cart.list();
        const msg = cart.length
          ? `Hi Timzy Fashion, I want to order these items:\\n\\n${cart.map(item => `- ${item.name} x${item.qty}`).join("\\n")}\\n\\nTotal: ${money(App.cart.total())}`
          : "Hi Timzy Fashion, I want to make an enquiry.";
        App.whatsapp.send(msg);
      }
    }
  };

  document.addEventListener("DOMContentLoaded", App.init);
  window.Timzy = App;
})();
