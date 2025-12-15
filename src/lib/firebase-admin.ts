import 'server-only';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
// Lazy load client to prevent crash if no credentials
let secretManager: any = null;

async function getSecret(secretName: string): Promise<string> {
  if (!secretManager) {
    const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
    secretManager = new SecretManagerServiceClient();
  }

  const [version] = await secretManager.accessSecretVersion({
    name: `projects/sahayakai-f69e0/secrets/${secretName}/versions/latest`,
  });
  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error(`Secret ${secretName} has no payload.`);
  }
  return payload;
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
        } catch (secretError) {
          console.warn("Details: Failed to fetch from Secret Manager. Ensure you have GCP credentials or a local .env file.");
          throw secretError;
        }
      }

      if (!serviceAccountString) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not found in Environment or Secret Manager.");
      }

      const serviceAccount = JSON.parse(serviceAccountString);

      // Environment variable > Secret Manager for API Key too
      process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || await getSecret('GOOGLE_API_KEY').catch(() => "");

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      firebaseInitialized = true;
    } catch (error: any) {
      console.error('Firebase admin initialization error:', error);
      // We must throw here or let the subsequent checks fail. 
      // Throwing here is better to understand WHY it failed during init.
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
