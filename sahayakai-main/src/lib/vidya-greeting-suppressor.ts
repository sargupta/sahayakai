/**
 * VIDYA greeting suppressor (2026-05-20)
 *
 * A teacher reported: "Every time I call VIDYA she opens with a greeting
 * — Namaste, Sure, Of course. After the first one in a session it gets
 * in the way."
 *
 * The Gemini model is instructed in SAHAYAK_SOUL to be "Radically Warm"
 * which it interprets as "greet at the start of every response". We
 * do not want to weaken the warmth instruction itself (it shapes much
 * more than the opener), so this module post-processes the response
 * client-side: it strips a leading greeting token from a reply only
 * when the conversation is past its first turn.
 *
 * ── Where to wire this in ─────────────────────────────────────────────
 *
 * Two call sites do the user-visible work, both currently being edited
 * in parallel by `fix/vidya-conversation-quality-on-develop`:
 *
 *   1. `src/components/omni-orb.tsx::processTranscription`
 *      Before `tts.speak(response, ...)` and before
 *      `addMessage("model", response)`, replace `response` with
 *      `stripRedundantGreeting(response, { prevHadModelTurn:
 *      chatHistory.some(m => m.role === 'model') })`. The TTS playback
 *      and the chat-history entry both then start with the substantive
 *      content.
 *
 *   2. `src/components/voice-assistant.tsx` (if VIDYA is invoked there
 *      too — confirm before wiring).
 *
 * Both edits are 1-line; this utility is pure and lives separately so
 * the wiring change is mechanical when those files settle.
 *
 * ── Why client-side, not prompt-side ─────────────────────────────────
 *
 * The natural place is to add a "no greeting on mid-conversation" rule
 * to SAHAYAK_SOUL_PROMPT (`src/ai/soul.ts`) or to the runtime injection
 * in `src/ai/flows/vidya-assistant.ts::buildSystemPrompt`. Both files
 * are actively edited by parallel sessions today (2026-05-20); a
 * prompt-side edit would conflict. Client-side stripping is decoupled
 * from those files and ships independently.
 *
 * When the prompt-side rule eventually lands it will reduce model
 * compliance burden but this client-side filter remains a useful belt
 * and braces — even strong prompts occasionally leak a "Sure!" opener.
 *
 * ── Determinism + zero false-positives ──────────────────────────────
 *
 * The matcher is intentionally anchored:
 *   - Only the FIRST sentence is examined.
 *   - Only when that sentence is SHORT (≤ 4 tokens once punctuation
 *     stripped) does it count as a "pure greeting" and get removed.
 *   - A reply like "Sure, the answer is 42" keeps "Sure," because the
 *     sentence is substantive — we do NOT decapitate informative text.
 *   - A reply like "Namaste! Here is your lesson plan." → "Here is
 *     your lesson plan." (greeting was its own sentence, stripped).
 *
 * The 11-language token table mirrors the SahayakAI supported set
 * (English + 10 Indic). Extend when you add a language.
 */

/**
 * Greeting tokens by language. Case-insensitive matching applied at
 * comparison time. Multi-word tokens (e.g. "Good morning",
 * "ਸਤ ਸ੍ਰੀ ਅਕਾਲ") MUST be listed exactly as they appear; do not split.
 */
const GREETING_TOKENS: ReadonlyArray<string> = [
    // English
    'namaste', 'hello', 'hi', 'hey', 'sure', 'of course', 'certainly',
    'absolutely', 'greetings', 'welcome',
    'good morning', 'good afternoon', 'good evening',
    // Hindi (Devanagari)
    'नमस्ते', 'नमस्कार', 'हाँ ज़रूर', 'बिल्कुल', 'सुप्रभात', 'हैलो', 'हाय',
    // Bengali
    'নমস্কার', 'হ্যালো', 'অবশ্যই',
    // Tamil
    'வணக்கம்', 'ஹலோ', 'கண்டிப்பாக',
    // Telugu
    'నమస్తే', 'నమస్కారం', 'తప్పకుండా', 'హలో',
    // Kannada
    'ನಮಸ್ಕಾರ', 'ಹಲೋ', 'ಖಂಡಿತ',
    // Malayalam
    'നമസ്കാരം', 'ഹലോ', 'തീർച്ചയായും',
    // Marathi (Devanagari, distinct from Hindi here)
    'नक्कीच',
    // Gujarati
    'નમસ્તે', 'હેલો', 'ચોક്കಸ',
    // Punjabi
    'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'ਨਮਸਤੇ', 'ਜ਼ਰੂਰ',
    // Odia
    'ନମସ୍କାର', 'ହ୍ୟାଲୋ', 'ନିଶ୍ଚୟ',
];

const NORMALISED_TOKENS = new Set(
    GREETING_TOKENS.map((t) => t.toLowerCase()),
);

/**
 * Sentence-end markers across our 11 languages. Devanagari uses the
 * double-vertical-bar danda (॥) and the single danda (।). Latin uses
 * .!? Other Indic scripts inherit Latin punctuation in modern usage.
 *
 * The split is intentionally generous — anything in this set ends a
 * sentence — because we only care about the FIRST sentence.
 */
const SENTENCE_END = /[.!?।॥]/;

/** Strip leading and trailing punctuation + whitespace for token compare. */
function stripBoundaryPunct(s: string): string {
    // Anything that is not a letter / number / mark across any script.
    return s.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '');
}

/** Count Unicode tokens (words) — script-agnostic. */
function countTokens(s: string): number {
    const trimmed = s.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/u).length;
}

export interface StripGreetingOptions {
    /**
     * `true` when the conversation already has at least one prior model
     * turn. The function is a no-op when this is false (first reply of
     * a fresh conversation is allowed to greet warmly).
     */
    prevHadModelTurn: boolean;
}

/**
 * Strip a redundant opening greeting from a VIDYA reply when the
 * conversation is past its first turn.
 *
 * Behaviour:
 *   - prevHadModelTurn=false → returns the input unchanged.
 *   - First sentence is a pure greeting (one of the table tokens, with
 *     ≤4 total whitespace-separated tokens after stripping boundary
 *     punctuation) → that sentence is removed; the remainder is
 *     returned trimmed.
 *   - First sentence is substantive (longer than the greeting, OR does
 *     not start with a greeting token) → returned unchanged.
 *
 * The matcher is anchored to "pure greeting sentences" because the
 * teacher's complaint is about VIDYA opening with redundant filler;
 * we never want to lop the front off informative content.
 */
export function stripRedundantGreeting(
    response: string,
    options: StripGreetingOptions,
): string {
    if (!options.prevHadModelTurn) return response;
    if (!response || !response.trim()) return response;

    const split = splitFirstSentence(response);
    if (!split) return response;

    const [first, rest] = split;
    const cleanedFirst = stripBoundaryPunct(first).toLowerCase();
    if (!cleanedFirst) return response;

    // Pure-greeting test: the whole first sentence must BE the greeting,
    // not just start with one. Allow up to 4 tokens to cover
    // "Good morning", "हाँ ज़रूर बताइए", "ਸਤ ਸ੍ਰੀ ਅਕਾਲ".
    if (countTokens(cleanedFirst) > 4) return response;

    if (matchesGreetingToken(cleanedFirst)) {
        return rest.trim();
    }
    return response;
}

/**
 * Return `[firstSentence, rest]` or null if no sentence-end mark is
 * found in the input. `rest` may be empty. `firstSentence` includes
 * its terminating punctuation; the caller strips it before comparing.
 */
function splitFirstSentence(s: string): [string, string] | null {
    const match = s.match(SENTENCE_END);
    if (!match || match.index === undefined) {
        // No sentence-end mark — treat the entire string as one sentence.
        // We only strip if THAT whole string is a pure greeting (e.g. a
        // single-word "Sure" with no punctuation).
        const trimmed = s.trim();
        if (!trimmed) return null;
        if (matchesGreetingToken(stripBoundaryPunct(trimmed).toLowerCase())) {
            return [trimmed, ''];
        }
        return null;
    }
    const end = match.index + 1;
    return [s.slice(0, end), s.slice(end)];
}

function matchesGreetingToken(needle: string): boolean {
    if (NORMALISED_TOKENS.has(needle)) return true;
    // Fallback: collapsed-whitespace check (handles double spaces / NBSP).
    const collapsed = needle.replace(/\s+/gu, ' ').trim();
    return NORMALISED_TOKENS.has(collapsed);
}

// Re-export the token table so tests can verify coverage matches the
// supported-language matrix without importing the private const name.
export const GREETING_TOKENS_FOR_TEST: ReadonlyArray<string> = GREETING_TOKENS;
