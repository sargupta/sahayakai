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

let firebaseInitialized = false;

export async function initializeFirebase() {
  if (!admin.apps.length && !firebaseInitialized) {
    try {
      const serviceAccountString = await getSecret('FIREBASE_SERVICE_ACCOUNT_KEY');
      const serviceAccount = JSON.parse(serviceAccountString);

      process.env.GOOGLE_API_KEY = await getSecret('GOOGLE_API_KEY');

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      firebaseInitialized = true;
    } catch (error: any) {
      console.error('Firebase admin initialization error:', error);
      throw new Error(`Firebase admin initialization error: ${error.message}`);
    }
  }
}

// We will export functions to get the services, which will ensure initialization
export async function getDb() {
  await initializeFirebase();
  return getFirestore();
}

export async function getAuthInstance() {
  await initializeFirebase();
  return getAuth();
}

export async function getStorageInstance() {
  await initializeFirebase();
  return getStorage();
}
