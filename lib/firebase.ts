import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

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
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence enabled
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);

export default app;