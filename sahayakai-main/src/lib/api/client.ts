/**
 * Typed client for the app's API-route boundary — tranche 5 of
 * docs/EXECUTION_PLAN_2026-07.md (founder decision: API routes win over
 * server actions; server actions are being migrated out).
 *
 * Auth model: attach the Firebase ID token as a Bearer header; the
 * middleware verifies it and forwards the trusted `x-user-id` header to the
 * route handler. Client code NEVER sets x-user-id itself (middleware strips
 * it — see src/middleware.ts P0 note).
 */
import { hasDevLoginCookie } from '@/lib/dev-login';
import { auth } from '@/lib/firebase';
import { isPublicPage } from '@/lib/access/access-state';

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly body: unknown = undefined,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

const SAMPARK_API_PREFIX = '/api/sampark/';

/**
 * Local development only: is this a same-origin Sampark API call made while the
 * documented development login (`auth-token=dev-token`, see SamparkAuthGate) is set?
 *
 * The middleware prefers an Authorization header over the cookie. If a real Firebase
 * user is also signed in in this browser, attaching their token would make the request
 * run as THAT user rather than `dev-user-123` (the seeded school admin), and the
 * school routes answer 403. For exactly these requests no Bearer is attached and the
 * browser sends the same-origin cookie; the server still runs its normal checks
 * (the middleware accepts dev-token only in development, and the school-admin check
 * is unchanged). Everything else — production, other paths, no dev cookie — keeps the
 * Firebase Bearer. `NODE_ENV` is inlined at build time, so this is dead code in production.
 */
export function devCookieReplacesBearer(path: string): boolean {
    if (process.env.NODE_ENV !== 'development') return false;
    if (typeof document === 'undefined') return false;
    // Same-origin relative paths only: no scheme, no protocol-relative "//host".
    if (!path.startsWith(SAMPARK_API_PREFIX) || path.startsWith('//')) return false;
    return hasDevLoginCookie();
}

/** The auth header for a request to `path`: the Firebase Bearer, except in the dev-cookie case above. */
export async function authHeaderFor(path: string): Promise<Record<string, string>> {
    if (devCookieReplacesBearer(path)) return {};
    const user = auth.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
}

type ApiInit = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal };

async function send(path: string, init: ApiInit): Promise<{ res: Response; data: unknown }> {
    const headers: Record<string, string> = {
        ...(await authHeaderFor(path)),
    };
    let body: string | undefined;
    if (init.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(init.body);
    }
    const res = await fetch(path, {
        method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
        headers,
        body,
        signal: init.signal,
    });
    const data: unknown = await res.json().catch(() => undefined);
    return { res, data };
}

// ── Access-gate self-heal (docs/ACCESS_GATE_DESIGN.md) ──────────────────────
//
// The middleware answers 403 { code: 'ACCESS_REQUIRED' } when the ID token
// carries no entitled `access` claim. That can be a genuinely unapproved
// account, or just a stale/lost claim (approved a minute ago, or a legacy
// account not yet stamped). POST /api/access/sync re-derives the state from
// Firestore and repairs the claim, so we try that ONCE, refresh the token and
// retry the original request ONCE. Still refused → send the user to /access.

export const ACCESS_REQUIRED_CODE = 'ACCESS_REQUIRED';
const ACCESS_SYNC_PATH = '/api/access/sync';
/** Pages that belong to the access flow; never redirect away from them. */
export const ACCESS_FLOW_PAGES: readonly string[] = ['/access', '/request-access', '/join'];

export interface AccessSyncResult {
    state: string;
    entitled: boolean;
    expiresAt: string | null;
    claimChanged: boolean;
}

export function isAccessRequiredBody(data: unknown): boolean {
    return (
        typeof data === 'object' &&
        data !== null &&
        (data as { code?: unknown }).code === ACCESS_REQUIRED_CODE
    );
}

export function isAccessFlowPage(pathname: string): boolean {
    return ACCESS_FLOW_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function parseSyncResult(data: unknown): AccessSyncResult | null {
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d.state !== 'string' || typeof d.entitled !== 'boolean') return null;
    return {
        state: d.state,
        entitled: d.entitled,
        expiresAt: typeof d.expiresAt === 'string' ? d.expiresAt : null,
        claimChanged: d.claimChanged === true,
    };
}

let syncInFlight: Promise<AccessSyncResult | null> | null = null;

/**
 * Ask the server to bring the `access` claim in line with the source of
 * truth, then refresh the local ID token when the claim changed or the
 * account is entitled (the local token may predate an approval).
 *
 * Concurrent callers share one in-flight request. Never throws: returns null
 * when signed out or when the call fails.
 */
export function syncAccess(): Promise<AccessSyncResult | null> {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
        try {
            if (!auth.currentUser) return null;
            const { res, data } = await send(ACCESS_SYNC_PATH, { method: 'POST' });
            if (!res.ok) return null;
            const result = parseSyncResult(data);
            if (result && (result.claimChanged || result.entitled)) {
                try {
                    await auth.currentUser?.getIdToken(true);
                } catch {
                    // Token refresh failed (offline). The caller's retry will
                    // simply be refused again; nothing to unwind.
                }
            }
            return result;
        } catch {
            return null;
        } finally {
            syncInFlight = null;
        }
    })();
    return syncInFlight;
}

/** Indirection so tests can observe the redirect (jsdom cannot navigate). */
export const accessNavigation = {
    currentPath: (): string => window.location.pathname,
    go: (url: string): void => { window.location.assign(url); },
};

function redirectToAccess(): void {
    if (typeof window === 'undefined') return;
    const current = accessNavigation.currentPath();
    if (isAccessFlowPage(current)) return;
    // Public pages (marketing, legal, pricing) stay readable for a signed-in
    // account that is not entitled: the middleware serves them, and a
    // background call such as the language-preference fetch must not pull the
    // reader off the terms they are being asked to accept.
    if (isPublicPage(current)) return;
    accessNavigation.go('/access');
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
    let { res, data } = await send(path, init);

    if (res.status === 403 && isAccessRequiredBody(data) && !path.startsWith(ACCESS_SYNC_PATH)) {
        const synced = await syncAccess();
        if (synced?.entitled) {
            // One retry only. A second refusal falls through to the redirect.
            ({ res, data } = await send(path, init));
        }
        if (res.status === 403 && isAccessRequiredBody(data)) {
            redirectToAccess();
        }
    }

    if (!res.ok) {
        const message =
            (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string')
                ? (data as { error: string }).error
                : `Request failed (${res.status})`;
        throw new ApiError(res.status, message, data);
    }
    return data as T;
}
