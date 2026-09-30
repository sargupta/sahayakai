/**
 * Parent languages and the speech engine each one uses.
 *
 * Plan §5. The engine is chosen PER LANGUAGE because the voice review proved
 * one engine does not serve all four:
 *   - Gemini-TTS has no `bn-IN` voice (only `bn-BD`, a Bangladesh locale), so
 *     Bengali uses Chirp 3 HD `bn-IN` until a West Bengal listener decides.
 *   - Nepali `ne-NP` exists only on Gemini-TTS, and it is Preview — so the
 *     model id is pinned here and asserted by class gate 15.
 * All four share the voice name "Kore" so parents hear one school voice.
 */

import type { ParentLanguage, ParentLanguageCode } from '@/types/sampark';

export interface SpeechEngineConfig {
    engine: 'gemini-tts' | 'chirp3-hd';
    /** BCP-47 code sent to the TTS API. */
    ttsLanguageCode: string;
    /** Voice name. For chirp3-hd this is the full name, e.g. "bn-IN-Chirp3-HD-Kore". */
    voice: string;
    /** Pinned model id (gemini-tts only). */
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
        speech: { engine: 'chirp3-hd', ttsLanguageCode: 'bn-IN', voice: `bn-IN-Chirp3-HD-${SCHOOL_VOICE}`, model: null, sttLanguageCode: 'bn-IN' },
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
