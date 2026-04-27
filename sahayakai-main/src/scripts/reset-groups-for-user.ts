/**
 * One-shot: reset a user's `groupsInitialized` flag so that the next call
 * to `ensureUserGroupsAction()` re-runs the auto-join pipeline. Useful
 * after a code change to the auto-join logic that should retroactively
 * apply to existing users.
 *
 * Why we need this: ensureUserGroupsAction() short-circuits on
 * `groupsInitialized === true` (line 58 in src/app/actions/groups.ts).
 * Without resetting, existing users never pick up changes to the
 * default group set.
 *
 * Usage:
 *   npx tsx src/scripts/reset-groups-for-user.ts [uid|email]
 *
 * Default target: sarguptaw@gmail.com (UID nYqFxBohXrSaL3EBF1f3M2xOpLf2).
 */

const DEFAULT_TARGET = 'nYqFxBohXrSaL3EBF1f3M2xOpLf2';

async function runResetGroupsForUser() {
    const target = process.argv[2] ?? DEFAULT_TARGET;
    const { getDb } = await import('../lib/firebase-admin');
    const db = await getDb();

    // If target looks like an email, look up the uid via the users collection.
    let uid = target;
    if (target.includes('@')) {
        const snap = await db.collection('users').where('email', '==', target).limit(1).get();
        if (snap.empty) {
            console.error(`No user found with email ${target}`);
            process.exit(1);
        }
        uid = snap.docs[0].id;
        console.log(`Resolved ${target} → ${uid}`);
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        console.error(`No user doc at users/${uid}`);
        process.exit(1);
    }

    const before = userDoc.data() ?? {};
    console.log(`Before reset:`);
    console.log(`  groupsInitialized: ${before.groupsInitialized}`);
    console.log(`  groupIds (${(before.groupIds ?? []).length}): ${JSON.stringify(before.groupIds ?? [])}`);

    await userRef.update({ groupsInitialized: false });

    console.log(`\n✓ Reset groupsInitialized=false on users/${uid}`);
    console.log(`  Next time the user visits /community, ensureUserGroupsAction will`);
    console.log(`  re-run and join them into the current default group set:`);
    console.log(`    - first subject×grade combo`);
    console.log(`    - daily_briefing`);
    console.log(`    - community_general`);
    console.log(`    - state_${before.state ?? '<state>'} (if state set)`);
}

runResetGroupsForUser().catch((err) => {
    console.error(err);
    process.exit(1);
});
