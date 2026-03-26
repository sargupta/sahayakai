/**
 * Admin CLI: Approve a Sarkar (government teacher) verification.
 *
 * Usage:
 *   npx tsx src/scripts/approve-sarkar.ts <uid>
 */

import { initializeFirebase } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

async function main() {
    const uid = process.argv[2];
    if (!uid) {
        console.error('Usage: npx tsx src/scripts/approve-sarkar.ts <uid>');
        process.exit(1);
    }

    await initializeFirebase();
    const db = getFirestore();
    const auth = getAuth();

    // Update verification status
    await db.collection('sarkar_verifications').doc(uid).update({
        status: 'verified',
        verifiedAt: new Date(),
        verifiedBy: 'admin-cli',
    });

    // Update user profile — Sarkar gets Pro-equivalent access
    await db.collection('users').doc(uid).update({
        planType: 'pro', // Sarkar gets Pro-level features
        planSource: 'government',
        sarkarVerified: true,
        verifiedStatus: 'verified',
        updatedAt: new Date(),
    });

    // Set custom claim
    await auth.setCustomUserClaims(uid, { planType: 'pro', sarkar: true });

    console.log(`Approved Sarkar status for ${uid}. User now has Pro access (government-subsidized).`);
}

main().catch(err => { console.error(err); process.exit(1); });
