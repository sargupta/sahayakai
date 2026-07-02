# F12 — Cron + Background Jobs Forensic Audit

**Investigator:** Role 20 (cron/background jobs)
**Date:** 2026-06-06
**Scope:** `src/app/api/jobs/*` (9 routes)
**Anchor commit:** `80d55fba8` (yesterday's security fix that closed 9 unauth holes — including 4 cron routes)

## 1. Inventory

| Job | File | Auth | Notes |
|---|---|---|---|
| daily-briefing | `src/app/api/jobs/daily-briefing/route.ts` | CRON_SECRET bearer (top of POST, L656-664) | 3x `ai.generate` all pinned to `googleai/gemini-2.5-flash` (L432, L540, L618) |
| edu-news | `src/app/api/jobs/edu-news/route.ts` | **NONE — deprecated forwarder** | Forwards to daily-briefing inheriting client headers |
| ai-community-agent | `src/app/api/jobs/ai-community-agent/route.ts` | CRON_SECRET bearer (L401-408) | gemini-2.5-flash pinned |
| ai-reactive-reply | `src/app/api/jobs/ai-reactive-reply/route.ts` | **`AI_INTERNAL_SECRET` (open if env unset)** | gemini-2.5-flash pinned |
| billing-reconciliation | `src/app/api/jobs/billing-reconciliation/route.ts` | CRON_SECRET bearer (L26-34, L113-121 on GET) | Both POST + GET gated |
| community-chat-cleanup | `src/app/api/jobs/community-chat-cleanup/route.ts` | CRON_SECRET bearer (L28-35) | 90-day retention |
| grow-persona-pool | `src/app/api/jobs/grow-persona-pool/route.ts` | CRON_SECRET bearer (L176-184) | gemini-2.5-flash pinned; `MAX_PER_RUN=15` |
| storage-cleanup | `src/app/api/jobs/storage-cleanup/route.ts` | **NONE in route handler** — relies on Cloud Run OIDC at infra layer | P0 risk if public |
| export-reminder | `src/app/api/jobs/export-reminder/route.ts` | Bypass in non-prod (L23-28) | Anonymises users |

## 2. Findings

### F12-P0-01 — `storage-cleanup` has zero in-route auth → can delete any GCS object if route is publicly reachable
**Severity:** P0 (data loss)
**File:** `src/app/api/jobs/storage-cleanup/route.ts`
**Lines:** L30-77

The handler reads `body.storagePath` (or base64-encoded Pub/Sub `message.data`) and calls
`storage.bucket().file(storagePath).delete()` **without verifying the caller**. It does not:
- Check `CRON_SECRET`
- Verify Pub/Sub OIDC bearer token (`Authorization: Bearer <token>` from Cloud Pub/Sub)
- Validate the `storagePath` against any allowlist (e.g. only `lessons/{userId}/...`, `images/{userId}/...`)

The route docstring states "Cloud Run validates [OIDC] automatically." This is **false** for Next.js routes on Cloud Run: Cloud Run only auto-validates OIDC if the service is deployed with `--no-allow-unauthenticated`. Production `sahayakai-hotfix-resilience` is reachable unauth (the whole Next.js app is public for the website + API routes). The Pub/Sub OIDC header simply rides along but nothing verifies it.

**Impact (P0):** any attacker who can POST to the public URL can supply `{ "storagePath": "users/<victimUid>/avatar.jpg" }` and the route will delete it. Walking known paths (`lessons/{uid}/...`, `images/{uid}/...`, `voice-messages/{uid}/...`) is trivial because storage paths are predictable. No false-positive flag — the handler obeys whatever path the body specifies.

**Why the security fix `80d55fba8` missed this:** the audit added CRON_SECRET checks to four other jobs but skipped this one, presumably because the docstring asserted Cloud Run was validating OIDC.

**Repro (against production):**
```bash
curl -s -X POST 'https://sahayakai-hotfix-resilience-<hash>-as.a.run.app/api/jobs/storage-cleanup' \
  -H 'Content-Type: application/json' \
  -d '{"storagePath":"some/known/path.jpg","userId":"anonymous","contentId":"poc"}'
# Expected (current): 200 {"ok":true} and the file is deleted from GCS
# Expected (after fix): 401 Unauthorized
```

**Fix:** verify the Pub/Sub OIDC token explicitly (`google-auth-library` `OAuth2Client.verifyIdToken`) **and** add `CRON_SECRET` bearer fallback for manual Cloud Scheduler invocation. Plus validate `storagePath` matches a known prefix (e.g. starts with `lessons/`, `images/`, `voice-messages/`, `exports/`) before delete.

---

### F12-P1-02 — `ai-reactive-reply` is open if `AI_INTERNAL_SECRET` env is unset
**Severity:** P1 (auth bypass enabling spam at AI quota cost)
**File:** `src/app/api/jobs/ai-reactive-reply/route.ts`
**Lines:** L44-50

```ts
const secret = process.env.AI_INTERNAL_SECRET;
if (secret) {                                  // ← only enforced when set
    const provided = req.headers.get('x-internal-secret');
    if (provided !== secret) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
}
```

If `AI_INTERNAL_SECRET` is missing (which it can be on a fresh Cloud Run revision), the route is fully open. Compare to the other jobs which return **503** when the secret env is unset (defensive default). An attacker can POST `{ collectionPath: 'community_chat', messageText: 'x', authorName: 'real-teacher' }` repeatedly:
- 30% chance per call posts an AI message into community_chat
- Bypasses the cooldown by varying the targeted message
- Spends Gemini quota at the attacker's pace (no rate limit on the route)
- Posts spam attributed to real-feeling AI persona names

**Repro:**
```bash
# Confirm env-unset bypass (POST without header)
for i in $(seq 1 50); do
  curl -s -X POST 'https://<host>/api/jobs/ai-reactive-reply' \
    -H 'Content-Type: application/json' \
    -d '{"collectionPath":"community_chat","messageText":"hello","authorName":"Real Teacher"}' &
done; wait
# If AI_INTERNAL_SECRET is unset → ~30% of these post into community_chat
```

**Fix:** require the secret unconditionally; return 503 (or 401) if unset, matching the other jobs.

---

### F12-P1-03 — `edu-news` forwarder strips `host`/replays caller headers; can be abused to amplify CRON_SECRET attempts
**Severity:** P1 (auth-rate-limit bypass surface)
**File:** `src/app/api/jobs/edu-news/route.ts`
**Lines:** L21-25

```ts
const baseUrl = request.url.replace('/api/jobs/edu-news', '/api/jobs/daily-briefing');
const forwardRes = await fetch(baseUrl, {
    method: 'POST',
    headers: Object.fromEntries(request.headers),   // ← replays Authorization header
});
```

Forwarding `Object.fromEntries(request.headers)` replays the caller's `Authorization: Bearer …` header to the daily-briefing endpoint. If `daily-briefing` ever gains per-IP rate limiting or audit logging, the attacker can launder requests through `/api/jobs/edu-news`, masking source. Also forwards `host`, `content-length`, etc., which can break the inner fetch under some hosting configs. The deprecation banner has been in place for months — recommend deleting the route and updating Cloud Scheduler.

**Lesser concern:** if `daily-briefing` ever changes to look at the `host` header for the dedup config doc, this proxy could read/write the wrong tenant.

**Fix:** delete the route; migrate any remaining Cloud Scheduler job that hits `edu-news` to `daily-briefing` directly. If keeping it, only forward `authorization`.

---

### F12-P1-04 — `export-reminder` bypasses auth in non-prod and can be triggered repeatedly to mass-anonymise users
**Severity:** P1 (in non-prod / staging) / P0-conditional (if prod ever runs without `CRON_SECRET`)
**File:** `src/app/api/jobs/export-reminder/route.ts`
**Lines:** L21-28

```ts
const authHeader = request.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
}
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Logic gaps:
1. In **non-production** when `CRON_SECRET` is unset, the route is open. Anyone hitting staging can trigger anonymisation (`displayName='Former Teacher'`, email rewritten) on every user whose `cancellation.gracePeriodEnd <= now`. **Once anonymised, displayName/email cannot be restored** (no audit row, no preserved-original-email field).
2. In production with `CRON_SECRET` unset, returns **500** instead of **503** (inconsistent with the other jobs the security fix touched). Misleads monitoring as a code error rather than config error.
3. **Non-idempotent**: the route loops `expiredSnap` and updates `cancellation.anonymized=true` but does **not** add a `where('cancellation.anonymized','!=',true)` (or `==false`) filter to skip already-anonymised users. Every cron tick re-runs `db.collection('users').doc(id).update({...})` for every expired user (cheap but emits redundant audit log writes and rewrites displayName each run; a one-shot guard is documented in the playbook but absent in code).

**Repro (idempotency):**
```bash
# Hit twice, observe `cancellation.anonymizedAt` advances on the second call
curl -X POST 'https://<host>/api/jobs/export-reminder' -H "Authorization: Bearer $CRON_SECRET"
curl -X POST 'https://<host>/api/jobs/export-reminder' -H "Authorization: Bearer $CRON_SECRET"
# anonymizedAt should NOT change on second call; currently it does
```

**Fix:**
- Add `.where('cancellation.anonymized','==',false)` (or `!= true`) to `expiredSnap`.
- Always require `CRON_SECRET` (return 503 if unset, no NODE_ENV exception).
- Use 503 not 500 for the missing-config branch.

---

### F12-P1-05 — Reminder count off-by-one: users can be spammed with the same reminder twice
**Severity:** P1 (UX / non-idempotent notification writes)
**File:** `src/app/api/jobs/export-reminder/route.ts`
**Lines:** L48-55

```ts
const remindersSent = data.cancellation.remindersSent || 0;
const shouldRemind = REMINDER_DAYS.some(
  (day, index) => daysSinceCancellation >= day && remindersSent <= index   // ← <= not <
);
```

Wanted semantic: send reminder N when `daysSinceCancellation >= REMINDER_DAYS[N]` and `remindersSent === N` (we have already sent N reminders). The code uses `remindersSent <= index`, which is true whenever any *later* reminder hasn't been sent. Concretely:

- Day 1, `remindersSent=0` → send (counter=1). ✓
- Day 7, `remindersSent=1` → check `1 <= 1` (index=1) ⇒ send (counter=2). ✓
- Day 7+1h (still day 7), cron runs again → `remindersSent=2`, `daysSinceCancellation>=1`, check `2 <= 0` false, `2 <= 1` false, `2 <= 2` (index=2, day=21) **but** `daysSinceCancellation>=21` is false ⇒ skip. ✓

Actually re-tracing: the `.some` returns true if **any** `(day,index)` pair satisfies both clauses. On day 7 with `remindersSent=1`: index=0 → `1 <= 0` false; index=1 → `1 <= 1` true AND `7>=7` true ⇒ send, counter becomes 2. **Same day cron tick #2** (cron runs every X hours): index=0 false; index=1 → `2 <= 1` false; index=2 → `2 <= 2` true AND `7>=21` false ⇒ skip. So actually on the same calendar day the off-by-one does not fire — `remindersSent` increments past the threshold.

**However**, between day 7 and day 21: index=1 → `remindersSent (2) <= 1` false; index=2 → `2 <= 2` true AND `daysSinceCancellation >= 21` is false until day 21; OK. So the off-by-one is benign for the current `REMINDER_DAYS = [1,7,21,28]` schedule because every threshold gates further increments.

Downgrading: this is **not exploitable** at current values, but is fragile — if anyone changes `REMINDER_DAYS` to e.g. `[1,2,3,4]` (or adds `0`), the daily cron will send all four reminders the moment day 4 is reached. Recommend tightening to `remindersSent === index` and ordering `REMINDER_DAYS` ascendingly explicitly.

**Severity adjusted:** P2 (latent — current schedule is safe).

---

### F12-P2-06 — `community-chat-cleanup` deletes 500 at a time but never re-runs in the same invocation
**Severity:** P2 (backlog growth)
**File:** `src/app/api/jobs/community-chat-cleanup/route.ts`
**Lines:** L44-48

```ts
const snapshot = await db.collection('community_chat')
    .where('timestamp', '<', cutoff.toISOString())
    .limit(500).get();
```

Hard-capped at 500. If retention falls behind (e.g. job was disabled), the daily run will only clean 500/day; with 1k+ daily messages the cleanup will never catch up. No loop, no continuation token. Cheap fix: while-loop until empty (capped by `maxDuration=60`).

---

### F12-P2-07 — `ai-community-agent` does not rate-limit per persona / per Gemini quota
**Severity:** P2 (cost overrun + spam UX risk)
**File:** `src/app/api/jobs/ai-community-agent/route.ts`
**Lines:** L399-486

Concerns:
1. No global "max AI posts per hour" guard. A scheduler misconfiguration (every minute instead of every 3h) would post 720× more.
2. `Math.random() > REPLY_PROBABILITY` only exists in `ai-reactive-reply`, not here. This job always posts.
3. The cooldown check that exists in `ai-reactive-reply` (10 min between AI replies) is absent here, so a manual back-to-back `curl … ai-community-agent` (with valid bearer) immediately posts another batch — non-idempotent in spirit even though Firestore writes are unique-ID.
4. `recentMessages` is loaded by `orderBy('timestamp','desc').limit(10)` but the staff-room write uses `FieldValue.serverTimestamp()` (line 119) while `ai-reactive-reply` uses `createdAt` and orders by `createdAt`. **Field name mismatch**: community_chat docs created here use `timestamp`, but the reactive-reply route reads `createdAt` (L83-87) — meaning the cooldown check in ai-reactive-reply will **miss** AI messages posted by ai-community-agent, so a real teacher message right after an agent run can trigger another AI reply within 10 minutes. P1.

**Re-severity:** finding #4 is P1 — cooldown bypass between the two AI jobs.

---

### F12-P1-08 — Field-name mismatch between `ai-community-agent` and `ai-reactive-reply` breaks the cooldown
**Severity:** P1 (rate-limit bypass on AI persona posts)
**Files:**
- `src/app/api/jobs/ai-community-agent/route.ts` L114-120 (writes `timestamp: serverTimestamp()`)
- `src/app/api/jobs/ai-reactive-reply/route.ts` L82-98 (reads `orderBy('createdAt','desc')` and `data.createdAt?.toMillis?.()`)
- Also `ai-reactive-reply` L160-167 writes `createdAt: serverTimestamp()` — so its own posts ARE found, but the cron agent's are not.

`community_chat` is dual-shaped: cron writes `timestamp`, reactive writes `createdAt`. The cooldown query in reactive-reply (`orderBy('createdAt','desc').limit(5)`) silently skips the cron-written docs (Firestore `orderBy` excludes docs missing the field). Result: cron agent posts at 9:00, real teacher messages at 9:01, reactive-reply checks cooldown, finds zero recent AI posts (the cron one has only `timestamp`, not `createdAt`), and posts again ⇒ two AI messages within 1 minute.

**Repro:**
```bash
# 1) Trigger cron agent (writes with `timestamp`)
curl -X POST 'https://<host>/api/jobs/ai-community-agent' -H "Authorization: Bearer $CRON_SECRET"
# 2) Within 1 min, simulate a real teacher message and call reactive endpoint
curl -X POST 'https://<host>/api/jobs/ai-reactive-reply' \
  -H "x-internal-secret: $AI_INTERNAL_SECRET" \
  -d '{"collectionPath":"community_chat","messageText":"hi","authorName":"Real Teacher"}'
# Expected (post-fix): cooldown skip. Current: 30% chance of posting another AI reply.
```

**Fix:** normalise to a single field name (`createdAt`), or have the cooldown check both. Backfill existing docs if needed.

---

### F12-P2-09 — `grow-persona-pool` has no `count` cap on total personas in the system
**Severity:** P2 (cost / Firestore bloat)
**File:** `src/app/api/jobs/grow-persona-pool/route.ts`
**Lines:** L175-249

`MAX_PER_RUN=15` caps per call, but if the cron runs daily (instead of weekly per docstring) the pool grows unbounded. The slug-based dedup only prevents duplicates of identical names — Gemini at temperature 1.0 reliably produces new names. Recommend reading current pool size and refusing to generate if `pool.size >= TARGET_POOL_SIZE` (e.g. 300).

**Idempotency check (positive):** the existence check on both `RUNTIME_COLLECTION` and `users` (L227-234) correctly skips dupes. Slug normalisation drops accents and non-alphanum (L68-75) — good. Concurrent runs with the same RNG seed could race the `runtimeRef.get()` → `runtimeRef.set()` window, but Cloud Scheduler does not parallelise the same job, so risk is low.

---

### F12-P2-10 — `billing-reconciliation`: auto-fix has no idempotency guard, no oscillation lock
**Severity:** P2 (low-but-real risk of oscillating between auto-fix runs)
**File:** `src/lib/billing-reconciliation.ts`
**Lines:** L292-322 (D1 auto-upgrade), L332-351 (D2 auto-downgrade)

The job runs every 4 hours. A user whose Razorpay state is **`active` with a paid period ending in the next 4h** could be auto-upgraded at 8:00, fall to `terminal` after expiry at 10:00 (Razorpay webhook lost), then auto-downgraded at 12:00. That is correct convergence, not oscillation. The hazard is in D1's `expectedPlan = PLAN_NAME_MAP[rzpSub.plan_id] || 'gold'` (L293) — if a brand new plan_id ships and `PLAN_NAME_MAP` isn't updated, **every user on the new plan gets force-set to `gold`** every 4h. Combined with `monthlyCredits: 50, creditsUsed: 0` reset on D2 downgrade (L337-338), users can lose used-credit history.

**Repro/risk model:**
- New plan added to Razorpay → forgot to update `PLAN_NAME_MAP` in `billing-reconciliation.ts`.
- Next 4h tick: route force-upgrades all those users to `gold`, overwriting `razorpaySubscriptionId`/`razorpayPlanId` to the new ID. If admin manually corrects in Firestore, next tick rewrites.

**Fix:** if `PLAN_NAME_MAP[rzpSub.plan_id]` is `undefined`, **flag** (don't auto-fix). Also keep an audit collection — write `billing_reconciliation_actions` for every `auto_fixed` action before mutating users.

**Also:** `runId = recon_${Date.now()}_${random}` — two parallel triggers will produce two runIds and double-fix. No mutex / lock document. With Cloud Scheduler this won't happen, but manual `curl` while a scheduled run is in flight will race.

---

### F12-P2-11 — `daily-briefing` dedup loads only last 200 posts; old URLs can re-surface
**Severity:** P3 (duplicate news posts after long quiet period)
**File:** `src/app/api/jobs/daily-briefing/route.ts`
**Lines:** L680-699

`postedUrls` set is built from the last 200 SYSTEM posts only. With 5 posts/day that's a 40-day window. A trending evergreen article (e.g. "NCERT releases new curriculum framework") that recurs in Google News after 40 days will be re-posted. Recommend persisting `posted_news_urls` in a dedicated collection with TTL, instead of scanning posts.

---

## 3. Gemini model pinning audit (P0 cost concern from spec)

Verified all jobs use `googleai/gemini-2.5-flash`:

```
src/app/api/jobs/daily-briefing/route.ts: 3 hits (L432, L540, L618)  ✓
src/app/api/jobs/ai-community-agent/route.ts: 1 hit (L47)             ✓
src/app/api/jobs/ai-reactive-reply/route.ts: 1 hit (L143)             ✓
src/app/api/jobs/grow-persona-pool/route.ts: 1 hit (L198)             ✓
```

No 2.5-pro / 1.5-pro leaks. Override-via-`runResiliently` wraps each call. **Pass.**

## 4. Authentication matrix (post-`80d55fba8`)

| Route | unauth POST → | Bearer wrong → | Bearer correct → | Notes |
|---|---|---|---|---|
| daily-briefing | 401 ✓ | 401 ✓ | 200 ✓ | |
| edu-news | 401 (forwarded) ✓ | 401 ✓ | 200 ✓ | But replays headers (F12-P1-03) |
| ai-community-agent | 401 ✓ | 401 ✓ | 200 ✓ | |
| ai-reactive-reply | **200 if env unset (F12-P1-02)** | 403 | 200 | Uses `x-internal-secret`, not bearer |
| billing-reconciliation POST | 401 ✓ | 401 ✓ | 200 ✓ | |
| billing-reconciliation GET | 401 ✓ | 401 ✓ | 200 ✓ | |
| community-chat-cleanup | 401 ✓ | 401 ✓ | 200 ✓ | |
| grow-persona-pool | 401 ✓ | 401 ✓ | 200 ✓ | |
| **storage-cleanup** | **200 + DELETE (F12-P0-01)** | n/a | n/a | **No auth in route** |
| export-reminder | 401 (prod with secret) / **200 (non-prod, no secret)** (F12-P1-04) | 401 ✓ | 200 ✓ | |

## 5. Summary

| Severity | Count | Findings |
|---|---|---|
| P0 | 1 | F12-P0-01 (storage-cleanup unauth + arbitrary path delete) |
| P1 | 4 | F12-P1-02 (reactive-reply open if env unset), F12-P1-03 (edu-news header replay), F12-P1-04 (export-reminder anonymise non-idempotent + non-prod bypass), F12-P1-08 (community_chat field-name mismatch breaks AI cooldown) |
| P2 | 4 | F12-P2-06, F12-P2-07, F12-P2-09, F12-P2-10 |
| P3 | 2 | F12-P2-05 (off-by-one latent), F12-P2-11 (dedup window) |

**Ship-blocker: F12-P0-01.** All other findings are addressable in a single follow-up PR.

## 6. Recommended fix order

1. **P0 — storage-cleanup**: add CRON_SECRET bearer + Pub/Sub OIDC verification + path-prefix allowlist. ~1h.
2. **P1 — ai-reactive-reply**: hard-require `AI_INTERNAL_SECRET`. ~10min.
3. **P1 — community_chat schema**: settle on `createdAt`, backfill, update both routes. ~30min + migration.
4. **P1 — export-reminder**: add `cancellation.anonymized==false` filter, drop the NODE_ENV exception. ~15min.
5. **P1 — edu-news**: delete the route, migrate Cloud Scheduler. ~30min.
6. P2/P3: address in batch with billing dashboards work.
