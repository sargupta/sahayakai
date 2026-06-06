/**
 * Backfill: copy legacy `timestamp` field → `createdAt` on community_chat docs.
 *
 * F12-P1-08 fix. Run once after deploying the schema standardisation.
 *
 * Usage:
 *   npx tsx scripts/migrate-community-chat-timestamp-to-createdat.ts          # dry-run
 *   npx tsx scripts/migrate-community-chat-timestamp-to-createdat.ts --commit  # write
 *
 * Idempotent: skips any doc that already has `createdAt`.
 */
import { getDb } from '../src/lib/firebase-admin';

async function main() {
  const commit = process.argv.includes('--commit');
  const db = await getDb();
  const snap = await db.collection('community_chat').get();
  let migrated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.createdAt) {
      skipped++;
      continue;
    }
    if (!d.timestamp) {
      skipped++;
      continue;
    }
    if (commit) {
      batch.update(doc.ref, { createdAt: d.timestamp });
      batchCount++;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    migrated++;
  }
  if (commit && batchCount > 0) {
    await batch.commit();
  }
  console.log(JSON.stringify({ commit, total: snap.size, migrated, skipped }, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
