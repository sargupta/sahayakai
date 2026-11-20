/**
 * The documented LOCAL DEVELOPMENT login for the Sampark console (docs/sampark/RIYA_LOCAL_SETUP.md §6).
 *
 * A developer sets the cookie `auth-token=dev-token` by hand; in development only the
 * middleware maps it to `dev-user-123` (the seeded school admin). SamparkAuthGate records
 * the choice for the tab in sessionStorage. Nothing here grants anything: the server decides,
 * and it refuses `dev-token` outside development. `NODE_ENV` is inlined at build time, so
 * every check below is dead code in a production bundle.
 */

export const DEV_LOGIN_COOKIE = 'auth-token=dev-token';
export const DEV_LOGIN_FLAG = 'sampark:dev-bypass';

/** The exact development cookie is set in this browser (development builds only). */
export function hasDevLoginCookie(): boolean {
    if (process.env.NODE_ENV !== 'development' || typeof document === 'undefined') return false;
    return document.cookie.split(';').some((c) => c.trim() === DEV_LOGIN_COOKIE);
}

/**
 * Used by auth-context so that, while the exact dev cookie is set, a signed-in Firebase
 * user's token sync (which runs on every page load and refresh) does not overwrite it
 * mid-page and turn the console's requests into that other user's. That user is not the
 * seeded school admin, so the school routes answered 403 until SamparkAuthGate put the
 * cookie back. The cookie only gets this value by the developer setting it by hand.
 */
export function devLoginActive(): boolean {
    return hasDevLoginCookie();
}
