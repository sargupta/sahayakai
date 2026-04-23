/**
 * Client-safe language helpers for VIDYA auto-language detection.
 *
 * Supports the 11 languages the rest of the app already handles (see
 * `LANGUAGES` in `@/types`). All helpers use 2-letter ISO codes
 * internally — same convention as Sarvam STT's `language_code.split('-')[0]`
 * and the soul.ts `action.params.language` enum.
 */

export type LangCode =
    | 'en' | 'hi' | 'kn' | 'ta' | 'te' | 'mr'
    | 'bn' | 'gu' | 'pa' | 'ml' | 'or';

/**
 * Detect language from Unicode script ranges in free text.
 *
 * Use for TYPED input where Sarvam STT's language detection is unavailable.
 * Returns null if no Indic script is matched — caller should fall back
 * through the precedence chain (session → profile → 'en').
 *
 * Mixed-script input (e.g. Hinglish "sir photosynthesis ka worksheet")
 * returns the FIRST matching Indic script. The matcher is intentionally
 * short-circuit: any Devanagari character → 'hi' even if the majority
 * of the string is Latin. That mirrors how teachers actually intend
 * code-switching — the Indic characters are the language signal.
 *
 * Order matters: checked in population-weighted order so the most
 * common scripts match early. Bengali upper bound is \u09FF (not
 * \u0A0F which would bleed into Gurmukhi).
 */
export function detectLangFromScript(text: string): LangCode | null {
    if (!text) return null;
    if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Devanagari → Hindi (also Marathi, Sanskrit)
    if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali
    if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'; // Kannada
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
    if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'; // Malayalam
    if (/[\u0A80-\u0AFF]/.test(text)) return 'gu'; // Gujarati
    if (/[\u0A00-\u0A7F]/.test(text)) return 'pa'; // Gurmukhi (Punjabi)
    if (/[\u0B00-\u0B7F]/.test(text)) return 'or'; // Odia
    return null;
}

/** Map full language name (from teacherProfile) to 2-letter code. */
export function langNameToCode(name: string | null | undefined): LangCode | null {
    if (!name) return null;
    const map: Record<string, LangCode> = {
        English: 'en', Hindi: 'hi', Kannada: 'kn', Tamil: 'ta',
        Telugu: 'te', Marathi: 'mr', Bengali: 'bn',
        Gujarati: 'gu', Punjabi: 'pa', Malayalam: 'ml', Odia: 'or',
    };
    return map[name] ?? null;
}

/** Map 2-letter code to BCP-47 IN locale — used as TTS `targetLang`. */
export function langCodeToBCP47(code: LangCode | null | undefined): string {
    if (!code) return 'en-IN';
    return `${code}-IN`;
}

/**
 * Short utterances ("haan", "ok", "yes", "ಹೌದು") are low-signal and
 * should NOT flip the sticky language. Threshold is 3 words after
 * whitespace normalisation — matches the "one-word confirmation"
 * pattern that misleads Sarvam's language detector.
 */
export function isShortUtterance(text: string): boolean {
    if (!text) return true;
    return text.trim().split(/\s+/).length < 3;
}

/**
 * Resolve effective language for the current turn using the precedence
 * chain defined in the plan:
 *   1. STT-detected language (from microphone path)
 *   2. Unicode script detection on typed text
 *   3. Session sticky language (from prior turns in this conversation)
 *   4. Teacher profile preferredLanguage (set explicitly at onboarding)
 *   5. 'en' (hard default)
 *
 * The `stickyGuardForShortInput` flag applies the short-utterance rule:
 * if the new signal disagrees with the sticky language AND the input
 * is too short to be trustworthy, keep the sticky language instead.
 */
export function resolveTurnLanguage(args: {
    sttLang?: string | null;
    typedText?: string;
    sessionLang?: LangCode | null;
    profileLangName?: string | null;
}): LangCode {
    const { sttLang, typedText, sessionLang, profileLangName } = args;

    // 1. STT (most reliable)
    if (sttLang) {
        const code = sttLang.split('-')[0].toLowerCase() as LangCode;
        // Short-utterance guard: if STT flips lang on a tiny reply, keep sticky
        if (
            sessionLang &&
            code !== sessionLang &&
            typedText &&
            isShortUtterance(typedText)
        ) {
            return sessionLang;
        }
        return code;
    }

    // 2. Script detection on typed text
    if (typedText) {
        const scriptLang = detectLangFromScript(typedText);
        if (scriptLang) {
            if (
                sessionLang &&
                scriptLang !== sessionLang &&
                isShortUtterance(typedText)
            ) {
                return sessionLang;
            }
            return scriptLang;
        }
    }

    // 3. Session sticky
    if (sessionLang) return sessionLang;

    // 4. Teacher profile
    const profileCode = langNameToCode(profileLangName);
    if (profileCode) return profileCode;

    // 5. Hard default
    return 'en';
}
