/**
 * Seed the Sargvision test class (school `sargvision-local`) on Sampark STAGING, the way the local
 * launcher seeds it into the emulator (seed-emulator.ts --sargvision). The class is the team's own
 * consented numbers, never parents.
 *
 *   npx tsx scripts/sampark/seed-sargvision-staging.ts --project sahayakai-b4248 --owner <your uid>          # dry run
 *   npx tsx scripts/sampark/seed-sargvision-staging.ts --project sahayakai-b4248 --owner <your uid> --write  # writes
 *
 * Writes (merge; safe to re-run):
 *   (default)       organizations/sargvision-local  { name, type 'school', isDemoData false, adminUserId <owner> }
 *                   organizations/sargvision-local/members/{uid}  role admin, for every admin of
 *                   sargvision-demo-school (read at run time, so no uid lives in the repository)
 *   sampark-nonprod sampark_schools/sargvision-local  Test mode, 10:00-19:00 IST, Sundays off
 *                   + the roster's students, guardians and preferences (sargvisionRecords)
 *
 * Refuses everything except project sahayakai-b4248 with database sampark-nonprod, refuses the
 * emulator, and refuses if SAMPARK_PII_KEY or SAMPARK_PHONE_PEPPER is already set in the shell:
 * it reads staging's own keys itself from the secrets SAMPARK_STAGING_PII_KEY and
 * SAMPARK_STAGING_PHONE_PEPPER, so production's keys can never encrypt staging data.
 *
 * Roster: scripts/sampark/sargvision-roster.json (or --roster <file>). Each contact rings only if
 * its number is also in the staging service's SAMPARK_RIYA_TEST_ALLOWED_NUMBERS (_TEST_NUMBERS).
 * Credentials: your gcloud application-default login (gcloud auth application-default login).
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

import { FirestoreSamparkRepo } from '@/lib/sampark/repo/firestore';
import { SAMPARK_NONPROD_DATABASE } from '@/lib/sampark/repo/factory';
import { SARGVISION_ORG_ID, SARGVISION_SCHOOL_NAME } from '@/lib/sampark/sargvision';
import type { SamparkSchool } from '@/types/sampark';

import { readRoster, sargvisionRecords } from './sargvision-roster';
import { ADMINS_FROM_ORG, argValue, STAGING_PROJECT, stagingSeedRefusal } from './seed-sargvision-staging-guard';

function out(line: string): void {
    process.stdout.write(`${line}\n`);
}

async function secret(client: SecretManagerServiceClient, name: string): Promise<string> {
    const [version] = await client.accessSecretVersion({ name: `projects/${STAGING_PROJECT}/secrets/${name}/versions/latest` });
    const value = version.payload?.data?.toString();
    if (!value) throw new Error(`secret ${name} is empty`);
    return value;
}

async function main(): Promise<void> {
    const argv = process.argv.slice(2);
    const refusal = stagingSeedRefusal(argv, process.env);
    if (refusal) {
        process.stderr.write(`Refusing to seed staging: ${refusal}\n`);
        process.exit(1);
    }
    const write = argv.includes('--write');
    const owner = argValue(argv, '--owner')!;

    // Staging's own keys, read here so nothing else in the shell can substitute production's.
    const sm = new SecretManagerServiceClient();
    process.env.SAMPARK_PII_KEY = await secret(sm, 'SAMPARK_STAGING_PII_KEY');
    process.env.SAMPARK_PHONE_PEPPER = await secret(sm, 'SAMPARK_STAGING_PHONE_PEPPER');
    // Loaded after the keys are in place.
    const { decryptPhone, encryptPhone, hashPhone } = await import('@/lib/sampark/phone');

    const app = getApps()[0] ?? initializeApp({ projectId: STAGING_PROJECT });
    const db = getFirestore(app);
    const samparkDb = getFirestore(app, SAMPARK_NONPROD_DATABASE);
    const repo = new FirestoreSamparkRepo(samparkDb);

    const adminsSnap = await db.collection('organizations').doc(ADMINS_FROM_ORG).collection('members').where('role', '==', 'admin').get();
    const admins = adminsSnap.docs.map((d) => d.id);
    if (!admins.includes(owner)) {
        process.stderr.write(`Refusing: --owner is not an admin of ${ADMINS_FROM_ORG} (${admins.length} admins there).\n`);
        process.exit(1);
    }

    const roster = readRoster(argValue(argv, '--roster'));
    const nowIso = new Date().toISOString();
    const { students, guardians, preferences } = sargvisionRecords(roster, nowIso, { encrypt: encryptPhone, hash: hashPhone });
    const existing = await repo.getSchool(SARGVISION_ORG_ID);

    out(`${write ? 'Seeding' : 'DRY RUN (add --write to apply)'}: project ${STAGING_PROJECT}, Sampark database ${SAMPARK_NONPROD_DATABASE}`);
    out(`  organizations/${SARGVISION_ORG_ID}: owner …${owner.slice(-4)}, ${admins.length} admin member(s) from ${ADMINS_FROM_ORG}`);
    out(`  sampark_schools/${SARGVISION_ORG_ID}: ${existing ? 'exists, set to' : 'create in'} Test mode, 10:00-19:00 IST, Sundays off`);
    out(`  roster: ${students.length} students, ${guardians.length} guardians, ${preferences.length} preferences`);
    for (const c of roster.contacts) out(`    ${c.id.padEnd(14)} ${c.name.padEnd(10)} …${c.phone.slice(-4)}`);
    if (!write) return;

    const now = FieldValue.serverTimestamp();
    const org = db.collection('organizations').doc(SARGVISION_ORG_ID);
    await org.set(
        { name: SARGVISION_SCHOOL_NAME.replace('local test', 'staging test'), type: 'school', adminUserId: owner, plan: 'premium', totalSeats: 5, usedSeats: 1, isDemoData: false, updatedAt: now },
        { merge: true },
    );
    if (!(await org.get()).get('createdAt')) await org.set({ createdAt: now }, { merge: true });
    for (const uid of admins) {
        await org.collection('members').doc(uid).set({ userId: uid, role: 'admin', joinedAt: now, invitedBy: owner }, { merge: true });
    }

    const base: SamparkSchool = existing ?? {
        orgId: SARGVISION_ORG_ID,
        spokenName: { English: 'Sargvision', Hindi: 'सर्गविज़न', Bengali: 'সর্গভিশন', Nepali: 'सर्गभिजन' },
        displayName: SARGVISION_SCHOOL_NAME.replace('local test', 'staging test'),
        mode: 'test',
        isDemo: false,
        callingWindow: { startHour: 10, endHour: 19, offDays: [0] },
        holidays: [],
        venues: [],
        defaultLanguage: null,
        testPhoneEnc: null,
        testPhoneLast4: null,
        crm: null,
        emergencyBypassConsent: false,
        createdAt: nowIso,
        updatedAt: nowIso,
    };
    await repo.upsertSchool({ ...base, mode: 'test', isDemo: false, callingWindow: { ...base.callingWindow, startHour: 10, endHour: 19 }, updatedAt: nowIso });
    if (!existing) {
        await repo.appendAudit(SARGVISION_ORG_ID, { at: nowIso, actor: owner, action: 'school.enable', target: `school/${SARGVISION_ORG_ID}`, detail: { isDemo: false, via: 'seed-sargvision-staging' } });
    }
    await repo.upsertStudents(SARGVISION_ORG_ID, students);
    await repo.upsertGuardians(SARGVISION_ORG_ID, guardians);
    await repo.upsertPreferences(preferences);

    // Read every contact back: the stored ciphertext must decrypt to its roster number.
    let ok = 0;
    for (const c of roster.contacts) {
        const g = await repo.getGuardian(SARGVISION_ORG_ID, `${c.id}-contact`);
        if (g && decryptPhone(g.phoneEnc) === c.phone && g.phoneHash === hashPhone(c.phone)) ok += 1;
    }
    out(`Done: ${ok}/${roster.contacts.length} contacts read back OK.`);
    if (ok !== roster.contacts.length) process.exitCode = 1;
}

main().catch((err: unknown) => {
    process.stderr.write(`Seed failed: ${err instanceof Error ? err.message : String(err)}
`);
    process.exit(1);
});
