/**
 * Centralised language-label ↔ ISO-639-1 code maps used by ALL sidecar
 * dispatchers when normalising input shape before forwarding to the
 * Python ADK sidecar.
 *
 * Why a separate module: the Python schemas pin `language` to a
 * `Literal['en', 'hi', 'bn', ...]` (lesson-plan) or a length-bounded
 * free string (most others). Genkit historically accepts either a
 * display name ("English") OR an ISO code ("en"); the helper
 * `src/ai/lib/normalize-language.ts` resolves to a display name so the
 * SOUL prompt embeds an unambiguous "English"/"Hindi". When forwarding
 * to the sidecar we MUST emit the 2-letter ISO code or Pydantic 422s.
 *
 * Source of truth for the underlying map: `LANGUAGE_TO_ISO` in
 * `src/types/index.ts`. This module mirrors it (importing across the
 * sidecar boundary would drag the entire `types/index.ts` blob into
 * any future ESM-only sidecar build).
 */

/** Canonical display-name → 2-letter ISO code. 11 supported languages. */
export const LANGUAGE_LABEL_TO_ISO: Readonly<Record<string, string>> = {
    English: 'en',
    Hindi: 'hi',
    Bengali: 'bn',
    Tamil: 'ta',
    Telugu: 'te',
    Marathi: 'mr',
    Kannada: 'kn',
    Malayalam: 'ml',
    Gujarati: 'gu',
    Punjabi: 'pa',
    Odia: 'or',
};

/** Valid ISO codes accepted by the Python `LessonPlanLanguage` Literal. */
const VALID_ISO_CODES: ReadonlySet<string> = new Set(
    Object.values(LANGUAGE_LABEL_TO_ISO),
);

/**
 * Normalise any language input (display name OR ISO code OR undefined)
 * into a 2-letter ISO code.
 *
 * - "English" / "english" → "en"
 * - "en" → "en" (pass-through when already ISO)
 * - undefined / null / unknown → fallback (defaults to "en")
 *
 * Case-insensitive on display names; ISO codes are emitted lowercase.
 * Unknown inputs fall back to the supplied default — the lesson-plan
 * dispatcher passes "en" so a hostile or stale client value can never
 * 422 the sidecar request shape.
 */
export function toIsoLanguage(
    input: string | null | undefined,
    fallback: string = 'en',
): string {
    if (!input) return fallback;
    const trimmed = input.trim();
    if (!trimmed) return fallback;
    // Already an ISO code (lowercased).
    const lower = trimmed.toLowerCase();
    if (VALID_ISO_CODES.has(lower)) return lower;
    // Display-name lookup (capitalised in the canonical map).
    const titled = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    if (LANGUAGE_LABEL_TO_ISO[titled]) return LANGUAGE_LABEL_TO_ISO[titled];
    return fallback;
}

/** Inverse map for completeness — ISO → display name. */
export function toLanguageLabel(
    input: string | null | undefined,
    fallback: string = 'English',
): string {
    if (!input) return fallback;
    const trimmed = input.trim();
    if (!trimmed) return fallback;
    const lower = trimmed.toLowerCase();
    if (VALID_ISO_CODES.has(lower)) {
        for (const [label, iso] of Object.entries(LANGUAGE_LABEL_TO_ISO)) {
            if (iso === lower) return label;
        }
    }
    // Already a display name (or unknown — return as-is, capitalised).
    const titled = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    if (LANGUAGE_LABEL_TO_ISO[titled]) return titled;
    return fallback;
}
