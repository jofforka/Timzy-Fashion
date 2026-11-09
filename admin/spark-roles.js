/* Spark-only permissions and private investor products: no callable Functions. */
(() => {
  'use strict';
  const {state,escapeHTML:esc,money,toast,imageOf} = window.TimzyAdmin;
  const db = window.TIMZY_FIREBASE?.db;
  const $ = id => document.getElementById(id);
  let accounts = [];
  const now = () => firebase.firestore.FieldValue.serverTimestamp();
  const items = uid => db.collection('investorCatalog').doc(uid).collection('items');
  const validUid = uid => /^[A-Za-z0-9_-]{1,128}$/.test(uid);
  const owner = () => state.role === 'admin';

  function productRows(rows, editable = false) {
    return rows.map(p => `<article class="compact-item">
      <img src="${esc(p.image || '../assets/img/hero-senator-grey.jpg')}" alt="${esc(p.name)}" onerror="this.src='../assets/img/hero-senator-grey.jpg'">
      <div><b>${esc(p.name)}</b><small>Agreed unit price: ${money(p.agreedPrice)}</small><small>Agreement: ${esc(p.reference)}</small>
      ${editable ? `<button type="button" data-edit-allocation="${esc(p.productId)}">Edit current agreement</button><button type="button" data-remove-allocation="${esc(p.productId)}">Remove assignment</button>` : ''}</div>
    </article>`).join('') || '<p>No products assigned yet.</p>';
  }
  async function loadPortfolio(uid) {
    if (state.role !== 'investor' || state.uid !== uid) return;
    const session = state.session;
    $('portfolioMessage').textContent = 'Loading your products…';
    try {
      const snap = await items(uid).get();
      if (session !== state.session || state.role !== 'investor' || state.uid !== uid) return;
      $('portfolioItems').innerHTML = productRows(snap.docs.map(d=>d.data()));
      $('portfolioMessage').textContent = '';
    } catch (error) {
      if (session === state.session) {
        $('portfolioItems').replaceChildren();
        $('portfolioMessage').textContent = 'Could not load your products. Check your connection or contact the administrator.';
      }
    }
  }
  async function loadAccounts() {
    if (!owner()) return;
    const session = state.session;
    const selected = $('allocationInvestor').value;
    const snap = await db.collection('access').get();
    if (session !== state.session || !owner()) return;
    accounts = snap.docs.map(d=>({uid:d.id,...d.data()}));
    $('accountList').innerHTML = accounts.map(a=>`<div class="record-item"><div><b>${esc(a.label)}</b><small>${esc(a.uid)}</small></div><span>${esc(a.role)} · ${a.active ? 'Active' : 'Disabled'}</span><button type="button" data-edit-access="${esc(a.uid)}">Edit Permissions</button></div>`).join('') || '<p>No staff or investor permissions assigned.</p>';
    $('allocationInvestor').innerHTML = '<option value="">Choose an investor</option>' + accounts.filter(a=>a.role==='investor').map(a=>`<option value="${esc(a.uid)}">${esc(a.label)}${a.active?'':' (disabled)'}</option>`).join('');
    if (accounts.some(a=>a.uid===selected && a.role==='investor')) $('allocationInvestor').value=selected;
    $('allocationProduct').innerHTML = '<option value="">Choose a product</option>' + state.products.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    await loadAllocations();
  }
  let allocations = [];
  let allocationRequest = 0;
  async function loadAllocations() {
    if (!owner()) return;
    const request = ++allocationRequest, session=state.session;
    const uid = $('allocationInvestor').value;
    allocations=[]; $('allocationList').replaceChildren();
    if (!validUid(uid)) return;
    const snap=await items(uid).get();
    if (!owner() || session!==state.session || request!==allocationRequest || uid!==$('allocationInvestor').value) return;
    allocations=snap.docs.map(d=>d.data());
    $('allocationList').innerHTML=productRows(allocations,true);
  }
  $('accessForm').addEventListener('submit',async event=>{
    event.preventDefault(); if (!owner()) return;
    const form=event.currentTarget, d=Object.fromEntries(new FormData(form));
    if (!validUid(d.uid)) return toast('Copy the exact Firebase User UID.');
    if (d.uid === state.uid) return toast('The Super Admin account is managed separately and cannot be reassigned here.');
    try {
      await db.collection('access').doc(d.uid).set({label:d.label.trim(),role:d.role,active:d.active==='true',updatedAt:now()});
      $('accessMessage').textContent='Permissions saved. Ask the person to sign out and sign in again. The fixed Super Admin is managed separately.';
      await loadAccounts();
    } catch(error){$('accessMessage').textContent=error.message;}
  });
  $('allocationForm').addEventListener('submit',async event=>{
    event.preventDefault(); if (!owner()) return;
    const d=Object.fromEntries(new FormData(event.currentTarget));
    const product=state.products.find(p=>p.id===d.productId);
    const agreedPrice=Number(d.agreedPrice);
    if (!product || !validUid(d.uid) || !Number.isFinite(agreedPrice) || agreedPrice<0 || agreedPrice>1e9 || !d.reference.trim()) return toast('Choose an investor, product, agreed price and agreement reference.');
    try {
      const image = new URL(imageOf(product).replace(/^\.\.\//,''), new URL('../',location.href)).href;
      await items(d.uid).doc(product.id).set({productId:product.id,name:product.name,image,agreedPrice,reference:d.reference.trim(),updatedAt:now()});
      $('allocationMessage').textContent='Current agreed price saved privately for this investor. No payment or sale was recorded.';
      await loadAllocations();
    } catch(error){$('allocationMessage').textContent=error.message;}
  });
  $('allocationInvestor').addEventListener('change',()=>{
    $('allocationForm').elements.agreedPrice.value='';
    $('allocationForm').elements.reference.value='';
    loadAllocations().catch(error=>toast(error.message));
  });
  document.addEventListener('click',async event=>{
    if (!owner()) return;
    const access=event.target.closest('[data-edit-access]');
    if(access){
      const a=accounts.find(a=>a.uid===access.dataset.editAccess); if(!a)return;
      const f=$('accessForm'); for(const k of ['uid','label','role'])f.elements[k].value=a[k]; f.elements.active.value=String(a.active);return;
    }
    const edit=event.target.closest('[data-edit-allocation]');
    if(edit){const a=allocations.find(a=>a.productId===edit.dataset.editAllocation);if(!a)return;const f=$('allocationForm'); for(const k of ['productId','agreedPrice','reference'])f.elements[k].value=a[k];return;}
    const remove=event.target.closest('[data-remove-allocation]');
    if(remove && confirm('Remove this product from this investor’s view? This does not cancel any contract or payment obligation.')){
      const uid=$('allocationInvestor').value;
      if(!validUid(uid))return;
      try{await items(uid).doc(remove.dataset.removeAllocation).delete();await loadAllocations();}catch(error){toast(error.message);}
    }
  });
  $('refreshPortfolio').addEventListener('click',()=>loadPortfolio(state.uid));
  window.TimzyRoles={loadAccounts,loadPortfolio};
})();
