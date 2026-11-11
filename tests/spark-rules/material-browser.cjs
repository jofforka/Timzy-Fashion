/* Real DOM + Firestore Emulator. No production credentials or writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const {initializeTestEnvironment} = require('@firebase/rules-unit-testing');
const root = process.cwd();
const ownerId='sCkXSrVIlHNGBoufFtirvLBvaTi1';
const manifest=JSON.parse(fs.readFileSync('data/material-variants.draft.json'));
const bootstrap = admin => `
 firebase.initializeApp({projectId:'demo-timzy-spark',apiKey:'demo',authDomain:'localhost'});
 const db=firebase.firestore();
 db.useEmulator('127.0.0.1',8080, ${admin ? `{mockUserToken:{sub:'${ownerId}'}}` : '{}'});
 window.TIMZY_FIREBASE={db,auth:{onAuthStateChanged(fn){setTimeout(()=>fn(${admin ? `{uid:'${ownerId}',email:'test@example.test'}` : 'null'}),0);}}};
`;
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-timzy-spark',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 await env.clearFirestore();
 const server=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost');
   const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
   try {const body=fs.readFileSync(file);res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','json':'application/json','css':'text/css','webp':'image/webp','jpg':'image/jpeg'})[file.split('.').pop()]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const errors=[];
 async function page(admin=false,viewport={width:1280,height:900}){
   const context=await browser.newContext({viewport});
   await context.route('https://www.gstatic.com/firebasejs/**',async route=>{
     const name=new URL(route.request().url()).pathname.split('/').pop();
     if(name==='firebase-auth-compat.js')return route.fulfill({body:'',contentType:'text/javascript'});
     return route.fulfill({body:fs.readFileSync(path.join(__dirname,'node_modules/firebase',name)),contentType:'text/javascript'});
   });
   await context.route('**/assets/js/firebase.js',route=>route.fulfill({body:bootstrap(admin),contentType:'text/javascript'}));
   await context.route('https://fonts.googleapis.com/**',route=>route.abort());
   const p=await context.newPage();p.on('pageerror',e=>{errors.push(e.message);console.error('Browser page error:',e.message);});return p;
 }
 try{
   const admin=await page(true);
   await admin.goto(base+'/admin/index.html');
   await admin.waitForFunction(()=>window.TimzyAdmin?.state.role==='admin');
   await admin.locator('[data-view="products"]').first().click();
   await admin.locator('#seedFabricDrafts').click();
   await admin.waitForFunction(()=>window.TimzyAdmin.state.products.length===3);
   const drafts=await admin.evaluate(()=>window.TimzyAdmin.state.products);
   assert.equal(drafts.reduce((n,p)=>n+p.variants.length,0),14);
   assert(drafts.every(p=>p.status==='Draft'&&p.price===null&&p.variants.every(v=>v.price===null&&v.stockOnHand===null&&v.sizes.length===0)));
   // Idempotency: existing merchant data stays untouched.
   await admin.evaluate(async()=>{await TIMZY_FIREBASE.db.collection('products').doc('alabamu').update({description:'Merchant-owned description'});});
   await admin.locator('#seedFabricDrafts').click();
   await admin.waitForFunction(()=>window.TimzyAdmin.state.products.find(p=>p.id==='alabamu')?.description==='Merchant-owned description');
   await admin.locator('[data-edit-product="sanrose"]').click();
   await admin.waitForFunction(()=>[...document.querySelectorAll('#imagePreviewGrid img')].every(i=>i.complete&&i.naturalWidth===1000));
   assert.equal(await admin.locator('#imagePreviewGrid img').count(),8);
   assert.equal(await admin.locator('[name="price"]').inputValue(),'');
   // Save the unpriced draft through the actual admin form + rules.
   await admin.locator('#productForm').evaluate(f=>f.requestSubmit());
   await admin.waitForFunction(()=>document.querySelector('#productModal').hidden);
   // Publication and purchase fixtures exist only inside the emulator.
   await admin.evaluate(async()=>{
     for(const p of window.TimzyAdmin.state.products) await TIMZY_FIREBASE.db.collection('products').doc(p.id).update({status:'Published'});
   });
   console.log('PASS: Admin import, idempotency, eight-image preview and save through Firestore.');
   const shop=await page(false,{width:390,height:844});
   await shop.goto(base+'/shop.html?section=materials');
   await shop.waitForFunction(()=>document.querySelectorAll('#productGrid [data-product-id]').length===3);
   assert.equal(await shop.locator('#productGrid [data-product-id]').count(),3);
   assert(!await shop.locator('#productGrid').textContent().then(s=>s.includes('₦0')));
   for(const product of manifest.products){
     await shop.goto(base+'/product.html?id='+product.id);
     await shop.locator('#fabricColor').waitFor();
     for(let i=0;i<product.variants.length;i++){
       await shop.locator('#fabricColor').selectOption(String(i));
       await shop.waitForFunction(()=>document.querySelector('#mainImage')?.complete&&document.querySelector('#mainImage').naturalWidth===1000);
       assert((await shop.locator('#mainImage').getAttribute('src')).endsWith(product.variants[i].image));
       assert(await shop.locator('[data-purchase-action="bag"]').isDisabled());
       await shop.locator('[data-thumb="'+i+'"]').click();
       assert.equal(await shop.locator('#fabricColor').inputValue(),String(i));
     }
   }
   console.log('PASS: Exactly three mobile material cards and all 14 color/image choices, with unknown purchases blocked.');
   // Browser regression: variant selection, gallery navigation, touch swipe and photographic zoom.
   await shop.goto(base+'/product.html?id=alabamu');
   await shop.locator('.angle-explorer [data-angle-next]').waitFor();
   await shop.locator('#fabricColor').selectOption('1');
   assert.equal(await shop.locator('.angle-explorer [data-angle-status]').textContent(),'Photo 2 of 3 · supplied images');
   assert.equal(await shop.locator('[data-thumb="1"]').getAttribute('aria-pressed'),'true');
   await shop.locator('.angle-explorer [data-angle-next]').click();
   assert.equal(await shop.locator('#fabricColor').inputValue(),'2');
   assert.equal(await shop.locator('.angle-explorer [data-angle-status]').textContent(),'Photo 3 of 3 · supplied images');
   await shop.locator('#mainImage').dispatchEvent('touchstart',{touches:[{identifier:1,target:document.body,clientX:260,clientY:200}]});
   await shop.locator('#mainImage').dispatchEvent('touchend',{changedTouches:[{identifier:1,target:document.body,clientX:100,clientY:205}]});
   assert.equal(await shop.locator('#fabricColor').inputValue(),'0','Horizontal swipe wraps to first photo');
   await shop.locator('.fabric-zoom-trigger').click();
   await shop.locator('.fabric-zoom-dialog').waitFor({state:'visible'});
   await shop.locator('[data-zoom-in]').click();
   assert.equal(await shop.locator('[data-zoom-level]').textContent(),'130%');
   await shop.keyboard.press('0');
   assert.equal(await shop.locator('[data-zoom-level]').textContent(),'100%');
   await shop.keyboard.press('Escape');
   assert.equal(await shop.locator('.fabric-zoom-dialog').evaluate(el=>el.open),false);
   console.log('PASS: Mobile fabric gallery color sync, navigation, swipe and zoom controls.');

   // Verified test fixture: color + unit + quantity survive basket and WhatsApp.
   await admin.evaluate(async()=>{
     const ref=TIMZY_FIREBASE.db.collection('products').doc('alabamu');
     const p=(await ref.get()).data();p.variants[0]={...p.variants[0],price:100,stockOnHand:3,sizes:['yard','metre']};await ref.update({variants:p.variants});
   });
   await shop.goto(base+'/product.html?id=alabamu');
   await shop.locator('#selectedSize').selectOption('yard');
   await shop.locator('#selectedQuantity').fill('2');
   await shop.locator('[data-purchase-action="bag"]').click();
   const item=await shop.evaluate(()=>Timzy.cart.list()[0]);
   assert.equal(item.variantColor,'Teal Green');assert.equal(item.size,'yard');assert.equal(item.qty,2);
   await shop.locator('#selectedSize').selectOption('metre');
   await shop.locator('[data-purchase-action="bag"]').click();
   assert.equal(await shop.evaluate(()=>Timzy.cart.list().length),1,'Stock is shared across unit/size basket rows');
   const message=await shop.evaluate(()=>Timzy.checkout.message({name:'Test',phone:'Test'}));
   assert(message.includes('Teal Green — yard x2'));
   assert.equal(await shop.evaluate(()=>Timzy.cart.validationError()),'');
   await admin.evaluate(async()=>{const ref=TIMZY_FIREBASE.db.collection('products').doc('alabamu');const p=(await ref.get()).data();p.variants[0].price=200;await ref.update({variants:p.variants});});
   await shop.goto(base+'/checkout.html');
   await shop.waitForFunction(()=>Timzy.products.some(p=>p.id==='alabamu'));
   assert.match(await shop.evaluate(()=>Timzy.cart.validationError()),/changed price/);
   // Discovery details are isolated test fixtures, never invented live claims.
   await admin.evaluate(async()=>{
     for(const id of ['alabamu','sanrose']) await TIMZY_FIREBASE.db.collection('fabricProfiles').doc(id).set({composition:'Test composition',weight:'Test weight',feel:'Test feel',breathability:'Test airflow',care:'Test care',uses:'Test use',videoUrl:'https://example.com/fabric.mp4',occasions:['work']});
   });
   await shop.goto(base+'/shop.html?section=materials');
   await shop.locator('#compareFirst').selectOption('alabamu');
   await shop.locator('#compareSecond').selectOption('sanrose');
   await shop.locator('#compareFabrics').click();
   assert((await shop.locator('#studioComparison').textContent()).includes('Test composition'));
   await shop.locator('#studioOccasion').selectOption('work');
   assert.equal(await shop.locator('#productGrid [data-product-id]').count(),2);
   await shop.locator('#studioOccasion').selectOption('graduation');
   assert.equal(await shop.locator('#productGrid [data-product-id]').count(),0);
   assert.match(await shop.locator('#studioStatus').textContent(),/No materials are tagged/);
   await shop.goto(base+'/product.html?id=alabamu');
   await shop.locator('#createFabricLook').waitFor();
   assert.equal(await shop.locator('video.studio-video').count(),1);
   await shop.locator('#fabricColor').selectOption('1');
   await shop.locator('#createFabricLook').click();
   await shop.locator('#styleBriefForm').waitFor();
   assert.equal(await shop.locator('#styleBriefForm [name="material"]').inputValue(),'alabamu');
   assert.equal(await shop.locator('#styleBriefForm [name="color"]').inputValue(),'Black');
   assert.equal(await shop.locator('.floating-whatsapp').getAttribute('href'),'https://wa.me/2348114599250');
   await shop.locator('#styleBriefForm [name="idea"]').fill('A test style idea');
   await shop.locator('#saveStyleBrief').click();
   await shop.reload();
   await shop.locator('#styleBriefForm').waitFor();
   assert.equal(await shop.locator('#styleBriefForm [name="idea"]').inputValue(),'A test style idea');
   await shop.locator('#clearStyleBrief').click();
   assert.equal(await shop.evaluate(()=>localStorage.getItem('timzy.styleBrief.v1')),null);
   console.log('PASS: Merchant fabric specs/video, comparison, honest occasion filtering, color-aware brief links, local save/reload/clear.');
   // Legacy product size IDs remain accepted by shared checkout validation.
   await admin.evaluate(async()=>TIMZY_FIREBASE.db.collection('products').doc('legacy').set({name:'Existing outfit',category:'Senator',status:'Published',price:500,sizes:'M, L'}));
   await shop.goto(base+'/product.html?id=legacy');
   await shop.locator('#selectedSize').selectOption('M');
   await shop.evaluate(()=>Timzy.cart.save([]));
   await shop.locator('[data-purchase-action="bag"]').click();
   assert.equal(await shop.evaluate(()=>Timzy.cart.validationError()),'');
   assert.deepEqual(errors,[]);
   console.log('PASS: Chromium mobile storefront, all 14 images/colors, 3 cards, admin draft import/edit/save, idempotency, Firebase writes, blocked unknown commerce, variant basket/WhatsApp, stale price and legacy outfit.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
