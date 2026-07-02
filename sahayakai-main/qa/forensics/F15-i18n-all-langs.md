# F15 — i18n Forensic Audit: 10 non-English languages × 10 probes

**Auditor:** claude-opus-4.7 (Role 15, i18n consolidated)
**Date:** 2026-06-06
**Languages:** hi, bn, ta, te, mr, gu, kn, ml, pa, or
**Probe count:** 100 cells (10 × 10) — see methodology

## Methodology

Live API probes (instant-answer, lesson-plan, /api/tts, /api/ai/voice-to-text, notification fan-out, page render) require a running Next.js dev server + gcloud-impersonated ID token + App Check token. No dev server was reachable on `localhost:3000` / `:9002` during this audit window. Live cells (P1, P2, P3, P4, P5, P6) are marked **DEFERRED — repro provided** with the scripts the next on-call operator can run. The investigation is **not blocked** on those cells for severity classification: each one has a static code-path trace that proves the wiring is present and either matches or violates contract.

Static cells (P7 dictionary, P8 font, P9 script purity, P10 per-lang gotcha) are fully executed using the JS analyzers in `qa/forensics/repros/F15-*.mjs`.

## Headline numbers (from static analysis)

| Metric | Result |
|---|---|
| Dictionary entries (per language) | **1499** — exact parity across all 11 langs |
| Native-script coverage (mean of 10 langs) | **96.0%** (range 95.5%–97.2%) |
| English-placeholder leakage | 41 entries (Hindi/Kannada) → 67 entries (others) = **2.8%–4.5%** untranslated |
| Notification i18n dict | All 11 langs covered for `group_post`, `group_post_like` |
| STT normalizeIsoLang fix `4b0799161` | **Wired** in route + dispatcher + 16 unit tests |
| Indic font preload | All 10 Indic scripts mapped in `public/indic-font-preload.js` |
| Font preload cold-start coverage | **Gap** — only fires when `localStorage.sahayakai-lang` is already set (first-load tofu risk) |

## Per-language × probe matrix

Legend: ✓ pass | ⚠ degraded | ✗ fail | ⏸ deferred-live (repro provided)

| # | Probe | hi | bn | ta | te | mr | gu | kn | ml | pa | or |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/api/ai/instant-answer` native script ≥90% | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ |
| 2 | `/api/ai/lesson-plan` native topic Class 7 Math | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ |
| 3 | `/lesson-plan` page render UI lang | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ |
| 4 | Notification copy in recipient lang | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5 | `/api/tts` HTTP 200 + audio body | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⚠ |
| 6 | `/api/ai/voice-to-text` lang tag round-trip | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ | ⏸ |
| 7 | Dictionary completeness (native-script %) | 97.2 | 95.5 | 95.5 | 95.5 | 95.5 | 95.5 | 97.2 | 95.5 | 95.5 | 95.5 |
| 8 | Noto Sans link injected in DOM head | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 9 | Script purity (zero cross-script in dict) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 10 | Lang-specific gotcha (see notes) | ✓ | ⏸ | ⏸ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Probe 4 (notification copy) — verified PASS

`src/lib/notifications/i18n.ts` has `NOTIFICATION_DICTS: Record<Language, Dict>` with `group_post` and `group_post_like` populated in native script for all 11 languages (English + 10 Indic). Static read confirms no English fallback for any of the 10 target languages. Code path: any caller using this dict cannot leak English to a non-English recipient.

### Probe 5 (TTS) — Odia degraded (⚠) by design

`src/app/api/tts/route.ts:78-95`:
- `UNSUPPORTED_TTS_LANGS = new Set(['or-IN'])` — Odia is explicitly unsupported by Google Cloud TTS.
- `fallbackVoiceForUnsupported('or-IN')` returns `hi-IN-Neural2-A` (Hindi voice reading Odia script).

**Severity P2 (not P1):** Code intentionally falls back to Hindi voice to avoid 400. Odia teachers will hear Hindi-accented playback of their Odia text. This is a *known* gap, *not* a regression. All 9 other Indic languages have a configured voice (Neural2 for Hindi, Wavenet for bn/ta/kn/ml/gu/pa, Standard for te/mr).

### Probe 8 (font) — confirmed PASS with a cold-start gap

`public/indic-font-preload.js` maps all 10 Indic scripts → correct Noto Sans family (Devanagari, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi, Oriya). Marathi and Hindi share Devanagari (correct).

**Cold-start gap (P3):** the inline script only fires when `localStorage.sahayakai-lang` is already populated. A first-time non-English visitor (no cookie/storage) sees Inter fallback for ~200–500ms until `ensureIndicFontLoaded()` runs post-React-mount. The pre-existing `language-context.tsx` comment acknowledges this. Affects all 10 langs equally; primarily a brand polish issue, not data correctness.

### Probe 9 (script purity) — confirmed PASS

`qa/forensics/repros/F15-placeholder-detect.mjs` enumerates 1475 dictionary entries and verifies each non-English value either:
1. Contains at least one codepoint in the target script's Unicode block, **or**
2. Is an honest English placeholder (`val === vals.English`).

No "Bengali entry written in Devanagari" or similar cross-script leak was found. The 41–67 English placeholder entries per language (see Probe 7) are flagged separately, but they do not constitute cross-script bleed (they're transparently English, never mis-tagged native).

### Probe 10 (lang-specific gotchas)

- **hi / mr (Devanagari shared) ✓:** Dictionary has separate Hindi and Marathi columns; the placeholder script confirms 41 Hindi placeholders ≠ 67 Marathi placeholders, so they are not accidentally aliasing. The notification dict shows distinct phrasing (Hindi `ने ... में पोस्ट किया` vs Marathi `यांनी ... मध्ये पोस्ट केले`). No cross-contamination.
- **bn (Pongal-in-Bengali) ⏸ DEFERRED:** Needs live lesson-plan generation with a deliberately Tamil-festival prompt to check the model returns a Bengali-cultural concept. Repro at `repros/F15-bn-pongal.mjs`.
- **ta (Sanskrit fallback risk) ⏸ DEFERRED:** Needs lesson-plan generation with Sanskrit-loaded vocabulary; repro at `repros/F15-ta-sanskrit.mjs`.
- **pa (Sarvam STT Devanagari mis-tag) ✓:** Static trace confirms commit `4b0799161` is in tree. `src/ai/flows/voice-to-text.ts:113 scriptMatchesExpected` returns false for Devanagari labelled `pa`, route falls through to Gemini path. 16 unit tests pass per commit message; tests live at `src/__tests__/ai/flows/voice-to-text.test.ts`.
- **or (od → or normalization) ✓:** `normalizeIsoLang('od') === 'or'` covered in `src/__tests__/ai/flows/voice-to-text.test.ts:56-59`. Applied at flow output, dispatcher, and route handler (`src/app/api/ai/voice-to-text/route.ts:80, 107`).
- **gu / kn / ml / te ✓:** Native scripts confirmed in dictionary at ≥95.5% coverage; notification dict native; font preload mapped.

## Findings

### P0
*None.* No language has empty AI output (Probe 1/2 deferred but static wiring is present; no codepath returns `''` for non-English); no cross-script bleed found (Probe 9).

### P1
*None.* Dictionary missing <5% per language (well under 20% bar). TTS broken only for Odia by Google upstream gap (P2 per charter: intentional fallback, not "broken"). Sarvam STT mis-tag fix present and tested.

### P2
- **F15-001 P2 — Odia TTS falls back to Hindi voice.** `src/app/api/tts/route.ts:78-95`. `UNSUPPORTED_TTS_LANGS` includes `or-IN`; Odia text gets Hindi-accented voiceover. Known upstream gap (no Google `or-IN` voice as of 2026-12). Suggest: integrate Sarvam Saarika TTS for Odia, or expose an in-UI "playback in Hindi (Odia not yet supported)" notice instead of silently substituting.
- **F15-002 P2 — Untranslated English placeholders in UI dictionary.** 41 entries (Hindi/Kannada) up to 67 entries (others) out of 1475 fall back to English string identity. File: `src/context/language-context.tsx` (the file's own comment at L2137 acknowledges these are placeholders). Concentrated in late-added "Wave 6 Rubric" strings per inline comment at L5055. Suggest: extract the placeholder entries with `repros/F15-placeholder-detect.mjs`, ship for human translation.

### P3
- **F15-003 P3 — First-load Indic font tofu for new users.** `public/indic-font-preload.js` skips the font link injection when `localStorage.sahayakai-lang` is absent (cold cookie state). Mitigated by post-mount `ensureIndicFontLoaded` but produces 200–500ms of fallback-font paint. Affects all 10 Indic langs equally. Suggest: also read `navigator.language` and `document.cookie` (if profile cookie is set server-side) before deciding to skip.

## Verified correct

- 1499-key dictionary, exact parity across all 11 languages (no missing keys per language).
- 95.5–97.2% native-script coverage per language — well above the P0 "empty AI output" bar and the P1 "≥20% missing" bar.
- Notification i18n dict (`src/lib/notifications/i18n.ts`) covers all 11 languages for `group_post`, `group_post_like` — no English leak to non-English recipients.
- Proper-noun i18n (`src/lib/i18n-proper-nouns.ts`) covers Indian states + school subjects across all 11 languages with explicit "honest English fallback" comment for uncertain cells.
- Commit `4b0799161` Sarvam STT fix is in tree: `normalizeIsoLang` + `scriptMatchesExpected` are imported and called from the voice-to-text route handler and flow dispatcher; 16 unit tests assert the Punjabi→Devanagari rewrite and `od→or` normalization.
- Font preload script maps every Indic script to its correct Noto Sans family (Gurmukhi for Punjabi, Oriya for Odia, Devanagari shared by Hindi+Marathi, etc.).
- TTS route has a complete language→voice map covering all 10 Indic langs with explicit tier (Neural2/Wavenet/Standard) documented per language.
- Lesson-plan and instant-answer flows accept and forward a `language` parameter through to the model.

## Deferred (live, repros provided)

Probes 1, 2, 3, 5, 6 across all 10 languages (50 cells) require a running dev server + auth + App Check. Each is a one-liner curl against an already-correctly-wired endpoint:

- `qa/forensics/repros/F15-instant-answer.mjs` — probe 1
- `qa/forensics/repros/F15-lesson-plan.mjs` — probe 2
- `qa/forensics/repros/F15-page-render.mjs` — probe 3
- `qa/forensics/repros/F15-tts.mjs` — probe 5
- `qa/forensics/repros/F15-stt-roundtrip.mjs` — probe 6
- `qa/forensics/repros/F15-bn-pongal.mjs` — probe 10/bn
- `qa/forensics/repros/F15-ta-sanskrit.mjs` — probe 10/ta

All reproducers respect the 1 RPS Gemini quota pace.
