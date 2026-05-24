import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";



// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBCizR30KTtGXwlelD4Qxdu9IHJdPm-IlU",
  authDomain: "timzy-fashion-os.firebaseapp.com",
  projectId: "timzy-fashion-os",
  storageBucket: "timzy-fashion-os.firebasestorage.app",
  messagingSenderId: "515655826693",
  appId: "1:515655826693:web:4085b86651f39ffa03cb6c"
};



// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);



// SALES API
const SALES_API =
  "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Sales%20Responses";



let sales = [];



// MONEY FORMAT
const money = n =>
  "₦" + Number(n || 0).toLocaleString();



// LOGIN
window.loginUser = async function () {

  const email =
    document.getElementById("loginEmail").value;

  const password =
    document.getElementById("loginPassword").value;

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    alert("Login successful");

  } catch (error) {

    alert(error.message);

  }

};



// LOGOUT
window.logoutUser = async function () {

  await signOut(auth);

};



// AUTH STATE
onAuthStateChanged(auth, user => {

  const loginPage =
    document.getElementById("loginPage");

  const app =
    document.getElementById("app");

  if (!loginPage || !app) return;

  if (user) {

    loginPage.style.display = "none";
    app.style.display = "block";

    loadSalesFromSheetDB();

  } else {

    loginPage.style.display = "flex";
    app.style.display = "none";

  }

});



// TAB SWITCHING
window.showTab = function (id) {

  document
    .querySelectorAll(".tab")
    .forEach(tab => {
      tab.classList.remove("active");
    });

  const selectedTab =
    document.getElementById(id);

  if (selectedTab) {
    selectedTab.classList.add("active");
  }

};



// LOAD SALES
async function loadSalesFromSheetDB() {

  try {

    const response =
      await fetch(SALES_API);

    const data =
      await response.json();

    console.log("SheetDB DATA:", data);

    sales = data.map(row => ({

      staff:
        row["Staff Name"] || "-",

      category:
        row["Category"] || "-",

      product:
        row["Product/SKU"] || "-",

      qty:
        Number(row["Quantity Sold"] || 0),

      amount:
        Number(row["Unit Selling Price"] || 0)

    }));

    render();

  } catch (error) {

    console.error(error);

    alert("Could not load sales");

  }

}



// STAFF XP
function staffXP() {

  let xp = {};

  sales.forEach(x => {

    xp[x.staff] =
      (xp[x.staff] || 0) + 10;

  });

  return Object
    .entries(xp)
    .map(([name, points]) => ({

      name,

      points,

      rank:
        points >= 700
          ? "Fashion Master"
          : points >= 300
          ? "Gold Stylist"
          : points >= 100
          ? "Silver Stylist"
          : "Bronze Stylist"

    }))
    .sort((a, b) => b.points - a.points);

}



// RENDER UI
function render() {

  const salesTable =
    document.getElementById("salesTable");

  const totalSales =
    document.getElementById("totalSales");

  const netProfit =
    document.getElementById("netProfit");

  const inventoryValue =
    document.getElementById("inventoryValue");

  const lowStock =
    document.getElementById("lowStock");

  const leaderboard =
    document.getElementById("leaderboard");



  if (salesTable) {

    salesTable.innerHTML =
      sales.map(x => `

      <tr>
        <td>${x.staff}</td>
        <td>${x.category}</td>
        <td>${x.product}</td>
        <td>${x.qty}</td>
        <td>${money(x.amount)}</td>
      </tr>

    `).join("");

  }



  const total =
    sales.reduce(
      (sum, item) => sum + item.amount,
      0
    );



  if (totalSales)
    totalSales.textContent =
      money(total);

  if (netProfit)
    netProfit.textContent =
      money(total);

  if (inventoryValue)
    inventoryValue.textContent =
      "₦0";

  if (lowStock)
    lowStock.textContent =
      "0";



  if (leaderboard) {

    leaderboard.innerHTML =
      staffXP().map((x, i) => `

      <div class="rank-card">

        <span>
          #${i + 1}
          <b>${x.name}</b>
          <br>
          ${x.rank}
        </span>

        <strong>
          ${x.points} XP
        </strong>

      </div>

    `).join("");

  }

}
