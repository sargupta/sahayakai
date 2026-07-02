#!/usr/bin/env ts-node
/**
 * Investigate "blank-looking" rows in the original users export.
 * For each doc with NO email/displayName/schoolName/state, look up the
 * Firebase Auth record and tell us what AUTH actually knows about them.
 *
 * Three categories we expect:
 *   PHONE_ONLY    — auth provider is "phone" (no email/name available)
 *   GOOGLE_LEAKED — auth has email + name BUT Firestore doc is blank → BUG
 *   ORPHAN        — auth record was deleted but Firestore doc left over
 *   FIXTURE       — we already flagged this in classify(), shouldn't reach here
 */
import { getDb } from '../src/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

async function main() {
    const db = await getDb();
    const all = await db.collection('users').get();

    let phoneOnly = 0, googleLeaked = 0, orphan = 0, fixture = 0, fine = 0;
    const leakSamples: Array<Record<string, unknown>> = [];
    const phoneSamples: Array<{ uid: string; phone?: string; created: string }> = [];

    for (const doc of all.docs) {
        const d = doc.data() as Record<string, unknown>;
        if (d.isAITeacher === true) continue;
        if (d.isDemoData === true || d.qaTestUser === true) { fixture++; continue; }
        const uid = doc.id;
        const uidLower = uid.toLowerCase();
        if (['qa-', 'canary', 'sim-', 'demo-', 'dev-user', 'probe', 'parity'].some(t => uidLower.includes(t))) {
            fixture++;
            continue;
        }

        const hasEmail = !!d.email;
        const hasName  = !!(d.displayName || d.name);
        if (hasEmail && hasName) { fine++; continue; }

        let authUser;
        try {
            authUser = await getAuth().getUser(uid);
        } catch (e: unknown) {
            const err = e as { code?: string };
            if (err.code === 'auth/user-not-found') {
                orphan++;
                continue;
            }
            throw e;
        }

        const providers = authUser.providerData.map(p => p.providerId);
        const authEmail = authUser.email;
        const authName  = authUser.displayName;
        const authPhone = authUser.phoneNumber;

        if (providers.length === 1 && providers[0] === 'phone' && !authEmail) {
            phoneOnly++;
            if (phoneSamples.length < 5) {
                phoneSamples.push({
                    uid: uid.slice(0, 12) + '...',
                    phone: authPhone ?? undefined,
                    created: authUser.metadata.creationTime,
                });
            }
            continue;
        }

        // Auth has email or name but Firestore doc doesn't — this is the BUG case
        if ((authEmail && !hasEmail) || (authName && !hasName)) {
            googleLeaked++;
            if (leakSamples.length < 10) {
                leakSamples.push({
                    uid: uid.slice(0, 12) + '...',
                    providers,
                    authEmail,
                    authName,
                    firestoreEmail: d.email ?? null,
                    firestoreName: d.displayName ?? null,
                    created: authUser.metadata.creationTime,
                });
            }
            continue;
        }
    }

    console.error('=== Blank-row categorization ===');
    console.error(`PHONE_ONLY (Firebase Auth has no email/name)  : ${phoneOnly}`);
    console.error(`GOOGLE_LEAKED (auth has data, Firestore blank): ${googleLeaked}  ← bug if > 0`);
    console.error(`ORPHAN (auth record deleted)                  : ${orphan}`);
    console.error(`FIXTURE                                       : ${fixture}`);
    console.error(`FINE (already has email + name)               : ${fine}`);
    console.error();
    if (phoneSamples.length) {
        console.error('--- Phone-only samples ---');
        for (const s of phoneSamples) console.error(' ', JSON.stringify(s));
    }
    if (leakSamples.length) {
        console.error('--- GOOGLE_LEAKED samples (the bug) ---');
        for (const s of leakSamples) console.error(' ', JSON.stringify(s));
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
