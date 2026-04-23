import { LANGUAGE_CODE_MAP } from '@/types/index';

/**
 * Normalise a language value into the full Language display name used by the
 * ABSOLUTE LANGUAGE LOCK in `STRUCTURED_OUTPUT_OVERRIDE` (src/ai/soul.ts).
 *
 * Why this helper exists: every AI flow historically accepted either an ISO
 * code ("en", "hi", "bn") or a display name ("English", "Hindi", "Bengali").
 * When the prompt embedded the raw "en", the model often treated it as a
 * loose hint and slipped into Hinglish per the SOUL's "Multilingual
 * Scaffolding" directive — a prod bug reported 2026-04-23 for quiz output.
 *
 * Passing the full name keeps the lock unambiguous.
 *
 * - Input already a display name → returned unchanged.
 * - Input is an ISO code → mapped via LANGUAGE_CODE_MAP.
 * - Input is missing / unknown → falls back to "English".
 */
export function normalizeLanguage(raw?: string | null): string {
    if (!raw) return 'English';
    const lower = raw.toLowerCase();
    const mapped = (LANGUAGE_CODE_MAP as Record<string, string>)[lower];
    if (mapped) return mapped;
    // Input already looks like a display name ("English", "Hindi") — keep it.
    return raw;
}
