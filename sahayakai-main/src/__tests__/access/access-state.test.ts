/**
 * Access gate: pure decision logic. These are the rules the middleware
 * applies, so every branch that decides "may this account use the product"
 * is pinned here.
 */
import {
    decideGateAction,
    evaluateAccess,
    isAccessFlowApi,
    isInternalDevSurface,
    isPublicPage,
    parseLegacyCutoff,
    resolveEffectiveGateMode,
    resolveGateMode,
} from '@/lib/access/access-state';

const NOW = Date.UTC(2026, 11, 1);
const future = Math.floor(NOW / 1000) + 3600;
const past = Math.floor(NOW / 1000) - 1;

describe('resolveGateMode', () => {
    it('defaults to off for unset, empty and unknown values', () => {
        expect(resolveGateMode(undefined)).toBe('off');
        expect(resolveGateMode('')).toBe('off');
        expect(resolveGateMode('true')).toBe('off');
        expect(resolveGateMode('enforced')).toBe('off');
    });
    it('accepts log and enforce, case and whitespace insensitive', () => {
        expect(resolveGateMode('log')).toBe('log');
        expect(resolveGateMode(' Enforce ')).toBe('enforce');
    });
});

describe('resolveEffectiveGateMode', () => {
    it('honours enforce only with a cutoff that parses', () => {
        expect(resolveEffectiveGateMode('enforce', '2026-12-08T00:00:00+05:30')).toEqual({ mode: 'enforce', misconfigured: false });
        expect(resolveEffectiveGateMode('enforce', undefined)).toEqual({ mode: 'log', misconfigured: true });
        expect(resolveEffectiveGateMode('enforce', '   ')).toEqual({ mode: 'log', misconfigured: true });
        expect(resolveEffectiveGateMode('enforce', '2026-12-08 00:00 IST')).toEqual({ mode: 'log', misconfigured: true });
        expect(resolveEffectiveGateMode('enforce', 'next monday')).toEqual({ mode: 'log', misconfigured: true });
    });
    it('leaves off and log alone whatever the cutoff', () => {
        expect(resolveEffectiveGateMode('log', undefined)).toEqual({ mode: 'log', misconfigured: false });
        expect(resolveEffectiveGateMode(undefined, 'garbage')).toEqual({ mode: 'off', misconfigured: false });
    });
    it('parses and rejects cutoffs consistently', () => {
        expect(parseLegacyCutoff('2026-12-01T00:00:00Z')?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
        expect(parseLegacyCutoff('')).toBeNull();
        expect(parseLegacyCutoff('not-a-date')).toBeNull();
    });
});

describe('evaluateAccess', () => {
    it('fails closed when the claim is missing or unrecognised', () => {
        for (const claims of [null, undefined, {}, { access: 'admin' }, { access: 1 }, { access: '' }]) {
            const d = evaluateAccess(claims as Record<string, unknown>, NOW);
            expect(d.entitled).toBe(false);
            expect(d.verdict).toBe('none');
        }
    });

    it('entitles legacy and active without an expiry', () => {
        expect(evaluateAccess({ access: 'legacy' }, NOW).entitled).toBe(true);
        expect(evaluateAccess({ access: 'active' }, NOW).entitled).toBe(true);
    });

    it('does not entitle pending or blocked, even with a future expiry', () => {
        expect(evaluateAccess({ access: 'pending', accessExp: future }, NOW)).toMatchObject({ entitled: false, verdict: 'pending' });
        expect(evaluateAccess({ access: 'blocked', accessExp: future }, NOW)).toMatchObject({ entitled: false, verdict: 'blocked' });
    });

    it('entitles a pilot only until its expiry', () => {
        expect(evaluateAccess({ access: 'pilot', accessExp: future }, NOW)).toMatchObject({ entitled: true, verdict: 'pilot' });
        expect(evaluateAccess({ access: 'pilot', accessExp: past }, NOW)).toMatchObject({ entitled: false, verdict: 'expired' });
    });

    it('treats the expiry instant itself as expired', () => {
        expect(evaluateAccess({ access: 'pilot', accessExp: NOW / 1000 }, NOW).entitled).toBe(false);
    });

    it('refuses a pilot with no expiry (never an open-ended free licence)', () => {
        expect(evaluateAccess({ access: 'pilot' }, NOW)).toMatchObject({ entitled: false, verdict: 'expired' });
        expect(evaluateAccess({ access: 'pilot', accessExp: 'soon' }, NOW).entitled).toBe(false);
        expect(evaluateAccess({ access: 'pilot', accessExp: 0 }, NOW).entitled).toBe(false);
    });

    it('honours an expiry on active', () => {
        expect(evaluateAccess({ access: 'active', accessExp: past }, NOW)).toMatchObject({ entitled: false, verdict: 'expired' });
        expect(evaluateAccess({ access: 'active', accessExp: future }, NOW).entitled).toBe(true);
    });

    it('ignores unrelated claims', () => {
        expect(evaluateAccess({ planType: 'premium', orgRole: 'admin' }, NOW).entitled).toBe(false);
    });
});

describe('path policy', () => {
    it('allows only the access flow APIs for non-entitled accounts', () => {
        expect(isAccessFlowApi('/api/access/status')).toBe(true);
        expect(isAccessFlowApi('/api/access/request')).toBe(true);
        expect(isAccessFlowApi('/api/organizations/join')).toBe(true);
        expect(isAccessFlowApi('/api/account/sync')).toBe(true);

        expect(isAccessFlowApi('/api/accessories')).toBe(false);
        expect(isAccessFlowApi('/api/organizations')).toBe(false);
        expect(isAccessFlowApi('/api/organizations/abc/join-links')).toBe(false);
        expect(isAccessFlowApi('/api/organizations/joined')).toBe(false);
        // `join` must be exact: sub-paths would resolve to [orgId] routes.
        expect(isAccessFlowApi('/api/organizations/join/join-links')).toBe(false);
        expect(isAccessFlowApi('/api/organizations/join/analytics')).toBe(false);
        expect(isAccessFlowApi('/api/account/sync/extra')).toBe(false);
        expect(isAccessFlowApi('/api/organizations/join/')).toBe(true);
        expect(isAccessFlowApi('/api/account/profile')).toBe(false);
        expect(isAccessFlowApi('/api/admin/access/requests')).toBe(false);
        expect(isAccessFlowApi('/api/ai/lesson-plan')).toBe(false);
    });

    it('keeps marketing, legal and access-flow pages public', () => {
        for (const p of ['/access', '/request-access', '/join/abc.def', '/for-schools', '/school-pricing',
            '/terms', '/privacy', '/blog/some-post', '/hi', '/bn/for-schools', '/sw.js', '/manifest.json', '/robots.txt']) {
            expect(isPublicPage(p)).toBe(true);
        }
    });

    it('gates product pages, including the dashboard root and unknown routes', () => {
        for (const p of ['/', '/lesson-plan', '/exam-paper', '/community', '/my-library', '/admin/access',
            '/organization/dashboard', '/accessories', '/joiner', '/terms-of-nothing', '/some-future-tool']) {
            expect(isPublicPage(p)).toBe(false);
        }
    });

    it('identifies internal developer surfaces', () => {
        for (const p of ['/api-docs', '/api-playground', '/api-specs/quiz.yaml', '/api/api-docs', '/swagger.html',
            '/api-docs.html', '/sw.js.map', '/workbox-58cdce56.js.map']) {
            expect(isInternalDevSurface(p)).toBe(true);
        }
        for (const p of ['/api/access/mode', '/sw.js', '/api-documentation', '/_next/static/chunks/a.js.map', '/blog/api-docs']) {
            expect(isInternalDevSurface(p)).toBe(false);
        }
    });
});

describe('decideGateAction', () => {
    const entitled = evaluateAccess({ access: 'legacy' }, NOW);
    const pending = evaluateAccess({ access: 'pending' }, NOW);
    const none = evaluateAccess({}, NOW);
    const expired = evaluateAccess({ access: 'pilot', accessExp: past }, NOW);

    it('allows everything for an entitled account', () => {
        for (const [pathname, method] of [['/api/ai/lesson-plan', 'POST'], ['/', 'GET'], ['/lesson-plan', 'GET'], ['/admin/access', 'GET']]) {
            expect(decideGateAction({ pathname, method, decision: entitled })).toEqual({ kind: 'allow' });
        }
    });

    it.each([['pending', pending], ['no claim', none], ['expired pilot', expired]])(
        'denies product APIs for %s',
        (_label, decision) => {
            expect(decideGateAction({ pathname: '/api/ai/lesson-plan', method: 'POST', decision })).toEqual({ kind: 'deny-api' });
            expect(decideGateAction({ pathname: '/api/community/teachers', method: 'GET', decision })).toEqual({ kind: 'deny-api' });
            expect(decideGateAction({ pathname: '/api/admin/access/requests', method: 'GET', decision })).toEqual({ kind: 'deny-api' });
        },
    );

    it('lets a non-entitled account use the access flow', () => {
        expect(decideGateAction({ pathname: '/api/access/sync', method: 'POST', decision: none })).toEqual({ kind: 'allow' });
        expect(decideGateAction({ pathname: '/api/access/request', method: 'POST', decision: pending })).toEqual({ kind: 'allow' });
        expect(decideGateAction({ pathname: '/api/organizations/join', method: 'POST', decision: pending })).toEqual({ kind: 'allow' });
        expect(decideGateAction({ pathname: '/access', method: 'GET', decision: pending })).toEqual({ kind: 'allow' });
        expect(decideGateAction({ pathname: '/for-schools', method: 'GET', decision: pending })).toEqual({ kind: 'allow' });
    });

    it('redirects product page reads to /access', () => {
        for (const pathname of ['/', '/lesson-plan', '/onboarding', '/admin/access']) {
            expect(decideGateAction({ pathname, method: 'GET', decision: pending })).toEqual({ kind: 'redirect', to: '/access' });
        }
    });

    it('denies any mutating request to a page route, public page or not', () => {
        // A POST to a page path is how a server action would be invoked; the
        // public-page allowlist must never become a way to reach one.
        expect(decideGateAction({ pathname: '/lesson-plan', method: 'POST', decision: pending })).toEqual({ kind: 'deny-api' });
        expect(decideGateAction({ pathname: '/access', method: 'POST', decision: pending })).toEqual({ kind: 'deny-api' });
        expect(decideGateAction({ pathname: '/for-schools', method: 'DELETE', decision: none })).toEqual({ kind: 'deny-api' });
    });
});
