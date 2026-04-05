/**
 * Tests for type exports and utility functions from src/types/index.ts
 *
 * Verifies:
 * - getCareerStage() returns correct stage for various experience levels
 * - LANGUAGE_NATIVE_LABELS covers all 11 LANGUAGES entries
 * - STATE_BOARD_MAP has entries for major states
 * - UserProfile uses gradeLevels as the canonical field name (compile-time check)
 */

import {
    getCareerStage,
    LANGUAGES,
    LANGUAGE_NATIVE_LABELS,
    STATE_BOARD_MAP,
    type UserProfile,
    type GradeLevel,
    type Language,
} from '@/types';

// ── getCareerStage ───────────────────────────────────────────────────────────

describe('getCareerStage()', () => {
    it('returns "early" for 0 years', () => {
        expect(getCareerStage(0)).toBe('early');
    });

    it('returns "early" for 3 years (boundary)', () => {
        expect(getCareerStage(3)).toBe('early');
    });

    it('returns "mid" for 5 years', () => {
        expect(getCareerStage(5)).toBe('mid');
    });

    it('returns "mid" for 7 years (boundary)', () => {
        expect(getCareerStage(7)).toBe('mid');
    });

    it('returns "senior" for 10 years', () => {
        expect(getCareerStage(10)).toBe('senior');
    });

    it('returns "senior" for 15 years (boundary)', () => {
        expect(getCareerStage(15)).toBe('senior');
    });

    it('returns "leadership" for 20 years', () => {
        expect(getCareerStage(20)).toBe('leadership');
    });

    it('returns "leadership" for 16 years (just past boundary)', () => {
        expect(getCareerStage(16)).toBe('leadership');
    });

    it('clamps negative years to "early"', () => {
        expect(getCareerStage(-5)).toBe('early');
    });
});

// ── LANGUAGE_NATIVE_LABELS ───────────────────────────────────────────────────

describe('LANGUAGE_NATIVE_LABELS', () => {
    it('has exactly 11 entries matching LANGUAGES', () => {
        expect(Object.keys(LANGUAGE_NATIVE_LABELS)).toHaveLength(LANGUAGES.length);
        expect(LANGUAGES.length).toBe(11);
    });

    it('has an entry for every language in LANGUAGES', () => {
        for (const lang of LANGUAGES) {
            expect(LANGUAGE_NATIVE_LABELS).toHaveProperty(lang);
            expect(typeof LANGUAGE_NATIVE_LABELS[lang]).toBe('string');
            expect(LANGUAGE_NATIVE_LABELS[lang].length).toBeGreaterThan(0);
        }
    });

    it('contains expected native scripts', () => {
        expect(LANGUAGE_NATIVE_LABELS['Hindi']).toBe('हिंदी');
        expect(LANGUAGE_NATIVE_LABELS['Kannada']).toBe('ಕನ್ನಡ');
        expect(LANGUAGE_NATIVE_LABELS['Tamil']).toBe('தமிழ்');
        expect(LANGUAGE_NATIVE_LABELS['Bengali']).toBe('বাংলা');
        expect(LANGUAGE_NATIVE_LABELS['Malayalam']).toBe('മലയാളം');
    });
});

// ── STATE_BOARD_MAP ──────────────────────────────────────────────────────────

describe('STATE_BOARD_MAP', () => {
    const majorStates = [
        'Karnataka',
        'Maharashtra',
        'Tamil Nadu',
        'Kerala',
        'Telangana',
        'Gujarat',
        'Rajasthan',
        'West Bengal',
        'Uttar Pradesh',
        'Delhi',
    ];

    it.each(majorStates)('has an entry for %s', (state) => {
        expect(STATE_BOARD_MAP).toHaveProperty(state);
        expect(typeof STATE_BOARD_MAP[state]).toBe('string');
        expect(STATE_BOARD_MAP[state].length).toBeGreaterThan(0);
    });

    it('maps Karnataka to KSEEB board', () => {
        expect(STATE_BOARD_MAP['Karnataka']).toBe('Karnataka State Board (KSEEB)');
    });

    it('maps Maharashtra to MSBSHSE board', () => {
        expect(STATE_BOARD_MAP['Maharashtra']).toBe('Maharashtra State Board (MSBSHSE)');
    });
});

// ── UserProfile type: gradeLevels is the canonical field ─────────────────────

describe('UserProfile type', () => {
    it('uses gradeLevels as the canonical field (compile-time type check)', () => {
        // This test verifies at compile time that gradeLevels exists on UserProfile.
        // If the field were renamed or removed, TypeScript would fail to compile this test.
        const profile: Pick<UserProfile, 'gradeLevels'> = {
            gradeLevels: ['Class 5', 'Class 6'] as GradeLevel[],
        };
        expect(profile.gradeLevels).toEqual(['Class 5', 'Class 6']);
    });

    it('has preferredLanguage typed as Language', () => {
        const profile: Pick<UserProfile, 'preferredLanguage'> = {
            preferredLanguage: 'Kannada' as Language,
        };
        expect(profile.preferredLanguage).toBe('Kannada');
    });
});
