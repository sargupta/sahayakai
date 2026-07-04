/**
 * Typed client wrappers for the account API routes (tranche 5 migration of
 * src/app/actions/auth.ts). Signatures and `{ success, error? }` result
 * contracts are IDENTICAL to the old server actions — these never throw.
 *
 * Routes live under /api/account/** (NOT /api/auth/** — that prefix is in
 * the middleware public list for the pre-login profile-check).
 */
import { apiFetch, ApiError } from '@/lib/api/client';

export async function syncUserAction(user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
}): Promise<{ success: boolean; error?: string }> {
    if (!user || !user.uid) {
        return { success: false, error: 'Invalid user data' };
    }
    try {
        return await apiFetch<{ success: boolean; error?: string }>(`/api/account/sync`, {
            method: 'POST',
            body: user,
        });
    } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
            return { success: false, error: 'Unauthorized' };
        }
        return { success: false, error: 'Failed to sync user profile' };
    }
}

export async function getUserProfileAction(
    _uid?: string,
): Promise<{ success: boolean; profile?: any; error?: string }> {
    try {
        const query = _uid ? `?uid=${encodeURIComponent(_uid)}` : '';
        return await apiFetch<{ success: boolean; profile?: any; error?: string }>(
            `/api/account/profile${query}`,
        );
    } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
            return { success: false, error: 'Unauthorized' };
        }
        return { success: false, error: 'Failed to fetch user profile' };
    }
}
