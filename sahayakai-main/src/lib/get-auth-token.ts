import { auth } from '@/lib/firebase';

/**
 * Returns the current user's Firebase ID token, or null on failure.
 * Wraps getIdToken() in a try-catch so token refresh errors (network
 * timeouts, revoked credentials) don't cause unhandled rejections.
 *
 * Callers should check for null and surface a "session expired" message.
 */
export async function getAuthToken(): Promise<string | null> {
    try {
        return await auth.currentUser?.getIdToken() ?? null;
    } catch (error) {
        console.error('[Auth] Token refresh failed:', error);
        return null;
    }
}

/**
 * Force-refresh the Firebase ID token to pick up new custom claims
 * (e.g. after plan upgrade). Call this client-side after any plan change,
 * then subsequent API calls will carry the updated `x-user-plan` header.
 *
 * Returns the fresh token, or null on failure.
 */
export async function forceTokenRefresh(): Promise<string | null> {
    try {
        return await auth.currentUser?.getIdToken(/* forceRefresh */ true) ?? null;
    } catch (error) {
        console.error('[Auth] Force token refresh failed:', error);
        return null;
    }
}
