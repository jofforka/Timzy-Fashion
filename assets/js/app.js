
(() => {"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const C=()=>{const c=window.TIMZY_CONFIG||{};return{currency:c.currency||c.currencySymbol||"₦",whatsapp:c.whatsappNumber||c.whatsapp||"2348118103510",productDataUrl:c.productDataUrl||"data/products.json",pickupAddress:c.pickupAddress||"Timzy Fashion Studio, Abuja",paymentGatewayUrl:c.paymentGatewayUrl||""}};
const K={cart:"timzy.v6.cart",wishlist:"timzy.v6.wishlist",orders:"timzy.v6.orders"};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const num=v=>Number(String(v||0).replace(/[^0-9.-]/g,""))||0, money=v=>`${C().currency}${num(v).toLocaleString()}`;
const store={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};
function toast(m){let h=$("#toastHost");if(!h){document.body.insertAdjacentHTML("beforeend",'<div class="toast-host" id="toastHost"></div>');h=$("#toastHost")}const id="t"+Date.now();h.insertAdjacentHTML("beforeend",`<div class="toast compact-toast" id="${id}"><span class="toast-icon">✓</span><p>${esc(m)}</p></div>`);setTimeout(()=>$("#"+id)?.remove(),2200)}
const App={products:[],activeCategory:"All",search:"",sort:"featured",async init(){App.nav();App.year();App.cart.mount();App.cart.render();App.bindGlobalActions();await App.loadProducts();App.featured();App.catalog.init();App.product.init();App.builder.init();App.checkout.init();App.videoViewer.init();App.contact.init();App.videoViewer.init();},
nav(){const t=$(".nav-toggle"),l=$(".nav-links");t?.addEventListener("click",()=>l?.classList.toggle("open"));const p=location.pathname.split("/").pop()||"index.html";$$('a[href]').forEach(a=>{const h=(a.getAttribute('href')||'').split('?')[0].split('#')[0].split('/').pop();if(h===p)a.classList.add('active')})},year(){const y=$("#year");if(y)y.textContent=new Date().getFullYear()},
bindGlobalActions(){
  if(App._globalActionsBound)return;
  App._globalActionsBound=true;
  document.addEventListener('click',e=>{
    const add=e.target.closest('[data-add-bag]');
    if(add){
      e.preventDefault();
      e.stopPropagation();
      App.cart.add(add.dataset.addBag);
      return;
    }
    const wish=e.target.closest('[data-wishlist]');
    if(wish){
      e.preventDefault();
      e.stopPropagation();
      App.wishlist.toggle(wish.dataset.wishlist);
      return;
    }
    const buy=e.target.closest('[data-buy-now]');
    if(buy){
      e.preventDefault();
      const id=buy.dataset.buyNow || buy.dataset.addBag;
      if(id)App.cart.add(id);
      window.location.href='checkout.html';
    }
  });
},
async loadProducts(){
  const fb=window.TIMZY_FIREBASE;
  const collectionName=window.TIMZY_CONFIG?.collections?.products||"products";

  if(fb?.db){
    try{
      const snapshot=await fb.db.collection(collectionName).get();
      const firestoreProducts=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));

      if(firestoreProducts.length){
        App.products=App.normalize(firestoreProducts);
        console.log(`Loaded ${App.products.length} products from Firestore.`);
        return;
      }
    }catch(error){
      console.warn("Firestore product load failed. Falling back to products.json.",error);
    }
  }

  try{
    const response=await fetch(C().productDataUrl,{cache:"no-store"});
    if(!response.ok)throw new Error(response.status);
    const data=await response.json();
    App.products=App.normalize(Array.isArray(data)?data:[]);
    console.log(`Loaded ${App.products.length} products from products.json fallback.`);
  }catch(error){
    console.error(error);
    const grid=$("#productGrid");
    if(grid)grid.innerHTML=`<div class="empty">Products could not load.</div>`;
  }
},
normalize(rows){return rows.filter(p=>p&&!['hidden','deleted','draft'].includes(String(p.status||'').toLowerCase())).map((p,i)=>{const id=p.id||p.sku||`TF-${i+1}`;let imgs=[...(Array.isArray(p.images)?p.images:[]),p.image,p.image1,p.image2,p.image3,p.image4,p.image5,p.image6,p.image7,p.image8].filter(Boolean).map(x=>String(x).trim()).filter(Boolean).map(x=>{
  if(/^https?:\/\//i.test(x)||x.startsWith('data:')||x.startsWith('blob:'))return x;
  if(x.startsWith('assets/'))return x;
  if(x.startsWith('img/'))return 'assets/'+x;
  return 'assets/img/'+x;
});return{id,sku:p.sku||id,name:p.name||p.productName||'Timzy Product',category:p.category||'Collection',productType:p.productType||'',status:p.status||'Published',price:num(p.salePrice)>0?p.salePrice:p.price,color:p.color||p.colour||'As shown',sizes:p.sizes||p.size||'Custom',badge:p.badge||'',featured:p.featured===true||String(p.featured).toLowerCase()==='true',tags:p.tags||'',fabricType:p.fabricType||p.fabric||'',measurementRequired:p.measurementRequired===true||String(p.measurementRequired).toLowerCase()==='true',deliveryEstimate:p.deliveryEstimate||'7–14 business days after confirmation',description:p.description||'Premium Timzy Fashion piece.',instagramVideoUrl:p.instagramVideoUrl||p.videoUrl||'',images:imgs,raw:p}})},
image(p){return p.images?.[0]||'assets/img/hero-senator-grey.jpg'},url(p){return`product.html?id=${encodeURIComponent(p.id)}`},
card(p){return`<article class="product-card" data-product-id="${esc(p.id)}"><a class="product-card-link" href="${App.url(p)}"><div class="product-media"><img loading="lazy" src="${esc(App.image(p))}" alt="${esc(p.name)}" onerror="this.src='assets/img/hero-senator-grey.jpg'">${p.badge?`<span class="product-badge">${esc(p.badge)}</span>`:''}</div><div class="product-info"><h3>${esc(p.name)}</h3><div class="product-meta"><span>${esc(p.category)}</span><span class="price">${money(p.price)}</span></div></div></a><div class="product-actions"><button type="button" class="icon-btn" data-wishlist="${esc(p.id)}">♡</button><button type="button" class="btn btn-small btn-soft" data-add-bag="${esc(p.id)}">Add</button></div></article>`},
featured(){const el=$("#featuredProducts");if(!el)return;const rows=App.products.filter(p=>p.featured).slice(0,8);el.innerHTML=(rows.length?rows:App.products.slice(0,8)).map(App.card).join('')||'<div class="empty">No products yet.</div>'},
catalog:{init(){if(!$("#productGrid"))return;const c=new URLSearchParams(location.search).get('category');if(c)App.activeCategory=c;App.catalog.chips();App.catalog.bind();App.catalog.render()},categories(){return['All',...new Set(App.products.map(p=>p.category).filter(Boolean))]},chips(){const el=$("#chips");if(!el)return;el.innerHTML=App.catalog.categories().map(c=>`<button class="chip ${c===App.activeCategory?'active':''}" type="button" data-category="${esc(c)}">${esc(c)}</button>`).join('')},bind(){$("#chips")?.addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(!b)return;App.activeCategory=b.dataset.category;App.catalog.chips();App.catalog.render()});$("#search")?.addEventListener('input',e=>{App.search=e.target.value.toLowerCase().trim();App.catalog.render()});$("#sortProducts")?.addEventListener('change',e=>{App.sort=e.target.value;App.catalog.render()})},filtered(){let r=App.products.filter(p=>(App.activeCategory==='All'||p.category===App.activeCategory)&&(!App.search||JSON.stringify(p).toLowerCase().includes(App.search)));if(App.sort==='price-low')r.sort((a,b)=>num(a.price)-num(b.price));if(App.sort==='price-high')r.sort((a,b)=>num(b.price)-num(a.price));if(App.sort==='name')r.sort((a,b)=>a.name.localeCompare(b.name));if(App.sort==='newest')r.reverse();if(App.sort==='featured')r.sort((a,b)=>Number(b.featured)-Number(a.featured));return r},render(){const g=$("#productGrid");if(!g)return;const rows=App.catalog.filtered();g.innerHTML=rows.length?rows.map(App.card).join(''):'<div class="empty">No matching products.</div>';const c=$("#productCount");if(c)c.textContent=`${rows.length} product${rows.length===1?'':'s'}`}},
product:{init(){const root=$("#productDetails");if(!root)return;const id=new URLSearchParams(location.search).get('id');const p=App.products.find(x=>String(x.id)===String(id))||App.products[0];if(!p){root.innerHTML='<div class="empty">Product not found.</div>';return}const imgs=p.images.length?p.images:[App.image(p)];root.innerHTML=`<div class="product-gallery"><div class="gallery-main"><img id="mainImage" src="${esc(imgs[0])}" alt="${esc(p.name)}" onerror="this.src='assets/img/hero-senator-grey.jpg'"></div><div class="thumbs">${imgs.map((im,i)=>`<button type="button" class="thumb-btn ${i===0?'active':''}" data-thumb="${i}"><img class="thumb" src="${esc(im)}" onerror="this.src='assets/img/hero-senator-grey.jpg'" alt="${esc(p.name)}"></button>`).join('')}</div>${p.instagramVideoUrl?`<button class="product-video-trigger" type="button" data-product-video="${esc(p.instagramVideoUrl)}" data-product-video-title="${esc(p.name)}"><span class="product-video-icon">▶</span><span><b>Watch this look in motion</b><small>View the live Instagram presentation</small></span></button>`:''}</div><aside class="detail-card"><span class="eyebrow">${esc(p.badge||p.category)}</span><h1>${esc(p.name)}</h1><p class="lead">${esc(p.description)}</p><div class="detail-list"><div class="detail-row"><span>Price</span><b class="price">${money(p.price)}</b></div><div class="detail-row"><span>Includes</span><b>Material + Sewing</b></div><div class="detail-row"><span>Category</span><b>${esc(p.category)}</b></div><div class="detail-row"><span>Fabric</span><b>${esc(p.fabricType||'Premium Fabric')}</b></div><div class="detail-row"><span>Colour</span><b>${esc(p.color)}</b></div><div class="detail-row"><span>Delivery</span><b>${esc(p.deliveryEstimate)}</b></div></div><div class="sticky-actions"><button class="btn btn-primary" type="button" data-add-bag="${esc(p.id)}">Add to Bag</button><a class="btn btn-outline" href="checkout.html">Checkout</a></div><div class="mini-price-note"><b>Price includes fabric/material + tailoring.</b><span>Complete finished work unless stated otherwise.</span></div><div class="product-inline-tools">
<div class="inline-accessories">
<div class="inline-accessories-head"><span class="eyebrow">Complete The Style</span><h3>Add matching accessories</h3><p>Optional extras — open a category and add what completes the look.</p></div>
<div class="accordion style-accordion compact-accessory-accordion">
<details><summary>👞 Shoes</summary><div id="shoeRecommendations" class="product-grid accessory-grid"></div></details>
<details><summary>⌚ Wristwatches</summary><div id="watchRecommendations" class="product-grid accessory-grid"></div></details>
<details><summary>💎 Cufflinks</summary><div id="cufflinkRecommendations" class="product-grid accessory-grid"></div></details>
<details><summary>🧢 Caps</summary><div id="capRecommendations" class="product-grid accessory-grid"></div></details>
<details><summary>🕶 Sunglasses</summary><div id="glassRecommendations" class="product-grid accessory-grid"></div></details>
<details><summary>👔 Belts</summary><div id="beltRecommendations" class="product-grid accessory-grid"></div></details>
<details><summary>🌸 Perfumes</summary><div id="perfumeRecommendations" class="product-grid accessory-grid"></div></details>
</div></div>
<div class="inline-measurements">
<div class="inline-accessories-head"><span class="eyebrow">Measurements</span><h3>Add your measurement</h3><p>Open one option. You can also complete this later at checkout.</p></div>
<div class="accordion compact-measurement-accordion">
<details><summary>📍 Request Measurement Visit <small>Abuja only</small></summary><div class="measurement-mini-card"><p>Available within Abuja. Add your address and preferred date during checkout.</p><a class="btn btn-primary btn-small" href="checkout.html#measurements">Request Visit</a></div></details>
<details><summary>📏 Enter Measurements Manually</summary><div class="measurement-mini-grid">
<label>Neck <input class="field" name="neck"></label><label>Shoulder <input class="field" name="shoulder"></label><label>Chest <input class="field" name="chest"></label><label>Sleeve <input class="field" name="sleeve"></label><label>Wrist <input class="field" name="wrist"></label><label>Top Length <input class="field" name="top_length"></label><label>Waist <input class="field" name="waist"></label><label>Hip <input class="field" name="hip"></label><label>Thigh <input class="field" name="thigh"></label><label>Trouser Length <input class="field" name="trouser_length"></label><label>Ankle <input class="field" name="ankle"></label><label>Height <input class="field" name="height"></label><label class="measurement-notes">Notes <textarea class="field" rows="3" name="measurement_notes"></textarea></label>
</div></details>
</div></div>
</div></aside>`;$$('.thumb-btn',root).forEach(b=>b.onclick=()=>{const i=+b.dataset.thumb;$('#mainImage').src=imgs[i];$$('.thumb-btn',root).forEach(x=>x.classList.remove('active'));b.classList.add('active')});App.fillAccessorySections();const rel=$("#relatedProducts");if(rel)rel.innerHTML=App.products.filter(x=>x.id!==p.id&&x.category===p.category).slice(0,4).map(App.card).join('')||'<div class="empty">No related products.</div>'}},
fillAccessorySections(){const acc=App.products.filter(p=>/accessor|shoe|watch|belt|cap|cuff|sun|perfume|ring|sandals/i.test(`${p.category} ${p.name} ${p.tags}`));const by=t=>acc.filter(p=>JSON.stringify(p).toLowerCase().includes(t)).slice(0,4);const fill=(id,rows)=>{const el=$(id);if(el)el.innerHTML=rows.length?rows.map(App.card).join(''):'<div class="empty">Coming soon.</div>'};fill('#recommendedProducts',acc.slice(0,8));fill('#shoeRecommendations',[...by('shoe'),...by('sandals')].slice(0,4));fill('#watchRecommendations',by('watch'));fill('#cufflinkRecommendations',by('cuff'));fill('#capRecommendations',by('cap'));fill('#glassRecommendations',by('sunglass'));fill('#beltRecommendations',by('belt'));fill('#perfumeRecommendations',by('perfume'))},
builder:{init(){if(!$('#mainOutfitGrid'))return;const outfits=App.products.filter(p=>/senator|agbada|kaftan|fabric|wear/i.test(`${p.category} ${p.productType} ${p.tags}`)).slice(0,8);const fill=(id,rows)=>{const el=$(id);if(el)el.innerHTML=rows.length?rows.map(App.card).join(''):'<div class="empty">Coming soon.</div>'};fill('#mainOutfitGrid',outfits.length?outfits:App.products.slice(0,8));App.fillAccessorySections();fill('#builderShoes',[...App.products.filter(p=>/shoe|sandals/i.test(JSON.stringify(p))).slice(0,4)]);fill('#builderWatches',App.products.filter(p=>/watch/i.test(JSON.stringify(p))).slice(0,4));fill('#builderCufflinks',App.products.filter(p=>/cuff/i.test(JSON.stringify(p))).slice(0,4));fill('#builderGlasses',App.products.filter(p=>/sunglass/i.test(JSON.stringify(p))).slice(0,4));fill('#builderCaps',App.products.filter(p=>/cap/i.test(JSON.stringify(p))).slice(0,4));fill('#builderBelts',App.products.filter(p=>/belt/i.test(JSON.stringify(p))).slice(0,4));fill('#builderPerfumes',App.products.filter(p=>/perfume/i.test(JSON.stringify(p))).slice(0,4))}},
wishlist:{list(){return store.get(K.wishlist,[])},toggle(id){const l=App.wishlist.list();store.set(K.wishlist,l.includes(id)?l.filter(x=>x!==id):[...l,id]);toast(l.includes(id)?'Removed from saved items.':'Saved to wishlist.')}},
cart:{list(){return store.get(K.cart,[])},save(x){store.set(K.cart,x);App.cart.render();App.checkout.summaryRender()},add(id){const p=App.products.find(x=>String(x.id)===String(id));if(!p)return toast('Product not found.');const c=App.cart.list(),ex=c.find(x=>String(x.id)===String(p.id));if(ex)ex.qty+=1;else c.push({id:p.id,name:p.name,category:p.category,price:p.price,image:App.image(p),qty:1});App.cart.save(c);toast(`${p.name} added to cart.`)},remove(id){App.cart.save(App.cart.list().filter(x=>String(x.id)!==String(id)))},qty(id,d){App.cart.save(App.cart.list().map(x=>String(x.id)===String(id)?{...x,qty:Math.max(1,x.qty+d)}:x))},total(){return App.cart.list().reduce((s,x)=>s+num(x.price)*x.qty,0)},count(){return App.cart.list().reduce((s,x)=>s+x.qty,0)},mount(){if($('.cart-drawer'))return;document.body.insertAdjacentHTML('beforeend',`<aside class="cart-drawer" id="cartDrawer"><div class="cart-head"><div><span class="eyebrow">Shopping Bag</span><h3>Your Look</h3></div><button class="btn btn-small" type="button" data-cart-close>Close</button></div><div class="cart-items" id="cartItems"></div><div class="cart-footer"><div class="order-line"><b>Total</b><b class="price" id="cartTotal">₦0</b></div><a class="btn btn-primary btn-block" href="checkout.html">Proceed to Checkout</a><button class="btn btn-outline btn-block" type="button" id="cartWhatsApp">Send to WhatsApp</button></div></aside>`);document.addEventListener('click',e=>{if(e.target.closest('[data-open-bag],.floating-bag,.cart-fab'))App.cart.open();if(e.target.closest('[data-cart-close]'))App.cart.close();const m=e.target.closest('[data-cart-minus]');if(m)App.cart.qty(m.dataset.cartMinus,-1);const p=e.target.closest('[data-cart-plus]');if(p)App.cart.qty(p.dataset.cartPlus,1);const r=e.target.closest('[data-cart-remove]');if(r)App.cart.remove(r.dataset.cartRemove)});$('#cartWhatsApp')?.addEventListener('click',App.whatsapp.sendBag)},open(){$('#cartDrawer')?.classList.add('open')},close(){$('#cartDrawer')?.classList.remove('open')},render(){const count=App.cart.count();['#bagCount','#cartCount'].forEach(s=>{const e=$(s);if(e)e.textContent=count});const total=$('#cartTotal');if(total)total.textContent=money(App.cart.total());const el=$('#cartItems');if(!el)return;const c=App.cart.list();el.innerHTML=c.length?c.map(x=>`<div class="cart-item"><img src="${esc(x.image)}" onerror="this.src='assets/img/hero-senator-grey.jpg'" alt="${esc(x.name)}"><div><b>${esc(x.name)}</b><small>${esc(x.category)} • ${money(x.price)}</small><div class="qty"><button data-cart-minus="${esc(x.id)}">−</button><span>${x.qty}</span><button data-cart-plus="${esc(x.id)}">+</button></div></div><button class="btn btn-small" data-cart-remove="${esc(x.id)}">×</button></div>`).join(''):'<div class="empty">Your bag is empty.</div>'}},
checkout:{
init(){
  const f=$('#checkoutForm');
  if(!f)return;
  App.checkout.summaryRender();
  App.checkout.bindCheckoutUI();

  f.addEventListener('submit',e=>{
    e.preventDefault();
    const d=Object.fromEntries(new FormData(f).entries());
    if(!App.cart.list().length)return toast('Your bag is empty.');
    if(!d.name||!d.phone)return toast('Name and phone are required.');
    App.whatsapp.send(App.checkout.message(d));
    toast('Order created. WhatsApp will open.');
  });

  $('#clearCartBtn')?.addEventListener('click',()=>{
    App.cart.save([]);
    App.checkout.summaryRender();
  });
},

bindCheckoutUI(){
  const sync=()=>{
    const delivery=$('input[name="delivery"]:checked')?.value || 'Home Delivery';
    $$('[data-delivery-box]').forEach(x=>x.hidden=x.dataset.deliveryBox!==delivery);

    const measurement=$('input[name="measurement"]:checked')?.value || 'Manual Measurement';
    $$('[data-measurement-box]').forEach(x=>x.hidden=x.dataset.measurementBox!==measurement);

    const payment=$('input[name="payment"]:checked')?.value || 'Pay Now';
    $$('[data-payment-box]').forEach(x=>x.hidden=x.dataset.paymentBox!==payment);
  };

  $$('input[name="delivery"],input[name="measurement"],input[name="payment"]').forEach(x=>x.addEventListener('change',sync));
  sync();

  $('#copyAccountBtn')?.addEventListener('click',()=>{
    const number=$('#accountNumber')?.textContent?.trim() || '';
    navigator.clipboard?.writeText(number);
    toast('Account number copied.');
  });
},

summaryRender(){
  const el=$('#checkoutItems');
  if(!el)return;
  const c=App.cart.list();
  el.innerHTML=c.length?c.map(x=>`<div class="order-line"><span>${esc(x.name)} × ${x.qty}</span><b>${money(num(x.price)*x.qty)}</b></div>`).join(''):'<p class="notice">Your bag is empty.</p>';
  const t=$('#checkoutTotal');
  if(t)t.textContent=money(App.cart.total());
},

message(d){
  const measurementLines=[
    ['Neck',d.m_neck],['Shoulder',d.m_shoulder],['Chest',d.m_chest],['Sleeve',d.m_sleeve],
    ['Wrist',d.m_wrist],['Top Length',d.m_top_length],['Waist',d.m_waist],['Hip',d.m_hip],
    ['Thigh',d.m_thigh],['Trouser Length',d.m_trouser_length],['Ankle',d.m_ankle],['Height',d.m_height]
  ].filter(x=>x[1]).map(x=>`${x[0]}: ${x[1]}`).join('\\n');

  return`New Timzy Fashion Order

Customer: ${d.name}
Phone: ${d.phone}
Email: ${d.email||'N/A'}
City: ${d.city||'N/A'}

Items:
${App.cart.list().map(x=>`- ${x.name} x${x.qty} = ${money(num(x.price)*x.qty)}`).join('\\n')}

Total: ${money(App.cart.total())}

Delivery Method: ${d.delivery||'N/A'}
Delivery Address: ${d.address||'N/A'}
Landmark: ${d.landmark||'N/A'}

Measurement Option: ${d.measurement||'N/A'}
${measurementLines ? `Measurements:\\n${measurementLines}` : ''}
Visit Date: ${d.visit_date||'N/A'}
Visit Time: ${d.visit_time||'N/A'}
Visit Address: ${d.visit_address||'N/A'}

Payment: ${d.payment||'N/A'}
Special Notes: ${d.notes||'N/A'}

Order Ref: TF-${Date.now().toString().slice(-7)}`;
}},contact:{init(){const f=$('#contactForm');if(!f)return;f.addEventListener('submit',e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f).entries());if(!d.name||!d.phone||!d.message)return toast('Please complete the required fields.');App.whatsapp.send(`Timzy Fashion Enquiry\n\nName: ${d.name}\nPhone: ${d.phone}\nEmail: ${d.email||'N/A'}\nEnquiry: ${d.type||'General Enquiry'}\n\nMessage:\n${d.message}`);toast('Opening WhatsApp.');})}},
videoViewer:{
init(){
  if(App._videoViewerBound)return;
  App._videoViewerBound=true;

  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-product-video]');
    if(trigger){
      e.preventDefault();
      App.videoViewer.open(trigger.dataset.productVideo,trigger.dataset.productVideoTitle||'Timzy Fashion');
      return;
    }
    if(e.target.closest('[data-video-close]')||e.target.classList.contains('video-modal')){
      App.videoViewer.close();
      return;
    }
    if(e.target.closest('[data-video-maximize]')){
      App.videoViewer.toggleMaximize();
      return;
    }
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')App.videoViewer.close();
  });
},

embedUrl(url){
  try{
    const parsed=new URL(url,location.href);
    if(!/instagram\.com$/i.test(parsed.hostname.replace(/^www\./,'')))return '';
    const parts=parsed.pathname.split('/').filter(Boolean);
    if(!['p','reel','tv'].includes(parts[0])||!parts[1])return '';
    return `https://www.instagram.com/${parts[0]}/${parts[1]}/embed/captioned/`;
  }catch{
    return '';
  }
},

open(url,title){
  const embed=App.videoViewer.embedUrl(url);
  if(!embed){
    toast('This product video link is not available yet.');
    return;
  }

  App.videoViewer.close();

  document.body.insertAdjacentHTML('beforeend',`
    <div class="video-modal" id="productVideoModal" role="dialog" aria-modal="true" aria-label="${esc(title)} video">
      <div class="video-modal-card">
        <div class="video-modal-head">
          <div>
            <span class="eyebrow">Timzy In Motion</span>
            <h3>${esc(title)}</h3>
          </div>
          <div class="video-modal-actions">
            <button class="video-modal-control" type="button" data-video-maximize aria-label="Maximize video">⛶</button>
            <button class="video-modal-control" type="button" data-video-close aria-label="Close video">×</button>
          </div>
        </div>

        <div class="instagram-frame-wrap">
          <iframe
            src="${esc(embed)}"
            title="${esc(title)} Instagram video"
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>

        <div class="video-modal-footer">
          <p>Enjoying the look? Kindly like the post and follow our Instagram page for more Timzy styles.</p>
          <a href="${esc(url)}" target="_blank" rel="noopener" class="btn btn-outline btn-small">Open on Instagram</a>
        </div>
      </div>
    </div>
  `);

  document.body.classList.add('modal-open');
  setTimeout(()=>$('#productVideoModal')?.classList.add('is-visible'),10);
},

toggleMaximize(){
  const modal=$('#productVideoModal');
  if(!modal)return;
  modal.classList.toggle('is-maximized');
  const button=$('[data-video-maximize]',modal);
  if(button)button.textContent=modal.classList.contains('is-maximized')?'↙':'⛶';
},

close(){
  const modal=$('#productVideoModal');
  if(!modal)return;
  modal.classList.remove('is-visible');
  document.body.classList.remove('modal-open');
  setTimeout(()=>modal.remove(),180);
}},
whatsapp:{number(){return String(C().whatsapp).replace(/[^0-9]/g,'')},send(m){window.open(`https://wa.me/${App.whatsapp.number()}?text=${encodeURIComponent(m)}`,'_blank','noopener')},sendBag(){const c=App.cart.list();App.whatsapp.send(c.length?`Hi Timzy Fashion, I want to order:\n\n${c.map(x=>`- ${x.name} x${x.qty}`).join('\n')}\n\nTotal: ${money(App.cart.total())}`:'Hi Timzy Fashion, I want to make an enquiry.')}}};
document.addEventListener('DOMContentLoaded',App.init);window.Timzy=App;
})();
