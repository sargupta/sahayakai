/**
 * Cookie + signing tests for the onboarding-completion gate.
 * The middleware itself is hard to unit-test end-to-end (it depends on
 * jose + Firebase certs), so we instead pin the cookie-signing contract
 * — middleware uses the same `verifyProfileCompleteCookie` helper.
 */

import {
    signProfileCompleteCookie,
    verifyProfileCompleteCookie,
    PROFILE_COMPLETE_COOKIE,
} from '@/lib/profile-complete-cookie';

beforeAll(() => {
    process.env.PROFILE_COMPLETE_COOKIE_SECRET = 'test-secret-please-rotate-in-prod-x123';
});

describe('profile-complete cookie', () => {
    it('exposes a stable cookie name', () => {
        expect(PROFILE_COMPLETE_COOKIE).toBe('sahayakai_profile_complete');
    });

    it('signs and verifies a cookie roundtrip', async () => {
        const value = signProfileCompleteCookie('user-abc-123');
        expect(value).toMatch(/^user-abc-123\./);
        const verified = await verifyProfileCompleteCookie(value);
        expect(verified).toBe('user-abc-123');
    });

    it('returns null for undefined / empty cookie (absent cookie)', async () => {
        expect(await verifyProfileCompleteCookie(undefined)).toBeNull();
        expect(await verifyProfileCompleteCookie('')).toBeNull();
    });

    it('rejects a tampered signature', async () => {
        const value = signProfileCompleteCookie('user-abc-123');
        const tampered = value.slice(0, -2) + 'AA';
        expect(await verifyProfileCompleteCookie(tampered)).toBeNull();
    });

    it('rejects a swapped-uid attack (signature was for a different user)', async () => {
        const signed = signProfileCompleteCookie('victim-uid');
        const idx = signed.lastIndexOf('.');
        const sig = signed.slice(idx + 1);
        const forged = `attacker-uid.${sig}`;
        expect(await verifyProfileCompleteCookie(forged)).toBeNull();
    });

    it('rejects malformed cookie (no dot)', async () => {
        expect(await verifyProfileCompleteCookie('nodothere')).toBeNull();
    });

    it('rejects cookie with empty sig', async () => {
        expect(await verifyProfileCompleteCookie('user.')).toBeNull();
    });
});
