/**
 * @jest-environment node
 *
 * Regression tests for the SINGLE-LANGUAGE OUTPUT LOCK.
 *
 * Background: quiz generation in prod leaked Devanagari into English output
 * (~1,000 Hindi words) because two things were wrong —
 *   1. ISO codes ("en") weren't normalised before hitting the prompt, which
 *      the AI treated as a fuzzy hint.
 *   2. SAHAYAK_SOUL's "Use Hinglish/Home Language naturally" directive was
 *      stronger than the per-flow language hint.
 *
 * Fix is structural:
 *   - `normalizeLanguage()` maps ISO → display name, fallback English.
 *   - `STRUCTURED_OUTPUT_OVERRIDE` now carries a SINGLE-LANGUAGE LOCK that
 *     explicitly cancels the Hinglish directive for every structured flow.
 *
 * These tests pin both so a future edit can't silently regress the fix.
 * They do NOT hit Gemini — that would be slow + costly + flaky. Instead
 * they check the in-process contract that the prod bug depended on.
 */

import { normalizeLanguage } from '@/ai/lib/normalize-language';
import { STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';

describe('normalizeLanguage', () => {
    it('maps ISO codes to full display names', () => {
        expect(normalizeLanguage('en')).toBe('English');
        expect(normalizeLanguage('hi')).toBe('Hindi');
        expect(normalizeLanguage('bn')).toBe('Bengali');
        expect(normalizeLanguage('te')).toBe('Telugu');
        expect(normalizeLanguage('mr')).toBe('Marathi');
        expect(normalizeLanguage('ta')).toBe('Tamil');
        expect(normalizeLanguage('gu')).toBe('Gujarati');
        expect(normalizeLanguage('kn')).toBe('Kannada');
        expect(normalizeLanguage('pa')).toBe('Punjabi');
        expect(normalizeLanguage('ml')).toBe('Malayalam');
        expect(normalizeLanguage('or')).toBe('Odia');
    });

    it('normalises case-insensitively', () => {
        expect(normalizeLanguage('EN')).toBe('English');
        expect(normalizeLanguage('Hi')).toBe('Hindi');
    });

    it('passes display names through unchanged', () => {
        expect(normalizeLanguage('English')).toBe('English');
        expect(normalizeLanguage('Hindi')).toBe('Hindi');
        expect(normalizeLanguage('Marathi')).toBe('Marathi');
    });

    it('falls back to English when input is absent or null', () => {
        expect(normalizeLanguage(undefined)).toBe('English');
        expect(normalizeLanguage(null)).toBe('English');
        expect(normalizeLanguage('')).toBe('English');
    });

    it('preserves unknown inputs as-is (caller decides what to do)', () => {
        // Intentional: if someone passes "Swahili" we don't silently rewrite
        // to English — the LOCK prompt will tell the AI to honour the input.
        expect(normalizeLanguage('Swahili')).toBe('Swahili');
    });
});

describe('STRUCTURED_OUTPUT_OVERRIDE language lock', () => {
    it('announces the single-language lock', () => {
        expect(STRUCTURED_OUTPUT_OVERRIDE).toMatch(
            /SINGLE-LANGUAGE OUTPUT LOCK/i,
        );
    });

    it('explicitly overrides the VIDYA soul Hinglish directive', () => {
        expect(STRUCTURED_OUTPUT_OVERRIDE).toMatch(
            /(Use Hinglish|Multilingual Scaffolding|does NOT apply)/,
        );
    });

    it('forbids Devanagari and transliterated Hindi when language is English', () => {
        expect(STRUCTURED_OUTPUT_OVERRIDE).toMatch(/Devanagari/);
        expect(STRUCTURED_OUTPUT_OVERRIDE).toMatch(/transliterated/i);
    });

    it('binds teacher-facing fields to the same language as student-facing fields', () => {
        expect(STRUCTURED_OUTPUT_OVERRIDE).toMatch(/teacher-facing|same language/i);
    });
});
