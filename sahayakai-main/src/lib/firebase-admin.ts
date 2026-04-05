// server-only import removed to allow utility scripts (npx tsx) to run firebase-admin logic
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getSecret } from '@/lib/secrets';

let firebasePromise: Promise<void> | null = null;

export async function initializeFirebase() {
  if (firebasePromise) return firebasePromise;

  firebasePromise = (async () => {
    if (!admin.apps.length) {
      try {
        console.log("[FirebaseAdmin] Initializing...");
        const isPlaceholder = (val?: string) => !val || val.startsWith('secrets/');
        let serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (isPlaceholder(serviceAccountString)) {
          console.log("[FirebaseAdmin] Fetching service account from Secret Manager...");
          serviceAccountString = await getSecret('FIREBASE_SERVICE_ACCOUNT_KEY');
        }

        if (isPlaceholder(serviceAccountString)) {
          throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not found in Environment or Secret Manager.");
        }

        let serviceAccount: any;
        try {
          serviceAccount = JSON.parse(serviceAccountString!);
        } catch (e) {
          throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not a valid JSON string. If you are using Secret Manager, ensure your local .env.local doesn't have a placeholder for it, or that gcloud auth is configured.");
        }

        if (isPlaceholder(process.env.GOOGLE_GENAI_API_KEY)) {
          try {
            console.log("[FirebaseAdmin] Fetching AI keys...");
            process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_GENAI_API_KEY');
          } catch (e) {
            process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_API_KEY').catch(() => "");
          }
        }

        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'sahayakai-b4248.firebasestorage.app';
        console.log(`[FirebaseAdmin] Using storage bucket: ${storageBucket}`);

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: storageBucket,
        });
        console.log("[FirebaseAdmin] Success.");
      } catch (error: any) {
        console.error('[FirebaseAdmin] Initialization error:', error.message);
        firebasePromise = null; // Allow retry on failure
        throw new Error(`Firebase Init Failed: ${error.message}`);
      }
    }
  })();

  return firebasePromise;
}

function checkInitialized() {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin not initialized.");
  }
}

export async function getDb() {
  await initializeFirebase();
  checkInitialized();
  return getFirestore();
}

export async function getAuthInstance() {
  await initializeFirebase();
  checkInitialized();
  return getAuth();
}

export async function getStorageInstance() {
  await initializeFirebase();
  checkInitialized();
  return getStorage();
}
