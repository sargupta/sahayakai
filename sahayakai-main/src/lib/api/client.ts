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

export async function apiFetch<T>(
    path: string,
    init: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
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
    const data = await res.json().catch(() => undefined);
    if (!res.ok) {
        const message =
            (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string')
                ? (data as { error: string }).error
                : `Request failed (${res.status})`;
        throw new ApiError(res.status, message, data);
    }
    return data as T;
}
