// Firebase Initialization

const firebaseConfig = {
  apiKey: "AIzaSyBCizR30KTtGXwlelD4Qxdu9IHJdPm-IlU",
  authDomain: "timzy-fashion-os.firebaseapp.com",
  projectId: "timzy-fashion-os",
  storageBucket: "timzy-fashion-os.firebasestorage.app",
  messagingSenderId: "1015146526947",
  appId: "1:1015146526947:web:6d4bd493d6fa9a3c7b65e8"
};

firebase.initializeApp(firebaseConfig);

window.TIMZY_FIREBASE = {
    auth: firebase.auth(),
    db: firebase.firestore(),
    storage: firebase.storage()
};
