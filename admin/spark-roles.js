/* Spark-only permissions and private investor products: no callable Functions. */
(() => {
  'use strict';
  const {state,escapeHTML:esc,money,toast,imageOf} = window.TimzyAdmin;
  const db = window.TIMZY_FIREBASE?.db;
  const $ = id => document.getElementById(id);
  let accounts = [];
  const ledger = (uid, productId) => db.collection('investorLedger').doc(uid).collection('products').doc(productId);
  const count = n => Number(n || 0).toLocaleString();
  const safeAmount = n => Math.round((n + Number.EPSILON) * 100) / 100;
  async function ledgerSnapshot(uid, products) {
    return Promise.all(products.map(async p => {
      const snap = await ledger(uid, p.productId).get();
      return {...p, stockRecorded: snap.exists, ledger: snap.exists ? snap.data() : null};
    }));
  }
  function stockRow(p) {
    const l = p.ledger;
    return '<div class="record-item"><div><b>' + esc(p.name) + '</b><small>' +
      (l ? 'Received: '+count(l.received)+' · Sold: '+count(l.sold)+' · Available: '+count(l.received-l.sold) +
      ' · Sales value: '+money(l.grossSales)+' · Investor earnings: '+money(l.investorEarnings)
      : 'Stock not recorded yet — no sales or earnings assumed') +
      '</small></div></div>';
  }
  async function refreshOwnerLedger() {
    if (!owner()) return;
    const uid = $('allocationInvestor').value;
    const target = $('allocationLedger');
    if (!validUid(uid)) { target.replaceChildren(); return; }
    const rows = await ledgerSnapshot(uid, allocations);
    if (uid !== $('allocationInvestor').value || !owner()) return;
    target.innerHTML = rows.map(stockRow).join('') || '<p>Assign a product before recording stock.</p>';
  }
  $('investorMovementForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!owner()) return;
    const form = event.currentTarget;
    const d = Object.fromEntries(new FormData(form));
    const uid = $('allocationInvestor').value;
    const productId = $('allocationProduct').value;
    const quantity = Number(d.quantity);
    const unitRetailPrice = d.unitRetailPrice === '' ? NaN : Number(d.unitRetailPrice);
    const allocation = allocations.find(a => a.productId === productId);
    const msg = $('movementMessage');
    if (!validUid(uid) || !allocation) { msg.textContent = 'Select an investor and an assigned product.'; return; }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000 ||
        !['receipt','sale'].includes(d.kind) || !d.reference.trim() ||
        (d.kind === 'sale' && (!Number.isFinite(unitRetailPrice) || unitRetailPrice < 0 || unitRetailPrice > 1000000000))) {
      msg.textContent = 'Enter a valid movement, quantity, reference, and retail price for sales.'; return;
    }
    const agreedUnitAmount = Number(allocation.agreedPrice);
    if (!Number.isFinite(agreedUnitAmount) || agreedUnitAmount < 0) { msg.textContent = 'Invalid agreed unit amount.'; return; }
    const ref = ledger(uid, productId);
    const movement = ref.collection('movements').doc();
    const timestamp = now();
    const grossAmount = d.kind === 'sale' ? safeAmount(unitRetailPrice * quantity) : 0;
    const investorAmount = d.kind === 'sale' ? safeAmount(agreedUnitAmount * quantity) : 0;
    if (grossAmount > 1e12 || investorAmount > 1e12) { msg.textContent = 'Amount exceeds supported limit.'; return; }
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    msg.textContent = 'Recording movement…';
    try {
      await db.runTransaction(async tx => {
        const [current, agreement] = await Promise.all([
          tx.get(ref), tx.get(items(uid).doc(productId))
        ]);
        if (!agreement.exists) throw Error('Investor assignment was removed. Refresh and retry.');
        const terms = agreement.data();
        if (Number(terms.agreedPrice) !== agreedUnitAmount) throw Error('Agreed unit amount changed. Refresh and retry.');
        const old = current.exists ? current.data() : {received:0,sold:0,grossSales:0,investorEarnings:0};
        const received = Number(old.received) + (d.kind === 'receipt' ? quantity : 0);
        const sold = Number(old.sold) + (d.kind === 'sale' ? quantity : 0);
        if (sold > received) throw Error('Insufficient available stock. Receive stock first.');
        const next = {received,sold,grossSales:safeAmount(Number(old.grossSales)+grossAmount),
          investorEarnings:safeAmount(Number(old.investorEarnings)+investorAmount),updatedAt:timestamp};
        tx.set(ref,next);
        tx.set(movement,{kind:d.kind,quantity,productId,unitRetailPrice:d.kind === 'sale'?unitRetailPrice:0,
          agreedUnitAmount:d.kind === 'sale'?agreedUnitAmount:0,grossAmount,investorAmount,
          reference:d.reference.trim(),createdAt:timestamp,createdBy:state.uid});
      });
      msg.textContent = d.kind === 'sale' ? 'Sale recorded and stock deducted.' : 'Stock received.';
      form.reset();
      await refreshOwnerLedger();
    } catch(error) { msg.textContent = error.message || 'Movement could not be saved.'; }
    finally { button.disabled = false; }
  });

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
      const rows = await ledgerSnapshot(uid, snap.docs.map(d=>d.data()));
      if (session !== state.session || state.uid !== uid) return;
      $('portfolioItems').innerHTML = rows.map(p => productRows([p]) + stockRow(p)).join('') || '<p>No products assigned yet.</p>';
      const recorded = rows.filter(p=>p.stockRecorded);
      $('investorSummary').textContent = 'Recorded stock: '+count(recorded.reduce((n,p)=>n+p.ledger.received-p.ledger.sold,0))+
        ' available · '+count(recorded.reduce((n,p)=>n+p.ledger.sold,0))+' units sold · Sales value: '+
        money(recorded.reduce((n,p)=>n+p.ledger.grossSales,0))+' · Your earned amount: '+
        money(recorded.reduce((n,p)=>n+p.ledger.investorEarnings,0))+
        (recorded.length !== rows.length ? ' · Some products have no recorded opening stock.' : '');
      const movementSets = await Promise.all(rows.map(async p => {
        if (!p.stockRecorded) return [];
        const events = await ledger(uid,p.productId).collection('movements').orderBy('createdAt','desc').limit(20).get();
        return events.docs.map(d=>({...d.data(),name:p.name}));
      }));
      if (session !== state.session || state.uid !== uid) return;
      const events = movementSets.flat().sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).slice(0,40);
      $('investorMovements').innerHTML = events.map(e=>'<div class="record-item"><div><b>'+esc(e.name)+'</b><small>'+
        esc(e.kind)+' · '+count(e.quantity)+' units · '+esc(e.reference)+
        (e.kind === 'sale' ? ' · Investor earned '+money(e.investorAmount) : '')+
        '</small></div></div>').join('') || '<p>No stock or sales movements recorded yet.</p>';
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
    await refreshOwnerLedger();
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
