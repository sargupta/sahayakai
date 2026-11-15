# SahayakAI production-readiness audit

- **Date:** 2026-11-15
- **Repository:** `sargupta/sahayakai`, app in `sahayakai-main/`
- **Baseline:** `origin/develop` = `9245a62a0aaf0ee84b1d7c6bb8bd743b0412724c` (merge of PR #173). I fetched on 2026-11-15 and develop had not advanced.
- **Branch:** `hardening/production-readiness-2026-11-15` (local only; not pushed). Worktree `E:\sargvision\production-readiness-wt`.
- **Live DEV for manual testing:** `E:\sargvision\develop-live-20261115` (detached at 9245a62a, unmodified), on http://localhost:3000.

## 1. Executive summary

PR #173 left develop in good functional shape, **except that `next build` fails on develop** (F19, fixed here). The full suite passes once a Windows line-ending test bug is fixed, and every page loads or redirects as designed. Tenant isolation across the Sampark APIs is solid.

The security review still found **two P0 data issues and several P1 issues**. I fixed all of them on the hardening branch, each with a regression test.

| Severity | Fixed | Remaining |
|---|---|---|
| P0 | 2: arbitrary bucket-object read through content `storagePath`; storage-cleanup accepting any Google-signed token | 0 |
| P1 | 4: repeat-dial of a parent, messaging rules (block bypass, membership tampering, impersonation), anonymous VIDYA limiter bypass, ERP ids with `/` | 3: teacher-entered destination numbers, Razorpay out-of-order downgrade, intent route without per-user limiter (bounded only) |
| P2 | 9 | 9 (listed in §5) |

**Not production-ready yet.** No deployment of this branch exists, and the provider webhooks have never been called by the real providers. Real-microphone VIDYA was not verified, and no real call was placed (by rule). See §7 and `DEPLOYMENT_READINESS.md`.

## 2. Architecture and inventory (discovered, not assumed)

| Layer | Count / location |
|---|---|
| Pages | 80 `page.tsx` under `src/app` (16 with dynamic segments) |
| API routes | 222 `route.ts` under `src/app/api` |
| Cron / jobs | 13 under `/api/jobs/*` (Cloud Scheduler, shared bearer secret) |
| Webhooks | ElevenLabs Riya, Vobiz Riya (answer/status/context/event), Sampark voice (answer/gather/status/clip), Razorpay, Twilio (attendance twiml/status, demo call) |
| Data | Firestore (default + named `sampark-nonprod`); Storage bucket; rules in `firestore.rules` and `storage.rules` |
| AI | Genkit flows on Vertex Gemini (`src/ai/flows/*`); VIDYA live voice through the Python sidecar (`sahayakai-agents`, Google ADK + Gemini Live) |
| Telephony | ElevenLabs (unified SARGVISION agent), Vobiz + SahayakAI Gemini Live bridge, Twilio / Exotel (attendance) |
| Tests | 428 Jest suites; Python suite in `sahayakai-agents/tests` |

The per-feature matrix is in `FEATURE_VERIFICATION_MATRIX.md` (64 rows).

## 3. Security review

Method: four independent read-only reviews, each scoped to one area:

1. Sampark/attendance/org authorization
2. Webhooks
3. AI endpoints, batch calling and cron
4. Rules, uploads, imports and community

I re-read every finding in the code before acting on it. Then I fixed what was confirmed and added a test that fails on the old code where I could show that, for example the rules check: 9/18 on the old rules, 18/18 on the new.

| Topic | Result |
|---|---|
| Authentication / session | OK. The middleware strips client `x-user-*` headers and sets them only after RS256 verification. The dev bypass only runs when `NODE_ENV==='development'`. |
| RBAC and tenant isolation (Sampark) | OK. `guardOrgRoute` / `requireOrgAdmin` use server-managed membership. Every id is resolved under `sampark_schools/{orgId}`. |
| IDOR | **P0 fixed:** `storagePath` (see §4). No IDOR in the Sampark or org routes. |
| Firestore rules | **P1 fixed:** conversations, messages, community chat, group chat and typing status. The rest was reviewed statically. |
| Storage rules | OK (owner writes, MIME and size caps, no SVG; DM audio only through signed URLs). |
| Input validation | Improved: intent prompt bound, ERP doc ids, https-only links, route slugs. |
| Output encoding / XSS | `dangerouslySetInnerHTML` uses are all static or escaped. **Fixed:** export HTML escaping, CSV formula injection, `javascript:` links. |
| CSRF | APIs use a bearer token or `auth-token` cookie with JSON bodies. Not deeply tested; SameSite settings for the cookie path were not audited. |
| CORS | No `Access-Control-Allow-Origin` anywhere in `src` or the deploy configs. |
| SSRF | CRM REST source: https only, IP checks, no redirects. A DNS-rebinding window is documented in the code. |
| Path traversal | Clip/audio keys use a regex; media signing checks traversal; the new `isOwnedStoragePath` covers content. |
| Uploads | Size and MIME caps in the rules; scanner limited to 15 pages. |
| Secrets | No secret is committed in tracked files on this branch (diff scanned). `.env.development.local` is gitignored and holds a local signing key; it must not be the production key. The Dockerfile hardcodes a default VAPID **public** key (public by design). |
| Error leakage | **Fixed:** TTS and assistant 500s no longer echo internal error text. |
| Logs | Phone numbers are encrypted or hashed in Sampark. Logs were not exhaustively reviewed. |
| Webhook auth | Raw-body HMAC, length-checked constant-time compare, and time windows on ElevenLabs and bridge events. **Fixed:** body size bounded by streaming; Razorpay dedupe. |
| Rate limiting | **Fixed:** anonymous voice limiter bypass, and limiter atomicity. Remaining: intent per-user limit; exam-paper regenerate. |
| AI cost abuse | Plan quotas use atomic reserve/rollback. Gaps are noted in §5. |
| Unbounded batch jobs | Batch is capped (100 recipients, 3 lines, 60 s gap) and leased. Duplicate-campaign race remains (§5). |
| Dependencies | `npm audit` was not run against the network in this session; there were no dependency changes on this branch. |
| Env separation | Staging uses the `sampark-nonprod` database. Live dial and real batch are off by default. `CSP_ENFORCED` is unset everywhere (§5). |

## 4. Fixed defects (all on `hardening/production-readiness-2026-11-15`)

| # | Sev | Defect | Root cause | Fix | Regression test |
|---|---|---|---|---|---|
| F1 | P0 | Any signed-in user could read any Storage object | `/api/content/save` stored a client `storagePath`; download signed it, export fetched it | `isOwnedStoragePath()` (`users/<uid>/…` only): dropped at save, refused at download and export | `api/content-storage-path-ownership.test.ts` |
| F2 | P0 | Anyone with any GCP service account could delete user files | storage-cleanup accepted any Google-signed ID token; the allow-list was optional and skipped tokens with no email | Allow-list now required, `email_verified` required, fails closed | `api/jobs-storage-cleanup.test.ts` (+4 cases) |
| F3 | P1 | One outreach could ring a parent repeatedly | No "already dialled" check in `/api/attendance/call` | Transactional single-dial claim before any provider is contacted (409 `ALREADY_DIALLED`) | `api/attendance-call-single-dial.test.ts` (all 3 providers) |
| F4 | P1 | Messaging: block bypass, adding outsiders, renaming members, planted conversations, impersonation in DMs/community/group chat, typing-status privacy | Client create/update allowed in rules; no client actually uses them | Server-write-only rules; typing status participant-only | `scripts/qa/verify-firestore-rules.mjs` (emulator, 18/18; old rules 9/18) |
| F5 | P1 | Anonymous VIDYA live-voice sessions were unlimited | Limiter keyed on the client-controlled first XFF entry; `map.clear()` | Last XFF entry (`lib/net/client-address.ts`); evict only expired windows | `api/vidya-voice-public-session-limit.test.ts` |
| F6 | P1 | ERP ids such as `ADM/2023/001` corrupted or failed imports | Ids used as Firestore doc ids without a check | `crmDocId` schema rejects `/`, `.`, `..`, `__x__` (rows quarantined) | `sampark/server/import.test.ts` |
| F7 | P2 | A late `failed` Riya post_call downgraded a completed call and wiped its transcript | No terminal guard in the post_call reducer | Same terminal rule as initiation_failure | `sampark/conversation/riya-provider.test.ts` |
| F8 | P2 | Razorpay: a second pause/halt was dropped; a dead worker's `processing` claim swallowed retries; bad JSON gave 500 | Event-type key collisions; no stale takeover; unguarded parse | Key on `x-razorpay-event-id`; 5-min stale takeover; 400 on bad JSON; 256 KB cap | `api/billing/razorpay-webhook-ledger.test.ts` (+5) |
| F9 | P2 | Public webhooks buffered unbounded chunked bodies | Content-length check, then `req.text()` | `readBodyCapped()` (stream cap) in ElevenLabs, bridge event, Razorpay | `lib/read-body-capped.test.ts` |
| F10 | P2 | Shared AI rate limiter did not hold under parallel requests | `get()` then `set()` outside a transaction | `runTransaction` | `lib/server-safety.test.ts` |
| F11 | P2 | `javascript:` links in group posts; open redirect via DM resource route | No scheme or slug check | `isSafeHttpsUrl` / `isSafeAppRouteSlug` in API and renderers | `lib/safe-links.test.ts` |
| F12 | P2 | Export HTML/CSV injection (school export packs other teachers' content) | Raw interpolation; no formula neutralising | `h()` and `csvCell()` plus a static gate on the builders | `lib/data-export-escaping.test.ts` |
| F13 | P2 | `/api/ai/intent` accepted unbounded prompts | No bound | 400 / 413 above 4,000 characters, before the model call | `api/ai-intent-app-help.test.ts` (+3) |
| F14 | P2 | TTS / assistant 500 echoed internal error text | `error.message` returned | Generic messages | existing tests |
| F15 | P2 | `/api/ai/quiz/health` always 401 (admin diagnostic broken) | Listed public, so token never verified | Removed from the public list | middleware tests |
| F16 | P2 | demo-call: a late `canceled` overwrote `completed` | Guard only covered non-final statuses | First terminal status wins | `api/demo-call-status-terminal.test.ts` |
| F17 | P2 | VIDYA could spin on "Connecting…" forever | No timeout before the socket opens | 20 s watchdog after mic grant, then retry copy | `lib/vidya-live/live-session-connect-watchdog.test.ts` |
| F19 | **P1** | `next build` failed on develop, so it could not be deployed | `ProviderSwitchPill` (in SamparkFrame/DemoFrame) calls `useSearchParams()` with no Suspense boundary, so `/sampark/workspace` cannot prerender | Pill renders its own `<Suspense>` | `components/use-search-params-suspense-gate.test.ts` (any component calling useSearchParams must render Suspense) + the build itself |
| F18 | env | `lesson-plan-audit-budget` test failed on Windows | Test searched for `\n`; `core.autocrlf` checks out CRLF | Normalise line endings in the test | itself |

## 5. Remaining defects (not fixed; reasons given)

| # | Sev | Defect | Why not fixed here | Recommended fix |
|---|---|---|---|---|
| R1 | P1 | A premium teacher can add a "student" with any phone number and a custom spoken script, and the platform calls it | Product decision (teachers legitimately type numbers and edit messages) | `CALL_ALLOWED_DESTINATIONS` in non-production; per-teacher daily call cap; server-generated scripts only; re-check plan in the call route |
| R2 | P1 | Razorpay out-of-order: a retried `halted` after a later `charged` downgrades a paying user | Needs event `created_at` ordering stored per subscription (billing logic change) | Store `lastEventCreatedAt`, skip older events in the same transaction, or re-fetch status from Razorpay before downgrading |
| R3 | P1→P2 | `/api/ai/intent` has no per-user limiter (the prompt is now bounded) | Every VIDYA command goes through it; the shared 15/10-min limiter would break normal use | A dedicated, higher limit (for example 120/10 min) |
| R4 | P2 | Exam-paper single-question regenerate is unbounded | Same limiter trade-off | Rate-limit plus zod `.max()` |
| R5 | P2 | Batch duplicate-campaign race | Needs a new lock collection and cancel cleanup | Transactional `sampark_batch_dedupe/{key}` |
| R6 | P2 | A partial CSV deactivates the rest of the school; import partial failure | Product decision on "full roster" semantics | Explicit full-roster confirmation plus a deactivation-ratio cap |
| R7 | P2 | Vobiz-riya `status` ignores JSON bodies; sampark-voice `gather` burns the token before applying the digit; Twilio/Vobiz status routes return 200 on a failed write | Provider-contract changes that should be checked against the real provider | As described by the webhook review (reuse `readVoiceFields`; single transaction; 5xx on storage failure) |
| R8 | P2 | CSP not enforced in any deploy config | Deploy-config change (not code) | `CSP_ENFORCED=true` after a report-only soak |
| R9 | P2 | Rate limiter fails open on a Firestore error | Deliberate availability choice in the code | Keep, but alert on `[Rate Limit] Check failed` |
| R10 | P3 | `Stop-Sahayak-Demo.cmd` kills PIDs from a stale `realcall-pids.json` without checking them | Low risk, local only | Check process name and start time before stopping |
| R11 | P3 | Some cron routes compare secrets with `!==` | Low risk | `timingSafeEqual` |
| R12 | P2 | `/api/attendance/call-context` and `/transcript-sync` are not on the middleware public list but authenticate with `X-Internal-Key` | Needs confirmation of how the pipeline calls them | Confirm; add to the public list if the pipeline sends no Firebase token |

## 6. Test commands and actual results

All commands run in `E:\sargvision\production-readiness-wt\sahayakai-main` unless noted. Node 24.20.0 (package.json asks for 20; known to work).

| Check | Command | Result |
|---|---|---|
| TypeScript | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | **PASS** (exit 0) |
| ESLint (changed files) | `node node_modules/eslint/bin/eslint.js <42 changed files>` | **0 errors**, 4 pre-existing warnings (design-token / unused-disable) |
| Jest baseline (before most fixes) | `node node_modules/jest/bin/jest.js --coverage=false --silent --maxWorkers=3` | 5,782 passed, **1 failed** (Windows CRLF test bug, F18), 30 skipped |
| Jest after fixes | same | **5,864 passed, 0 failed, 30 skipped** (426 suites passed, 2 skipped) |
| Firestore rules | `node scripts/qa/verify-firestore-rules.mjs --host 127.0.0.1:8180 --project demo-rules-check` (isolated emulator) | **18/18**; same script on the develop rules: 9/18 |
| Route smoke | `node scripts/qa/route-smoke.mjs --base http://localhost:3100` (isolated instance, own emulators 8280/9299) | **80/80 OK**: 46 × 200, 34 × 307 (auth/role/provider redirects), 0 failing. Rerun of the 12 Sampark workspace/demo pages with the provider cookie (`sampark_provider=elevenlabs`): **12/12 × 200** |
| Python (agents) | `pytest tests -q -x -k "telephony or riya or vobiz or sampark or voice"` | **941 passed**, 0 failed, 915 deselected by the `-k` filter (523 s). The full agents suite was not run. |
| Production build | `NODE_OPTIONS=--no-experimental-strip-types next build` | **develop: FAILS** (`useSearchParams() should be wrapped in a suspense boundary at page "/sampark/workspace"`, build worker exit 1). **This branch: PASS** (exit 0, 165/165 static pages) after F19 |

Browser (built-in, :3100): VIDYA orb tap → friendly mic-denied copy → second tap in the **same document** creates a **new session object** (recovery without refresh verified). The success path needs a real microphone.

Skipped tests are not counted as passed. Environment limits:

- No real microphone (the built-in browser blocks it).
- No real Vertex generation in tests (mocked).
- No real calls, by rule.
- No public endpoints.

## 7. Risks and recommendations

1. Deploy `firestore.rules` together with this code. The rule changes break no current client, since no client writes those collections. A client from an older branch that writes them directly would break; none was found.
2. Set `PUBSUB_PUSH_SERVICE_ACCOUNTS` before relying on Pub/Sub-pushed storage cleanup. Without it the OIDC path is now refused (fail closed).
3. Decide R1 (teacher-entered numbers) before enabling attendance calls beyond pilots.
4. Run a person-in-the-loop check of VIDYA voice in Chrome (mic, barge-in, reconnect, tab close).
5. Do one authorised staging deploy, then one webhook round-trip from ElevenLabs to the deployed URL, before calling Riya "operational".
6. Turn on `CSP_ENFORCED` after a report-only soak.

## 8. Follow-up changes (2026-11-15 evening, founder requests)

| Commit | Change | Verification |
|---|---|---|
| 2e4eaa99 | VIDYA start latency: stream token minted in parallel with mic/audio setup; one shared ADC credentials object for every Live session (was ~1.65 s per tap); sidecar warms ADK imports + credentials at boot (~2.4 s cold). VIDYA introduces herself as "I'm VIDYA", never "voice assistant". | 62 VIDYA Jest tests; 356 Python VIDYA tests; warm-up confirmed in the sidecar log (`vidya_voice.warm_up_done credentials=True`). Real-microphone timing not measured. |
| 035524bb, 4f58968a | Sidebar: no "Start here!" spotlight, no "New" badge (class gate `sidebar-no-feature-highlights.test.ts`). Big VIDYA sphere 26% of stage (was 30%): 162 → 140 px on the landing hero; floating mic orb unchanged at 64 px. | Measured in the browser on :3000. |
| 419ef124 | `Start-Sahayak-Demo.cmd` starts real calls (ElevenLabs + Vobiz, Sargvision roster only) whenever the credential files exist; `SAHAYAK_PRACTICE_ONLY=1` forces Practice. | Both providers report `available: true`; no-dial preflight passes for both up to calling hours. |
| ac42c581 | `SAMPARK_SARGVISION_ANYTIME_CALLS` (set by that launcher): Sargvision TEST class callable on Sundays/off-days and after hours, local roster mode only, allow-listed numbers only. | `sargvision-roster.test.ts` (Sunday 23:30 IST allowed + dialled once; refused without the flag, in production, other school, Practice, non-allow-listed number). |

After these: full Jest **5,871 passed, 0 failed, 30 skipped**; `tsc` clean; `next build` exit 0 (165/165).
