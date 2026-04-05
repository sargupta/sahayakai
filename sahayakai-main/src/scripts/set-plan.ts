/**
 * Admin CLI: Set a user's plan type.
 *
 * Usage:
 *   npx tsx src/scripts/set-plan.ts <uid> <plan>
 *
 * Examples:
 *   npx tsx src/scripts/set-plan.ts abc123 pro
 *   npx tsx src/scripts/set-plan.ts abc123 free
 */

import { initializeFirebase } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const VALID_PLANS = ['free', 'pro', 'gold', 'premium'] as const;

async function main() {
    const [uid, plan] = process.argv.slice(2);

    if (!uid || !plan) {
        console.error('Usage: npx tsx src/scripts/set-plan.ts <uid> <plan>');
        console.error('Plans:', VALID_PLANS.join(', '));
        process.exit(1);
    }

    if (!VALID_PLANS.includes(plan as any)) {
        console.error(`Invalid plan: ${plan}. Valid plans: ${VALID_PLANS.join(', ')}`);
        process.exit(1);
    }

    await initializeFirebase();
    const db = getFirestore();
    const auth = getAuth();

    // Update Firestore user doc
    await db.collection('users').doc(uid).update({
        planType: plan,
        updatedAt: new Date(),
    });

    // Set Firebase custom claim so middleware reads it from JWT
    await auth.setCustomUserClaims(uid, { planType: plan });

    console.log(`Set plan for ${uid} to ${plan}`);
    console.log('User must re-authenticate (or wait for token refresh) to pick up new claim.');
}

main().catch(err => { console.error(err); process.exit(1); });
