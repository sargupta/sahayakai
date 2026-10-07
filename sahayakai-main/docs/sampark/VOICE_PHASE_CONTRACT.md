# Sampark — Voice phase (V) build contract

**Why:** the founder heard bad Bengali on the first real calls (7 Oct 2026). Research R2 traced it to Chirp 3 HD `bn-IN` mispronouncing Bengali (two independent recognisers fail on the same words, only on Chirp), uneven loudness, and bookish wording; the existing transcribe-back gate passed it because it measures intelligibility, not pronunciation. See `CONVERSATION_PLAN.md` §6.1. This phase fixes what is certain now; the final voice per language is still chosen by native listeners (the blind listening test on the design page), and that choice becomes a one-line config change.

**Founder-bug law:** this ships with a class gate — the **hard-word probe**: a voice configuration cannot render any parent audio until a fixed sentence of known-hard words in its language comes back word-for-word from **two independent recognisers**.

## Streams and file ownership (parallel; never edit another stream's files)

| Stream | Owns |
|---|---|
| **A — audio + Vertex voice route** | `src/lib/sampark/speech/dsp.ts` (new), `src/lib/sampark/speech/google-speech.ts`, `src/lib/sampark/languages.ts`, `src/server/sampark/audio-format.ts` (may switch to the shared codec), tests `src/__tests__/sampark/speech/dsp.test.ts` (new), `gate15-speech-engines.test.ts`, `src/__tests__/sampark/speech/vertex-tts.test.ts` (new) |
| **B — hard-word probe** | `src/lib/sampark/speech/probe.ts` (new), `src/lib/sampark/speech/secondary-recognizers.ts` (new), the probe-storage methods in `src/lib/sampark/ports.ts` + `repo/memory.ts` + `repo/firestore.ts` (only those methods), `scripts/sampark/probe-voices.ts` (new), tests `src/__tests__/sampark/speech/probe*.test.ts` (new) |
| **C — native wording** | `src/locales/call-scripts/*.json`, `src/lib/sampark/scripts/spoken.ts`, `src/lib/sampark/scripts/templates.ts` (only if a key shape must change), tests under `src/__tests__/sampark/scripts/` |
| **Integrator** | `src/lib/sampark/speech/render-job.ts` (normalisation + probe gate wiring), `src/lib/sampark/repo/factory.ts` (deps), `src/server/sampark/jobs.ts`, docs |

## A — exact exports
```ts
// dsp.ts (pure, no dependencies)
export function mulawDecode(byte: number): number;              // → int16
export function mulawEncode(sample: number): number;            // int16 → byte (G.711)
export function resampleTo8k(pcm: Int16Array, fromRate: number): Int16Array; // windowed-sinc low-pass, any rate ≥ 8000
export function integratedLoudness(pcm: Float32Array, sampleRate: number): number; // ITU-R BS.1770-4 (K-weighting computed for the actual rate; −70 LUFS absolute gate; −10 LU relative gate; 400 ms blocks, 75% overlap); −Infinity for silence
export interface NormaliseResult { wav: Buffer; beforeLufs: number; afterLufs: number; gainDb: number; peakDbfs: number }
export function normaliseTelephonyWav(wav: Buffer, opts?: { targetLufs?: number; peakCeilingDbfs?: number }): NormaliseResult; // 8 kHz μ-law WAV in/out; default target −18 LUFS, sample-peak ceiling −2 dBFS (gain is reduced to respect the ceiling; no limiter); silence passes through unchanged
export const TELEPHONY_TARGET_LUFS = -18;
```
- `SpeechEngineConfig.engine` gains `'gemini-tts-vertex'`: Gemini TTS through Vertex AI `generateContent` (`https://aiplatform.googleapis.com/v1/projects/{project}/locations/{SAMPARK_TTS_VERTEX_LOCATION ?? 'global'}/publishers/google/models/{model}:generateContent`), body `{contents:[{role:'user',parts:[{text}]}], generationConfig:{responseModalities:['AUDIO'], speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName}}, languageCode}}}`; response `candidates[0].content.parts[*].inlineData` = 24 kHz 16-bit PCM (read the rate from `mimeType`); converted with `resampleTo8k` + `mulawEncode` + `buildMulawWav`. **Never** a style prompt or any instruction text on this route (an English instruction made the voice English-accented; prompts have leaked into audio before). Timeout 180 s, the same retry policy as today.
- **Bengali** moves off Chirp 3 HD to `gemini-tts-vertex`, voice `Kore`, `languageCode` `bn-IN`, model pinned. Pick the model by a **live check** before switching: `gemini-2.5-flash-tts` (GA) if Vertex accepts `bn-IN` with it, else `gemini-3.8-flash-tts` (Preview) — record which and why in `languages.ts`. English, Hindi and Nepali stay as they are.
- Gate 15 (`gate15-speech-engines.test.ts`) is updated to the new pinned configuration and to assert: no `prompt`/instruction field is ever sent on the Vertex route; every language sends its language code.

## B — exact exports
```ts
// probe.ts
export const PROBE_VERSION: number;                    // bump when sentences or rules change
export interface ProbeDefinition { language: ParentLanguage; sentence: string; hardWords: string[] }
export const PROBES: Readonly<Record<ParentLanguage, ProbeDefinition>>;
export interface RecognizerResult { name: string; transcript: string; missing: string[] }
export interface VoiceProbeRecord { key: string; language: ParentLanguage; speech: SpeechEngineConfig; probeVersion: number; status: 'passed' | 'failed'; recognizers: RecognizerResult[]; checkedAt: string }
export function voiceProbeKey(speech: SpeechEngineConfig, probeVersion?: number): string;   // sha256 hex of engine|model|voice|ttsLanguageCode|probeVersion
export function missingHardWords(transcript: string, hardWords: string[], language: ParentLanguage): string[]; // uses the same folding/number normalisation as verify.ts
export interface ProbeDeps { synth: SpeechSynthesizer; primary: { name: string; verifier: SpeechVerifier }; secondary: { name: string; verifier: SpeechVerifier }; clock: Clock; normalise?: (wav: Buffer) => Buffer }
export function runVoiceProbe(deps: ProbeDeps, language: ParentLanguage, speech: SpeechEngineConfig): Promise<VoiceProbeRecord>;
/** Returns the stored passing record, or runs the probe (and stores the result). Throws nothing for a failed probe: returns the failed record. */
export function ensureVoiceProbe(deps: ProbeDeps & { repo: SamparkRepo }, language: ParentLanguage, speech: SpeechEngineConfig): Promise<VoiceProbeRecord>;

// secondary-recognizers.ts
export function createSarvamVerifier(deps?: { fetchImpl?: typeof fetch; getApiKey?: () => Promise<string> }): SpeechVerifier; // Saarika v2.5, POST https://api.sarvam.ai/speech-to-text multipart (file, model, language_code), header api-subscription-key (secret SARVAM_AI_API_KEY via getSecret); bn-IN, hi-IN, en-IN
export function createChirp3Verifier(deps?: GoogleSpeechDeps): SpeechVerifier;  // Google Speech v2 model chirp_3, location 'us' — the second recogniser for Nepali (Saarika has no Nepali); probe sentences are synthetic, never personal data
export function secondaryRecognizerFor(language: ParentLanguage): 'sarvam' | 'chirp3';
```
- Repo (port + memory + firestore): `getVoiceProbe(key): Promise<VoiceProbeRecord | null>`, `saveVoiceProbe(record): Promise<void>` — top-level collection `sampark_voice_probes/{key}` (voice configs are global, not per school).
- Probe sentences: one per language, natural spoken school register, containing the known-hard words: Bengali — সকাল, আটই, এই, আসছেন, বৃহস্পতিবার, সাড়ে, শিলিগুড়ি; Hindi — कॉल, गुरुवार, साढ़े, मीटिंग, सिलीगुड़ी; English — Siliguri, Thursday, thirty, parent teacher meeting; Nepali — बिहीबार, साढे, थिच्नुहोस्, स्कुल, सिलिगुडी. Extend each list with any other word R2 saw fail (manifest at `qa/sampark-voice-eval/manifest.json`).
- `scripts/sampark/probe-voices.ts`: runs the probe for every configured language against the live APIs and prints a table (no data written unless `--save` with the emulator).
- **Class-gate tests:** a fake secondary recogniser that drops one hard word fails the probe; a probe record for another config or an older `PROBE_VERSION` is not reused; every language in `PARENT_LANGUAGE_INFO` has a probe whose sentence contains every hard word; the Chirp-3-HD-style failure (সকাল → কাল) is a fixture that must fail.

## C — native wording
Apply the wording fixes from research R2 (texts in `qa/sampark-voice-eval/manifest.json`, `text_variant: "improved"`) to the templates for **every** purpose and clip, in the spoken register parents use: Bengali "প্যারেন্ট টিচার মিটিং" not "অভিভাবক-শিক্ষক সভা", "মেসেজ" not "বার্তা", "আপনি এলে আমরা খুব খুশি হব", keypad digits as "এক নম্বর টিপুন" / "নয় নম্বর টিপুন", "বি সেকশনের" not "বি-র"; Hindi "क्लास सेवन बी", not translated phrases; English "ten thirty" not "half past ten", "Class Seven B"; Nepali "स्कुल" consistently, "क्लास सेभेन", short sentences, "नम्बर थिच्नुहोस्". Class labels and times go through `spoken.ts` so every purpose changes together. All existing gates (template parity across four languages, Nepali purity, Latin-in-Indic, render tests) must stay green; add a test that no script contains the retired bookish forms. Every changed line is listed in the stream's report for native sign-off.

## Integrator
- `render-job.ts`: every synthesised clip is loudness-normalised (`normaliseTelephonyWav`) **before** verification and storage; before rendering any clip for a language, `ensureVoiceProbe` must have a passing record for that language's speech config, otherwise every clip of that language fails with a plain reason naming the missing words.
- `factory.ts` / `jobs.ts`: wire the secondary recognisers and probe deps.
- Live verification: run `probe-voices.ts`, then `verify-voice.ts`, and re-render the demo campaign.

## Done
All Sampark tests, `tsc`, eslint, the i18n ratchet and the design-token budget pass; live probe passes for all four languages with the new Bengali voice; documented.
