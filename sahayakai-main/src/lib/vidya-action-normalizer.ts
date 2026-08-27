/**
 * VIDYA action-param normalisers.
 *
 * Centralises the small string-shape transforms applied when a VIDYA
 * action navigates the teacher to a destination form. Extracted so the
 * NCERT-demo regression tests can exercise the normalisation contracts
 * without spinning up the full OmniOrb React tree (which depends on
 * Zustand, Firestore, microphone APIs, and TTS).
 *
 * Why the normalisation exists in the first place: the supervisor
 * sometimes emits language in display-name form ("English", "Hindi")
 * and grade-level in legacy form ("7th Grade") while the destination
 * forms drive their selectors with canonical values ("en", "Class 7").
 * Without normalisation the Select silently falls back to its default
 * option and the teacher sees "form filled wrong" — the exact NCERT-demo
 * 2026-05-19 bug.
 */

/** Recognised ISO-2 → display name map (kept inline to avoid pulling in heavy types). */
const LANG_DISPLAY_TO_ISO: Record<string, string> = {
    english: 'en',
    hindi: 'hi',
    kannada: 'kn',
    tamil: 'ta',
    telugu: 'te',
    marathi: 'mr',
    bengali: 'bn',
    gujarati: 'gu',
    punjabi: 'pa',
    malayalam: 'ml',
    odia: 'or',
};

const ISO_CODES = new Set(Object.values(LANG_DISPLAY_TO_ISO));

/**
 * Normalise an arbitrary language string into an ISO-2 code the
 * `<LanguageSelector>` recognises. Falls back to the original value
 * (trimmed) if no mapping is known, so a future language addition isn't
 * silently dropped — the caller decides whether to keep or discard it.
 *
 * Returns `null` for empty / missing input so callers can skip the URL
 * write rather than emit `?language=`.
 */
export function normaliseVidyaLanguage(val?: string | null): string | null {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    if (ISO_CODES.has(lower)) return lower;
    return LANG_DISPLAY_TO_ISO[lower] ?? trimmed;
}

/**
 * Normalise a grade-level string into the "Class N" form the destination
 * forms expect. Accepts "7", "Class 7", "7th Grade", "Grade 7", and any
 * other variant that contains a numeric grade. Falls back to the trimmed
 * input when no digit is present (e.g. "Nursery", "LKG") so the destination
 * selector can render its own representation.
 *
 * Returns `null` for empty / missing input.
 */
export function normaliseVidyaGradeLevel(val?: string | null): string | null {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/(\d+)/);
    if (match) return `Class ${match[1]}`;
    return trimmed;
}

/**
 * The slice of `ReadonlyURLSearchParams` the destination hooks read. Typed
 * structurally so a plain `URLSearchParams` also satisfies it.
 */
export interface DeepLinkParamReader {
    get(name: string): string | null;
}

/**
 * Identity of ONE deep link, over exactly the params the caller consumes.
 *
 * The destination hooks run their URL branch behind a ref so a re-render does
 * not re-fetch a saved record or overwrite what the teacher has since typed.
 * A bare boolean ref states that as "this MOUNT has been handled", which is
 * the wrong claim. The OmniOrb is mounted app-wide (app-shell.tsx), its
 * executeAction ends in a client-side `router.push` (omni-orb.tsx), and
 * neither destination page keys its <Suspense> — so a second VIDYA request
 * made while the teacher is already standing on the page changes the query
 * WITHOUT remounting. The boolean is still set from the first link, so the
 * second request is silently dropped and the teacher keeps looking at the
 * answer to the question before last.
 *
 * Keying the ref to this value makes the claim the true one — "these PARAMS
 * have been handled" — so a genuinely new set is honoured while a re-render
 * carrying identical params still runs once. Identical-URL repeats are not
 * this function's problem: omni-orb.tsx already forces a remount with
 * router.refresh() for those.
 *
 * Values are percent-encoded, so a param whose text contains `&` or `=`
 * cannot forge the key of a different param set.
 */
export function vidyaDeepLinkKey(
    searchParams: DeepLinkParamReader,
    names: readonly string[],
): string {
    return names
        .map((name) => `${name}=${encodeURIComponent(searchParams.get(name) ?? '')}`)
        .join('&');
}
