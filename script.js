const SALES_API = "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Sales%20Responses";

let sales = [];
let inventory = JSON.parse(localStorage.getItem('tf_inventory')) || [];
let orders = JSON.parse(localStorage.getItem('tf_orders')) || [];
let customers = JSON.parse(localStorage.getItem('tf_customers')) || [];

const money = n => '₦' + Number(n || 0).toLocaleString();


// TAB SWITCHING
function showTab(id) {

  document.querySelectorAll('.tab').forEach(section => {
    section.classList.remove('active');
  });

  const activeTab = document.getElementById(id);

  if(activeTab){
    activeTab.classList.add('active');
  }

}


// CLEAN NUMBER
function cleanNumber(value) {
  return Number(
    String(value || "0").replace(/[₦,\s]/g, "")
  ) || 0;
}


// LOAD SALES FROM SHEETDB
async function loadSalesFromSheetDB() {

  try {

    const response = await fetch(SALES_API);

    const data = await response.json();

    console.log("SheetDB raw data:", data);

    if(data.length > 0){
      console.log("Available headers:", Object.keys(data[0]));
    }

    sales = data.map(row => ({

      staff: row["Staff Name"] || "",

      category: row["Category"] || "",

      product: row["Product/VSKU"] || "",

      qty: cleanNumber(row["Quantity Sold"]),

      amount: cleanNumber(row["Unit Selling Price"])

    }));


    render();

  } catch(error){

    console.error("SheetDB sales loading error:", error);

    alert("Sales data could not load from SheetDB.");

  }

}


// STAFF XP SYSTEM
function staffXP(){

  let xp = {};

  sales.forEach(x => {

    if(x.staff){

      xp[x.staff] = (xp[x.staff] || 0) + 10;

    }

  });


  return Object.entries(xp)

    .map(([name, points]) => ({

      name,

      points,

      rank:
        points >= 700 ? 'Fashion Master' :
        points >= 300 ? 'Gold Stylist' :
        points >= 100 ? 'Silver Stylist' :
        'Bronze Stylist'

    }))

    .sort((a,b) => b.points - a.points);

}


// RENDER DASHBOARD
function render(){


  // SALES TABLE
  salesTable.innerHTML = sales.map(x => `

    <tr>

      <td>${x.staff || "-"}</td>

      <td>${x.category || "-"}</td>

      <td>${x.product || "-"}</td>

      <td>${x.qty || 0}</td>

      <td>${money(x.amount)}</td>

      <td>From Google Form</td>

    </tr>

  `).join('');



  // TOTALS
  let total = sales.reduce((sum, item) => sum + item.amount, 0);


  totalSales.textContent = money(total);

  totalExpenses.textContent = '₦0';

  netProfit.textContent = money(total);

  inventoryValue.textContent = '₦0';

  lowStock.textContent = '0';

  pendingOrders.textContent = '0';



  // STAFF LEADERBOARD
  leaderboard.innerHTML = staffXP().map((x, i) => `

    <div class="rank-card">

      <span>

        #${i + 1}

        <b>${x.name}</b>

        <br>

        ${x.rank}

      </span>

      <strong>${x.points} XP</strong>

    </div>

  `).join('')

  || '<p>No staff points yet.</p>';



  // GOOGLE FORMS HUB
  formLinks.innerHTML = (window.TIMZY_FORMS || []).map(f => `

    <div class="form-card">

      <h3>${f.name}</h3>

      <p>${f.description}</p>

      <a href="${f.url}" target="_blank">

        Open Form

      </a>

    </div>

  `).join('');

}



// EXPORT BACKUP
function exportBackup(){

  let data = {

    sales,

    inventory,

    orders,

    customers,

    exportedAt: new Date().toISOString()

  };


  let blob = new Blob(

    [JSON.stringify(data, null, 2)],

    { type:'application/json' }

  );


  let a = document.createElement('a');

  a.href = URL.createObjectURL(blob);

  a.download = 'timzy-fashion-backup.json';

  a.click();

}



// CLEAR DATA
function clearData(){

  if(confirm('Clear all local demo data?')){

    localStorage.removeItem('tf_inventory');

    localStorage.removeItem('tf_orders');

    localStorage.removeItem('tf_customers');

    location.reload();

  }

}



// START APP
loadSalesFromSheetDB();
