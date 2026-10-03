# Sampark voice bake-off

How the school's voice is chosen per language, with evidence and a native listener's sign-off, not by the author's ear. Companion to `SAMPARK_PLAN.md` section 5 (engines per language) and `scripts/sampark/verify-voice.ts` (the live proof of the current voices).

**Status of this document.** Written 3 Oct 2026 in a sandbox with no Google Cloud, Sarvam or ElevenLabs credentials. The harness is built and covered by tests with fakes; **no real audio has been rendered by it yet, and every statement about Sarvam and ElevenLabs below is UNVERIFIED against the live APIs.** Section 8 lists exactly what to check first.

## 1. What exists

| Piece | Where |
|---|---|
| Voice settings as data: provider, model, voice, locale, pace, style hint, status, reviewer sign-off, per language x purpose group | `src/lib/sampark/voice-profiles.json`, typed and validated by `src/lib/sampark/voice-profile.ts` |
| The renderer reads the profile (`speechFor(language, purpose)`); the default profile reproduces the old payloads and clip keys byte for byte (tested) | `languages.ts`, `speech/google-speech.ts`, `speech/clip-key.ts`, `speech/render-job.ts` |
| Pluggable `Synthesizer` (profile in, 8 kHz mu-law WAV out) | `speech/synthesizer.ts` (Google), `speech/sarvam-speech.ts` (Sarvam Bulbul v3, UNVERIFIED, env-flagged) |
| Bake-off harness: candidates x existing scripts, existing gates, scorecard | `scripts/sampark/voice-bakeoff.ts`, `scripts/sampark/lib/bakeoff.ts` |
| Benchmark-only ElevenLabs provider (never imported by `src/`, tested) | `scripts/sampark/lib/elevenlabs-benchmark.ts`, `benchmark-candidates.json` |
| Dry-run fakes | `scripts/sampark/lib/fakes.ts` |
| Tests | `src/__tests__/sampark/voice/*` |

**Purpose groups** (a profile can differ per group): `class_teacher_request` (A1-A4 requests to talk), `recognition` (A5), `fees_accounts` (C1-C6), `closure_emergency` (D4 and urgent day-of notices D5-D7), `ptm_event_invite` (B1, B2, B4, D1-D3, D8-D9). The mapping is `purposeGroup()` in `voice-profile.ts`; a purpose added later falls back by catalogue family, so it never lacks a voice.

**What ships today.** Every group in every language has one `current` profile equal to the pre-profile behaviour: English, Hindi and Nepali on Gemini-TTS `gemini-2.5-flash-tts`, voice Kore, style hint "Warm, calm and unhurried." (message clips only); Bengali on Chirp 3 HD `bn-IN-Chirp3-HD-Kore`; Nepali pinned to `ne-NP`. Nothing changes until a reviewer-approved profile is promoted (section 6).

**Not yet scripted.** Only `ptm_invite`, `event_invite` and `emergency_closure` have reviewed scripts today, so the bake-off can score only the `ptm_event_invite` and `closure_emergency` groups. The other three groups appear as "Not run: no reviewed scripts for this purpose group yet" and light up automatically once their purposes become `available` and have sample facts in `scripts/samples.ts`.

## 2. Running it with real credentials

Prerequisites: `npm ci` in `sahayakai-main`, `gcloud auth application-default login` (or a gcloud login; the script falls back to `gcloud auth print-access-token`), billing project `sahayakai-b4248` unless `SAMPARK_GCP_PROJECT` is set. Cost: Google calls are a few rupees per language per profile (about 20 clips each).

```bash
cd sahayakai-main

# 0. Prove the harness first (no credentials, no network):
npx tsx scripts/sampark/voice-bakeoff.ts --dry-run --out /tmp/bakeoff-dry

# 1. Google only: current profiles and Google candidates, all four languages.
npx tsx scripts/sampark/voice-bakeoff.ts --out ./bakeoff-2026-10 --lang ne,hi,bn,en

# 2. One language, chosen profiles only (no re-render of current):
npx tsx scripts/sampark/voice-bakeoff.ts --out ./bakeoff-2026-10 --lang hi --no-current \
    --profiles hi-chirp3-hd-kore,hi-chirp3-hd-kore-slow,hi-gemini-pro-kore

# 3. Add Sarvam Bulbul v3 (Hindi, Bengali, English only; UNVERIFIED adapter):
SARVAM_BULBUL_ENABLED=1 SARVAM_API_KEY=... \
npx tsx scripts/sampark/voice-bakeoff.ts --out ./bakeoff-2026-10 --lang hi,bn,en --no-current \
    --profiles hi-sarvam-priya,hi-sarvam-ritu,bn-sarvam-priya,en-sarvam-priya

# 4. Optional ElevenLabs calibration (benchmark only; needs voice ids filled in, no Nepali):
#    edit scripts/sampark/lib/benchmark-candidates.json: replace REPLACE_*_VOICE_ID
ELEVENLABS_BENCHMARK_ONLY=1 ELEVENLABS_API_KEY=... \
npx tsx scripts/sampark/voice-bakeoff.ts --out ./bakeoff-2026-10 --lang hi --no-current \
    --profiles hi-elevenlabs-benchmark
```

Flags: `--out <dir>` (required), `--lang en,hi,bn,ne`, `--groups closure_emergency,ptm_event_invite`, `--profiles <id,...>`, `--no-current`, `--concurrency N` (default 3; Gemini-TTS has a low per-minute quota, the adapter backs off on 429), `--dry-run`.

Output in `--out`: `<lang>/<profile>/<group>/*.wav` (8 kHz mu-law, exactly what a parent's phone would play, message clips with the 0.8 s lead-in), `scorecard.json`, `SCORECARD.md`. Re-running writes the scorecard for that run only; use a new `--out` per round and keep them.

A provider that is not enabled is reported as "Not run" with the reason, never silently scored. Exit code is 0 whenever the harness ran: a failing voice is a result, not an error.

## 3. What the machine measures

Every clip goes through the production path (`synthesizeClip`): lead-in silence on the message, transcribe-back with Chirp 2, up to two re-renders, then:

| Gate | Pass rule |
|---|---|
| Transcribe-back | normalised similarity to the script >= 0.85 (same normaliser as production: number words, digits, nukta, script folding) |
| Runaway | spoken seconds <= estimate x 1.5 + 1 s (catches a voice that adds or repeats words, or reads its instruction aloud) |
| Message length | message + menu + lead-in <= 38 s (leaves headroom inside one billing unit) |
| Billing unit | reported, not a gate: longest message as a percentage of a 60 s unit, and a flag if any clip exceeds 60 s |

A profile's **Gates** column is PASS only if every clip passes every gate. The blank columns are for people: **Pronunciation** (names, numbers, dates), **Warmth**, **Phone clarity**, then **Reviewer**, **Date**, **Verdict**.

The machine cannot judge accent, naturalness, dialect fit, or whether a number sounds wrong but transcribes right. A high similarity is necessary, never sufficient.

## 4. Scoring rubric for native reviewers

Each reviewer scores each profile **per group**, 1 to 5, listening on a real phone call or a phone speaker at normal volume, not studio headphones. Use the rendered `.wav` files; send them to the reviewer's phone.

| Criterion | 5 | 3 | 1 |
|---|---|---|---|
| **Pronunciation of names, numbers, dates** | Every number, the date, the time, the school name and the class said as a local would say them | One slip that a parent would notice but understand | A number, date or name is wrong or unintelligible |
| **Warmth** | Sounds like a school that cares; calm, not a machine reading | Neutral, acceptable | Cold, harsh, theatrical or patronising |
| **Clarity on a phone** | Every word clear at 8 kHz on a small speaker, pace comfortable | Clear but rushed or slightly muffled | Words run together, too fast, tinny or hissy |

A score of 1 on any criterion is an automatic **needs_work** or **rejected**, whatever the average. Reviewers also note, free text: wrong dialect or register (Kathmandu-formal versus Darjeeling, Bangladeshi versus West Bengali Bangla), anything that sounds like Hindi in a Nepali clip, any added or missing word.

## 5. Native reviewer procedure

1. **Who.** One native speaker per language, from the school's own teachers (Nepali and Bengali speakers from Darjeeling/Siliguri, a Hindi speaker), who did not write the scripts. A second listener per language for Nepali is strongly preferred: it is the language with a Preview-status engine and no fallback voice.
2. **Blind.** Give them clips named by a code, not by provider or voice. Mix the candidates and the current voice in random order per clip, so the current voice earns its place by comparison.
3. **What to play.** At least the message clip of each purpose in the group, plus the confirm clips. Always include the clip with the most numbers (fee amount, date and time).
4. **Score** the rubric in section 4 on the `SCORECARD.md` row (or a copy), one row per profile and group.
5. **Sign off** by filling the profile's `review` block in `voice-profiles.json`: `reviewer` (name), `date` (YYYY-MM-DD), `verdict` (`approved`, `needs_work` or `rejected`). A sign-off applies to the exact profile id as scored; any change to voice, model, locale, pace or style hint is a new profile and needs a new sign-off.
6. **Record** the scorecard folder and the reviewer's notes in the PR that promotes the profile.

## 6. Decision rule

For each language and purpose group:

1. A profile is **eligible** only if **all gates pass** (every clip, every gate in section 3) **and** a native reviewer has signed it off (`verdict: approved`, reviewer named).
2. Among eligible profiles the winner is the one with the higher listening score; the machine breaks a tie on mean transcribe-back similarity, and a tie stays with the current profile. (`decideWinners` in `scripts/sampark/lib/bakeoff.ts` applies the gate and sign-off rule and the similarity comparison and prints the result in every scorecard; the listening-score comparison is the reviewers' call and is recorded in the verdict.)
3. If no challenger is eligible, **the current profile stays**. A voice is never replaced for being cheaper or newer alone.
4. **Nepali stays on its current profile** (Gemini-TTS `ne-NP`, pinned model) **unless** a candidate beats it: all gates pass, strictly higher similarity, and a Nepali reviewer's sign-off. Nepali cannot move to a provider or locale without Nepali; the validator rejects such a profile at load time.
5. **Promote** by editing `voice-profiles.json` in a PR: set the winner's `status` to `current` and its `group` to the specific group (a `*` candidate is copied into one entry per group it won), set the old one to `rejected` or `candidate`, keep exactly one `current` per language and group (the validator enforces it), and attach the scorecard and sign-off. Only Google engines can be `current` until a production adapter for another provider ships.
6. Promotion changes the clip keys for that language and group (pace and style hint are part of the key), so clips re-render on the next campaign; nothing already sent changes.

## 7. Candidates per language

Status words: **known** = rendered and transcribed back live (plan section 5, `verify-voice.ts`); **documented** = in the provider's docs or release notes but not yet proven by us; **unknown** = needs the first live run. The 2026 model names move fast; confirm in the Cloud TTS and provider docs before relying on any id below.

### English (en-IN) and Hindi (hi-IN)

| Candidate | Profile ids | Known / unknown |
|---|---|---|
| **Current**: Gemini-TTS `gemini-2.5-flash-tts`, Kore | `en-*-current`, `hi-*-current` | Known: ships today; verified live 30 Sep. Style hint steers delivery. No pace parameter. |
| Gemini-TTS `gemini-2.5-pro-tts`, Kore | `en-gemini-pro-kore`, `hi-gemini-pro-kore` | Documented model; higher quality and latency and cost. Unknown for our scripts. |
| Newer Gemini Flash TTS models | add a profile once the id is confirmed | Documented as listing Hindi (and Bangla, Nepali) with inline bracket cues such as `[pause]` in the text. Unknown: whether cues help or leak (a cue read aloud would fail the transcribe-back gate and be caught). Cues change the text sent, so they need a script-side change and review, not just a profile; do that only if the plain-text result is not good enough. |
| Chirp 3 HD, Kore | `en-chirp3-hd-kore`, `hi-chirp3-hd-kore`, `hi-chirp3-hd-kore-slow` | Documented: `en-IN` and `hi-IN` Chirp 3 HD voices, `speakingRate` 0.25-2.0 in `audioConfig`. Known for Bengali only; faster render, takes no style prompt. Unknown for en/hi on our scripts. |
| Sarvam Bulbul v3 | `en-sarvam-priya`, `hi-sarvam-priya`, `hi-sarvam-ritu` | UNVERIFIED: REST shape, speaker names, pace range 0.5-2.0 and the 8 kHz telephony output were written from docs without calling the API. Built for Indian languages; likely strong on Hindi. Needs a Sarvam key and a production adapter before it could ever be `current`. |
| ElevenLabs (benchmark only) | `en-elevenlabs-benchmark`, `hi-elevenlabs-benchmark` | UNVERIFIED. Calibration only: shows how a premium voice sounds beside the others. Never a production provider (cost, data path and the same consent questions as any new vendor). |

### Bengali (bn-IN)

| Candidate | Profile ids | Known / unknown |
|---|---|---|
| **Current**: Chirp 3 HD `bn-IN-Chirp3-HD-Kore` | `bn-*-current` | Known: renders cleanly, 2-3x faster than Gemini-TTS. Chosen because Gemini-TTS had no `bn-IN` (only `bn-BD`, a Bangladesh locale) at the voice test. A West Bengal native listener makes the final call (plan section 5). |
| Chirp 3 HD at pace 0.9 | `bn-chirp3-hd-kore-slow` | Pace control documented (0.25-2.0). Unknown whether slower is clearer or just slower. |
| Gemini-TTS (newer Flash / Pro) with `bn-IN` | `bn-gemini-pro-kore` | Unknown: reported to list Bangla in newer models; the harness records what the API answers today. If the API still rejects `bn-IN`, the failure appears per clip in the scorecard. `bn-BD` is deliberately not offered to West Bengal parents without a reviewer's explicit say-so. |
| Sarvam Bulbul v3 | `bn-sarvam-priya` | UNVERIFIED (as above). Bengali (`bn-IN`) is in Bulbul's language list. |
| ElevenLabs (benchmark only) | `bn-elevenlabs-benchmark` | UNVERIFIED. |

### Nepali (ne-NP)

| Candidate | Profile ids | Known / unknown |
|---|---|---|
| **Current**: Gemini-TTS `gemini-2.5-flash-tts`, Kore, `ne-NP` | `ne-*-current` | Known: verified 30 Sep, transcribed back at 0.97-0.98 with every number in correct Nepali. **Preview** status, no SLA, hence the pinned model, error alerting and the human-recorded closure fallback (plan section 5). |
| Gemini-TTS `gemini-2.5-pro-tts`, Kore, `ne-NP` | `ne-gemini-pro-kore` | Unknown. The only Nepali-capable family we know of besides the current one. |
| Newer Gemini Flash TTS models | add a profile once the id is confirmed | Documented as listing Nepali; unknown quality and Preview status. |
| Chirp 3 HD | none | **Rejected by validation**: Nepali is not documented for Chirp 3 HD. If Google adds `ne-NP`, add it to `PROVIDER_LOCALES` with evidence, then profile it. |
| Sarvam Bulbul v3 | none | **Rejected by validation**: Bulbul v3 has **no Nepali**. |
| ElevenLabs | none | Not benchmarked for Nepali (not documented); the benchmark loader rejects it. |

## 8. First live-run checklist (the UNVERIFIED items)

Do these on the first real run and record the result in the PR; update `PROVIDER_LOCALES`, the Sarvam adapter or the profiles with the evidence.

1. `--dry-run` passes and the markdown renders (sanity, no network).
2. Current profiles, all languages, `--no-current` off: Nepali and Bengali scores should match the 30 Sep numbers (Nepali ~0.97). If not, the profile refactor changed something: stop and diff the request.
3. Sarvam: does the request body in `src/lib/sampark/speech/sarvam-speech.ts` return 200? Is the speaker `priya`/`ritu` valid for `bulbul:v3`? Is the response a WAV at 8000 Hz (the adapter converts 16-bit PCM to mu-law and fails loudly on any other rate)? Is `pace` accepted at 0.5-2.0? Note any text length limit.
4. Gemini newer models: confirm the model id string, whether `bn-IN` is accepted, and whether `speakingRate` is still rejected (the validator forbids a pace on Gemini-TTS; relax it only with evidence).
5. Chirp 3 HD `en-IN` and `hi-IN` voice names (`en-IN-Chirp3-HD-Kore`, `hi-IN-Chirp3-HD-Kore`) exist.
6. ElevenLabs (optional): `ulaw_8000` output format accepted; voice ids filled in.

## 9. Guard rails (tested)

- Default profile = old behaviour, byte for byte, per language and group (request payload, clip key, engine table).
- Nepali can only be `ne-NP`, only on a provider that lists `ne-NP`; Sarvam Bulbul v3 and Chirp 3 HD are rejected for Nepali at validation, and the Sarvam adapter refuses Nepali before any network call.
- Pace is inside the provider's legal range; Gemini-TTS takes none.
- Style hints are short (a long one once made Gemini-TTS read its instruction aloud) and only on Gemini-TTS.
- Exactly one `current` profile per language and group; only Google engines may be `current`.
- Reviewer sign-off fields exist on every profile and ship empty.
- No Latin letters in Hindi, Bengali or Nepali clip text (the existing script rules are untouched).
- Nothing under `src/` imports the ElevenLabs benchmark provider or names its flag; ElevenLabs is not a legal profile provider.
