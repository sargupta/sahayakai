# CODEX HANDOFF — Sahayak Parent Calling MCP

All paths are relative to `E:\sargvision\sahayakai\sahayakai-main`.

- Git root: `E:\sargvision\sahayakai`
- Branch: `feat/calling-mcp`, created from `feat/mcp-lesson-planner-demo` @ `1798329e`
- Checkpoint commits: `f29e4454` (calling MCP + audit), then the demo UI commit (see §22)
- Nothing has been pushed. There is no PR and nothing is deployed.

Full audit of the existing feature: `docs/mcp/calling/CODEX_CALLING_AUDIT.md`.

## 1. Existing calling UI
- `src/app/attendance/[classId]/page.tsx`: the **Contact** button on each student row (`t("Contact")`, ~l.373) calls `openContact(student, reason)`.
- `src/components/attendance/contact-parent-modal.tsx`: `ContactParentModal`.

## 2. Contact handler
The modal's `handleCall()` (~l.425) runs these steps:
1. `generateMessage()` → `POST /api/ai/parent-message` (run earlier, at the "review" step).
2. `saveOutreach('twilio_call')` → `POST /api/attendance/outreach`.
3. `POST /api/attendance/call {outreachId, parentLanguage}`.
4. `pollForSummary(outreachId)` → `GET /api/attendance/call-summary`.

## 3. Routes
- `src/app/api/ai/parent-message/route.ts`: `POST` = `withPlanCheck('parent-message')(_handler)`.
- `src/app/api/attendance/outreach/route.ts`: `POST`.
- `src/app/api/attendance/call/route.ts`: `POST`, using `resolveOutreachTarget`, `forwardToVobiz`, `forwardToExotel` and the inline Twilio path.

## 4. Services
- `dispatchParentMessage` (`src/lib/sidecar/parent-message-dispatch.ts`)
- `checkCallingWindow` (`src/lib/calling-hours.ts`)
- `classifyTwilioFailure` / `releasesDedupWindow` (`src/lib/twilio-errors.ts`)
- `placeVobizCall` (`src/lib/vobiz/client.ts`), `mintVobizToken` (`src/lib/vobiz/tokens.ts`)
- `getEffectiveMode` (`src/lib/voice-pipeline/health.ts`)
- `toRosterStudent` (`src/server/attendance.ts`, masked roster)

## 5. Provider
`VOICE_PROVIDER` selects the provider: `twilio` (default, Twilio REST `Calls.json`), `vobiz`, or `exotel` (forwards to `VOICE_EXOTEL_CALL_URL`). Test override numbers: `TWILIO_TEST_OVERRIDE_NUMBER`, `VOBIZ_TEST_OVERRIDE_NUMBER`.

## 6. Existing input
- parent-message: `{studentName, className, subject, reason, teacherNote?, parentLanguage, consecutiveAbsentDays?, performanceContext?}`
- outreach: `{classId, className, studentId, studentName, parentLanguage, reason, teacherNote?, generatedMessage, spokenScript?, deliveryMethod, performanceContext?, subject?}`. `parentPhone` is **ignored**.
- call: `{outreachId, parentLanguage}`
- `reason` is one of `consecutive_absences | poor_performance | behavioral_concern | positive_feedback`.

## 7. Existing output and status
- parent-message → `{message, spokenScript, languageCode, wordCount}`
- outreach → `{outreachId}`, or 400, 403 `PREMIUM_REQUIRED` / Forbidden, 404, 422 (no phone), 429 `{retryAfterSeconds}` (5-minute dedup)
- call → `{callSid}`, or:
  - 401 or 400 for a bad request;
  - 409 `{code: 'OUTSIDE_CALLING_HOURS', nextAllowedAt}`;
  - 404, 403 or 422 when the outreach target fails its checks;
  - 503 when the provider is not configured;
  - 502 for a transient provider failure;
  - 422 `PARENT_NUMBER_UNREACHABLE`.

## 8. Authorization
- **App:** Firebase token → middleware `x-user-id`. The class and the outreach record must be owned by that teacher, and the teacher needs an advanced plan. The phone always comes from Firestore.
- **MCP** (new, in `src/lib/mcp/calling/service.ts` → `authorizeClass`):
  1. The API key determines the org.
  2. `classes/{class_id}.teacherUid` must exist in `organizations/{orgId}/members/{teacherUid}`.
  3. The existing routes then run with `x-user-id = teacherUid` and `x-user-plan = users/{teacherUid}.planType`.
  4. Failures return the same `not_found` message whether the class is missing or belongs to another org, so ids cannot be probed.
  5. There is no client-supplied teacher, org or phone.

## 9. Side effects of `initiate_parent_call`
1. A model call, which consumes the teacher's `parent-message` quota.
2. A `parent_outreach/{id}` document owned by the class teacher. It appears in that teacher's outreach history.
3. **A real phone call** through the configured provider.
4. Status, transcript and summary written by the provider webhooks.

`list_parent_contacts` is read-only.

## 10. MCP files
- `src/lib/mcp/calling/schema.ts`: `ListParentContactsInput`, `ParentContactsResult`, `InitiateParentCallInput`, `ParentCallResult`.
- `src/lib/mcp/calling/service.ts`: `authorizeClass`, `listParentContacts`, `initiateParentCall`, `routeError`.
- `src/lib/mcp/calling/capability.ts`: `callingCapability`.
- `src/app/api/mcp/calling/route.ts`: wires in the real routes, `checkCallingWindow` and `callbackBaseUrl()`.
- Changed: `src/lib/mcp/api-keys.ts` (`MCP_SCOPES` now includes `calling`) and `src/lib/mcp/errors.ts` (adds `not_found` and `outside_allowed_hours`).
- Tests: `src/__tests__/lib/mcp/calling-mcp.test.ts`.

## 11. Demo UI files (route `/mcp-demo/calling`)
- `src/app/mcp-demo/calling/page.tsx`: the page.
- `src/features/mcp-demo/calling/use-mcp-calling.ts`: the hook. It only calls `/api/mcp-demo/calling`.
- `src/features/mcp-demo/calling/mcp-calling-view.tsx`: the view. It reuses the attendance "Parent Outreach" row markup and the `ContactParentModal` reason cards, labels and icons. It also reuses `McpStatusBadge` from `src/features/mcp-demo/lesson-planner/mcp-status-badge.tsx`.
- `src/app/api/mcp-demo/calling/route.ts`: the server route. It requires `x-user-id`.
  - `GET` returns the MCP status.
  - `POST {action:'list'}` maps to `list_parent_contacts`.
  - `POST {action:'call', class_id, student_id, reason, teacher_note?, subject?}` maps to `initiate_parent_call`.
- `src/lib/mcp-demo/calling-client.ts`: the server-only official MCP SDK client (`getCallingDemoConfig`, `getCallingStatus`, `listContactsViaMcp`, `initiateCallViaMcp`).
- 12 UI strings were added to all 10 `src/locales/*.json`.
- Tests: `src/__tests__/lib/mcp-demo/calling-demo-route.test.ts` and `src/__tests__/app/mcp-demo-calling.test.tsx`. `src/__tests__/lib/mcp-demo/no-client-secrets.test.ts` also scans the calling UI.

Architecture:
```
browser /mcp-demo/calling → POST /api/mcp-demo/calling (Firebase session)
  → calling-client.ts (MCP SDK, server-held key) → POST /api/mcp/calling (key auth, scope, rate limit)
  → initiate_parent_call → service.ts → existing /api/ai/parent-message → /api/attendance/outreach → /api/attendance/call → provider
```

## 12–14. Endpoint, tools, scope
- Endpoint: `POST /api/mcp/calling` (Streamable HTTP, stateless).
- Tools: `list_parent_contacts`, `initiate_parent_call`.
- Scope: `calling`.

## 15. Environment
| Variable | Purpose |
|---|---|
| `MCP_API_KEY_PEPPER` | Shared MCP key pepper (already used by the other MCPs) |
| `MCP_CALLING_CALLBACK_BASE_URL` | Public https base URL for provider callbacks. **Required outside `next dev`**; without it calls return `not_configured`. Under `next dev` it defaults to `http://localhost:$PORT`. |
| `VOICE_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `VOBIZ_*`, `VOICE_EXOTEL_CALL_URL` | The existing provider configuration |
| `TWILIO_TEST_OVERRIDE_NUMBER` / `VOBIZ_TEST_OVERRIDE_NUMBER` | Send every call to one test phone |
| `MCP_DEMO_API_KEY` (and `MCP_CALLING_DEMO_API_KEY` if added) | Demo UI server-side key |

## 16. Test commands
```bash
node node_modules/jest/bin/jest.js src/__tests__/lib/mcp/calling-mcp.test.ts src/__tests__/api/attendance-call.test.ts src/__tests__/api/attendance-outreach.test.ts src/__tests__/lib/parent-message-dispatch.test.ts --coverage=false
```
```bash
node node_modules/typescript/bin/tsc --noEmit -p .
```
```bash
node node_modules/eslint/bin/eslint.js src/lib/mcp src/app/api/mcp
```

## 17. Safe live-test procedure
1. Leave `TWILIO_*` / `VOBIZ_*` unset (as in the current `.env.local`). Every call then stops at 503, which becomes `not_configured`, and **nothing can dial**.
2. To hear a real call, set `TWILIO_TEST_OVERRIDE_NUMBER` (or `VOBIZ_TEST_OVERRIDE_NUMBER`) to **your own** phone first, then the provider credentials. Use only 09:00–21:00 IST.
3. You need an org key with scope `calling`:
   ```bash
   npx tsx scripts/mcp/create-api-key.ts --org <orgId> --scope calling --label "calling test"
   ```
   It is a dry run unless you add `--apply`. The org must contain the class teacher as a member.

The local dev key's org is `local-dev-org`, which has no members, so locally every class is `not_found`. This is by design.

## 18. Live-tested
These were run on 2026-10-07 against the local `next dev` server on port 3000, using the dev key from `.env.local` (org `local-dev-org`, no telephony credentials):
- `/mcp-demo/calling` renders in the app shell. The status pill reads "Sahayak MCP · Connected · Tool: initiate_parent_call · Streamable HTTP", from a real `initialize` and `tools/list`.
- A live `list_parent_contacts` call went through MCP and returned `{classes: []}`, because the dev org has no members. The empty state renders.
- A live `initiate_parent_call` for an unknown class went through the BFF and MCP and returned 404 `not_found`. No record was written and nothing was dialled.
- Through the BFF, `phone_number`, `org_id`, a path-traversal `class_id`, a bad `reason` and an unknown action were all rejected with 400.
- `POST /api/mcp/calling` without a key returned 401.

## 19. Mocked / not executed
- In `calling-mcp.test.ts`, the route handlers, ownership, dedup, quiet-hours and provider-classification logic are **real**.
- Mocked there: Firestore (in-memory), `dispatchParentMessage`, `withPlanCheck` (pass-through), `checkCallingWindow` (controllable), `getEffectiveMode`, and the Twilio HTTP request (`global.fetch`).
- **No real phone call has been placed.**

- Not executed anywhere: a real provider dial, a successful end-to-end call on real Firestore data (it needs an org key whose org contains the class teacher), and `next build`.

## 20. TODOs (in order)
1. **Production build.** Not run on this branch:
   ```bash
   node --max-old-space-size=3072 node_modules/next/dist/bin/next build
   ```
   Stop `next dev` first, because both share `.next`.
2. **End-to-end call on real data.** Pick a real org and class, ensure the class teacher is in `organizations/{orgId}/members`, and issue a `calling` key with `scripts/mcp/create-api-key.ts --apply` (with approval). Set it as `MCP_CALLING_DEMO_API_KEY`. Set `TWILIO_TEST_OVERRIDE_NUMBER` to your own phone and add the Twilio credentials. Then use `/mcp-demo/calling` between 09:00 and 21:00 IST.
3. **Side-by-side screenshot.** Left: `/attendance/<classId>` with the Contact modal. Right: `/mcp-demo/calling` with the Contact dialog. Use the same class and student.
4. **Optional review step.** The MCP tool writes the message and dials in one call; the app shows a "review" step first. Adding a read-only `preview_parent_message` tool would make the two flows identical.
5. **Optional call-status tool.** Add one backed by `/api/attendance/call-summary`, keyed by an opaque reference rather than the Firestore id.
6. **Production config.** Set `MCP_CALLING_CALLBACK_BASE_URL` to the public https host in Cloud Run.
7. **Documentation.** Add `docs/mcp/calling/README.md` (the public docs, in the same style as `docs/mcp/quiz/README.md`), and a `calling` entry in `scripts/mcp/demo.mjs`. The demo entry must only use `list_parent_contacts` unless a test-override number is set.

## 21. Branch
`feat/calling-mcp`

## 22. Status log
- `f29e4454`: calling MCP plus tests. 104/104 pass across the calling MCP suite and the existing call, outreach, parent-message and MCP unit suites. Typecheck and ESLint are clean.
- Next commit (demo UI): `/mcp-demo/calling` plus tests.
  - Combined regression: 27 suites, 360/360 tests pass. It covers all MCP suites (lesson-planner, exam-paper, quiz, calling), the demo UIs, the attendance call/outreach and parent-message suites, the headless gates and the lesson-plan suites.
  - `tsc` and ESLint are clean.
  - The i18n source audit and ratchet are at baseline.
  - The SHA is printed by `git log --oneline -1` on `feat/calling-mcp`.

## 23. Follow-up live dev check — 2026-10-07

- Branch: `feat/calling-mcp`; HEAD: `feaaa74787e840970683adc0d4673048e473f19f`.
- Files read for this follow-up: `docs/mcp/calling/CODEX_CALLING_AUDIT.md`, `docs/mcp/calling/CODEX_HANDOFF.md`, `src/app/attendance/[classId]/page.tsx`, `src/components/attendance/contact-parent-modal.tsx`, `src/app/api/attendance/call/route.ts`, `src/app/api/attendance/outreach/route.ts`, `src/app/api/ai/parent-message/route.ts`, and the Calling MCP service/schema/capability/routes plus the calling demo BFF/client introduced by `f29e4454` and `feaaa747`.
- Demo records created: **none**. The handoff identifies the existing local key's org as `local-dev-org`; that org has no members. No legitimate teacher UID was available to authorize a class, and the local page had no signed-in Sahayak session. No class, student, parent contact, outreach, membership, or API key was written.
- Seed/reset commands: **none**; no seed script was run and there is no data to delete. See `docs/mcp/calling/DEV_DEMO_DATA.md`.
- UI: opened `http://localhost:3000/mcp-demo/calling`. It showed the sign-in button and `Sahayak MCP Connecting… Loading classes…`; it did not show Connected, a class/student, or masked phone details. The authenticated demo BFF could not be exercised from this signed-out page.
- Live MCP check: used the existing `MCP_LOCAL_DEV_API_KEY` with the official MCP SDK against `POST /api/mcp/calling`. `initialize` identified `sahayak-parent-calling` v1.0.0; `tools/list` returned `list_parent_contacts` and `initiate_parent_call`. `list_parent_contacts` returned `{ "classes": [] }`.
- `initiate_parent_call` was invoked with non-existent demo class/student IDs and no phone argument. It returned `not_found` (`No such class or student for this API key.`). The request stopped in class/organisation membership authorization, before `/api/ai/parent-message`, `/api/attendance/outreach`, `/api/attendance/call`, or the provider. No phone call was placed.
- Provider/configuration: `.env.local` has no `VOICE_PROVIDER`, Twilio, Vobiz, or Exotel variables. The existing call route would default to Twilio and return `503 Twilio not configured` if reached, but that provider response was **not observed** because authorization stopped the MCP request first.
- Tests: the live MCP initialize/tools/list and safe unknown-class tool call above were run. The prior handoff reports 360/360 tests, typecheck, ESLint, and i18n passing; these suites were not rerun for this documentation-only follow-up. No commit was created.
- Next step: sign in to the local Sahayak app and provide the Firebase UID of the intended development teacher, whose existing profile must pass the advanced-plan checks. If that teacher is not already in `local-dev-org`, confirm that this dev-only membership may be added. Then seed through a reversible dev-only script and repeat the UI flow. Do not dial until the supplied number is explicitly confirmed as the user's own/test number and expected.

## 24. Restart follow-up — 2026-10-07

- Branch/HEAD remain `feat/calling-mcp` / `feaaa74787e840970683adc0d4673048e473f19f`.
- Port 3000 was free. Started the existing server with
  `node node_modules/next/dist/bin/next dev -p 3000`; Next reported `Ready` at
  `http://localhost:3000` and reported Twilio credentials were unset.
- The in-app browser backend could not connect. The available browser tab was
  at `http://localhost:3000/mcp-demo/calling`, but browser access was rejected
  by its URL policy. No alternate browser surface, API request, or session
  extraction was used to bypass that rejection. The post-restart sign-in state
  and live page could not be verified.
- Teacher UID last verified in the preceding signed-in session:
  `Yt5XFJyz45TVlY7UKyVRgxUe8Tn1`. The profile existed with `planType: premium`
  and passed `hasAdvancedPlan` then; neither identity nor plan was re-read after
  restart. The teacher's actual `organizationId` was not revalidated.
- The local dev key's org is `local-dev-org`. In the previously checked
  Firebase project `sahayakai-b4248`, `organizations/local-dev-org` was absent,
  as was `organizations/local-dev-org/members/{teacherUid}`. No usable class or
  teacher membership exists there. This project is production-linked; no
  membership, org, class, student, contact, API key, or other Firestore write
  was made.
- Existing supported key configuration is documented in
  `src/lib/mcp-demo/calling-client.ts`: prefer `MCP_CALLING_DEMO_API_KEY`, else
  `MCP_LOCAL_DEV_API_KEY` under `next dev`. The existing
  `scripts/mcp/create-api-key.ts --org <existing-org> --scope calling` is
  dry-run by default and requires the organization to exist; `--apply` writes a
  key record. No key was issued or rebound because the expected org is absent
  from the connected project. Do not point this flow at production to create
  dev data or credentials.
- No demo records or outreach were created. No seed or reset command ran. The
  last live `list_parent_contacts` result remains the prior-session
  `{ "classes": [] }`; it was not rerun. The prior safe `initiate_parent_call`
  request with unknown IDs returned `not_found` at MCP class/organization
  authorization. No `initiate_parent_call` was invoked in this restart attempt,
  no provider boundary was reached, and no call was placed.
- Validation this session: the six focused Calling MCP/call/outreach/demo suites
  passed, 76/76 tests; targeted ESLint passed. Full typecheck was not retried
  because the previous typecheck attempt exhausted memory. No commit was made.
- Exact next action: restore permitted browser access to the local page and
  verify the signed-in session. Configure local development to use a confirmed
  non-production Firebase project that already contains the teacher's actual
  org, then use the existing scoped-key configuration and reversible Sahayak
  class/student helpers. Only seed after membership, ownership, and plan checks
  pass. Do not call until the user confirms the intended number is their own/test
  number and they expect exactly one call.

## 25. Authenticated-session continuation — 2026-10-07

- The user confirmed successful sign-in to the local Sahayak app. The current
  UID and organization were not read from that session; the previous-session
  UID was not reused.
- Port 3000 was free at check time. Started
  `node node_modules/next/dist/bin/next dev -p 3000` from
  `E:\sargvision\sahayakai\sahayakai-main`. Next reported
  `Local: http://localhost:3000` and `Ready`.
- The supported browser-use IAB bootstrap again failed because no Codex IAB
  browser backend was available. The page and its login/connected state could
  not be inspected. No alternate browser surface, API call, session extraction,
  or authentication bypass was used.
- No Firebase writes, MCP calls, outreach, or phone calls were made. The most
  recent known key org remains `local-dev-org`; in the previously checked
  production-linked Firebase project `sahayakai-b4248`, that org document was
  absent. No current teacher membership or actual org could be verified.
- No demo class/student/contact IDs exist. The latest known MCP list result is
  still the earlier `{ "classes": [] }`; `initiate_parent_call` was not invoked
  during this continuation.
- Exact next action: restore the Codex IAB browser connection and inspect the
  already-authenticated page to read the current session UID/org. Continue only
  against a confirmed non-production Firebase project; then apply the existing
  org/member and class/student authorization helpers and update
  `DEV_DEMO_DATA.md` with the resulting IDs and reset method.

## 26. Finalization — 2026-10-08

- Shared fix: tool error results no longer put `{ error }` in
  `structuredContent` (the SDK client validated it against the output schema
  and turned every error into `-32602`). The error is in
  `_meta["sahayak/error"]`; the demo client reads it with `toolErrorOf()`.
  Class gate: `src/__tests__/lib/mcp/mcp-error-results.test.ts`.
- `/mcp-demo/calling` waits for the Firebase session before calling its API.
- `npm run mcp:calling:demo` added (read-only: `list_parent_contacts` only).
- Live results and the remaining blocker (no org/class data in a
  non-production project, no provider configured) are in
  [DEV_DEMO_DATA.md](./DEV_DEMO_DATA.md) and [../DEMOS.md](../DEMOS.md).

## 27. Emulator end-to-end — 2026-10-08

- Production Firebase (`sahayakai-b4248`) was not written. Demo data lives in
  a local Firestore emulator, seeded by `scripts/mcp/seed-calling-emulator.cjs`
  (emulator-only guard, `--reset`).
- Org `mcp-calling-dev-org`, teacher `Yt5XFJyz45TVlY7UKyVRgxUe8Tn1` (admin
  member, premium), class `mcp-calling-demo-class-7`, student
  `mcp-demo-student`, key `165a785fe50efdee` (scope `calling`, same org).
- Live: `list_parent_contacts` returns the class (masked). One
  `initiate_parent_call` ran parent-message → outreach → call route, which
  returned 503 "Twilio not configured" → `not_configured`. **No call placed;
  the phone did not ring.**
- No authorization, route or schema code was changed.
- Script note: `scripts/mcp/create-api-key.ts` needs
  `NODE_OPTIONS=--conditions=react-server` (it imports `server-only` modules).
- Next action: add Twilio credentials, a public callback URL (restricted ngrok
  tunnel) and, for a trial account, verify the test number; then one call.
  Full steps: [DEV_DEMO_DATA.md](./DEV_DEMO_DATA.md).

## 28. Real-call attempt with a Twilio trial account — 2026-10-08

- The Twilio Console trial call to the verified test number succeeded.
- Through Sahayak, `initiate_parent_call` reached Twilio's Create Call API
  twice (one request each, no retry). Twilio answered 400 code 0 both times:
  trial Create Call allows only Twilio sample call instructions, and Sahayak
  needs its own TwiML URL. **No call was placed by Sahayak.** A full custom
  end-to-end call needs an upgraded Twilio account.
- Kept fixes (`src/lib/twilio-errors.ts`): an unrecognised Twilio 4xx (not
  401/403/429) is `provider_unconfigured` → 503 → MCP `not_configured`, not
  retryable, and the outreach record is marked `failed` (dedup released).
- A temporary trial-mode request shape (omitting `MachineDetection`) was tried
  and removed: Twilio still refused the request, and production needs the
  full request.
- Details: [DEV_DEMO_DATA.md](./DEV_DEMO_DATA.md).

