import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBCizR30KTtGXwlelD4Qxdu9IHJdPm-IlU",
  authDomain: "timzy-fashion-os.firebaseapp.com",
  projectId: "timzy-fashion-os",
  storageBucket: "timzy-fashion-os.firebasestorage.app",
  messagingSenderId: "515655826693",
  appId: "1:515655826693:web:4085b86651f39ffa03cb6c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const statusBox = document.getElementById("statusBox");
const seedBtn = document.getElementById("seedBtn");
const clearBtn = document.getElementById("clearBtn");

function log(message) {
  statusBox.textContent += "\n" + message;
  statusBox.scrollTop = statusBox.scrollHeight;
}

async function loadDemoProducts() {
  const response = await fetch("./demo-products.json?v=" + Date.now());
  if (!response.ok) throw new Error("Could not load demo-products.json");
  return await response.json();
}

clearBtn.addEventListener("click", async () => {
  try {
    statusBox.textContent = "Checking demo products...";
    const products = await loadDemoProducts();
    const senator = products.filter(p => p.category === "Senator").length;
    const agbada = products.filter(p => p.category === "Agbada").length;
    const fabrics = products.filter(p => p.category === "Fabrics").length;
    const accessories = products.filter(p => p.category === "Accessories").length;

    statusBox.textContent =
      `Demo product file loaded successfully.\n\nTotal: ${products.length}\nSenator: ${senator}\nAgbada: ${agbada}\nFabrics: ${fabrics}\nAccessories: ${accessories}`;
  } catch (error) {
    statusBox.textContent = "Preview failed: " + error.message;
  }
});

seedBtn.addEventListener("click", async () => {
  if (!confirm("Upload/update all Timzy demo products into Firebase catalog?")) return;

  seedBtn.disabled = true;
  statusBox.textContent = "Starting upload...";

  try {
    const products = await loadDemoProducts();
    log(`Loaded ${products.length} demo products.`);

    let count = 0;

    for (const product of products) {
      const { id, ...data } = product;

      await setDoc(doc(db, "catalog", id), {
        ...data,
        demoProduct: true,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });

      count++;
      log(`✓ Uploaded ${count}/${products.length}: ${product.name}`);
    }

    log("\nDONE. Open catalog.html and hard refresh. These products are now editable from the admin catalog system.");
  } catch (error) {
    console.error(error);
    log("\nFAILED: " + error.message);
  } finally {
    seedBtn.disabled = false;
  }
});
