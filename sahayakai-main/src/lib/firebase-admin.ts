import 'server-only';
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

let firebaseInitialized = false;

export async function initializeFirebase() {
  if (!admin.apps.length && !firebaseInitialized) {
    try {
      let serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

      // Fallback to Secret Manager if not in env (Production)
      if (!serviceAccountString) {
        try {
          serviceAccountString = await getSecret('FIREBASE_SERVICE_ACCOUNT_KEY');
        } catch (secretError: any) {
          if (secretError.message?.includes('Could not load the default credentials')) {
            console.warn("Details: Failed to load default credentials for Secret Manager.");
          }
          // If we can't get the service account, we can't initialize Admin SDK.
          // This is a terminal error for DB-related features.
          throw secretError;
        }
      }

      if (!serviceAccountString) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not found in Environment or Secret Manager.");
      }

      const serviceAccount = JSON.parse(serviceAccountString);

      // Align with Maintenance Guide: Use GOOGLE_GENAI_API_KEY
      if (!process.env.GOOGLE_GENAI_API_KEY) {
        try {
          process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_GENAI_API_KEY');
        } catch (e) {
          // Fallback to legacy name if new name fails
          process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_API_KEY').catch(() => "");
        }
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      firebaseInitialized = true;
    } catch (error: any) {
      console.error('Firebase admin initialization error:', error.message);
      // We throw a descriptive error so the caller can handle it or report it.
      throw new Error(`Firebase Init Failed: ${error.message}`);
    }
  }
}

// We will export functions to get the services, which will ensure initialization
// Helper to ensure we don't try to use the DB if init failed
function checkInitialized() {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin not initialized. Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env or Secret Manager.");
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
