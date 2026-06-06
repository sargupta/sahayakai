#!/usr/bin/env ts-node
/**
 * One-shot fixture cleanup. Deletes every doc in `users` classified as a
 * fixture by the same rules `scripts/full-user-audit.ts` uses, EXCLUDING
 * the seeded demo school (`isDemoData=true`) so sales demos still work.
 *
 * Dry-run by default. Pass `--commit` to actually delete.
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/delete-fixture-users.ts
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/delete-fixture-users.ts --commit
 *
 * Also removes any associated `users/{uid}/avatars/*` Storage objects that
 * the avatar-generator created during canary probe runs.
 */
import { getDb, getStorageInstance } from '../src/lib/firebase-admin';

type Bucket =
    | 'AI_PERSONA'
    | 'FIXTURE_CANARY'
    | 'FIXTURE_QA'
    | 'FIXTURE_DEMO'
    | 'FIXTURE_DEV'
    | 'FIXTURE_TEST_EMAIL'
    | 'REAL';

function classify(uid: string, d: Record<string, unknown>): { bucket: Bucket; reason: string } {
    if (d.isAITeacher === true) return { bucket: 'AI_PERSONA', reason: 'isAITeacher=true' };
    if (d.isDevImpersonation === true) return { bucket: 'FIXTURE_DEV', reason: 'isDevImpersonation=true' };
    if (d.isDemoData === true)        return { bucket: 'FIXTURE_DEMO', reason: 'isDemoData=true' };
    if (d.qaTestUser === true)        return { bucket: 'FIXTURE_QA', reason: 'qaTestUser=true' };
    if (d.qaProvisionedAt)            return { bucket: 'FIXTURE_QA', reason: 'qaProvisionedAt set' };

    const email = ((d.email as string | undefined) ?? '').toLowerCase();
    for (const dom of ['@sahayakai.test', '@sahayak.test', '@example.com', '@test.com']) {
        if (email.endsWith(dom)) return { bucket: 'FIXTURE_TEST_EMAIL', reason: `email ${dom}` };
    }

    const u = uid.toLowerCase();
    if (u.includes('canary') || u.includes('probe') || u.includes('smoke'))
        return { bucket: 'FIXTURE_CANARY', reason: 'uid contains canary/probe/smoke' };
    if (u.startsWith('qa-') || u.includes('-qa-') || u.includes('parity') || u.includes('fixture'))
        return { bucket: 'FIXTURE_QA', reason: 'uid contains qa-/parity/fixture' };
    if (u.startsWith('demo-') || u.includes('-demo-'))
        return { bucket: 'FIXTURE_DEMO', reason: 'uid contains demo-' };
    if (u.startsWith('dev-') || u.includes('dev-user'))
        return { bucket: 'FIXTURE_DEV', reason: 'uid contains dev-' };
    if (u.startsWith('sim-')) return { bucket: 'FIXTURE_QA', reason: 'uid starts sim-' };
    if (u.startsWith('seed-') || u.includes('-seed-')) return { bucket: 'FIXTURE_DEMO', reason: 'uid contains seed-' };
    if (u.startsWith('test-') || u.includes('-test-')) return { bucket: 'FIXTURE_QA', reason: 'uid contains test-' };

    return { bucket: 'REAL', reason: '' };
}

// Buckets we will actually delete. AI personas + the seeded demo school
// stay; demo school is excluded because sales/principal pitches depend on it.
const DELETABLE_BUCKETS: Set<Bucket> = new Set([
    'FIXTURE_CANARY', 'FIXTURE_QA', 'FIXTURE_DEV', 'FIXTURE_TEST_EMAIL',
]);

async function deleteStorageAvatars(uid: string): Promise<number> {
    try {
        const storage = await getStorageInstance();
        const [files] = await storage.bucket().getFiles({ prefix: `users/${uid}/avatars/` });
        if (files.length === 0) return 0;
        await Promise.all(files.map(f => f.delete().catch(() => undefined)));
        return files.length;
    } catch {
        return 0;
    }
}

async function main() {
    const commit = process.argv.includes('--commit');
    const db = await getDb();
    const all = await db.collection('users').get();

    const targets: Array<{ uid: string; bucket: Bucket; reason: string }> = [];
    const breakdown: Record<Bucket, number> = {
        AI_PERSONA: 0, FIXTURE_CANARY: 0, FIXTURE_QA: 0, FIXTURE_DEMO: 0,
        FIXTURE_DEV: 0, FIXTURE_TEST_EMAIL: 0, REAL: 0,
    };

    for (const doc of all.docs) {
        const { bucket, reason } = classify(doc.id, doc.data() as Record<string, unknown>);
        breakdown[bucket]++;
        if (DELETABLE_BUCKETS.has(bucket)) targets.push({ uid: doc.id, bucket, reason });
    }

    console.error('=== Bucket breakdown ===');
    for (const [k,v] of Object.entries(breakdown)) console.error(`  ${k.padEnd(22)} ${v}`);
    console.error();
    console.error(`=== Targets to delete (${targets.length}) ===`);
    const byBucket: Record<string, number> = {};
    for (const t of targets) byBucket[t.bucket] = (byBucket[t.bucket] ?? 0) + 1;
    for (const [k,v] of Object.entries(byBucket)) console.error(`  ${k.padEnd(22)} ${v}`);
    console.error();
    console.error('Kept buckets: REAL, AI_PERSONA, FIXTURE_DEMO (seeded demo school)');

    if (!commit) {
        console.error();
        console.error('--- DRY RUN — no writes ---');
        console.error('Sample targets:');
        for (const t of targets.slice(0, 10)) console.error(`  delete users/${t.uid}  (${t.bucket}: ${t.reason})`);
        console.error('Re-run with --commit to delete.');
        return;
    }

    console.error();
    console.error('--- COMMITTING ---');
    let deleted = 0, storageDeleted = 0;
    // Batch deletes: 400 per Firestore batch
    const chunkSize = 400;
    for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        const batch = db.batch();
        for (const t of chunk) {
            batch.delete(db.collection('users').doc(t.uid));
        }
        await batch.commit();
        // Delete avatar Storage objects sequentially (rate-limited API)
        for (const t of chunk) {
            const n = await deleteStorageAvatars(t.uid);
            storageDeleted += n;
        }
        deleted += chunk.length;
        console.error(`  ${deleted}/${targets.length} docs deleted, ${storageDeleted} avatar files removed`);
    }
    console.error();
    console.error(`=== Done: deleted ${deleted} user docs + ${storageDeleted} avatar files ===`);
}

main().catch((e) => { console.error(e); process.exit(1); });
