/**
 * Seed the Firestore EMULATOR with the demo school an org admin needs to try
 * Sampark locally (slice 1 definition of done, item 2).
 *
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx scripts/sampark/seed-emulator.ts
 *
 * Creates (merge — safe to re-run):
 *   organizations/hillview-demo                 { name 'Hillview Demo School', type 'school',
 *                                                 adminUserId 'dev-user-123', plan 'premium',
 *                                                 isDemoData true, … }
 *   organizations/hillview-demo/members/dev-user-123  { userId, role 'admin' }
 *   users/dev-user-123                          minimal complete profile (organizationId hint,
 *                                                 onboarding done) so app pages render
 *
 * `--admin <uid>` (repeatable) also makes that real signed-in account an admin of
 * the demo school, so a developer's own Google sign-in opens the workspace:
 *   …/seed-emulator.ts --admin Yt5XFJyz45TVlY7UKyVRgxUe8Tn1
 * Emulator only, like everything here; it never touches a real project.
 *
 * `dev-user-123` is the uid the middleware assigns to the `dev-token` bearer in
 * development. It does NOT create the Sampark school — enabling Sampark is part
 * of what the demo exercises (POST /api/sampark/hillview-demo/enable).
 *
 * REFUSES to run unless FIRESTORE_EMULATOR_HOST is set: this script must never
 * write to a real project, whatever credentials the shell happens to hold.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { decryptPhone, encryptPhone, hashPhone } from '@/lib/sampark/phone';
import { FirestoreSamparkRepo } from '@/lib/sampark/repo/firestore';

import { riyaDemoFamily } from './riya-demo-family';
import { RIYA_TEST_ORG_ID, RIYA_TEST_ORG_NAME, RIYA_TEST_PHONE, riyaTestStudent } from './riya-test-student';
import { readRoster, sargvisionRecords } from './sargvision-roster';
import { SARGVISION_ORG_ID, SARGVISION_SCHOOL_NAME } from '@/lib/sampark/sargvision';

const ORG_ID = 'hillview-demo';
const ADMIN_UID = 'dev-user-123';

/** Values of every `--admin <uid>` on the command line. */
function extraAdmins(argv: string[]): string[] {
    const uids: string[] = [];
    argv.forEach((arg, i) => {
        if (arg === '--admin' && argv[i + 1] && !argv[i + 1].startsWith('--')) uids.push(argv[i + 1]);
    });
    return uids;
}

function out(line: string): void {
    process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
    const emulator = process.env.FIRESTORE_EMULATOR_HOST?.trim();
    if (!emulator) {
        process.stderr.write('Refusing to seed: FIRESTORE_EMULATOR_HOST is not set. This script only writes to the emulator.\n');
        process.exit(1);
    }
    // Must match the project id the app's Admin SDK uses, or the emulator keeps the data in another namespace.
    // Same rule as src/lib/firebase-admin.ts emulatorAdminOptions(): GCLOUD_PROJECT, else the `demo-` id.
    const projectId = process.env.GCLOUD_PROJECT?.trim() || 'demo-sahayakai';
    const app = getApps()[0] ?? initializeApp({ projectId });
    const db = getFirestore(app);
    // Sampark data lives where the app's repo factory looks: the named database when
    // SAMPARK_FIRESTORE_DATABASE is set (still inside this emulator), else the default one.
    const samparkDatabase = process.env.SAMPARK_FIRESTORE_DATABASE?.trim();
    const samparkDb = samparkDatabase ? getFirestore(app, samparkDatabase) : db;
    const now = FieldValue.serverTimestamp();

    const orgRef = db.collection('organizations').doc(ORG_ID);
    await orgRef.set(
        {
            name: 'Hillview Demo School',
            type: 'school',
            adminUserId: ADMIN_UID,
            plan: 'premium',
            totalSeats: 25,
            usedSeats: 1,
            isDemoData: true,
            createdAt: now,
            updatedAt: now,
        },
        { merge: true },
    );
    await orgRef.collection('members').doc(ADMIN_UID).set(
        { userId: ADMIN_UID, role: 'admin', joinedAt: now, invitedBy: ADMIN_UID },
        { merge: true },
    );
    await db.collection('users').doc(ADMIN_UID).set(
        {
            uid: ADMIN_UID,
            email: 'principal@hillview-demo.test',
            displayName: 'Hillview Principal',
            schoolName: 'Hillview Demo School',
            administrativeRole: 'principal',
            organizationId: ORG_ID,
            badges: [],
            gradeLevels: [],
            subjects: [],
            preferredLanguage: 'English',
            followersCount: 0,
            followingCount: 0,
            impactScore: 0,
            contentSharedCount: 0,
            planType: 'premium',
            onboardingPhase: 'done',
            profileCompletionLevel: 'complete',
            createdAt: now,
            lastLogin: now,
        },
        { merge: true },
    );

    for (const uid of extraAdmins(process.argv)) {
        await orgRef.collection('members').doc(uid).set(
            { userId: uid, role: 'admin', joinedAt: now, invitedBy: ADMIN_UID },
            { merge: true },
        );
        // GET /api/sampark/me lists member-admins through this profile hint
        // (src/server/sampark/auth.ts listAdministeredOrgs); the members doc decides.
        await db.collection('users').doc(uid).set({ uid, organizationId: ORG_ID }, { merge: true });
        out(`  organizations/${ORG_ID}/members/${uid} (role admin, --admin) + users/${uid}.organizationId`);
    }

    out(`Seeded emulator ${emulator} (project ${projectId}):`);
    out(`  organizations/${ORG_ID} (admin ${ADMIN_UID}, isDemoData true)`);
    out(`  organizations/${ORG_ID}/members/${ADMIN_UID} (role admin)`);
    out(`  users/${ADMIN_UID}`);
    const svRecords = process.argv.includes('--sargvision') || process.argv.includes('--arm-sargvision-after-hours');
    if (svRecords || process.argv.includes('--sargvision-org')) {
        // The Sargvision sample class (local test roster). Non-demo organisation: the roster rings each
        // contact's own allow-listed number, only on this emulator (sargvisionRosterMode).
        const svOrg = db.collection('organizations').doc(SARGVISION_ORG_ID);
        await svOrg.set(
            { name: SARGVISION_SCHOOL_NAME, type: 'school', adminUserId: ADMIN_UID, plan: 'premium', totalSeats: 5, usedSeats: 1, isDemoData: false, createdAt: now, updatedAt: now },
            { merge: true },
        );
        await svOrg.collection('members').doc(ADMIN_UID).set({ userId: ADMIN_UID, role: 'admin', joinedAt: now, invitedBy: ADMIN_UID }, { merge: true });
        for (const uid of extraAdmins(process.argv)) {
            await svOrg.collection('members').doc(uid).set({ userId: uid, role: 'admin', joinedAt: now, invitedBy: ADMIN_UID }, { merge: true });
        }
        out(`  organizations/${SARGVISION_ORG_ID} (admin ${ADMIN_UID}, isDemoData false, emulator only)`);
    }
    if (svRecords) {
        const repo = new FirestoreSamparkRepo(samparkDb);
        const school = await repo.getSchool(SARGVISION_ORG_ID);
        if (!school) {
            out(`Sargvision roster NOT seeded: enable Sampark for ${SARGVISION_ORG_ID} first (the launcher does), then re-run with --sargvision.`);
            process.exitCode = 3;
            return;
        }
        const nowIso = new Date().toISOString();
        if (process.argv.includes('--sargvision')) {
            const roster = readRoster();
            const { students, guardians, preferences } = sargvisionRecords(roster, nowIso, { encrypt: encryptPhone, hash: hashPhone });
            const before = new Set((await repo.listStudents(SARGVISION_ORG_ID)).map((s) => s.id));
            await repo.upsertStudents(SARGVISION_ORG_ID, students);
            await repo.upsertGuardians(SARGVISION_ORG_ID, guardians);
            await repo.upsertPreferences(preferences);
            // Test mode on the school's normal hours (10:00–20:00 IST is the most the rules allow).
            await repo.upsertSchool({ ...school, mode: 'test', callingWindow: { ...school.callingWindow, startHour: 10, endHour: 20 }, updatedAt: nowIso });
            // Read every contact back: the stored ciphertext must decrypt to its roster number.
            let ok = 0;
            for (const c of roster.contacts) {
                const g = await repo.getGuardian(SARGVISION_ORG_ID, `${c.id}-contact`);
                const good = Boolean(g && decryptPhone(g.phoneEnc) === c.phone && g.phoneHash === hashPhone(c.phone));
                if (good) ok += 1;
                out(`    ${c.id.padEnd(14)} ${c.name.padEnd(10)} …${c.phone.slice(-4)}  ${before.has(c.id) ? 'reused ' : 'created'}  read back ${good ? 'OK' : 'FAILED'}`);
            }
            out(`  sampark_schools/${SARGVISION_ORG_ID}: ${ok}/${roster.contacts.length} contacts verified; mode test`);
            if (ok !== roster.contacts.length) process.exitCode = 1;
        }
        if (process.argv.includes('--arm-sargvision-after-hours')) {
            const fresh = (await repo.getSchool(SARGVISION_ORG_ID)) ?? school;
            const until = new Date(Date.now() + 120 * 60_000).toISOString();
            await repo.upsertSchool({ ...fresh, localAfterHoursTest: { armedAt: nowIso, until }, updatedAt: nowIso });
            out(`  sampark_schools/${SARGVISION_ORG_ID}: local after-hours test window armed until ${until} (roster contacts only)`);
        }
        return;
    }
    if (process.argv.includes('--arm-after-hours-test')) {
        // Arms the ONE authorised after-hours Riya test on the local test school for 60 minutes
        // (localAfterHoursTestOverride). Emulator only (checked above); the app also ignores it
        // outside the emulator, for any other school, student or number, and after one attempt.
        const repo = new FirestoreSamparkRepo(samparkDb);
        const school = await repo.getSchool(RIYA_TEST_ORG_ID);
        if (!school) {
            out(`After-hours test NOT armed: ${RIYA_TEST_ORG_ID} has no Sampark school yet.`);
            process.exitCode = 3;
            return;
        }
        const armedAt = new Date();
        const until = new Date(armedAt.getTime() + 60 * 60_000);
        await repo.upsertSchool({ ...school, localAfterHoursTest: { armedAt: armedAt.toISOString(), until: until.toISOString() }, updatedAt: armedAt.toISOString() });
        out(`  sampark_schools/${RIYA_TEST_ORG_ID}: after-hours test armed ${armedAt.toISOString()} until ${until.toISOString()} (one attempt)`);
        return;
    }
    if (process.argv.includes('--riya-test-school') || process.argv.includes('--riya-test-student')) {
        // The one non-demo emulator school for the authorised real Riya test call. Not isDemoData:
        // Riya refuses real calls from demo schools. Still emulator-only (checked above).
        const testOrg = db.collection('organizations').doc(RIYA_TEST_ORG_ID);
        await testOrg.set(
            { name: RIYA_TEST_ORG_NAME, type: 'school', adminUserId: ADMIN_UID, plan: 'premium', totalSeats: 5, usedSeats: 1, isDemoData: false, createdAt: now, updatedAt: now },
            { merge: true },
        );
        await testOrg.collection('members').doc(ADMIN_UID).set({ userId: ADMIN_UID, role: 'admin', joinedAt: now, invitedBy: ADMIN_UID }, { merge: true });
        out(`  organizations/${RIYA_TEST_ORG_ID} (admin ${ADMIN_UID}, isDemoData false, emulator only)`);
    }
    if (process.argv.includes('--riya-test-student')) {
        // Student "Alyssa" with the authorised test phone. Needs Sampark enabled for the test school
        // (console) and the SAME SAMPARK_PII_KEY / SAMPARK_PHONE_PEPPER as the app.
        const repo = new FirestoreSamparkRepo(samparkDb);
        if (!(await repo.getSchool(RIYA_TEST_ORG_ID))) {
            out(`Riya test student NOT seeded: enable Sampark for ${RIYA_TEST_ORG_NAME} in the console first, then re-run with --riya-test-student.`);
            process.exitCode = 3;
            return;
        }
        const { student, guardian, preferences } = riyaTestStudent(RIYA_TEST_ORG_ID, new Date().toISOString(), { encrypt: encryptPhone, hash: hashPhone });
        // Reuse, never duplicate: fixed ids, upserted.
        const existed = (await repo.listStudents(RIYA_TEST_ORG_ID)).some((s) => s.id === student.id);
        await repo.upsertStudents(RIYA_TEST_ORG_ID, [student]);
        await repo.upsertGuardians(RIYA_TEST_ORG_ID, [guardian]);
        await repo.upsertPreferences([preferences]);
        // Read back: the stored ciphertext must decrypt to the authorised number.
        const saved = await repo.getGuardian(RIYA_TEST_ORG_ID, guardian.id);
        const ok = saved ? decryptPhone(saved.phoneEnc) === RIYA_TEST_PHONE && saved.phoneHash === hashPhone(RIYA_TEST_PHONE) : false;
        out(`  sampark_schools/${RIYA_TEST_ORG_ID}: student "${student.displayName}" (${student.id}, ${existed ? 'reused' : 'created'}) → contact "${guardian.displayName}" ending ${guardian.phoneLast4}; read back ${ok ? 'OK' : 'FAILED'}`);
        if (!ok) process.exitCode = 1;
        return;
    }
    if (process.argv.includes('--riya-demo-family')) {
        // Opt-in: one synthetic English family with notices + recorded-conversation consent,
        // so the Riya tab has someone to rehearse with in Practice mode. Needs the Sampark
        // school to exist (enable it in the console first) and the SAME SAMPARK_PII_KEY /
        // SAMPARK_PHONE_PEPPER as the app, or the app cannot read the encrypted phone.
        const repo = new FirestoreSamparkRepo(samparkDb);
        if (!(await repo.getSchool(ORG_ID))) {
            out('Riya demo family NOT seeded: enable Sampark for Hillview Demo School in the console first, then re-run with --riya-demo-family.');
            process.exitCode = 3; // distinct code so the launcher can tell "school not enabled yet" from a crash
            return;
        } else {
            const { student, guardian, preferences } = riyaDemoFamily(ORG_ID, new Date().toISOString(), { encrypt: encryptPhone, hash: hashPhone });
            await repo.upsertStudents(ORG_ID, [student]);
            await repo.upsertGuardians(ORG_ID, [guardian]);
            await repo.upsertPreferences([preferences]);
            out(`  sampark_schools/${ORG_ID}: synthetic family "${guardian.displayName}" → "${student.displayName}" (English; notices + recorded-conversation consent)`);
            out(`Next: open /sampark/${ORG_ID}/riya and run a Practice call with this family.`);
            return;
        }
    }
    out('Next: sign in with the dev token, open /sampark, enable Sampark for Hillview Demo School.');
}

main().catch((err) => {
    process.stderr.write(`Seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});
