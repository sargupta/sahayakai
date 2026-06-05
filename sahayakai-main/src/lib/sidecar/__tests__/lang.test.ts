/**
 * Tests for centralised language normalisation used by every sidecar
 * dispatcher. These guard the Python `LessonPlanLanguage` Literal
 * (`'en'`, `'hi'`, `'bn'`, …) which is the strictest of the agents —
 * if `toIsoLanguage` regresses, lesson-plan canary traffic will 422.
 */
import {
    LANGUAGE_LABEL_TO_ISO,
    toIsoLanguage,
    toLanguageLabel,
} from '../lang';

describe('toIsoLanguage', () => {
    it('maps every supported display name to its ISO code', () => {
        for (const [label, iso] of Object.entries(LANGUAGE_LABEL_TO_ISO)) {
            expect(toIsoLanguage(label)).toBe(iso);
        }
    });

    it('accepts case-insensitive display names', () => {
        expect(toIsoLanguage('english')).toBe('en');
        expect(toIsoLanguage('HINDI')).toBe('hi');
        expect(toIsoLanguage('Kannada')).toBe('kn');
    });

    it('passes through ISO codes unchanged (lowercased)', () => {
        expect(toIsoLanguage('en')).toBe('en');
        expect(toIsoLanguage('EN')).toBe('en');
        expect(toIsoLanguage('bn')).toBe('bn');
    });

    it('falls back on missing / unknown values', () => {
        expect(toIsoLanguage(undefined)).toBe('en');
        expect(toIsoLanguage(null)).toBe('en');
        expect(toIsoLanguage('')).toBe('en');
        expect(toIsoLanguage('Klingon')).toBe('en');
        expect(toIsoLanguage('xx')).toBe('en');
    });

    it('respects a caller-supplied fallback', () => {
        expect(toIsoLanguage(undefined, 'hi')).toBe('hi');
        expect(toIsoLanguage('?', 'bn')).toBe('bn');
    });

    it('covers all 11 ISO codes the lesson-plan Python schema accepts', () => {
        const expected = new Set([
            'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'pa', 'ml', 'or',
        ]);
        const actual = new Set(Object.values(LANGUAGE_LABEL_TO_ISO));
        expect(actual).toEqual(expected);
    });
});

describe('toLanguageLabel', () => {
    it('maps ISO codes back to display names', () => {
        expect(toLanguageLabel('en')).toBe('English');
        expect(toLanguageLabel('hi')).toBe('Hindi');
        expect(toLanguageLabel('kn')).toBe('Kannada');
        expect(toLanguageLabel('or')).toBe('Odia');
    });

    it('passes through display names unchanged', () => {
        expect(toLanguageLabel('English')).toBe('English');
        expect(toLanguageLabel('Bengali')).toBe('Bengali');
    });

    it('falls back on unknown values', () => {
        expect(toLanguageLabel(undefined)).toBe('English');
        expect(toLanguageLabel('xx')).toBe('English');
    });
});

/**
 * Mirror of the Python `LessonPlanLanguage` Literal — exercised so a
 * future Python schema change that drops a code surfaces here.
 */
describe('LessonPlanLanguage Python-schema parity', () => {
    const PY_LITERAL = [
        'en', 'hi', 'bn', 'te', 'mr', 'ta', 'gu', 'kn', 'pa', 'ml', 'or',
    ] as const;

    it.each(PY_LITERAL)(
        '%s is emitted by toIsoLanguage for some display name',
        (iso) => {
            const inverse = toLanguageLabel(iso);
            expect(toIsoLanguage(inverse)).toBe(iso);
        },
    );

    it('Genkit display names from lane-F payload all map to valid ISO codes', () => {
        const laneFLabels = ['English', 'Hindi', 'Kannada', 'Bengali', 'Tamil'];
        for (const label of laneFLabels) {
            expect(PY_LITERAL).toContain(toIsoLanguage(label));
        }
    });
});
