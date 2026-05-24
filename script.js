// FIREBASE IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const db = getFirestore(app);

const auth = getAuth(app);


// GLOBAL DATA
let sales = [];


// MONEY FORMAT
const money = n => '₦' + Number(n || 0).toLocaleString();


// LOGIN
window.loginUser = async function () {

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {

    await signInWithEmailAndPassword(auth, email, password);

    alert("Login successful");

  } catch (error) {

    alert(error.message);

  }

};


// LOGOUT
window.logoutUser = async function () {

  await signOut(auth);

};


// AUTH CHECK
onAuthStateChanged(auth, async (user) => {

  if (user) {

    document.getElementById("loginPage").style.display = "none";

    document.getElementById("app").style.display = "block";

    loadSales();

  } else {

    document.getElementById("loginPage").style.display = "flex";

    document.getElementById("app").style.display = "none";

  }

});


// LOAD SALES
async function loadSales() {

  sales = [];

  const querySnapshot = await getDocs(collection(db, "sales"));

  querySnapshot.forEach((doc) => {

    sales.push(doc.data());

  });

  render();

}


// ADD SALE
window.addSale = async function () {

  const staff = document.getElementById("salesStaff").value;

  const category = document.getElementById("salesCategory").value;

  const product = document.getElementById("salesProduct").value;

  const qty = Number(document.getElementById("salesQty").value);

  const amount = Number(document.getElementById("salesAmount").value);

  await addDoc(collection(db, "sales"), {

    staff,
    category,
    product,
    qty,
    amount,
    createdAt: new Date()

  });

  alert("Sale added");

  loadSales();

};


// TAB SWITCHING
window.showTab = function(id) {

  document.querySelectorAll('.tab').forEach(x => {
    x.classList.remove('active');
  });

  document.getElementById(id).classList.add('active');

};


// STAFF XP
function staffXP() {

  let xp = {};

  sales.forEach(x => {

    if (x.staff) {

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

    .sort((a, b) => b.points - a.points);

}


// RENDER
function render() {

  const salesTable = document.getElementById("salesTable");

  const totalSales = document.getElementById("totalSales");

  const netProfit = document.getElementById("netProfit");

  const leaderboard = document.getElementById("leaderboard");

  salesTable.innerHTML = sales.map(x => `

    <tr>
      <td>${x.staff || "-"}</td>
      <td>${x.category || "-"}</td>
      <td>${x.product || "-"}</td>
      <td>${x.qty || 0}</td>
      <td>${money(x.amount)}</td>
    </tr>

  `).join('');

  let total = sales.reduce((s, x) => s + Number(x.amount || 0), 0);

  totalSales.textContent = money(total);

  netProfit.textContent = money(total);

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

  `).join('');

}
