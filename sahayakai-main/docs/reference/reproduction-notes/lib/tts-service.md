# Lib: TTS Service

**File:** `src/lib/tts.ts` (client)
**API Route:** `POST /api/tts` (`src/app/api/tts/route.ts`)
**Verified:** 2026-06-10

---

## Purpose

Text-to-speech for VIDYA assistant responses. The route uses Sarvam AI for supported Indian languages and Google Cloud TTS otherwise; the client `tts` helper falls back to browser SpeechSynthesis if the route fails.

---

## Language → Voice Mapping (Google path, route `getVoiceName`)

Tier priority Neural2 > Wavenet > Standard.

| Language | Voice Quality | Google TTS Voice |
|---|---|---|
| Hindi (hi-IN) | Neural2 | hi-IN-Neural2-A (female) |
| English (en-IN) | Neural2 | en-IN-Neural2-A (female) |
| Bengali (bn-IN) | Wavenet | bn-IN-Wavenet-A |
| Tamil (ta-IN) | Wavenet | ta-IN-Wavenet-A |
| Kannada (kn-IN) | Wavenet | kn-IN-Wavenet-A |
| Malayalam (ml-IN) | Wavenet | ml-IN-Wavenet-A |
| Gujarati (gu-IN) | Wavenet | gu-IN-Wavenet-A |
| Punjabi (pa-IN) | Wavenet | pa-IN-Wavenet-A |
| Telugu (te-IN) | Standard | te-IN-Standard-A (no Wavenet/Neural2 for Telugu) |
| Marathi (mr-IN) | Standard | mr-IN-Standard-A (Marathi has Standard only) |

Default for an unmapped lang: `${langCode}-Standard-A`. Unsupported langs (e.g. Odia) route through `fallbackVoiceForUnsupported`, which returns `hi-IN-Standard-A` (phonetic approximation). If a chosen Google voice 4xx's, the route retries once with `hi-IN-Standard-A`.

## Sarvam Path (route default for supported langs)

`POST /api/tts` first calls `toSarvamLangCode(langCode)`. If Sarvam supports the language it synthesizes via `sarvamTTS` (voice label `sarvam:priya:<lang>`) and records usage with provider `'sarvam'`; on Sarvam error it falls back to Google. `UsageTracker.trackTTS(uid, len, cacheHit, provider)` logs which provider served.

---

## tts.speak(text, targetLang)

```
1. Strip markdown (remove code blocks, links, headings, bold/italic)
2. Detect language from text (Unicode range detection)
3. POST /api/tts { text, lang }
4. Receive base64 MP3
5. Create data: URL → new Audio(url) → play()
6. Return promise resolving when audio ends or tts.cancel() called
```

---

## tts.cancel()

```
1. Pause + reset active Audio element
2. Resolve pending speak() promise
3. Clear reference to active audio
```

Called by OmniOrb when new recording starts (interrupts any playing response).

---

## tts.prime()

```
1. Silently initialize SpeechSynthesis API (loads voices list)
2. Play a silent audio buffer (unlocks audio autoplay on iOS)
```

Called on first user interaction to ensure audio works without explicit user gesture on subsequent calls.

---

## Language Detection (detectLangCode)

Regex on Unicode ranges:
```
Devanagari (\u0900-\u097F) → hi (Hindi/Marathi - no disambiguation)
Bengali (\u0980-\u09FF) → bn
Telugu (\u0C00-\u0C7F) → te
Kannada (\u0C80-\u0CFF) → kn
Tamil (\u0B80-\u0BFF) → ta
Malayalam (\u0D00-\u0D7F) → ml
Gujarati (\u0A80-\u0AFF) → gu
Punjabi/Gurmukhi (\u0A00-\u0A7F) → pa
Default → en-IN
```

---

## Fallback (speakFallback)

If `/api/tts` fails:
```
1. window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
2. Set utterance.lang = detectedLangCode
3. Let browser use whatever voice it has
```

Quality is noticeably lower but ensures VIDYA always speaks.

---

## /api/tts Route

```
POST /api/tts
Body: { text: string, lang: string }
1. detectLangCode / normalize lang
2. If Sarvam supports lang → sarvamTTS (chunked, concatenated base64 MP3)
3. Else → Google Cloud TTS (chunked via googleTTS/googleTTSOne; auth via service account)
   - unsupported lang → hi-IN-Standard-A phonetic fallback
   - voice 4xx → retry once with hi-IN-Standard-A
→ Returns base64 MP3 audio
```

Auth: the route reads the middleware-injected `x-user-id` for usage tracking; it is NOT in the public-route list, so it requires a verified token.
