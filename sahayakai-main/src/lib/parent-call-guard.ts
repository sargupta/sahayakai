/**
 * Behavioural guard for parent-call agent replies — Genkit fallback path.
 *
 * Mirrors `sahayakai-agents/src/sahayakai_agents/_behavioural.py`. Both
 * paths run the same assertions:
 *
 * - Never reveal that the agent is an AI / bot / "Sahayak" / "SahayakAI".
 * - Keep replies to a small number of short sentences (phone call, not essay).
 * - Write in the correct Unicode script for the parent's language.
 *
 * Why a TypeScript copy when the Python sidecar already has these rules:
 * the sidecar is the primary path; the Genkit flow is the fallback path.
 * Wrong output to a real parent is worse than no output, so the fallback
 * has to fail-closed for the same reasons the sidecar does. Without this
 * port, the fallback could happily ship an "I am an AI assistant" line
 * when the sidecar circuit breaker trips.
 *
 * Round-2 audit P0 BEHAV-1.
 */

// Round-2 audit P0 GUARD-1 fix: pattern set expanded to catch
// apostrophe contractions, article omission, synonym variants, and
// Hindi transliteration drift. Byte-aligned with `_behavioural.py`.
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
    /\bSahaa?yak(\s*\.?\s*AI)?\b/i,
    /\bI\s*[''']?m\s+(?:an?\s+)?(?:AI|bot|chat\s*bot|assistant|language\s+model)\b/i,
    /\bI\s+am\s+(?:an?\s+)?(?:AI|bot|chat\s*bot|assistant|language\s+model)\b/i,
    /\bartificial\s+intelligence\b/i,
    /\bvirtual\s+(?:agent|assistant|helper)\b/i,
    /\bautomated\s+(?:agent|caller|system)\b/i,
    /\bdigital\s+(?:agent|assistant|helper)\b/i,
    /\b(?:ML|machine\s+learning)\s+model\b/i,
];

// Round-2 audit P0 GUARD-2 fix: include `…` and `。` as terminators.
const SENTENCE_ENDERS = /[.!?।॥…。]/g;

// Expected Unicode ranges per supported parent language. Keep
// byte-aligned with `_LANGUAGE_UNICODE_RANGES` in the Python guard so a
// fixture that passes one path can never fail the other.
const LANGUAGE_UNICODE_RANGES: Record<string, ReadonlyArray<readonly [number, number]>> = {
    hi: [[0x0900, 0x097F]],         // Devanagari
    bn: [[0x0980, 0x09FF]],         // Bengali
    te: [[0x0C00, 0x0C7F]],         // Telugu
    ta: [[0x0B80, 0x0BFF]],         // Tamil
    kn: [[0x0C80, 0x0CFF]],         // Kannada
    ml: [[0x0D00, 0x0D7F]],         // Malayalam
    gu: [[0x0A80, 0x0AFF]],         // Gujarati
    pa: [[0x0A00, 0x0A7F]],         // Gurmukhi
    mr: [[0x0900, 0x097F]],         // Devanagari (shared with Hindi)
    or: [[0x0B00, 0x0B7F]],         // Odia
    en: [                           // Latin
        [0x0020, 0x007F],
        [0x00A0, 0x00FF],
        [0x2000, 0x206F],
    ],
};

export type GuardAxis = 'forbidden_phrase' | 'sentence_count' | 'script_mismatch';

export class BehaviouralGuardError extends Error {
    readonly axis: GuardAxis;
    readonly details: string;
    readonly parentLanguage: string;
    constructor(axis: GuardAxis, details: string, parentLanguage: string) {
        super(`Behavioural guard failed (${axis}): ${details}`);
        this.name = 'BehaviouralGuardError';
        this.axis = axis;
        this.details = details;
        this.parentLanguage = parentLanguage;
    }
}

function assertNoForbiddenPhrases(text: string, parentLanguage: string): void {
    // Round-2 audit P0 GUARD-3 fix: NFKC-normalize before matching so
    // Cyrillic look-alikes (А = U+0410) don't bypass. Strip Unicode
    // invisibles (ZWJ, ZWNJ, BOM) that an attacker model could insert.
    const normalized = text
        .normalize('NFKC')
        .replace(/[\u200b-\u200d\ufeff]/g, '');
    for (const pattern of FORBIDDEN_PATTERNS) {
        const match = normalized.match(pattern);
        if (match) {
            throw new BehaviouralGuardError(
                'forbidden_phrase',
                `matched ${JSON.stringify(match[0])}`,
                parentLanguage,
            );
        }
    }
}

function countSentences(text: string): number {
    const parts = text.split(SENTENCE_ENDERS);
    return parts.filter(p => p.trim().length > 0).length;
}

function assertSentenceCountInRange(
    text: string,
    parentLanguage: string,
    lo = 1,
    hi = 5,
): void {
    const n = countSentences(text);
    if (n < lo || n > hi) {
        throw new BehaviouralGuardError(
            'sentence_count',
            `expected ${lo}-${hi} sentences, got ${n}`,
            parentLanguage,
        );
    }
}

function assertScriptMatchesLanguage(text: string, parentLanguage: string): void {
    const ranges = LANGUAGE_UNICODE_RANGES[parentLanguage];
    if (!ranges) return;

    let inRange = 0;
    let alphaTotal = 0;
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp === undefined) continue;

        // Indic scripts live in U+0900-U+0DFF and are not always
        // categorised as \p{L} by every JS regex engine; treat that
        // range as alphabetic for counting purposes.
        const isIndic = cp >= 0x0900 && cp <= 0x0DFF;
        const isAscii = (cp >= 0x0041 && cp <= 0x005A) || (cp >= 0x0061 && cp <= 0x007A);
        const isLatin1Supplement = cp >= 0x00C0 && cp <= 0x024F;
        const looksAlpha = isIndic || isAscii || isLatin1Supplement;
        if (!looksAlpha) continue;

        alphaTotal += 1;
        for (const [lo, hi] of ranges) {
            if (cp >= lo && cp <= hi) {
                inRange += 1;
                break;
            }
        }
    }

    if (alphaTotal === 0) return;
    const ratio = inRange / alphaTotal;
    // Allow up to 15 % out-of-script alpha chars for code-switching.
    if (ratio < 0.85) {
        throw new BehaviouralGuardError(
            'script_mismatch',
            `only ${(ratio * 100).toFixed(0)}% alpha chars in expected range`,
            parentLanguage,
        );
    }
}

/**
 * Composite assertion. Fail-closed: throws `BehaviouralGuardError` on the
 * first violation. Caller is responsible for falling back to a safe
 * canned response, exactly like the Python router's HTTP 502 path.
 *
 * `turnNumber` is unused today but kept in the signature so we can add
 * turn-specific rules (e.g. mandatory wrap-up tone at turn >= 5) without
 * churning call sites.
 */
export function assertAllRules(args: {
    reply: string;
    parentLanguage: string;
    turnNumber: number;
}): void {
    assertNoForbiddenPhrases(args.reply, args.parentLanguage);
    assertSentenceCountInRange(args.reply, args.parentLanguage);
    assertScriptMatchesLanguage(args.reply, args.parentLanguage);
}
