/**
 * Parent languages and the speech engine each one uses.
 *
 * Plan §5, revised by the voice phase (CONVERSATION_PLAN.md §6.1). The engine is
 * chosen PER LANGUAGE because no single route serves all four:
 *   - Bengali is Gemini-TTS through Vertex AI (`gemini-tts-vertex`), `bn-IN`.
 *     It was Chirp 3 HD `bn-IN` until 7 Oct 2026, when the founder heard bad
 *     Bengali on the first real calls. Research R2 confirmed it was the engine,
 *     not the phone line: two independent recognisers (Google Chirp 2 and Sarvam
 *     Saarika) stumbled on the same words, and only on Chirp 3 HD (সকাল heard
 *     as "কাল", আটই as "আটি", "আপনি আসছেন" as "আপনি আশ্চর্য"). Cloud TTS refuses
 *     `bn-IN` for every Gemini model, but the same models on Vertex accept it.
 *     Model: `gemini-3.8-flash-tts` (Preview on Vertex). Vertex accepted `bn-IN`
 *     with the GA `gemini-2.5-flash-tts` too, but that model FAILED the hard-word
 *     probe (speech/probe.ts) in 5 of 5 renders: Sarvam Saarika heard
 *     "সাড়ে দশটায়" (10:30) as "১৫টায়" (15:00) every time — a wrong meeting time,
 *     exactly what the probe exists to stop. `gemini-3.8-flash-tts` passed with
 *     both recognisers. Preview is acceptable here only because the probe gates
 *     every Bengali render: if a model update regresses, Bengali audio is refused,
 *     not played. The final voice is still the native listeners' call (the
 *     blind listening test), a one-line edit here.
 *   - Never `bn-BD`: Gemini's Bangladesh locale leaks Bangladeshi words and sound.
 *   - English, Hindi and Nepali stay on Cloud TTS Gemini-TTS. Nepali `ne-NP` is
 *     Preview there, so every model id is pinned and asserted by class gate 15.
 * Every request carries its language code: without it, Gemini read English and
 * some Hindi with an American accent.
 * All four share the voice name "Kore" so parents hear one school voice.
 */

import type { ParentLanguage, ParentLanguageCode } from '@/types/sampark';

/**
 *   gemini-tts         Cloud Text-to-Speech, Gemini model (8 kHz μ-law straight from the API)
 *   gemini-tts-vertex  Vertex AI generateContent, Gemini model (24 kHz PCM or WAV, converted in dsp.ts)
 *   chirp3-hd          Cloud Text-to-Speech, Chirp 3 HD (no model id)
 */
export type SpeechEngine = 'gemini-tts' | 'gemini-tts-vertex' | 'chirp3-hd';

export interface SpeechEngineConfig {
    engine: SpeechEngine;
    /** BCP-47 code sent to the TTS API, on every request. */
    ttsLanguageCode: string;
    /** Voice name. For chirp3-hd this is the full name, e.g. "bn-IN-Chirp3-HD-Kore". */
    voice: string;
    /** Pinned model id (both Gemini engines; null for chirp3-hd). */
    model: string | null;
    /** Language code for the transcribe-back check (Chirp 2). */
    sttLanguageCode: string;
}

export interface ParentLanguageInfo {
    language: ParentLanguage;
    code: ParentLanguageCode;
    /** File stem under src/locales/call-scripts/. */
    scriptFile: 'english' | 'hindi' | 'bengali' | 'nepali';
    nativeLabel: string;
    speech: SpeechEngineConfig;
}

export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-tts';
/** Bengali's model on Vertex — chosen by the hard-word probe on 7 Oct 2026 (see the header). */
export const BENGALI_VERTEX_TTS_MODEL = 'gemini-3.8-flash-tts';
export const SCHOOL_VOICE = 'Kore';

export const PARENT_LANGUAGE_INFO: Readonly<Record<ParentLanguage, ParentLanguageInfo>> = Object.freeze({
    English: {
        language: 'English',
        code: 'en',
        scriptFile: 'english',
        nativeLabel: 'English',
        speech: { engine: 'gemini-tts', ttsLanguageCode: 'en-IN', voice: SCHOOL_VOICE, model: GEMINI_TTS_MODEL, sttLanguageCode: 'en-IN' },
    },
    Hindi: {
        language: 'Hindi',
        code: 'hi',
        scriptFile: 'hindi',
        nativeLabel: 'हिन्दी',
        speech: { engine: 'gemini-tts', ttsLanguageCode: 'hi-IN', voice: SCHOOL_VOICE, model: GEMINI_TTS_MODEL, sttLanguageCode: 'hi-IN' },
    },
    Bengali: {
        language: 'Bengali',
        code: 'bn',
        scriptFile: 'bengali',
        nativeLabel: 'বাংলা',
        speech: { engine: 'gemini-tts-vertex', ttsLanguageCode: 'bn-IN', voice: SCHOOL_VOICE, model: BENGALI_VERTEX_TTS_MODEL, sttLanguageCode: 'bn-IN' },
    },
    Nepali: {
        language: 'Nepali',
        code: 'ne',
        scriptFile: 'nepali',
        nativeLabel: 'नेपाली',
        speech: { engine: 'gemini-tts', ttsLanguageCode: 'ne-NP', voice: SCHOOL_VOICE, model: GEMINI_TTS_MODEL, sttLanguageCode: 'ne-NP' },
    },
});

const BY_CODE: Record<ParentLanguageCode, ParentLanguage> = { en: 'English', hi: 'Hindi', bn: 'Bengali', ne: 'Nepali' };

export function languageFromCode(code: string | null | undefined): ParentLanguage | null {
    if (!code) return null;
    return BY_CODE[code.trim().toLowerCase() as ParentLanguageCode] ?? null;
}

export function languageInfo(language: ParentLanguage): ParentLanguageInfo {
    return PARENT_LANGUAGE_INFO[language];
}
