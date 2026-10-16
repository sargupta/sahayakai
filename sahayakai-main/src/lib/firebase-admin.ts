// server-only import removed to allow utility scripts (npx tsx) to run firebase-admin logic
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { getSecret } from '@/lib/secrets';
import { logger } from '@/lib/logger';

let firebasePromise: Promise<void> | null = null;

/** Default project id for the local emulator. A `demo-` id can never resolve to a real Google Cloud project. */
export const EMULATOR_DEFAULT_PROJECT_ID = 'demo-sahayakai';

const LOCAL_EMULATOR_HOST = /^(localhost|127\.0\.0\.1|\[::1\]):\d{2,5}$/;

/**
 * Development-only Firestore-emulator path. Returns the app options to use, or null to keep
 * the normal (service account / Secret Manager) path, which is unchanged.
 *
 * Taken ONLY when NODE_ENV === 'development' AND FIRESTORE_EMULATOR_HOST is explicitly set.
 * Then no credential is loaded at all — no FIREBASE_SERVICE_ACCOUNT_KEY, no Secret Manager —
 * so a developer machine with gcloud logged in can never pull the production key this way.
 * The emulator host must be local; anything else is refused rather than silently sending
 * Firestore traffic somewhere unexpected. The project id comes from GCLOUD_PROJECT, else a
 * `demo-` id; it never falls back to the production project id.
 */
export function emulatorAdminOptions(env: Record<string, string | undefined> = process.env): { projectId: string } | null {
  if (env.NODE_ENV !== 'development') return null;
  const host = env.FIRESTORE_EMULATOR_HOST?.trim();
  if (!host) return null;
  if (!LOCAL_EMULATOR_HOST.test(host)) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be a local address (localhost/127.0.0.1/[::1]:port) in development');
  }
  return { projectId: env.GCLOUD_PROJECT?.trim() || EMULATOR_DEFAULT_PROJECT_ID };
}

export async function initializeFirebase() {
  if (firebasePromise) return firebasePromise;

  firebasePromise = (async () => {
    if (!admin.apps.length) {
      try {
        const emulator = emulatorAdminOptions();
        if (emulator) {
          // Firestore calls go to FIRESTORE_EMULATOR_HOST; no credentials are read or fetched.
          admin.initializeApp({ projectId: emulator.projectId });
          logger.info("Initialized for the local Firestore emulator (development only).", "FirebaseAdmin", { projectId: emulator.projectId });
          return;
        }
        logger.info("Initializing...", "FirebaseAdmin");
        const isPlaceholder = (val?: string) => !val || val.startsWith('secrets/');
        let serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (isPlaceholder(serviceAccountString)) {
          logger.info("Fetching service account from Secret Manager...", "FirebaseAdmin");
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
            logger.info("Fetching AI keys...", "FirebaseAdmin");
            process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_GENAI_API_KEY');
          } catch (e) {
            process.env.GOOGLE_GENAI_API_KEY = await getSecret('GOOGLE_API_KEY').catch(() => "");
          }
        }

        const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'sahayakai-b4248-mumbai';
        logger.info("Using storage bucket", "FirebaseAdmin", { storageBucket });

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
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
