# Sampark — Slice 1 build contract

**Slice 1: dummy CRM → import → class-wide notice campaigns (PTM, event, emergency closure) in four languages → simulated dispatch → call log.** Practice mode only: no real carrier can be reached in this slice.

Read first: `docs/sampark/SAMPARK_PLAN.md` (§1 principles, §2 purposes, §4 pipeline, §5 languages, §13 gates). The shared contracts are already written and are the source of truth — do not change their shapes without telling the integrator:

- `src/types/sampark.ts` — domain types and API DTOs
- `src/lib/sampark/catalogue.ts` — purpose catalogue (ptm_invite, event_invite, emergency_closure are `available`)
- `src/lib/sampark/languages.ts` — parent languages and the TTS/STT engine per language
- `src/lib/sampark/ports.ts` — SamparkRepo, CrmSource, Carrier, SpeechSynthesizer, SpeechVerifier, AudioStore, Clock
- `src/lib/sampark/crm/schema.ts` — CRM wire contract (Zod) the dummy CRM must serve
- `src/lib/sampark/phone.ts` — normalise/classify/hash/encrypt phone numbers

Paths below are relative to `sahayakai-main/` unless they start with `mock-school-crm/` (repo root sibling).

## 1. File ownership (parallel agents — never edit another stream's files)

| Stream | Owns |
|---|---|
| **A — dummy CRM** | `mock-school-crm/**` (repo root) and `src/__tests__/fixtures/sampark/**` |
| **B — engine** | `src/lib/sampark/policy/**`, `src/lib/sampark/dispatch/**`, `src/lib/sampark/repo/memory.ts`, `src/lib/sampark/intents.ts`, `src/lib/sampark/closure.ts`, `src/lib/sampark/audience.ts`, `src/__tests__/sampark/engine/**` |
| **C — scripts & speech** | `src/locales/call-scripts/**`, `src/lib/sampark/scripts/**`, `src/lib/sampark/speech/**`, `src/__tests__/sampark/scripts/**`, `src/__tests__/sampark/speech/**`, `scripts/sampark/verify-voice.ts` |
| **D — server & API** | `src/lib/sampark/crm/{rest-source,csv-source,csv,import}.ts`, `src/lib/sampark/repo/{firestore,factory}.ts`, `src/server/sampark/**`, `src/app/api/sampark/**`, `src/app/api/jobs/sampark-{render,dispatch}/**`, `src/__tests__/sampark/server/**`, `src/__tests__/api/sampark/**`, `cloudbuild.yaml` (flags only), `firestore.indexes.json` (sampark entries only), `docs/FEATURE_FLAGS.md` (sampark rows only), `scripts/sampark/{ticker,seed-emulator}.ts` |
| **E — console UI** | `src/app/sampark/**`, `src/components/sampark/**`, `src/lib/api/sampark.ts`, `src/locales/{hindi,kannada,tamil,telugu,marathi,bengali,gujarati,punjabi,malayalam,odia}.json` (new keys only), nav entries in `src/components/app-sidebar.tsx` and `src/components/command-palette.tsx` |

Do **not** run `git add`, `git commit`, `git stash`, `git checkout` or any other git command that changes state — the integrator commits. Do not run `npm install` for the app; if you believe a dependency is required, stop and say so. Run only your own tests: `npx jest <your paths> --coverage=false`. When type-checking, filter to your own files (`npx tsc --noEmit 2>&1 | grep -E '<your dirs>'`) — other streams are mid-edit.

## 2. Environment

| Variable | Meaning | Slice 1 local value |
|---|---|---|
| `SAMPARK_ENABLED` | Every `/api/sampark/**` and `/api/jobs/sampark-*` route returns 404 unless `'true'` | `true` |
| `SAMPARK_LIVE_DIAL_ENABLED` | A non-simulated carrier may be constructed only if `'true'` | unset (false) |
| `FIRESTORE_EMULATOR_HOST` | Required outside production (repo factory refuses otherwise) | `127.0.0.1:8080` |
| `SAMPARK_FIRESTORE_DATABASE` | Named database; `sampark-nonprod` is the only non-emulator value allowed outside production | unset |
| `SAMPARK_PII_KEY` | base64, 32 bytes, AES-256-GCM key for phones | dev value in `.env.sampark.local` (gitignored) |
| `SAMPARK_PHONE_PEPPER` | pepper for phone hashes | dev value |
| `SAMPARK_AUDIO_DIR` | local audio store directory | `.sampark-audio` (gitignored) |
| `CRON_SECRET` | job routes use `requireCronAuth` | dev value |
| `MOCK_CRM_API_KEY` | the dummy CRM's bearer key; Sampark reads it via `school.crm.apiKeySecretName` → `getSecret()` | `mock-crm-dev-key` |

`cloudbuild.yaml` declares `SAMPARK_ENABLED=false,SAMPARK_LIVE_DIAL_ENABLED=false` in BOTH `deploy` and `deploy-mumbai` `--update-env-vars` so the region-parity test passes and turning them on is one reviewed PR.

## 3. Engine exports (stream B) — exact signatures other streams code against

```ts
// src/lib/sampark/intents.ts
export function hashId(input: string): string;                         // sha256 hex, first 32 chars
export function campaignDedupeKey(campaignId: string, guardianId: string): string; // `campaign:${campaignId}:guardian:${guardianId}`
export function intentIdFor(dedupeKey: string): string;                // hashId(dedupeKey)
export function callIdFor(intentId: string, attempt: number): string;  // hashId(`${intentId}#${attempt}`)

// src/lib/sampark/closure.ts
/** 'today' if closureDate is today in IST, 'tomorrow' if it is the next IST day, null otherwise (expired or too early). */
export function chooseClosureVariant(closureDate: string, now: Date): 'today' | 'tomorrow' | null;
/** End of the closure day in IST (23:59:59.999 IST) as a Date. */
export function closureExpiry(closureDate: string): Date;
export function istDateString(at: Date): string;                       // YYYY-MM-DD in IST

// src/lib/sampark/policy/window.ts
export interface WindowVerdict { allowed: boolean; reason: string; nextAllowedAt: Date | null }
/** Routine purposes: school window ∩ [10,20) IST, not an off-day, not a holiday, and never outside the platform 09–21 floor
 *  (reuse checkCallingWindow from '@/lib/calling-hours'). Emergency purposes (spec.emergency): 06:00–21:00 IST any day. */
export function samparkWindowVerdict(school: SamparkSchool, spec: PurposeSpec, at: Date): WindowVerdict;

// src/lib/sampark/policy/language.ts
export function resolveLanguage(guardian: SamparkGuardian, prefs: GuardianPreferences | null, school: SamparkSchool): ParentLanguage | null;

// src/lib/sampark/policy/gate.ts
export interface GateInput {
  school: SamparkSchool; spec: PurposeSpec; guardian: SamparkGuardian; students: SamparkStudent[];
  preferences: GuardianPreferences | null; suppression: Suppression | null;
  recentCallsToPhone: number;           // calls to this phoneHash in the last 30 days (non-emergency)
  carrierKind: CarrierKind;             // the carrier that WOULD place the call
  now: Date; stage: 'materialise' | 'dispatch';
}
export type GateVerdict =
  | { kind: 'allow'; language: ParentLanguage }
  | { kind: 'defer'; until: Date; reason: string }     // outside window → next opening
  | { kind: 'block'; reason: BlockReason };
export function evaluateGate(input: GateInput): GateVerdict;
// Order and rules: purpose not dialable → human_only_purpose; purpose status planned → purpose_not_available;
// guardian inactive / crmDoNotContact → crm_do_not_contact; suppression (scope 'all', or 'routine' for non-emergency) → suppressed;
// phoneClass invalid → invalid_number; synthetic && carrierKind !== 'simulated' → synthetic_number_not_allowed;
// school.isDemo && carrierKind !== 'simulated' → synthetic_number_not_allowed; mode forbids (carrier vobiz while SAMPARK_LIVE_DIAL_ENABLED !== 'true') → mode_forbids_dialing;
// child-audience purpose && any student.sensitiveFlags → sensitive_flag (class-audience purposes are NOT blocked by sensitive flags);
// spec.excludesFeeWaived && any student feeCategory in (rte, waived) → fee_category_excluded;
// consent for spec.consentGroup: 'denied' → consent_denied; not 'granted' → no_consent — EXCEPT spec.emergency && school.emergencyBypassConsent;
// language unresolved → language_unknown; non-emergency && recentCallsToPhone >= 4 → frequency_cap;
// window (dispatch stage only) → defer.

// src/lib/sampark/audience.ts
/** Resolve a campaign's audience to one intent per guardian of record (siblings bundled), gate each at stage 'materialise',
 *  and create intents (status 'approved' or 'blocked') with repo.createIntentIfAbsent. Idempotent. */
export function materialiseCampaignIntents(
  deps: { repo: SamparkRepo; clock: Clock },
  campaign: Campaign, school: SamparkSchool, carrierKind: CarrierKind,
): Promise<{ created: number; existing: number; blocked: Partial<Record<BlockReason, number>> }>;

// src/lib/sampark/dispatch/state.ts
export function applyCallEvent(call: SamparkCall, event: CallEvent): SamparkCall;   // pure, forward-only, never leaves a terminal state
export function classifyHeard(durationSeconds: number | null, audioSeconds: number | null): HeardLevel;
export function isTerminal(state: CallState): boolean;

// src/lib/sampark/dispatch/simulated-carrier.ts
export function createSimulatedCarrier(opts?: { seed?: string }): Carrier;   // deterministic per call id

// src/lib/sampark/dispatch/dispatcher.ts
export interface DispatchDeps {
  repo: SamparkRepo; clock: Clock; holder: string;
  carrierFor(school: SamparkSchool): Carrier;
  /** Destination to dial: guardian's decrypted number, or the school's test phone in test mode. */
  destinationFor(school: SamparkSchool, guardian: SamparkGuardian): Promise<string>;
  /** Seconds of message+menu audio for this intent's language/variant (from rendered clips); null if unknown. */
  audioSecondsFor(school: SamparkSchool, intent: Intent, variant: 'default' | 'today' | 'tomorrow'): Promise<number | null>;
}
export interface DispatchOptions { maxDialsPerSchoolPerTick: number; maxInFlightPerSchool: number; leaseMs: number }
export interface DispatchReport { schools: number; dialed: number; deferred: number; blocked: number; skipped: number; swept: number; errors: string[] }
/** Single-flight (repo.acquireLock('sampark-dispatch')), sweep expired 'dialing' → 'unknown' (intent → 'needs_review'),
 *  then per school: listDueIntents → evaluateGate(stage 'dispatch') → claimIntentForDial → carrier.place → feed events
 *  through applyCallEvent → update call, intent (done | retry_wait with notBefore = now + retryAfterMinutes | done when attempts exhausted),
 *  suppressions (key 9 confirmed or unconfirmed-requested → scope 'routine', officeVerification 'pending'), and campaign counts. */
export function runDispatchTick(deps: DispatchDeps, opts: DispatchOptions): Promise<DispatchReport>;
export function recomputeCampaignCounts(repo: SamparkRepo, orgId: string, campaignId: string): Promise<CampaignCounts>;

// src/lib/sampark/repo/memory.ts
export function createMemorySamparkRepo(opts?: { faults?: { failAfterClaim?: (intentId: string) => boolean } }): SamparkRepo;
```

## 4. Scripts & speech exports (stream C)

```ts
// src/lib/sampark/scripts/render.ts
export type AudienceLabel = { kind: 'school' } | { kind: 'section'; grade: number; section: string };
export interface RenderedScript { clips: { kind: ClipKind; text: string }[]; estimatedSeconds: number; warnings: string[] }
export function renderNoticeScript(input: {
  purpose: PurposeId; facts: CampaignFacts; school: SamparkSchool; language: ParentLanguage;
  variant: 'default' | 'today' | 'tomorrow'; audience: AudienceLabel;
}): RenderedScript;   // throws on an unavailable purpose or a fact the template cannot say
export function variantsFor(purpose: PurposeId): ('default' | 'today' | 'tomorrow')[];   // emergency_closure → ['today','tomorrow']
export function audienceLabelFor(campaign: Campaign): AudienceLabel;  // one section → section label; otherwise school

// src/lib/sampark/speech/clip-key.ts
export function clipKey(speech: SpeechEngineConfig, text: string): string;

// src/lib/sampark/speech/google-speech.ts
export function createGoogleSynthesizer(): SpeechSynthesizer;   // Cloud TTS v1 REST, ADC via google-auth-library, MULAW 8 kHz WAV
export function createChirpVerifier(): SpeechVerifier;          // Speech v2 chirp_2, asia-southeast1

// src/lib/sampark/speech/local-audio-store.ts
export function createLocalAudioStore(dir: string): AudioStore;

// src/lib/sampark/speech/render-job.ts
/** Render every clip a campaign needs (each language present in its audience × variant × clip kind), skipping clips whose key
 *  already exists, verifying 'message' clips by transcribe-back (number-normalised similarity ≥ 0.85), saving RenderedClip
 *  metadata and updating campaign.renderProgress. Does NOT change campaign.status. */
export function runRenderStep(
  deps: { repo: SamparkRepo; synth: SpeechSynthesizer; verifier: SpeechVerifier; store: AudioStore; clock: Clock },
  orgId: string, campaignId: string, languages: ParentLanguage[], opts: { maxClips: number; concurrency: number },
): Promise<{ done: number; total: number; failures: string[]; finished: boolean }>;
```

## 5. API (stream D implements, stream E consumes)

All under `/api/sampark/[orgId]/…` require `x-user-id` (401), `SAMPARK_ENABLED==='true'` (404), and org admin via `requireOrgAdmin(orgId, uid)` in `src/server/sampark/auth.ts` (403): `organizations/{orgId}.adminUserId === uid` OR `organizations/{orgId}/members/{uid}.role === 'admin'`. Errors: `{ error: string }`. Bodies Zod-validated (400).

| Method & path | Body | Response |
|---|---|---|
| GET `/api/sampark/me` | — | `{ schools: { orgId: string; displayName: string; enabled: boolean }[] }` (orgs the user administers) |
| POST `/api/sampark/[orgId]/enable` | `{ displayName: string }` | `SamparkSchool` (creates practice-mode record if absent) |
| GET `/api/sampark/[orgId]/overview` | — | `SamparkOverview` |
| GET `/api/sampark/[orgId]/school` | — | `SamparkSchool` |
| PUT `/api/sampark/[orgId]/school` | `{ displayName?, spokenName?, callingWindow?, holidays?, venues?, defaultLanguage?, crm? }` | `SamparkSchool` |
| PUT `/api/sampark/[orgId]/mode` | `{ mode }` | `SamparkSchool`; anything but `practice` → 409 `{ error: 'LIVE_DIAL_DISABLED' }` in slice 1 |
| POST `/api/sampark/[orgId]/imports` | `{ source: 'rest' }` or `{ source: 'csv', studentsCsv: string, guardiansCsv: string }` | `ImportRun` |
| GET `/api/sampark/[orgId]/imports/latest` | — | `ImportRun \| null` |
| GET `/api/sampark/[orgId]/guardians?language=&q=&limit=` | — | `{ guardians: GuardianRow[] }` where `GuardianRow = { id, displayName, relation, phoneLast4, phoneClass, language: ParentLanguage \| null, consent: Record<ConsentGroup, ConsentStatus>, suppressed: boolean, students: { id, displayName, grade, section }[] }` |
| PATCH `/api/sampark/[orgId]/guardians/[guardianId]/preferences` | `{ language?: ParentLanguage \| null, consent?: Partial<Record<ConsentGroup, 'granted' \| 'denied' \| 'unknown'>> }` | `GuardianPreferences` |
| GET `/api/sampark/[orgId]/suppressions` | — | `{ suppressions: Suppression[] }` |
| GET `/api/sampark/[orgId]/campaigns` | — | `{ campaigns: Campaign[] }` |
| POST `/api/sampark/[orgId]/campaigns` | `{ purpose, facts, audience, notBefore? }` | `Campaign` (status `draft`) |
| GET `/api/sampark/[orgId]/campaigns/[id]` | — | `{ campaign: Campaign, audience: { guardians: number; byLanguage: Record<ParentLanguage \| 'unknown', number>; blocked: Partial<Record<BlockReason, number>> } }` (dry-run gate at stage 'materialise', no writes) |
| POST `/api/sampark/[orgId]/campaigns/[id]/preview` | `{ languages?: ParentLanguage[] }` | `{ previews: ScriptPreview[] }` (text always; `audioKey` set when the clip exists) |
| POST `/api/sampark/[orgId]/campaigns/[id]/approve` | — | `Campaign` (`draft` → `rendering`; audit entry) |
| POST `/api/sampark/[orgId]/campaigns/[id]/cancel` | — | `Campaign` (and its non-terminal intents → `cancelled`) |
| GET `/api/sampark/[orgId]/calls?campaignId=&limit=` | — | `{ calls: CallLogEntry[] }` |
| GET `/api/sampark/[orgId]/audio/[key]` | — | `audio/wav` bytes (org-scoped: the clip's orgId must match) |
| POST `/api/jobs/sampark-render` | — (Bearer CRON_SECRET) | render step for every `rendering` campaign; when finished with no failures → `materialiseCampaignIntents` → `scheduled`; failures → `render_failed` |
| POST `/api/jobs/sampark-dispatch` | — (Bearer CRON_SECRET) | `runDispatchTick` report; campaigns move `scheduled` → `dispatching` → `completed` when every intent is terminal |

Carrier selection in slice 1 (`src/server/sampark/carrier.ts`): `practice` → `createSimulatedCarrier()`; any other mode → throw `LIVE_DIAL_DISABLED` unless `SAMPARK_LIVE_DIAL_ENABLED==='true'` (and there is no Vobiz adapter in slice 1 anyway).

## 6. Dummy CRM (stream A) — must serve exactly `src/lib/sampark/crm/schema.ts`

Seed: "Hillview Demo School, Siliguri". Grades 1–10 × sections A, B; ~20 students per section (≈400). Guardian languages ne 40% / bn 25% / hi 20% / en 15%. Deterministic generator (fixed seed). All phones `+915` + 9 digits, `synthetic: true`. Consent: ~80% granted for `notices`, ~12% unknown, ~8% denied. Planted cases: siblings in different grades sharing guardians; a blended family (one guardian `isGuardianOfRecord: false` for a step-child); RTE-quota students; a child with `sensitiveFlags`; a guardian with `doNotContact: true`; guardians with `preferredLanguage: null`; 3 malformed records reachable only via `?includeMalformed=true` or the CSV export's `?includeMalformed=true` (to prove quarantine). Holistic-card entries, attendance, events and a communications write-back endpoint are generated/served too (for slices 2–3), plus a demo page at `/`.

## 7. Definition of done (slice 1)

1. `mock-school-crm` runs (`npm start`, port 4700) and its own tests pass.
2. Against the Firestore emulator, an org admin (dev-token → `dev-user-123`, seeded as `adminUserId` of org `hillview-demo`) enables Sampark, points it at the dummy CRM, imports via REST and via CSV, and sees rejected rows with reasons.
3. PTM, event and closure campaigns preview in English, Hindi, Bengali and Nepali (text + audio); every message clip passes transcribe-back.
4. Approving a campaign renders, materialises intents (blocked ones with reasons), and the dispatch job places simulated calls only inside the window; outcomes appear in the call log with heard-level, keys, and opt-outs recorded as suppressions.
5. `npx tsc --noEmit`, `npx jest`, `npm run lint`, the design-token and i18n gates, and `npm run build` pass.
6. Class gates present and failing when broken: 2 (only dispatcher imports carriers), 3 (crash after claim → no second dial), 4 (synthetic/demo never reach a real carrier), 5 (repo env guard), 6 (template parity, no placeholders, no Latin abbreviations in Indic templates), 7 (Nepali per-sentence gate passes Nepali, fails Hindi), 8 (no promotional purpose schedulable), 13 (create-only intents), 14 (D4 variant and expiry), 15 (Nepali TTS uses ne-NP + pinned model).
