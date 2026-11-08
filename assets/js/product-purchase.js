/* Product-first buying flow: choose a size and quantity before checkout.
 * Reuses Timzy's existing basket, checkout and Firestore-backed product data.
 */
(() => {
  'use strict';

  const app = window.Timzy;
  if (!app || !document.body.classList.contains('page-product')) return;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function sizeOptions(value) {
    const raw = String(value || 'One Size').trim();
    const range = raw.match(/^(\d{2})\s*[–-]\s*(\d{2})$/);
    if (range) {
      const first = Number(range[1]), last = Number(range[2]);
      if (last >= first && last - first <= 12) {
        return Array.from({ length: last - first + 1 }, (_, i) => String(first + i));
      }
    }
    return raw.split(',').map(x => x.trim()).filter(Boolean);
  }

  function addSelectedItem(p, choice, quantity) {
    const qty = Number(quantity);
    if (!p || !choice || !Number.isInteger(qty) || qty < 1 || qty > 10) return false;
    // Variant-specific basket IDs preserve different sizes and quantities.
    // Names include the choice so checkout and WhatsApp order details retain it.
    const id = String(p.id) + '::' + choice;
    const rows = app.cart.list();
    const previous = rows.find(item => item.id === id);
    if (previous) {
      previous.qty += qty;
    } else {
      rows.push({
        id,
        sourceProductId: p.id,
        name: p.name + ' — ' + choice,
        category: p.category,
        image: app.image(p),
        price: p.price,
        size: choice,
        qty
      });
    }
    app.cart.save(rows);
    return true;
  }

  const originalInit = app.product.init.bind(app.product);
  app.product.init = () => {
    const requestedId = new URLSearchParams(location.search).get('id');
    const product = app.products.find(p => String(p.id) === String(requestedId));
    if (requestedId && !product) {
      const root = document.querySelector('#productDetails');
      if (root) root.innerHTML = '<div class="empty" role="status">This product was not found. <a href="shop.html">Return to shop</a>.</div>';
      return;
    }

    originalInit();

    const p = product || app.products[0];
    const detail = document.querySelector('#productDetails .detail-card');
    const existingActions = detail?.querySelector('.sticky-actions');
    if (!p || !existingActions) return;

    const options = sizeOptions(p.sizes);
    const oneOption = options.length === 1;
    const custom = String(p.sizes || '').toLowerCase() === 'custom';
    const outfit = ['Senator', 'Agbada'].includes(p.category);
    const sizeMarkup = oneOption
      ? `<div class="product-choice-fixed"><span>Size / selection</span><strong>${esc(options[0])}</strong></div>
         <input type="hidden" name="selectedSize" value="${esc(options[0])}">`
      : `<label class="product-choice-label" for="selectedSize">Select size *
          <select class="field" name="selectedSize" id="selectedSize" required>
            <option value="">Choose a size</option>
            ${options.map(size => `<option value="${esc(size)}">${esc(size)}</option>`).join('')}
          </select>
        </label>`;

    existingActions.outerHTML = `<form id="productPurchaseForm" class="product-purchase" aria-label="Purchase options">
      <h2>Choose your options</h2>
      ${sizeMarkup}
      ${custom ? '<p class="product-choice-hint">Made to measure: provide your measurements during checkout.</p>' : ''}
      <label class="product-choice-label" for="selectedQuantity">Quantity
        <input class="field" id="selectedQuantity" type="number" name="quantity" inputmode="numeric" min="1" max="10" step="1" value="1" required>
      </label>
      <div class="product-purchase-actions">
        <button class="btn btn-outline" type="button" data-purchase-action="bag">Add to Bag</button>
        <button class="btn btn-primary" type="submit" data-purchase-action="checkout">Buy Now — Checkout</button>
      </div>
      <p class="product-purchase-status" id="purchaseStatus" role="status" aria-live="polite"></p>
    </form>`;

    // Existing product HTML assumes that all products include tailoring.
    // Correct the wording for standalone fabrics and accessories.
    if (!outfit) {
      detail.querySelectorAll('.detail-row').forEach(row => {
        if (row.firstElementChild?.textContent?.trim() === 'Includes') {
          const value = row.querySelector('b');
          if (value) value.textContent = 'Product only';
        }
      });
      const note = detail.querySelector('.mini-price-note');
      if (note) note.textContent = 'Price is for the product shown. Delivery is confirmed at checkout.';
    }

    const form = detail.querySelector('#productPurchaseForm');
    const status = detail.querySelector('#purchaseStatus');

    function process(action) {
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const size = String(data.get('selectedSize') || '').trim();
      const qty = Number(data.get('quantity'));
      if (!addSelectedItem(p, size, qty)) {
        if (status) status.textContent = 'Select a valid size and quantity.';
        return;
      }
      if (action === 'checkout') {
        window.location.href = 'checkout.html';
      } else if (status) {
        status.textContent = 'Added to your bag. You can continue shopping or checkout.';
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      process('checkout');
    });
    form.querySelector('[data-purchase-action="bag"]')?.addEventListener('click', () => process('bag'));
  };

  window.TimzyPurchase = { sizeOptions, addSelectedItem };
})();