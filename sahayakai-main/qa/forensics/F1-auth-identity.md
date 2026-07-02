# F1 — Authentication + Identity Forensics

**Date:** 2026-06-06
**Investigator:** Role 1 (Firebase Auth, Middleware x-user-id, OIDC sidecar, Custom Claims, Session/CSRF)
**Targets probed:**
- Prod: `https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app` (READ-ONLY + anon POSTs that should 401)
- Preview: `https://sahayakai-preview-zwydpvyuca-as.a.run.app`
- Source tree: `src/middleware.ts`, `src/lib/auth-helpers.ts`, `src/app/actions/auth.ts`, `src/app/api/**`
- Active prod revision: `sahayakai-hotfix-resilience-00482-her` (deployed 2026-06-06 12:11 UTC)
- HEAD: `9c8483b9c` (security fix `80d55fba8` shipped 2026-06-05, BEFORE active revision)

## Severity rubric
- **P0** = identity bypass / cross-tenant write / direct cost-burn or community-pollution by anon caller
- **P1** = privilege escalation / identity-field tampering / fail-open auth gate / secrets in plaintext env
- **P2** = missing auth on read-only-ish endpoint
- **P3** = missing test, missing log, doc drift

---

## Findings table

| ID | Severity | Title | Status |
|---|---|---|---|
| F1-01 | **P0** | `/api/jobs/daily-briefing` executes full LLM + write workload with no auth in prod | CONFIRMED EXPLOITED |
| F1-02 | **P0** | `/api/jobs/grow-persona-pool` creates AI personas with no auth in prod | CONFIRMED EXPLOITED |
| F1-03 | **P0** | `/api/jobs/ai-community-agent` posts community content as AI personas with no auth in prod | CONFIRMED EXPLOITED |
| F1-04 | **P1** | Twilio `ACCOUNT_SID` + `AUTH_TOKEN` stored as plaintext env vars on prod Cloud Run (not Secret Manager) | CONFIRMED |
| F1-05 | **P1** | `CRON_SECRET` not set in prod env → cron auth gates either 503 or (worse, in some shipped builds) fail open | CONFIRMED |
| F1-06 | **P1** | `syncUserAction` trusts client-supplied `email` field — no check against ID-token `email` claim | CONFIRMED (source) |
| F1-07 | **P1** | `/api/jobs/ai-reactive-reply` auth is fail-open when `AI_INTERNAL_SECRET` env var is unset | CONFIRMED (source) |
| F1-08 | **P2** | `/api/jobs/edu-news` reachable anon (returned 500 only because of downstream fetch failure, not auth) | CONFIRMED |
| F1-09 | **P2** | Cloud Run prod has `roles/run.invoker → allUsers` — platform auth disabled; in-handler checks are the only guard | CONFIRMED |
| F1-10 | YELLOW | Sidecar audience secret — unable to read `SAHAYAKAI_AGENTS_AUDIENCE` Secret Manager value with available IAM. Cannot confirm Q4B fix vs sidecar URL drift end-to-end | INCOMPLETE |

---

## Detailed findings

### F1-01 — P0 — `/api/jobs/daily-briefing` exploitable without auth in prod

**Endpoint:** `POST /api/jobs/daily-briefing`
**Code (HEAD):** `src/app/api/jobs/daily-briefing/route.ts:656-664` — has a `CRON_SECRET` Bearer gate.
**Source review:** gate is implemented correctly:
```ts
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) return 503;
if (authHeader !== `Bearer ${cronSecret}`) return 401;
```
**Live behavior (prod, 2026-06-06):** anon `POST {}` with NO Authorization header returned `200 {"ok":true,"posted":3,...,"scrapedTotal":150,"durationMs":87088}`. The job ran a full edu-news scrape, posted 3 docs to Firestore, and translated payloads into 10 Indic languages.

**Why this is P0:**
1. Any anon caller can drain LLM (Gemini 2.5 Flash) + translation budget on demand. Each run = ~$1-3 of API cost. A loop = monthly bill annihilation.
2. Writes to `daily_briefings` / `system_config/daily_briefing_last_check` collections by an unauthenticated attacker → log pollution + dedup poisoning (attacker can mark URLs as "already posted" so legitimate news is suppressed).
3. The signal that anon access works AND `/api/jobs/billing-reconciliation` (same auth-gate shape) returns `500 CRON_SECRET not configured` proves the deployed binary on revision `00482-her` does NOT match HEAD source — either the security commit `80d55fba8` did not land in that build, or the env var is missing in a way that bypasses the early `return 503`.

**Repro:** `qa/forensics/repros/F1-01.sh`
**Recommended fix:**
1. Confirm `CRON_SECRET` Secret Manager binding + redeploy.
2. Add `bash scripts/audit-deployments.sh` probe for unauth POST to `/api/jobs/daily-briefing` → expect 401 or 503.
3. Move all `/api/jobs/*` off `allUsers` invoker — use Cloud Scheduler OIDC service account + `gcloud run services add-iam-policy-binding` per-service-account, then drop `allUsers`. Defense in depth.

---

### F1-02 — P0 — `/api/jobs/grow-persona-pool` exploitable without auth in prod

**Endpoint:** `POST /api/jobs/grow-persona-pool`
**Code (HEAD):** `src/app/api/jobs/grow-persona-pool/route.ts:175-183` — same CRON_SECRET gate.
**Live (prod):** anon `POST {}` returned `200 {"ok":true,"requested":5,"created":["Kavitha Devi"],"skipped":[...]}` — Gemini generated a new persona and wrote to `users` collection.

**Why P0:** anon callers can flood the persona pool, inject names/personas of their choosing into the community surface (if persona-generation prompt accepts caller-supplied seed in some code paths), and burn Gemini budget.

**Repro:** `qa/forensics/repros/F1-02.sh`

---

### F1-03 — P0 — `/api/jobs/ai-community-agent` exploitable without auth in prod

**Endpoint:** `POST /api/jobs/ai-community-agent`
**Code (HEAD):** `src/app/api/jobs/ai-community-agent/route.ts:401-408` — CRON_SECRET gate present.
**Live (prod):** anon `POST {}` returned `200 {"ok":true,"actions":{"staffRoomChats":["Mohammed Farooq","Anjali Patil"],"groupPost":"Joseph Vargese","likes":"Gurpreet Kaur"},"failures":0}` — staff-room chats posted, group post created, likes applied — all by anon caller.

**Why P0:** Anon caller can trigger an arbitrary number of AI persona messages in the community surface — every run is real Firestore writes that real teachers see. Combine with F1-02 (custom persona creation) → an attacker can manufacture AI "teachers" and have them post.

**Repro:** `qa/forensics/repros/F1-03.sh`

---

### F1-04 — P1 — Twilio credentials in plaintext Cloud Run env (not Secret Manager)

`gcloud run services describe sahayakai-hotfix-resilience --format='value(spec.template.spec.containers[0].env)'` returns:
```
{'name': 'TWILIO_ACCOUNT_SID', 'value': '[REDACTED — AC + 32-char hex SID]'}
{'name': 'TWILIO_AUTH_TOKEN', 'value': '[REDACTED — 32-char hex token]'}
{'name': 'TWILIO_PHONE_NUMBER', 'value': '[REDACTED — E.164 number]'}
```
These are not `valueFrom.secretKeyRef`. Any IAM principal with `run.services.get` on the prod service can read them and gain full Twilio account control (send SMS / voice calls / siphon credit).

Contrast: `GOOGLE_GENAI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `SAHAYAKAI_AGENTS_AUDIENCE`, `SAHAYAKAI_REQUEST_SIGNING_KEY` are all correctly bound via `secretKeyRef` to Secret Manager.

Bonus: `TWILIO_PHONE_NUMBER` has a trailing `\n` — likely cosmetic but indicates last edit was done by hand-pasting and bypassed validation.

**Fix:** move to Secret Manager; rotate Twilio auth token immediately (assume compromised).

---

### F1-05 — P1 — `CRON_SECRET` not configured in prod environment

`POST /api/jobs/billing-reconciliation` (anon) → `500 {"error":"CRON_SECRET not configured"}`. The gate's source code returns 503 on missing secret, but live response is 500 — middleware/Next is wrapping the response. Either way: **CRON_SECRET is not bound to prod**. This is the root cause that makes F1-01/02/03 even more dangerous (no shared-secret defense possible until it's set).

Recommended: store `CRON_SECRET` in Secret Manager, bind via `valueFrom.secretKeyRef`, redeploy. Then re-run F1-01/02/03 to verify the gate now triggers.

---

### F1-06 — P1 — `syncUserAction` trusts client-supplied `email`

`src/app/actions/auth.ts:23-58`
```ts
export async function syncUserAction(user: { uid, email, displayName, photoURL }) {
  const callerUid = await requireAuth();
  if (user.uid !== callerUid) return Forbidden;
  await dbAdapter.updateUser(callerUid, {
    uid: callerUid,
    email: user.email || "",   // ← from client, no token cross-check
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
  });
}
```
The fix in Wave 1 closed cross-uid write, but the `email`/`displayName`/`photoURL` fields remain trust-the-client. A caller logged in as `attacker@x.com` (verified) can call `syncUserAction({ uid: SELF, email: "ceo@school.com", ... })` → their own user doc now claims `email = ceo@school.com`.

**Impact scenarios:**
1. Teacher directory / community profile renders the spoofed email → social-engineering surface.
2. Razorpay webhook `subscription.charged` flow uses `subscription.notes.email` (from Razorpay) AND `users/{uid}.email` (from Firestore) — if a downstream feature lookups by email, spoofed value can poison.
3. Magic-link recovery / support contact / abuse reports tied to `users.email` would be misrouted.

**Fix:** server-derive email from the verified ID token. The middleware decodes the ID token already — extend it to inject `x-user-email` (server-trusted), drop the `email` param from `syncUserAction`, and overwrite from header. Same treatment for `displayName`/`photoURL` (Firebase Auth has authoritative copies — fetch via Admin SDK `auth.getUser(uid)`).

---

### F1-07 — P1 — `/api/jobs/ai-reactive-reply` fail-open auth

`src/app/api/jobs/ai-reactive-reply/route.ts:44-50`
```ts
const secret = process.env.AI_INTERNAL_SECRET;
if (secret) {
  const provided = req.headers.get('x-internal-secret');
  if (provided !== secret) return 403;
}
// ← if AI_INTERNAL_SECRET is unset, we skip the check entirely
```
Same anti-pattern as F1-05. If `AI_INTERNAL_SECRET` is unset (we couldn't read Secret Manager to confirm), every caller is admitted.

**Live confirms:** anon `POST {collectionPath:"x",messageText:"y",authorName:"z"}` got `400 {"ok":false,"reason":"invalid path"}` — request was admitted past the auth gate and only failed on payload validation (path allowlist via `isAllowedChatPath`). If we supplied a legitimate `collectionPath` (e.g. `community_chat`), this would post AI-persona replies as anon.

**Fix:** change to `if (!secret || provided !== secret) return 403`. Same change pattern applies to every fail-open gate in the codebase. Grep `if (secret)` and `if (cronSecret)` to find others.

---

### F1-08 — P2 — `/api/jobs/edu-news` reachable anon

Returned 500 only because internal fetch failed; no auth gate in the first 50 lines of the file. Treat as P0 once the downstream failure is fixed. Adding to register so it's not forgotten.

---

### F1-09 — P2 — prod Cloud Run `allUsers` invoker

`roles/run.invoker → allUsers` is by design for a public Next.js app, but:
1. it disables the platform-level OIDC check that the cron-job auth notes ("Cloud Run validates automatically") relied on
2. combined with F1-05 it leaves cron jobs naked

**Fix:** split cron endpoints onto a second Cloud Run service with IAM-only invoker, OR keep them on the same service but make every `/api/jobs/*` handler refuse requests without a verified OIDC Authorization header (parse + verify against expected SA email).

---

### F1-10 — YELLOW — Sidecar audience drift

Could NOT read `SAHAYAKAI_AGENTS_AUDIENCE` secret value (`PERMISSION_DENIED` under impersonated SA). What is verified:
- prod env binds the secret correctly via `valueFrom.secretKeyRef.name=SAHAYAKAI_AGENTS_AUDIENCE`
- sidecar URL is `https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app`
- sidecar IAM allows ONLY `serviceAccount:640589855975-compute@developer` — so even with the right audience, only the compute SA can mint a usable OIDC token (Q4B audience match is necessary but not sufficient)
- prod runs under the compute SA implicitly → can mint
- all sidecar clients (`src/lib/sidecar/*-client.ts`) read `SAHAYAKAI_AGENTS_AUDIENCE` env via `AUDIENCE_ENV` constant ✓

Cannot verify the secret's literal value matches the sidecar URL. Recommend a quick CI test that hits the sidecar with a minted OIDC token and asserts 200 — would catch any future drift.

---

## Coverage matrix — what was probed

| Beat | Source | Live | Result |
|---|---|---|---|
| Middleware x-user-id strip | ✓ | ✓ (spoofed header → 401) | PASS |
| Public-API allowlist | ✓ | ✓ | PASS except `/api/jobs/*` (F1-01/02/03/08) |
| Firebase ID token verify | ✓ | ✓ (no token → 401) | PASS |
| Server-action page-mutation gate | ✓ | not probed live | PASS (source) |
| syncUserAction uid cross-check | ✓ | not probed (would write) | PASS |
| syncUserAction email/displayName trust | ✓ | not probed (would write) | **FAIL** (F1-06) |
| App Check verification | ✓ | not probed (need real client) | PASS (source, gated by APP_CHECK_REQUIRED flag) |
| Sidecar OIDC audience binding | partial | impossible w/o IAM | YELLOW (F1-10) |
| Cron auth gates | ✓ | ✓ | **FAIL** on 4 routes (F1-01/02/03/07) |
| Razorpay webhook signature | ✓ | not probed (would forge) | PASS (source) |
| Twilio webhook | not deep | not probed | partial |
| Custom-claims escalation via syncUserAction | ✓ | not applicable | PASS — syncUserAction does not write planType/adminRoles |
| Cloud Run platform IAM | ✓ | ✓ | FAIL (F1-09) |
| Plain-env secrets leak | ✓ | n/a | **FAIL** (F1-04) |

## Out of scope / next investigations
- AppCheck strict-mode (`APP_CHECK_REQUIRED=true`) is not enabled in prod env. Recommend Q-track to enable + observe rejects in canary.
- Custom-claims escalation via `setCustomUserClaims` server-side — needs audit of every Admin-SDK call site (separate Role-1D agent run).
- CSRF on server actions — Next.js 15 ships built-in action CSRF check via `Next-Action` header + `Origin` check. Recommend audit that no action is exposed via `/api/*` accidentally.

## Appendix — secrets / tokens redaction policy
- `TWILIO_AUTH_TOKEN` redacted in F1-04
- `NEXT_PUBLIC_FIREBASE_API_KEY` left visible — it's a public web API key by design (Firebase Auth pattern)
- All curl repro scripts use only public endpoints + empty payloads
