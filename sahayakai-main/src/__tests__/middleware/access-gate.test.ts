/**
 * @jest-environment node
 *
 * Middleware access gate, end to end through `middleware()`.
 *
 * jose and the Google certificate fetch are mocked so the test controls the
 * verified token payload; everything after verification is the real code.
 * What is pinned here: off / log / enforce behaviour, the fail-closed default
 * for a missing claim, header stripping, the misconfiguration fallback, and
 * that internal developer surfaces are not served in production.
 */
// jest.setup.ts replaces the global Headers/Request/Response with minimal
// stubs that cannot carry headers. The middleware needs the real web classes,
// so restore them from Next's bundled edge primitives BEFORE next/server is
// loaded (NextRequest extends whatever global Request exists at that moment).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const edge = require('next/dist/compiled/@edge-runtime/primitives');
Object.assign(globalThis, { Headers: edge.Headers, Request: edge.Request, Response: edge.Response });
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { NextRequest } = require('next/server') as typeof import('next/server');

let tokenPayload: Record<string, unknown> | null = null;

jest.mock('jose', () => ({
    jwtVerify: jest.fn(async () => {
        if (!tokenPayload) throw new Error('bad token');
        return { payload: tokenPayload };
    }),
    importX509: jest.fn(async () => ({})),
    createRemoteJWKSet: jest.fn(() => ({})),
}));
jest.mock('@/lib/profile-complete-cookie', () => ({
    PROFILE_COMPLETE_COOKIE: 'sahayakai_profile_complete',
    verifyProfileCompleteCookie: jest.fn(async () => null),
}));

const TOKEN = `${Buffer.from(JSON.stringify({ kid: 'k1', alg: 'RS256' })).toString('base64')}.payload.sig`;
const ENV_KEYS = ['ACCESS_GATE_MODE', 'ACCESS_LEGACY_CUTOFF', 'NODE_ENV', 'ALLOW_DEV_SURFACES', 'ONBOARDING_GATE_ENABLED', 'APP_CHECK_REQUIRED'] as const;
const savedEnv: Record<string, string | undefined> = {};

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
    for (const key of ENV_KEYS) {
        if (values[key] === undefined) delete (process.env as Record<string, string | undefined>)[key];
        else (process.env as Record<string, string | undefined>)[key] = values[key];
    }
}

async function run(
    path: string,
    init: { method?: string; auth?: 'bearer' | 'cookie' | 'none'; headers?: Record<string, string> } = {},
) {
    // Fresh module per call: the middleware reads env at request time but
    // caches certs and the "warned once" flag at module scope.
    let mw!: typeof import('@/middleware');
    jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        mw = require('@/middleware');
    });
    const headers = new Headers({ host: 'www.sahayakai.com', ...(init.headers ?? {}) });
    const auth = init.auth ?? 'bearer';
    if (auth === 'bearer') headers.set('Authorization', `Bearer ${TOKEN}`);
    if (auth === 'cookie') headers.set('cookie', `auth-token=${TOKEN}`);
    const req = new NextRequest(`https://www.sahayakai.com${path}`, { method: init.method ?? 'GET', headers });
    return mw.middleware(req);
}

/** Headers the middleware forwards to the route handler. */
function forwarded(res: Response, name: string): string | null {
    return res.headers.get(`x-middleware-request-${name}`);
}

beforeAll(() => {
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
    global.fetch = jest.fn(async () => ({ json: async () => ({ k1: 'cert' }) })) as unknown as typeof fetch;
});
afterAll(() => setEnv(savedEnv as Partial<Record<(typeof ENV_KEYS)[number], string>>));
beforeEach(() => {
    tokenPayload = { sub: 'uid_1', email: 't@example.com' };
    setEnv({ NODE_ENV: 'test' });
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

const CUTOFF = '2026-12-01T00:00:00Z';

describe('mode off (default)', () => {
    it('does not block an account with no access claim', async () => {
        const res = await run('/api/ai/lesson-plan', { method: 'POST' });
        expect(res.status).toBe(200);
        expect(forwarded(res, 'x-user-id')).toBe('uid_1');
        expect(forwarded(res, 'x-user-access')).toBe('none');
    });
});

describe('mode log', () => {
    beforeEach(() => setEnv({ NODE_ENV: 'test', ACCESS_GATE_MODE: 'log', ACCESS_LEGACY_CUTOFF: CUTOFF }));

    it('lets the request through and records what enforce would block', async () => {
        const res = await run('/api/ai/lesson-plan', { method: 'POST' });
        expect(res.status).toBe(200);
        const lines = (console.info as jest.Mock).mock.calls.map((c) => String(c[0]));
        const entry = JSON.parse(lines.find((l) => l.includes('access_gate_would_block')) as string);
        expect(entry).toMatchObject({ uid: 'uid_1', verdict: 'none', action: 'deny-api', path: '/api/ai/lesson-plan' });
    });

    it('logs nothing for an entitled account', async () => {
        tokenPayload = { sub: 'uid_1', access: 'legacy' };
        await run('/api/ai/lesson-plan', { method: 'POST' });
        const lines = (console.info as jest.Mock).mock.calls.map((c) => String(c[0]));
        expect(lines.some((l) => l.includes('access_gate_would_block'))).toBe(false);
    });
});

describe('mode enforce', () => {
    beforeEach(() => setEnv({ NODE_ENV: 'test', ACCESS_GATE_MODE: 'enforce', ACCESS_LEGACY_CUTOFF: CUTOFF }));

    it('passes legacy, active and unexpired pilot accounts', async () => {
        for (const claims of [
            { access: 'legacy' },
            { access: 'active' },
            { access: 'pilot', accessExp: Math.floor(Date.now() / 1000) + 3600 },
        ]) {
            tokenPayload = { sub: 'uid_1', ...claims };
            const res = await run('/api/ai/lesson-plan', { method: 'POST' });
            expect(res.status).toBe(200);
            expect(forwarded(res, 'x-user-access')).toBe(claims.access);
        }
    });

    it.each([
        ['no claim', {}, 'none'],
        ['pending', { access: 'pending' }, 'pending'],
        ['blocked', { access: 'blocked' }, 'blocked'],
        ['expired pilot', { access: 'pilot', accessExp: 1 }, 'expired'],
        ['pilot without expiry', { access: 'pilot' }, 'expired'],
        ['forged-looking value', { access: 'admin' }, 'none'],
    ])('answers 403 ACCESS_REQUIRED on a product API for %s', async (_label, claims, verdict) => {
        tokenPayload = { sub: 'uid_1', ...claims };
        const res = await run('/api/ai/lesson-plan', { method: 'POST' });
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: 'ACCESS_REQUIRED', access: verdict });
    });

    it('keeps the access flow reachable for a pending account', async () => {
        tokenPayload = { sub: 'uid_1', access: 'pending' };
        for (const [path, method] of [
            ['/api/access/sync', 'POST'], ['/api/access/status', 'GET'], ['/api/access/request', 'POST'],
            ['/api/organizations/join', 'POST'], ['/api/account/sync', 'POST'],
        ]) {
            const res = await run(path, { method });
            expect(res.status).toBe(200);
        }
    });

    it('redirects product pages to /access and leaves public pages alone', async () => {
        tokenPayload = { sub: 'uid_1', access: 'pending' };
        const gated = await run('/lesson-plan', { auth: 'cookie' });
        expect(gated.status).toBe(307);
        expect(gated.headers.get('location')).toBe('https://www.sahayakai.com/access');

        const home = await run('/', { auth: 'cookie' });
        expect(home.headers.get('location')).toBe('https://www.sahayakai.com/access');

        for (const path of ['/access', '/request-access', '/join/org1.tok', '/for-schools', '/terms']) {
            const res = await run(path, { auth: 'cookie' });
            expect(res.status).toBe(200);
        }
    });

    it('leaves SamparkAI alone: its pages, its APIs and its own host are outside the gate', async () => {
        tokenPayload = { sub: 'uid_1', access: 'pending' };
        const page = await run('/sampark/workspace', { auth: 'cookie' });
        expect(page.headers.get('location') ?? '').not.toContain('/access');
        expect(page.status).not.toBe(403);

        const api = await run('/api/sampark/schools', { method: 'POST' });
        expect(api.status).toBe(200);

        const onHost = await run('/workspace', { auth: 'cookie', headers: { host: 'sampark.sahayakai.com' } });
        expect(onHost.headers.get('location') ?? '').not.toContain('/access');
        expect(onHost.status).not.toBe(403);

        // The exemption is exact: a look-alike SahayakAI API is still gated.
        const lookalike = await run('/api/ai/sampark', { method: 'POST' });
        expect(lookalike.status).toBe(403);
    });

    it('blocks a mutating request to a page route (server-action shape)', async () => {
        tokenPayload = { sub: 'uid_1', access: 'pending' };
        const res = await run('/access', { method: 'POST', auth: 'cookie' });
        expect(res.status).toBe(403);
    });

    it('does not change behaviour for signed-out visitors', async () => {
        const page = await run('/lesson-plan', { auth: 'none' });
        expect(page.status).toBe(200);
        const api = await run('/api/ai/lesson-plan', { method: 'POST', auth: 'none' });
        expect(api.status).toBe(401);
        const pub = await run('/api/access/mode', { auth: 'none' });
        expect(pub.status).toBe(200);
    });

    it('degrades to log mode when the legacy cutoff does not parse', async () => {
        setEnv({ NODE_ENV: 'test', ACCESS_GATE_MODE: 'enforce', ACCESS_LEGACY_CUTOFF: '2026-12-08 00:00 IST' });
        const res = await run('/api/ai/lesson-plan', { method: 'POST' });
        expect(res.status).toBe(200);
        const errors = (console.error as jest.Mock).mock.calls.map((c) => String(c[0]));
        expect(errors.some((l) => l.includes('access_gate_misconfigured'))).toBe(true);
    });

    it('degrades to log mode when the legacy cutoff is not configured', async () => {
        setEnv({ NODE_ENV: 'test', ACCESS_GATE_MODE: 'enforce' });
        const res = await run('/api/ai/lesson-plan', { method: 'POST' });
        expect(res.status).toBe(200);
        const errors = (console.error as jest.Mock).mock.calls.map((c) => String(c[0]));
        expect(errors.some((l) => l.includes('access_gate_misconfigured'))).toBe(true);
    });
});

describe('trusted headers', () => {
    it('strips client-supplied access and org headers', async () => {
        const res = await run('/for-schools', {
            auth: 'none',
            headers: { 'x-user-access': 'active', 'x-user-org': 'org_victim', 'x-user-org-role': 'admin', 'x-user-id': 'victim' },
        });
        expect(forwarded(res, 'x-user-access')).toBeNull();
        expect(forwarded(res, 'x-user-org')).toBeNull();
        expect(forwarded(res, 'x-user-org-role')).toBeNull();
        expect(forwarded(res, 'x-user-id')).toBeNull();
    });

    it('strips a client-supplied onboarding-completed header', async () => {
        const res = await run('/api/user', { headers: { 'x-onboarding-completed': '1' } });
        expect(forwarded(res, 'x-onboarding-completed')).toBeNull();
        tokenPayload = { sub: 'uid_1', onboardingCompleted: true };
        const verified = await run('/api/user');
        expect(forwarded(verified, 'x-onboarding-completed')).toBe('1');
    });

    it('sets org headers only from verified claims', async () => {
        tokenPayload = { sub: 'uid_1', access: 'active', orgId: 'org_real', orgRole: 'teacher' };
        const res = await run('/api/user', { headers: { 'x-user-org': 'org_victim', 'x-user-org-role': 'admin' } });
        expect(forwarded(res, 'x-user-org')).toBe('org_real');
        expect(forwarded(res, 'x-user-org-role')).toBe('teacher');
    });
});

describe('internal developer surfaces', () => {
    const paths = ['/api-docs', '/api-playground', '/api/api-docs', '/swagger.html', '/api-docs.html', '/api-specs/quiz.yaml', '/sw.js.map'];

    it('are not served in production, signed in or not', async () => {
        setEnv({ NODE_ENV: 'production' });
        tokenPayload = { sub: 'uid_1', access: 'legacy' };
        for (const path of paths) {
            expect((await run(path, { auth: 'none' })).status).toBe(404);
            expect((await run(path, { auth: 'bearer' })).status).toBe(404);
        }
    });

    it('stay available outside production and with the explicit opt-in', async () => {
        setEnv({ NODE_ENV: 'development' });
        expect((await run('/api-playground', { auth: 'none' })).status).toBe(200);
        setEnv({ NODE_ENV: 'production', ALLOW_DEV_SURFACES: 'true' });
        expect((await run('/swagger.html', { auth: 'none' })).status).toBe(200);
    });
});
