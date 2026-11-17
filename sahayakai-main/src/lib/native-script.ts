/**
 * How much of a piece of text is written in a language's own script.
 *
 * Prompts tell the model to write Tamil in Tamil script, Hindi in Devanagari and so on, but a
 * model sometimes drifts into English or Latin transliteration anyway. This measures the result,
 * so a flow can check the output instead of trusting the instruction.
 */

/** Unicode block of each Indian language's native script. English and unknown languages: none. */
const SCRIPT_BLOCK: Readonly<Record<string, RegExp>> = {
    Hindi: /[ऀ-ॿ]/g,
    Marathi: /[ऀ-ॿ]/g,
    Bengali: /[ঀ-৿]/g,
    Assamese: /[ঀ-৿]/g,
    Punjabi: /[਀-੿]/g,
    Gujarati: /[઀-૿]/g,
    Odia: /[଀-୿]/g,
    Tamil: /[஀-௿]/g,
    Telugu: /[ఀ-౿]/g,
    Kannada: /[ಀ-೿]/g,
    Malayalam: /[ഀ-ൿ]/g,
};

/** Every letter or combining mark, in any script (digits, spaces and punctuation are ignored). */
const LETTER = /[\p{L}\p{M}]/gu;

/**
 * The share (0 to 1) of the text's letters that are in `language`'s native script, or null when
 * the language has no native script to check (English, or a name this module does not know).
 */
export function nativeScriptShare(text: string, language: string): number | null {
    const block = SCRIPT_BLOCK[language.trim()];
    if (!block) return null;
    const letters = text.match(LETTER)?.length ?? 0;
    if (letters === 0) return 0;
    return (text.match(block)?.length ?? 0) / letters;
}

/**
 * Whether the text is written in the language's own script. A little English inside an Indian
 * language message ("doubt", "ma'am", a subject name) is normal, so the bar is a clear majority.
 */
export function isInNativeScript(text: string, language: string, minShare = 0.6): boolean {
    const share = nativeScriptShare(text, language);
    return share === null || share >= minShare;
}
