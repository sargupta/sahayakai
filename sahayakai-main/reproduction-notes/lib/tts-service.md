# Lib: TTS Service

**File:** `src/lib/tts.ts`
**API Route:** `POST /api/tts`

---

## Purpose

Text-to-speech for VIDYA assistant responses. Uses Google Cloud TTS for high-quality Indic voice synthesis, with browser SpeechSynthesis as fallback.

---

## Language → Voice Mapping

| Language | Voice Quality | Google TTS Voice |
|---|---|---|
| Hindi (hi) | Neural2 | hi-IN-Neural2-A |
| English (en) | Neural2 | en-IN-Neural2-A |
| Bengali (bn) | Wavenet | bn-IN-Wavenet-A |
| Tamil (ta) | Wavenet | ta-IN-Wavenet-A |
| Kannada (kn) | Wavenet | kn-IN-Wavenet-A |
| Malayalam (ml) | Wavenet | ml-IN-Wavenet-A |
| Gujarati (gu) | Wavenet | gu-IN-Wavenet-A |
| Punjabi (pa) | Wavenet | pa-IN-Wavenet-A |
| Telugu (te) | Standard | te-IN-Standard-A |
| Marathi (mr) | Wavenet | mr-IN-Wavenet-A |

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
Devanagari (\u0900-\u097F) → hi (Hindi/Marathi — no disambiguation)
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
→ Google Cloud TTS API (authenticated with service account)
→ Returns: { audioContent: string (base64 MP3) }
```
