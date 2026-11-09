// server-only import removed to allow utility scripts (npx tsx) to run firebase-admin logic
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';

let firebasePromise: Promise<void> | null = null;

export async function initializeFirebase() {
  if (firebasePromise) return firebasePromise;

  firebasePromise = (async () => {
    if (!admin.apps.length) {
      try {
        logger.info("Initializing...", "FirebaseAdmin");
        const isPlaceholder = (val?: string) => !val || val.startsWith('secrets/');
        let serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (isPlaceholder(serviceAccountString)) {
          logger.info("Fetching service account from Secret Manager...", "FirebaseAdmin");
          serviceAccountString = await getSecret('FIREBASE_SERVICE_ACCOUNT_KEY').catch(() => undefined);
        }

        // No key anywhere: fall back to Application Default Credentials, i.e.
        // the Cloud Run runtime service account. Keyless is the safer setup;
        // the key path stays for local dev and the original project.
        let credential: ReturnType<typeof admin.credential.applicationDefault>;
        if (isPlaceholder(serviceAccountString)) {
          logger.info("No service account key; using Application Default Credentials", "FirebaseAdmin");
          credential = admin.credential.applicationDefault();
        } else {
          let serviceAccount: any;
          try {
            serviceAccount = JSON.parse(serviceAccountString!);
          } catch (e) {
            throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not a valid JSON string. If you are using Secret Manager, ensure your local .env.local doesn't have a placeholder for it, or that gcloud auth is configured.");
          }
          credential = admin.credential.cert(serviceAccount);
        }

        if (isPlaceholder(process.env.GOOGLE_GENAI_API_KEY)) {
          try {
            logger.info("Fetching AI keys...", "FirebaseAdmin");
            process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_GENAI_API_KEY');
          } catch (e) {
            process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_API_KEY').catch(() => "");
          }
        }

        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'sahayakai-b4248-mumbai';
        logger.info("Using storage bucket", "FirebaseAdmin", { storageBucket });

        admin.initializeApp({
          credential,
          projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: storageBucket,
        });
        logger.info("Success.", "FirebaseAdmin");
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
