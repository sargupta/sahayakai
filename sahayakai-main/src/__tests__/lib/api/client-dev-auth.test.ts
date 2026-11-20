/**
 * The development dev-cookie rule in the shared API client (src/lib/api/client.ts).
 *
 * Bug: with a real Firebase user signed in in the same browser, every Sampark request
 * carried that user's Bearer token. The middleware prefers the Bearer over the
 * `auth-token=dev-token` cookie, so the request ran as the Google user, not the seeded
 * school admin `dev-user-123`, and the school routes answered 403.
 *
 * Class gate: the rule is pinned on every axis it depends on — environment, path,
 * exact cookie — for apiFetch AND the one Sampark call that builds headers itself
 * (fetchAudioBlob), so a new header-building path cannot quietly reintroduce it. The
 * server side (401 without a user, 403 for a non-admin) is unchanged and covered by
 * src/__tests__/api/sampark/routes.test.ts.
 */

jest.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }));

import { apiFetch, authHeaderFor, devCookieReplacesBearer } from '@/lib/api/client';
import { fetchAudioBlob } from '@/lib/api/sampark';

const getIdToken = jest.fn(async () => 'firebase-id-token');
const fakeAuth = (jest.requireMock('@/lib/firebase') as { auth: { currentUser: { getIdToken: typeof getIdToken } | null } }).auth;
const env = process.env as Record<string, string | undefined>;
const ORIGINAL_ENV = env.NODE_ENV;
let fetchSpy: jest.Mock;

function setCookie(value: string | null) {
    // jsdom: expire everything we may have set, then set the one we want.
    for (const name of ['auth-token', 'other']) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    if (value) document.cookie = `${value}; path=/`;
}

function sentHeaders(): Record<string, string> {
    const init = fetchSpy.mock.calls.at(-1)?.[1] as { headers?: Record<string, string> } | undefined;
    return init?.headers ?? {};
}

beforeEach(() => {
    fakeAuth.currentUser = { getIdToken };
    getIdToken.mockClear();
    fetchSpy = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }), blob: async () => new Blob(['x']) }));
    (global as unknown as { fetch: unknown }).fetch = fetchSpy;
});

afterEach(() => {
    env.NODE_ENV = ORIGINAL_ENV;
    setCookie(null);
});

describe('development, exact dev cookie, Sampark path', () => {
    beforeEach(() => {
        env.NODE_ENV = 'development';
        setCookie('auth-token=dev-token');
    });

    it('apiFetch sends no Bearer, even with a Firebase user signed in', async () => {
        await apiFetch('/api/sampark/me');
        expect(sentHeaders().Authorization).toBeUndefined();
        expect(getIdToken).not.toHaveBeenCalled();
    });

    it('fetchAudioBlob sends no Bearer either', async () => {
        await fetchAudioBlob('hillview-demo', 'clip-key');
        expect(String(fetchSpy.mock.calls[0][0])).toBe('/api/sampark/hillview-demo/audio/clip-key?format=pcm');
        expect(sentHeaders().Authorization).toBeUndefined();
    });

    it('a POST keeps its JSON content type', async () => {
        await apiFetch('/api/sampark/hillview-demo/enable', { body: { displayName: 'Hillview Demo School' } });
        expect(sentHeaders()).toEqual({ 'Content-Type': 'application/json' });
    });

    it('other API paths keep the Bearer', async () => {
        await apiFetch('/api/attendance/classes');
        expect(sentHeaders().Authorization).toBe('Bearer firebase-id-token');
    });

    it('absolute or protocol-relative URLs keep the Bearer (same-origin relative paths only)', async () => {
        expect(devCookieReplacesBearer('https://evil.example/api/sampark/me')).toBe(false);
        expect(devCookieReplacesBearer('//evil.example/api/sampark/me')).toBe(false);
        expect(await authHeaderFor('https://evil.example/api/sampark/me')).toEqual({ Authorization: 'Bearer firebase-id-token' });
    });
});

describe('development without the exact dev cookie', () => {
    beforeEach(() => {
        env.NODE_ENV = 'development';
    });

    it('a signed-in user keeps the Bearer on Sampark paths when no dev cookie is set', async () => {
        setCookie(null);
        await apiFetch('/api/sampark/me');
        expect(sentHeaders().Authorization).toBe('Bearer firebase-id-token');
    });

    it('a different auth-token value (a real session cookie) does not trigger the rule', async () => {
        setCookie('auth-token=dev-token-but-not-exactly');
        expect(devCookieReplacesBearer('/api/sampark/me')).toBe(false);
        setCookie('auth-token=eyJhbGciOiJSUzI1NiJ9.real.token');
        await apiFetch('/api/sampark/me');
        expect(sentHeaders().Authorization).toBe('Bearer firebase-id-token');
    });

    it('signed out and no dev cookie: no header at all (the server answers 401)', async () => {
        setCookie(null);
        fakeAuth.currentUser = null;
        await apiFetch('/api/sampark/me');
        expect(sentHeaders().Authorization).toBeUndefined();
    });
});

describe('production and test builds never use the rule', () => {
    it.each(['production', 'test'])('%s: the dev cookie is ignored and the Bearer is sent', async (mode) => {
        env.NODE_ENV = mode;
        setCookie('auth-token=dev-token');
        expect(devCookieReplacesBearer('/api/sampark/me')).toBe(false);
        await apiFetch('/api/sampark/me');
        expect(sentHeaders().Authorization).toBe('Bearer firebase-id-token');
        await fetchAudioBlob('hillview-demo', 'clip-key');
        expect(sentHeaders().Authorization).toBe('Bearer firebase-id-token');
    });
});

describe('auth-context keeps a chosen dev login (the 403-on-page-load race)', () => {
    // Imported lazily: auth-context pulls in analytics and router modules; mock what it touches.
    jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

    function cookieValue(): string | undefined {
        return document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('auth-token='));
    }

    it('development + exact dev cookie: a Firebase token refresh does not overwrite it, nor does sign-out clear it', async () => {
        const { syncAuthCookie } = await import('@/context/auth-context');
        env.NODE_ENV = 'development';
        setCookie('auth-token=dev-token');
        syncAuthCookie('real-firebase-id-token');
        expect(cookieValue()).toBe('auth-token=dev-token');
        syncAuthCookie(null);
        expect(cookieValue()).toBe('auth-token=dev-token');
    });

    it('development without the dev cookie: the Firebase token is synced as before', async () => {
        const { syncAuthCookie } = await import('@/context/auth-context');
        env.NODE_ENV = 'development';
        setCookie(null);
        syncAuthCookie('real-firebase-id-token');
        expect(cookieValue()).toBe('auth-token=real-firebase-id-token');
    });

    it.each(['production', 'test'])('%s: the dev cookie is overwritten by the real token as before', async (mode) => {
        const { syncAuthCookie } = await import('@/context/auth-context');
        env.NODE_ENV = mode;
        setCookie('auth-token=dev-token');
        syncAuthCookie('real-firebase-id-token');
        // production adds `Secure`, which jsdom (http://localhost) will not store; either way the dev cookie is gone.
        expect(cookieValue()).not.toBe('auth-token=dev-token');
        if (mode === 'test') expect(cookieValue()).toBe('auth-token=real-firebase-id-token');
    });
});
