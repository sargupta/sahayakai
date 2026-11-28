/**
 * apiFetch access-gate self-heal (src/lib/api/client.ts).
 *
 * Contract: on 403 { code: 'ACCESS_REQUIRED' } → POST /api/access/sync once →
 * refresh the token → retry the original request ONCE → if still refused,
 * navigate to /access (unless already on an access-flow page). Never loops.
 */

const getIdToken = jest.fn(async (_force?: boolean) => 'tok');

jest.mock('@/lib/firebase', () => ({
    auth: { currentUser: { getIdToken: (force?: boolean) => getIdToken(force) } },
}));

import { apiFetch, ApiError, accessNavigation, syncAccess, isAccessFlowPage, isAccessRequiredBody } from '@/lib/api/client';

type Reply = { status: number; body: unknown };

function mockFetch(handler: (url: string, init: RequestInit) => Reply) {
    const calls: Array<{ url: string; method: string }> = [];
    const fn = jest.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, method: init.method ?? 'GET' });
        const { status, body } = handler(url, init);
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => body,
        } as unknown as Response;
    });
    (global as unknown as { fetch: unknown }).fetch = fn;
    return calls;
}

const REFUSED: Reply = { status: 403, body: { error: 'Access required', code: 'ACCESS_REQUIRED', access: 'none' } };
const SYNC = '/api/access/sync';

let goSpy: jest.SpyInstance;
let pathSpy: jest.SpyInstance;

beforeEach(() => {
    getIdToken.mockClear();
    goSpy = jest.spyOn(accessNavigation, 'go').mockImplementation(() => undefined);
    pathSpy = jest.spyOn(accessNavigation, 'currentPath').mockReturnValue('/lesson-plan');
});

afterEach(() => {
    goSpy.mockRestore();
    pathSpy.mockRestore();
});

describe('apiFetch access self-heal', () => {
    it('syncs, refreshes the token and retries once when the sync says entitled', async () => {
        let first = true;
        const calls = mockFetch((url) => {
            if (url === SYNC) return { status: 200, body: { state: 'legacy', entitled: true, expiresAt: null, claimChanged: true } };
            if (first) { first = false; return REFUSED; }
            return { status: 200, body: { ok: true } };
        });

        await expect(apiFetch<{ ok: boolean }>('/api/content/list')).resolves.toEqual({ ok: true });

        expect(calls.map((c) => c.url)).toEqual(['/api/content/list', SYNC, '/api/content/list']);
        expect(getIdToken).toHaveBeenCalledWith(true);
        expect(goSpy).not.toHaveBeenCalled();
    });

    it('does not retry and redirects to /access when the account is not entitled', async () => {
        const calls = mockFetch((url) =>
            url === SYNC
                ? { status: 200, body: { state: 'pending', entitled: false, expiresAt: null, claimChanged: false } }
                : REFUSED,
        );

        await expect(apiFetch('/api/content/list')).rejects.toMatchObject({ status: 403 });

        expect(calls.map((c) => c.url)).toEqual(['/api/content/list', SYNC]);
        expect(getIdToken).not.toHaveBeenCalledWith(true);
        expect(goSpy).toHaveBeenCalledTimes(1);
        expect(goSpy).toHaveBeenCalledWith('/access');
    });

    it('never loops: a second refusal after the retry ends in one redirect', async () => {
        const calls = mockFetch((url) =>
            url === SYNC
                ? { status: 200, body: { state: 'legacy', entitled: true, expiresAt: null, claimChanged: false } }
                : REFUSED,
        );

        await expect(apiFetch('/api/content/list')).rejects.toBeInstanceOf(ApiError);

        expect(calls.map((c) => c.url)).toEqual(['/api/content/list', SYNC, '/api/content/list']);
        expect(goSpy).toHaveBeenCalledTimes(1);
    });

    it('does not redirect when already on an access-flow page', async () => {
        pathSpy.mockReturnValue('/request-access');
        mockFetch((url) =>
            url === SYNC
                ? { status: 200, body: { state: 'pending', entitled: false, expiresAt: null, claimChanged: false } }
                : REFUSED,
        );

        await expect(apiFetch('/api/content/list')).rejects.toMatchObject({ status: 403 });
        expect(goSpy).not.toHaveBeenCalled();
    });

    it('leaves a 403 without the ACCESS_REQUIRED code untouched', async () => {
        const calls = mockFetch(() => ({ status: 403, body: { error: 'Forbidden' } }));

        await expect(apiFetch('/api/organizations')).rejects.toMatchObject({ status: 403, message: 'Forbidden' });

        expect(calls).toHaveLength(1);
        expect(goSpy).not.toHaveBeenCalled();
    });

    it('does not recurse when the sync endpoint itself is refused', async () => {
        const calls = mockFetch(() => REFUSED);

        await expect(apiFetch(SYNC, { method: 'POST' })).rejects.toMatchObject({ status: 403 });

        expect(calls).toHaveLength(1);
    });

    it('survives a failing sync call without throwing a different error', async () => {
        const calls = mockFetch((url) => (url === SYNC ? { status: 500, body: { error: 'boom' } } : REFUSED));

        await expect(apiFetch('/api/content/list')).rejects.toMatchObject({ status: 403 });

        expect(calls.map((c) => c.url)).toEqual(['/api/content/list', SYNC]);
        expect(goSpy).toHaveBeenCalledWith('/access');
    });

    it('shares one in-flight sync between concurrent refused requests', async () => {
        const firstSeen = new Set<string>();
        const calls = mockFetch((url) => {
            if (url === SYNC) return { status: 200, body: { state: 'active', entitled: true, expiresAt: null, claimChanged: true } };
            if (!firstSeen.has(url)) { firstSeen.add(url); return REFUSED; }
            return { status: 200, body: { url } };
        });

        const [a, b] = await Promise.all([apiFetch('/api/a'), apiFetch('/api/b')]);

        expect(a).toEqual({ url: '/api/a' });
        expect(b).toEqual({ url: '/api/b' });
        expect(calls.filter((c) => c.url === SYNC)).toHaveLength(1);
    });

    it('passes successful responses through with no extra calls', async () => {
        const calls = mockFetch(() => ({ status: 200, body: { v: 1 } }));
        await expect(apiFetch('/api/x')).resolves.toEqual({ v: 1 });
        expect(calls).toHaveLength(1);
    });
});

describe('syncAccess', () => {
    it('refreshes the token when entitled even if the claim did not change', async () => {
        mockFetch(() => ({ status: 200, body: { state: 'active', entitled: true, expiresAt: null, claimChanged: false } }));
        await expect(syncAccess()).resolves.toMatchObject({ entitled: true, claimChanged: false });
        expect(getIdToken).toHaveBeenCalledWith(true);
    });

    it('returns null instead of throwing when the request fails', async () => {
        (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => { throw new Error('offline'); });
        await expect(syncAccess()).resolves.toBeNull();
    });

    it('returns null for a malformed body', async () => {
        mockFetch(() => ({ status: 200, body: { nope: true } }));
        await expect(syncAccess()).resolves.toBeNull();
    });
});

describe('helpers', () => {
    it('recognises access-flow pages by prefix, not substring', () => {
        expect(isAccessFlowPage('/access')).toBe(true);
        expect(isAccessFlowPage('/join/abc123')).toBe(true);
        expect(isAccessFlowPage('/request-access')).toBe(true);
        expect(isAccessFlowPage('/accessories')).toBe(false);
        expect(isAccessFlowPage('/lesson-plan')).toBe(false);
    });

    it('detects the ACCESS_REQUIRED body shape only', () => {
        expect(isAccessRequiredBody({ code: 'ACCESS_REQUIRED' })).toBe(true);
        expect(isAccessRequiredBody({ code: 'OTHER' })).toBe(false);
        expect(isAccessRequiredBody(undefined)).toBe(false);
        expect(isAccessRequiredBody('ACCESS_REQUIRED')).toBe(false);
    });
});

describe('redirect scope', () => {
    const refuseEverything = () =>
        mockFetch((url) =>
            url === SYNC
                ? { status: 200, body: { state: 'pending', entitled: false, expiresAt: null, claimChanged: false } }
                : REFUSED,
        );

    it.each(['/terms', '/pricing', '/school-pricing', '/for-schools', '/blog/some-post', '/hi'])(
        'does not pull a pending reader off the public page %s',
        async (path) => {
            pathSpy.mockReturnValue(path);
            refuseEverything();
            await expect(apiFetch('/api/profile')).rejects.toBeInstanceOf(ApiError);
            expect(goSpy).not.toHaveBeenCalled();
        },
    );

    it.each(['/', '/lesson-plan', '/community', '/onboarding'])('still redirects from the product page %s', async (path) => {
        pathSpy.mockReturnValue(path);
        refuseEverything();
        await expect(apiFetch('/api/profile')).rejects.toBeInstanceOf(ApiError);
        expect(goSpy).toHaveBeenCalledWith('/access');
    });
});
