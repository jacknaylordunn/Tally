
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDQk5fIToyGp8qxyD2llk_v8N3E0aNO3G4",
  authDomain: "tally-493b4.firebaseapp.com",
  projectId: "tally-493b4",
  storageBucket: "tally-493b4.firebasestorage.app",
  messagingSenderId: "368392212816",
  appId: "1:368392212816:web:4c972da587683ab8215c55",
  measurementId: "G-3FRM69SG4X"
};

// Initialize Firebase
// Check if apps already initialized to prevent hot-reload errors in development
// We avoid explicit type annotation for 'app' to prevent module resolution errors
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore
// Handle potential duplicate initialization during hot reloads
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // If Firestore is already initialized, use the existing instance
  db = getFirestore(app);
}

export { db };
export const auth = getAuth(app);

export default app;
