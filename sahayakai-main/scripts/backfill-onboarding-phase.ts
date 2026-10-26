#!/usr/bin/env ts-node
/**
 * Count, and optionally repair, users/{uid}.onboardingPhase values that the
 * readers don't treat as canonical (2026-10 stuck-new-user bug: the /onboarding
 * wizard wrote 'completed', which isNewUser() never recognised).
 *
 * The app fix already reads legacy values correctly and caps new-user mode at
 * NEW_USER_MODE_MAX_DAYS, so affected teachers are released on deploy without
 * this script. The backfill only makes the stored data match the canonical
 * union so nothing downstream (analytics, exports, future readers) has to
 * know about the legacy aliases.
 *
 * Usage (dry-run is the default and performs NO writes — reads only):
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-onboarding-phase.ts
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-onboarding-phase.ts --release-stale
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-onboarding-phase.ts --apply [--release-stale]
 *
 * Rules (same functions as the app — src/lib/onboarding-phase.ts):
 *  - legacy : a stored legacy alias is rewritten to its canonical phase
 *             ('completed' → 'done', 'language-picked' → 'setup').
 *  - stale  : only with --release-stale. A stored 'first-generation' /
 *             'exploring' / 'completing' on an account older than the
 *             new-user window is rewritten to 'done' (the reader already
 *             releases these; this persists it). 'setup' is never touched.
 *  - unknown: any other non-canonical value is REPORTED, never written.
 *
 * Safety:
 *  - Each write is a single-doc update with a lastUpdateTime precondition, so
 *    a profile the teacher changed after the scan is skipped, not clobbered.
 *  - Every rewritten doc gets `onboardingPhaseBackfill: { from, to, rule, at }`
 *    so the change is auditable and reversible (query on
 *    onboardingPhaseBackfill.from and write it back).
 *  - Idempotent: a second run finds nothing to rewrite.
 */
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../src/lib/firebase-admin';
import {
    NEW_USER_MODE_MAX_DAYS,
    isOnboardingPhase,
    isWithinNewUserWindow,
    normalizeOnboardingPhase,
    type OnboardingPhase,
} from '../src/lib/onboarding-phase';
import { isNewUser } from '../src/lib/profile-utils';

const PAGE_SIZE = 500;
const PAUSE_EVERY = 50;
const PAUSE_MS = 250;
const SAMPLE_LIMIT = 10;
const STALE_RELEASABLE: readonly OnboardingPhase[] = ['first-generation', 'exploring', 'completing'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Rule = 'legacy' | 'stale';
type Planned = { uid: string; from: string; to: OnboardingPhase; rule: Rule; updateTime: Timestamp };

/** The reader as it was on origin/main before the fix (for the impact count). */
function wasNewUserBeforeFix(data: Record<string, unknown>): boolean {
    const stored = data.onboardingPhase;
    const phase = stored ? stored : data.schoolName ? 'done' : 'setup';
    return phase !== 'done';
}

function bump(map: Map<string, number>, key: string) {
    map.set(key, (map.get(key) ?? 0) + 1);
}

async function main() {
    const apply = process.argv.includes('--apply');
    const releaseStale = process.argv.includes('--release-stale');
    const mode = apply ? 'APPLY' : 'DRY-RUN';
    const now = new Date();
    console.error(`[backfill-phase] mode=${mode} releaseStale=${releaseStale} window=${NEW_USER_MODE_MAX_DAYS}d`);

    const db = await getDb();

    let scanned = 0;
    let stuckBefore = 0; // isNewUser() true under the pre-fix reader
    let stuckAfter = 0;  // isNewUser() true under the fixed reader
    const byStoredValue = new Map<string, number>();
    const stuckBeforeByValue = new Map<string, number>();
    const unknownValues = new Map<string, number>();
    const plan: Planned[] = [];

    // Cursor pagination — never load the whole collection into memory.
    let lastDocId: string | null = null;
    for (;;) {
        let query = db
            .collection('users')
            .select('onboardingPhase', 'schoolName', 'createdAt')
            .orderBy('__name__')
            .limit(PAGE_SIZE);
        if (lastDocId) query = query.startAfter(lastDocId);
        const snap = await query.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
            scanned++;
            const data = doc.data() as Record<string, unknown>;
            const stored = data.onboardingPhase;
            const storedKey = stored === undefined ? '(missing)' : JSON.stringify(stored);
            bump(byStoredValue, storedKey);

            if (wasNewUserBeforeFix(data)) {
                stuckBefore++;
                bump(stuckBeforeByValue, storedKey);
            }
            if (isNewUser(data as any, now)) stuckAfter++;

            if (stored === undefined || stored === null) continue;
            if (isOnboardingPhase(stored)) {
                if (
                    releaseStale &&
                    STALE_RELEASABLE.includes(stored) &&
                    !isWithinNewUserWindow(data.createdAt, now)
                ) {
                    plan.push({ uid: doc.id, from: stored, to: 'done', rule: 'stale', updateTime: doc.updateTime });
                }
                continue;
            }
            const target = normalizeOnboardingPhase(stored);
            if (target) {
                plan.push({ uid: doc.id, from: String(stored), to: target, rule: 'legacy', updateTime: doc.updateTime });
            } else {
                bump(unknownValues, storedKey);
            }
        }

        lastDocId = snap.docs[snap.docs.length - 1].id;
        if (snap.size < PAGE_SIZE) break;
    }

    const planByRule = new Map<string, number>();
    for (const p of plan) bump(planByRule, `${p.rule}: ${p.from} → ${p.to}`);

    let written = 0;
    let conflicts = 0;
    let errors = 0;
    if (apply) {
        let sincePause = 0;
        for (const p of plan) {
            try {
                await db.collection('users').doc(p.uid).update(
                    {
                        onboardingPhase: p.to,
                        onboardingPhaseBackfill: { from: p.from, to: p.to, rule: p.rule, at: FieldValue.serverTimestamp() },
                    },
                    { lastUpdateTime: p.updateTime },
                );
                written++;
            } catch (err: any) {
                // FAILED_PRECONDITION (9): the doc changed after the scan — skip it.
                if (err?.code === 9) conflicts++;
                else {
                    errors++;
                    console.error(`[backfill-phase] write error uid=${p.uid}: ${err?.message || err}`);
                }
            }
            if (++sincePause >= PAUSE_EVERY) {
                await sleep(PAUSE_MS);
                sincePause = 0;
            }
        }
    }

    const table = (m: Map<string, number>) =>
        [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `    ${String(v).padStart(6)}  ${k}`).join('\n') || '    (none)';

    console.error('\n=== SUMMARY ===');
    console.error(`mode                         : ${mode}`);
    console.error(`users scanned                : ${scanned}`);
    console.error(`new-user mode BEFORE the fix : ${stuckBefore}`);
    console.error(`new-user mode AFTER the fix  : ${stuckAfter}  (first-week accounts not yet onboarded)`);
    console.error(`\nstored onboardingPhase values:\n${table(byStoredValue)}`);
    console.error(`\nin new-user mode before the fix, by stored value:\n${table(stuckBeforeByValue)}`);
    console.error(`\nunrecognised values (reported, never written):\n${table(unknownValues)}`);
    console.error(`\n${apply ? 'rewrites attempted' : 'would rewrite'}: ${plan.length}\n${table(planByRule)}`);
    if (plan.length) {
        console.error(`\nsample uids:\n${plan.slice(0, SAMPLE_LIMIT).map((p) => `    ${p.uid}  ${p.rule}  ${p.from} → ${p.to}`).join('\n')}`);
    }
    if (apply) {
        console.error(`\nwritten   : ${written}`);
        console.error(`conflicts : ${conflicts}  (changed after scan; re-run to retry)`);
        console.error(`errors    : ${errors}`);
    } else {
        console.error('\n[backfill-phase] DRY-RUN — no writes performed. Re-run with --apply to commit.');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
