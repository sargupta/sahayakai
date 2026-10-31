/**
 * Reset ONE teacher account's VIDYA test data. DRY-RUN by default.
 *
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/cleanup-library-test-data.ts --email <sign-in email>  # find the exact uid
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/cleanup-library-test-data.ts --uid <uid>            # report only
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/cleanup-library-test-data.ts --uid <uid> --apply    # do it
 *
 * --apply DELETES that account's VIDYA conversation history
 * (users/{uid}/vidya_sessions) and HIDES (reversibly) its auto-saved chat rows in
 * Generations. Real generated resources and explicitly saved answers are kept.
 * Undo the hiding with scripts/migrate-library-instant-answers.ts --revert.
 * Rules: src/lib/library-test-cleanup.ts. Output prints counts and ids only.
 */
import { getAuthInstance, getDb } from '../src/lib/firebase-admin';
import { applyLibraryTestCleanup, assertSingleUid, planLibraryTestCleanup } from '../src/lib/library-test-cleanup';

const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
    const apply = process.argv.includes('--apply');
    // `--email` resolves the exact account from Firebase Auth (read-only) and
    // only ever reports — apply always needs the explicit --uid it prints.
    const email = arg('--email');
    if (email) {
        if (apply) throw new Error('--apply needs the exact --uid; run with --email first to find it.');
        const user = await (await getAuthInstance()).getUserByEmail(email);
        console.error(`[cleanup] ${email} → uid ${user.uid}. Re-run with --uid ${user.uid} for the plan.`);
        return;
    }
    const uid = arg('--uid');
    assertSingleUid(uid);

    const db = await getDb();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new Error(`No users/${uid} document — check the uid.`);

    const plan = await planLibraryTestCleanup(db, uid);
    console.log(JSON.stringify({
        mode: apply ? 'APPLY' : 'DRY-RUN',
        uid,
        conversations: { delete: plan.sessionIds.length, ofWhichBookmarked: plan.savedSessionIds.length, ids: plan.sessionIds },
        generations: {
            hideAutoSavedChatRows: plan.hideContentIds.length,
            keptInstantAnswers: plan.keptInstantAnswers,
            keptGeneratedResourcesByType: plan.otherContentByType,
            hideIds: plan.hideContentIds,
        },
    }, null, 2));

    if (!apply) {
        console.error('[cleanup] dry-run only — nothing was changed. Re-run with --apply to perform exactly the plan above.');
        return;
    }
    const result = await applyLibraryTestCleanup(db, plan);
    console.error(`[cleanup] done: ${result.sessionsDeleted} conversations deleted, ${result.generationsHidden} auto-saved chat rows hidden.`);
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
