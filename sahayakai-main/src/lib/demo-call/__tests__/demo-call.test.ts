/**
 * Unit tests for the "Hear the Call" demo gates + scripts
 * (docs/PARENT_CALL_DEMO_SPEC.md section 10).
 */
import { isValidIndianMobile, hashIdentifier, encryptPhone, DEMO_STATUSES } from '../gates';
import { DEMO_CALL_SCRIPTS, DEMO_CALL_LANGUAGES, isDemoLanguage } from '../scripts';
import { LANGUAGES } from '@/types';

describe('isValidIndianMobile', () => {
    it.each([
        '+919812345678',
        '+916000000000',
        '+917999999999',
    ])('accepts valid Indian mobile %s', (p) => {
        expect(isValidIndianMobile(p)).toBe(true);
    });

    it.each([
        ['+15551234567', 'non-Indian country code'],
        ['+915812345678', 'landline-range leading 5'],
        ['+9198123456', 'too short'],
        ['+9198123456789', 'too long'],
        ['9812345678', 'missing +91'],
        ['+91 9812345678', 'inner whitespace'],
        ['', 'empty'],
    ])('rejects %s (%s)', (p) => {
        expect(isValidIndianMobile(p)).toBe(false);
    });
});

describe('demo scripts', () => {
    it('covers every supported app language', () => {
        expect(new Set(DEMO_CALL_LANGUAGES)).toEqual(new Set(LANGUAGES));
    });

    it('every script self-identifies and never contains XML-breaking raw markup', () => {
        for (const lang of DEMO_CALL_LANGUAGES) {
            const script = DEMO_CALL_SCRIPTS[lang];
            expect(script.length).toBeGreaterThan(100);
            expect(script).not.toMatch(/[<>]/);
        }
    });

    it('isDemoLanguage acts as a strict allowlist (twiml path-param guard)', () => {
        expect(isDemoLanguage('Hindi')).toBe(true);
        expect(isDemoLanguage('../../etc/passwd')).toBe(false);
        expect(isDemoLanguage('')).toBe(false);
        expect(isDemoLanguage(null)).toBe(false);
        expect(isDemoLanguage(undefined)).toBe(false);
        expect(isDemoLanguage('hindi')).toBe(false); // case-sensitive on purpose
    });
});

describe('hashIdentifier', () => {
    it('is deterministic and never echoes the input', () => {
        const h1 = hashIdentifier('+919812345678');
        const h2 = hashIdentifier('+919812345678');
        expect(h1).toBe(h2);
        expect(h1).toMatch(/^[a-f0-9]{64}$/);
        expect(h1).not.toContain('9812345678');
    });

    it('differs across inputs', () => {
        expect(hashIdentifier('+919812345678')).not.toBe(hashIdentifier('+919812345679'));
    });
});

describe('encryptPhone', () => {
    const KEY = Buffer.alloc(32, 7).toString('base64');

    afterEach(() => {
        delete process.env.DEMO_CALL_ENC_KEY;
    });

    it('stores only last-4 when no key is provisioned', () => {
        delete process.env.DEMO_CALL_ENC_KEY;
        const { phoneEnc, phoneLast4 } = encryptPhone('+919812345678');
        expect(phoneEnc).toBeNull();
        expect(phoneLast4).toBe('5678');
    });

    it('produces a versioned ciphertext that does not contain the number', () => {
        process.env.DEMO_CALL_ENC_KEY = KEY;
        const { phoneEnc, phoneLast4 } = encryptPhone('+919812345678');
        expect(phoneLast4).toBe('5678');
        expect(phoneEnc).toMatch(/^v1:/);
        expect(phoneEnc).not.toContain('9812345678');
    });

    it('falls back to last-4 on a malformed key instead of throwing', () => {
        process.env.DEMO_CALL_ENC_KEY = 'too-short';
        const { phoneEnc } = encryptPhone('+919812345678');
        expect(phoneEnc).toBeNull();
    });
});

describe('DEMO_STATUSES', () => {
    it('includes every Twilio status the callback maps', () => {
        for (const s of ['completed', 'no-answer', 'failed', 'busy', 'ringing', 'in-progress']) {
            expect(DEMO_STATUSES).toContain(s);
        }
    });
});
