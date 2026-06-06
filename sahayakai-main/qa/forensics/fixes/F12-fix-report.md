# F12 — Cron Job Fix Report

**Branch:** `fix/cron-p0-storage-cleanup` (off `develop`)
**Reference audit:** `qa/forensics/F12-cron-jobs.md`
**Date:** 2026-06-06

## Summary

All six requested fixes implemented and tested. Typecheck clean. 18 new unit tests pass.

| Finding | Severity | Status | File(s) |
|---|---|---|---|
| F12-P0-01 storage-cleanup unauth + arbitrary path delete | P0 | FIXED | `src/app/api/jobs/storage-cleanup/route.ts` |
| F12-P1-02 ai-reactive-reply env-unset bypass | P1 | FIXED (fail-closed) | `src/app/api/jobs/ai-reactive-reply/route.ts` |
| F12-P1-04 export-reminder bypass + non-idempotent | P1 | FIXED | `src/app/api/jobs/export-reminder/route.ts` |
| F12-P1-08 community_chat schema split | P1 | FIXED (+ migration) | `src/app/api/jobs/ai-community-agent/route.ts`, `community-chat-cleanup/route.ts`, `scripts/migrate-community-chat-timestamp-to-createdat.ts` |
| F12-P1-03 edu-news header replay | P1 | FIXED (route deleted → 301) | `src/app/api/jobs/edu-news/route.ts` |
| F12-P2-10 billing-recon unknown plan auto-fix | P2 | FIXED (+ mutex) | `src/lib/billing-reconciliation.ts` |

## Fix 1 — storage-cleanup (P0)

Replaced the unauthenticated handler with defense-in-depth auth + path allowlist:

1. **CRON_SECRET bearer** check at handler top (matches the pattern in
   ai-community-agent, billing-reconciliation, community-chat-cleanup, grow-persona-pool).
2. **Pub/Sub OIDC verification** via `google-auth-library` `OAuth2Client.verifyIdToken`:
   - Audience must match the request URL (`<protocol>//<host><pathname>`).
   - Issuer must be `https://accounts.google.com` or `accounts.google.com`.
   - Optional service-account allowlist via env `PUBSUB_PUSH_SERVICE_ACCOUNTS`
     (comma-separated emails) — if set, only those SAs may invoke.
3. **Path-prefix allowlist** (`validateStoragePath`):
   - Allowed top-level prefixes: `temp/`, `exports/`, plus uid-scoped
     `lessons/`, `images/`, `voice-messages/`, `content-images/`, `visual-aids/`,
     `avatars/`.
   - Uid-scoped prefixes require the path's `<uid>` segment to match the
     `userId` field in the message body (which is set by our own server when
     it enqueues the cleanup, so callers can't forge it).
   - Path traversal (`..` or leading `/`) rejected.
   - Anything else → 403.

**Tests** (`src/__tests__/api/jobs-storage-cleanup.test.ts`, 9 cases):
- unauth POST → 401
- CRON_SECRET + non-allowed prefix → 403 (`prefix_not_allowed`)
- path traversal (`temp/../users/...`) → 403 (`path_traversal`)
- uid-scoped prefix + mismatched userId → 403 (`uid_mismatch`)
- CRON_SECRET + `temp/...` → 200 + delete invoked
- CRON_SECRET + `voice-messages/<uid>/...` with matching userId → 200
- OIDC token verify fails → 401
- OIDC verify ok + non-allowed path → 403
- OIDC verify ok + allowed path → 200

## Fix 2 — ai-reactive-reply (P1)

Polarity flipped to fail-closed:

```ts
const secret = process.env.AI_INTERNAL_SECRET;
if (!secret) return 503;          // ← was: if (secret) {...}, env unset = open
if (provided !== secret) return 401;
```

**Tests** (2 cases): 503 when env unset; 401 when bearer mismatched.

## Fix 3 — export-reminder (P1)

1. Always require CRON_SECRET (dropped `NODE_ENV` exception); returns 503 not
   500 when missing (consistent with the post-`80d55fba8` cron jobs).
2. Added idempotency guard inside the expired-grace loop:
   ```ts
   if (docData?.cancellation?.anonymized === true) continue;
   ```
   The Firestore query already filters by `gracePeriodEnd <= now` and
   `dataExported == false`. Composite `!=` would require a new index, so we
   filter in code after read — same effect, no migration.

**Tests** (3 cases): 503 when secret unset (non-prod), 401 when bearer mismatched,
idempotency: second pass over an `anonymized:true` doc is a no-op.

## Fix 4 — community_chat schema (P1)

Standardised on `createdAt`:

- `ai-community-agent` now writes `createdAt: serverTimestamp()` (was `timestamp:`).
- `ai-community-agent` reads now `orderBy('createdAt')` (two query sites updated).
- `community-chat-cleanup` now uses `where('createdAt', '<', cutoffDate)`
  (Date object, not ISO string — matches the Timestamp comparison Firestore
  expects).
- **Backfill script:** `scripts/migrate-community-chat-timestamp-to-createdat.ts`
  copies `timestamp` → `createdAt` on legacy docs. Idempotent (skips if
  `createdAt` already set). Dry-run by default; `--commit` to write.

Effect: `ai-reactive-reply` cooldown (which already orderBy('createdAt')) now sees
cron-agent posts and respects the 10-min window between AI replies.

**Tests** (`jobs-ai-community-agent-schema.test.ts`, 2 source-level assertions):
- The add() block writes `createdAt`, not `timestamp`.
- No remaining `orderBy('timestamp')` on community_chat.

## Fix 5 — edu-news (P1)

Route reduced to a single 301 permanent redirect to `/api/jobs/daily-briefing`.
The previous `fetch(baseUrl, { headers: Object.fromEntries(request.headers) })`
header-replay is gone — no fetch in live code.

**Tests** (2 cases): status 301; source contains no `fetch(` outside comments.

## Fix 6 — billing-reconciliation (P2)

1. `PLAN_NAME_MAP[rzpSub.plan_id] || 'gold'` removed. On miss, push a new
   `unknown_plan_id` mismatch (action: `flagged`) with a structured detail
   payload so the dashboard can alert ops to add the env var. No auto-coerce
   to `gold` ever again.
2. Added `MismatchType = 'unknown_plan_id'` to the union.
3. **Mutex via Firestore lease** in `runReconciliation`:
   - Lease doc at `system_locks/billing_reconciliation`.
   - 15-minute TTL (long enough for a normal run, short enough that a crashed
     run unblocks the next scheduled tick).
   - `acquireLease` is a Firestore transaction — atomic.
   - If a concurrent run holds the lease, the new run returns an empty result
     with `errors: ['lease_held_by_another_run']` and skips the entire
     reconciliation body. Prevents the manual-curl-during-cron race.
   - `releaseLease` runs at the end (and any future `finally` extension);
     stale leases auto-expire after 15 min.

## Files changed

- `src/app/api/jobs/storage-cleanup/route.ts` (rewrite — auth + allowlist)
- `src/app/api/jobs/ai-reactive-reply/route.ts` (auth fail-closed)
- `src/app/api/jobs/export-reminder/route.ts` (auth + idempotency)
- `src/app/api/jobs/ai-community-agent/route.ts` (schema standardisation)
- `src/app/api/jobs/community-chat-cleanup/route.ts` (read by createdAt)
- `src/app/api/jobs/edu-news/route.ts` (301 redirect, no header replay)
- `src/lib/billing-reconciliation.ts` (flag unknown plan + mutex lease)

**New files:**
- `scripts/migrate-community-chat-timestamp-to-createdat.ts` (backfill)
- `src/__tests__/api/jobs-storage-cleanup.test.ts` (9 tests)
- `src/__tests__/api/jobs-ai-reactive-reply.test.ts` (2 tests)
- `src/__tests__/api/jobs-export-reminder.test.ts` (3 tests)
- `src/__tests__/api/jobs-ai-community-agent-schema.test.ts` (2 tests)
- `src/__tests__/api/jobs-edu-news.test.ts` (2 tests)

## Verification

- `npx tsc --noEmit` → clean.
- `npx jest src/__tests__/api/jobs-*.test.ts --no-coverage` → 18/18 pass.

## Deployment notes

1. **Deploy this PR**, then run the backfill once in prod:
   ```bash
   npx tsx scripts/migrate-community-chat-timestamp-to-createdat.ts          # dry-run
   npx tsx scripts/migrate-community-chat-timestamp-to-createdat.ts --commit
   ```
2. **Cloud Scheduler** — migrate any job pointed at `/api/jobs/edu-news` to
   `/api/jobs/daily-briefing` directly (the 301 keeps existing jobs working
   in the interim).
3. **Pub/Sub push subscription** for storage-cleanup — confirm the push
   subscription was created with `--push-auth-service-account` and
   `--push-auth-token-audience` matching the production URL. The audit
   docstring claimed Cloud Run validated OIDC; that was wrong (the service
   is `--allow-unauthenticated`). The new in-handler verification is the
   actual enforcement.
4. **Env** — optionally set `PUBSUB_PUSH_SERVICE_ACCOUNTS=<sa-email>` to lock
   storage-cleanup to a specific service account.
