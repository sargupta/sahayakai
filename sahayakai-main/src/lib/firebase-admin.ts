// server-only import removed to allow utility scripts (npx tsx) to run firebase-admin logic
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
// Lazy load client to prevent crash if no credentials
let secretManager: any = null;

async function getSecret(secretName: string): Promise<string> {
  try {
    if (!secretManager) {
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
      secretManager = new SecretManagerServiceClient();
    }

    const [version] = await secretManager.accessSecretVersion({
      name: `projects/sahayakai-b4248/secrets/${secretName}/versions/latest`,
    });
    const payload = version.payload?.data?.toString();
    if (!payload) {
      throw new Error(`Secret ${secretName} has no payload.`);
    }
    return payload;
  } catch (error: any) {
    // If we can't load credentials, or secret doesn't exist, we log and throw a clean error
    console.warn(`[getSecret] Could not fetch ${secretName}: ${error.message}`);
    throw error;
  }
}

let firebasePromise: Promise<void> | null = null;

export async function initializeFirebase() {
  if (firebasePromise) return firebasePromise;

  firebasePromise = (async () => {
    if (!admin.apps.length) {
      try {
        console.log("[FirebaseAdmin] Initializing...");
        let serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountString) {
          console.log("[FirebaseAdmin] Fetching service account from Secret Manager...");
          serviceAccountString = await getSecret('FIREBASE_SERVICE_ACCOUNT_KEY');
        }

        if (!serviceAccountString) {
          throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not found in Environment or Secret Manager.");
        }

        const serviceAccount = JSON.parse(serviceAccountString);

        if (!process.env.GOOGLE_GENAI_API_KEY) {
          try {
            console.log("[FirebaseAdmin] Fetching AI keys...");
            process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_GENAI_API_KEY');
          } catch (e) {
            process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_API_KEY').catch(() => "");
          }
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
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
