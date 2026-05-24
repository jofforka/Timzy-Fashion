const SALES_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Sales%20Responses";

let sales = [];

const money = n => "₦" + Number(n || 0).toLocaleString();

function showTab(id){
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  const selected = document.getElementById(id);
  if(selected) selected.classList.add("active");
}

function cleanNumber(value){
  return Number(String(value || "0").replace(/[₦,\s]/g,"")) || 0;
}

async function loadSalesFromSheetDB(){
  try{
    const response = await fetch(SALES_API);
    const data = await response.json();

    console.log("RAW DATA:", data);
    console.log("HEADERS:", data[0] ? Object.keys(data[0]) : "No data");

    sales = data.map(row => ({
      staff: row["Staff Name"] || row["Staff"] || "",
      category: row["Category"] || "",
      product: row["Product/VSKU"] || row["Product/SKU"] || row["Product SKU"] || "",
      qty: cleanNumber(row["Quantity Sold"] || row["Qty sold"] || row["Qty"]),
      amount: cleanNumber(row["Unit Selling Price"] || row["Total sales ₦"] || row["Total Sales"] || row["Amount"])
    }));

    render();

  }catch(error){
    console.error("ERROR:", error);
    alert("Could not load sales. Check console.");
  }
}

function render(){
  const salesTableEl = document.getElementById("salesTable");
  const totalSalesEl = document.getElementById("totalSales");
  const totalExpensesEl = document.getElementById("totalExpenses");
  const netProfitEl = document.getElementById("netProfit");
  const inventoryValueEl = document.getElementById("inventoryValue");
  const lowStockEl = document.getElementById("lowStock");
  const pendingOrdersEl = document.getElementById("pendingOrders");
  const leaderboardEl = document.getElementById("leaderboard");
  const formLinksEl = document.getElementById("formLinks");

  console.log("salesTable exists?", salesTableEl);
  console.log("sales data after mapping:", sales);

  if(salesTableEl){
    salesTableEl.innerHTML = sales.map(x => `
      <tr>
        <td>${x.staff || "-"}</td>
        <td>${x.category || "-"}</td>
        <td>${x.product || "-"}</td>
        <td>${x.qty || 0}</td>
        <td>${money(x.amount)}</td>
        <td>From Google Form</td>
      </tr>
    `).join("");
  }

  const total = sales.reduce((sum,item) => sum + item.amount, 0);

  if(totalSalesEl) totalSalesEl.textContent = money(total);
  if(totalExpensesEl) totalExpensesEl.textContent = "₦0";
  if(netProfitEl) netProfitEl.textContent = money(total);
  if(inventoryValueEl) inventoryValueEl.textContent = "₦0";
  if(lowStockEl) lowStockEl.textContent = "0";
  if(pendingOrdersEl) pendingOrdersEl.textContent = "0";

  if(leaderboardEl){
    let xp = {};
    sales.forEach(x => {
      if(x.staff) xp[x.staff] = (xp[x.staff] || 0) + 10;
    });

    leaderboardEl.innerHTML = Object.entries(xp).map(([name, points], i) => `
      <div class="rank-card">
        <span>#${i + 1} <b>${name}</b><br>Bronze Stylist</span>
        <strong>${points} XP</strong>
      </div>
    `).join("") || "<p>No staff points yet.</p>";
  }

  if(formLinksEl){
    formLinksEl.innerHTML = (window.TIMZY_FORMS || []).map(f => `
      <div class="form-card">
        <h3>${f.name}</h3>
        <p>${f.description}</p>
        <a href="${f.url}" target="_blank">Open Form</a>
      </div>
    `).join("");
  }
}

function exportBackup(){
  const blob = new Blob([JSON.stringify({sales}, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "timzy-sales-backup.json";
  a.click();
}

function clearData(){
  alert("Live sales comes from Google Form/SheetDB.");
}

loadSalesFromSheetDB();
