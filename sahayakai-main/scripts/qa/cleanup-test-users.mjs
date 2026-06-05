#!/usr/bin/env node
// Delete all Firebase Auth users matching qa-*@sahayakai.test and their Firestore docs.
// Idempotent. Safe to re-run.
//
// Usage: node scripts/qa/cleanup-test-users.mjs [--dryRun]
import { getAdmin, parseArgs, QA_EMAIL_DOMAIN, QA_EMAIL_PREFIX } from './lib/admin.mjs';

const args = parseArgs(process.argv);
const dryRun = !!args.dryRun;

const admin = getAdmin();
const auth = admin.auth();
const db = admin.firestore();

function isQaEmail(email) {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower.endsWith(`@${QA_EMAIL_DOMAIN}`) && lower.startsWith(QA_EMAIL_PREFIX);
}

async function main() {
  let nextPageToken;
  const victims = [];
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const u of page.users) {
      if (isQaEmail(u.email)) victims.push({ uid: u.uid, email: u.email });
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  if (victims.length === 0) {
    process.stdout.write(JSON.stringify({ deleted: 0, message: 'no qa users found' }) + '\n');
    return;
  }

  if (dryRun) {
    process.stdout.write(JSON.stringify({ dryRun: true, wouldDelete: victims }, null, 2) + '\n');
    return;
  }

  // Delete Firestore docs (best effort)
  const fsResults = await Promise.allSettled(
    victims.map((v) => db.collection('users').doc(v.uid).delete())
  );

  // Delete auth users in chunks (Admin SDK supports up to 1000 per call)
  const chunkSize = 100;
  let authDeleted = 0;
  for (let i = 0; i < victims.length; i += chunkSize) {
    const chunk = victims.slice(i, i + chunkSize).map((v) => v.uid);
    const res = await auth.deleteUsers(chunk);
    authDeleted += res.successCount;
  }

  process.stdout.write(
    JSON.stringify(
      {
        deleted: authDeleted,
        firestoreFailures: fsResults.filter((r) => r.status === 'rejected').length,
        emails: victims.map((v) => v.email),
      },
      null,
      2
    ) + '\n'
  );
}

main().catch((err) => {
  process.stderr.write(`[cleanup-test-users] ${err.stack || err.message || err}\n`);
  process.exit(1);
});
