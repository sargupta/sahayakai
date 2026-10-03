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

import type { ParentLanguage, ParentLanguageCode, PurposeId } from '@/types/sampark';

import { BASELINE_GROUP, currentProfile, purposeGroup, type VoiceProfile } from './voice-profile';

export interface SpeechEngineConfig {
    /** 'sarvam-bulbul' exists only for bake-off candidates; the production renderer is Google-only (voice-profile.ts enforces it). */
    engine: 'gemini-tts' | 'chirp3-hd' | 'sarvam-bulbul';
    /** BCP-47 code sent to the TTS API. */
    ttsLanguageCode: string;
    /** Voice name. For chirp3-hd this is the full name, e.g. "bn-IN-Chirp3-HD-Kore". */
    voice: string;
    /** Pinned model id (gemini-tts only). */
    model: string | null;
    /** Language code for the transcribe-back check (Chirp 2). */
    sttLanguageCode: string;
    /** Provider-native pace; null/absent = not sent. Optional so older literals stay valid. */
    speakingRate?: number | null;
    /** Gemini-TTS delivery hint for `styled` clips; undefined = the legacy default, null = none. */
    stylePrompt?: string | null;
}

/** The engine config a voice profile describes. The profile is the source of truth. */
export function toSpeechConfig(
    p: Pick<VoiceProfile, 'provider' | 'localeCode' | 'voice' | 'model' | 'sttLanguageCode' | 'speakingRate' | 'stylePrompt'>,
): SpeechEngineConfig {
    return {
        engine: p.provider,
        ttsLanguageCode: p.localeCode,
        voice: p.voice,
        model: p.model,
        sttLanguageCode: p.sttLanguageCode,
        speakingRate: p.speakingRate,
        stylePrompt: p.stylePrompt,
    };
}

/** The engine that speaks `purpose` to `language` today (its purpose group's current voice profile). */
export function speechFor(language: ParentLanguage, purpose: PurposeId): SpeechEngineConfig {
    return toSpeechConfig(currentProfile(languageCodeFor(language), purposeGroup(purpose)));
}

function languageCodeFor(language: ParentLanguage): ParentLanguageCode {
    return BY_LANGUAGE[language];
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

const BY_LANGUAGE: Readonly<Record<ParentLanguage, ParentLanguageCode>> = { English: 'en', Hindi: 'hi', Bengali: 'bn', Nepali: 'ne' };

/** Language-level engine for call sites that do not know the purpose: the baseline group's current profile. */
function baseline(code: ParentLanguageCode): SpeechEngineConfig {
    return toSpeechConfig(currentProfile(code, BASELINE_GROUP));
}

export const PARENT_LANGUAGE_INFO: Readonly<Record<ParentLanguage, ParentLanguageInfo>> = Object.freeze({
    English: {
        language: 'English',
        code: 'en',
        scriptFile: 'english',
        nativeLabel: 'English',
        speech: baseline('en'),
    },
    Hindi: {
        language: 'Hindi',
        code: 'hi',
        scriptFile: 'hindi',
        nativeLabel: 'हिन्दी',
        speech: baseline('hi'),
    },
    Bengali: {
        language: 'Bengali',
        code: 'bn',
        scriptFile: 'bengali',
        nativeLabel: 'বাংলা',
        speech: baseline('bn'),
    },
    Nepali: {
        language: 'Nepali',
        code: 'ne',
        scriptFile: 'nepali',
        nativeLabel: 'नेपाली',
        speech: baseline('ne'),
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
