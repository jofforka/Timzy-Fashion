(() => {
  'use strict';

  const config = window.TIMZY_CONFIG?.firebaseConfig;

  if (!config || typeof firebase === 'undefined') {
    console.error('Firebase SDK or configuration is missing.');
    window.TIMZY_FIREBASE = null;
    return;
  }

  try {
    if (!firebase.apps.length) firebase.initializeApp(config);

    const auth = firebase.auth();
    const db = firebase.firestore();

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.warn);

    window.TIMZY_FIREBASE = {
      app: firebase.app(),
      auth,
      db
    };
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    window.TIMZY_FIREBASE = null;
  }
})();
