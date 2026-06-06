// Shared Firebase Admin SDK bootstrap for QA harness scripts.
// Loads service account from env FIREBASE_SERVICE_ACCOUNT_KEY (JSON string)
// or from sahayakai-main/secrets/firebase-admin.json. Idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// Load .env.local then .env (.env.local wins via override:false on second load)
for (const f of ['.env.local', '.env']) {
  const p = path.join(REPO_ROOT, f);
  if (fs.existsSync(p)) dotenv.config({ path: p, override: false });
}

export const FIREBASE_WEB_API_KEY =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw';
export const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sahayakai-b4248';
export const FIREBASE_AUTH_DOMAIN =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${FIREBASE_PROJECT_ID}.firebaseapp.com`;
export const FIREBASE_APP_ID =
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '';

export const QA_EMAIL_DOMAIN = 'sahayakai.test';
export const QA_EMAIL_PREFIX = 'qa-';

function loadServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch (e) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY env is not valid JSON: ${e.message}`);
    }
  }
  const file = path.join(REPO_ROOT, 'secrets', 'firebase-admin.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  throw new Error(
    'Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY env or place secrets/firebase-admin.json.'
  );
}

export function getAdmin() {
  if (!admin.apps.length) {
    const sa = loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || FIREBASE_PROJECT_ID,
    });
  }
  return admin;
}

export function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) {
      out[arg.slice(2)] = true;
    } else {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    }
  }
  return out;
}

export function randomSuffix(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}
