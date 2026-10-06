# Sampark — Phase 2a build contract: real notice calls in Test mode

**Goal:** a school admin puts Sampark in **Test** mode with their own phone number, approves a campaign, and every call the campaign would make rings **only that phone**: the parent-facing audio plays through Vobiz, keypresses (1, 2, 9) are recorded, and outcomes appear in the call log exactly as for a parent. **Live mode (real parents) stays impossible in this phase.**

Read first: `SAMPARK_PLAN.md` (§4 ⑦⑧, §10, §13, §16 rows 1, 26, 31, 33, 35), `SLICE1_CONTRACT.md` (conventions, ownership rules, how to run tests). All slice-1 contracts still hold.

Facts this design rests on (checked against Vobiz's docs, 2026-10-07):
- `<Gather action method="POST" inputType="dtmf" numDigits="1" executionTimeout="N" finishOnKey="none">` with a nested `<Play>`; the action URL receives form fields `CallUUID, From, To, InputType, Digits`. `executionTimeout` (5–60 s) starts after the nested Play ends; if nothing is pressed Vobiz continues with the next element.
- `<Play>` streams MP3 or WAV from an HTTPS URL; 8 kHz mono recommended. **We serve 16-bit PCM WAV** (`toPcm16Wav`, already in `src/server/sampark/audio-format.ts`), never μ-law, to avoid any decoder doubt.
- The answer URL receives `Event=StartApp` when the callee answers. Ring and Hangup events reach the ring/hangup URLs; Hangup is authoritative and carries `CallUUID, Status, Duration` (and in our existing attendance code `HangupCause`, `BillDuration`). Callbacks are **retried up to 3 times on non-200**, so every handler must be idempotent and must always answer 200 (XML for answer/gather).
- Callback URLs must be HTTPS.

## 1. File ownership (parallel streams — never edit another stream's files)

| Stream | Owns |
|---|---|
| **V — voice runtime** | `src/lib/sampark/voice/**` (new), `src/server/sampark/voice.ts` (new), `src/app/api/webhooks/sampark-voice/**` (new routes), the `burnToken` addition in `src/lib/sampark/ports.ts`, `src/lib/sampark/repo/memory.ts` and `src/lib/sampark/repo/firestore.ts` (that method only), `src/__tests__/sampark/voice/**` |
| **D — dispatch & carrier** | `src/lib/sampark/dispatch/**` (incl. new `vobiz-carrier.ts`, new `settle.ts`, `dispatcher.ts`, `state.ts`), `src/lib/sampark/policy/gate.ts`, `src/server/sampark/carrier.ts`, `src/server/sampark/jobs.ts`, `src/__tests__/sampark/engine/**` (update/add), `src/__tests__/sampark/server/carrier.test.ts` |
| **U — settings & console** | `src/server/sampark/school.ts`, `src/server/sampark/overview.ts`, `src/app/api/sampark/[orgId]/{school,mode}/**`, `src/app/sampark/**`, `src/components/sampark/**`, `src/lib/api/sampark.ts`, the ten `src/locales/*.json` (new keys only), `src/__tests__/sampark/server/school*.test.ts` (new), `src/__tests__/api/sampark/routes.test.ts` (mode/school cases only) |

## 1a. Already landed by the integrator (code against these; do not edit them)

- `src/lib/sampark/dispatch/settle.ts` — `settleCall(deps, orgId, callId, { retryable?, recompute? })` (idempotent via `settledAt`), `settleIntentPatch`, `recordOptOut` (a 9 on a `test_phone` call only audits, never suppresses), `finishCampaign`.
- `src/lib/sampark/voice/tokens.ts` — `mintSamparkVoiceToken`, `verifySamparkVoiceToken`, `voicePrincipal`, `parseVoicePrincipal`, `tokenBurnKey`, `tokenExpiry`, `SAMPARK_VOICE_TTL_SECONDS`.
- Repo (`ports.ts`, memory, firestore): `listExpiredDialingCalls` is now **`listExpiredOpenCalls`** (dialing/ringing/in_progress past `leaseUntil`); **`mutateCall(orgId, callId, fn)`** — a transactional read-modify-write that every webhook MUST use to apply an event (concurrent ring/answer/keypad/hangup would otherwise regress state); **`burnToken(key, expiresAt)`**.
- `src/server/sampark/carrier.ts` — `samparkPublicBaseUrl()` (https origin from env only), `liveDialBlocker()` → `'LIVE_DIAL_DISABLED' | 'PUBLIC_BASE_URL_MISSING' | 'CARRIER_UNCONFIGURED' | null`.
- `SamparkSchool.testPhoneHash` (peppered hash of the test phone). **A test call records the TEST phone's hash and last four** (`phoneHash`, `phoneLast4`), never the guardian's, so a rehearsal can neither count towards a parent's frequency cap nor suppress a parent.
- Overview DTO already has `liveDialAvailable` (placeholder `false`) and `testPhoneLast4`.

Shared types in `src/types/sampark.ts` are changed ONLY by the integrator; the additions below are already landed:
- `SamparkCall.destination: 'guardian' | 'test_phone'` (required on new calls; treat missing as 'guardian').
- `SamparkCall.vobizCallUuid?: string | null` (the CallUUID Vobiz reports on answer/gather/hangup; distinct from `providerCallId`, the request UUID returned when placing).
- `SamparkCall.settledAt?: string | null` (set exactly once when the intent/suppression/counts were updated from this call's terminal state).
- `SamparkOverview.school` gains `liveDialAvailable: boolean` and `testPhoneLast4: string | null`; `SamparkSchool` already has `testPhoneEnc` / `testPhoneLast4`.

## 2. Environment (new)

| Variable | Meaning |
|---|---|
| `SAMPARK_LIVE_DIAL_ENABLED` | Must be `'true'` for any non-simulated carrier to be constructed or any voice webhook to return call XML (already declared `false` in cloudbuild) |
| `SAMPARK_PUBLIC_BASE_URL` | HTTPS origin Vobiz can reach (e.g. a Cloud Run URL, or a `trycloudflare.com` tunnel locally). The carrier builds every callback/audio URL from this — **never from the request Host header** (plan §16 row 21). Missing or non-https → the carrier refuses to construct |
| `SAHAYAKAI_REQUEST_SIGNING_KEY` | Existing HMAC key (via `getSecret`) for the voice tokens |
| `VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, `VOBIZ_FROM_NUMBER`, `VOBIZ_BASE_URL` | Existing; read via `readVobizConfig()` in `src/lib/vobiz/client.ts` (reuse `placeVobizCall` — do not modify `src/lib/vobiz/*`) |

## 3. Stream D — dispatch, carrier, gate (exact exports)

```ts
// src/lib/sampark/dispatch/settle.ts  (extract from dispatcher.ts; dispatcher calls it for the simulated path)
/** Idempotent: no-op unless call is terminal AND call.settledAt is null AND the intent's lastCallId === call.id
 *  and intent.status === 'dialing'. Updates the intent (done | retry_wait | expired per catalogue retry rules),
 *  writes keypad suppressions (digits '99' confirmed / '9' requested → scope 'routine', officeVerification 'pending';
 *  never overwrite an effective suppression), recomputes campaign counts (+ completion), and sets call.settledAt. */
export function settleCall(deps: { repo: SamparkRepo; clock: Clock }, orgId: string, callId: string): Promise<'settled' | 'noop'>;

// src/lib/sampark/dispatch/vobiz-carrier.ts
export interface VobizNoticeCarrierDeps {
  config: VobizConfig;                 // from readVobizConfig()
  publicBaseUrl: string;               // SAMPARK_PUBLIC_BASE_URL, must be https://
  mintToken: (domain: SamparkVoiceDomain, principal: string, ttlSeconds?: number) => Promise<string>; // stream V's tokens.ts
  place?: typeof placeVobizCall;       // injectable for tests
}
/** kind 'vobiz'. place(): REFUSES unless classifyPhone(destinationE164) === 'mobile'; mints an answer token and a
 *  status token for principal `${orgId}~${callId}`; calls placeVobizCall with
 *    answerUrl  = `${base}/api/webhooks/sampark-voice/answer?t=…`
 *    hangupUrl  = `${base}/api/webhooks/sampark-voice/status?kind=hangup&t=…`
 *    ringUrl    = `${base}/api/webhooks/sampark-voice/status?kind=ring&t=…`
 *  returns { ok: true, providerCallId: requestUuid, events: [] } or { ok:false, reason, retryable } mapping
 *  VobizFailure categories (network/provider_rejected → retryable). Never logs the number. */
export function createVobizNoticeCarrier(deps: VobizNoticeCarrierDeps): Carrier;
```

Dispatcher / state changes:
- **Real-carrier lifecycle.** After a successful `place` with no events, the call stays `dialing` with `providerCallId` stored (apply `'placed'`) and its `leaseUntil` extended to now + `REAL_CALL_LEASE_MS` (15 min). The intent stays `dialing` until the hangup webhook calls `settleCall`. The existing sweep, now on `listExpiredOpenCalls`, hands any call whose hangup never arrived to a person (`unknown` / `needs_review`), never re-dialled. Use `repo.mutateCall` for the post-place update so a webhook that already moved the call to ringing/in_progress is not overwritten.
- `settleCall` replaces the inline settle logic for the simulated path (behaviour unchanged; all existing engine tests must still pass).
- **Destination.** `DispatchDeps.destinationFor` returns `{ e164: string; kind: 'guardian' | 'test_phone' }`. The call record stores `destination`. In **test** mode the destination is always the school's test phone (decrypted from `testPhoneEnc`); in practice mode the guardian's number; **live mode → the dispatcher refuses** (no live dialing in phase 2a).
- **Gate.** `GateInput.destination?: 'guardian' | 'test_phone'`, defaulting to `school.mode === 'test' ? 'test_phone' : 'guardian'` so every existing caller (materialise, dry run, dispatch) is right without change. For `test_phone`, the synthetic-number and demo-school blocks do **not** apply (the number dialled is the verified test phone); every other rule still applies, including `SAMPARK_LIVE_DIAL_ENABLED` for the vobiz carrier, consent, suppressions, hours. Class gate 4 still holds for `guardian` destinations.
- **Carrier selection** (`src/server/sampark/carrier.ts`): practice → simulated; test → requires `SAMPARK_LIVE_DIAL_ENABLED==='true'`, a Vobiz config, `SAMPARK_PUBLIC_BASE_URL` https, and a test phone on the school, else throws `LIVE_DIAL_DISABLED` / `TEST_PHONE_MISSING`; live → throws `LIVE_MODE_NOT_AVAILABLE`.
- **Dispatch cap in test mode:** at most **1 call in flight** per school (`maxInFlightPerSchool` 1 when mode is test) so a test campaign rings the phone one call at a time.
- Tests: settle idempotency (twice → once), real-carrier lifecycle (place → no events → not swept at 2 min → hangup via settle → done), stale sweep, gate destination semantics, carrier refuses synthetic/non-https/missing base, URLs built from base not Host, failure mapping, test-mode cap. Update gate-02 allowlist if needed for `vobiz-carrier.ts`.

## 4. Stream V — voice runtime (exact exports)

```ts
// src/lib/sampark/voice/tokens.ts  — same wire shape and HMAC scheme as src/lib/vobiz/tokens.ts (do not modify that file)
export type SamparkVoiceDomain = 'sampark-answer' | 'sampark-gather-menu' | 'sampark-gather-optout' | 'sampark-status' | 'sampark-audio';
export function mintSamparkVoiceToken(domain: SamparkVoiceDomain, principal: string, ttlSeconds?: number): Promise<string>;
export function verifySamparkVoiceToken(domain: SamparkVoiceDomain, token: string | null): Promise<string | null>; // principal or null
// principals: calls → `${orgId}~${callId}`; audio → `${orgId}~${clipKey}`. Principals contain no '.'.
// TTLs: answer 300 s (minted at dial), status 1800 s, gather 120 s (minted fresh in each response), audio 900 s (minted at answer/gather).

// src/lib/sampark/voice/xml.ts — pure builders, every interpolated value XML-escaped
export function noticeAnswerXml(o: { messageAudioUrl: string; gatherUrl: string; noInputAudioUrl: string; timeoutSeconds: number }): string;
// <Response><Gather action=gatherUrl method="POST" inputType="dtmf" numDigits="1" executionTimeout=… finishOnKey="none"><Play>message</Play></Gather><Play>noInput</Play><Hangup/></Response>
export function playThenHangupXml(audioUrl: string): string;
export function optOutConfirmXml(o: { promptAudioUrl: string; gatherUrl: string; doneAudioUrl: string; timeoutSeconds: number }): string; // no second 9 → still plays opt_out_done (plan §5.1)
export const EMPTY_HANGUP_XML: string; // '<?xml …?><Response><Hangup/></Response>'

// src/lib/sampark/voice/vobiz-events.ts — pure
export function hangupEventFromVobiz(form: Record<string, string>, at: string): CallEvent; // Status/HangupCause → cause; Duration; BillDuration (or ceil to 60 s units when answered)
```

Service `src/server/sampark/voice.ts` (all functions take `{ repo, clock }` + parsed inputs and return XML or a status object; routes are thin):
- **answer**: verify `sampark-answer` token → load school + call. Refuse with `EMPTY_HANGUP_XML` (still HTTP 200) unless: `SAMPARK_ENABLED` and `SAMPARK_LIVE_DIAL_ENABLED` are `'true'`; school mode is `test`; call not terminal; campaign not cancelled/expired; **calling window open now** for the purpose (`samparkWindowVerdict`); for `guardian` destinations the suppression list still allows it. Then apply `answered` (store `vobizCallUuid` from `CallUUID`), find the message clip via `renderNoticeScript` + `clipKey` (exactly as `makeAudioSecondsFor` in jobs.ts does) and the `no_input` clip, mint audio tokens + a fresh gather-menu token, return `noticeAnswerXml`. If any clip is missing or failed verification → `EMPTY_HANGUP_XML` and mark the call failed with reason `audio_unavailable` (never play unverified audio).
- **A 9 is never lost.** If the gather arrives after the hangup already made the call terminal (the reducer ignores digits on a terminal call), the service still records the opt-out via `recordOptOut` with the outcome it would have had, and audits `call.late_digit`.
- **gather** (`step` from the token domain): **single-use** — `repo.burnToken(sha256(token), expiresAt)` must return true, else respond with `EMPTY_HANGUP_XML`. Apply `digit`. Menu step: `1` → confirm_1 clip then hangup; `2` (only if the purpose's menu has key2) → confirm_2 then hangup; `9` → `optOutConfirmXml` with a fresh optout token; anything else / empty → no_input clip then hangup. Opt-out step: `9` → opt_out_done; anything else → no_input. All clip lookups are verified clips only.
- **status**: verify `sampark-status` token; `kind=ring` → apply `ringing`; `kind=hangup` → apply `hangupEventFromVobiz` then `settleCall` (stream D). Always 200 JSON `{ ok: true }`, idempotent on retries.
- **audio**: verify `sampark-audio` token → stream `toPcm16Wav(clip)` with `Content-Type: audio/wav`, 404 for unknown keys / other org. The route lives at `src/app/api/webhooks/sampark-voice/audio.wav/route.ts` so every `<Play>` URL ends in `.wav` before its query string (players that sniff by extension).
- `ports.ts` + memory + firestore: `burnToken(key: string, expiresAt: string): Promise<boolean>` (create-only doc `sampark_token_burns/{key}` with `expiresAt` for a TTL policy; memory: a Map).
- Routes (all under the already-public `/api/webhooks/` prefix; no middleware change): `src/app/api/webhooks/sampark-voice/{answer,gather,status,audio.wav}/route.ts`, GET+POST for answer/gather/status (form or query params), `dynamic = 'force-dynamic'`, `runtime = 'nodejs'`, 404 JSON when `SAMPARK_ENABLED !== 'true'` **except** that answer/gather must still return valid XML (`EMPTY_HANGUP_XML`) so a call in flight hangs up cleanly.
- **Class gates (tests):** (a) the answer service refuses outside the calling window (clock-driven test) and outside test mode; (b) a gather token works once — a replayed URL with `Digits=9` creates no suppression; (c) every token domain is rejected by every other verifier; (d) no route in `src/app/api/webhooks/sampark-voice/` builds a URL from the request Host header (static scan); (e) unverified or missing audio never reaches `<Play>`.

## 5. Stream U — settings & console

- `PUT /api/sampark/[orgId]/school` accepts `testPhone: string | null` → normalise with `normalizeIndianPhone`, require `classifyPhone === 'mobile'`, store `testPhoneEnc` (encryptPhone) + `testPhoneLast4`; never return the full number.
- `PUT /api/sampark/[orgId]/mode` with `mode: 'test'` succeeds only when `SAMPARK_LIVE_DIAL_ENABLED==='true'`, a test phone is set, and `SAMPARK_PUBLIC_BASE_URL` is https; otherwise 409 with a specific code (`LIVE_DIAL_DISABLED`, `TEST_PHONE_MISSING`). `live` → 409 `LIVE_MODE_NOT_AVAILABLE`. `practice` always allowed. Audit every mode change.
- Overview/school DTO: `liveDialAvailable` (env flag + base URL + Vobiz config present) and `testPhoneLast4`.
- Console: Settings → Mode card: **Test — my phone only** becomes selectable when `liveDialAvailable`; a test-phone field (shows only last four once saved); switching to Test asks for confirmation stating "every call this school places will ring only the phone ending {last4}, and only inside calling hours". The permanent mode banner shows Test in the warning token with the last four digits. Calls page shows `Test phone` for calls whose destination is the test phone. All new strings through `t()` in all ten locales.

## 6. Done means

- All existing tests still pass; new tests per stream; `npx tsc --noEmit`, eslint on touched files, the i18n ratchet and design-token gate pass.
- With `SAMPARK_LIVE_DIAL_ENABLED` unset, nothing changes: practice mode works exactly as today and every voice webhook returns `EMPTY_HANGUP_XML` / 404.
- Locally (integrator): emulator + dev server + `cloudflared` tunnel as `SAMPARK_PUBLIC_BASE_URL` + Vobiz config from Secret Manager → a Test-mode campaign rings the admin's phone once per family in the audience, one at a time, inside calling hours; keypresses and hangups land in the call log and settle the intents.
