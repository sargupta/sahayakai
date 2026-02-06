import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics"; // Analytics often breaks in SSR if not handled carefully

const firebaseConfig = {
    apiKey: "AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw",
    authDomain: "auth.sahayakai.com",
    projectId: "sahayakai-b4248",
    storageBucket: "sahayakai-b4248.firebasestorage.app",
    messagingSenderId: "640589855975",
    appId: "1:640589855975:web:624436f873a78069aa3642",
    measurementId: "G-273SVBVJ2L"
};

import { getAuth } from "firebase/auth";

// Initialize Firebase (Singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Export instances
export { app, db, auth, storage };
