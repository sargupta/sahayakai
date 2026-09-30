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
 * `dev-user-123` is the uid the middleware assigns to the `dev-token` bearer in
 * development. It does NOT create the Sampark school — enabling Sampark is part
 * of what the demo exercises (POST /api/sampark/hillview-demo/enable).
 *
 * REFUSES to run unless FIRESTORE_EMULATOR_HOST is set: this script must never
 * write to a real project, whatever credentials the shell happens to hold.
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const ORG_ID = 'hillview-demo';
const ADMIN_UID = 'dev-user-123';

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
    const projectId = process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sahayakai-b4248';
    const app = getApps()[0] ?? initializeApp({ projectId });
    const db = getFirestore(app);
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

    out(`Seeded emulator ${emulator} (project ${projectId}):`);
    out(`  organizations/${ORG_ID} (admin ${ADMIN_UID}, isDemoData true)`);
    out(`  organizations/${ORG_ID}/members/${ADMIN_UID} (role admin)`);
    out(`  users/${ADMIN_UID}`);
    out('Next: sign in with the dev token, open /sampark, enable Sampark for Hillview Demo School.');
}

main().catch((err) => {
    process.stderr.write(`Seed failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});
