import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics"; // Analytics often breaks in SSR if not handled carefully

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "auth.sahayakai.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sahayakai-b4248",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sahayakai-b4248.firebasestorage.app",
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

// Enable Offline Persistence (Client-side only)
if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a a time.
            console.warn('Firestore persistence failed: Multiple tabs open');
        } else if (err.code == 'unimplemented') {
            // The current browser does not support all of the features required to enable persistence
            console.warn('Firestore persistence not supported by this browser');
        }
    });
}

// Export instances
export { app, db, auth, storage };
