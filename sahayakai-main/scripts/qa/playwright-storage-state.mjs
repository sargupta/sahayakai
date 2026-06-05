#!/usr/bin/env node
// Provision a QA user and emit a Playwright storageState.json so the test session
// boots pre-authenticated. Mimics what the Firebase JS SDK writes to IndexedDB/localStorage
// after signInWithCustomToken — we synthesize a `firebase:authUser:{apiKey}:[DEFAULT]` entry
// that the SDK will pick up on init via `setPersistence(browserLocalPersistence)`.
//
// Usage:
//   node scripts/qa/playwright-storage-state.mjs \
//     [--baseUrl=https://sahayakai-preview-zwydpvyuca-as.a.run.app] \
//     [--out=qa/fixtures/storage-state-<uid>.json] \
//     <...provision-test-user flags>
//
// Prints { uid, email, storageStatePath } to stdout.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, FIREBASE_WEB_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_APP_ID } from './lib/admin.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const args = parseArgs(process.argv);
const baseUrl = args.baseUrl || 'https://sahayakai-preview-zwydpvyuca-as.a.run.app';

// Forward all non-internal flags to the provisioner.
const internal = new Set(['baseUrl', 'out']);
const forwarded = Object.entries(args)
  .filter(([k]) => !internal.has(k))
  .map(([k, v]) => (v === true ? `--${k}` : `--${k}=${v}`));

const provisionScript = path.join(__dirname, 'provision-test-user.mjs');
const proc = spawnSync('node', [provisionScript, ...forwarded], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
if (proc.status !== 0) {
  process.stderr.write('[playwright-storage-state] provision step failed\n');
  process.exit(proc.status || 1);
}
const provisioned = JSON.parse(proc.stdout);
const { uid, email, idToken, refreshToken, expiresIn } = provisioned;

// Synthesize the Firebase Web SDK's persisted-user record.
// Schema mirrors what `firebase/auth` writes when persistence=local; the SDK reloads it on init.
const stsTokenManager = {
  refreshToken,
  accessToken: idToken,
  expirationTime: Date.now() + Number(expiresIn || 3600) * 1000,
};
const persistedUser = {
  uid,
  email,
  emailVerified: true,
  isAnonymous: false,
  providerData: [
    {
      providerId: 'password',
      uid: email,
      displayName: null,
      email,
      phoneNumber: null,
      photoURL: null,
    },
  ],
  stsTokenManager,
  createdAt: String(Date.now()),
  lastLoginAt: String(Date.now()),
  apiKey: FIREBASE_WEB_API_KEY,
  appName: '[DEFAULT]',
};

// localStorage keys used by Firebase Auth Web SDK.
const authKey = `firebase:authUser:${FIREBASE_WEB_API_KEY}:[DEFAULT]`;
const heartbeatKey = `firebase-heartbeat-database`;

const url = new URL(baseUrl);
const storageState = {
  cookies: [],
  origins: [
    {
      origin: `${url.protocol}//${url.host}`,
      localStorage: [
        { name: authKey, value: JSON.stringify(persistedUser) },
        // Hint to skip greeting / onboarding tours.
        { name: 'sahayakai:qa', value: 'true' },
      ],
    },
  ],
};

const outDir = path.join(REPO_ROOT, 'qa', 'fixtures');
fs.mkdirSync(outDir, { recursive: true });
const outPath = args.out
  ? path.resolve(REPO_ROOT, String(args.out))
  : path.join(outDir, `storage-state-${uid}.json`);
fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2));

process.stdout.write(
  JSON.stringify(
    {
      uid,
      email,
      idToken,
      refreshToken,
      storageStatePath: outPath,
      baseUrl,
      authDomain: FIREBASE_AUTH_DOMAIN,
      appId: FIREBASE_APP_ID,
    },
    null,
    2
  ) + '\n'
);
