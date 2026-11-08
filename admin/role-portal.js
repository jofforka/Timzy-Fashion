/* Role-specific Timzy operations. All sensitive mutations use server callables. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const fb=window.TIMZY_FIREBASE;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const money=v=>'₦'+Number(v||0).toLocaleString('en-NG');
const error=e=>String(e?.message||'Operation failed').slice(0,210);
const status=(id,s)=>{const el=$(id);if(el)el.textContent=s;};
let role='',users=[],products=[];
async function invoke(name,data){
 if(!fb?.functions)throw Error('Cloud Functions not deployed. Ask Super Admin to finish backend setup.');
 return (await fb.functions.httpsCallable(name)(data)).data;
}
async function getProfile(user){
 const d=await fb.db.collection('users').doc(user.uid).get();
 const p=d.exists?d.data():null;
 if(!p||p.active!==true||!['super_admin','staff','investor'].includes(p.role))throw Error('This login has no active Timzy role.');
 if(p.role==='investor'&&p.investorId!==user.uid)throw Error('Investor assignment is invalid.');
 return p;
}
function applyRole(r){
 role=r;
 // CSS enforces staff-only visibility. Do NOT unset [hidden] on inactive
 // views: doing so would display all admin panels at once.
 document.body.dataset.role=r;
}
async function renderInvestor(user,profile){
 const uid=user.uid;
 status('#investorIdentity',profile.displayName||user.email||'');
 const [c,s]=await Promise.all([
   fb.db.collection('investorCatalog').doc(uid).collection('items').get(),
   fb.db.collection('investorSales').doc(uid).collection('entries').get()
 ]);
 const items=c.docs.map(d=>d.data()),entries=s.docs.map(d=>d.data());
 status('#investorProductCount',String(items.length));
 status('#investorUnitsSold',String(entries.reduce((n,x)=>n+Number(x.units||0),0)));
 status('#investorAmountDue',money(entries.filter(x=>x.status!=='paid').reduce((n,x)=>n+Number(x.totalDue||0),0)));
 status('#investorAmountPaid',money(entries.filter(x=>x.status==='paid').reduce((n,x)=>n+Number(x.totalDue||0),0)));
 $('#investorProductsList').innerHTML=items.map(x=>`<div class="role-inventory-row"><div><strong>${esc(x.productName)}</strong><small>${esc(x.colour||'')} · Agreed payout per unit · ${x.active?'Active':'Inactive'}</small></div><b>${money(x.payoutPerUnit)}</b></div>`).join('')||'<p>No products assigned yet.</p>';
 entries.sort((a,b)=>String(b.soldAt||'').localeCompare(String(a.soldAt||'')));
 $('#investorSalesList').innerHTML=entries.map(x=>`<div class="role-inventory-row"><div><strong>${esc(x.productName)}</strong><small>${esc(x.soldAt||'')} · ${Number(x.units||0)} unit(s) × ${money(x.payoutPerUnit)} · ${x.status==='paid'?'Paid':'Amount due'}</small></div><b>${money(x.totalDue)}</b></div>`).join('')||'<p>No payouts recorded yet.</p>';
 status('#investorError','');
}
function options(id,rows,placeholder,label){
 const el=$(id);if(!el)return;
 const before=el.value;
 el.innerHTML='<option value="">'+placeholder+'</option>'+rows.map(x=>`<option value="${esc(x.id)}">${esc(label(x))}</option>`).join('');
 if(rows.some(x=>x.id===before))el.value=before;
}
function refreshSaleOptions(data){
 products=data||products;
 options('#saleProductId',products.filter(p=>Number.isSafeInteger(p.stockOnHand)&&p.stockOnHand>0&&String(p.status||'').toLowerCase()==='published'),'Choose verified stock',p=>p.name+' · '+p.stockOnHand+' in stock');
 if(!products.some(p=>Number.isSafeInteger(p.stockOnHand)&&p.stockOnHand>0))status('#saleStatus','No verified stock. Super Admin must set Stock on Hand before recording sales.');
}
async function dueSales(){
 const uid=$('#payoutInvestor')?.value;const el=$('#payoutSale');
 if(!el)return;
 el.innerHTML='<option value="">Select outstanding sale</option>';
 if(!uid||role!=='super_admin')return;
 const docs=await fb.db.collection('investorSales').doc(uid).collection('entries').get();
 el.innerHTML+=docs.docs.filter(d=>d.data().status==='due').map(d=>`<option value="${esc(d.id)}">${esc(d.data().productName)} · ${money(d.data().totalDue)} due</option>`).join('');
}
async function refreshAdminOptions(){
 if(role!=='super_admin')return;
 const [u,a,financial]=await Promise.all([
  fb.db.collection('users').get(),
  fb.db.collection('investorAgreements').get(),
  fb.db.collection('financeSales').get()
 ]);
 users=u.docs.map(d=>({id:d.id,...d.data()}));
 const investors=users.filter(x=>x.role==='investor'&&x.active===true);
 options('#agreementInvestor',investors,'Select investor',x=>x.displayName||x.email||x.id);
 options('#payoutInvestor',investors,'Select investor',x=>x.displayName||x.email||x.id);
 options('#agreementProduct',products,'Select product',x=>x.name||x.id);
 $('#accountsList').innerHTML=users.map(x=>`<div class="role-inventory-row"><div><strong>${esc(x.displayName||x.email||x.id)}</strong><small>${esc(x.role)} · ${esc(x.email||'')} · ${x.active?'Active':'Disabled'}</small></div>${x.role!=='super_admin'?`<button type="button" class="secondary-btn" data-toggle-uid="${esc(x.id)}" data-enable="${!x.active}">${x.active?'Disable':'Enable'}</button>`:'<span>Owner</span>'}</div>`).join('');
 $('#agreementsList').innerHTML=a.docs.map(d=>{
  const x=d.data(),owner=users.find(u=>u.id===x.investorUid),p=products.find(y=>y.id===x.productId);
  return `<div class="role-inventory-row"><div><strong>${esc(p?.name||x.productId)}</strong><small>${esc(owner?.displayName||owner?.email||x.investorUid)} · ${x.active?'Active':'Inactive'}</small></div><b>${money(x.payoutPerUnit)}/unit</b></div>`;
 }).join('')||'<p>No investor agreements yet.</p>';
 const records=financial.docs.map(doc=>({id:doc.id,...doc.data()}));
 status('#financeRetail',money(records.reduce((n,x)=>n+Number(x.actualRetailTotal||0),0)));
 status('#financePayout',money(records.reduce((n,x)=>n+Number(x.investorTotalDue||0),0)));
 status('#financeMargin',money(records.reduce((n,x)=>n+Number(x.grossMarginBeforeCosts||0),0)));
 $('#financeSalesList').innerHTML=records.map(x=>{
  const product=products.find(p=>p.id===x.productId);
  return `<div class="role-inventory-row"><div><strong>${esc(product?.name||x.productId)}</strong>
    <small>${Number(x.quantity||0)} unit(s) · Sold for ${money(x.actualRetailTotal)} · Investor payout ${money(x.investorTotalDue)} · ${esc(x.status||'due')}</small></div>
    <b>Margin ${money(x.grossMarginBeforeCosts)}</b></div>`;
 }).join('')||'<p>No investor-linked sales yet.</p>';
 await dueSales();
}
async function operational(r,rows){applyRole(r);refreshSaleOptions(rows);if(r==='super_admin')await refreshAdminOptions();}
function freshId(){
 if(!window.crypto?.getRandomValues)throw Error('Secure browser required.');
 const bytes=new Uint8Array(20);window.crypto.getRandomValues(bytes);
 return 'sale_'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
function bindForm(formId,selector,fn){
 const form=$(formId);if(!form)return;
 form.addEventListener('submit',async e=>{
  e.preventDefault();const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;
  status(selector,'Saving…');
  try{await fn(Object.fromEntries(new FormData(form).entries()),form);}
  catch(err){status(selector,error(err));}
  finally{if(btn)btn.disabled=false;}
 });
}
function bind(){
 bindForm('#saleForm','#saleStatus',async(d,form)=>{
  if(!['staff','super_admin'].includes(role))throw Error('Not authorized.');
  const result=await invoke('recordSale',{requestId:freshId(),productId:d.productId,quantity:Number(d.quantity),unitSalePrice:Number(d.unitSalePrice),customerReference:d.customerReference||''});
  form.reset();status('#saleStatus',result.alreadyRecorded?'Already recorded':'Sale recorded and inventory updated.');
  if(window.TimzyRefreshOperations)await window.TimzyRefreshOperations();
 });
 $('#saleProductId')?.addEventListener('change',e=>{
  const p=products.find(x=>x.id===e.target.value);
  if(p)$('#saleForm').elements.unitSalePrice.value=Number(p.salePrice)>0?p.salePrice:p.price;
 });
 bindForm('#createAccountForm','#accountStatus',async(d,form)=>{
  if(role!=='super_admin')throw Error('Not authorized.');
  const a=await invoke('provisionUser',d);
  let response='Created account for '+a.email+'.';
  try{await fb.auth.sendPasswordResetEmail(a.email);response+=' Password-setup email sent.';}
  catch(err){response+=' Setup email failed. Resend through Firebase Authentication; do not create another account.';}
  status('#accountStatus',response);form.reset();await refreshAdminOptions();
 });
 bindForm('#agreementForm','#agreementStatus',async(d,form)=>{
  if(role!=='super_admin')throw Error('Not authorized.');
  await invoke('saveInvestorAgreement',{productId:d.productId,investorUid:d.investorUid,payoutPerUnit:Number(d.payoutPerUnit)});
  status('#agreementStatus','Agreement saved; applies to future sales only.');form.reset();await refreshAdminOptions();
 });
 bindForm('#payoutForm','#payoutStatus',async(d,form)=>{
  if(role!=='super_admin')throw Error('Not authorized.');
  await invoke('markInvestorPayout',d);
  status('#payoutStatus','Payout marked paid. No funds were transferred by this action.');
  form.reset();await refreshAdminOptions();
 });
 $('#payoutInvestor')?.addEventListener('change',()=>dueSales().catch(e=>status('#payoutStatus',error(e))));
 $('#accountsList')?.addEventListener('click',async e=>{
  const button=e.target.closest('[data-toggle-uid]');if(!button||role!=='super_admin')return;
  if(!window.confirm('Change this account access?'))return;
  button.disabled=true;
  try{await invoke('setAccountActive',{uid:button.dataset.toggleUid,active:button.dataset.enable==='true'});await refreshAdminOptions();}
  catch(err){status('#accountStatus',error(err));button.disabled=false;}
 });
 $('#investorSignOut')?.addEventListener('click',()=>fb?.auth?.signOut());
 $('#deniedSignOut')?.addEventListener('click',()=>fb?.auth?.signOut());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
window.TimzyRolePortal={getProfile,applyRole,operational,renderInvestor,refreshSaleOptions,refreshAdminOptions};
})();