/* Progressive catalogue discovery. Uses published Firestore products only. */
(()=>{
 'use strict';
 const app=window.Timzy, fabric=window.TimzyFabric;
 if(!app||!fabric)return;
 const load=app.loadProducts.bind(app);
 app.loadProducts=async()=>{
  await load();const db=window.TIMZY_FIREBASE?.db;if(!db)return;
  await Promise.all(fabric.liveMaterials(app.products).map(async product=>{
   try{const snapshot=await db.collection('fabricProfiles').doc(String(product.id)).get();product.raw.fabricProfile=snapshot.exists?snapshot.data():{};}
   catch{product.raw.fabricProfile={};}
  }));
 };
 const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
 const label=s=>s||'Not provided by Timzy yet';
 const options=(rows,placeholder)=>`<option value="">${esc(placeholder)}</option>`+rows.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
 const occasionOptions=()=>Object.entries(fabric.occasions).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
 function setupShop(){
  const grid=document.querySelector('#productGrid');if(!grid)return;
  const panel=document.createElement('section');panel.className='material-studio';panel.setAttribute('aria-labelledby','studioTitle');
  panel.innerHTML=`<span class="eyebrow">The Timzy fabric studio</span><h2 id="studioTitle">Find the fabric for your next look.</h2><p>Explore by occasion or compare the details Timzy has provided. Shade, feel and fit are best confirmed with the studio.</p><div class="studio-tools"><label>Shop by occasion<select class="field" id="studioOccasion"><option value="">All occasions</option>${occasionOptions()}</select></label><label>First fabric<select class="field" id="compareFirst"></select></label><label>Second fabric<select class="field" id="compareSecond"></select></label><button class="btn btn-outline" id="compareFabrics" type="button">Compare fabrics</button></div><p class="studio-status" id="studioStatus" role="status" aria-live="polite"></p><div id="studioComparison" class="studio-compare"></div><a class="studio-link" href="build-your-look.html">Create a look with a fabric →</a>`;
  grid.before(panel);
  const originalFilter=app.catalog.filtered.bind(app.catalog);
  app.catalog.filtered=()=>{const choice=panel.querySelector('#studioOccasion').value;return originalFilter().filter(p=>app.activeCategory!=='Materials'||!choice||fabric.profile(p).occasions.includes(choice));};
  const render=app.catalog.render.bind(app.catalog);
  app.catalog.render=()=>{render();panel.hidden=app.activeCategory!=='Materials';const rows=fabric.liveMaterials(app.products);for(const id of ['compareFirst','compareSecond']){const select=panel.querySelector('#'+id),old=select.value;select.innerHTML=options(rows,'Choose a fabric');if(rows.some(p=>p.id===old))select.value=old;}panel.querySelector('#studioStatus').textContent=panel.querySelector('#studioOccasion').value&&!app.catalog.filtered().length?'No materials are tagged for this occasion yet. Choose All occasions or ask Timzy for advice.':'';};
  panel.querySelector('#studioOccasion').addEventListener('change',()=>app.catalog.render());
  panel.querySelector('#compareFabrics').addEventListener('click',()=>{
   const ids=['compareFirst','compareSecond'].map(id=>panel.querySelector('#'+id).value);
   const rows=ids.map(id=>fabric.liveMaterials(app.products).find(p=>p.id===id));
   const status=panel.querySelector('#studioStatus'),target=panel.querySelector('#studioComparison');
   if(rows.some(p=>!p)||ids[0]===ids[1]){target.replaceChildren();status.textContent='Choose two different published fabrics to compare.';return;}
   const profiles=rows.map(fabric.profile);
   const values=[['Available colors',p=>(p.variants||[]).map(v=>v.color).join(', ')||p.color||''],...Object.entries(fabric.fields).map(([key,name])=>[name,(_,i)=>profiles[i][key]]),['Occasions',(_,i)=>profiles[i].occasions.map(o=>fabric.occasions[o]).join(', ')]];
   target.innerHTML=`<table><caption>Merchant-provided details. Missing specifications are shown explicitly.</caption><thead><tr><th scope="col">Detail</th>${rows.map(p=>`<th scope="col"><a href="${esc(app.url(p))}">${esc(p.name)}</a></th>`).join('')}</tr></thead><tbody>${values.map(([name,get])=>`<tr><th scope="row">${esc(name)}</th>${rows.map((p,i)=>`<td>${esc(label(get(p,i)))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
   status.textContent='Comparison ready below.';
  });
 }
 function setupProduct(){
  const init=app.product.init.bind(app.product);
  app.product.init=()=>{
   init();const id=new URLSearchParams(location.search).get('id');const p=fabric.liveMaterials(app.products).find(p=>String(p.id)===id);const detail=document.querySelector('#productDetails .detail-card');if(!p||!detail)return;
   const profile=fabric.profile(p),panel=document.createElement('section');panel.className='material-studio';panel.setAttribute('aria-label','Fabric details and styling');
   panel.innerHTML=`<span class="eyebrow">Know your fabric</span><h2>Details that make the difference.</h2><dl class="studio-specs">${Object.entries(fabric.fields).map(([key,name])=>`<div><dt>${name}</dt><dd>${esc(label(profile[key]))}</dd></div>`).join('')}</dl>${profile.videoUrl?`<h3>Feel the fabric in motion</h3><video class="studio-video" controls playsinline preload="none" aria-label="${esc(p.name)} fabric movement video"><source src="${esc(profile.videoUrl)}"></video><p class="studio-muted">Visual texture demonstration. Confirm the physical shade with Timzy.</p>`:'<p class="studio-empty">A fabric movement video has not been added yet. Ask Timzy for a close-up before ordering.</p>'}<a class="btn btn-outline" id="createFabricLook" href="build-your-look.html?material=${encodeURIComponent(p.id)}">Create a look with this material →</a>`;
   detail.append(panel);
   const sync=()=>{const index=Number(document.querySelector('#fabricColor')?.value||0);const color=p.variants?.[index]?.color||'';panel.querySelector('#createFabricLook').href='build-your-look.html?material='+encodeURIComponent(p.id)+(color?'&color='+encodeURIComponent(color):'');};
   document.querySelector('#fabricColor')?.addEventListener('change',sync);sync();
  };
 }
 function setupBrief(){
  const root=document.querySelector('#styleBrief');if(!root)return;
  const original=app.builder.init.bind(app.builder);
  app.builder.init=()=>{original();const rows=fabric.liveMaterials(app.products);root.innerHTML=`<section class="material-studio"><span class="eyebrow">Your next signature look</span><h2>Start with a fabric. Make it yours.</h2><p>Prepare a style enquiry for Timzy. Fabric and tailoring are quoted separately after the studio confirms your choices.</p><div class="studio-brief"><form id="styleBriefForm"><label>Material<select class="field" name="material" required>${options(rows,'Choose a published material')}</select></label><label>Color<select class="field" name="color"><option value="">Confirm with Timzy</option></select></label><label>Occasion<select class="field" name="occasion"><option value="">Choose an occasion (optional)</option>${occasionOptions()}</select></label><label>Style idea<textarea class="field" name="idea" rows="3" maxlength="600" placeholder="Describe your preferred outfit or finish. Do not enter measurements or personal details."></textarea></label><p class="studio-muted">Saved briefs stay on this browser. They are not sent until you choose to share and send the WhatsApp message.</p><div class="studio-actions"><button class="btn btn-outline" type="button" id="saveStyleBrief">Save on this device</button><button class="btn btn-primary" type="submit">Share brief on WhatsApp</button><button class="btn btn-outline" type="button" id="clearStyleBrief">Clear saved brief</button></div><p id="briefStatus" class="studio-status" role="status" aria-live="polite"></p></form><div class="studio-preview" id="briefPreview"></div></div></section>`;
   const form=root.querySelector('form'),status=root.querySelector('#briefStatus');
   let saved={};try{saved=JSON.parse(localStorage.getItem('timzy.styleBrief.v1')||'{}')||{};}catch{}
   const params=new URLSearchParams(location.search);const requested=params.get('material')||saved.material;
   if(rows.some(p=>String(p.id)===requested))form.elements.material.value=requested;
   form.elements.idea.value=typeof saved.idea==='string'?saved.idea.slice(0,600):'';
   if(Object.hasOwn(fabric.occasions,saved.occasion))form.elements.occasion.value=saved.occasion;
   const update=()=>{const p=rows.find(p=>String(p.id)===form.elements.material.value);const old=form.elements.color.value;form.elements.color.innerHTML='<option value="">Confirm with Timzy</option>'+(p?.variants||[]).map(v=>`<option value="${esc(v.color)}">${esc(v.color)}</option>`).join('');if(p?.variants?.some(v=>v.color===old))form.elements.color.value=old;show();};
   const show=()=>{const p=rows.find(p=>String(p.id)===form.elements.material.value),v=p?.variants?.find(v=>v.color===form.elements.color.value);root.querySelector('#briefPreview').innerHTML=p?`<img src="${esc(v?.image||app.image(p))}" alt="${esc(p.name)}${v?' — '+esc(v.color):''}"><h3>${esc(p.name)}</h3><p>Material, tailoring price and availability will be confirmed by Timzy. This brief does not reserve stock or place an order.</p>`:'<p class="studio-empty">Choose a material to start your brief. Unpublished drafts are not available here.</p>';};
   update();const desiredColor=params.get('color')||saved.color;if(rows.find(p=>p.id===requested)?.variants?.some(v=>v.color===desiredColor)){form.elements.color.value=desiredColor;show();}
   form.elements.material.addEventListener('change',update);form.elements.color.addEventListener('change',show);
   const values=()=>({material:form.elements.material.value,color:form.elements.color.value,occasion:form.elements.occasion.value,idea:form.elements.idea.value.trim().slice(0,600)});
   root.querySelector('#saveStyleBrief').onclick=()=>{if(!form.reportValidity())return;try{localStorage.setItem('timzy.styleBrief.v1',JSON.stringify(values()));status.textContent='Style brief saved on this device.';}catch{status.textContent='This browser could not save the brief. You can still share it.';}};
   root.querySelector('#clearStyleBrief').onclick=()=>{try{localStorage.removeItem('timzy.styleBrief.v1');}catch{}form.reset();update();status.textContent='Saved style brief cleared.';};
   form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;const d=values(),p=rows.find(p=>String(p.id)===d.material);if(!p)return;app.whatsapp.send(`Timzy style enquiry\nMaterial: ${p.name}\nColor: ${d.color||'Please advise'}\nOccasion: ${fabric.occasions[d.occasion]||'Not specified'}\nStyle idea: ${d.idea||'Please advise'}\nPlease quote fabric and tailoring separately and confirm availability. This is an enquiry, not a confirmed order.`);status.textContent='WhatsApp opened. Review and send the message there to share your brief.';};
  };
 }
 if(document.body.classList.contains('page-shop'))setupShop();
 if(document.body.classList.contains('page-product'))setupProduct();
 if(document.body.classList.contains('page-builder'))setupBrief();
})();
