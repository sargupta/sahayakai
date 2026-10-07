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
