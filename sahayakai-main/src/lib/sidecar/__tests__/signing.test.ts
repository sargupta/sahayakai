/**
 * Tests for `signing.ts` — HMAC body digest + 5-minute key cache TTL
 * + per-request id mint.
 *
 * Covers:
 *   1. Digest deterministic for a given (key, timestamp, body).
 *   2. `X-Content-Digest` carries `sha256=<base64>` shape.
 *   3. Timestamp binds into the MAC.
 *   4. Cache hit avoids second Secret Manager read inside the TTL.
 *   5. Cache miss after TTL → re-reads the secret.
 *   6. Short secret (<32 chars) rejected — fails closed.
 *   7. Whitespace / newline stripped from secret value.
 *   8. `_resetSigningKeyCacheForTest` clears the cache.
 *   9. `newRequestId` returns 32-char hex (UUID minus dashes).
 *  10. `computeBodyDigest` is the back-compat wrapper.
 */

import crypto from 'node:crypto';

const SECRET_VALUE = 'a'.repeat(48);
const getSecretMock = jest.fn(async (_name: string) => SECRET_VALUE);

jest.mock('@/lib/secrets', () => ({
    getSecret: (...args: unknown[]) => getSecretMock(...(args as [string])),
}));

import {
    _resetSigningKeyCacheForTest,
    computeBodyDigest,
    newRequestId,
    signRequest,
} from '../signing';

beforeEach(() => {
    jest.clearAllMocks();
    _resetSigningKeyCacheForTest();
    getSecretMock.mockResolvedValue(SECRET_VALUE);
});

describe('signRequest', () => {
    it('produces sha256=<base64> digest matching crypto.createHmac', async () => {
        const body = JSON.stringify({ topic: 'photosynthesis' });
        const { digest, timestamp } = await signRequest(body);
        expect(digest).toMatch(/^sha256=[A-Za-z0-9+/=]+$/);
        expect(/^\d+$/.test(timestamp)).toBe(true);

        const expected = crypto
            .createHmac('sha256', SECRET_VALUE)
            .update(`${timestamp}:`, 'utf8')
            .update(body, 'utf8')
            .digest('base64');
        expect(digest).toBe(`sha256=${expected}`);
    });

    it('binds the timestamp into the MAC (same body, different ts → different digest)', async () => {
        const body = '{"x":1}';
        const a = await signRequest(body);
        const realNow = Date.now;
        const fakeNow = realNow() + 50_000;
        const spy = jest.spyOn(Date, 'now').mockReturnValue(fakeNow);
        const b = await signRequest(body);
        spy.mockRestore();
        expect(a.timestamp).not.toBe(b.timestamp);
        expect(a.digest).not.toBe(b.digest);
    });

    it('caches the signing key within the 5-minute TTL', async () => {
        await signRequest('{"a":1}');
        await signRequest('{"b":2}');
        await signRequest('{"c":3}');
        expect(getSecretMock).toHaveBeenCalledTimes(1);
    });

    it('reloads the signing key after the TTL elapses', async () => {
        await signRequest('{"a":1}');
        const startNow = Date.now();
        jest.spyOn(Date, 'now').mockImplementation(() => startNow + 6 * 60 * 1000);
        await signRequest('{"b":2}');
        expect(getSecretMock).toHaveBeenCalledTimes(2);
    });

    it('rejects a too-short secret (<32 chars)', async () => {
        getSecretMock.mockResolvedValueOnce('shortkey');
        await expect(signRequest('{}')).rejects.toThrow(/must be at least 32 chars/);
    });

    it('rejects an empty secret', async () => {
        getSecretMock.mockResolvedValueOnce('');
        await expect(signRequest('{}')).rejects.toThrow(/at least 32 chars/);
    });

    it('strips trailing whitespace/newlines from the secret', async () => {
        getSecretMock.mockResolvedValueOnce(`${SECRET_VALUE}\n  `);
        const body = '{"k":"v"}';
        const { digest, timestamp } = await signRequest(body);
        const expected = crypto
            .createHmac('sha256', SECRET_VALUE)
            .update(`${timestamp}:`, 'utf8')
            .update(body, 'utf8')
            .digest('base64');
        expect(digest).toBe(`sha256=${expected}`);
    });

    it('_resetSigningKeyCacheForTest forces a fresh getSecret call', async () => {
        await signRequest('{}');
        expect(getSecretMock).toHaveBeenCalledTimes(1);
        _resetSigningKeyCacheForTest();
        await signRequest('{}');
        expect(getSecretMock).toHaveBeenCalledTimes(2);
    });
});

describe('computeBodyDigest (backwards-compat wrapper)', () => {
    it('returns just the sha256= digest header value', async () => {
        const digest = await computeBodyDigest('{"x":1}');
        expect(digest).toMatch(/^sha256=[A-Za-z0-9+/=]+$/);
    });
});

describe('newRequestId', () => {
    it('returns a 32-char hex string (UUID minus dashes)', () => {
        expect(newRequestId()).toMatch(/^[0-9a-f]{32}$/);
    });

    it('produces distinct ids on repeated calls', () => {
        const ids = new Set([newRequestId(), newRequestId(), newRequestId()]);
        expect(ids.size).toBe(3);
    });
});
