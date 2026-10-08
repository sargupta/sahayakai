# Parent calling — forensic audit and production plan

Date: 2026-10-08. Scope: the attendance "Call parent" flow and the Parent Calling MCP.
Status: **audit + plan, awaiting approval. No code changed, nothing deployed, no calls placed for this audit.**

Sources of evidence:
- **[code]** the repo (paths relative to the repo root, `file:line` on `main` @ b25a4891).
- **[live]** read-only `gcloud` against project `sahayakai-b4248` and production logs, 2026-09-24 → 10-08.
- **[docs]** provider documentation, fetched 2026-10-08 (URLs in §4).
- **[inference]** marked as such.

---

## 0. Executive summary

1. **Production does not use Twilio.**
   - Production uses **Vobiz** (`VOICE_PROVIDER=vobiz`, `sahayakai-main/cloudbuild.yaml:126`) [code][live].
   - Twilio is only the local default (`call/route.ts:237`) and the `/api/demo-call` lead magnet.
2. **The Twilio account cannot do this job, by design and by account type.**
   - It is a trial account (`cloudbuild.yaml:110-118`).
   - A trial account strips `<Stream>`/`<ConversationRelay>` and rejects a custom TwiML `Url` (our 2026-10-08 test: HTTP 400, code 0) [live][docs].
   - Even a paid Twilio account can only present a **foreign caller ID** to Indian mobiles [docs].
   - The Twilio code path is a turn-based `<Gather>`/`<Say>` loop with 7–17 s of dead air per turn (`parent-call-agent.ts:25-30`) [code].
3. **The right architecture already exists in the repo, but is not what production runs.**
   - `sahayakai-agents/src/sahayakai_agents/telephony/` is a real-time, bidirectional Vobiz ↔ Gemini Live bridge [code].
   - It has: a recorded opener while the model warms up, barge-in with `clearAudio`, multi-turn conversation, REST hangup, a persisted transcript, and a post-call summary.
   - It held the only real two-way conversation in the last 14 days (09-29, 43 s) [live].
4. **Production `sahayakai-telephony` runs unversioned code.**
   - Since 2026-09-29 (revisions 00033–00037) it serves a source-deployed Pipecat/Sarvam bot whose source is in **no branch** [live].
   - That bot crashed on 10-01 (`PipelineTaskParams … 'loop'`).
   - On 10-08 it cold-started for **10.08 s** (min instances unset). Vobiz hung up at +5 s, so the parent heard dead air [live].
   - The Sampark plan (`docs/sampark/CONVERSATION_PLAN.md` §1 on `origin/feature/school-parent-calling`) records the same finding.
5. **The repo's bridge has real correctness gaps on `main`.** Two of them already have fixes on unmerged branches:
   - It reads the teacher's message from the wrong field, so the parent hears a generic call (D1; fix 8b3f52fd, unmerged).
   - Opt-outs are not persisted (D4; fix cfa700fd, unmerged).
   - "Turn" limits count transcription fragments, so calls can end too early (D2).
   - A Live connection failure leaks a task and gives no fallback.
   - Call status writes are unordered.
6. **Recommendation: one architecture, option C.**
   - **Vobiz** (Indian caller ID, media in India), plus the **repo's telephony bridge** deployed declaratively with min instances 1.
   - The bridge's language engine sits behind an `Engine` interface:
     - **Gemini Live** for languages it handles well now (English, Hindi).
     - The **Sampark cascaded engine** (Sarvam STT → director → per-language TTS, hosted in India) for full 11-language coverage.
   - Twilio stays only as a non-production fallback. No new Twilio work.

---

## 1. Lifecycle as it exists today

### 1.1 Production path (Vobiz) — as designed in the repo
```
Teacher → ContactParentModal.handleCall
  → POST /api/attendance/outreach          (plan, ownership, stored E.164, 5-min dedup → parent_outreach{callStatus:initiated})
  → POST /api/attendance/call              (quiet hours, provider switch → forwardToVobiz)
      resolveOutreachTarget: owner + server-side phone (call/route.ts:78-99)
      mint answer(300s)/status(1800s) tokens (lib/vobiz/tokens.ts)
      Vobiz POST /Account/{id}/Call/  answer_url/hangup_url/ring_url  (lib/vobiz/client.ts:101-163)
  Vobiz → POST www.sahayakai.com/api/attendance/vobiz/answer?t=…   (token, quiet hours again, CallUUID)
      → XML <Stream bidirectional keepCallAlive contentType=audio/x-mulaw;rate=8000> wss://sahayakai-telephony/telephony/vobiz/stream?t=&cuid=&lang=
  Vobiz ⇄ WSS sahayakai-telephony  (sahayakai-agents telephony/router.py)
      admission: token domain + burn-once (in-process) + semaphore 8/process
      opener μ-law clip immediately; Gemini Live (gemini-live-2.5-flash@global, voice Aoede) warms
      μ-law8k→PCM16k in; PCM24k→FIR→μ-law8k out; 20 ms pacer; interrupted→clearAudio
      end: model end_call (vetoed until ≥2 parent turns unless opt-out/wrong-number/voicemail/call-back), goodbye regex, watchdog, 45 s idle, 600 s guard
      cleanup: REST DELETE hangup → transcript → summary (gemini-2.5-flash, asia-south1)
  Vobiz → POST /api/attendance/vobiz/status?kind=ring|hangup  (Duration, HangupCause → callStatus, callDurationSeconds)
  Modal polls /api/attendance/call-summary every 5 s, ≤60 polls (~5 min)
```
### 1.2 What production actually runs [live]
| Piece | Live state | Matches repo? |
|---|---|---|
| Web service `sahayakai-hotfix-resilience` (asia-southeast1 and asia-south1) | `VOICE_PROVIDER=vobiz`, `VOBIZ_STREAM_BASE_URL=https://sahayakai-telephony-zwydpvyuca-as.a.run.app`, no test-override numbers (real parents are dialled) | Yes. `TWILIO_PHONE_NUMBER` is set live but not declared |
| Media socket `sahayakai-telephony` | Revision 00037: source-deployed Pipecat/Sarvam bot (`src.main:handle_vobiz_call`); **min instances unset**; timeout 900 s; concurrency 8; CPU always allocated; ingress all; open to unauthenticated callers | **No.** The repo yaml expects the `sahayakai-agents` image with `SAHAYAKAI_TELEPHONY_ONLY=1`, minScale 1. The last such revision is 00032 (09-20). No pipeline deploys this service |
| `sahayakai-agents` | Image `:p2cleanup` (07-04), min instances unset, App Check off | Stale against the repo yaml |
| `sahayakai-voice-call` (asia-south1) | Old Exotel bot, used only if `VOICE_PROVIDER=exotel` | Legacy |
| Secrets | `VOBIZ_AUTH_ID/TOKEN/FROM_NUMBER` v1 enabled; Twilio v5/v7; one shared `SAHAYAKAI_REQUEST_SIGNING_KEY` | OK |
| Feature flags | `parentCallSidecarMode=off`. The carrier is chosen only by env var, not by a flag | — |

### 1.3 Every real call attempt in the last 14 days [live]

| UTC | Answered | Outcome |
|---|---|---|
| 09-29 05:30 | Yes | Repo bridge (agents image): 43 s two-way conversation. The hangup DELETE returned 404 because the call had already ended. **The only real conversation.** |
| 09-30 10:10 | No | Rang ~18 s, no answer |
| 10-01 10:11 | Yes | Pipecat crash `PipelineTaskParams.__init__() got an unexpected keyword argument 'loop'`. Line dropped 3 s after answer |
| 10-01 10:49 | No | Rang ~29 s, no answer |
| 10-08 12:53 | Yes | Cold start: the socket was accepted 10.08 s after the instance started. Vobiz hung up at +5 s, so the parent heard dead air. Then "no streamId in handshake" |

Every `POST /api/attendance/call` returned 200 and Vobiz ring webhooks arrived. **The carrier side works; the failures are in our media service.**

---

## 2. Failures — root causes with evidence

| # | Failure | Exact root cause | Evidence | User-visible symptom | Sev | Fix |
|---|---|---|---|---|---|---|
| F1 | Answered calls are silent, then drop | `sahayakai-telephony` has no min instances; cold start ≈10 s; Vobiz gives up before the WS opens | [live] rev 00037 annotations; 10-08 logs (+10.08 s accept, hangup at +5 s) | Parent says "hello…", hears nothing, line drops | **Critical** | Declarative deploy with `minScale: 1`; readiness gate; alert on WS-accept latency |
| F2 | Production runs unreviewed, unversioned code | Manual `gcloud run deploy --source` of a Pipecat bot (rev 00033–00037, sargvision user, 09-29→10-03); source in no branch | [live] image `cloud-run-source-deploy/…@sha256:f141…`; `git grep handle_vobiz_call` over all remote branches finds nothing | Crashes (10-01 `loop` kwarg) and a handshake bug (10-08); not reproducible or rollback-able | **Critical** | Redeploy the repo bridge from a pipeline; record the old image digest for rollback; ban `--source` deploys for this service |
| F3 | Teacher's generated message not spoken | Bridge reads `spokenScript` or `message`; the outreach route writes `generatedMessage` (`spokenScript` is optional) | `telephony/router.py:389` vs `outreach/route.ts:141,149`; fix 8b3f52fd only on `origin/claude/determined-curie-ew9zr1` | Generic call ("No specific message" in the prompt) | **High** | Merge 8b3f52fd (+ its 112-line test) |
| F4 | Parent opt-out ignored | No Firestore write for `opted_out`; the next click re-dials | `router.py:763-768,1437`; fix cfa700fd unmerged | Parent told "noted", then called again. Compliance risk | **High** | Merge cfa700fd; make the outreach route refuse opted-out numbers |
| F5 | Calls end early or the question veto misfires | Turn limits count `input_transcription` **fragments** (`parent_said.append` per fragment) | `router.py:200,206,908,945,956,966`; the comment at `:911-918` admits fragments | One long sentence trips `max_turns`; a split question is missed | **High** | Count turns on `turn_complete`; evaluate goodbye and question on the merged turn |
| F6 | Live connect/setup failure leaks a task; no fallback | `bridge.stop` is set only in `_run_call`; the pacer loops forever; no retry or recorded fallback | `router.py:1130,1302,1345,1355,1388-1458` | Opener plays, then a hangup; message never delivered; CPU leak per failure | Med | Set stop/cancel in `finally`; on Live failure play the pre-rendered message clip, then hang up and mark `failed_live` |
| F7 | Terminal status can be wrong or overwritten | Call route and answer route both write `initiated`; hangup webhook writes unconditionally; no ordering | `call/route.ts:184`, `vobiz/answer/route.ts:351`, `vobiz/status/route.ts:458` | Record stuck at `initiated`, or a late write regresses the state | Med | Monotonic state machine (initiated < ringing < in_progress < terminal) in a transaction; reconciled reader per CLAUDE.md law 1 |
| F8 | UI cannot show "talking"; gives up at 5 min | `CallStatus` has no `ringing`/`in_progress`/`opted_out`; modal polls ≤ 300 s while calls may run 600 s | `types/attendance.ts:13`; modal `:193` | "Calling…" for the whole call; summary missed on long calls | Med | Add states; poll until terminal or 660 s |
| F9 | Records orphaned at `initiated` | Outreach created before the call route; 409/422/503/500 and retryable failures don't mark it failed | `outreach/route.ts:143`; `call/route.ts:214-229,349,378` | 5-minute dedup lockout; phantom "Calling…" | Med | Mark failed on every non-dialled exit |
| F10 | Answer webhook can start a second stream | Answer token verified but not burned | `vobiz/answer/route.ts:280,364` | Two Live sessions if Vobiz retries (retry behaviour unverified) | Low | Burn answer tokens (shared Firestore burn set, as Sampark's `sampark_token_burns`) |
| F11 | Replay guard is per process | Burn-once set kept in memory; up to 4 instances | `router.py:296-306` | A replayed stream token is accepted on another instance | Low | Shared Firestore burn |
| F12 | `cuid`/`lang` unsigned in the stream URL | Plain query params | `answer/route.ts:369-370` | A valid token holder could DELETE another CallUUID | Low | Bind `cuid` into the signed token |
| F13 | Twilio path: dead air, no barge-in, unheard turns persisted | Turn-based `<Gather>`/`<Say>`; reply model inside a 15 s webhook; transcript overwritten with a stale array | `twiml/route.ts:118-131,323-386`; `parent-call-agent.ts:25-30` (7.6 s and 17.7 s measured) | Robocall feel, "application error" drops | High for Twilio, not on the prod path | Do not invest; keep as non-prod fallback |
| F14 | Twilio cannot reach parents | Trial account: verified numbers only, no `<Stream>`, no custom `Url`; paid account still shows only a foreign CLI to India | `cloudbuild.yaml:110-118`; live test 2026-10-08 (400 code 0); [docs] Twilio India guidelines | Every call fails | Critical for Twilio | Not the production carrier |
| F15 | No AI/recording disclosure | `consentPrologue` never played; `consentNoticeEnabled` defaults false | `types/attendance.ts:267` | DPDP/consent gap | Med | Play the disclosure in the opener (both engines) |
| F16 | No observability of the call end to end | No correlation id across web → Vobiz → telephony → Firestore; no latency metrics or alerts | [live] logs were stitched manually by timestamp | Failures invisible until a teacher complains | Med | `callId` = outreachId on every log line; metrics + alerts (§7) |

Twilio-path defects (13 more) are listed in Appendix A. They do not affect production.

---

## 3. Product contract and acceptance criteria

The flow:

> Teacher clicks **Call parent** → server validates ownership, the stored parent phone, quiet hours, plan, dedup and opt-out → **Vobiz** dials from an Indian number → parent answers → **opener within 1 s** (recorded, in the parent's language, with the school name and the AI/recording notice) → the **generated teacher message** is spoken by the engine → parent talks; the engine hears in real time and replies in voice; barge-in cuts AI audio within 300 ms; this repeats → AI says goodbye → **explicit carrier hangup** → transcript, duration, outcome, opt-out and summary persisted.

| Metric | Target (measured per call) |
|---|---|
| Initiation success (Vobiz 2xx) | ≥ 99% of attempts inside the calling window |
| Answer → first audible audio | ≤ 1.0 s (recorded opener) |
| Answer → generated message audible | ≤ 4 s |
| Parent end-of-speech → AI audio | p50 ≤ 1.5 s, p95 ≤ 3 s |
| Max unexplained dead air | ≤ 3 s, else a filler or nudge |
| Barge-in: parent speech → AI audio stops | ≤ 300 ms after VAD/`interrupted` |
| Language | Spoken and recognised language = `parentLanguage`; no unsupported language is called two-way (falls back to the message-only clip) |
| Duplicated turns or stale audio after interruption | 0 |
| Duration accuracy | Stored `callDurationSeconds` = Vobiz `Duration` ± 1 s |
| Terminal status | Exactly one terminal status, never regressed |
| Webhooks | Idempotent; replay-safe; 100% of hangup webhooks persisted or alerted |
| Max call | 300 s hard (configurable; today 600 s), 45 s idle, 6 completed parent turns |
| Runaway cost | Per-teacher and per-day caps; concurrency ≤ the purchased Vobiz channels (3); min instances 1 |

---

## 4. Provider comparison

Each cell is marked: [docs] = provider documentation; [code]/[live] = our repo or production; [inf] = inference.

| Dimension | Twilio | Vobiz | Exotel | Plivo |
|---|---|---|---|---|
| India outbound | Works, but **foreign caller ID only** [docs: twilio.com/en-us/guidelines/in/voice] | Indian DID after KYC; domestic route; media must stay in India [docs: vobiz.ai/docs/compliance/india/calling-regulations] | ExoPhone (Indian) [docs] | Indian number via an India-region account + KYC [docs] |
| Our account today | Trial: verified numbers only; `<Stream>` stripped; custom Url rejected [docs][live] | Production, working: 5 dials, rings delivered [live]; 3 channels, 1 CPS (Sampark plan) | Legacy `sahayakai-voice-call` service | None |
| Bidirectional stream | `<Connect><Stream>`, μ-law 8 k only [docs] | `<Stream bidirectional keepCallAlive>`; in L16 8/16 k or μ-law; out L16 8/16/24 k or μ-law [docs] | Voicebot applet, on request; PCM16 8 k [docs] | Same model as Vobiz [docs] |
| Barge-in primitive | `clear` + `mark` | `clearAudio` + `checkpoint` | `clear` + `mark` | `clearAudio` + `checkpoint` |
| DTMF on stream | Yes | Not documented | Yes | Not checked |
| Status / duration | Yes | ring/hangup URLs, `Duration` [docs] | `ConversationDuration` [docs] | Yes |
| Hangup API | Yes | Yes [docs] | Not found on the Connect API page | Not checked |
| Recording | $0.0025/min | Yes (format quirk) | `Record=true` | Yes |
| Price to Indian mobile | $0.0496/min + streams $0.0044 [docs] | "On request"; ₹0.45/min claimed by Vobiz [docs]; channels ₹349/month | Not published | Not checked |
| Existing implementation in our repo | Batch Gather/Say (mature but wrong shape); Pipecat orchestrator never deployed | **Full bidirectional bridge + conformance suite (~150 tests), real calls in September** | Old separate service | None (Vobiz's API mirrors Plivo, so it is a cheap fallback) |
| Migration effort | High (new carrier contract, foreign CLI) | **Low: finish and deploy what exists** | High | Medium (same XML/stream model) |
| Production risk | High (answer rates, regulatory) | Medium (young vendor; small channel count) | Medium | Low–medium |

**Decisive facts.**
1. Only Indian-DID carriers present a local number to parents. Twilio cannot [docs].
2. Our Vobiz account already dials and rings parents in production [live].
3. The bidirectional bridge for Vobiz already exists and passed real calls [code][live].
4. The defects are ours (deployment and bridge logic), not the carrier's [live].

---

## 5. Recommendation (single choice)

**Option C: Vobiz + the repo's telephony bridge (`sahayakai-agents/telephony`), deployed declaratively, with the language engine behind an `Engine` interface. Gemini Live is the engine for English/Hindi now. Sampark's cascaded India-hosted engine (Sarvam STT → director → per-language TTS) becomes the engine for the remaining languages.**

Why:
- It is the only path that has actually held a two-way call with a parent. It has the hard-won pacing, opener, barge-in and hangup lessons encoded in tests.
- It presents an Indian number.
- It matches the founder's requirement shape (real-time, interruptible, multi-turn).
- It is the base the Sampark plan already chose.
- Nothing parallel is built: Twilio and Exotel stay as-is behind `VOICE_PROVIDER` for rollback and are not extended.

**Is it production-complete?** No.
- The transport, audio, barge-in, multi-turn, hangup and persistence are implemented.
- The message field (F3), opt-out (F4), turn counting (F5), Live-failure fallback (F6), status ordering (F7–F9), UI states (F8), token hardening (F10–F12), disclosure (F15), observability (F16) and **deployment (F1/F2)** are not.

**Language caveat.** Per the Sampark research (2026-10-07), Gemini Live on Vertex covers English-India and Hindi well, Bengali only as bn-BD, and runs in US/EU regions only. Until the cascade engine lands:
- Two-way calls are enabled for **English and Hindi**.
- Other languages get the generated message as a pre-rendered clip, plus a "the teacher will call you back" close. This is honest one-way delivery, never a wrong-language conversation.
- Removing that gate is the cascade milestone.
- Media-anchoring and data-residency questions for Live (US/EU) must be confirmed with Vobiz. This is listed in §10.

---

## 6. Target architecture and ownership

| Step | Owner | Notes |
|---|---|---|
| UI (ContactParentModal, MCP demo) | web | Shows initiated → ringing → in_progress → terminal; polls until terminal or 660 s |
| Authorization, ownership, stored phone, quiet hours, plan, dedup, opt-out | web `/api/attendance/outreach` + `/call` | Unchanged guarantees; opt-out refusal added |
| Dial | web → Vobiz REST | `time_limit=300`; answer/ring/hangup URLs carry purpose tokens |
| Answer webhook | web `/api/attendance/vobiz/answer` | Burn the answer token; mint a stream token bound to {outreachId, cuid, lang}; return `<Stream>` XML |
| Media WebSocket | **sahayakai-telephony** = `sahayakai-agents` image, `SAHAYAKAI_TELEPHONY_ONLY=1`, minScale 1 | Admission → opener → Engine → pacer → hangup |
| STT / LLM / TTS | Engine: `LiveEngine` (Gemini Live, en/hi) \| `CascadeEngine` (Sampark, later) | Same bridge, pacing, barge-in and hangup code |
| Barge-in | bridge | `interrupted`/VAD → bump generation, flush, `clearAudio` |
| Call lifecycle and hangup | bridge | Engine end signal / watchdog / idle / time cap → REST DELETE, then bookkeeping |
| Status | web `/vobiz/status` | Monotonic transitions; duration and hangup cause |
| Persistence | bridge (transcript, turns, opt-out, summary); web (status, duration) | Incremental transcript writes survive drops |
| Summary and analytics | bridge after hangup | Exactly once (claim doc) |

**Security boundary.**
- The phone number is only ever read server-side.
- Carrier webhooks are authenticated by HMAC purpose tokens. Vobiz has no request signature; the tokens are the control.
- Telephony is reachable only with a single-use stream token.
- Secrets live in Secret Manager. Credentials never reach the browser. PII is redacted from logs.

**Failure fallback.**
- Live/engine down → pre-rendered message clip + polite close + `callStatus: failed_live` + alert.
- Telephony unreachable → Vobiz `fallback` XML plays the clip.
- Carrier error → classified, non-retryable errors release dedup.

---

## 7. Production hardening checklist

- **Security**
  - Server-side destination only (kept); no phone input on the MCP (kept).
  - Purpose-scoped single-use tokens with a shared burn set.
  - `cuid` signed into the token.
  - Opt-out enforced.
  - Quiet hours at every entry point (kept).
  - `time_limit` plus a bridge hard cap.
  - Concurrency ≤ channels.
  - No `--source` deploys of telephony.
  - Secret Manager only.
- **Reliability**
  - Idempotent answer and status handling.
  - Monotonic status.
  - Summary claimed once.
  - Task cleanup on every exit.
  - Fallback clip.
  - `callId` correlation.
- **Voice quality**
  - Opener ≤ 1 s with the disclosure.
  - The correct generated message (F3).
  - Language gate.
  - Barge-in with stale-audio flush (kept).
  - Short spoken replies (prompt).
  - Voice consistency (single voice per call).
- **Operations**
  - Readiness: the telephony `/healthz` checks Firestore and the engine config.
  - Metrics: dial result, answer, ring time, time to first audio, response latency, barge-ins, duration, end reason, summary status.
  - Alerts: WS-accept > 2 s, Live failure rate, `initiated` older than 10 min, dial error rate.
  - Deployment verification: a synthetic stream probe after every deploy.

---

## 8. Test strategy

| Layer | What | Where |
|---|---|---|
| Unit | Turn counting on `turn_complete`; goodbye on the merged turn; status state machine; token binding; opt-out refusal; language gate | agents `tests/unit`, main `__tests__` |
| Integration | Full `vobiz_stream` handler against a fake Vobiz socket + fake Live engine: opener, message, 3 turns, barge-in → `clearAudio`, goodbye → DELETE → transcript/summary once | agents (new `test_telephony_e2e_fake.py`) |
| Provider API | Vobiz dial/hangup request shape (exists); answer XML (exists) | main |
| Webhooks | Answer/status route tests, including replay, out-of-order, duplicate hangup | main (new, none exist today) |
| WS/media | Codec round-trip and pacer (exist); jitter; 20 ms cadence under load | agents |
| Failure injection | Live connect fails → fallback clip; WS drop mid-call; Firestore write failure; Vobiz 429/5xx | agents + main |
| Security | Forged/expired/replayed tokens; other-teacher outreach; opted-out number; arbitrary phone impossible | both |
| Real phone, staging | Allowed numbers only via `VOBIZ_TEST_OVERRIDE_NUMBER` on the preview service | manual, scripted checklist |
| Languages | en, hi two-way; one non-Live language → message-only path | manual |
| No-answer / busy / rejected | Status mapping and dedup release | manual + webhook tests |
| Concurrency | 3 simultaneous calls (= channels) | staging |
| Long call | Hits the 300 s cap → graceful close | staging |
| Interruption | Parent talks over the AI twice | staging |
| Retry | Replay the answer and status webhooks | staging |
| Production smoke | One call to an internal number after each deploy | prod, approval each time |

**Real-phone acceptance**, recorded per call with outreachId, CallUUID and timestamps:
- [ ] Rings a real allowed number
- [ ] Parent answers
- [ ] Opener within 1 s, with the correct greeting and school name
- [ ] Correct language
- [ ] The generated message (not generic) is spoken
- [ ] Parent replies naturally; the AI understands
- [ ] Generated responses over ≥ 3 turns
- [ ] Interruption stops the AI audio and is understood
- [ ] No stale or duplicated audio; dead air ≤ 3 s
- [ ] Goodbye spoken; call ends automatically (REST DELETE logged)
- [ ] Vobiz terminal status correct
- [ ] Duration matches ± 1 s
- [ ] Transcript and summary saved exactly once
- [ ] Opt-out persisted when said
- [ ] Logs correlate by callId; no PII
- [ ] An arbitrary number cannot be dialled
- [ ] Time and cost bounded

---

## 9. Implementation plan (small, reversible commits)

All of this goes on a new branch from `origin/main`. It is coordinated with `feature/school-parent-calling`, which touches only `lib/vobiz/client.ts` among these paths.

1. **Merge the existing bridge fixes.** Cherry-pick 8b3f52fd (message field, F3) and cfa700fd (opt-out, F4) with their tests.
   - Rollback: revert.
   - Risk: conflicts with 0d80044e prompt sections. Take only the two fixes.
2. **Bridge correctness** (`telephony/router.py`).
   - Turns counted on `turn_complete`; goodbye and question checks on the merged turn (F5).
   - Stop and cancel all tasks in `finally` (F6).
   - Store task references (D8).
   - Live-failure fallback clip + `failed_live` (F6).
   - Tests: new unit tests + the fake-socket handler test.
3. **Language gate + disclosure.**
   - Two-way only where the engine supports the language (en, hi for Live); else a message clip + close (§5).
   - Disclosure in the opener (F15).
   - Files: `router.py`, `prompt.py`, opener assets.
4. **Status state machine** (web).
   - `CallStatus` adds `ringing`, `in_progress`, `opted_out`, `failed_live`.
   - Monotonic transactional writer used by the call/answer/status routes (F7).
   - Every non-dialled exit marks `failed` (F9).
   - Modal polls to terminal or 660 s (F8).
   - Tests: new route tests for `vobiz/answer` and `vobiz/status`, including out-of-order and duplicate events.
5. **Token hardening.**
   - Burn answer tokens; shared Firestore burn set; bind `cuid` into the stream token (F10–F12).
   - Coordinate the collection name with Sampark (`sampark_token_burns`).
6. **Engine interface.**
   - Extract `LiveEngine` behind `Engine` in `telephony/`, with no behaviour change (conformance suite must stay green).
   - This is the seam for Sampark's `CascadeEngine`.
7. **Observability.**
   - `callId` on every log line in web and bridge.
   - Log-based metrics + alert policies (WS-accept latency, Live failures, stuck `initiated`, dial errors).
   - A runbook update.
8. **Declarative deploy for `sahayakai-telephony`.**
   - Cloud Build step builds the agents image and applies `deploy/telephony-service.yaml` (minScale 1, `time_limit`).
   - Also: post-deploy stream probe, and `TWILIO_PHONE_NUMBER` declared or removed from cloudbuild.
   - Record the current Pipecat image digest (`sha256:f141b4…`) as the rollback target.
9. **Staging real-phone tests** on `sahayakai-preview`, with `VOBIZ_TEST_OVERRIDE_NUMBER` set to the approved test number. Run the full §8 checklist; record evidence in `docs/mcp/calling/DEV_DEMO_DATA.md`.
10. **Production cut-over and smoke test.** Deploy the bridge to `sahayakai-telephony` through the pipeline, place one approved smoke call, and keep the Pipecat image digest for a one-command rollback.

**Rollback at every step:** `VOICE_PROVIDER` and the telephony image digest are the two switches. Twilio/Exotel code is untouched.

---

## 10. Open questions (owner: product / founder)

1. **Pipecat bot.** Who source-deployed the Pipecat/Sarvam bot to `sahayakai-telephony` (rev 00033–00037)? Is its source anywhere? Replacing it is required for F1/F2, but it may be someone's in-progress experiment.
2. **Sampark coordination.** Agree with the Sampark work (Abhishek) that attendance calls and Sampark share one bridge and one `Engine` interface.
3. **Vobiz.** Confirm whether a Gemini Live session in US/EU violates media anchoring or data-residency expectations. If yes, Live is not viable even for en/hi, and the cascade becomes the only engine.
4. **Channels.** Our Vobiz account has 3 channels and 1 call per second. Is that enough for launch?
5. **Staging test number.** Which number is approved for staging real-phone tests, and how many calls?

---

## Appendix A — Twilio-path defects (not on the production path)

From the Twilio audit (evidence in `twiml/route.ts`, `twiml-status/route.ts`, `parent-call-agent.ts`, `dispatch.ts`):
- Dead air per turn (model inside a 15 s webhook; 7.6 s and 17.7 s measured).
- Agent turns persisted after Twilio timed out.
- Transcript overwritten with a stale array (`twiml:381`).
- The fingerprint dedup misses late redeliveries.
- No barge-in during replies.
- Odia spoken with a hi-IN voice.
- Answering-machine detection delays the greeting and `AnsweredBy` is ignored.
- Non-terminal statuses dropped.
- No terminal-state guard.
- A summary lock that never expires.
- Error code 21219 blamed on the parent.
- The "Singapore edge" gives no media benefit.
- The Pipecat streaming mode was never deployed (`VOICE_PIPELINE_WS_URL` unset everywhere).

---

## 11. Implementation status (branch `feat/parent-call-live-bridge`, from `origin/main` b25a4891)

Code and tests only. **Nothing deployed and no calls placed.** Plan step numbers refer to §9.

| Step | Commit | Status |
|---|---|---|
| 1 Merge existing bridge fixes | 8a0f9c27 (cherry-pick of 8b3f52fd, message field, F3), 46b6da1c (cherry-pick of cfa700fd, opt-out persisted + re-dial refused, F4) | Done |
| 2 Bridge correctness | a56289a3: turns are utterances not fragments (F5); pacer/greeter stopped on every exit (F6); `live_unavailable` + `engineFailure` recorded (F6); task refs kept | Done. **Spoken fallback clip deferred**: it needs new rendered audio per language (TTS) |
| 3 Language gate + disclosure | 3867b1b2: `VOBIZ_DISCLOSE_AI`, `VOBIZ_TWO_WAY_LANGUAGES` (delivery mode on the same Live engine); `voicemail` added to the tool description | Done; **both default OFF** (policy decisions for the founder) |
| 4 Status state machine | 4e6d630e: `src/lib/attendance/reconcile-call-status.ts` (forward-only, first terminal wins, reconciled reader); all writers and readers switched; `ringing`/`in_progress`; first Vobiz webhook route tests (F7, F9) | Done. **Modal poll ceiling (F8) deferred**: touching the modal triggers law 1 tokenization of ~70 raw palette classes; do it as its own UI commit |
| 5 Token hardening (F10–F12) | — | **Deferred, coordinate with Sampark**: a token-format change needs a coordinated two-service deploy, and `feature/school-parent-calling` is reworking voice tokens and shared burns (`sampark_token_burns`). All Low severity |
| 6 Engine interface | — | **Deferred, coordinate with Sampark**: the Sampark plan builds this seam (Cascade + Live) in the same module; doing it here would fork the architecture |
| 7 Observability | 35c9501f: `answer_to_socket_ms` / `telephony.slow_admit` (catches the 10-08 cold start), web correlation logs, `deploy/monitoring/` metrics + alert policies (not applied) | Done |
| 8 Declarative telephony deploy | — | Needs approval to deploy |
| 9 Staging real-phone tests | — | Needs an approved number and a staging deploy |
| 10 Production cut-over | — | Approved in principle (replace the Pipecat source deploy; keep digest `sha256:f141b4…` for rollback) |

### Tests run (Windows dev machine)

- **sahayakai-agents**, `pytest tests/unit -k telephony` with `PYTHONUTF8=1` (matches Linux CI): 292 passed, 4 failed.
  - The 4 failures are pre-existing and identical on `origin/main`: `test_telephony_only_surface.py`, the local FastAPI 0.141 `_IncludedRouter` incompatibility.
  - Ruff and mypy are clean on the touched modules.
- **sahayakai-main**, Jest: call, outreach, suppression and Vobiz suites, plus the new `reconcile-call-status` and `attendance-vobiz-webhooks` tests, all pass.
  - Exception: `lib/vobiz/quiet-hours.test.ts`, the known Windows path-separator failure, also failing on `main`.
  - `tsc --noEmit` passes; ESLint is clean on changed files.
- **Mutation checks:**
  - 7 of 8 new turn/cleanup tests fail on the previous router.
  - 4 of 7 webhook tests fail on the previous routes.

### New configuration (all optional; defaults keep today's behaviour)

| Variable | Service | Effect |
|---|---|---|
| `VOBIZ_DISCLOSE_AI=true` | sahayakai-telephony | First turn states it is an automated assistant |
| `VOBIZ_TWO_WAY_LANGUAGES=English,Hindi` | sahayakai-telephony | Other languages get delivery mode (message, then close) |

### Still required before "DONE" (founder definition)

1. **Deploy the repo bridge declaratively** (step 8):
   - Build the `sahayakai-agents` image and apply `deploy/telephony-service.yaml` with `minScale: 1` to `sahayakai-telephony`.
   - Verify the live revision's min instances.
2. **Staging real-phone test** (step 9) on `sahayakai-preview` with `VOBIZ_TEST_OVERRIDE_NUMBER` = an approved number, using the §8 checklist.
3. **Production smoke call** (step 10).
4. **Confirm with Vobiz:** whether a Gemini Live session in US/EU fits media-anchoring and data-residency (§10 Q3).
5. **Coordinate steps 5–6 with the Sampark branch.**
