import crypto from 'crypto';
import { isValidE164, validateTwilioSignature, validateTwilioSignaturePost } from '@/lib/twilio-validate';
import type { NextRequest } from 'next/server';

function makeReq(headers: Record<string, string>, urlStr = 'https://example.com/api/x'): NextRequest {
    const h = new Map<string, string>(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return {
        url: urlStr,
        headers: { get: (k: string) => h.get(k.toLowerCase()) ?? null },
    } as unknown as NextRequest;
}

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

    // ── F8-01 regression tests ─────────────────────────────────────────────
    describe('F8-01 Host header bypass hardening', () => {
        const ORIGINAL_ENV = { ...process.env };
        beforeEach(() => {
            process.env = { ...ORIGINAL_ENV };
            // Strip jest signals so we can simulate production.
            delete process.env.JEST_WORKER_ID;
            delete process.env.VITEST;
            delete process.env.TWILIO_DISABLE_VALIDATION;
        });
        afterEach(() => { process.env = ORIGINAL_ENV; });

        it('rejects forged Host: localhost.evil.com in production (no skip)', () => {
            process.env.NODE_ENV = 'production';
            process.env.TWILIO_AUTH_TOKEN = 'secret';
            const req = makeReq({ host: 'localhost.evil.com' }); // no x-twilio-signature
            expect(validateTwilioSignature(req)).toBe(false);
            expect(validateTwilioSignaturePost(req, {})).toBe(false);
        });

        it('rejects forged Host: localhost.evil.com even in dev (substring trap)', () => {
            process.env.NODE_ENV = 'development';
            process.env.TWILIO_AUTH_TOKEN = 'secret';
            const req = makeReq({ host: 'localhost.evil.com' });
            expect(validateTwilioSignature(req)).toBe(false);
        });

        it('rejects bare localhost in production even with jest signals', () => {
            process.env.NODE_ENV = 'production';
            process.env.JEST_WORKER_ID = '1';
            process.env.TWILIO_AUTH_TOKEN = 'secret';
            const req = makeReq({ host: 'localhost' });
            expect(validateTwilioSignature(req)).toBe(false);
        });

        it('skips when host=localhost AND NODE_ENV=test', () => {
            process.env.NODE_ENV = 'test';
            const req = makeReq({ host: 'localhost' });
            expect(validateTwilioSignature(req)).toBe(true);
        });

        it('skips when host=localhost:3000 in test', () => {
            process.env.NODE_ENV = 'test';
            const req = makeReq({ host: 'localhost:3000' });
            expect(validateTwilioSignature(req)).toBe(true);
        });

        it('skips when host=127.0.0.1 in test', () => {
            process.env.NODE_ENV = 'test';
            const req = makeReq({ host: '127.0.0.1:8080' });
            expect(validateTwilioSignature(req)).toBe(true);
        });

        it('accepts valid signature in production with real public host', () => {
            process.env.NODE_ENV = 'production';
            const token = 'super-secret-token';
            process.env.TWILIO_AUTH_TOKEN = token;
            const url = 'https://api.sahayakai.com/api/attendance/twiml?outreachId=abc';
            const sig = crypto.createHmac('sha1', token).update(url).digest('base64');
            const req = makeReq(
                { host: 'api.sahayakai.com', 'x-forwarded-proto': 'https', 'x-twilio-signature': sig },
                url,
            );
            expect(validateTwilioSignature(req)).toBe(true);
        });
    });
});
