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
