/**
 * NCERT-demo 2026-05-19 regression: the OmniOrb client and the
 * destination form hooks both consume these normalisers when handing a
 * VIDYA action off to a form. If they drift, the form silently shows
 * defaults and the wrong lesson plan ships. Pin both ends here.
 */

import {
    normaliseVidyaLanguage,
    normaliseVidyaGradeLevel,
} from '@/lib/vidya-action-normalizer';

describe('normaliseVidyaLanguage', () => {
    it('passes ISO-2 codes through unchanged (lowercased)', () => {
        expect(normaliseVidyaLanguage('en')).toBe('en');
        expect(normaliseVidyaLanguage('hi')).toBe('hi');
        expect(normaliseVidyaLanguage('bn')).toBe('bn');
    });

    it('case-insensitively maps display names to ISO-2 codes', () => {
        expect(normaliseVidyaLanguage('English')).toBe('en');
        expect(normaliseVidyaLanguage('ENGLISH')).toBe('en');
        expect(normaliseVidyaLanguage('english')).toBe('en');
        expect(normaliseVidyaLanguage('Hindi')).toBe('hi');
        expect(normaliseVidyaLanguage('Kannada')).toBe('kn');
        expect(normaliseVidyaLanguage('Tamil')).toBe('ta');
        expect(normaliseVidyaLanguage('Telugu')).toBe('te');
        expect(normaliseVidyaLanguage('Marathi')).toBe('mr');
        expect(normaliseVidyaLanguage('Bengali')).toBe('bn');
        expect(normaliseVidyaLanguage('Gujarati')).toBe('gu');
        expect(normaliseVidyaLanguage('Punjabi')).toBe('pa');
        expect(normaliseVidyaLanguage('Malayalam')).toBe('ml');
        expect(normaliseVidyaLanguage('Odia')).toBe('or');
    });

    it('returns null for empty / missing / whitespace input', () => {
        expect(normaliseVidyaLanguage(undefined)).toBeNull();
        expect(normaliseVidyaLanguage(null)).toBeNull();
        expect(normaliseVidyaLanguage('')).toBeNull();
        expect(normaliseVidyaLanguage('   ')).toBeNull();
    });

    it('preserves unknown languages so future additions are not silently dropped', () => {
        expect(normaliseVidyaLanguage('Swahili')).toBe('Swahili');
        expect(normaliseVidyaLanguage('xx')).toBe('xx');
    });

    it('trims whitespace before mapping', () => {
        expect(normaliseVidyaLanguage('  English  ')).toBe('en');
    });
});

describe('normaliseVidyaGradeLevel', () => {
    it('passes "Class N" through unchanged', () => {
        expect(normaliseVidyaGradeLevel('Class 7')).toBe('Class 7');
        expect(normaliseVidyaGradeLevel('Class 12')).toBe('Class 12');
    });

    it('normalises numeric-only grades', () => {
        expect(normaliseVidyaGradeLevel('7')).toBe('Class 7');
        expect(normaliseVidyaGradeLevel('10')).toBe('Class 10');
    });

    it('normalises legacy "Nth Grade" / "Grade N" variants', () => {
        expect(normaliseVidyaGradeLevel('7th Grade')).toBe('Class 7');
        expect(normaliseVidyaGradeLevel('Grade 7')).toBe('Class 7');
        expect(normaliseVidyaGradeLevel('grade 7')).toBe('Class 7');
        expect(normaliseVidyaGradeLevel('12th Grade')).toBe('Class 12');
    });

    it('returns null for empty / missing input', () => {
        expect(normaliseVidyaGradeLevel(undefined)).toBeNull();
        expect(normaliseVidyaGradeLevel(null)).toBeNull();
        expect(normaliseVidyaGradeLevel('')).toBeNull();
        expect(normaliseVidyaGradeLevel('  ')).toBeNull();
    });

    it('preserves non-numeric grades (Nursery, LKG, UKG)', () => {
        expect(normaliseVidyaGradeLevel('Nursery')).toBe('Nursery');
        expect(normaliseVidyaGradeLevel('LKG')).toBe('LKG');
        expect(normaliseVidyaGradeLevel('UKG')).toBe('UKG');
    });
});
