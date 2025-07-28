import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretManager = new SecretManagerServiceClient();

async function getSecret(secretName: string): Promise<string> {
  const [version] = await secretManager.accessSecretVersion({
    name: `projects/sahayakai-f69e0/secrets/${secretName}/versions/latest`,
  });
  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error(`Secret ${secretName} has no payload.`);
  }
  return payload;
}

async function initializeFirebase() {
  if (!admin.apps.length) {
    try {
      const serviceAccountString = await getSecret('FIREBASE_SERVICE_ACCOUNT_KEY');
      const serviceAccount = JSON.parse(serviceAccountString);

      // Also fetch the Google API key and set it as an environment variable
      // so the Genkit/GoogleAI plugin can access it.
      process.env.GOOGLE_API_KEY = await getSecret('GOOGLE_API_KEY');

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } catch (error: any) {
      console.error('Firebase admin initialization error:', error);
      throw new Error(`Firebase admin initialization error: ${error.message}`);
    }
  }
}

// Initialize and then export.
// Note: This makes the initialization asynchronous.
// You may need to handle this promise in the parts of your app that use db, auth, or storage.
initializeFirebase();

export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();
