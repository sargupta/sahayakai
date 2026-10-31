# Riya (ElevenLabs) in Sampark — integration report and runbook

> **Audit update:** see `RIYA_AUDIT_AND_PREFLIGHT.md` for the independent audit, the fixes made after commit `1e7799da`, the current test results and the preflight. The proposed agent changes are in `RIYA_AGENT_PROPOSED_CHANGES.md`.

**Branch:** `integration/riya-elevenlabs`, cut from `feature/school-parent-calling` at `bdb1aa5`. Not pushed, not merged, not deployed.
**Status (15 Oct 2026):** stages A–C pass locally. Stage D (an isolated provider test) and Stage E (pilot preparation) are blocked on the account checks in §7. **This is not production-ready.** Readiness needs a verified clone, a real end-to-end call to the school test phone, and the privacy and disclosure decisions in §6.

---

## 1. Clone verification

| | ID | Source |
|---|---|---|
| Screenshot (dashboard URL) | agent `agent_2401m4zy4gyaev48rz65wfmf5yr2`, branch `agtbrch_1201m4zy4kczesra3jkmv9fpdtj2` | live dashboard (assumed to be the clone) |
| JSON export | agent `…es80bq`, its own branch and version (ids kept out of the repository) | Varunesh's export (source) |
| Phone number in export | `phnum_…d777x`, a Vobiz SIP trunk, outbound and inbound | assigned to the **source** agent |

**Verified:** the two agent ids differ. That is consistent with a clone, but it does not prove the clone's configuration matches.

**Not verified, because no API access was available:** the ElevenLabs API was not reachable from the build sandbox, and no key was provided. Nothing about the live clone has been read.

`scripts/sampark/verify-riya-clone.mjs` makes GET requests only and compares the following:

- name, ids, branch and version
- first message, the prompt (as a hash) and its variables
- LLM, temperature and tools
- voice id, TTS model and voice settings
- workflow node and edge counts, and each of the six `call_purpose` branches (hash plus variables)
- data-collection fields
- privacy and retention, auth, call limits, and the post-call webhook
- the assigned numbers and their outbound and inbound capability

It masks phone numbers and e-mail addresses and never prints the key. It was dry-run against the export with a mocked API. The script works, and it correctly flags that a fresh clone has **no phone number assigned**: numbers are assigned per agent, and the export's number belongs to the source agent.

```bash
# in your own shell — the key comes from your environment, never from a file or a chat
ELEVENLABS_API_KEY=... node scripts/sampark/verify-riya-clone.mjs \
  --target agent_2401m4zy4gyaev48rz65wfmf5yr2 --target-branch agtbrch_1201m4zy4kczesra3jkmv9fpdtj2 \
  --source-file E:/sargvision/sahayakcallagentvarunesh.txt --phone-number-id <phnum_…> --out riya-clone-report.md
```

### What the export itself shows (verified from the JSON)

| Area | Finding | Effect on the integration |
|---|---|---|
| Workflow | A start node plus six `override_agent` nodes. There are six edges with `eq` on `call_purpose`: `event_invitation`, `ptm_invitation`, `holiday_notice`, `exam_schedule_notice`, `absence_notice`, `emergency_closure`. **No fallback edge.** | An unknown purpose would leave the call on the generic prompt. The server sends only these six values, pinned by a test against the export. |
| Variables | 14 are referenced. Only 10 have placeholders: `exam_schedule`, `closure_date`, `closure_reason` and `transport_information` have none. The placeholders hold demo data (DPS Siliguri, Samuel Jackson). | Every call sends all 14. The workflow's own variables carry verified facts and the rest are `""`, which the prompt defines as "not provided". Demo values are never sent. |
| PTM | The PTM node reads `event_date` and `event_time`, plus `class_name` and `section_name`. | The mapping fills them that way. This is covered by a test. |
| LLM / voice | `gemini-3.1-flash-lite` at temperature 0. Voice `zELrJnEGQSGWhiTNcUKq`, `eleven_flash_v2`, stability 0.7, similarity 0.8, speed 1. ASR is `scribe_realtime`. | None. |
| End call | System `end_call` tool. Max duration 600 s. | The Sampark plan suggests a 4-minute cap (§6). |
| Overrides | The client may not override the first message, prompt, LLM or voice. | None are sent. |
| Data collection | 9 string fields: `good_time_to_talk`, `ptm_attendance`, `ptm_preferred_time`, `ptm_meeting_mode`, `event_attendance`, `late_return_date`, `exam_absence_date`, `expected_return_date`, `child_at_school_during_closure`. | Stored, bounded, on known keys only. |
| Privacy | `record_voice: true`, `retention_days: -1` (keep forever), no PII deletion, zero-retention off. | **Must be decided before any real call** (§6). Until then the server requires `recorded_conversation` consent. |
| Disclosure | The first message is "this is Riya, calling from {{school_name}}". The prompt says "Do not volunteer that you are an AI" (it answers honestly if asked). | Conflicts with the Sampark plan's disclosure rule and with this task. A dashboard change is proposed in §6 and needs your authorisation. |
| Access | `auth.enable_auth: false`. The number accepts **inbound** calls from `0.0.0.0/0`. Daily limit 100000, concurrency unlimited. | Proposed hardening is in §6. |
| Webhooks | `post_call_webhook_id: null`. | A workspace post-call webhook must be created (§7). Until then status comes only from manual "Check status". |

## 2. Architecture decision

- **Riya is a hosted conversational agent, not a carrier.** Sampark's `Carrier` contract is built for pre-rendered notices: `audioSeconds` drives `HeardLevel`, keypad digits drive outcomes, and the dispatcher's claim and settle logic is shaped around both. A live agent has neither, so forcing it into `Carrier.place` would make "heard / hung up early" meaningless and would put conversation calls into notice counts and overview charts.
- **So Riya is an additive conversation path** (`CallMode: 'conversation'` already exists in `types/sampark.ts`). It reuses Sampark's school record, guardian snapshot, consent, suppressions, the gate (`evaluateGate`: purpose, do-not-contact, suppression, number class, demo school, sensitive flags, custody, consent group, language, frequency cap, hours), pause, test phone, audit log and org-admin authority. It keeps its own record, lifecycle and collection, `sampark_conversation_calls`.
- **The boundaries of phase 2a are preserved:**
  - Practice uses a simulator with no network.
  - Test rings **only** the school's test phone (decrypted and hash-checked).
  - Live is refused with `LIVE_MODE_NOT_AVAILABLE` whatever the flags say.

  Taking a call to a real parent therefore needs a separate reviewed change, as it already does for notice calls.
- **No change to:** the dispatcher, either carrier, the Vobiz client, the Vobiz voice webhooks, the teacher `/api/attendance/call` route, or the live bridge.
- **UI:** a new **Riya calls** tab inside the existing Sampark console (`/sampark/[orgId]/riya`). It uses the console's authentication, school context, components and design tokens. There is no second dashboard.

## 3. Files

### New

| File | Purpose |
|---|---|
| `src/lib/sampark/conversation/riya-purposes.ts` | The six purposes, 14 variables, the Sampark purpose mapping, the risk tier, the allow-list (`SAMPARK_RIYA_PURPOSES`, default PTM only), and the closed vocabularies. |
| `src/lib/sampark/conversation/facts.ts` | Typed facts schema and the facts → variables builder, using the reviewed Indian-English speller. It refuses missing, past or unsayable facts and holidays that are not on the calendar. |
| `src/lib/sampark/conversation/elevenlabs-client.ts` | Server-only client: config validation, outbound call (documented fields only), and conversation GET. It sorts every result into accepted, rejected or unknown. |
| `src/lib/sampark/conversation/webhook.ts` | HMAC verification (`t=…,v0=…`, 30-minute window, constant-time) and a bounded parse. Data-collection values are kept only for known keys. |
| `src/lib/sampark/conversation/state.ts` | Reducer that only moves forward and is idempotent. A duplicate or out-of-order event is harmless, and unknown outcomes are never re-dialled. |
| `src/lib/sampark/conversation/types.ts`, `repo.ts`, `firestore-repo.ts`, `factory.ts` | The record type, the persistence port with a memory adapter and a Firestore adapter (create-only call and conversation link), and the factory. The factory has the same database-safety check as Sampark. |
| `src/lib/sampark/conversation/simulated-provider.ts` | Practice scenarios: positive answer, cannot attend, no answer, busy, wrong person, stop request, cut off, provider refusal, provider timeout. |
| `src/server/sampark/conversation.ts` | **The only place** a Riya call is started, settled, reconciled or reviewed. |
| `src/server/sampark/conversation-http.ts` | Route shell: Sampark flag, 401, 400, 403, then the Riya flag. |
| `src/app/api/sampark/[orgId]/riya/route.ts` (GET, POST), `preview/route.ts`, `[callId]/route.ts`, `[callId]/reconcile/route.ts`, `[callId]/review/route.ts` | Org-admin routes. |
| `src/app/api/webhooks/elevenlabs-riya/route.ts` | Post-call webhook. The `/api/webhooks/` prefix is already public, and the route verifies the HMAC itself. |
| `src/lib/api/sampark-riya.ts`, `src/components/sampark/riya-call-panel.tsx`, `src/app/sampark/[orgId]/riya/page.tsx` | Console. |
| `scripts/sampark/verify-riya-clone.mjs` | Read-only clone verification. |
| `src/__tests__/sampark/conversation/*` (5 suites, 128 tests) | Mapping, provider, service end to end, class gates, routes. |

### Changed (additive)

- `src/types/sampark.ts`: suppression source `conversation_request`.
- `src/components/sampark/labels.ts`: its label.
- `src/components/sampark/org-shell.tsx`: the nav item.
- `firestore.indexes.json`: one index, `sampark_conversation_calls` on `phoneHash` + `createdAt`.
- `cloudbuild.yaml`: `SAMPARK_ELEVENLABS_ENABLED=false` in both deploy steps, ship-dark.
- `src/__tests__/sampark/server/cloudbuild-flags.test.ts`: asserts the new flag.
- `src/locales/*.json`: 70 new console strings in all 10 locales. These are machine-drafted and need native review.

## 4. Configuration

Server-only. None of these may be a `NEXT_PUBLIC_` variable; a class gate fails the build if one is.

| Variable | Meaning |
|---|---|
| `SAMPARK_ENABLED=true` | Sampark itself (existing). |
| `SAMPARK_ELEVENLABS_ENABLED=true` | Riya routes and webhook (404 otherwise). **The rollback switch.** |
| `SAMPARK_LIVE_DIAL_ENABLED=true` | Needed for Test mode, which rings the test phone (existing flag). |
| `SAMPARK_RIYA_PURPOSES` | Comma list of enabled workflows. Unset means `ptm_invitation` only. |
| `ELEVENLABS_API_KEY` | Secret Manager. Sent only in `xi-api-key`. |
| `ELEVENLABS_AGENT_ID` | The **confirmed clone** id. |
| `ELEVENLABS_SOURCE_AGENT_ID` | Varunesh's source agent id. Required: configuring it as `ELEVENLABS_AGENT_ID` is refused unless `ELEVENLABS_ALLOW_SOURCE_AGENT=true`. (Audit change: this was a literal in the code.) |
| `ELEVENLABS_AGENT_PHONE_NUMBER_ID` | The `phnum_…` id assigned **to that clone**. |
| `ELEVENLABS_AGENT_BRANCH_ID` | Optional pinned branch. |
| `ELEVENLABS_WEBHOOK_SECRET` | Secret Manager. The HMAC secret of the workspace post-call webhook. |
| `SAMPARK_RIYA_STORE_TRANSCRIPTS=true` | Optional. Without it no transcript is stored; with it, transcripts expire after `SAMPARK_RIYA_TRANSCRIPT_DAYS` (default and maximum 7, the privacy policy). The console never receives a transcript: staff see the call synopsis. |
| `SAMPARK_RIYA_RECORDING_OFF_CONFIRMED=true` | Set only after recording is off on the agent. Otherwise each family needs `recorded_conversation` consent. |
| `SAMPARK_RIYA_TEST_DAILY_CAP` | Test-phone calls per school per 24 h (default 5). |
| `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod` | **Required for any real Riya call** (audit change), because preview and staging run with `NODE_ENV=production` against the production Firestore project. |
| `SAMPARK_RIYA_PRODUCTION_DATA_APPROVED` | Only for a later, reviewed production rollout. Lifts the non-production-database requirement; Test mode still rings only the test phone. |
| Existing | `SAMPARK_PII_KEY`, `SAMPARK_PHONE_PEPPER`, and `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod` outside production. |

**Rollback:** set `SAMPARK_ELEVENLABS_ENABLED=false`. Every Riya route and the webhook then answer 404, the notice pipeline is untouched, and stored records stay. Turning `SAMPARK_LIVE_DIAL_ENABLED` off also stops Test calls for both notice and Riya paths.

## 5. Tests

Run on the branch in a clean clone, Node 22, with `npm ci`:

| Gate | Result |
|---|---|
| Targeted: `jest src/__tests__/sampark/conversation` | 128 passing across 5 suites |
| Whole Sampark suite | 1,484 passing, 12 skipped (emulator-only, skipped at baseline too) |
| Whole Jest suite | 335 suites, 4,777 passing, 28 skipped, 0 failing. Baseline at `bdb1aa5` (measured the same way): 330 suites, 4,649 passing, 28 skipped, 0 failing; the difference is exactly the 128 new tests |
| `npm run typecheck` | clean (baseline clean) |
| `eslint src` | 0 errors; 416 warnings, all in files this change does not touch. The changed files are warning-free |
| Gate 9 (i18n) | 24 missing keys = baseline 24 |
| Gate 12 (Firestore indexes) | no new unmatched signatures |
| `npm run build` | passes. All 7 new routes and pages are built, and the client bundle contains no `xi-api-key` or key names |

Two notes on these results:

- **One existing gate tripped and was fixed.** During development, `gate-school-view` caught a Riya route that imported a school getter. The read was moved into the service.
- **The build used a font mock.** The sandbox cannot reach Google Fonts, so the build ran with Next's own `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` font mock. No code change was made for this, and your normal build fetches fonts as usual.

**Covered (Stage A/C):**

- all six payloads, the wire contract against the export, and missing or empty facts
- unauthorised, cross-tenant and not-of-record recipients
- hours, suppression, consent, recording consent, custody, pause and language
- duplicate start (idempotency key, one call in flight per school, unresolved unknown)
- agent id, phone-number id and **test-phone-only** destination; a test phone whose hash does not match is never dialled
- success, invalid config, 401, 429, 422, 5xx, timeout, network error and unreadable responses
- webhook signature (bad, stale, future, no secret), duplicates, out-of-order events, another agent, and an unlinked conversation (503 then 200)
- user-id fallback, which cannot cross schools
- transcripts off by default, with expiry
- Practice stop request never suppressing anyone
- logs free of phone numbers, keys, transcript text and child names
- flag off returns 404, and the browser cannot send a number

## 6. Security, privacy and proposed agent changes

**Enforced in code:**

- **Authority:** org admin only, by `requireOrgAdmin` on server-managed data. The `orgId` in the path is checked against the verified uid, and nothing in the body names a school, child or number.
- **Recipient:** resolved from Sampark records. The guardian must be of record for that student and both must be active. In this release a Test call rings the test phone only.
- **Facts:** typed. Holidays must be on the school calendar. PTM, event and closure facts can come from an existing campaign by id. Staff confirm the exact announcement, and the server refuses if it has changed.
- **Gate:** the notice gate applies in full, plus pause, recorded-conversation consent and English-only (Riya speaks English only).
- **Duplicates:** an idempotency key per approved preview; one Riya call in flight per school (lock); the test-mode daily cap; and an unreviewed unknown call blocks the same announcement to the same family.
- **Unknown outcomes** are never auto-redialled. They are shown in the console with "Check status" (a GET to the provider) and "Mark as checked".
- **Webhook:** HMAC with a replay window, our agent id only, and a create-only link from conversation id to call. A user-id fallback works only onto our own call that has no conversation yet. Payloads are bounded.
- **Opt-out:** a `stop_requested` data-collection value, or an English stop phrase from the listener, marks the call. On a real parent call that writes a `routine` suppression pending office confirmation. In Practice and Test it is only audited.
- **Logs and records:** only the last four digits and the hash. The key is never logged or stored, and transcripts are stored only on opt-in, with expiry.

**Proposed ElevenLabs changes.** These need your authorisation; nothing has been changed.

1. **Disclosure.**
   - Set the first message to: "Hello, this is Riya, an AI assistant calling on behalf of {{school_name}}, with an important update. Is this a good time to talk?"
   - Replace the prompt line "Do not volunteer that you are an AI" with "You have already said you are an AI assistant; never claim to be human."
   - Update each node's opening line to match.
2. **Privacy.**
   - Either turn `record_voice` off, set `zero_retention_mode` and `delete_audio`, or set a finite `retention_days` (for example 30) with `delete_transcript_and_pii`.
   - Then set `SAMPARK_RIYA_RECORDING_OFF_CONFIRMED` only if recording is truly off.
3. **Data collection.** Add `recipient_confirmed` (yes/no/not_asked) and `stop_requested` (yes/no). The server already reads both.
4. **Access.** Disable inbound on the number, or restrict `allowed_addresses` to Vobiz. Enable `auth`. Set daily and concurrency limits, for example 50 per day and 2 concurrent.
5. **Duration and fallback.**
   - Set `max_duration_seconds` to 240.
   - Add a fallback edge (no matching `call_purpose`) to a node that apologises and ends the call. Today the server makes this unreachable.
6. **Absence and exam workflows.** These stay off by default.
   - **Absence** is a tier-2 sensitive fact. The Sampark plan requires a verified guardian number and paging staff when the call is placed. Riya's flow does neither.
   - **Exam** facts have no system of record yet: staff type them from a closed list.

   Enable them only after a separate review.

## 7. Dashboard steps that need account access

1. Run `verify-riya-clone.mjs` and confirm that the clone matches (§1).
2. **Assign an outbound-capable number to the clone.** The export's `phnum_…d777x` is assigned to the source agent. Either reassign it, which moves it off the source, or import a second Vobiz SIP-trunk number. This is an account-level choice for you.
3. Create a workspace post-call webhook: URL `https://<staging-host>/api/webhooks/elevenlabs-riya`, events `post_call_transcription` and `call_initiation_failure`, audio off. Store its HMAC secret in Secret Manager as `ELEVENLABS_WEBHOOK_SECRET`.
4. Apply the authorised changes from §6.
5. Create a key scoped to ConvAI only, if your plan allows scoped keys.

## 8. Blockers and assumptions

- **Verified:**
  - repository state, and that the Sampark branch is unchanged on the remote (`bdb1aa5`, Abhishek, 8 Oct)
  - the export's contents
  - the documented outbound-call and webhook schema (ElevenLabs docs, 15 Oct 2026)
  - all local gates
- **Assumed, to be verified:**
  - that the screenshot's agent is the clone and matches the source
  - that it has, or can get, an outbound number on the Vobiz trunk
  - the `ElevenLabs-Signature` format (`t=,v0=` HMAC-SHA256 hex of `t.body`), which is from SDK and secondary documentation; prove it with one real webhook
  - that `user_id` round-trips in the post-call payload
- **Blockers for Stage D:**
  - API access for verification
  - a number assigned to the clone
  - a webhook and its secret
  - a non-production deployment with these variables, pointed at `sampark-nonprod`, never at production parent data
  - the test school's test phone set in Settings, with mode set to Test
  - your go-ahead on §6
- **Blockers for a parent pilot:**
  - a reviewed change that lifts `LIVE_MODE_NOT_AVAILABLE` for named pilot families only
  - school authorisation and consent records (`notices` and `recorded_conversation`)
  - the disclosure and retention changes
  - counting conversation calls in the notice frequency cap; today each path counts only its own calls plus the guardian's notice calls

## 9. Preflight for the first real test call (to be filled in, then confirmed by you)

| Check | Value |
|---|---|
| Destination | The school test phone ending `____`. The server can dial only this number; the guardian's number is never used in Test mode. |
| Agent id / branch | `agent_2401…5yr2` / `agtbrch_1201…dtj2` (from the verification report) |
| Phone-number id | `phnum_…` assigned to the clone (step 7.2) |
| Workflow | `ptm_invitation` |
| Data spoken | School spoken name; child's English first name; class and section; date and time from typed facts (shown in the preview, confirmed before dialling) |
| Call count | 1. Duplicate starts are blocked, the daily cap is ≤ 5, and nothing retries |
| Calling window | 10:00–20:00 IST, Monday–Saturday, not a school holiday |
| Disclosure and retention | Per §6, as authorised |
| Environment | Non-production deployment, `sampark-nonprod` database, no production traffic change |
| Billing | One ElevenLabs conversation (≤ 10 min) plus one Vobiz outbound minute |
| Rollback | `SAMPARK_ELEVENLABS_ENABLED=false` |
| Test results | Stages A–C as in §5 |
