/**
 * List all users with paid plans (pro/gold/premium).
 * Usage: npx tsx src/scripts/list-premium-users.ts
 */
import { initializeFirebase } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

async function main() {
    await initializeFirebase();
    const db = getFirestore();
    const auth = getAuth();

    const paidPlans = ['pro', 'gold', 'premium'];
    const snap = await db.collection('users').where('planType', 'in', paidPlans).get();

    console.log(`Found ${snap.size} paid users:\n`);
    const rows: Array<{ plan: string; email: string; uid: string; name?: string }> = [];

    for (const doc of snap.docs) {
        const data = doc.data();
        let email = data.email ?? '';
        if (!email) {
            try {
                const u = await auth.getUser(doc.id);
                email = u.email ?? '(no email)';
            } catch {
                email = '(auth lookup failed)';
            }
        }
        rows.push({
            plan: data.planType,
            email,
            uid: doc.id,
            name: data.displayName ?? data.name,
        });
    }

    rows.sort((a, b) => a.plan.localeCompare(b.plan));
    for (const r of rows) {
        console.log(`[${r.plan.padEnd(8)}] ${r.email.padEnd(40)} ${r.name ?? ''}  (${r.uid})`);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
