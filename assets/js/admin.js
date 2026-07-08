import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const CFG = window.TIMZY_CONFIG || {};
const app = initializeApp(CFG.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = s => document.querySelector(s);
let cache = { products: [], sales: [], expenses: [] };

function rawNumber(v){ return Number(String(v || 0).replace(/[^0-9.-]/g,'')) || 0; }
function money(v){ return `${CFG.currency || '₦'}${rawNumber(v).toLocaleString()}`; }
function todayKey(){ return new Date().toLocaleDateString(); }
function escapeCSV(value){ return `"${String(value ?? '').replace(/"/g,'""')}"`; }
function downloadCSV(filename, rows){
  if(!rows.length){ alert('No records to export yet.'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(row => headers.map(h => escapeCSV(row[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}

window.login = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    location.href = 'admin/index.html';
  } catch (e) {
    loginMsg.textContent = e.message.replace('Firebase: ', '');
  }
};

if (location.pathname.includes('/admin/')) {
  onAuthStateChanged(auth, u => { if (!u) location.href = '../login.html'; else initAdmin(); });
}

async function getRecords(name){
  try {
    const snap = await getDocs(query(collection(db, name), orderBy('createdAt','desc')));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  } catch(e) { console.warn(e); return []; }
}

function saleRows(items, el){
  if(!el) return;
  el.innerHTML = items.length ? items.map(s => `<tr><td>${s.date || ''}</td><td>${s.customer || ''}</td><td>${s.product || ''}</td><td>${money(s.amount)}</td><td>${s.method || ''}</td></tr>`).join('') : '<tr><td colspan="5">No sales recorded yet.</td></tr>';
}
function expenseRows(items, el){
  if(!el) return;
  el.innerHTML = items.length ? items.map(x => `<tr><td>${x.date || ''}</td><td>${x.title || ''}</td><td>${x.category || ''}</td><td>${money(x.amount)}</td></tr>`).join('') : '<tr><td colspan="4">No expenses recorded yet.</td></tr>';
}
function activityRows(sales, expenses, el){
  if(!el) return;
  const rows = [
    ...sales.map(s => ({ type:'Sale', date:s.date || '', details:`${s.product || 'Sale'} · ${s.customer || 'Customer'}`, amount: rawNumber(s.amount) })),
    ...expenses.map(x => ({ type:'Expense', date:x.date || '', details:`${x.title || 'Expense'} · ${x.category || ''}`, amount: rawNumber(x.amount) }))
  ].slice(0, 20);
  el.innerHTML = rows.length ? rows.map(r => `<tr><td>${r.type}</td><td>${r.date}</td><td>${r.details}</td><td>${money(r.amount)}</td></tr>`).join('') : '<tr><td colspan="4">No activity yet.</td></tr>';
}
function reportSummary(products, sales, expenses){
  const el = $('#reportSummary'); if(!el) return;
  const totalSales = sales.reduce((a,b)=>a+rawNumber(b.amount),0);
  const totalExpenses = expenses.reduce((a,b)=>a+rawNumber(b.amount),0);
  const today = todayKey();
  const todaySales = sales.filter(s=>s.date===today).reduce((a,b)=>a+rawNumber(b.amount),0);
  const todayExpenses = expenses.filter(x=>x.date===today).reduce((a,b)=>a+rawNumber(b.amount),0);
  el.innerHTML = `
    <div class="mini-report"><span>Total Sales</span><strong>${money(totalSales)}</strong></div>
    <div class="mini-report"><span>Total Expenses</span><strong>${money(totalExpenses)}</strong></div>
    <div class="mini-report"><span>Total Profit Estimate</span><strong>${money(totalSales-totalExpenses)}</strong></div>
    <div class="mini-report"><span>Today Net</span><strong>${money(todaySales-todayExpenses)}</strong></div>
    <div class="mini-report"><span>Catalog Products</span><strong>${products.length}</strong></div>
  `;
}

async function initAdmin(){
  const products = await window.TimzyProducts.getProducts();
  const sales = await getRecords('sales');
  const expenses = await getRecords('expenses');
  cache = { products, sales, expenses };
  const totalSales = sales.reduce((a,b)=>a+rawNumber(b.amount),0);
  const totalExpenses = expenses.reduce((a,b)=>a+rawNumber(b.amount),0);
  const today = todayKey();
  const todaySales = sales.filter(s=>s.date===today).reduce((a,b)=>a+rawNumber(b.amount),0);
  const todayExpenses = expenses.filter(x=>x.date===today).reduce((a,b)=>a+rawNumber(x.amount),0);

  if($('#kProducts')) $('#kProducts').textContent = products.length;
  if($('#kSales')) $('#kSales').textContent = money(totalSales);
  if($('#kExpenses')) $('#kExpenses').textContent = money(totalExpenses);
  if($('#kProfit')) $('#kProfit').textContent = money(totalSales-totalExpenses);
  if($('#rTodaySales')) $('#rTodaySales').textContent = money(todaySales);
  if($('#rTodayExpenses')) $('#rTodayExpenses').textContent = money(todayExpenses);
  if($('#rTodayProfit')) $('#rTodayProfit').textContent = money(todaySales-todayExpenses);
  if($('#rProducts')) $('#rProducts').textContent = products.length;

  saleRows(sales.slice(0,6), $('#recentSales'));
  saleRows(sales, $('#salesRows'));
  expenseRows(expenses, $('#expenseRows'));
  activityRows(sales, expenses, $('#activityRows'));
  reportSummary(products, sales, expenses);

  if($('#productList')) $('#productList').innerHTML = products.map(p => `<article class="product-card"><a href="../product.html?id=${encodeURIComponent(p.id || p.name)}"><div class="photo"><img src="${p.images?.[0] || ''}" alt="${p.name || 'Product'}"></div><div class="product-info"><small>${p.category || 'Product'}</small><h3>${p.name || 'Untitled'}</h3><div class="price">${money(p.price)}</div></div></a></article>`).join('') || '<p class="empty">No products found. Check your Google Sheet CSV link.</p>';
  document.querySelectorAll('[data-product-form]').forEach(a => a.href = CFG.productFormUrl || '#');
  document.querySelectorAll('[data-product-sheet]').forEach(a => a.href = CFG.productSheetUrl || '#');
}

async function saveForm(form, name){
  const data = Object.fromEntries(new FormData(form).entries());
  data.amount = rawNumber(data.amount);
  data.date = new Date().toLocaleDateString();
  data.createdAt = serverTimestamp();
  await addDoc(collection(db, name), data);
  form.reset();
  alert(name === 'sales' ? 'Sale saved' : 'Expense saved');
  initAdmin();
}

document.addEventListener('submit', e => {
  if(e.target.id === 'saleForm'){ e.preventDefault(); saveForm(e.target, 'sales'); }
  if(e.target.id === 'expenseForm'){ e.preventDefault(); saveForm(e.target, 'expenses'); }
});
document.addEventListener('click', async e => {
  if(e.target.closest('[data-logout]')){ await signOut(auth); location.href = '../login.html'; }
  const exportBtn = e.target.closest('[data-export]');
  if(exportBtn){
    const type = exportBtn.dataset.export;
    const rows = cache[type] || [];
    downloadCSV(`timzy-${type}-${new Date().toISOString().slice(0,10)}.csv`, rows.map(({createdAt, id, ...rest}) => rest));
  }
});
window.refreshAdmin = initAdmin;
