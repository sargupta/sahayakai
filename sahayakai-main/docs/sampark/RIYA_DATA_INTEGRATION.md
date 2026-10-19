# Riya × Sahayak — data integration audit (2026-10-19)

Scope: where every value a Riya call uses comes from; the end-to-end path; the 8 FAIL + 1 UNVERIFIED in the V8 clone report; and what `sampark-nonprod` is for. Nothing here was run against a live system.

## 1. Source of truth

| Data | Where it lives | How it gets there | Code |
|---|---|---|---|
| School (who may act, school name) | `organizations/{orgId}` + `members/{uid}` (default Firestore DB) for admin rights; `sampark_schools/{orgId}` for the Sampark school (spoken name, mode, test phone, holidays, calling hours, pause) | Org created by the app; Sampark school created by **Enable school calls**; settings edited in the console | `server/sampark/auth.ts` (`requireOrgAdmin`), `server/sampark/school.ts` |
| Students, guardians | `sampark_schools/{orgId}/sampark_students`, `…/sampark_guardians` (phone encrypted + hashed, never plain) | **School records import** (CampusCare export / CSV / the mock CRM) — the school's CRM is the source of truth, Sampark keeps a copy | `server/sampark/guardians.ts`, `lib/sampark/repo/firestore.ts` |
| Consent, language | `sampark_preferences/{guardianId}` | Families page / consent drive | `lib/sampark/policy/gate.ts` |
| Opt-outs | `sampark_suppressions/{phoneHash}` | Keypad 9 on notice calls, office entries, CRM, Riya's spoken "stop" | `suppressionApplies` |
| Event facts (PTM date/time, event type, closure, exams, absence) | Either an approved **Sampark campaign** (`sampark_campaigns`) or the closed-vocabulary facts the admin enters for one call; holidays come from the school calendar | Riya tab form or campaign | `lib/sampark/conversation/facts.ts`, `campaignToFacts` |
| Call attempts and outcomes | `sampark_schools/{orgId}/sampark_conversation_calls/{callId}` + global `sampark_conversation_links/{conversationId}` (create-only) | Created before the provider is contacted; updated only by the signed webhook or a read-only reconcile | `lib/sampark/conversation/firestore-repo.ts`, `state.ts` |

There is no separate events or call-history system that Riya bypasses. The teachers' attendance roster (`classes/…`) is a different module and is not used for calls.

## 2. Placeholders and hard-coded values

| Value | Where | Verdict |
|---|---|---|
| `Riya Test`, `Test Student` | only in the manual curl tests outside this repo | not in code |
| `hillview-demo`, "Hillview Demo School" | `scripts/sampark/seed-emulator.ts`, `lib/sampark/scripts/samples.ts` (voice samples) | intentional, emulator / demo only; demo schools are Practice-only for Riya (`DEMO_SCHOOL_PRACTICE_ONLY`) |
| "Meena Demo (synthetic)", `+915000000101` | `scripts/sampark/riya-demo-family.ts` | intentional synthetic family, emulator only, reserved non-dialable number |
| `agent_localtest…`, `phnum_localtest…`, `local-placeholder-not-a-key` | `scripts/sampark/riya-local.mjs` | intentional local placeholders; live dialling stays off locally |
| Opening line | `RIYA_OPENING_TEMPLATE` (`riya-purposes.ts`) | **was wrong** — still the source agent's line; now the clone's live first message (check 5d) |
| Simulated transcript | `simulated-provider.ts` | Practice only; opening updated to match |
| A real-looking phone number | `src/scripts/seed-attendance.ts` (attendance module, not Sampark) | **pre-existing, unrelated, flagged**: personal data in a committed seed; not changed here |

Every variable sent to ElevenLabs is built server-side in `buildRiyaVariables` from the records above:
- `school_name` comes from the school's reviewed spoken name.
- `student_name`, `class_name` and `section_name` come from the student record.
- The event fields come from validated facts.

The client sends only:
- record ids (`guardianId`, `studentId`, `campaignId`);
- the closed-vocabulary facts;
- an idempotency key;
- the announcement it was shown.

A browser cannot send a phone number (gate test (d)). The destination is the school's encrypted test phone (Test mode) or the guardian's stored phone, never the request.

## 3. Path (verified by tests; the live leg is not)

1. **Browser → `POST /api/sampark/{orgId}/riya/preview` | `/riya`** (`conversation-http.ts`). The checks run in this order: flag, signed-in user, org admin, then the Riya flag.
2. **`startRiyaCall`** (`server/sampark/conversation.ts`):
   1. Resolve the records (404 `RECIPIENT_NOT_FOUND` for unknown ids, cross-tenant refused).
   2. Pick the provider: Practice → simulator; Test → ElevenLabs, only when all of these hold:
      - live dial is on;
      - the agent config is valid and is not the source agent;
      - the database is `sampark-nonprod`;
      - a test phone is saved;
      - the school is not a demo school.
   3. Run the Sampark gate: do-not-contact, suppression, number class, consent, custody, frequency, and calling hours (plus the staging-only, self-expiring test window).
   4. Check that recorded-conversation consent is on, and that the family's language is English.
   5. Check the approved announcement, the per-school lock, the daily cap, and that no call is unresolved.
   6. Create the call record (create-only; id = hash of org and idempotency key).
3. **`POST /v1/convai/sip-trunk/outbound-call`** (`elevenlabs-client.ts`) with:
   - the configured agent, branch and number;
   - all 14 dynamic variables;
   - `user_id = {orgId}~{callId}`.

   Possible outcomes:
   - accepted → `initiated`, and the conversation id is linked create-only;
   - refused → `failed`, nothing rang, and the slot is freed;
   - timeout or unreadable → `unknown`, never re-dialled until a person reviews it.
4. **ElevenLabs → `POST /api/webhooks/elevenlabs-riya`**:
   1. The HMAC is checked against the real clock, with a 30-minute window.
   2. The event is parsed within size bounds.
   3. Events for another agent are ignored with 200.
   4. The conversation is matched through the link, or the `user_id` fallback (own school only).
   5. The idempotent, forward-only reducer applies it: duplicates and late failures change nothing.

   It can also answer 503 while the conversation is unlinked and young, so ElevenLabs retries. A spoken stop adds a suppression.
5. **Console:** "Check status" does a read-only `GET /v1/convai/conversations/{id}`. The webhook never trusts a client-supplied conversation id: the link is written only by the server when the provider returns it.

Tests (`src/__tests__/sampark/conversation/*`, 157 tests) cover:
- authorization (401, 403, cross-tenant);
- missing records;
- invalid and suppressed numbers;
- consent and custody;
- the mapping of all 14 variables per workflow;
- duplicate idempotency keys and concurrent starts;
- 429, auth failures and timeouts (unknown);
- valid, bad and stale signatures;
- other-agent events;
- duplicate and out-of-order events;
- `user_id` fallback;
- status writeback;
- the demo hard-stop;
- the window override bounds.

## 4. The V8 clone report (2026-10-18): 8 FAIL, 1 UNVERIFIED

| Check | Verdict | Action |
|---|---|---|
| 2 source exists in this account | **Expected.** The source agent lives in Varunesh's workspace, so this key cannot read it. The comparison used the export. | Verifier now says why (HTTP status) instead of a bare FAIL |
| 4a nodes identical; **4b edges** | **Unexplained difference** on the `start → absence_notice` edge condition only, while the edge still routes `call_purpose = absence_notice`. Could be a harmless label edit or a changed operator. | Verifier now prints both conditions (`4b′`); re-run and read it before enabling `absence_notice` (only PTM is enabled) |
| 5a main prompt, 5b first message | **Intentional.** The clone's prompt and opening were updated (AI disclosure, recording rules). | none |
| 5d preview ≠ agent opening | **Real Sahayak defect, fixed.** `RIYA_OPENING_TEMPLATE` is now the clone's first message. | done; required by `Deploy-Riya-Staging.ps1 -Step Verify` |
| 11c inbound restricted | **Real configuration risk.** The clone's number resource accepts inbound SIP from any address (`0.0.0.0/0`). | In ElevenLabs, turn inbound off on `phnum_8101…b864`, or restrict it to Vobiz's addresses (owner action; not changed here) |
| 12c post-call webhook | **Expected until staging exists.** | Register after deployment (§11.4 of the runbook) |
| 12g fallback edge | **Agent design gap.** No route for an unknown `call_purpose`. Sahayak can only send the six (schema-validated). | Add a fallback edge in the clone (see `RIYA_AGENT_PROPOSED_CHANGES.md`) |
| 11g (UNVERIFIED) | The source agent is not readable with this key. | Confirm in Varunesh's workspace that his number is still assigned to his agent; `-Step Verify` now requires `-SourceNumberCheckedManually` for this |

**Passing checks:**
- target ≠ source;
- six branches, with variables exactly Sahayak's 14;
- number assigned to the clone, with SIP, outbound, TCP and outbound auth;
- recording off, audio deleted, transcripts 30 days with PII deletion;
- auth on, limits 50 per day and concurrency 2;
- AI disclosure in the opening, and caller overrides locked.

## 5. Is `sampark-nonprod` needed?

Yes, for any real Riya call outside production.
- Staging runs `NODE_ENV=production` in the production project, so Sampark's own guard would allow the `(default)` database.
- `providerFor` refuses ElevenLabs calls unless `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod`, unless a reviewed production rollout sets `SAMPARK_RIYA_PRODUCTION_DATA_APPROVED`.

It holds only Sampark collections. Organisation and admin records still come from `(default)` (read-only). Nothing is copied into it: the staging school's students and guardians are entered or imported there as **synthetic** records, and your own phone is only the school's test phone.
