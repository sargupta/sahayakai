/**
 * @jest-environment node
 */
import { resolveLanguage } from '@/lib/sampark/policy/language';

import { guardian, prefs, school } from './_fixtures';

describe('resolveLanguage: prefs.language ?? guardian.crmLanguage ?? school.defaultLanguage ?? null', () => {
    it('the family’s registered preference wins', () => {
        expect(resolveLanguage(guardian('g', { crmLanguage: 'Hindi' }), prefs('g', {}, 'Nepali'), school({ defaultLanguage: 'English' }))).toBe('Nepali');
    });

    it('falls back to the CRM language', () => {
        expect(resolveLanguage(guardian('g', { crmLanguage: 'Bengali' }), prefs('g', {}, null), school({ defaultLanguage: 'English' }))).toBe('Bengali');
        expect(resolveLanguage(guardian('g', { crmLanguage: 'Bengali' }), null, school())).toBe('Bengali');
    });

    it('then to the school default, only if the school chose one', () => {
        expect(resolveLanguage(guardian('g', { crmLanguage: null }), null, school({ defaultLanguage: 'Hindi' }))).toBe('Hindi');
    });

    it('otherwise null — the family is asked, never guessed', () => {
        expect(resolveLanguage(guardian('g', { crmLanguage: null }), null, school({ defaultLanguage: null }))).toBeNull();
    });

    it('ignores a value that is not a parent language', () => {
        const bad = { ...prefs('g'), language: 'Klingon' as never };
        expect(resolveLanguage(guardian('g', { crmLanguage: 'Hindi' }), bad, school())).toBe('Hindi');
    });
});
