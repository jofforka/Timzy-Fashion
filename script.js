import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCizR30KTtGXwlelD4Qxdu9IHJdPm-IlU",
  authDomain: "timzy-fashion-os.firebaseapp.com",
  projectId: "timzy-fashion-os",
  storageBucket: "timzy-fashion-os.firebasestorage.app",
  messagingSenderId: "515655826693",
  appId: "1:515655826693:web:4085b86651f39ffa03cb6c"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const SALES_API =
  "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Sales%20Responses";

const INVENTORY_API =
  "https://sheetdb.io/api/v1/75j0rpy9j199t?sheet=Inventory%20Restock";

let sales = [];
let inventory = [];
let orders = [];
let customers = [];

let currentRole = "customer";

let currentUserEmail = "";

const money =
  n => "₦" + Number(n || 0).toLocaleString();

function cleanNumber(value) {

  return Number(
    String(value || "0")
      .replace(/[₦,\s]/g, "")
  ) || 0;

}

function normalize(row) {

  const obj = {};

  Object.keys(row).forEach(key => {

    obj[key.trim().toLowerCase()] =
      row[key];

  });

  return obj;

}



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

  } catch (error) {

    alert(error.message);

  }

};



window.logoutUser = async function () {

  await signOut(auth);

};



window.submitMeasurement = async function () {

  try {

    await addDoc(
      collection(db, "customerMeasurements"),
      {
        email: currentUserEmail,
        name:
          document.getElementById("cmName").value,
        phone:
          document.getElementById("cmPhone").value,
        shoulder:
          document.getElementById("cmShoulder").value,
        chest:
          document.getElementById("cmChest").value,
        waist:
          document.getElementById("cmWaist").value,
        hip:
          document.getElementById("cmHip").value,
        sleeve:
          document.getElementById("cmSleeve").value,
        length:
          document.getElementById("cmLength").value,
        notes:
          document.getElementById("cmNotes").value,
        createdAt: new Date()
      }
    );

    alert("Measurement saved successfully");

    await loadFirestoreData();

  } catch (error) {

    console.error(error);

    alert("Could not save measurement");

  }

};



window.submitOrder = async function () {

  try {

    const amount =
      cleanNumber(
        document.getElementById("coAmount").value
      );

    const deposit =
      cleanNumber(
        document.getElementById("coDeposit").value
      );

    await addDoc(
      collection(db, "customerOrders"),
      {
        email: currentUserEmail,
        customer:
          document.getElementById("coName").value,
        phone:
          document.getElementById("coPhone").value,
        product:
          document.getElementById("coStyle").value,
        status: "Pending",
        delivery:
          document.getElementById("coDelivery").value,
        amount,
        deposit,
        balance: amount - deposit,
        createdAt: new Date()
      }
    );

    alert("Order submitted successfully");

    await loadFirestoreData();

  } catch (error) {

    console.error(error);

    alert("Could not submit order");

  }

};



onAuthStateChanged(auth, user => {

  const loginPage =
    document.getElementById("loginPage");

  const appView =
    document.getElementById("app");

  if (!loginPage || !appView) return;

  if (user) {

    loginPage.style.display = "none";

    appView.style.display = "block";

    currentUserEmail =
      user.email.toLowerCase();

    setupRoleAccess(currentUserEmail);

    loadAllData();

  } else {

    loginPage.style.display = "flex";

    appView.style.display = "none";

  }

});



function setupRoleAccess(email) {

  hideAllSections();

  // ADMIN
  if (email === "admin@timzyfashion.com") {

    currentRole = "admin";

    showRoleSections([
      "dashboard",
      "sales",
      "inventory",
      "orders",
      "customers",
      "staff",
      "forms"
    ]);

    showTab("dashboard");

    return;

  }

  // STAFF
  if (email.includes("staff")) {

    currentRole = "staff";

    showRoleSections([
      "sales",
      "orders",
      "customers",
      "forms"
    ]);

    showTab("sales");

    return;

  }

  // CUSTOMER
  currentRole = "customer";

  showRoleSections([
    "customers",
    "forms"
  ]);

  showTab("customers");

}



function hideAllSections() {

  document.querySelectorAll(".tab")
    .forEach(tab => {

      tab.style.display = "none";

      tab.classList.remove("active");

    });

  document.querySelectorAll("nav button")
    .forEach(btn => {

      btn.style.display = "none";

    });

}



function showRoleSections(sectionIds) {

  sectionIds.forEach(id => {

    const section =
      document.getElementById(id);

    const button =
      document.querySelector(
        `button[onclick="showTab('${id}')"]`
      );

    if (section)
      section.style.display = "";

    if (button)
      button.style.display = "inline-block";

  });

}



window.showTab = function (id) {

  document.querySelectorAll(".tab")
    .forEach(tab => {

      tab.classList.remove("active");

    });

  const selectedTab =
    document.getElementById(id);

  if (selectedTab) {

    selectedTab.classList.add("active");

  }

};



async function fetchSheet(api) {

  const response =
    await fetch(api);

  return await response.json();

}



async function loadFirestoreData() {

  try {

    let measurementQuery;
    let ordersQuery;

    // CUSTOMER ONLY SEES OWN
    if (currentRole === "customer") {

      measurementQuery = query(
        collection(db, "customerMeasurements"),
        where(
          "email",
          "==",
          currentUserEmail
        )
      );

      ordersQuery = query(
        collection(db, "customerOrders"),
        where(
          "email",
          "==",
          currentUserEmail
        )
      );

    } else {

      // STAFF + ADMIN SEE ALL
      measurementQuery =
        collection(db, "customerMeasurements");

      ordersQuery =
        collection(db, "customerOrders");

    }

    const measurementSnapshot =
      await getDocs(measurementQuery);

    customers =
      measurementSnapshot.docs.map(doc => doc.data());



    const ordersSnapshot =
      await getDocs(ordersQuery);

    orders =
      ordersSnapshot.docs.map(doc => doc.data());



    render();

  } catch (error) {

    console.error(error);

  }

}



async function loadAllData() {

  try {

    const [
      salesData,
      inventoryData
    ] = await Promise.all([
      fetchSheet(SALES_API),
      fetchSheet(INVENTORY_API)
    ]);



    sales = salesData.map(row => {

      const n = normalize(row);

      const qty =
        cleanNumber(
          n["quantity sold"] ||
          n["qty sold"] ||
          n["quantity"]
        );

      const unitPrice =
        cleanNumber(
          n["unit selling price"] ||
          n["selling price"] ||
          n["total sales"] ||
          n["total sales ₦"]
        );

      return {
        staff:
          n["staff name"] || "-",
        category:
          n["category"] || "-",
        product:
          n["product/vsku"] ||
          n["product/sku"] ||
          "-",
        qty,
        amount:
          qty * unitPrice
      };

    });



    inventory = inventoryData.map(row => {

      const n = normalize(row);

      return {
        staff:
          n["staff name"] || "-",
        category:
          n["category"] || "-",
        product:
          n["product name"] || "-",
        sku:
          n["sku"] || "-",
        supplier:
          n["supplier/vendor"] || "-",
        quantity:
          cleanNumber(
            n["quantity added"]
          ),
        cost:
          cleanNumber(
            n["cost price"]
          ),
        selling:
          cleanNumber(
            n["selling price"]
          )
      };

    });



    await loadFirestoreData();

  } catch (error) {

    console.error(error);

    alert(
      "Could not load business data"
    );

  }

}



function staffXP() {

  let xp = {};

  sales.forEach(x => {

    if (
      x.staff &&
      x.staff !== "-"
    ) {

      xp[x.staff] =
        (xp[x.staff] || 0) + 10;

    }

  });

  orders.forEach(x => {

    if (
      x.staff &&
      x.status &&
      x.status.toLowerCase() ===
      "completed"
    ) {

      xp[x.staff] =
        (xp[x.staff] || 0) + 15;

    }

  });

  return Object.entries(xp)
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
    .sort(
      (a, b) =>
        b.points - a.points
    );

}



function render() {

  const salesTable =
    document.getElementById("salesTable");

  const inventoryTable =
    document.getElementById("inventoryTable");

  const ordersTable =
    document.getElementById("ordersTable");

  const customersTable =
    document.getElementById("customersTable");

  const leaderboard =
    document.getElementById("leaderboard");

  const formLinks =
    document.getElementById("formLinks");



  // SALES
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



  // INVENTORY
  if (inventoryTable) {

    inventoryTable.innerHTML =
      inventory.map(x => `
        <tr>
          <td>${x.category}</td>
          <td>${x.product}</td>
          <td>${x.sku}</td>
          <td>${x.supplier}</td>
          <td>${x.quantity}</td>
          <td>${money(x.cost)}</td>
          <td>${money(x.selling)}</td>
        </tr>
      `).join("");

  }



  // ORDERS
  if (ordersTable) {

    ordersTable.innerHTML =
      orders.length
        ? orders.map(x => `
          <tr>
            <td>${x.customer}</td>
            <td>${x.phone}</td>
            <td>${x.product}</td>
            <td>${x.status}</td>
            <td>${x.delivery}</td>
            <td>${money(x.amount)}</td>
            <td>${money(x.deposit)}</td>
            <td>${money(x.balance)}</td>
          </tr>
        `).join("")
        : `
          <tr>
            <td colspan="8">
              No orders found
            </td>
          </tr>
        `;

  }



  // CUSTOMERS
  if (customersTable) {

    customersTable.innerHTML =
      customers.length
        ? customers.map(x => `
          <tr>
            <td>${x.name}</td>
            <td>${x.phone}</td>
            <td>
              Shoulder: ${x.shoulder}<br>
              Chest: ${x.chest}<br>
              Waist: ${x.waist}<br>
              Hip: ${x.hip}<br>
              Sleeve: ${x.sleeve}<br>
              Length: ${x.length}
            </td>
            <td>${x.notes}</td>
          </tr>
        `).join("")
        : `
          <tr>
            <td colspan="4">
              No customer measurements found
            </td>
          </tr>
        `;

  }



  // DASHBOARD
  const totalSalesAmount =
    sales.reduce(
      (sum, item) =>
        sum +
        Number(item.amount || 0),
      0
    );

  const inventoryValueAmount =
    inventory.reduce(
      (sum, item) =>
        sum +
        Number(
          item.quantity *
          item.cost || 0
        ),
      0
    );

  const lowStockCount =
    inventory.filter(
      item =>
        item.quantity <= 5
    ).length;



  const totalSales =
    document.getElementById("totalSales");

  const netProfit =
    document.getElementById("netProfit");

  const inventoryValue =
    document.getElementById("inventoryValue");

  const lowStock =
    document.getElementById("lowStock");



  if (totalSales)
    totalSales.textContent =
      money(totalSalesAmount);

  if (netProfit)
    netProfit.textContent =
      money(totalSalesAmount);

  if (inventoryValue)
    inventoryValue.textContent =
      money(
        inventoryValueAmount
      );

  if (lowStock)
    lowStock.textContent =
      lowStockCount;



  // STAFF XP
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
      `).join("")
      ||
      "<p>No staff points yet.</p>";

  }



  // GOOGLE FORMS HUB
  if (formLinks) {

    let allowedForms =
      window.TIMZY_FORMS || [];



    if (
      currentRole ===
      "customer"
    ) {

      allowedForms =
        allowedForms.filter(f =>
          f.name.includes(
            "Customer Measurement"
          ) ||
          f.name.includes(
            "Order"
          )
        );

    }



    if (
      currentRole ===
      "staff"
    ) {

      allowedForms =
        allowedForms.filter(f =>
          f.name.includes(
            "Sales"
          ) ||
          f.name.includes(
            "Customer Measurement"
          ) ||
          f.name.includes(
            "Order"
          )
        );

    }



    formLinks.innerHTML =
      allowedForms.map(f => `
        <div class="form-card">
          <h3>${f.name}</h3>
          <p>${f.description}</p>
          <a href="${f.url}" target="_blank">
            Open Form
          </a>
        </div>
      `).join("");

  }

}
