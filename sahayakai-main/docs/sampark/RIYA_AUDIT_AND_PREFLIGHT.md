# Riya integration — independent audit, clone verification status and first-call preflight

**Date:** 15 Oct 2026, about 22:00 IST.
**Branch:** `integration/riya-elevenlabs`. Commit `1e7799da` (the original integration) plus one audit-fix commit on top (§3). The base is `feature/school-parent-calling` at `bdb1aa5`, unchanged on the remote.
**Verdict:** not ready for a real call. The code-side gates pass. **Every live-account check is UNVERIFIED**: no ElevenLabs API access was available from the environment that did this work, and the shell on your laptop would not start. The preflight in §8 therefore has blanks that only the account checks can fill.

---

## 1. Access and artifact verification

| Item | Result |
|---|---|
| `E:\sargvision\sahayakcallagentvarunesh.txt` | **Read through the approved device bridge (staged read-only copy).** 79,785 bytes, mtime unchanged since the first session, sha256 `ad4ebebf0abb2bf7…721bcb`. The file was not modified. A JSON object starts after an e-mail header and parses cleanly. The file is **not** in the repository, bundle or patch (checked). A names-only contract fixture derived from it is committed: purposes, variable names and data-collection keys. It contains no phone numbers, account ids or prompt text. |
| Laptop shell (`device_bash`) | **Unavailable.** The isolated Linux environment failed to start, twice. `git status`, `git worktree list` and similar could not be run on your machine. |
| Local repository state (from `.git` metadata, read-only) | Main checkout on `feat/calling-mcp` (`ca10e8b`) with a stash (`fe01b77`). Worktrees: `call-bridge-wt` → `feat/parent-call-voice-upgrade` (`5d5def8`, last commit 11 Oct), `calling-pr-wt` → `feat/sahayak-calling-mcp`, `mcp-pr-wt` → `feat/sahayak-mcp-planner-exam-quiz`. **All mtimes are identical to the first audit; nothing changed.** Uncommitted changes in those working trees **could not be checked** without a shell. |
| Remote | `main` `b25a489`, `feature/school-parent-calling` `bdb1aa5`. `integration/riya-elevenlabs` is **not** on the remote (never pushed). |
| Delivered artifacts in `E:\sargvision\riya-integration\` | Byte-identical to the copies produced in the build environment. Bundle sha256 `3a89b078…df333`, patch `9dd6e2f2…88d95`. `git bundle verify`: OK. The bundle contains `refs/heads/integration/riya-elevenlabs` at `1e7799da` and requires `bdb1aa5`. The patch's `From` line is `1e7799da`. `git diff --stat bdb1aa5..1e7799da` shows 45 files, +5,622 / −14. |
| Reported numbers for `1e7799da` | Re-run: 128 Riya tests, full suite 4,777 passing / 0 failing (baseline 4,649 at `bdb1aa5`, measured in a worktree of the base). typecheck, eslint and build passed. **Confirmed.** |
| `/home/claude/verify` | Left untouched, as instructed. |

## 2. Clone verification (read-only)

**No live check could run.** `api.elevenlabs.io` is refused by the build environment's network allow-list (HTTP 403 at the proxy), and no `ELEVENLABS_API_KEY` exists there. Per your instruction this is a blocker, not a licence to guess.

The tool to run on your machine is `scripts/sampark/verify-riya-clone.mjs`, upgraded in this audit:

- **Requests:** GET only, to the agent and phone-number endpoints.
- **Statuses:** every check reports PASS, FAIL or UNVERIFIED.
- **Coverage:** full node and edge parity; main and per-branch prompts by hash; voice, TTS and pronunciation settings; branch and version; phone-number assignment, outbound trunk and inbound restriction; privacy, auth, limits, webhook, disclosure, override lock and fallback edge.
- **Redaction and exit codes:** masks numbers, e-mails, SIP hosts and usernames, and never prints the key. Exits 1 on any FAIL.

**Self-test against a simulated clone** (the export with a new id and branch, and no number assigned). Result: 24 PASS, 8 FAIL, 1 UNVERIFIED. A second run with one node's prompt and the TTS speed altered correctly flipped `4a`, `5c holiday_notice` and `6b` to FAIL.

| # | Check | Status now | What the export shows / what decides it |
|---|---|---|---|
| 1 | Source and target ids and name | UNVERIFIED | Source `…es80bq`, "Riya School Calling Assistant". Screenshot target `…mf5yr2`. Different ids prove nothing by themselves. |
| 2 | Source exists in the expected account | UNVERIFIED | Needs `--source <id>`. The export's `access_info` shows an admin creator account. |
| 3 | Clone configuration fetched | UNVERIFIED | — |
| 4 | Workflow node and edge parity | UNVERIFIED | Export: 7 nodes (start plus 6 `override_agent`), 6 edges, all `eq(call_purpose, …)`, no fallback. |
| 5 | Main prompt and each branch prompt | UNVERIFIED | Hashes from the export are recorded by the script. |
| 6 | Model, voice, TTS, pronunciation | UNVERIFIED | Export: `gemini-3.1-flash-lite` at temperature 0; voice `zELr…UKq`, `eleven_flash_v2`, stability 0.7, similarity 0.8, speed 1. |
| 7 | Six `call_purpose` values | **PASS (export)** / UNVERIFIED (clone) | Pinned by `riya-mapping.test.ts`. |
| 8 | Placeholders and data collection | **PASS (export)** / UNVERIFIED (clone) | 10 placeholders, all demo data; 9 data-collection fields. |
| 9 | End-call behaviour | **PASS (export)** / UNVERIFIED (clone) | System `end_call` tool. Every node ends with "say goodbye once, then end_call". |
| 10 | Branch and version | UNVERIFIED | Target branch `…fpdtj2` from the screenshot URL. |
| 11 | Phone assignment and outbound | **FAIL (export) / UNVERIFIED (clone)** | The only number in the export is assigned to the **source** agent, as a Vobiz SIP trunk with outbound configured. ElevenLabs' phone-number schema has a single `assigned_agent`, so one number serves one agent. |
| 12 | Recording, retention, access, webhook | **FAIL (export)** | `record_voice: true`, `retention_days: -1`, `enable_auth: false`, inbound from `0.0.0.0/0`, daily limit 100,000, concurrency unlimited, no post-call webhook, no AI disclosure in the first message. |

The exact proposed fixes are in **`RIYA_AGENT_PROPOSED_CHANGES.md`**. None has been applied.

## 3. Code and security audit — findings and fixes

Each requirement is listed with where it is enforced (server side) and which test proves it.

| Requirement | Enforced in | Test | Verdict |
|---|---|---|---|
| Authentication and org authority | `guardRiyaRoute` → `guardOrgRoute` → `requireOrgAdmin` (server-managed `adminUserId` or `members.role`); Riya flag after it | `riya-routes.test.ts` (404/401/400/403/404 order, cross-org 403) | OK |
| Browser cannot choose a phone, school or child name | Strict Zod schemas (`RiyaStartSchema`, `RiyaPreviewSchema`): ids only; names, class and phone resolved from Sampark records | `riya-gates (d)`; `riya-service` cross-tenant `RECIPIENT_NOT_FOUND`, `NOT_GUARDIAN_OF_RECORD` | OK |
| Source of truth for phone and student | `SamparkGuardian.phoneEnc` (AES-GCM), decrypted **only** for the test phone in `testPhoneE164()`, with hash check | `riya-service` (`to_number` equals test phone, never the guardian's; hash mismatch never dialled) | OK |
| Practice is fully simulated | `providerFor`: practice → `simulated`; no `fetch` on that path | `riya-service` (fetch never called, all 6 workflows, 9 scenarios) | OK |
| Test mode rings only the designated test phone | `destinationOf` + `testPhoneE164` (mode must be `test`, decrypt and hash match) | as above | OK |
| Live refused | `providerFor` → `LIVE_MODE_NOT_AVAILABLE`; `testPhoneE164` throws outside test mode | `riya-service` | OK |
| **Staging cannot read production records for a real call** | **NEW:** `providerFor` requires `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod` (or `SAMPARK_RIYA_PRODUCTION_DATA_APPROVED=true`) before any ElevenLabs call | **NEW** `riya-service` "production database … refused" | **Fixed in audit.** Gap: preview runs `NODE_ENV=production` against the production Firestore project, so Sampark's own guard passes there. |
| **Source agent can't be called by mistake** | **CHANGED:** `ELEVENLABS_SOURCE_AGENT_ID` is required configuration; `ELEVENLABS_AGENT_ID` equal to it is refused | **NEW** `riya-provider` | **Fixed in audit.** The source id was a literal in code; account ids are now kept out of the repo. |
| Agent and phone-number selection | `readElevenLabsConfig` (format-validated env ids); request body built only from config | `riya-provider` (exact body keys and ids) | OK |
| Six workflow mappings, no invented facts | `facts.ts` builder; all 14 variables sent; required ones non-empty; holidays must be on the calendar; typed enums only | `riya-mapping` (29) | OK |
| Calling hours, pause, suppression, consent, custody, language, frequency cap | `evaluateGate` (stage `dispatch`), `pauseStopsPurpose`, recording-consent check, English-only check | `riya-service` refusals | OK |
| Duplicate clicks | Idempotency key per approved preview → `riyaCallId`; create-only record | `riya-service` (same key never dials twice) | OK |
| Concurrent initiation | Per-school lock `riya:{orgId}` (transactional in Firestore) | **NEW** concurrent-start test (exactly one reaches the provider) | OK, test added |
| Timeout, 5xx, unreadable response → unknown; never retried | `startRiyaOutboundCall` classification; `recordStartResult`; lock held; same announcement blocked until "Mark as checked" | `riya-provider`, `riya-service` | OK |
| 401, 403, 422, 429 → refused (nothing rang) | as above; lock released | `riya-provider`, `riya-service` | OK |
| Webhook authenticity | HMAC-SHA256 over `t.body`, constant-time compare, 30-minute window, 5-minute future skew, size limit before parse | `riya-provider`, `riya-service`, `riya-routes` | OK. The signature format comes from SDK and secondary docs; **prove it with the first real webhook.** |
| Webhook idempotency and order | `appliedEvents` plus a forward-only reducer; post-call beats initiation failure; unknown can be resolved | `riya-provider`, `riya-service` | OK |
| Tenancy of webhooks | Create-only `conversationId → {orgId, callId}` link; agent-id match; user-id fallback only onto our own call with no conversation yet | `riya-service` (cross-school user id cannot attach) | OK |
| Transcript and data-collection persistence | Data collection kept only for known keys and bounded; transcripts only with `SAMPARK_RIYA_STORE_TRANSCRIPTS=true`, with expiry scrubbed on read | `riya-service` (+ **NEW** PTM preferred-time persistence) | OK. Gap: expiry is scrubbed on read, not by a scheduled sweep. Add a Firestore TTL on `transcriptExpiresAt` before the pilot. |
| Results visible only to authorised users | All Riya reads go through `guardRiyaRoute`; the list view omits transcripts and phone hashes | `riya-routes`; `riya-service` (no `phoneHash` in views) | OK |
| Opt-out | `stopRequested` → routine suppression pending office confirmation (real-parent calls only); audited in Practice and Test | `riya-service` | OK. Phrase matching is English-only. Add the `stop_requested` agent field (proposal §6). |
| Secrets server-side | Key only in `xi-api-key`; no `NEXT_PUBLIC_` ElevenLabs variable; client components can't import server modules | `riya-gates (a)(b)(c)`; build: **0** client chunks contain `xi-api-key` | OK |
| Logs | No numbers, key, transcript text or child names | `riya-service` log-privacy test | OK |
| Disabled by default in production | `SAMPARK_ELEVENLABS_ENABLED=false` (and `SAMPARK_ENABLED=false`) in both `cloudbuild.yaml` deploy steps | `cloudbuild-flags.test.ts` | OK |
| Rollback | Riya flag off → every Riya route and the webhook return 404; notice path untouched | `riya-routes` | OK |
| Existing Vobiz and teacher calling unchanged | No diff in `src/app/api/attendance/**`, `src/lib/vobiz/**`, `src/lib/sidecar/**`, `src/components/attendance/**`, `src/lib/sampark/dispatch/**`, `src/server/sampark/carrier.ts`, `src/app/api/webhooks/sampark-voice/**`, `src/middleware.ts` | 20 regression suites: 551 passing, 16 skipped | OK |

**Remaining gaps (documented, not fixed: they matter only for parents, and Live is refused):**

1. The notice dispatcher's frequency cap does not count Riya calls. The Riya path does count notice calls.
2. Phrase-based stop detection is English-only.
3. Transcript expiry has no scheduled sweep.
4. An "unknown" older than the latest 100 calls no longer blocks a repeat.
5. The absence workflow needs the agent change (proposal §3) and the plan's paging rule. It stays off.

## 4. Files changed in the audit commit

| File | Change |
|---|---|
| `src/lib/sampark/conversation/elevenlabs-client.ts` | Source-agent id moved from a code literal to required `ELEVENLABS_SOURCE_AGENT_ID` (fail closed). |
| `src/server/sampark/conversation.ts` | New blocker `NONPROD_DATABASE_REQUIRED` before any real Riya call; `SAMPARK_RIYA_PRODUCTION_DATA_APPROVED` override for a later reviewed rollout. |
| `src/__tests__/sampark/conversation/riya-provider.test.ts` | Source-id tests use a test value; the "source id required" test. |
| `src/__tests__/sampark/conversation/riya-service.test.ts` | Non-production database guard; concurrent initiation; PTM preferred-time persistence. |
| `src/__tests__/sampark/conversation/riya-gates.test.ts` | Exact-`'true'` check covers the new flag. |
| `scripts/sampark/verify-riya-clone.mjs` | PASS/FAIL/UNVERIFIED per check; full workflow parity; phone-number GET; no default source id; Windows usage. |
| `docs/sampark/RIYA_ELEVENLABS_INTEGRATION.md` | Account ids redacted; new variables; pointer to this file. |
| `docs/sampark/RIYA_AGENT_PROPOSED_CHANGES.md` | New: the exact agent diff awaiting approval. |
| `docs/sampark/RIYA_AUDIT_AND_PREFLIGHT.md` | New: this report. |

**Note on history.** Commit `1e7799da` still contains the source agent id, the source branch and version ids, and the source phone-number id in a doc and a constant. These are account metadata, not credentials. Because nothing was pushed, the delivered bundle also carries `integration/riya-elevenlabs-squashed`: the same final tree as **one** commit on `bdb1aa5`, without those ids anywhere. Use that branch for any future push.

## 5. Validation (build environment, Linux, Node 22, `npm ci`)

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | clean |
| `npx eslint src` | 0 | 0 errors; 416 warnings, none in Riya files (same 416 at `1e7799da`) |
| `node scripts/ci/check-i18n-ratchet.mjs` | 0 | missing keys 24 = baseline 24; hard-coded strings 58 = 58 |
| `node scripts/ci/check-firestore-indexes.mjs` | 0 | no new unmatched signatures (3 = baseline 3) |
| `npx jest src/__tests__/sampark/conversation` | 0 | 5 suites, **132 passed** |
| `npx jest <20 Vobiz, attendance and Sampark carrier regression suites>` | 0 | 551 passed, 16 skipped |
| `npx jest` (full) | 0 | 335 suites passed, 1 skipped; **4,781 passed**, 28 skipped, **0 failed**. Baseline at `bdb1aa5`: 4,649 passed, 28 skipped, 0 failed. Difference: exactly the 132 Riya tests. |
| `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=… npm run build` | 0 | All 7 Riya routes and pages built; **0** client chunks contain `xi-api-key`. The font mock is needed only because the environment cannot reach Google Fonts. |

All ElevenLabs traffic in tests is mocked. No test can place a call: the simulated provider has no network, and every Test-mode test injects `fetchImpl`.

## 6. Phone number — findings and options (no action taken)

- **Facts.**
  - The export's number (`…d777x`, Vobiz SIP trunk, outbound trunk configured, digest credentials) is **assigned to the source agent**.
  - ElevenLabs models `assigned_agent` as a single agent per number.
  - The outbound-call API takes `agent_id` and `agent_phone_number_id` separately. Whether it accepts a number assigned to a different agent is **not documented: UNVERIFIED.** Do not rely on it.
- **Option A (recommended, your preference): a dedicated test number for the clone.**
  1. Obtain a second DID from Vobiz on the same trunk.
  2. In ElevenLabs, use **Phone Numbers → Import → SIP trunk**: the Vobiz SIP domain, TCP/TLS, digest credentials for outbound; inbound off, or restricted to Vobiz's signalling IPs.
  3. Assign the number to the clone.

  Effect on Varunesh's agent: **none.**

  Billing: a Vobiz DID and channel rental (the Sampark plan quotes ₹349 per channel per month), Vobiz per-minute outbound rates, and ElevenLabs conversation minutes against your plan. Account approval: whoever owns the ElevenLabs workspace and the Vobiz account.
- **Option B: reassign the existing number to the clone.** One API or dashboard change, but it **moves the number off Varunesh's source agent**: his agent loses inbound calls and the default caller id. Needs his agreement.
- **Option C: share the number.** Not supported as an assignment, and untested for outbound use. Not recommended.

## 7. Staging plan (prepared, not deployed)

The target is the existing **`sahayakai-preview`** Cloud Run service (`cloudbuild-preview.yaml`, `asia-southeast1`). It is separate from production `sahayakai-hotfix-resilience`, and production traffic is unaffected. One caveat: preview **shares the production Firestore project**, which is why the new non-production-database guard exists.

1. **Build** `integration/riya-elevenlabs-squashed` with the preview pipeline. This requires a push to a branch the preview trigger watches, which **you** must decide on. Or create a tagged no-traffic revision: `gcloud run deploy … --tag=riya-<sha> --no-traffic` on `sahayakai-preview` only. Per `AGENTS.md`, never deploy to production.
2. **Set environment variables on that revision only.**
   - Flags and data: `SAMPARK_ENABLED=true`, `SAMPARK_ELEVENLABS_ENABLED=true`, `SAMPARK_LIVE_DIAL_ENABLED=true`, `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod`, `SAMPARK_RIYA_PURPOSES=ptm_invitation`, `SAMPARK_RIYA_TEST_DAILY_CAP=2`.
   - Agent: `ELEVENLABS_AGENT_ID=<clone>`, `ELEVENLABS_AGENT_BRANCH_ID=<clone branch>`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID=<number assigned to the clone>`, `ELEVENLABS_SOURCE_AGENT_ID=<Varunesh's id>`.
   - Secrets from Secret Manager: `ELEVENLABS_API_KEY` (a ConvAI-scoped key if your plan allows), `ELEVENLABS_WEBHOOK_SECRET`, plus the existing `SAMPARK_PII_KEY` and `SAMPARK_PHONE_PEPPER`.
   - Leave `SAMPARK_RIYA_RECORDING_OFF_CONFIRMED` unset until proposal §4 is live and verified.
3. **Seed `sampark-nonprod` with a test school only.** Enable Sampark for a **demo or test org**, set the test phone in Settings (encrypted and hashed there), and set mode to **Test**. Import one synthetic family with English language, `notices` consent and `recorded_conversation` consent.
4. **Point the ElevenLabs workspace post-call webhook at the tagged revision's URL.** Use the stable tag URL `https://riya-<sha>---sahayakai-preview-….run.app/api/webhooks/elevenlabs-riya`, with events `post_call_transcription` and `call_initiation_failure`, audio off.
5. **Rehearse in Practice mode** (all six scenarios) before switching to Test.

**Rollback:**
- `gcloud run services update sahayakai-preview --update-env-vars=SAMPARK_ELEVENLABS_ENABLED=false` on the tagged revision, or delete the tag.
- Delete the workspace webhook.
- Production needs no rollback: nothing there changes, and `cloudbuild.yaml` keeps the flag false.

## 8. First real-call preflight (incomplete — blanks are open prerequisites)

| Item | Status |
|---|---|
| Code | `integration/riya-elevenlabs-squashed` (single commit on `bdb1aa5`); the same tree as `integration/riya-elevenlabs` |
| Clone verification | **UNVERIFIED.** Run `verify-riya-clone.mjs`; it needs 0 FAIL after the approved changes. |
| Agent / branch / version | `…mf5yr2` / `…fpdtj2` / ____ (from the report) |
| Phone-number id and telephony | ____: Option A dedicated Vobiz number, assigned to the clone, outbound trunk PASS, inbound restricted |
| Staging URL and revision | ____: not deployed |
| Production unchanged | Yes. No deploy and no traffic change; `cloudbuild.yaml` keeps `SAMPARK_ELEVENLABS_ENABLED=false`. |
| Destination | The test school's **test phone ending ____** (Settings → test phone). The server can dial nothing else in Test mode. |
| Workflow | `ptm_invitation` |
| Exact words (example; the real text is the preview the console shows, built from the seeded records) | Opening: "Hello, this is Riya, an AI assistant calling on behalf of {test school}, with an important update. Is this a good time to talk?" (after proposal §1). After confirmation: "I'm calling to invite you to the parent-teacher meeting for your child's class, Seven, section B, on Saturday, the seventeenth of October at ten o'clock in the morning." |
| Disclosure and retention | Proposals §1–§4 must be applied and verified first. |
| Allow-list and cap | Test phone only (code); 1 call in flight; daily cap 2; no automatic retry |
| Calling window | 10:00–20:00 IST, not on the school's off days or holidays. **Now (about 22:00 IST) is outside the window.** |
| Tests and build | §5 |
| Rollback | §7 |
| Remaining risks | The webhook signature format is unproven until the first real event. Number assignment semantics are unverified. Voice and latency on the Vobiz trunk from this clone are untested. The translations are machine-drafted. |

**Stop. No real call will be placed until you confirm in writing after the blanks above are filled.**
