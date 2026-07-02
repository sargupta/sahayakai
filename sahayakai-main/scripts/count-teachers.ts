#!/usr/bin/env ts-node
/**
 * Count real teachers (excluding AI personas) and recent signups.
 *
 * AI personas carry `isAITeacher: true` per src/lib/ai-teacher-personas.ts.
 */

import { getDb } from '../src/lib/firebase-admin';

async function main() {
    const db = await getDb();

    const all = await db.collection('users').get();
    const total = all.size;

    let aiCount = 0;
    let humanCount = 0;
    let humanLast14d = 0;
    let humanNoCreatedAt = 0;
    let unknownIsAI = 0;

    const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;

    for (const doc of all.docs) {
        const d = doc.data() as Record<string, unknown>;
        const isAI = d.isAITeacher === true;
        if (isAI) {
            aiCount++;
            continue;
        }
        humanCount++;

        // createdAt can be a Firestore Timestamp, Date, or ISO string
        const created = d.createdAt;
        let createdMs: number | null = null;
        if (created && typeof (created as { toDate?: () => Date }).toDate === 'function') {
            createdMs = (created as { toDate: () => Date }).toDate().getTime();
        } else if (created instanceof Date) {
            createdMs = created.getTime();
        } else if (typeof created === 'string') {
            const t = Date.parse(created);
            if (!Number.isNaN(t)) createdMs = t;
        } else if (typeof created === 'number') {
            createdMs = created;
        }

        if (createdMs === null) {
            humanNoCreatedAt++;
        } else if (createdMs >= cutoffMs) {
            humanLast14d++;
        }
    }

    console.log('---');
    console.log(`Total users in collection            : ${total}`);
    console.log(`  AI personas (isAITeacher=true)     : ${aiCount}`);
    console.log(`  Real teachers                      : ${humanCount}`);
    console.log(`  …joined in last 14 days            : ${humanLast14d}`);
    console.log(`  …no createdAt field (legacy)       : ${humanNoCreatedAt}`);
    console.log('---');
    console.log(`Cutoff (UTC): ${new Date(cutoffMs).toISOString()}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
