import crypto from 'crypto';
import { isValidE164 } from '@/lib/twilio-validate';

// We test isValidE164 directly — signature validation requires NextRequest mocking
// which is covered in the API route tests.

describe('twilio-validate', () => {
    describe('isValidE164', () => {
        it('accepts valid Indian numbers', () => {
            expect(isValidE164('+919876543210')).toBe(true);
            expect(isValidE164('+916363740720')).toBe(true);
        });

        it('accepts valid international numbers', () => {
            expect(isValidE164('+15577773467')).toBe(true); // US
            expect(isValidE164('+442071234567')).toBe(true); // UK
            expect(isValidE164('+8613912345678')).toBe(true); // China
        });

        it('rejects numbers without + prefix', () => {
            expect(isValidE164('919876543210')).toBe(false);
            expect(isValidE164('9876543210')).toBe(false);
        });

        it('rejects numbers starting with +0', () => {
            expect(isValidE164('+0123456789')).toBe(false);
        });

        it('rejects too short numbers', () => {
            expect(isValidE164('+12345')).toBe(false);
            expect(isValidE164('+1')).toBe(false);
        });

        it('rejects too long numbers', () => {
            expect(isValidE164('+123456789012345')).toBe(true); // 15 digits = max valid E.164
            expect(isValidE164('+1234567890123456')).toBe(false); // 16 digits = too long
        });

        it('rejects empty and non-numeric', () => {
            expect(isValidE164('')).toBe(false);
            expect(isValidE164('+abc')).toBe(false);
            expect(isValidE164('+')).toBe(false);
            expect(isValidE164('+91 9876 543210')).toBe(false); // spaces
        });
    });
});
