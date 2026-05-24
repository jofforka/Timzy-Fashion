const SALES_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Sales%20Responses";

let sales = [];
let inventory = JSON.parse(localStorage.getItem('tf_inventory')) || [];
let orders = JSON.parse(localStorage.getItem('tf_orders')) || [];
let customers = JSON.parse(localStorage.getItem('tf_customers')) || [];

const money = n => '₦' + Number(n || 0).toLocaleString();

function showTab(id) {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function loadSalesFromSheetDB() {
  try {
    const response = await fetch(SALES_API);
    const data = await response.json();

    sales = data.map(row => ({
  staff: row["Staff Name"] || "",
  category: row["Category"] || "",
  product: row["Product/VSKU"] || row["Product/SKU"] || "",
  qty: Number(row["Quantity Sold"] || row["Qty sold"] || 0),
  amount:
    Number(row["Quantity Sold"] || row["Qty sold"] || 0) *
    Number(row["Unit Selling Price"] || row["Total sales ₦"] || 0)
}));

    render();

  } catch (error) {
    console.error("SheetDB sales loading error:", error);
    alert("Sales data could not load from SheetDB.");
  }
}

function staffXP() {
  let xp = {};
  sales.forEach(x => xp[x.staff] = (xp[x.staff] || 0) + 10);

  return Object.entries(xp)
    .map(([name, points]) => ({
      name,
      points,
      rank: points >= 700 ? 'Fashion Master' :
            points >= 300 ? 'Gold Stylist' :
            points >= 100 ? 'Silver Stylist' :
            'Bronze Stylist'
    }))
    .sort((a, b) => b.points - a.points);
}

function render() {
  salesTable.innerHTML = sales.map(x => `
    <tr>
      <td>${x.staff}</td>
      <td>${x.category}</td>
      <td>${x.product}</td>
      <td>${x.qty}</td>
      <td>${money(x.amount)}</td>
      <td>From Google Form</td>
    </tr>
  `).join('');

  let total = sales.reduce((s, x) => s + x.amount, 0);

  totalSales.textContent = money(total);
  totalExpenses.textContent = '₦0';
  netProfit.textContent = money(total);
  inventoryValue.textContent = '₦0';
  lowStock.textContent = '0';
  pendingOrders.textContent = '0';

  leaderboard.innerHTML = staffXP().map((x, i) => `
    <div class="rank-card">
      <span>#${i + 1} <b>${x.name}</b><br>${x.rank}</span>
      <strong>${x.points} XP</strong>
    </div>
  `).join('') || '<p>No staff points yet.</p>';

  formLinks.innerHTML = (window.TIMZY_FORMS || []).map(f => `
    <div class="form-card">
      <h3>${f.name}</h3>
      <p>${f.description}</p>
      <a href="${f.url}" target="_blank">Open Form</a>
    </div>
  `).join('');
}

function exportBackup() {
  let data = { sales, exportedAt: new Date().toISOString() };
  let blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'timzy-fashion-sales-backup.json';
  a.click();
}

function clearData() {
  alert("Sales now comes from Google Forms/SheetDB, not local demo data.");
}

loadSalesFromSheetDB();
