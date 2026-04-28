/**
 * Firebase App Check — third layer of sidecar authentication (Phase R.2).
 *
 * App Check is Firebase's client-attestation system. It proves the request
 * came from a real, registered Firebase client (web app via reCAPTCHA v3,
 * Android via Play Integrity, iOS via DeviceCheck / AppAttest) — NOT from
 * a stolen ID token replayed via curl or a scripted attacker.
 *
 * Wire flow on a sidecar request:
 *
 *   browser → Next.js: ID token (Firebase) + App Check token (Firebase)
 *   Next.js → sidecar: Cloud Run ID token (Google) + HMAC + App Check token
 *
 * The sidecar then verifies all three independently. A single attacker
 * who captures a request must replay BOTH the ID token AND the App Check
 * token AND match the HMAC body+timestamp window — App Check tokens
 * rotate per session and are device-bound, closing the residual window.
 *
 * This module intentionally lives on the BROWSER. App Check `getToken()`
 * only returns valid tokens when called inside a real browser with a
 * loaded reCAPTCHA challenge. Calling it on the server is a no-op.
 *
 * Init is idempotent — `initFirebaseAppCheck()` can be called from any
 * client component on first render and will only run once per page load.
 *
 * Production gates:
 *  - `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` must be set
 *  - `firebase` SDK must be initialized first (`@/lib/firebase`)
 *
 * Dev / SSR paths return `null` instead of throwing so a misconfigured
 * local environment (no reCAPTCHA key) does not break the page render.
 *
 * Reference: https://firebase.google.com/docs/app-check/web/recaptcha-provider
 */

import {
    AppCheck,
    getToken as getAppCheckToken,
    initializeAppCheck,
    ReCaptchaV3Provider,
} from 'firebase/app-check';

import { app as firebaseApp } from '@/lib/firebase';

// ─── Module-level state ───────────────────────────────────────────────────

const RECAPTCHA_SITE_KEY_ENV = 'NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY';

let _appCheck: AppCheck | null = null;
let _initAttempted = false;

/** Returns `true` only when running in a real browser. */
function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Initialize Firebase App Check once per page load. Idempotent — safe to
 * call from any client component on mount.
 *
 * Returns the AppCheck instance, or `null` if initialization is impossible
 * in the current environment (SSR, missing site key, dev mode without
 * reCAPTCHA). The caller should treat `null` as "no token available" and
 * skip the App Check header — the sidecar still runs other gates and, in
 * dev / rollout windows, can be configured with
 * `SAHAYAKAI_REQUIRE_APP_CHECK=false` to accept these requests.
 */
export function initFirebaseAppCheck(): AppCheck | null {
    if (_appCheck) return _appCheck;
    if (_initAttempted) return null;
    _initAttempted = true;

    // SSR / Node — nothing to do.
    if (!isBrowser()) return null;

    const siteKey = process.env[RECAPTCHA_SITE_KEY_ENV];
    if (!siteKey) {
        // Not an error — local dev and the very first staging deploy
        // run without a reCAPTCHA key. The sidecar's
        // SAHAYAKAI_REQUIRE_APP_CHECK env handles this.
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.info(
                `[app-check] ${RECAPTCHA_SITE_KEY_ENV} not set; App Check disabled on client.`,
            );
        }
        return null;
    }

    try {
        _appCheck = initializeAppCheck(firebaseApp, {
            provider: new ReCaptchaV3Provider(siteKey),
            // Auto-refresh keeps a valid token in memory so calls to
            // `getToken()` return synchronously when possible. Critical
            // for VIDYA / parent-call latency budgets.
            isTokenAutoRefreshEnabled: true,
        });
        return _appCheck;
    } catch (err) {
        // initializeAppCheck throws if called twice with different settings.
        // In Next.js with React Fast Refresh + StrictMode it is possible
        // to land here on a hot-reload race. Fall back to "no App Check"
        // rather than crashing the whole client tree.
        // eslint-disable-next-line no-console
        console.warn('[app-check] initialize failed', err);
        return null;
    }
}

/**
 * Mint a fresh App Check token for the next sidecar call.
 *
 * Returns `null` (NOT throws) when:
 *  - We are in SSR / Node — no browser to attest
 *  - `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY` is unset (dev / staging early)
 *  - reCAPTCHA challenge fails (network drop, blocked extension)
 *
 * Returning `null` lets the caller decide whether to abort or proceed
 * with the sidecar's `SAHAYAKAI_REQUIRE_APP_CHECK=false` permissive mode.
 *
 * `forceRefresh: false` reuses the cached token when valid, which keeps
 * the per-request mint cost near zero. The Web SDK auto-refreshes the
 * cached token in the background.
 */
export async function getFirebaseAppCheckToken(): Promise<string | null> {
    if (!isBrowser()) return null;
    const instance = initFirebaseAppCheck();
    if (!instance) return null;

    try {
        const result = await getAppCheckToken(instance, /* forceRefresh */ false);
        return result.token;
    } catch (err) {
        // App Check failed (e.g. reCAPTCHA blocked, debug token missing
        // in browser without the Firebase debug provider). Log once;
        // letting the request proceed without the header is the right
        // behaviour during the rollout window (sidecar enforces).
        // eslint-disable-next-line no-console
        console.warn('[app-check] getToken failed', err);
        return null;
    }
}

/**
 * Test-only: clear module state so unit tests can re-initialize. Not
 * exported through any public index; importers must reach in directly.
 */
export function _resetAppCheckForTest(): void {
    _appCheck = null;
    _initAttempted = false;
}
