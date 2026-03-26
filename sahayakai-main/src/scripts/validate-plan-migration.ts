/**
 * Validation script: verify planType migration completed successfully.
 * Run: npx tsx --env-file=.env.local src/scripts/validate-plan-migration.ts
 */

import { getDb } from '@/lib/firebase-admin';

async function main() {
    const db = await getDb();
    const usersRef = db.collection('users');

    const counts: Record<string, number> = {};
    const staleValues: string[] = [];

    // Count each planType value
    const snapshot = await usersRef.select('planType').get();
    for (const doc of snapshot.docs) {
        const plan = doc.data().planType ?? '(missing)';
        counts[plan] = (counts[plan] || 0) + 1;
        if (plan === 'pro' || plan === 'institution') {
            staleValues.push(doc.id);
        }
    }

    console.log('\n=== planType Distribution ===');
    for (const [plan, count] of Object.entries(counts).sort()) {
        const status = (plan === 'pro' || plan === 'institution') ? ' ← LEGACY (needs migration)' : '';
        console.log(`  ${plan}: ${count}${status}`);
    }
    console.log(`  TOTAL: ${snapshot.size}`);

    if (staleValues.length > 0) {
        console.log(`\nWARNING: ${staleValues.length} docs still have legacy values:`);
        staleValues.slice(0, 10).forEach(id => console.log(`  - ${id}`));
        if (staleValues.length > 10) console.log(`  ... and ${staleValues.length - 10} more`);
        process.exit(1);
    } else {
        console.log('\nMigration verified: no legacy planType values found.');
    }
}

main().catch((err) => {
    console.error('Validation failed:', err);
    process.exit(1);
});
