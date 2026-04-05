/**
 * Migration script: planType 'pro' → 'gold', 'institution' → 'premium'
 *
 * Run:   npx tsx --env-file=.env.local src/scripts/migrate-plan-types.ts
 * Dry:   DRY_RUN=1 npx tsx --env-file=.env.local src/scripts/migrate-plan-types.ts
 * Roll:  ROLLBACK=1 npx tsx --env-file=.env.local src/scripts/migrate-plan-types.ts
 */

import { getDb } from '@/lib/firebase-admin';

const DRY_RUN = process.env.DRY_RUN === '1';
const ROLLBACK = process.env.ROLLBACK === '1';
const BATCH_SIZE = 400; // Firestore max is 500, leave headroom

// Forward: old → new.  Rollback: new → old.
const FORWARD_MAP: Record<string, string> = { pro: 'gold', institution: 'premium' };
const REVERSE_MAP: Record<string, string> = { gold: 'pro', premium: 'institution' };

async function main() {
    const db = await getDb();
    const map = ROLLBACK ? REVERSE_MAP : FORWARD_MAP;
    const sourceValues = Object.keys(map);
    const direction = ROLLBACK ? 'ROLLBACK' : 'FORWARD';

    console.log(`\n=== planType migration (${direction}) ${DRY_RUN ? '[DRY RUN]' : ''} ===\n`);

    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const oldValue of sourceValues) {
        const newValue = map[oldValue];
        console.log(`Querying users with planType="${oldValue}"...`);

        const snapshot = await db.collection('users').where('planType', '==', oldValue).get();
        console.log(`  Found ${snapshot.size} documents.`);

        if (snapshot.empty) continue;

        // Process in batches
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + BATCH_SIZE);

            for (const doc of chunk) {
                batch.update(doc.ref, {
                    planType: newValue,
                    _planMigratedAt: new Date().toISOString(),
                    _planPreviousValue: oldValue,
                });
            }

            if (DRY_RUN) {
                console.log(`  [DRY] Would update ${chunk.length} docs: "${oldValue}" → "${newValue}"`);
            } else {
                await batch.commit();
                console.log(`  Updated ${chunk.length} docs: "${oldValue}" → "${newValue}"`);
            }

            totalUpdated += chunk.length;
        }
    }

    // Count remaining
    const freeCount = (await db.collection('users').where('planType', '==', 'free').count().get()).data().count;
    const staleProCount = (await db.collection('users').where('planType', '==', (ROLLBACK ? 'gold' : 'pro')).count().get()).data().count;
    const staleInstCount = (await db.collection('users').where('planType', '==', (ROLLBACK ? 'premium' : 'institution')).count().get()).data().count;

    console.log(`\n=== Summary ===`);
    console.log(`Updated: ${totalUpdated}`);
    console.log(`Remaining free: ${freeCount}`);
    console.log(`Stale values still present: ${staleProCount + staleInstCount}`);
    if (staleProCount + staleInstCount > 0) {
        console.warn(`WARNING: ${staleProCount + staleInstCount} documents still have old values!`);
    } else {
        console.log('All documents migrated successfully.');
    }
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
