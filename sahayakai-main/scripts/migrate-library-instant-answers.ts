#!/usr/bin/env ts-node
/**
 * Reclassify auto-saved instant answers out of My Library (non-destructive).
 *
 * Background: until 2026-10 every instant answer — greetings, "where is
 * attendance?", VIDYA factual follow-ups — was auto-saved to
 * users/{uid}/content as type 'instant-answer'. The code no longer does that
 * (src/ai/flows/instant-answer.ts, src/lib/sidecar/instant-answer-dispatch.ts).
 * This script deals with the rows already written.
 *
 * What it does (see src/lib/library-migration.ts for the evidence rules):
 *   auto       → HIDDEN: sets hiddenFromLibrary: true + libraryMigration stamp.
 *                The row, its data and its Storage blob are kept.
 *   saved      → kept (the teacher pressed Save).
 *   ambiguous  → kept (never guess).
 *   protected  → kept: ids referenced by users.firstGenerationContentId or by
 *                a community resource (library_resources.sourceContentId).
 * It NEVER deletes anything. Failed/in-flight rows need no migration — the
 * listing already filters them (isListableContent).
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/migrate-library-instant-answers.ts            # dry-run (default)
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/migrate-library-instant-answers.ts --apply    # hide auto rows
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/migrate-library-instant-answers.ts --revert   # un-hide this script's rows
 *
 * Output never includes question text (teacher data) — only counts and ids.
 */
import { getDb } from '../src/lib/firebase-admin';
import { classifyInstantAnswerRow, LIBRARY_MIGRATION_ID } from '../src/lib/library-migration';

const USER_PAGE = 300;
const BATCH_LIMIT = 400;

async function main() {
    const apply = process.argv.includes('--apply');
    const revert = process.argv.includes('--revert');
    if (apply && revert) throw new Error('Pass --apply OR --revert, not both');
    const mode = apply ? 'APPLY' : revert ? 'REVERT' : 'DRY-RUN';
    console.error(`[library-migration] mode=${mode} id=${LIBRARY_MIGRATION_ID}`);

    const db = await getDb();
    const totals = { users: 0, rows: 0, auto: 0, saved: 0, ambiguous: 0, protectedRefs: 0, alreadyHidden: 0, written: 0, reverted: 0 };
    const sampleAutoIds: string[] = [];
    const sampleAmbiguousIds: string[] = [];

    let lastUid: string | null = null;
    for (;;) {
        let q = db.collection('users').orderBy('__name__').limit(USER_PAGE);
        if (lastUid) q = q.startAfter(lastUid);
        const users = await q.get();
        if (users.empty) break;

        for (const user of users.docs) {
            totals.users++;
            const uid = user.id;
            const contentCol = db.collection('users').doc(uid).collection('content');
            let batch = db.batch();
            let pending = 0;
            const flush = async () => {
                if (pending > 0) await batch.commit();
                batch = db.batch();
                pending = 0;
            };

            if (revert) {
                const hidden = await contentCol.where('libraryMigration.id', '==', LIBRARY_MIGRATION_ID).get();
                for (const doc of hidden.docs) {
                    batch.update(doc.ref, { hiddenFromLibrary: false, libraryMigration: null });
                    pending++;
                    totals.reverted++;
                    if (pending >= BATCH_LIMIT) await flush();
                }
                await flush();
                continue;
            }

            const rows = await contentCol.where('type', '==', 'instant-answer').get();
            if (rows.empty) continue;

            // Ids other records point at — never hide these.
            const protectedIds = new Set<string>();
            const firstGen = user.data()?.firstGenerationContentId;
            if (typeof firstGen === 'string') protectedIds.add(firstGen);
            const shared = await db.collection('library_resources').where('authorId', '==', uid).get();
            for (const r of shared.docs) {
                const src = r.data()?.sourceContentId;
                if (typeof src === 'string') protectedIds.add(src);
            }

            for (const doc of rows.docs) {
                totals.rows++;
                const data = doc.data();
                const { rowClass } = classifyInstantAnswerRow(data);
                if (rowClass === 'saved') { totals.saved++; continue; }
                if (rowClass !== 'auto') {
                    totals.ambiguous++;
                    if (sampleAmbiguousIds.length < 10) sampleAmbiguousIds.push(`${uid}/${doc.id}`);
                    continue;
                }
                if (protectedIds.has(doc.id)) { totals.protectedRefs++; continue; }
                if (data.hiddenFromLibrary === true) { totals.alreadyHidden++; continue; }
                totals.auto++;
                if (sampleAutoIds.length < 10) sampleAutoIds.push(`${uid}/${doc.id}`);
                if (apply) {
                    batch.update(doc.ref, {
                        hiddenFromLibrary: true,
                        libraryMigration: { id: LIBRARY_MIGRATION_ID, reason: 'auto-saved instant answer', at: new Date().toISOString() },
                    });
                    pending++;
                    totals.written++;
                    if (pending >= BATCH_LIMIT) await flush();
                }
            }
            await flush();
        }
        lastUid = users.docs[users.docs.length - 1].id;
    }

    console.log(JSON.stringify({ mode, ...totals, sampleAutoIds, sampleAmbiguousIds }, null, 2));
    if (!apply && !revert) console.error('[library-migration] dry-run only — nothing was written. Re-run with --apply to hide the "auto" rows.');
}

main().catch((err) => {
    console.error('[library-migration] failed:', err);
    process.exit(1);
});
