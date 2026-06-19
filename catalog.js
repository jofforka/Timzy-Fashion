import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
 getFirestore,
 collection,
 getDocs
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
 apiKey:"YOUR_API_KEY",
 authDomain:"YOUR_AUTH_DOMAIN",
 projectId:"YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let products = [];
let filteredProducts = [];

function driveToImage(url){

 if(!url) return "";

 const str = String(url).trim();

 const idMatch =
  str.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
  str.match(/[?&]id=([a-zA-Z0-9_-]+)/);

 if(idMatch){
   return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
 }

 return str;
}

async function loadCatalog(){

 const snap =
 await getDocs(collection(db,"catalog"));

 products =
 snap.docs.map(doc=>({

   id:doc.id,

   ...doc.data(),

   image1:
   driveToImage(
     doc.data().image1
   )

 }));

 filteredProducts=[...products];

 renderProducts();
}

window.filterProducts=function(){

 const search =
 document
 .getElementById("searchInput")
 .value
 .toLowerCase();

 const category =
 document
 .getElementById("categoryFilter")
 .value;

 filteredProducts =
 products.filter(item=>{

   const matchesSearch =
   `${item.name}
    ${item.description}
    ${item.category}`
   .toLowerCase()
   .includes(search);

   const matchesCategory =
   !category ||
   item.category===category;

   return (
     matchesSearch &&
     matchesCategory
   );
 });

 renderProducts();
};

function renderProducts(){

 const grid =
 document.getElementById("catalogGrid");

 grid.innerHTML=
 filteredProducts.map(item=>`

 <div
   class="product-card"
   onclick="openProduct('${item.id}')"
 >

   <img
    src="${item.image1 || ''}"
    alt="${item.name}"
   >

   <div class="product-info">

      <span class="category">
      ${item.category || ""}
      </span>

      <h3>
      ${item.name}
      </h3>

      <strong>
      ₦${Number(item.price||0).toLocaleString()}
      </strong>

   </div>

 </div>

 `).join("");
}

window.openProduct=function(id){

 const item =
 products.find(
 p=>p.id===id
 );

 if(!item) return;

 document.getElementById(
 "modalBody"
 ).innerHTML=

 `
 <img
  src="${item.image1}"
  class="modal-image"
 >

 <h2>${item.name}</h2>

 <p>${item.description||""}</p>

 <h3>
 ₦${Number(item.price||0).toLocaleString()}
 </h3>

 <div class="modal-actions">

   <button
    onclick="requestOrder()"
   >
    Request Order
   </button>

   <a
    href="https://wa.me/2348118103510?text=Hello I want to order ${encodeURIComponent(item.name)}"
    target="_blank"
   >
    WhatsApp
   </a>

 </div>
 `;

 document.getElementById(
 "productModal"
 ).style.display="flex";
};

window.requestOrder=function(){

 alert(
 "Login required to place order."
 );
};

window.closeModal=function(){

 document.getElementById(
 "productModal"
 ).style.display="none";
};

loadCatalog();