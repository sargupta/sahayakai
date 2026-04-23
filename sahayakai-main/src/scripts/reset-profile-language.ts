/**
 * One-off maintenance: reset the two test-user profiles' `preferredLanguage`
 * back to "English" so stakeholders can verify the i18n fix without carrying
 * over a Hindi value that was auto-detected during earlier onboarding runs.
 *
 * Run:  npx tsx --env-file=.env.local src/scripts/reset-profile-language.ts
 *
 * Keep this script around — same reset may be useful if we add more test
 * accounts in future. It only modifies profiles for the two emails listed.
 */

import { getDb, getAuthInstance } from "@/lib/firebase-admin";

const EMAILS = [
    "sarguptaw@gmail.com",
    "abhi.ist.15@gmail.com",
];

async function main() {
    const db = await getDb();
    const auth = await getAuthInstance();

    for (const email of EMAILS) {
        try {
            const user = await auth.getUserByEmail(email);
            const ref = db.collection("users").doc(user.uid);
            const before = (await ref.get()).data()?.preferredLanguage;
            await ref.set({ preferredLanguage: "English" }, { merge: true });
            console.log(`✓ ${email}  ${user.uid}  ${before ?? "<unset>"} → English`);
        } catch (err: any) {
            console.error(`✗ ${email}: ${err.message ?? err}`);
        }
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
