#!/usr/bin/env ts-node
/**
 * Export real teachers from the SahayakAI users collection, with the
 * non-real fixtures partitioned into a separate bucket.
 *
 * Filters:
 *   - `isAITeacher === true`              → AI persona, excluded entirely
 *   - `isDemoData === true`               → seeded demo school, → FIXTURE
 *   - `qaTestUser === true`               → QA harness account, → FIXTURE
 *   - `isDevImpersonation === true`       → dev/admin impersonation, → FIXTURE
 *   - email matches *@sahayakai.test / *@sahayak.test → FIXTURE
 *   - uid prefix qa- / canary- / sim- / dev- / demo- → FIXTURE
 *
 * Output: stdout JSON `{ real: Row[], fixtures: Row[] }`.
 */
import { getDb } from '../src/lib/firebase-admin';

interface Row {
    uid: string;
    name: string;
    email: string;
    school: string;
    state: string;
    phone: string;
    planType: string;
    createdAtIso: string | null;
    createdAtMs: number | null;
    lastLoginIso: string | null;
    isAITeacher: boolean;
    bucket: 'real' | 'fixture';
    bucketReason: string;
}

function toMs(v: unknown): number | null {
    if (!v) return null;
    if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
        return (v as { toDate: () => Date }).toDate().getTime();
    }
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'string') {
        const t = Date.parse(v);
        return Number.isNaN(t) ? null : t;
    }
    if (typeof v === 'number') return v;
    return null;
}

// Tokens that, anywhere in the uid, mark the doc as a fixture.
// Substring match (not prefix) because automation seeds uids like
// `avatar-canary-probe-...`, `assess-qa-1780...` where the tag is in
// the middle. The real Firebase Auth uids are random alphanumerics
// like `CcFMkDJiniM94FxUHeFHrux4GaW2` — they never collide with these.
const FIXTURE_UID_TOKENS = [
    'qa-', '-qa-',
    'canary', 'sim-', 'sim_',
    'demo-', '-demo-', 'demo_',
    'dev-user', 'dev_user',
    'probe',
    'test-', '-test-',
    'parity',
    'smoke',
    'fixture',
    'seed-', '-seed-',
];
const FIXTURE_EMAIL_DOMAINS = ['@sahayakai.test', '@sahayak.test', '@example.com', '@test.com'];
const FIXTURE_NAME_TOKENS = ['(impersonation)', 'qa tester', 'qa alpha', 'qa beta', 'demo principal'];

function classify(uid: string, d: Record<string, unknown>): { bucket: 'real'|'fixture'; reason: string } {
    if (d.isDemoData === true)         return { bucket: 'fixture', reason: 'isDemoData=true' };
    if (d.qaTestUser === true)         return { bucket: 'fixture', reason: 'qaTestUser=true' };
    if (d.isDevImpersonation === true) return { bucket: 'fixture', reason: 'isDevImpersonation=true' };
    if (d.qaProvisionedAt)             return { bucket: 'fixture', reason: 'qaProvisionedAt set' };

    const email = ((d.email as string | undefined) ?? '').toLowerCase();
    for (const dom of FIXTURE_EMAIL_DOMAINS) {
        if (email.endsWith(dom)) {
            return { bucket: 'fixture', reason: `email ends with ${dom}` };
        }
    }

    const uidLower = uid.toLowerCase();
    for (const tok of FIXTURE_UID_TOKENS) {
        if (uidLower.includes(tok)) {
            return { bucket: 'fixture', reason: `uid contains "${tok}"` };
        }
    }

    const nameLower = ((d.displayName as string | undefined) ?? (d.name as string | undefined) ?? '').toLowerCase();
    for (const tok of FIXTURE_NAME_TOKENS) {
        if (nameLower.includes(tok)) {
            return { bucket: 'fixture', reason: `name contains "${tok}"` };
        }
    }

    return { bucket: 'real', reason: '' };
}

async function main() {
    const db = await getDb();
    const all = await db.collection('users').get();

    const real: Row[] = [];
    const fixtures: Row[] = [];
    let aiCount = 0;

    for (const doc of all.docs) {
        const d = doc.data() as Record<string, unknown>;
        if (d.isAITeacher === true) { aiCount++; continue; }

        const { bucket, reason } = classify(doc.id, d);
        const createdMs = toMs(d.createdAt);
        const row: Row = {
            uid: doc.id,
            name: (d.displayName as string | undefined) ?? (d.name as string | undefined) ?? '',
            email: (d.email as string | undefined) ?? '',
            school: (d.schoolName as string | undefined) ?? (d.school as string | undefined) ?? '',
            state: (d.state as string | undefined) ?? '',
            phone: (d.phoneNumber as string | undefined) ?? (d.phone as string | undefined) ?? '',
            planType: (d.planType as string | undefined) ?? '',
            createdAtIso: createdMs ? new Date(createdMs).toISOString() : null,
            createdAtMs: createdMs,
            lastLoginIso: toMs(d.lastLogin) ? new Date(toMs(d.lastLogin)!).toISOString() : null,
            isAITeacher: d.isAITeacher === true,
            bucket,
            bucketReason: reason,
        };
        if (bucket === 'real') real.push(row);
        else fixtures.push(row);
    }

    const cmp = (a: Row, b: Row) => ((b.createdAtMs ?? -1) - (a.createdAtMs ?? -1));
    real.sort(cmp);
    fixtures.sort(cmp);

    process.stdout.write(JSON.stringify({
        meta: {
            totalDocs: all.size,
            aiPersonas: aiCount,
            realTeachers: real.length,
            fixtures: fixtures.length,
        },
        real,
        fixtures,
    }));
}

main().catch((e) => { console.error(e); process.exit(1); });
