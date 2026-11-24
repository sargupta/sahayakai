/**
 * Access gate: pure, edge-safe primitives.
 *
 * This file is bundled into the Edge middleware, so it MUST NOT import
 * firebase-admin, next/headers, or anything Node-only. Server-side mutation
 * lives in `access-admin.ts`.
 *
 * Model
 * -----
 * Every account carries an access state. The source of truth is the
 * Admin-SDK-only field `users/{uid}.accessState`; the Firebase custom claim
 * `access` is a cache of it so the middleware can decide with zero I/O.
 *
 *   legacy   account existed before the gate was introduced. Entitled.
 *   pending  signed in, not yet approved. Not entitled.
 *   pilot    approved for a time-boxed evaluation. Entitled until `accessExp`.
 *   active   approved (paying school seat or admin-approved). Entitled.
 *   blocked  access withdrawn by an administrator. Not entitled.
 *
 * A token with NO `access` claim is treated as NOT entitled (fail closed).
 * The client recovers through POST /api/access/sync, which re-derives the
 * state from Firestore and re-stamps the claim, so a lost claim self-heals
 * in one round trip instead of locking a teacher out.
 *
 * Rollout is controlled by ACCESS_GATE_MODE: off (default) | log | enforce.
 * Runbook: docs/ACCESS_GATE_RUNBOOK.md
 */

export const ACCESS_STATES = ['legacy', 'pending', 'pilot', 'active', 'blocked'] as const;
export type AccessState = (typeof ACCESS_STATES)[number];

/** States that may use the product. */
export const ENTITLED_STATES: readonly AccessState[] = ['legacy', 'pilot', 'active'];

/** Custom-claim keys. Keep short: all custom claims share a 1000-byte budget. */
export const ACCESS_CLAIM = 'access';
/** Expiry of the current state, epoch SECONDS. Absent = no expiry. */
export const ACCESS_EXP_CLAIM = 'accessExp';

export type AccessGateMode = 'off' | 'log' | 'enforce';

/** Resolve the rollout mode. Anything unrecognised is `off` (fail safe for users). */
export function resolveGateMode(raw: string | undefined = process.env.ACCESS_GATE_MODE): AccessGateMode {
    const v = (raw ?? '').trim().toLowerCase();
    return v === 'log' || v === 'enforce' ? v : 'off';
}

/**
 * Parse ACCESS_LEGACY_CUTOFF. Returns null when unset OR unparseable, so a
 * typo is treated exactly like a missing value everywhere.
 */
export function parseLegacyCutoff(raw: string | undefined = process.env.ACCESS_LEGACY_CUTOFF): Date | null {
    if (!raw || !raw.trim()) return null;
    const d = new Date(raw.trim());
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The mode the gate actually runs in. `enforce` needs a VALID legacy cutoff:
 * without one the sync endpoint cannot tell an existing teacher from a new
 * sign-up and cannot repair a lost claim, so enforcing would strand them
 * (the 2026-06-08 onboarding-gate incident). It degrades to `log` instead.
 * `misconfigured` is true in that case so callers can log it.
 */
export function resolveEffectiveGateMode(
    rawMode: string | undefined = process.env.ACCESS_GATE_MODE,
    rawCutoff: string | undefined = process.env.ACCESS_LEGACY_CUTOFF,
): { mode: AccessGateMode; misconfigured: boolean } {
    const mode = resolveGateMode(rawMode);
    if (mode === 'enforce' && parseLegacyCutoff(rawCutoff) === null) {
        return { mode: 'log', misconfigured: true };
    }
    return { mode, misconfigured: false };
}

export function isAccessState(value: unknown): value is AccessState {
    return typeof value === 'string' && (ACCESS_STATES as readonly string[]).includes(value);
}

/**
 * What the gate concluded about a token.
 *  - `none`    no (or an unrecognised) access claim on the token
 *  - `expired` an entitled state whose `accessExp` has passed
 */
export type AccessVerdict = AccessState | 'none' | 'expired';

export interface AccessDecision {
    entitled: boolean;
    verdict: AccessVerdict;
    /** The raw state on the token, when it was a recognised one. */
    state: AccessState | null;
    /** Expiry in epoch seconds, when present and valid. */
    expiresAtSec: number | null;
}

/**
 * Decide entitlement from verified token claims. Pure; `nowMs` is injectable
 * for tests.
 */
export function evaluateAccess(
    claims: Record<string, unknown> | null | undefined,
    nowMs: number = Date.now(),
): AccessDecision {
    const rawState = claims?.[ACCESS_CLAIM];
    if (!isAccessState(rawState)) {
        return { entitled: false, verdict: 'none', state: null, expiresAtSec: null };
    }
    const rawExp = claims?.[ACCESS_EXP_CLAIM];
    const expiresAtSec = typeof rawExp === 'number' && Number.isFinite(rawExp) && rawExp > 0 ? rawExp : null;

    if (!ENTITLED_STATES.includes(rawState)) {
        return { entitled: false, verdict: rawState, state: rawState, expiresAtSec };
    }
    // A pilot without an expiry is a provisioning bug; fail closed so a
    // missing date can never become an open-ended free licence.
    if (rawState === 'pilot' && expiresAtSec === null) {
        return { entitled: false, verdict: 'expired', state: rawState, expiresAtSec: null };
    }
    if (expiresAtSec !== null && expiresAtSec * 1000 <= nowMs) {
        return { entitled: false, verdict: 'expired', state: rawState, expiresAtSec };
    }
    return { entitled: true, verdict: rawState, state: rawState, expiresAtSec };
}

// ── Path policy ─────────────────────────────────────────────────────────────

function matchesPrefix(pathname: string, prefix: string): boolean {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * API routes a signed-in but NOT entitled account may still call. Everything
 * else under /api/ answers 403 ACCESS_REQUIRED in enforce mode.
 *
 * Keep this list minimal and audited: each entry is reachable by any Google
 * account on the internet.
 */
export const ACCESS_FLOW_API_PREFIXES: readonly string[] = [
    '/api/access',               // status, sync, request (the gate's own flow)
];

/**
 * Exact paths only. `/api/organizations/join` must NOT be a prefix: with
 * `[orgId]` routes alongside it, `/api/organizations/join/join-links` would
 * otherwise read as "organisation `join`" and slip through the gate.
 */
export const ACCESS_FLOW_API_EXACT: readonly string[] = [
    '/api/organizations/join',   // redeem a school join link
    '/api/account/sync',         // mirrors verified email/name into users/{uid}
];

export function isAccessFlowApi(pathname: string): boolean {
    const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    return ACCESS_FLOW_API_EXACT.includes(path) || ACCESS_FLOW_API_PREFIXES.some((p) => matchesPrefix(path, p));
}

/**
 * Pages that stay reachable without entitlement (and, when
 * ANON_APP_PAGES=redirect, without signing in): marketing, legal, the access
 * flow itself, and PWA plumbing. This is an ALLOWLIST: a new product page is
 * gated by default.
 */
export const PUBLIC_PAGE_PREFIXES: readonly string[] = [
    // access flow
    '/access', '/request-access', '/join',
    // marketing + legal
    '/about', '/blog', '/pricing', '/school-pricing', '/for-schools', '/faq',
    '/terms', '/privacy', '/privacy-for-teachers', '/try-call',
    // localised marketing roots
    '/hi', '/bn', '/kn', '/ta', '/te', '/mr', '/gu', '/pa', '/ml', '/or',
    // auth helpers
    '/login', '/signup', '/auth', '/logout',
];

const PUBLIC_PAGE_FILES: readonly string[] = [
    '/sw.js', '/offline.html', '/manifest.json', '/manifest.webmanifest',
    '/robots.txt', '/sitemap.xml', '/firebase-messaging-sw.js',
    '/opengraph-image', '/twitter-image', '/icon', '/apple-icon',
];

export function isPublicPage(pathname: string): boolean {
    if (PUBLIC_PAGE_FILES.some((f) => pathname === f || pathname.startsWith(`${f}.`) || pathname.startsWith(`${f}/`))) {
        return true;
    }
    if (pathname.startsWith('/icons/') || pathname.startsWith('/images/') || pathname.startsWith('/avatars/')) {
        return true;
    }
    if (/^\/(sitemap|workbox|fallback|swe-worker)[^/]*\.(xml|js)$/.test(pathname)) return true;
    return PUBLIC_PAGE_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

/**
 * Developer surfaces that must never be served in production: interactive API
 * docs, the API playground, raw OpenAPI specs, and source maps of the service
 * worker. They disclose the full route map and request shapes.
 */
export function isInternalDevSurface(pathname: string): boolean {
    return (
        matchesPrefix(pathname, '/api-docs') ||
        matchesPrefix(pathname, '/api-playground') ||
        matchesPrefix(pathname, '/api-specs') ||
        matchesPrefix(pathname, '/api/api-docs') ||
        pathname === '/swagger.html' ||
        pathname === '/api-docs.html' ||
        /^\/[^/]+\.map$/.test(pathname)
    );
}

export type GateAction =
    | { kind: 'allow' }
    | { kind: 'deny-api' }
    | { kind: 'redirect'; to: string };

/**
 * The single decision function for a signed-in request. The middleware calls
 * it in both `log` and `enforce` modes; only `enforce` acts on the result.
 */
export function decideGateAction(input: {
    pathname: string;
    method: string;
    decision: AccessDecision;
}): GateAction {
    const { pathname, method, decision } = input;
    if (decision.entitled) return { kind: 'allow' };

    const isApi = pathname.startsWith('/api/');
    if (isApi) {
        return isAccessFlowApi(pathname) ? { kind: 'allow' } : { kind: 'deny-api' };
    }
    const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (!isRead) {
        // Any non-idempotent request to a page route. This app has no server
        // actions a non-entitled account needs; the access flow is API-only.
        return { kind: 'deny-api' };
    }
    if (isPublicPage(pathname)) return { kind: 'allow' };
    return { kind: 'redirect', to: '/access' };
}
