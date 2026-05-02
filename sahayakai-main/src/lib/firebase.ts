import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// import { getAnalytics } from "firebase/analytics"; // Analytics often breaks in SSR if not handled carefully

// Firebase web-config values (apiKey + projectId + storageBucket etc.)
// are by design browser-exposed — see https://firebase.google.com/docs/projects/api-keys.
// Access control is enforced by Firestore security rules + App Check,
// not by hiding these values. They are configuration, not secrets.
//
// The literal fallbacks here exist so a Next.js build inside a
// minimally-configured Docker image (e.g. CI without `--build-arg`)
// still produces a working bundle for the staging / smoke-test path.
// Production deploys MUST set the env vars explicitly via
// apphosting.yaml's secret reference (rotation discipline) or the
// cloud-run.yml `--set-secrets` line.
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw",
    // authDomain is www.sahayakai.com — same eTLD+1 as the app's
    // sahayakai.com so the OAuth iframe loads first-party for iOS Safari ITP
    // (fixes signInWithRedirect on iPhone). The /__/auth/* paths are
    // reverse-proxied to *.firebaseapp.com by next.config.ts; init.json is
    // served statically from public/__/firebase/init.json.
    //
    // We deliberately do NOT use bare "sahayakai.com" — Firebase's
    // identitytoolkit createAuthUri rejects it with INVALID_CONTINUE_URI
    // because the bare domain is registered as Firebase Hosting under a
    // different Firebase project, not sahayakai-b4248. www and auth
    // subdomains are not blocked.
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "www.sahayakai.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sahayakai-b4248",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sahayakai-b4248.firebasestorage.app",
    messagingSenderId: "640589855975",
    appId: "1:640589855975:web:624436f873a78069aa3642",
    measurementId: "G-273SVBVJ2L"
};

import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Initialize Firebase (Singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with persistent cache (Modern API)
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

const auth = getAuth(app);
const storage = getStorage(app);
const rtdb = getDatabase(app, "https://sahayakai-b4248-default-rtdb.asia-southeast1.firebasedatabase.app");

// Export instances
export { app, db, auth, storage, rtdb };
