#!/usr/bin/env ts-node
/**
 * Backfill missing profile fields on Firestore `users` docs from Firebase Auth metadata.
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-profile-from-auth.ts          # dry-run
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-profile-from-auth.ts --commit # write
 *
 * Rules:
 *  - Only touch docs where isAITeacher !== true (real teachers).
 *  - Never clobber existing values on the Firestore doc (only fill missing).
 *  - Fields backfilled: email, displayName, photoURL, createdAt, uid (uid always denormalized).
 *  - Orphan auth-deleted uids are logged and skipped.
 */
import { getDb, getAuthInstance } from '../src/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

type PlannedWrite = {
  uid: string;
  updates: Record<string, unknown>;
};

const isMissing = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

async function main() {
  const commit = process.argv.includes('--commit');
  console.error(`[backfill] mode=${commit ? 'COMMIT' : 'DRY-RUN'}`);

  const db = await getDb();
  const auth = await getAuthInstance();

  const snap = await db.collection('users').get();
  console.error(`[backfill] scanned ${snap.size} total user docs`);

  const planned: PlannedWrite[] = [];
  const fieldCounts: Record<string, number> = {
    email: 0,
    displayName: 0,
    photoURL: 0,
    createdAt: 0,
    uid: 0,
  };
  const orphans: string[] = [];
  let realCount = 0;
  let skippedNoUpdate = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.isAITeacher === true) continue;
    realCount++;
    const uid = doc.id;

    let authUser;
    try {
      authUser = await auth.getUser(uid);
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        orphans.push(uid);
      } else {
        console.error(`[backfill] auth lookup error uid=${uid}: ${err?.message || err}`);
        orphans.push(uid);
      }
      continue;
    }

    const updates: Record<string, unknown> = {};

    if (isMissing(data.email) && authUser.email) {
      updates.email = authUser.email;
      fieldCounts.email++;
    }
    if (isMissing(data.displayName) && authUser.displayName) {
      updates.displayName = authUser.displayName;
      fieldCounts.displayName++;
    }
    if (isMissing(data.photoURL) && authUser.photoURL) {
      updates.photoURL = authUser.photoURL;
      fieldCounts.photoURL++;
    }
    if (isMissing(data.createdAt) && authUser.metadata?.creationTime) {
      const parsed = new Date(authUser.metadata.creationTime);
      if (!isNaN(parsed.getTime())) {
        updates.createdAt = Timestamp.fromDate(parsed);
        fieldCounts.createdAt++;
      }
    }
    // uid always denormalized
    if (isMissing(data.uid) || data.uid !== uid) {
      updates.uid = uid;
      fieldCounts.uid++;
    }

    if (Object.keys(updates).length === 0) {
      skippedNoUpdate++;
      continue;
    }
    planned.push({ uid, updates });
  }

  console.error(`[backfill] real teachers scanned: ${realCount}`);
  console.error(`[backfill] planned writes: ${planned.length}`);
  console.error(`[backfill] no-op (already complete): ${skippedNoUpdate}`);
  console.error(`[backfill] orphan uids (auth missing): ${orphans.length}`);

  if (!commit) {
    console.error('\n[backfill] DRY-RUN planned diffs (first 25):');
    for (const p of planned.slice(0, 25)) {
      const summary = Object.entries(p.updates)
        .map(([k, v]) => {
          if (v instanceof Timestamp) return `${k}=<ts:${v.toDate().toISOString()}>`;
          const s = typeof v === 'string' ? v : JSON.stringify(v);
          return `${k}=${(s || '').toString().slice(0, 60)}`;
        })
        .join(', ');
      console.error(`  ${p.uid}: ${summary}`);
    }
    if (orphans.length) {
      console.error('\n[backfill] orphan uids:');
      for (const o of orphans) console.error(`  ${o}`);
    }
  } else {
    console.error('\n[backfill] COMMITTING writes in batches of 400...');
    const BATCH = 400;
    let written = 0;
    for (let i = 0; i < planned.length; i += BATCH) {
      const slice = planned.slice(i, i + BATCH);
      const batch = db.batch();
      for (const p of slice) {
        batch.set(db.collection('users').doc(p.uid), p.updates, { merge: true });
      }
      await batch.commit();
      written += slice.length;
      console.error(`[backfill] committed ${written}/${planned.length}`);
    }
  }

  console.error('\n=== SUMMARY ===');
  console.error(`mode               : ${commit ? 'COMMIT' : 'DRY-RUN'}`);
  console.error(`real teachers      : ${realCount}`);
  console.error(`updates planned    : ${planned.length}`);
  console.error(`already complete   : ${skippedNoUpdate}`);
  console.error(`orphan uids        : ${orphans.length}`);
  console.error('per-field fill count:');
  for (const [k, v] of Object.entries(fieldCounts)) {
    console.error(`  ${k.padEnd(15)} ${v}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
