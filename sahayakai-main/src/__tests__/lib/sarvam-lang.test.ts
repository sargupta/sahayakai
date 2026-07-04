/**
 * Sarvam pure-function contract tests.
 *
 * These guard two things that are otherwise only ever *mocked* in the route
 * tests and so could silently drift:
 *   1. toSarvamLangCode — the Odia voice-equity mapping (or-IN → Sarvam's
 *      od-IN). Google Cloud TTS has no Odia voice, so if this mapping breaks,
 *      Odia silently falls back to a Hindi-accented reading. It must map
 *      Odia and pass through the other 10 natively-supported codes.
 *   2. concatBase64Mp3 — used to stitch the parallel TTS chunks back into one
 *      clip. A bug here corrupts every long TTS readback.
 */

// sarvam.ts guards itself with `import 'server-only'`, which throws outside an
// RSC build. Neutralise it so we can unit-test the pure helpers directly.
jest.mock('server-only', () => ({}));

import { toSarvamLangCode, concatBase64Mp3 } from '@/lib/sarvam';

describe('toSarvamLangCode', () => {
    it('maps Odia or-IN to Sarvam od-IN (voice equity — Google has no Odia voice)', () => {
        expect(toSarvamLangCode('or-IN')).toBe('od-IN');
    });

    it('passes through every natively-supported Sarvam code unchanged', () => {
        const supported = [
            'bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN',
            'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'ta-IN', 'te-IN',
        ];
        for (const code of supported) {
            expect(toSarvamLangCode(code)).toBe(code);
        }
    });

    it('returns null for languages Sarvam does not cover (caller falls back to Google)', () => {
        expect(toSarvamLangCode('fr-FR')).toBeNull();
        expect(toSarvamLangCode('en-US')).toBeNull();
        expect(toSarvamLangCode('')).toBeNull();
    });
});

describe('concatBase64Mp3', () => {
    it('returns a single chunk unchanged (no needless re-encode)', () => {
        const only = Buffer.from('one').toString('base64');
        expect(concatBase64Mp3([only])).toBe(only);
    });

    it('concatenates multiple base64 MP3 buffers byte-for-byte', () => {
        const a = Buffer.from('AA').toString('base64');
        const b = Buffer.from('BB').toString('base64');
        const c = Buffer.from('CC').toString('base64');
        const out = concatBase64Mp3([a, b, c]);
        expect(Buffer.from(out, 'base64').toString()).toBe('AABBCC');
    });
});
