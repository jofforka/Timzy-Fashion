/* Role-specific Timzy operations. All sensitive mutations use server callables. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const fb=window.TIMZY_FIREBASE;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const money=v=>'₦'+Number(v||0).toLocaleString('en-NG');
const error=e=>String(e?.message||'Operation failed').slice(0,210);
const status=(id,s)=>{const el=$(id);if(el)el.textContent=s;};
let role='',users=[],products=[],agreements=[];
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
 const [c,s,h]=await Promise.all([
   fb.db.collection('investorCatalog').doc(uid).collection('items').get(),
   fb.db.collection('investorSales').doc(uid).collection('entries').get(),
   fb.db.collection('investorCatalog').doc(uid).collection('history')
     .orderBy('changedAt','desc').limit(80).get()
 ]);
 const items=c.docs.map(d=>d.data()),entries=s.docs.map(d=>d.data());
 const validEntries=entries.filter(x=>x.status!=='reversed');
 status('#investorProductCount',String(items.length));
 status('#investorUnitsSold',String(validEntries.reduce((n,x)=>n+Number(x.units||0),0)));
 status('#investorAmountDue',money(validEntries.filter(x=>x.status==='due').reduce((n,x)=>n+Number(x.totalDue||0),0)));
 status('#investorAmountPaid',money(validEntries.filter(x=>x.status==='paid').reduce((n,x)=>n+Number(x.totalDue||0),0)));
 $('#investorProductsList').innerHTML=items.map(x=>`<div class="role-inventory-row"><div><strong>${esc(x.productName)}</strong><small>${esc(x.colour||'')} · Agreed payout per unit · ${x.active?'Active':'Inactive'}</small></div><b>${money(x.payoutPerUnit)}</b></div>`).join('')||'<p>No products assigned yet.</p>';
 entries.sort((a,b)=>String(b.soldAt||'').localeCompare(String(a.soldAt||'')));
 $('#investorSalesList').innerHTML=entries.map(x=>`<div class="role-inventory-row"><div><strong>${esc(x.productName)}</strong><small>${esc(x.soldAt||'')} · ${Number(x.units||0)} unit(s) × ${money(x.payoutPerUnit)} · ${x.status==='paid'?'Paid':x.status==='reversed'?'Reversed / no payout due':'Amount due'}</small></div><b>${money(x.totalDue)}</b></div>`).join('')||'<p>No payouts recorded yet.</p>';
 const history=h.docs.map(d=>d.data());
 $('#investorHistoryList').innerHTML=history.map(change=>{
   const prior=Number.isSafeInteger(change.previousPayoutPerUnit)
     ? money(change.previousPayoutPerUnit) : 'New agreement';
   const next=money(change.payoutPerUnit);
   const stamp=change.changedAt?.toDate?.()?.toLocaleString('en-NG')||'Date pending';
   return `<div class="role-inventory-row"><div><strong>${esc(change.productName||change.productId)} · Version ${Number(change.version||1)}</strong>
     <small>${esc(stamp)} · ${esc(change.changeReason||'')} · ${change.active?'Active':'Paused'}</small></div><b>${prior} → ${next}</b></div>`;
 }).join('')||'<p>No agreement changes recorded yet.</p>';
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
 const [u,a,financial,audit]=await Promise.all([
  fb.db.collection('users').get(),
  fb.db.collection('investorAgreements').get(),
  fb.db.collection('financeSales').get(),
  fb.db.collection('auditEvents').where('action','==','agreement_amended').limit(70).get()
 ]);
 agreements=a.docs.map(d=>({id:d.id,...d.data()}));
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
 const auditRows=audit.docs.map(d=>d.data()).sort((x,y)=>
   (y.createdAt?.seconds||0)-(x.createdAt?.seconds||0)).slice(0,40);
 $('#agreementHistoryList').innerHTML=auditRows.map(h=>{
  const p=products.find(x=>x.id===h.productId),u=users.find(x=>x.id===h.investorUid);
  const previous=Number.isSafeInteger(h.previousPayoutPerUnit)
    ? money(h.previousPayoutPerUnit) : 'New agreement';
  return `<div class="role-inventory-row"><div><strong>${esc(p?.name||h.productId)} · v${Number(h.version||1)}</strong>
    <small>${esc(u?.displayName||u?.email||h.investorUid)} · ${esc(h.changeReason||'')} · ${h.active?'Active':'Paused'}</small></div>
    <b>${previous} → ${money(h.payoutPerUnit)}</b></div>`;
 }).join('')||'<p>No amendments recorded yet.</p>';
 const records=financial.docs.map(doc=>({id:doc.id,...doc.data()}));
 const posted=records.filter(x=>x.status!=='reversed');
 status('#financeRetail',money(posted.reduce((n,x)=>n+Number(x.actualRetailTotal||0),0)));
 status('#financePayout',money(posted.reduce((n,x)=>n+Number(x.investorTotalDue||0),0)));
 status('#financeMargin',money(posted.reduce((n,x)=>n+Number(x.grossMarginBeforeCosts||0),0)));
 $('#financeSalesList').innerHTML=records.map(x=>{
  const product=products.find(p=>p.id===x.productId);
  return `<div class="role-inventory-row"><div><strong>${esc(product?.name||x.productId)}</strong>
    <small>${Number(x.quantity||0)} unit(s) · Sold for ${money(x.actualRetailTotal)} · Investor payout ${money(x.investorTotalDue)} · ${esc(x.status||'due')}</small></div>
    <b>Margin ${money(x.grossMarginBeforeCosts)}</b></div>`;
 }).join('')||'<p>No investor-linked sales yet.</p>';
 await dueSales();
}
function refreshReversalOptions(rows){
 if(role!=='super_admin')return;
 options('#reverseSaleId',rows.filter(x=>x.receiptCode && x.status!=='reversed'),
   'Select a completed sale',x=>
   x.receiptCode+' · '+(x.productName||x.description||x.productId||'Product')+' · '+money(x.amount));
}
async function operational(r,rows){applyRole(r);refreshSaleOptions(rows);if(r==='super_admin')await refreshAdminOptions();}
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
  const result=await invoke('recordSale',{receiptCode:d.receiptCode,lineNumber:Number(d.lineNumber),productId:d.productId,quantity:Number(d.quantity),unitSalePrice:Number(d.unitSalePrice),customerReference:d.customerReference||''});
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
  const agreement=agreements.find(x=>x.productId===d.productId);
  if(agreement && agreement.investorUid!==d.investorUid){
    throw Error('This product already belongs to another investor. Create a separate SKU for a separate owner.');
  }
  if(agreement && (Number(agreement.payoutPerUnit)!==Number(d.payoutPerUnit) ||
      agreement.active!==(d.active==='true')) &&
      !window.confirm('Confirm the investor has agreed to these new terms and this change is documented?')){
    throw Error('Amendment cancelled.');
  }
  await invoke('saveInvestorAgreement',{
    productId:d.productId,investorUid:d.investorUid,payoutPerUnit:Number(d.payoutPerUnit),
    active:d.active==='true',changeReason:d.changeReason
  });
  status('#agreementStatus','Agreement change recorded. Existing sale payouts remain unchanged.');
  form.reset();await refreshAdminOptions();
 });
 bindForm('#payoutForm','#payoutStatus',async(d,form)=>{
  if(role!=='super_admin')throw Error('Not authorized.');
  await invoke('markInvestorPayout',d);
  status('#payoutStatus','Payout marked paid. No funds were transferred by this action.');
  form.reset();await refreshAdminOptions();
 });
 bindForm('#reverseSaleForm','#reverseSaleStatus',async(d,form)=>{
  if(role!=='super_admin')throw Error('Super Admin only.');
  if(d.kind==='customer_refunded' && (!d.refundReference || d.refundReference.trim().length<5)){
    throw Error('Enter the reference of the refund already completed.');
  }
  const confirmText=d.kind==='entry_error'
    ? 'Confirm this was an incorrect sale entry and no customer refund is required?'
    : 'Confirm the customer was ALREADY refunded outside this system? No money will be sent.';
  if(!window.confirm(confirmText))throw Error('Reversal cancelled.');
  const result=await invoke('reverseSale',{
    saleId:d.saleId, kind:d.kind, reason:d.reason, refundReference:d.refundReference||'',
    restock:d.kind==='entry_error'||d.restock==='true'
  });
  form.reset();
  if(window.TimzyRefreshOperations)await window.TimzyRefreshOperations();
  await refreshAdminOptions();
  status('#reverseSaleStatus','Reversal recorded. '+
    (result.restocked?'Verified stock restored to '+result.restoredStock+'. ':
      'No stock returned to saleable inventory. ')+
    'Original transaction preserved for audit.');
 },'#reverseSaleStatus');
 $('#agreementProduct')?.addEventListener('change',event=>{
  const a=agreements.find(x=>x.productId===event.target.value);
  if(!a)return;
  const form=$('#agreementForm');if(!form)return;
  form.elements.investorUid.value=a.investorUid;
  form.elements.payoutPerUnit.value=a.payoutPerUnit;
  form.elements.active.value=String(a.active);
  status('#agreementStatus','Current agreement version '+(a.version||1)+
    '. Amendments affect future sales only. Provide a signed reference for each change.');
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
window.TimzyRolePortal={getProfile,applyRole,operational,renderInvestor,refreshSaleOptions,refreshReversalOptions,refreshAdminOptions};
})();