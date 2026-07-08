const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const cfg = () => window.TIMZY_CONFIG || {};
const moneyNum = v => Number(String(v || 0).replace(/[^0-9.-]/g, '')) || 0;
const money = v => `₦${moneyNum(v).toLocaleString()}`;

async function baseProducts() {
  try {
    const res = await fetch('data/products.json', { cache: 'no-store' });
    return await res.json();
  } catch (e) {
    return [];
  }
}
function localProducts() {
  try { return JSON.parse(localStorage.getItem('timzy_products') || 'null'); } catch { return null; }
}
async function getProducts() {
  const lp = localProducts();
  if (Array.isArray(lp)) return lp.filter(p => p.status !== 'Hidden' && p.status !== 'Deleted');
  return await baseProducts();
}
function productImages(p) {
  return [p.image1, p.image2, p.image3, p.image4, p.image5, p.image6, p.image7, p.image8, p.videoUrl]
    .filter(Boolean)
    .map(x => String(x).trim())
    .filter(Boolean);
}
function productCard(p) {
  const img = productImages(p)[0] || 'assets/img/hero-man.jpg';
  return `<article class="product-card" onclick="location.href='product.html?id=${encodeURIComponent(p.id)}'">
    <div class="product-media"><img loading="lazy" src="${img}" alt="${p.name}"></div>
    <div class="product-info"><h3>${p.name}</h3><div class="product-meta"><span>${p.category || 'Collection'}</span><span class="price">${money(p.salePrice || p.price)}</span></div></div>
  </article>`;
}
function mountNav() {
  const btn = $('.mobile-menu'), links = $('.nav-links');
  if (btn && links) btn.addEventListener('click', () => links.classList.toggle('open'));
  const path = location.pathname.split('/').pop() || 'index.html';
  $$('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.endsWith(path)) a.classList.add('active');
  });
  if (!location.pathname.includes('/admin/') && !location.pathname.endsWith('login.html')) {
    document.body.insertAdjacentHTML('beforeend', `<nav class="bottom-nav"><a href="index.html">Home</a><a href="catalog.html">Shop</a><a href="checkout.html">Bag</a><a href="login.html">Staff</a></nav>`);
  }
}
async function renderFeatured() {
  const el = $('#featuredProducts');
  if (!el) return;
  const products = await getProducts();
  const picked = products.filter(p => p.featured === true || String(p.badge || '').toLowerCase().includes('best')).slice(0, 4);
  el.innerHTML = (picked.length ? picked : products.slice(0, 4)).map(productCard).join('') || '<div class="empty">No products yet.</div>';
}
async function mountCatalog() {
  const grid = $('#productGrid');
  if (!grid) return;
  const products = await getProducts();
  const chips = $('#chips');
  const cats = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  let category = 'All';
  if (chips) chips.innerHTML = cats.map(c => `<button class="chip ${c === 'All' ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
  const draw = () => {
    const q = ($('#search')?.value || '').toLowerCase().trim();
    const rows = products.filter(p => (category === 'All' || p.category === category) && JSON.stringify(p).toLowerCase().includes(q));
    grid.innerHTML = rows.map(productCard).join('') || '<div class="empty">No matching products.</div>';
  };
  chips?.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    category = b.dataset.cat; $$('.chip', chips).forEach(x => x.classList.remove('active')); b.classList.add('active'); draw();
  });
  $('#search')?.addEventListener('input', draw);
  draw();
}
async function mountProduct() {
  const el = $('#productDetails');
  if (!el) return;
  const id = new URLSearchParams(location.search).get('id');
  const products = await getProducts();
  const p = products.find(x => String(x.id) === String(id)) || products[0];
  if (!p) { el.innerHTML = '<div class="empty">Product not found.</div>'; return; }
  const imgs = productImages(p);
  let active = 0;
  const main = () => imgs[active] || 'assets/img/hero-man.jpg';
  el.innerHTML = `<div><div class="gallery-main"><img id="mainImage" src="${main()}" alt="${p.name}"></div><div class="thumbs">${imgs.map((img,i)=>`<img class="thumb ${i===0?'active':''}" src="${img}" data-i="${i}" alt="${p.name} view ${i+1}">`).join('')}</div></div>
  <aside class="detail-card"><span class="eyebrow">${p.badge || p.category || 'Timzy Collection'}</span><h1>${p.name}</h1><p class="lead">${p.description || 'Premium Timzy Fashion piece made for classy, confident dressing.'}</p><div class="detail-list">
    <div class="detail-row"><span>Price</span><b class="gold">${money(p.salePrice || p.price)}</b></div>
    <div class="detail-row"><span>Category</span><b>${p.category || 'Collection'}</b></div>
    <div class="detail-row"><span>Fabric</span><b>${p.fabricType || 'Premium Fabric'}</b></div>
    <div class="detail-row"><span>Size</span><b>${p.sizes || 'Custom'}</b></div>
    <div class="detail-row"><span>Colour</span><b>${p.color || 'As shown'}</b></div>
    <div class="detail-row"><span>Delivery</span><b>${p.deliveryEstimate || '7–14 working days'}</b></div>
  </div><div class="sticky-actions"><button class="btn primary" id="addBag">Add to Bag</button><a class="btn ghost" href="checkout.html">Checkout</a></div></aside>`;
  $$('.thumb').forEach(t => t.onclick = () => { active = Number(t.dataset.i); $('#mainImage').src = main(); $$('.thumb').forEach(x=>x.classList.remove('active')); t.classList.add('active'); });
  $('#mainImage')?.addEventListener('click', () => openZoom(main()));
  $('#addBag')?.addEventListener('click', () => addToCart(p));
  const related = $('#relatedProducts');
  if (related) related.innerHTML = products.filter(x => x.id !== p.id && x.category === p.category).slice(0,4).map(productCard).join('') || products.filter(x => x.id !== p.id).slice(0,4).map(productCard).join('');
}
function openZoom(src) {
  let m = $('#zoomModal');
  if (!m) {
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="zoomModal"><button class="btn modal-close">Close</button><img alt="Product zoom"></div>`);
    m = $('#zoomModal'); $('.modal-close', m).onclick = () => m.classList.remove('open');
  }
  $('img', m).src = src; m.classList.add('open');
}
function getCart(){ try { return JSON.parse(localStorage.getItem('timzy_cart') || '[]'); } catch { return []; } }
function setCart(c){ localStorage.setItem('timzy_cart', JSON.stringify(c)); updateCartUI(); renderCheckout(); }
function addToCart(p){ const c=getCart(); const item=c.find(x=>String(x.id)===String(p.id)); if(item)item.qty+=1; else c.push({id:p.id,sku:p.sku,name:p.name,category:p.category,price:p.salePrice||p.price,image:productImages(p)[0],qty:1}); setCart(c); openCart(); }
function updateQty(id,delta){ setCart(getCart().map(x=>String(x.id)===String(id)?{...x,qty:Math.max(1,x.qty+delta)}:x)); }
function removeCart(id){ setCart(getCart().filter(x=>String(x.id)!==String(id))); }
function cartTotal(){ return getCart().reduce((s,x)=>s+moneyNum(x.price)*x.qty,0); }
function mountCart(){
  if(location.pathname.includes('/admin/') || location.pathname.endsWith('login.html')) return;
  if(!$('.cart-fab')) document.body.insertAdjacentHTML('beforeend', `<button class="cart-fab" id="cartFab">🛍<span class="cart-count" id="cartCount">0</span></button><aside class="cart-drawer" id="cartDrawer"><div class="cart-head"><h3>Your Look</h3><button class="btn small" id="cartClose">Close</button></div><div class="cart-items" id="cartItems"></div><div class="cart-footer"><div class="order-line"><b>Total</b><b class="gold" id="cartTotal">₦0</b></div><a class="btn primary block" href="checkout.html">Proceed to Checkout</a><button class="btn ghost block" id="cartWhatsApp">Send to WhatsApp</button></div></aside>`);
  $('#cartFab').onclick = openCart; $('#cartClose').onclick = () => $('#cartDrawer').classList.remove('open'); $('#cartWhatsApp').onclick = () => sendCartWhatsApp(); updateCartUI();
}
function openCart(){ updateCartUI(); $('#cartDrawer')?.classList.add('open'); }
function updateCartUI(){ const c=getCart(); const count=c.reduce((s,x)=>s+x.qty,0); if($('#cartCount')) $('#cartCount').textContent=count; if($('#cartTotal')) $('#cartTotal').textContent=money(cartTotal()); const el=$('#cartItems'); if(!el)return; el.innerHTML=c.length?c.map(x=>`<div class="cart-item"><img src="${x.image}" alt="${x.name}"><div><b>${x.name}</b><small>${x.category} • ${money(x.price)}</small><div class="qty"><button onclick="updateQty('${x.id}',-1)">−</button><span>${x.qty}</span><button onclick="updateQty('${x.id}',1)">+</button></div></div><button class="btn small" onclick="removeCart('${x.id}')">×</button></div>`).join(''):`<div class="empty">Your bag is empty. Add clothes, shoes, cufflinks, glasses, fabrics, and accessories to build a complete dress down.</div>`; }
function renderCheckout(){ const el=$('#checkoutItems'); if(!el)return; const c=getCart(); el.innerHTML=c.length?c.map(x=>`<div class="order-line"><span>${x.name} × ${x.qty}</span><b>${money(moneyNum(x.price)*x.qty)}</b></div>`).join(''):'<p class="notice">Your bag is empty. Go back to the catalog and add items.</p>'; $('#checkoutTotal').textContent=money(cartTotal()); }
function orderSummary(data){ const lines=getCart().map(x=>`- ${x.name} x${x.qty} = ${money(moneyNum(x.price)*x.qty)}`).join('\n'); return `New Timzy Fashion Order\n\nCustomer: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email || 'N/A'}\n\nItems:\n${lines}\n\nTotal: ${money(cartTotal())}\n\nDelivery: ${data.delivery}\nAddress / Pickup note: ${data.address || 'N/A'}\n\nMeasurement option: ${data.measurement}\nMeasurements / appointment note: ${data.measurements || 'N/A'}\n\nPayment: ${data.payment}\nNotes: ${data.notes || 'N/A'}\n\nOrder Ref: TF-${Date.now().toString().slice(-7)}`; }
function sendCartWhatsApp(extra){ const num=(cfg().whatsapp||'2340000000000').replace(/[^0-9]/g,''); const msg=extra||`Hi Timzy Fashion, I want to order these items:\n\n${getCart().map(x=>`- ${x.name} x${x.qty}`).join('\n')}\n\nTotal: ${money(cartTotal())}`; window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,'_blank'); }
function mountCheckout(){ const f=$('#checkoutForm'); if(!f)return; renderCheckout(); $('#clearCartBtn')?.addEventListener('click',()=>setCart([])); f.onsubmit=e=>{ e.preventDefault(); if(!getCart().length){alert('Your bag is empty.'); return;} const data=Object.fromEntries(new FormData(f).entries()); const summary=orderSummary(data); const orders=JSON.parse(localStorage.getItem('timzy_orders')||'[]'); orders.push({date:new Date().toISOString(),customer:data.name,phone:data.phone,total:cartTotal(),payment:data.payment,delivery:data.delivery,summary,status:data.payment==='Pay Now'?'Payment Started':'Pending'}); localStorage.setItem('timzy_orders',JSON.stringify(orders)); if(data.payment==='Pay Now') startPayment(summary,data); else { sendCartWhatsApp(summary); alert('Order created. WhatsApp will open with full details.'); } }; }
function startPayment(summary,data){ const amount=cartTotal(); const gateway=(cfg().paymentGatewayUrl||'').trim(); const key=(cfg().paystackPublicKey||'').trim(); if(gateway){ location.href=gateway+(gateway.includes('?')?'&':'?')+new URLSearchParams({amount,customer:data.name,phone:data.phone,ref:`TF-${Date.now()}`}).toString(); return; } if(key && window.PaystackPop){ PaystackPop.setup({key,email:data.email||'customer@timzyfashion.com',amount:amount*100,currency:'NGN',ref:`TF-${Date.now()}`,callback(){sendCartWhatsApp(summary+'\n\nPayment: PAID ONLINE');},onClose(){alert('Payment window closed.')}}).openIframe(); return; } alert('Payment gateway is not configured yet. Sending order to WhatsApp as pending payment.'); sendCartWhatsApp(summary+'\n\nPayment status: Pending online payment setup.'); }
function fillLinks(){ $$('[data-form-link]').forEach(a=>a.href=cfg().productFormUrl||'#'); $$('[data-sheet-link]').forEach(a=>a.href=cfg().productSheetUrl||'#'); }
window.updateQty=updateQty; window.removeCart=removeCart;
window.addEventListener('DOMContentLoaded',()=>{ mountNav(); fillLinks(); renderFeatured(); mountCatalog(); mountProduct(); mountCart(); mountCheckout(); });
