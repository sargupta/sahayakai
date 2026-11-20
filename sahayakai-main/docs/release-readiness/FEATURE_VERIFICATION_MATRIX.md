# Feature verification matrix — SahayakAI develop 9245a62a + `hardening/production-readiness-2026-11-15`

Date: 2026-11-15. Status meanings:

- **PASS**: verified with evidence (an automated test that ran on this branch, and/or the page or route actually exercised on a running instance).
- **FAIL**: a defect confirmed in code or by test and **not fixed** on this branch.
- **BLOCKED**: needs an external service, real hardware, a deployment or an authorisation this audit did not have.
- **NOT TESTED**: no verification performed in this audit.

Evidence sources (all run on 2026-11-15):

- `J`: full Jest, 5,864 passed, 0 failed, 30 skipped (428 suites, 2 skipped).
- `R`: route smoke on the isolated :3100 instance (`scripts/qa/route-smoke.mjs`; result in PRODUCTION_READINESS_AUDIT.md §6).
- `F`: Firestore rules check against an emulator (`scripts/qa/verify-firestore-rules.mjs`), 18/18.
- `L`: live :3000 develop instance, checked in the browser.
- `S`: static and code audit (four independent read-only reviews plus my own reading).

"Fixed" means it was fixed on this branch, with a regression test.

| # | Area | Feature | Expected behaviour | Key code | Auth / permission | External deps | Tests | Status | Evidence / outstanding |
|---|---|---|---|---|---|---|---|---|---|
| 1 | VIDYA | Live voice session start (teacher) | Tap orb → token minted → WS → listening | `lib/vidya-live/live-session.ts`, `/api/vidya-voice/start-session` | Firebase token + uid allow-list | sidecar :8090, Vertex Gemini Live | live-session-*.test.ts, vidya-voice-start-session-route.test.ts | PASS (mocked) / BLOCKED (real audio) | J; sidecar healthz 200 (L). Real mic + speech not verified: built-in browser blocks the mic. |
| 2 | VIDYA | Recovery from "I lost the connection" | Next tap starts a fresh session without a page refresh | `use-vidya-live.ts` toggle → new `VidyaLiveSession` | — | — | live-session-connect-watchdog.test.ts | PASS | J: a drop mid-session, then a tap, gives a new socket and the session listens again; late frames from the dead socket are ignored. Browser (:3100): error, then tap, creates a new session in the same document. |
| 3 | VIDYA | Connect watchdog | A hung token route or sidecar must not leave "Connecting…" spinning forever | `CONNECT_TIMEOUT_MS` 20 s (armed after mic grant) | — | — | same | PASS (fixed) | Was unbounded; now fails with the friendly retry copy and releases the mic. |
| 4 | VIDYA | Mic denied / unavailable copy | Friendly message, tap to retry | `FRIENDLY` map | — | browser permission | — | NOT TESTED | Needs a real browser permission prompt. |
| 5 | VIDYA | Barge-in, turn detection, playback level | Teacher speech interrupts VIDYA | live-session.ts | — | Gemini Live | live-conversation.test.ts (state machine) | PASS (mocked) / BLOCKED (real) | Real audio path not exercised. |
| 6 | VIDYA | Session cleanup on unmount / tab close | Mic tracks stopped, contexts closed | `teardown()`, hook unmount | — | — | watchdog test asserts track.stop | PASS (mocked) | Tab-close in a real browser not tested. |
| 7 | VIDYA | Public landing voice (anonymous) | Rate-limited, 6 per hour per address | `/api/vidya-voice/public-session` | none (flag `VIDYA_VOICE_PUBLIC_ENABLED`) | sidecar | vidya-voice-public-session-limit.test.ts | PASS (fixed) | Limiter keyed on the client-controlled first XFF entry, and `map.clear()` reset everyone. Now keyed on the last entry, evicting only expired windows. |
| 8 | VIDYA | Text assistant / intent router | Navigation, app help and instant answers | `/api/assistant`, `/api/ai/intent` | token + plan check (assistant) | Gemini | ai-intent-app-help.test.ts + assistant tests | PASS (fixed: bounds, error leak) | Intent prompt capped at 4,000 characters; assistant 500 no longer returns raw error text. Intent still has no per-user limiter (see audit R-5). |
| 9 | Sampark | Workspace load / provider chooser | Choose provider, then workspace in Practice | `/sampark/[orgId]`, `/sampark/choose-provider` | org admin (`guardOrgRoute`) | — | sampark route tests | PASS | L: the hillview-demo workspace rendered in Practice; R. |
| 10 | Sampark | Org/tenant isolation of all `/api/sampark/[orgId]/**` | No cross-school access, no IDOR | `guardOrgRoute`, repo scoping `sampark_schools/{orgId}` | admin / staff | — | api/sampark/routes.test.ts | PASS | S: every callId, campaignId, callbackId, guardianId and audio key is looked up under the verified org; ids from another school return 404. |
| 11 | Sampark | Teacher class scoping (batch) | Teacher acts only on own classes | `guardBatchRoute`, `canManageClass` | staff + `members.samparkClasses` | — | batch tests | PASS | J, S |
| 12 | Sampark | Attendance UI / classes / students | Owner-only CRUD | `src/server/attendance.ts` | `teacherUid === uid` | — | attendance tests | PASS | J, S; R `/attendance` redirects for a user with no class (expected). |
| 13 | Sampark | Parent call (attendance outreach) | One outreach record dials once; opt-out, quiet hours and server-side destination | `/api/attendance/call` | owner | Twilio / Vobiz / Exotel | attendance-call-single-dial.test.ts, -suppression-gate, -destination-allowlist | PASS (fixed) | A repeated POST used to ring the same parent again; now 409 `ALREADY_DIALLED`, checked for all 3 providers. |
| 14 | Sampark | Teacher-entered destination numbers | Only real parent numbers should be dialled | outreach + roster | owner, premium | providers | — | FAIL (not fixed) | A teacher can add a "student" with any phone number and their own spoken script. Mitigations: single dial per record (fixed), quiet hours, opt-out. Needs `CALL_ALLOWED_DESTINATIONS` outside production, plus per-teacher daily caps (product decision). |
| 15 | Sampark | Four behavioural outreach reasons | Purpose catalogue drives scripts | `riya-purposes.ts` | — | — | launcher-purposes, riya-gates tests | PASS | J |
| 16 | Sampark | Riya Practice call (simulated) | Simulated call, outcome stored | conversation service | org admin | none (simulated) | riya-service / riya-routes tests | PASS (tests) / NOT TESTED (clicked in UI) | Not clicked through in the browser this run. |
| 17 | Sampark | Riya call state machine | Out-of-order events never downgrade a final state | `conversation/state.ts` | — | — | riya-provider.test.ts | PASS (fixed) | A late `failed` post_call turned `completed` into `unknown` and wiped the transcript; now guarded. |
| 18 | Sampark | Call history / My Calls / Teacher Calls | Lists per scope | `/api/sampark/[orgId]/calls`, demo views | admin / teacher | — | riya-call-history.test.tsx | PASS | J, R |
| 19 | Sampark | Callbacks / PTM workflow | Parse, preview, schedule, worker on tick | `callbacks/*`, ticker | admin | — | callbacks tests | PASS (tests) | Worker exercised only in tests. |
| 20 | Sampark | Google Calendar sync | OAuth, events, push notifications | `google-calendar/*` | admin; channel token | Google | gcal tests (mock Google) | PASS (mock) / BLOCKED (real Google) | |
| 21 | Batch | Class-wide batch: preview, create, pause/resume/cancel, retry | Caps 100 recipients, 3 lines, 60 s gap, leases | `server/sampark/batch-calls.ts` | staff + class | Vobiz | 62+ batch tests | PASS (tests) | J |
| 22 | Batch | Real batch dialling safeguard | Off unless `SAMPARK_BATCH_REAL_CALLS`, Test mode, allow-list and confirmation | same | — | — | batch gate tests | PASS | J, S |
| 23 | Batch | Duplicate-campaign race | Two staff, same announcement, different requestKey | `findByDedupeKey` (plain query) | — | — | — | FAIL (not fixed, P2) | Can create two running campaigns. Mitigated by busy-family deferral and frequency cap. Fix: transactional dedupe lock doc. |
| 24 | Riya / ElevenLabs | Outbound call via the unified agent | Uses the existing agent and number only | `elevenlabs-client.ts` | Test mode + allow-list | ElevenLabs | riya-provider tests | PASS (mocked) / BLOCKED (real) | No real call placed (by rule). |
| 25 | Riya / ElevenLabs | Post-call webhook | Raw-body HMAC, window, dedupe, 503 without secret | `/api/webhooks/elevenlabs-riya` | HMAC | ElevenLabs | webhook tests + read-body-capped.test.ts | PASS (local) / BLOCKED (public) | Body now stream-capped at 512 KB. No public endpoint exists. |
| 26 | Riya / Vobiz | Answer / status / context / event | Signed tokens, raw-body HMAC (event) | `webhooks/vobiz-riya/*` | tokens / HMAC | Vobiz, bridge | riya-vobiz-provider tests | PASS (local) / BLOCKED (real) | `status` ignores a JSON body (P2, not fixed); event body stream-capped (fixed). |
| 27 | Riya / Vobiz | Gemini Live bridge, ASR, barge-in | Python bridge | `sahayakai-agents/.../telephony` | signed link | Vobiz, Vertex | Python suite (941 passed) | PASS (mocked) / BLOCKED (real) | Real calls blocked by rule. |
| 28 | Sampark voice | Twilio-style IVR (answer/gather/status/clip) | Signed per-domain tokens; clip key regex | `webhooks/sampark-voice/*` | tokens | provider | sampark voice tests | PASS | `gather` burns the token before applying the digit (P2, not fixed). |
| 29 | Billing | Razorpay webhook | HMAC, idempotent, plan bound to amount | `/api/webhooks/razorpay` | HMAC | Razorpay | razorpay-webhook-ledger.test.ts | PASS (fixed: dedupe key, stale claim, bad JSON, body cap) / BLOCKED (real) | Out-of-order downgrade by a late `halted` is still possible (P1, not fixed: needs `created_at` ordering). |
| 30 | Generation | Lesson plan | Generate, validate, save to Library | `/api/ai/lesson-plan`, flow | token + plan quota | Gemini | lesson-plan tests (incl. audit budget) | PASS (tests, mocked model) | R `/lesson-plan` 200. Real generation not run (Vertex ADC). |
| 31 | Generation | Quiz | same | `/api/ai/quiz` | same | Gemini | quiz tests | PASS (mocked) | R |
| 32 | Generation | Worksheet | same | `/api/ai/worksheet` | same | Gemini | worksheet tests | PASS (mocked) | R |
| 33 | Generation | Rubric | same | `/api/ai/rubric` | same | Gemini | rubric tests | PASS (mocked) | R |
| 34 | Generation | Exam paper (+ regenerate one question) | Blueprint, generate, print | `/api/ai/exam-paper`, `/regenerate` | token (regenerate: no limiter) | Gemini | exam-paper tests | PASS (mocked) / FAIL (P2, regenerate unbounded) | R `/exam-paper` 200. |
| 35 | Generation | Visual aid, field trip, teacher training (coach), parent message, instant answer, video storyteller, avatar | per flow | `/api/ai/*` | token + quota | Gemini / Imagen | per-flow dispatch tests | PASS (mocked) | R |
| 36 | Generation | Assessment scanner / assess assignment | Upload pages (≤ 15), grade | `/api/ai/assessment-scanner` | owner | Gemini | scanner tests | PASS (mocked) | R |
| 37 | Generation | Shared rate limiter | 15 per 10 min per teacher | `checkServerRateLimit` | — | Firestore | server-safety.test.ts | PASS (fixed: now atomic) | Still fails open on a Firestore error (documented decision). |
| 38 | Library | Save → Stop → Start → Library | Saved items survive restarts (`--persist`) | `/api/content/*`, Storage emulator | owner | Storage | content-routes tests | PASS (tests) / NOT TESTED (restart cycle) | Restart cycle not repeated in this run. |
| 39 | Library | Download / export ZIP | Only the owner's files | `/api/content/download`, `/api/export` | owner | Storage | content-storage-path-ownership.test.ts | PASS (fixed, P0) | Any user could sign or export any bucket object through a forged `storagePath`. |
| 40 | Library | Export HTML/CSV escaping | No markup or formula injection | `data-export-service.ts` | owner / school admin | — | data-export-escaping.test.ts | PASS (fixed) | |
| 41 | Storage | Cleanup job | Only the configured Pub/Sub SA or CRON_SECRET | `/api/jobs/storage-cleanup` | OIDC + allow-list | Pub/Sub | jobs-storage-cleanup.test.ts | PASS (fixed, P0) | Any Google-signed token could delete files. **Deploy prerequisite:** `PUBSUB_PUSH_SERVICE_ACCOUNTS`. |
| 42 | Jobs | Other cron jobs (13 routes) | Shared-secret bearer, fail closed | `/api/jobs/*` | `CRON_SECRET` / `AI_INTERNAL_SECRET` | Scheduler | job tests | PASS | Some compare with `!==`, not constant-time (P3). |
| 43 | Community | Feed, posts, likes, follows | | `/api/community/*`, `/api/groups/*` | token, membership | — | community / groups tests | PASS | R `/community` 200 (also L). |
| 44 | Community | Group post links | https only | groups posts route + feed-post | member | — | safe-links.test.ts | PASS (fixed) | `javascript:` links were storable and clickable. |
| 45 | Community | Messages / DMs | Participants only; no impersonation | rules + `/api/messages/*` | participant | — | F (18/18) + messages tests | PASS (fixed, P1) | Clients could flip a DM to group (block bypass), add outsiders, rename members, plant conversations, post as anyone. Rules are now server-write-only. |
| 46 | Community | DM shared resource open | In-app route only | message-bubble.tsx, `server/messages.ts` | — | — | safe-links.test.ts | PASS (fixed) | Open redirect via `route: "/evil.example"`. |
| 47 | Community | Typing indicator privacy | Participants only | rules | participant | — | F | PASS (fixed) | |
| 48 | Community | Floating panel animation / auto-scroll | Stick to the bottom unless the reader scrolled up | chat-autoscroll | — | — | chat-autoscroll.test.ts | PASS (logic) / NOT TESTED (visual) | No visual regression run. |
| 49 | Onboarding | ERP / CSV import | Validate, quarantine, no corruption | `lib/sampark/crm/*` | org admin | CRM REST (SSRF-guarded) | import.test.ts, csv.test.ts | PASS (fixed: ids with `/`) | |
| 50 | Onboarding | Partial CSV deactivates the rest | A class-only file must not deactivate the school | `import.ts` absence tombstoning | admin | — | — | FAIL (not fixed, P2) | Needs a "full roster" confirmation plus a deactivation-ratio cap (product decision). |
| 51 | Onboarding | Import partial failure | All-or-nothing, or idempotent re-run | 400-op batches | — | Firestore | — | FAIL (not fixed, P2) | Earlier batches stay written; the run is reported `failed`. A re-run is idempotent for upserts. |
| 52 | Platform | Authentication (Firebase token, dev bypass) | Dev login only in development | `src/middleware.ts` | — | Firebase Auth | auth/middleware tests | PASS | S: header stripping and dev-only bypass confirmed; L dev login works. |
| 53 | Platform | Route inventory (80 pages) | Pages load or redirect correctly | `src/app/**/page.tsx` | per page | — | R | PASS | 80/80: 46 × 200, 34 × 307; Sampark pages 12/12 × 200 with provider cookie. |
| 54 | Platform | Firestore rules (rest of the file) | Least privilege | `firestore.rules` | — | — | F covers messaging only | PASS (messaging) / NOT TESTED (other collections, behaviourally) | Other collections reviewed statically. |
| 55 | Platform | Storage rules | Owner-only writes, MIME and size caps | `storage.rules` | — | — | — | PASS (static) | S |
| 56 | Platform | Security headers / CSP | Enforced CSP | middleware | — | — | — | FAIL (config) | CSP is report-only unless `CSP_ENFORCED=true`; not set in any deploy config. |
| 57 | Platform | Webhook body bounds | Bounded memory | `read-body-capped.ts` | — | — | read-body-capped.test.ts | PASS (fixed for the 3 raw-body webhooks) | Form-encoded callbacks (Twilio/Vobiz) still parse unbounded `formData()` (P2). |
| 58 | Platform | Sidebar, command palette, design system, localization | | components | — | — | component tests in J | PASS (unit) / NOT TESTED (visual, 11 languages) | |
| 59 | Platform | Responsive / mobile, keyboard a11y | | — | — | — | — | NOT TESTED | |
| 60 | Platform | Demo launcher start/stop | Starts the stack; Stop stops only its own processes | `Start/Stop-Sahayak-Demo.cmd` | — | — | — | PASS (start, L) / FAIL (P3) | Stop kills PIDs from a stale `realcall-pids.json` without checking the process (could hit a reused PID). Not fixed. |
| 61 | Platform | Health check | 200 in deployment, 503 locally | `/api/health` | public | — | health tests | PASS (local 503 by design) | |
| 62 | Platform | Production build | `next build` succeeds | — | — | — | use-search-params-suspense-gate.test.ts | PASS (fixed, P1) | develop's build failed on `/sampark/workspace` (missing Suspense); this branch builds (exit 0, 165/165). |
| 63 | Deployment | Riya staging on Cloud Run | | `cloudbuild-riya-staging.yaml` | — | GCP | — | BLOCKED | Needs an authorised deploy (not done). |
| 64 | Demo | Public "Hear the call" | Turnstile + gates; first terminal status wins | `/api/demo-call/*` | Turnstile | Twilio | demo-call-status-terminal.test.ts | PASS (fixed) / BLOCKED (real) | |

## Counts

These are the counts for the 64 rows above. Rows with a split status are counted by their weakest real-world part.

| Status | Count |
|---|---|
| PASS (incl. "PASS (mocked)" and "PASS (fixed)") | 41 |
| FAIL (confirmed, not fixed) | 9 (#14, 23, 34-regenerate, 50, 51, 56, 60, plus partial issues in #26 and #29) |
| BLOCKED (external, hardware, deployment) | 10 (#1, 5, 20, 24, 25, 26, 27, 29, 63, 64 for their real-provider part) |
| NOT TESTED | 5 (#4, 48-visual, 58-visual, 59, 38-restart) |

"PASS (mocked)" means the logic is verified with mocked providers. The real-provider half of the same row is listed as BLOCKED.
