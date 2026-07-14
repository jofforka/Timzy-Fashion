/* ===========================================================
   TIMZY FASHION OS v8.5
   Firebase Bootstrap
=========================================================== */

(function () {
  "use strict";

  const cfg = window.TIMZY_CONFIG?.firebaseConfig;

  // ---------------------------------------------------------
  // Check SDK
  // ---------------------------------------------------------
  if (typeof firebase === "undefined") {
    console.error("Firebase SDK not loaded.");
    window.TIMZY_FIREBASE = null;
    return;
  }

  // ---------------------------------------------------------
  // Check Config
  // ---------------------------------------------------------
  if (
    !cfg ||
    !cfg.apiKey ||
    !cfg.projectId ||
    !cfg.authDomain
  ) {
    console.error("Firebase configuration missing.");
    window.TIMZY_FIREBASE = null;
    return;
  }

  try {

    // -------------------------------------------------------
    // Initialize App
    // -------------------------------------------------------
    if (!firebase.apps.length) {
      firebase.initializeApp(cfg);
    }

    const app = firebase.app();

    // -------------------------------------------------------
    // Authentication
    // -------------------------------------------------------
    const auth = firebase.auth();

    auth.setPersistence(
      firebase.auth.Auth.Persistence.LOCAL
    ).catch((err) => {
      console.warn("Persistence:", err);
    });

    // -------------------------------------------------------
    // Firestore
    // -------------------------------------------------------
    const db = firebase.firestore();

    db.settings({
      ignoreUndefinedProperties: true
    });

    // -------------------------------------------------------
    // Expose Globally
    // -------------------------------------------------------
    window.TIMZY_FIREBASE = {
      app,
      auth,
      db,

      login(email, password) {
        return auth.signInWithEmailAndPassword(email, password);
      },

      logout() {
        return auth.signOut();
      },

      currentUser() {
        return auth.currentUser;
      },

      products() {
        return db.collection("products");
      },

      orders() {
        return db.collection("orders");
      },

      sales() {
        return db.collection("sales");
      },

      expenses() {
        return db.collection("expenses");
      },

      settings() {
        return db.collection("settings");
      }
    };

    console.log("✅ Firebase initialized.");

  } catch (err) {

    console.error("Firebase initialization failed:", err);

    window.TIMZY_FIREBASE = null;

  }

})();
