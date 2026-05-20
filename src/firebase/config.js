import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCsWU8r0eGs4cC5HGIe4hDttAsNiFyMEQM",
  authDomain: "manufacturing-admin.firebaseapp.com",
  projectId: "manufacturing-admin",
  storageBucket: "manufacturing-admin.firebasestorage.app",
  messagingSenderId: "216199289793",
  appId: "1:216199289793:web:7632fbeaf03490fddced40"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Enable persistence
/*
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled
    // in one tab at a a time.
    console.warn('Persistence failed: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser does not support all of the
    // features required to enable persistence
    console.warn('Persistence failed: Browser not supported');
  }
});
*/

