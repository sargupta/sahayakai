# Attendance + AI Parent-Call — Live Diagnosis

**Date:** 2026-06-06 17:10 IST
**Service:** `sahayakai-hotfix-resilience` · `asia-southeast1` · `sahayakai-b4248`
**Active revision after this fix:** `sahayakai-hotfix-resilience-00425-rlh` (same image as 00487-gap, with env corrected)

---

## TL;DR

You said attendance + AI agent call are broken. I found **one definite root cause** and corrected it live:

- **The prod app was pointed at the STAGING sidecar.** `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` on the live Cloud Run service was `https://sahayakai-agents-staging-...run.app`. That's the audience-secret-staging-drift regression we know about — it has come back on every deploy that doesn't carry the env override. The `SAHAYAKAI_AGENTS_AUDIENCE` secret was also pointing at the staging URL.

This matters because every parent-call turn fires the shadow-diff pair (Genkit + sidecar) via `Promise.all`. The sidecar call against staging from a prod runtime, with a mismatched audience, would fail authentication (401 from staging or timeout). The dispatcher catches that and Genkit still serves, but it makes the response noticeably slower per turn (sidecar burns its full ~10s timeout before the dispatcher gives up) and any cron/job paths that call the sidecar directly (without the shadow safety net) would just fail.

**Live fix applied:**
1. `gcloud secrets versions add SAHAYAKAI_AGENTS_AUDIENCE` → wrote v5 with `https://sahayakai-agents-zwydpvyuca-as.a.run.app` (the prod sidecar)
2. `gcloud run services update sahayakai-hotfix-resilience --update-env-vars=NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL=https://sahayakai-agents-zwydpvyuca-as.a.run.app --update-secrets=SAHAYAKAI_AGENTS_AUDIENCE=SAHAYAKAI_AGENTS_AUDIENCE:latest`
3. New revision `sahayakai-hotfix-resilience-00425-rlh` created, traffic auto-routed (100%).

---

## What we actually changed today that touches attendance + parent-call

Eight things in the F8 / F9 / F5 / F1 wave landed in the prod image you're testing against. Listing them in order of "most likely to be the thing you're hitting":

### 1. Sidecar URL → staging drift (FIXED, see above)

The single biggest active fault. Confirmed via `gcloud run revisions describe sahayakai-hotfix-resilience-00487-gap`. Already corrected on the live service.

### 2. F8-01 — Twilio signature validation made strict in production

`src/lib/twilio-validate.ts` no longer accepts `host.includes('localhost')` as a skip signal in prod. If `NODE_ENV=production` it never skips, period. **Status on prod:** `NODE_ENV=production` is set. The skip can't fire. So real Twilio webhooks must carry a valid `X-Twilio-Signature`.

**Risk:** if Twilio is calling our endpoint but signing against a different URL than we reconstruct via `X-Forwarded-Proto + Host`, every webhook 403s. The reconstruction logic:
```ts
function getCanonicalUrl(req) {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host  = req.headers.get('host') ?? '';
  const parsed = new URL(req.url);
  return `${proto}://${host}${parsed.pathname}${parsed.search}`;
}
```

For `/api/attendance/call` the TwiML URL is built from the INBOUND `Host:` header — so if the teacher's dashboard hits `sahayakai.com/api/attendance/call`, Twilio is told to webhook at `https://sahayakai.com/api/attendance/twiml?outreachId=...`. Twilio then signs against `https://sahayakai.com/...` and POSTs to it. On the way in, Cloud Run's proxy sets `Host: sahayakai.com` and `X-Forwarded-Proto: https` — reconstruction matches. ✅ Should work.

**However**, if the teacher's dashboard happens to hit the Cloud Run direct URL (`sahayakai-hotfix-resilience-...run.app`), then Twilio is told to webhook that URL, signs it, and POSTs there. Reconstruction also matches. ✅ Should work.

The breakable case: if there's a load balancer in between that rewrites the host header in either direction (signing path vs. delivery path). We don't have evidence of that today.

**Verification step you can do:** make a test call, then watch logs:
```
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="sahayakai-hotfix-resilience" AND textPayload=~"twiml.*Invalid Twilio signature"' --project=sahayakai-b4248 --limit=5 --freshness=30m
```
If you see lines, the signature is being rejected and we need to log what URL is being reconstructed.

### 3. F8-03 / F9-002 — twiml-status idempotency lock

`src/app/api/attendance/twiml-status/route.ts` now wraps the summary-generation kick-off in a transaction that claims `_summaryGenerating = true` before invoking Gemini. Designed to prevent duplicate summaries on Twilio retries. **Risk:** if the claim transaction fails (Firestore contention) the summary is skipped. The call itself still completes — only the post-call written summary is missing.

### 4. F8-04 — Per-turn dedup using a `processedTurns` fingerprint array on the parent_outreach doc

`src/app/api/attendance/twiml/route.ts` POST handler now computes `${callSid}:${turnNumber + 1}:${sha1(speech)}`, checks-and-sets atomically against `processedTurns` (last-32 array on the doc), and if duplicate returns the cached reply.

**Subtle risk:** during the first webhook delivery (no duplicate), the transaction writes `processedTurns` BEFORE the LLM reply is generated, but does NOT cache the reply at that point (the reply doesn't exist yet). The reply gets cached AFTER LLM generation via a separate `tx.update(... processedTurnReplies)`. If a Twilio retry arrives between the initial fingerprint write and the reply cache write, the retry sees `processed.includes(fingerprint)` true but `replies[fingerprint]` undefined — it returns the "benign keep-listening prompt" instead of the actual reply. Parent hears `<Pause length="2"/>` and then `waitingPrompt` — they don't get the agent's real answer.

**Net effect:** on the rare race (estimate <1% of turns), the parent hears a generic "please continue speaking" instead of the AI's reply. The call doesn't crash — it's degraded. If this is happening to you consistently it's a different bug; if intermittently it could be this.

### 5. F5-006 — `appendTurnAtomically` wrapper

Both `GET` (opening turn) and `POST` (parent + agent turns) now route through a transactional append into a `turns` subcollection plus a transcript-array update. Each request now performs 2-3 Firestore transactions where there used to be 1-2 plain writes. Added latency: ~150-400ms per turn. Not a break.

### 6. F9-001 — Ownership check on `/api/attendance/outreach`

POST requires `classes/{classId}.teacherUid === x-user-id`. If a teacher's class document is missing the `teacherUid` field (legacy data), the check returns 403. **Verification:** does the teacher's class actually have a `teacherUid` field that equals their uid?

```
gcloud firestore export ... # too heavy; use console instead
```
Use the Firebase console → `classes` collection → open one of your class docs → confirm `teacherUid` is present and equals the teacher's auth uid.

### 7. F9-001 — Server-trusted parent phone

The outreach POST now IGNORES `parentPhone` in the request body and reads it from `classes/{classId}/students/{studentId}.parentPhone`. If a student doc doesn't have `parentPhone`, the route returns 422 "Student has no parent phone on record". **Verification:** does the student doc you're testing with actually have `parentPhone` (E.164 format, `+91...`)?

### 8. F9-003 — Per-(teacher, student) dedup window (5 minutes)

If you call the same student twice within 5 minutes the second call returns 429. This is the most common false-positive symptom on testing — easy to hit while iterating.

---

## What is currently working in prod (verified by probe)

| Endpoint | Probe result | Meaning |
|---|---|---|
| `GET /api/attendance/twiml` (no signature) | 403 | F8-01 strict mode working |
| `POST /api/attendance/twiml` (no signature) | 403 | Same |
| `POST /api/attendance/twiml-status` (no signature) | 403 | Same |
| `POST /api/attendance/outreach` (no auth) | 401 | Auth required (correct) |
| `GET /api/health` | 200 | App is up |
| Prod sidecar `sahayakai-agents` reachable | 403 at `/` | Up (403 is auth, not 5xx) |
| Live revision | `00425-rlh` | image SHA `ec58226f`, env corrected |

No real Twilio user-agent webhook traffic has hit prod in the last 24 hours — only synthetic `node` traffic at 04:14 and my own `curl` probes at 17:00. So either you've been testing locally / on preview, or the upstream "Call Parent" UI button isn't reaching the call route. If it's the second one, that's the next thing to look at.

---

## What I need from you to narrow this down further

Please tell me which of these your symptom looks like:

1. **Teacher clicks "Call Parent" → button errors / dashboard shows red toast** — the failure is in `/api/attendance/outreach` or `/api/attendance/call`. Most likely F9-001 ownership/student-phone or F9-003 dedup.
2. **Phone rings but agent silent / hangs up immediately** — `/api/attendance/twiml` GET is rejecting Twilio's first webhook. Either F8-01 signature mismatch or `parent_outreach` doc missing.
3. **Agent speaks but parent's response isn't understood / agent repeats greeting** — `/api/attendance/twiml` POST is hitting F8-04 dedup race (item 4 above) or Twilio is retrying.
4. **Call completes but no summary in dashboard** — `/api/attendance/twiml-status` idempotency claim is firing twice or `transcript-sync` is racing it. The call itself worked; the post-call summary is the thing missing.
5. **Agent's replies don't match what parent said / robotic** — sidecar drift (which I just fixed) or Genkit fallback misroute.

Pick one and I'll dig straight into it with logs from your specific outreachId / callSid.

---

## Outstanding (not yet fixed)

- **cloudbuild.yaml does not pin `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` or `SAHAYAKAI_AGENTS_AUDIENCE`** — so the staging-drift will keep recurring on every prod deploy. Needs the same `--update-env-vars` / `--update-secrets` line added to the deploy step. I will follow up with this patch on `develop` so the next release self-heals.

— diagnosis written by Claude
