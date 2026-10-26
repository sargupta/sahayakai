# Sampark hardening sprint (H): build contract, 7 Oct 2026

**Why:** three edge-case reviews (`EDGE_CASES.md`) found defects in today's notice runtime (Practice and Test mode, keyed recorded notices) that would touch real families or mislead the school. This sprint fixes them in the code that already rings the founder's phone. Each fix ships with a **class gate**, a test that catches the whole class of bug and not just one instance (repo law 2). Gate file names start `gate-h<n>-`.

**Shared types are frozen.** The integrator has already added them: `src/types/sampark.ts` (`SchoolPause`, `SamparkSchool.pause/manualHolidays/crmHolidays`, `SamparkStudent.primaryGuardianIds`, `Campaign.mode/holdReason/clipKeys`, `CampaignHoldReason`, new `BlockReason`s, `Intent.carrierRequeues`, `SamparkCall.hangupCause/requeue`, hangup event `hangupCause`, `ClipKind 'withdrawn'`, `Suppression.source 'carrier_invalid_number'`, `TodayCallCounts`, `SamparkOverview.rehearsal/pause`), `src/lib/sampark/ports.ts` (`PlaceCallResult.requeue`), and `src/server/sampark/hangup.ts` (`hangupRingingCalls`). If you need a type change, do not make it: describe it in your report.

**Rules for every stream:**
- Edit only the files your stream owns. Never commit, push or touch git.
- The production teacher-call path must be untouched: `src/app/api/attendance/**` and the behaviour of the existing `placeVobizCall` / `hangupVobizCall` in `src/lib/vobiz/client.ts`.
- Keep the code's existing style: comment density, naming, and doc comments that explain *why*.
- When you finish, the following must pass: `npx jest src/__tests__/sampark` (the 1,111 existing tests plus yours), `npx tsc --noEmit -p .`, and `npx eslint` on the files you touched. Update existing tests whose expectations this contract deliberately changes, and say which ones in your report.
- Your report lists every file changed, every gate added, and anything you could not do.

---

## Stream A: dispatch, settle and carrier

**Owns:** `src/lib/sampark/dispatch/{dispatcher,settle,state,counts}.ts`, `src/lib/sampark/intents.ts`, `src/lib/sampark/dispatch/vobiz-carrier.ts`, `src/lib/vobiz/client.ts` (additions only), `src/lib/sampark/voice/vobiz-events.ts`, and in `src/lib/sampark/repo/{memory,firestore}.ts` only the method `countCallsToPhoneSince`. Tests: `src/__tests__/sampark/engine/**`, `src/__tests__/sampark/voice/vobiz-events.test.ts`, and new `src/__tests__/vobiz/**` if needed.

**A1. Practice writes nothing real (H1).**
- `recordOptOut`: a call with `carrier === 'simulated'` never writes a suppression. It only audits `practice_call.opt_out_pressed`, like the test-phone branch does.
- `countCallsToPhoneSince` (both repos) never counts a call whose `carrier` is `'simulated'`. Firestore: add `carrier` to the `select`.
- Gate `gate-h1-practice-writes-nothing-real`: a Practice campaign over many families on the simulated carrier (whose draws include 9 and 99) leaves zero suppressions, and the frequency count for every guardian stays 0.

**A2. Mode pinned, and school pause, at dispatch (H2, H3).** In `processIntent` / `dispatchSchool`:
- A campaign without `mode` holds with `'mode_not_pinned'`. A campaign whose `mode !== school.mode` holds with `'mode_changed'`.
- A school whose `pause` is set holds with `'school_paused'`: every campaign when the scope is `'all'`; for scope `'routine'`, every campaign except `emergency_closure`.
- A hold dials nothing and changes no intent. It writes `holdReason` on the campaign only when the value changes, with an audit entry (`campaign.hold` with the reason, or `campaign.resume`), and counts as skipped. When the condition clears, `holdReason` goes back to null.
- The sweep and the repair still run for a paused school.
- Intents without a campaign: the pause applies; the mode check does not.
- Gate `gate-h2-mode-pinned`: for every pair (campaign mode, school mode) that differs, and for a missing mode, nothing is dialled and no intent changes status.
- Gate `gate-h3-pause`: with a pause of scope 'all', nothing is dialled. With scope 'routine', only `emergency_closure` intents are dialled. Clearing the pause resumes dialling.

**A3. Inactive students and guardians no longer of record (H6, dispatch side).**
- The students passed to the gate are the intent's students that are `active` and still list this guardian in `guardianIds`.
- If none remain, the intent is `blocked`: `'student_inactive'` when every one of the intent's students is inactive or missing, otherwise `'not_guardian_of_record'`.
- Gate `gate-h6-inactive-never-dialled`: a student who leaves after materialisation is never dialled, nor is a guardian who stops being of record.

**A4. Hangup cause table (H7).** In `vobiz-events.ts`, export `HANGUP_CAUSE_TABLE: Record<string, { cause: HangupCause; retryable: boolean; invalidNumber: boolean }>`. It covers at least:

| Cause | Maps to | Retryable | Invalid number |
|---|---|---|---|
| NORMAL_CLEARING | completed | yes | no |
| USER_BUSY | busy | yes | no |
| NO_ANSWER, NO_USER_RESPONSE, TIMEOUT, ALLOTTED_TIMEOUT, SUBSCRIBER_ABSENT | no_answer | yes | no |
| CALL_REJECTED, ORIGINATOR_CANCEL, NORMAL_CIRCUIT_CONGESTION, SWITCH_CONGESTION, NETWORK_OUT_OF_ORDER, NORMAL_TEMPORARY_FAILURE, RECOVERY_ON_TIMER_EXPIRE, NO_ROUTE_DESTINATION | failed | yes | no |
| UNALLOCATED_NUMBER, INVALID_NUMBER_FORMAT, NUMBER_CHANGED | failed | no | yes |
| INCOMPATIBLE_DESTINATION | failed | no | no |

- `hangupEventFromVobiz` sets `hangupCause` to the raw upper-case name when one was sent, and the reducer stores it on the call.
- `settleIntentPatch`: a call whose `hangupCause` is in the table with `retryable: false` ends the intent as `done`.
- `settleCall`: when the cause is marked invalid number and the call rang a guardian on a real carrier (not `test_phone`, not `simulated`), it writes a suppression: `{ scope: 'all', source: 'carrier_invalid_number', officeVerification: 'pending' }`. It never weakens an effective one (same rules as `recordOptOut`), and it audits `number.flagged_invalid`. A test-phone call only audits.
- An unknown cause keeps today's behaviour.
- Gate `gate-h7-hangup-cause-table`: every row maps to the right state, retryability and flag. An invalid number is never retried, and no purpose dials it again because the gate sees the suppression.

**A5. Carrier refusals never spend an attempt; an unknown outcome is never re-dialled (H7).**
- `client.ts`: **add** `placeVobizCallDetailed(config, options, fetchImpl?, { timeoutMs = 8000 })`, leaving `placeVobizCall` exactly as it is (the attendance route depends on it, so add a test proving it is unchanged). The detailed variant returns these categories:
  - `rate_limited`: HTTP 429.
  - `provider_error`: HTTP 5xx. The outcome is unknown, because the call may already have been placed.
  - `dnd_blocked`: a 4xx whose body matches `/\b(dnd|ndnc|do not disturb)\b/i`. Only this classification is kept; the body is never returned or logged.
  - `invalid_destination`, `provider_unconfigured` (401/403), `provider_rejected` (any other 4xx), and `network` (a thrown fetch, or the `AbortController` timeout).
- `vobiz-carrier.ts` uses the detailed variant:
  - `rate_limited` returns `{ ok: false, reason: 'vobiz_rate_limited', retryable: true, requeue: true }`.
  - `provider_error` and `network` THROW, as `network` does today, so the sweep hands the call to a person and it is never re-dialled.
  - `dnd_blocked` is not retryable.
- `intents.ts`: `callIdFor(intentId, attempt, requeue = 0)`. Requeue 0 must give exactly today's id (backward compatible); any other requeue gives a distinct id.
- Dispatcher: `requeue = intent.carrierRequeues ?? 0`; the call id is `callIdFor(intent.id, attempt, requeue)`, and the call record carries `requeue`.
- On a `requeue: true` result, settle through a requeue path. The intent patch is `{ status: 'retry_wait', attempts: call.attempt - 1, carrierRequeues: requeue + 1, notBefore: now + 60–90 s (deterministic jitter from the call id), lastCallId }`, written with the same compare-and-set. Once `requeue + 1 > MAX_CARRIER_REQUEUES` (export it, value 3), the refusal is treated as an ordinary retryable failure, which spends the attempt.
- Every ordinary settle sets `carrierRequeues: 0`.
- Gate `gate-h7-carrier-busy-free`: a 429 never spends an attempt, the fourth one does, every call id is unique, and the claim never jams. Gate `gate-h7-unknown-outcome-never-redialled`: a 5xx or timeout leaves the call for the sweep, the intent becomes `needs_review`, and nothing is dialled again.

## Stream B: campaigns, voice webhooks and scripts

**Owns:** `src/server/sampark/{campaigns,voice,jobs,carrier,hangup}.ts`, `src/lib/sampark/voice/xml.ts`, `src/lib/sampark/scripts/{render,templates}.ts`, `src/locales/call-scripts/*.json`. Tests: `src/__tests__/sampark/voice/**` (except `vobiz-events.test.ts`), `src/__tests__/sampark/scripts/**`, and `src/__tests__/sampark/server/{campaign-flow,carrier}.test.ts`.

**B1. Pin the mode at approval (H2).**
- `approveCampaign` sets `mode: school.mode` on the campaign and includes it in the approval audit.
- `handleSamparkAnswer` refuses (`'campaign_mode_mismatch'`) when `campaign.mode !== 'test'`, including when the mode is missing.
- `handleSamparkAnswer` refuses (`'school_paused'`) when the school's pause applies to the call's purpose.

**B2. Frozen clip keys (H4).**
- When `renderOne` moves a campaign to `'scheduled'`, it computes `clipKeys` for every language rendered × `variantsFor(purpose)`, using the same `renderNoticeScript` + `clipKey` the render job used. It writes them in the same update.
- `verifiedClipKeys` uses `campaign.clipKeys[`${language}|${variant}`]` when present; it still requires the clip to exist, belong to the org and have passed. The re-render path stays only for campaigns without `clipKeys`.
- `makeAudioSecondsFor` uses the frozen message key when present.
- Gate `gate-h4-clip-keys-frozen`: after scheduling, change the school's spoken name and a venue name; an answered call still plays, and so do key 1, key 2 and key 9.

**B3. Never silent after a cancel (H4).**
- Add a `withdrawn` line to every call-script language file, in the same spoken register, naming the school and never saying "recorded". For example, in Hindi: "नमस्ते, मैं {schoolName} से बोल रही हूँ। जिस सूचना के लिए हमने कॉल किया था, वह वापस ले ली गई है, उस पर ध्यान न दें। परेशानी के लिए माफ़ी। नमस्ते।" Write natural equivalents in English, Bengali and Nepali.
- `renderNoticeScript` emits a `withdrawn` clip for every purpose, so the render job renders and verifies it with the rest.
- `handleSamparkAnswer` for a campaign whose status is `'cancelled'`, when a verified `withdrawn` clip exists, records the answer and returns `playThenHangupXml(withdrawn)`, with outcome `'withdrawn'`. Without the clip (an older campaign), it behaves as today.
- `cancelCampaign` calls `hangupRingingCalls(ctx, orgId, { campaignId, reason: 'campaign_cancelled', actor: uid })` after cancelling intents, and records the report (`ringingStopped`, `stillSpeaking`) in the audit entry and in the response.
- All existing script gates must stay green: template parity, Nepali purity, Latin-in-Indic, spoken register, and no "recorded".
- Gate `gate-h4-cancel-never-silent`: a call answered after its campaign is cancelled never gets the empty hang-up when a withdrawn clip exists.

**B4. Invitations end before the event starts (H5).**
- `campaignExpiry` for `ptm_invite` / `event_invite` is the event start minus `INVITE_LEAD_MINUTES` (export it, value 120). The closure expiry is unchanged.
- `validateFacts` refuses with `'TOO_LATE_TO_CALL'` when that expiry is not in the future.
- Gate `gate-h5-invite-expires-before-start`: no invitation intent can be dialled at or after the event start minus the lead, for any time of day.

**B5. One replay instead of a hang-up on an unknown key (H11, interim for the repeat key).**
- In `handleSamparkGather` on the menu step, a key that is not 1, 2 or 9 (or a 1 or 2 the menu does not offer) replays the message with its menu once: `noticeAnswerXml` with a fresh `sampark-gather-menu` token. The second such key gets the no-input goodbye.
- Count the earlier unknown keys from `call.outcome.digits`.
- Do not add a new announced line; that waits for the founder's decision 4.
- Test: one replay, then the goodbye.

**B6. The dry run uses the same rule as the cap.** `summariseAudience` counts only calls on a real carrier to a guardian (not simulated, not `test_phone`), matching A1.

## Stream C: audience, policy, imports, school operations and console

**Owns:** `src/lib/sampark/audience.ts`, `src/lib/sampark/policy/gate.ts`, `src/lib/sampark/crm/**`, `src/server/sampark/{school,overview}.ts`, a new route `src/app/api/sampark/[orgId]/pause/route.ts`, the console under `src/app/sampark/**` and `src/components/sampark/**`, and the UI locale strings those need. Tests: `src/__tests__/sampark/engine/{audience,gate,gate-10-human-only-and-sensitive}.test.ts`, `src/__tests__/sampark/server/{import,csv,rest-source,school-test-mode,gate-school-view}.test.ts`, and new `src/__tests__/sampark/server/*pause*.test.ts`.

**C1. One call per family, primary guardian first (H6).**
- The import sets `primaryGuardianIds` from the CRM links where `isPrimary && isGuardianOfRecord`.
- `bundleAudience`:
  - For each child, if any primary guardian of record is active, consider only those; otherwise consider every active guardian of record.
  - Then merge bundles whose guardians share a `phoneHash`. The representative is the guardian with the most children, ties broken by the lowest id; the merged bundle's children are the union.
  - Keep it deterministic, so materialising twice stays idempotent.
- Gate `gate-h6-one-call-per-number`: Entab-style data, where the same mobile appears under a different guardian id per child, yields exactly one intent per number per campaign, naming every child.

**C2. A child who left is inactive after a full CSV import (H6).** When the source is a full CSV export, any student or guardian of this school that is missing from the file is marked inactive, using the same tombstone path the REST import uses. Incremental REST imports (`updatedSince`) never tombstone by absence. Test both cases.

**C3. Custody restriction blocks every automated call about that child (H8).**
- In `evaluateGate`, right after rule 9: for any purpose, class-wide included, when any of the call's students has `custody_restriction`, block with `'custody_restricted'`. The office informs that family by hand.
- Update the rule list in the header comment.
- Gate `gate-h8-custody`: no purpose ever allows a custody-restricted child's guardian.

**C4. The Test-mode sample (H9).**
- In `materialiseCampaignIntents`, when the campaign's mode (or, if missing, the school's mode) is `'test'`: among the intents that would be `approved`, keep the first per language (by guardian id) as `approved` and create the rest `blocked` with `'test_mode_sample'`.
- Gate `gate-h9-test-mode-samples`: a Test campaign over N families in L languages rings the test phone at most L times.

**C5. A CRM import never removes the school's holidays (H10).**
- `updateSchool` writes the console's list to `manualHolidays`, and `holidays = sorted union(manualHolidays, crmHolidays ?? [])`.
- The import writes `crmHolidays` when the CRM sent holidays, and leaves it unchanged when the CRM did not.
- `manualHolidays` = `latestSchool.manualHolidays` if present; otherwise, for a school that never had the split, the current `holidays` (nothing is lost). Then `holidays` = union.
- Gate `gate-h10-holidays-survive-import`.

**C6. School pause (H3): API and console.**
- `school.ts`:
  - `PauseSchema` = `{ paused: boolean, reason?: string (1–200, required when pausing), scope?: 'routine' | 'all' (default 'all') }`.
  - `setSchoolPause(ctx, orgId, uid, input)`. Pausing sets `pause`, audits `school.pause`, then calls `hangupRingingCalls(ctx, orgId, { reason: 'school_paused', actor: uid, include })`, where `include` skips `emergency_closure` calls when the scope is 'routine'. Resuming clears it and audits `school.resume`. Both are idempotent.
  - `schoolView` passes `pause` through.
- Route `PUT /api/sampark/[orgId]/pause` copies the mode route's pattern exactly: `guardOrgRoute`, `parseBody`, `errorResponse`, and the doc header.
- Console:
  - A clear "Pause all calls" control on the school's overview or settings, asking for the reason and the scope. When paused, a persistent banner: who paused, when, why, and a Resume action.
  - A campaign on hold shows its `holdReason` in plain words.
  - Use the existing components and design tokens only (`docs/DESIGN_TOKENS.md`): no raw palette classes and no hex values. UI strings go through the existing `t()` mechanism, following how the Sampark pages already add strings (check the i18n ratchet script before adding any).
- Tests: the service (pause, resume, idempotence, audit, hang-up called with the right filter) and the route's auth.

**C7. Overview counts by mode (H9).**
- `today` counts only calls to a guardian on a real carrier.
- `rehearsal.practice` counts simulated calls, and `rehearsal.test` counts `destination === 'test_phone'` calls.
- `pause` is passed through. Replace the integrator's placeholder.
- The overview page shows the rehearsal counts under labels that say what they are: "Practice: simulated, no phone rang" and "Test: rang only your test phone". It never shows them as families reached.
- Gate `gate-h9-overview-by-mode`: Practice and Test calls never appear in `today`.
