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

async function authHeader(): Promise<Record<string, string>> {
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
        ...(await authHeader()),
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
