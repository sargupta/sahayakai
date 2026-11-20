import { greetingFirstName } from '@/lib/teacher-name';

describe('greetingFirstName', () => {
    it('takes the first word of the profile name', () => {
        expect(greetingFirstName('Meena Kulkarni', 'Alyssa L')).toBe('Meena');
    });
    it('falls back to the account name when the profile has none', () => {
        expect(greetingFirstName(undefined, 'Alyssa L')).toBe('Alyssa');
        expect(greetingFirstName('', 'Alyssa L')).toBe('Alyssa');
        expect(greetingFirstName('   ', 'Alyssa L.')).toBe('Alyssa');
    });
    it('drops trailing punctuation so the greeting never reads "Alyssa,."', () => {
        expect(greetingFirstName('Alyssa, ', null)).toBe('Alyssa');
    });
    it('keeps Indic names whole', () => {
        expect(greetingFirstName('मीना कुलकर्णी', null)).toBe('मीना');
    });
    it('returns null when no name is known, so the caller chooses the fallback', () => {
        expect(greetingFirstName(null, null)).toBeNull();
        expect(greetingFirstName(' ', undefined)).toBeNull();
    });
});
