#!/usr/bin/env ts-node
/**
 * Full forensic audit of every doc in the `users` collection.
 *
 * For each doc:
 *  - Pull Firebase Auth record (if any) and capture providers, email, phone, name
 *  - Classify into one of:
 *       AI_PERSONA            isAITeacher = true
 *       FIXTURE_CANARY        uid contains canary/probe
 *       FIXTURE_QA            uid contains qa-/parity/test/smoke
 *       FIXTURE_DEMO          isDemoData=true OR demo-* OR demo seeded school
 *       FIXTURE_DEV           isDevImpersonation=true OR dev-user
 *       FIXTURE_TEST_EMAIL    email ends @sahayakai.test / @sahayak.test
 *       REAL                  none of the above
 *  - Compute auth/firestore consistency:
 *       AUTH_MISSING          no Firebase Auth user for this uid
 *       AUTH_HAS_BUT_FS_BLANK auth has email/name, Firestore lacks them
 *       PHONE_ONLY_AUTH       only "phone" provider in auth
 *       OK                    nothing suspicious
 *  - Profile completeness (real teachers only):
 *       weights as in computeProfileCompletion()
 *
 * Output: JSON to stdout with a `rows` array.
 */
import { getDb } from '../src/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

type Bucket =
    | 'AI_PERSONA'
    | 'FIXTURE_CANARY'
    | 'FIXTURE_QA'
    | 'FIXTURE_DEMO'
    | 'FIXTURE_DEV'
    | 'FIXTURE_TEST_EMAIL'
    | 'REAL';

type AuthHealth =
    | 'AUTH_MISSING'
    | 'AUTH_HAS_BUT_FS_BLANK'
    | 'PHONE_ONLY_AUTH'
    | 'OK';

interface Row {
    uid: string;
    bucket: Bucket;
    bucketReason: string;
    authHealth: AuthHealth;
    fsName: string;
    fsEmail: string;
    fsPhone: string;
    fsSchool: string;
    fsState: string;
    fsPlan: string;
    fsCreatedAtIso: string | null;
    fsLastLoginIso: string | null;
    authEmail: string | null;
    authName: string | null;
    authPhone: string | null;
    authProviders: string[];
    authCreatedAt: string | null;
    authLastSignIn: string | null;
    profileScore: number; // 0-100, only meaningful for REAL bucket
}

function toMs(v: unknown): number | null {
    if (!v) return null;
    if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate().getTime();
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
    if (typeof v === 'number') return v;
    return null;
}
function toIso(v: unknown): string | null { const ms = toMs(v); return ms ? new Date(ms).toISOString() : null; }

function classify(uid: string, d: Record<string, unknown>): { bucket: Bucket; reason: string } {
    if (d.isAITeacher === true) return { bucket: 'AI_PERSONA', reason: 'isAITeacher=true' };
    if (d.isDevImpersonation === true) return { bucket: 'FIXTURE_DEV', reason: 'isDevImpersonation=true' };
    if (d.isDemoData === true)        return { bucket: 'FIXTURE_DEMO', reason: 'isDemoData=true' };
    if (d.qaTestUser === true)        return { bucket: 'FIXTURE_QA', reason: 'qaTestUser=true' };
    if (d.qaProvisionedAt)            return { bucket: 'FIXTURE_QA', reason: 'qaProvisionedAt set' };

    const email = ((d.email as string | undefined) ?? '').toLowerCase();
    for (const dom of ['@sahayakai.test', '@sahayak.test', '@example.com', '@test.com']) {
        if (email.endsWith(dom)) return { bucket: 'FIXTURE_TEST_EMAIL', reason: `email ends with ${dom}` };
    }

    const uidLower = uid.toLowerCase();
    if (uidLower.includes('canary') || uidLower.includes('probe') || uidLower.includes('smoke'))
        return { bucket: 'FIXTURE_CANARY', reason: 'uid contains canary/probe/smoke' };
    if (uidLower.startsWith('qa-') || uidLower.includes('-qa-') || uidLower.includes('parity') || uidLower.includes('fixture'))
        return { bucket: 'FIXTURE_QA', reason: 'uid contains qa-/parity/fixture' };
    if (uidLower.startsWith('demo-') || uidLower.includes('-demo-'))
        return { bucket: 'FIXTURE_DEMO', reason: 'uid contains demo-' };
    if (uidLower.startsWith('dev-') || uidLower.includes('dev-user'))
        return { bucket: 'FIXTURE_DEV', reason: 'uid starts/contains dev-' };
    if (uidLower.startsWith('sim-'))
        return { bucket: 'FIXTURE_QA', reason: 'uid starts with sim-' };
    if (uidLower.startsWith('seed-') || uidLower.includes('-seed-'))
        return { bucket: 'FIXTURE_DEMO', reason: 'uid starts/contains seed-' };
    if (uidLower.startsWith('test-') || uidLower.includes('-test-'))
        return { bucket: 'FIXTURE_QA', reason: 'uid contains test-' };

    const nameLower = ((d.displayName as string | undefined) ?? '').toLowerCase();
    if (nameLower.includes('(impersonation)') || nameLower.startsWith('qa ') || nameLower.startsWith('demo '))
        return { bucket: 'FIXTURE_DEMO', reason: `name "${(d.displayName as string)}"` };

    return { bucket: 'REAL', reason: '' };
}

function computeScore(d: Record<string, unknown>): number {
    const weights: Array<[string, number]> = [
        ['displayName', 10], ['state', 15], ['schoolName', 15],
        ['subjects', 15], ['gradeLevels', 15], ['preferredLanguage', 10],
        ['educationBoard', 5], ['phoneNumber', 10], ['photoURL', 5],
    ];
    let score = 0;
    const has = (k: string) => {
        const v = d[k];
        if (v === undefined || v === null) return false;
        if (typeof v === 'string') return v.trim().length > 0;
        if (Array.isArray(v)) return v.length > 0;
        return true;
    };
    for (const [k, w] of weights) {
        if (k === 'phoneNumber') {
            if (has('phoneNumber') || has('phone')) score += w;
        } else if (k === 'photoURL') {
            if (has('photoURL') || has('avatarUrl') || has('customAvatarUrl')) score += w;
        } else if (has(k)) score += w;
    }
    return score;
}

async function main() {
    const db = await getDb();
    const all = await db.collection('users').get();

    const rows: Row[] = [];

    for (const doc of all.docs) {
        const d = doc.data() as Record<string, unknown>;
        const uid = doc.id;
        const { bucket, reason } = classify(uid, d);

        // Look up auth
        let authEmail: string | null = null;
        let authName: string | null = null;
        let authPhone: string | null = null;
        let providers: string[] = [];
        let authCreatedAt: string | null = null;
        let authLastSignIn: string | null = null;
        let authHealth: AuthHealth = 'OK';

        try {
            const u = await getAuth().getUser(uid);
            authEmail = u.email ?? null;
            authName  = u.displayName ?? null;
            authPhone = u.phoneNumber ?? null;
            providers = u.providerData.map(p => p.providerId);
            authCreatedAt = u.metadata.creationTime ?? null;
            authLastSignIn = u.metadata.lastSignInTime ?? null;

            if (providers.length === 1 && providers[0] === 'phone' && !authEmail) {
                authHealth = 'PHONE_ONLY_AUTH';
            } else {
                const fsHasEmail = !!d.email;
                const fsHasName  = !!(d.displayName || d.name);
                if ((authEmail && !fsHasEmail) || (authName && !fsHasName)) {
                    authHealth = 'AUTH_HAS_BUT_FS_BLANK';
                }
            }
        } catch (e: unknown) {
            const err = e as { code?: string };
            if (err.code === 'auth/user-not-found') {
                authHealth = 'AUTH_MISSING';
            } else throw e;
        }

        rows.push({
            uid,
            bucket,
            bucketReason: reason,
            authHealth,
            fsName:  ((d.displayName as string | undefined) ?? (d.name as string | undefined) ?? ''),
            fsEmail: ((d.email as string | undefined) ?? ''),
            fsPhone: ((d.phoneNumber as string | undefined) ?? (d.phone as string | undefined) ?? ''),
            fsSchool: ((d.schoolName as string | undefined) ?? (d.school as string | undefined) ?? ''),
            fsState:  ((d.state as string | undefined) ?? ''),
            fsPlan:   ((d.planType as string | undefined) ?? ''),
            fsCreatedAtIso: toIso(d.createdAt),
            fsLastLoginIso: toIso(d.lastLogin),
            authEmail, authName, authPhone,
            authProviders: providers,
            authCreatedAt, authLastSignIn,
            profileScore: bucket === 'REAL' ? computeScore(d) : 0,
        });
    }

    // Sort: REAL first by createdAt desc, then fixtures, then AI
    const order: Record<Bucket, number> = {
        REAL: 0, FIXTURE_QA: 1, FIXTURE_CANARY: 2, FIXTURE_DEMO: 3, FIXTURE_DEV: 4, FIXTURE_TEST_EMAIL: 5, AI_PERSONA: 6,
    };
    rows.sort((a, b) => {
        if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
        const am = a.fsCreatedAtIso ? Date.parse(a.fsCreatedAtIso) : -1;
        const bm = b.fsCreatedAtIso ? Date.parse(b.fsCreatedAtIso) : -1;
        return bm - am;
    });

    process.stdout.write(JSON.stringify({ total: all.size, rows }));
}

main().catch((e) => { console.error(e); process.exit(1); });
