# Feature Contract: "Hear the Call" Public Demo (Lead Magnet)

Status: PROPOSED (not implemented)
Owner: Growth
Copy pack: `company/marketing/lead_magnet_parent_call_demo.md`
Related: `src/app/api/attendance/call/route.ts` (existing authenticated parent-call path), `sahayakai-voice-call/` (Exotel streaming voicebot), `docs/FEATURE_FLAGS.md`

## 1. What it is

A public, unauthenticated page where a visitor (teacher or school owner) enters their own mobile number and a language. Within ~30 seconds our telephony provider calls that number and plays a fixed, pre-rendered demo parent-call (the "praise call" script by default) in the chosen language. One WhatsApp follow-up goes out after the call. The demo IS the product pitch: no competitor and no ChatGPT can ring a phone.

Explicit non-goals (v1): no live LLM conversation on the demo call, no user-supplied text in the call, no repeat calls to the same number, no student data involved.

## 2. User flow

1. Visitor lands on `/try-call` (marketing page, public).
2. Enters mobile number (+91 only), picks language (11 supported), checks consent box, solves invisible Turnstile.
3. `POST /api/demo-call` validates, applies abuse gates, initiates the call, stores a lead doc.
4. Phone rings within 30 s. Pre-rendered audio plays (~25 s). Call ends.
5. Page polls `GET /api/demo-call/:id/status` and flips to the "What just happened" section + signup CTA when status = completed.
6. T+2 min: WhatsApp follow-up message 1. T+24 h: message 2 if no signup (v1 may start with manual export instead of automated WhatsApp).

## 3. Architecture

### 3.1 Call path decision

Two options exist in the codebase today:

- A. Twilio REST + TwiML `<Play>` (pattern already in `attendance/call/route.ts`, batch mode)
- B. Exotel streaming voicebot (`VOICE_PROVIDER=exotel` -> `VOICE_EXOTEL_CALL_URL`, Sarvam STT/TTS + Gemini, interruption handling)

v1 uses A. IMPLEMENTATION UPDATE (2026-07-03): instead of pre-rendered MP3s, v1 renders the fixed script through Twilio `<Say>` with `TWILIO_VOICE_MAP` — the exact Google Neural2/Wavenet voices production parent calls use. Same determinism (scripts are server-side constants in `src/lib/demo-call/scripts.ts`), zero audio pipeline to build, and the demo sounds identical to the real product because it IS the production voice path. Pre-rendered MP3s remain an optional upgrade if we ever want premium studio voices. v2 can offer "press 1 to talk back" routed through B for the full voicebot wow.

Status: IMPLEMENTED on branch `feature/demo-call-lead-magnet` behind `DEMO_CALL_ENABLED=false`. Sections 3.2/4/5/6 reflect the shipped shape; section 7 (audio pre-rendering) is NOT built — superseded by `<Say>` unless we upgrade voices later. Known deltas from this spec: no separate `scripts/render-demo-audio.ts`, Odia demo speaks Hindi text via the hi-IN voice fallback (F8-02), and the per-phone gate lives in `demo_call_phones/{phoneHash}` (doc get) rather than a query over `demo_leads`.

### 3.2 New components

```
src/app/try-call/page.tsx                  Public landing page (marketing group)
src/app/api/demo-call/route.ts             POST: validate -> gate -> call -> lead doc
src/app/api/demo-call/twiml/route.ts       GET: returns <Play> TwiML for the chosen language
src/app/api/demo-call/status/route.ts      POST: Twilio StatusCallback sink (updates lead doc)
src/app/api/demo-call/[id]/route.ts        GET: client polling (status only, no PII echo)
src/lib/demo-call/scripts.ts               Fixed script text per language (source of truth for rendering)
src/lib/demo-call/gates.ts                 Abuse gates (Turnstile, rate limits, caps)
scripts/render-demo-audio.ts               One-time: render scripts to MP3 via existing TTS tiers
public/audio/demo/<lang>.mp3               11 pre-rendered files (~25 s each; ~200 KB each) or GCS bucket if we want swap-without-deploy
```

### 3.3 Sequence (v1, Twilio path)

```
Browser                    Next.js API                  Twilio                Phone
   |  POST /api/demo-call     |                            |                    |
   |------------------------->| validate E.164 +91         |                    |
   |                          | verify Turnstile token     |                    |
   |                          | gates: phone/IP/global cap |                    |
   |                          | create demo_leads doc      |                    |
   |                          | Calls.json (Method: GET)   |                    |
   |                          |--------------------------->| dial ------------->| rings
   |   202 {id}               |                            | GET /twiml?lang=bn |
   |<-------------------------|                            |<-------------------|
   |  poll GET /:id           |                            | <Play>bn.mp3</Play>|
   |                          |  StatusCallback POSTs      |------------------->| audio plays
   |                          |<---------------------------|                    |
   |  {status: completed}     |  update demo_leads         |                    |
```

Twilio specifics carried over from the attendance route (hard-won lessons, keep them):

- `Method: 'GET'` on the initial TwiML fetch. Regression history documented in `attendance/call/route.ts` (May 2026 + 2026-06-06): omitting it makes the first thing the listener hears an error prompt.
- Singapore edge (`api.singapore.us1.twilio.com`) for India latency.
- `MachineDetection: 'DetectMessageEnd'` so voicemail gets the full message after the beep.
- `Timeout: '30'` ring time.
- Never log or echo Twilio error bodies to the client (account SID leak risk).

## 4. API contract

### POST /api/demo-call

Request:
```json
{ "phone": "+919812345678", "language": "bn", "turnstileToken": "...", "consent": true, "utm": {"source": "...", "campaign": "..."} }
```

Validation, in order (fail fast, cheapest first):
1. Feature flag `DEMO_CALL_ENABLED` on, else 503.
2. Body shape; `consent === true`, else 400.
3. `phone` matches `^\+91[6-9]\d{9}$` (Indian mobile only, reuse `isValidE164` + stricter prefix), else 422.
4. `language` in the 11-language allowlist, else 422.
5. Turnstile server-side verify, else 403.
6. Gates (see section 5), else 429 with `retryAfter`.
7. Initiate call. On provider failure return 502 generic.

Response: `202 { "id": "<demoLeadId>" }`. No phone echo.

### GET /api/demo-call/[id]

Returns `{ "status": "queued|ringing|in-progress|completed|failed|no-answer" }` only. IDs are unguessable (Firestore auto-ID); still no PII in the response.

### POST /api/demo-call/status (Twilio StatusCallback)

- Verify `X-Twilio-Signature` against the callback URL + params (do NOT skip; this endpoint is public).
- Map CallStatus -> lead doc status, stamp durations. Idempotent.

### GET /api/demo-call/twiml?lang=bn

- Validate `lang` against allowlist (path traversal guard; never interpolate into file paths without the allowlist).
- Return `<Response><Play>https://<host>/audio/demo/bn.mp3</Play></Response>`.
- Static per language: cacheable, no per-call state needed.

Middleware note: `/try-call`, `/api/demo-call*` must be added to the public (no `x-user-id`) allowlist; every other `/api/*` route keeps the existing auth model.

## 5. Abuse and cost protection (the make-or-break section)

Threat model: our number as a harassment cannon (entering someone else's number), cost drain loops, scraper spam. Mitigations, all server-side:

| Gate | Rule | Storage |
|---|---|---|
| Per-phone | 1 demo call per phone number per 30 days | `demo_leads` lookup on `phoneHash` (SHA-256 + server pepper) |
| Per-IP | 3 requests per IP per day | Firestore counter `demo_call_ip/{ipHash}` with TTL, or middleware KV |
| Global daily cap | `DEMO_CALL_DAILY_CAP` (default 500) | transactional counter doc `demo_call_meta/daily-{yyyymmdd}` |
| Global kill switch | `DEMO_CALL_ENABLED=false` flips 503 instantly | env / feature flag doc, see `docs/FEATURE_FLAGS.md` |
| Bot gate | Cloudflare Turnstile invisible; server verify | none |
| Content | Scripts are fixed server-side constants; request carries zero free text that reaches TTS or the call | `src/lib/demo-call/scripts.ts` |
| Harassment residual | Audio opens with "You requested this demo call from SahayakAI" so a third party immediately knows the source; every call logged with IP + consent + timestamp | `demo_leads` |

Cost envelope: Twilio India outbound ~USD 0.033/min, call <= 1 min => <= ~₹3/call worst case (Exotel path later: ~₹0.5). At the 500/day cap: <= ₹1,500/day hard ceiling, real spend likely ₹200-400/day at expected volume. TTS is one-time (pre-rendered). Kill switch + cap make the maximum bleed knowable in advance.

TRAI/DND note: call is user-initiated to the user's own number with an explicit consent checkbox (transactional, solicited). We store `{consent: true, ip, ts}` as evidence. Single call + max two WhatsApp follow-ups; no re-marketing calls. Legal review before scale-up, especially if we later add "send to a colleague".

## 6. Data model

`demo_leads/{autoId}`:
```
phoneEnc        string   AES-encrypted E.164 (KMS key, same pattern as other PII)  
phoneHash       string   SHA-256(phone + PEPPER), unique-ish gate key
language        string   ISO code from allowlist
status          string   queued|ringing|in-progress|completed|failed|no-answer
callSid         string   provider id
utm             map      source/medium/campaign
consent         bool     always true (validated)
ipHash          string
createdAt/updatedAt  ISO strings
followupState   string   none|wa1_sent|wa2_sent|converted
convertedUid    string?  set when the phone later appears on a signed-up account (join for CAC math)
```

Firestore rules: collection is server-only (no client read/write); all access via Admin SDK routes. TTL/cleanup job after 180 days.

## 7. Audio pre-rendering

`scripts/render-demo-audio.ts`:
- Input: `src/lib/demo-call/scripts.ts` (praise-call script, 11 languages, with fixed demo values: [School] = "Sunrise Public School", [Student] = per-language common name, e.g. Priya/Rahul/Anika).
- TTS via the existing voice tier mapping (reference architecture memory: Sarvam for ne/as, vendor tiers for the rest); output 8 kHz-friendly MP3/WAV mono (telephony downsamples anyway), target loudness -16 LUFS.
- Mandatory QA gate per `feedback_media_qa_before_handoff`: listen to all 11 before shipping; a native-speaker check for bn/hi/mr minimum.
- Files committed to `public/audio/demo/` (or GCS + CDN if >1 MB each).

## 8. Analytics and funnel

Events (existing analytics pipeline): `demo_call_requested`, `demo_call_completed`, `demo_call_failed`, `demo_wa1_sent`, `demo_signup` (join on phoneHash at signup when user verifies phone). North-star for the magnet: completed-call -> signup rate; guardrail: cost per signup <= ₹60.

## 9. Rollout plan

1. Branch `feature/demo-call-lead-magnet` from `develop` (per git rules; no direct main).
2. Implement behind `DEMO_CALL_ENABLED=false`. `npm run predeploy` green (tsc, lint, tests).
3. Staging test with `TWILIO_TEST_OVERRIDE_NUMBER` pointing at team phones; verify all 11 audios over a real cell call (speaker quality differs from headphones).
4. Deploy via `bash scripts/safe-deploy.sh` + `audit-deployments.sh` before AND after (service `sahayakai-hotfix-resilience`, asia-southeast1). Never raw `gcloud run deploy`.
5. Enable flag with cap = 50/day for a 1-week soft launch to the outreach list (`company/outreach/` wave). Watch cost + completion rate.
6. Raise cap to 500/day, attach WhatsApp automation, publish the landing page to ads/social.
7. `scripts/smoke-test.sh` post-deploy; add `/api/demo-call` 503-when-disabled check to smoke suite.

## 10. Test plan (minimum)

- Unit: phone regex (reject +1..., +9155555 short, landlines starting 0), language allowlist, gate logic (phone repeat, IP cap, daily cap transaction race), Turnstile verify mock.
- Integration: POST happy path with Twilio mocked (assert `Method: 'GET'` present in body; regression test for the greeting bug class), StatusCallback signature verification (reject unsigned), twiml lang traversal attempts (`?lang=../../etc`).
- E2E (staging): 2 real calls (hi, bn) to override number; voicemail path (let it ring out) verifies MachineDetection message lands.
- Load: 20 concurrent POSTs -> exactly cap-permitted calls initiated, rest 429, counter doc consistent.

## 11. Open questions (decide before build)

1. WhatsApp follow-up automation in v1, or manual export of `demo_leads` for the first 2 weeks? (Recommend manual first; automation is its own template-approval project on the WhatsApp Business side.)
2. Which script as THE demo: praise call (emotional wow, recommended) or absence alert (most common use)? Could A/B via `?variant=` later; v1 ships one.
3. Twilio vs Exotel for v1 demo trunk: Twilio path is already proven in-code; Exotel is cheaper at scale. Recommend Twilio v1, revisit at >200 calls/day.
4. Does `/try-call` live on the app domain or the marketing site? App domain keeps the API same-origin (simplest CORS story) and lets signup share the session.
