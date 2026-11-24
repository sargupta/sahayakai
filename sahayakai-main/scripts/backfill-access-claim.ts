#!/usr/bin/env ts-node
/**
 * Backfill the access-gate state onto every EXISTING account, so that turning
 * the gate to `enforce` does not send a single current teacher to the
 * "request access" page. Design: docs/ACCESS_GATE_DESIGN.md. Rollout order:
 * docs/ACCESS_GATE_RUNBOOK.md (this is step 2; never enforce before it).
 *
 * Usage:
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-access-claim.ts --cutoff=2026-12-01T00:00:00+05:30            # dry-run (default)
 *   GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-access-claim.ts --cutoff=2026-12-01T00:00:00+05:30 --apply    # write
 *
 * --cutoff MUST be the same instant you set as ACCESS_LEGACY_CUTOFF on the
 * Cloud Run service. Accounts created before it become `legacy`.
 *
 * Rules:
 *  - Walks Firebase AUTH (not Firestore): Auth is the authority on who has an
 *    account and when it was created, and it includes accounts that never
 *    completed a profile.
 *  - Never downgrades or overrides: an account whose users/{uid}.accessState
 *    is already set (pilot, active, blocked, pending, legacy) is left alone,
 *    apart from repairing a claim that disagrees with the stored state.
 *  - Merge-sets claims: reads existing customClaims and spreads them. NEVER
 *    clobbers planType / orgId / orgRole / onboardingCompleted.
 *  - Does not create users/{uid} documents: the Firestore field is written
 *    only where the document already exists. An account with no document
 *    still resolves to `legacy` at runtime from its Auth creation time.
 *  - Idempotent: re-running reports zero writes.
 *  - Accounts created at or after the cutoff are not touched; they resolve to
 *    `pending` on first sign-in.
 */
import { getDb, getAuthInstance } from '../src/lib/firebase-admin';

const PAGE_SIZE = 1000;      // Auth listUsers maximum
const PAUSE_EVERY = 50;      // brief pause every N Auth writes to respect rate limits
const PAUSE_MS = 250;
const VALID_STATES = ['legacy', 'pending', 'pilot', 'active', 'blocked'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseCutoff(): Date {
  const arg = process.argv.find((a) => a.startsWith('--cutoff='));
  if (!arg) {
    console.error('[backfill-access] --cutoff=<ISO-8601 instant> is required');
    process.exit(2);
  }
  const d = new Date(arg.slice('--cutoff='.length));
  if (Number.isNaN(d.getTime())) {
    console.error('[backfill-access] --cutoff is not a valid date');
    process.exit(2);
  }
  return d;
}

function toEpochSeconds(value: unknown): number | null {
  if (!value) return null;
  const d =
    value instanceof Date
      ? value
      : typeof (value as { toDate?: unknown }).toDate === 'function'
        ? (value as { toDate: () => Date }).toDate()
        : new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const cutoff = parseCutoff();
  console.error(`[backfill-access] mode=${apply ? 'APPLY' : 'DRY-RUN'} cutoff=${cutoff.toISOString()}`);

  const db = await getDb();
  const auth = await getAuthInstance();

  let scanned = 0;
  let afterCutoff = 0;        // created at/after cutoff: untouched
  let alreadyCorrect = 0;     // claim already matches the wanted state
  let stampedLegacy = 0;      // newly marked legacy
  let claimRepaired = 0;      // stored state kept, claim brought in line
  let firestoreWritten = 0;
  let errors = 0;
  let writesSincePause = 0;

  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(PAGE_SIZE, pageToken);
    for (const user of page.users) {
      scanned++;
      try {
        const snap = await db.collection('users').doc(user.uid).get();
        const data = snap.exists ? (snap.data() as Record<string, unknown>) : undefined;
        const stored = typeof data?.accessState === 'string' && VALID_STATES.includes(data.accessState)
          ? (data.accessState as string)
          : null;

        const created = new Date(user.metadata.creationTime);
        const isLegacy = !Number.isNaN(created.getTime()) && created.getTime() < cutoff.getTime();

        if (!stored && !isLegacy) {
          afterCutoff++;
          continue;
        }

        const wantedState = stored ?? 'legacy';
        const wantedExp = stored ? toEpochSeconds(data?.accessExpiresAt) : null;

        const claims = (user.customClaims ?? {}) as Record<string, unknown>;
        const claimOk = claims.access === wantedState && (claims.accessExp ?? null) === wantedExp;

        const needsFirestore = !stored && snap.exists;
        if (claimOk && !needsFirestore) {
          alreadyCorrect++;
          continue;
        }

        if (apply) {
          if (needsFirestore) {
            await db.collection('users').doc(user.uid).set(
              {
                accessState: 'legacy',
                accessExpiresAt: null,
                accessUpdatedAt: new Date(),
                accessUpdatedBy: 'system:backfill',
              },
              { merge: true },
            );
          }
          if (!claimOk) {
            const next: Record<string, unknown> = { ...claims, access: wantedState };
            if (wantedExp === null) delete next.accessExp;
            else next.accessExp = wantedExp;
            await auth.setCustomUserClaims(user.uid, next);
            if (++writesSincePause >= PAUSE_EVERY) {
              writesSincePause = 0;
              await sleep(PAUSE_MS);
            }
          }
        }
        if (needsFirestore) firestoreWritten++;
        if (stored) claimRepaired++;
        else stampedLegacy++;
      } catch (err) {
        errors++;
        console.error(`[backfill-access] ${user.uid}: ${(err as Error).message}`);
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  const summary = {
    mode: apply ? 'APPLY' : 'DRY-RUN',
    cutoff: cutoff.toISOString(),
    scanned,
    stampedLegacy,
    claimRepaired,
    firestoreWritten,
    alreadyCorrect,
    afterCutoffUntouched: afterCutoff,
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (errors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[backfill-access] fatal:', err);
  process.exit(1);
});
