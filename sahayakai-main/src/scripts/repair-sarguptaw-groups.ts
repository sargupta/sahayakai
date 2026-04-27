/**
 * One-shot repair for sarguptaw@gmail.com:
 *
 *   1. Restore groupsInitialized=true (the previous reset would have caused
 *      ensureUserGroupsAction to re-init and shrink her 9 groups to 4 under
 *      the new MAX_SUBJECT_GRADE_AUTO_JOINS=1 policy — we don't want that).
 *   2. Add `daily_briefing` to her group memberships so the AI-curated
 *      education news posts surface in her unified feed.
 *
 * Idempotent. Safe to re-run.
 */

const UID = 'nYqFxBohXrSaL3EBF1f3M2xOpLf2';

async function runRepairSarguptaw() {
    const { getDb } = await import('../lib/firebase-admin');
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const userRef = db.collection('users').doc(UID);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        console.error(`No user doc at users/${UID}`);
        process.exit(1);
    }

    const before = userDoc.data() ?? {};
    const beforeIds: string[] = before.groupIds ?? [];
    console.log('Before:');
    console.log(`  groupsInitialized: ${before.groupsInitialized}`);
    console.log(`  groupIds (${beforeIds.length}): ${JSON.stringify(beforeIds)}`);
    console.log();

    // Step 1: ensure groupsInitialized=true so the auto-join short-circuits.
    if (before.groupsInitialized !== true) {
        await userRef.update({ groupsInitialized: true });
        console.log('✓ Restored groupsInitialized=true (skip-re-init)');
    } else {
        console.log('• groupsInitialized=true already');
    }

    // Step 2: ensure daily_briefing membership exists.
    const briefingRef = db.collection('groups').doc('daily_briefing');
    const briefingDoc = await briefingRef.get();
    if (!briefingDoc.exists) {
        console.log('✗ daily_briefing group does not exist — cannot add membership');
        process.exit(1);
    }
    const memberRef = briefingRef.collection('members').doc(UID);
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) {
        await memberRef.set({ joinedAt: new Date().toISOString(), role: 'member' });
        await briefingRef.update({ memberCount: FieldValue.increment(1) });
        console.log('✓ Added membership doc at groups/daily_briefing/members/' + UID);
    } else {
        console.log('• Already a member of daily_briefing');
    }

    // Step 3: ensure 'daily_briefing' is in the user's groupIds array.
    if (!beforeIds.includes('daily_briefing')) {
        await userRef.update({ groupIds: FieldValue.arrayUnion('daily_briefing') });
        console.log('✓ Added "daily_briefing" to user.groupIds');
    } else {
        console.log('• "daily_briefing" already in user.groupIds');
    }

    const after = (await userRef.get()).data() ?? {};
    const afterIds: string[] = after.groupIds ?? [];
    console.log();
    console.log('After:');
    console.log(`  groupsInitialized: ${after.groupsInitialized}`);
    console.log(`  groupIds (${afterIds.length}): ${JSON.stringify(afterIds)}`);
}

runRepairSarguptaw().catch((err) => {
    console.error(err);
    process.exit(1);
});
