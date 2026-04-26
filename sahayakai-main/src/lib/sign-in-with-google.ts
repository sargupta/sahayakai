"use client";

import {
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    GoogleAuthProvider,
    type User,
    type UserCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * sign-in-with-google — shared helper that picks popup vs redirect by platform.
 *
 * Mobile browsers (Chrome iOS, Safari, in-app webviews) silently break
 * `signInWithPopup`: the OAuth provider opens in a NEW tab and the callback
 * returns to that new tab — the original page where the teacher tapped
 * "Sign in" never sees the result, leaving them stranded on a different
 * pre-opened tab. Symptom reported 2026-04-26.
 *
 * Fix: on mobile we use `signInWithRedirect` (full-page navigation) and
 * handle the result on app load via `consumePendingSignIn()` from
 * `auth-context`. Desktop keeps popup (faster, no full-page reload).
 *
 * In-app webviews (Instagram/FB/LinkedIn browsers) ALWAYS use redirect —
 * popups are blocked.
 */

function isInAppBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent.toLowerCase();
    return /fbav|fban|instagram|line|wechat|micromessenger|linkedin|kakaotalk|naver/.test(
        ua,
    );
}

function isPWAStandalone(): boolean {
    if (typeof window === "undefined") return false;
    return (
        window.matchMedia?.("(display-mode: standalone)").matches ||
        // iOS PWA
        (navigator as any).standalone === true
    );
}

function isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    return /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
        ua,
    );
}

/**
 * True if we should use redirect-based sign-in. Always true for in-app
 * webviews + PWAs + mobile devices.
 */
export function shouldUseRedirect(): boolean {
    return isInAppBrowser() || isPWAStandalone() || isMobileDevice();
}

/**
 * Persist the post-login intent so the redirect handler in auth-context
 * can replay it (e.g. profile-check + onboarding redirect).
 */
const PENDING_KEY = "sahayakai-pending-signin-flow";

export interface PendingSignInFlow {
    /** Where the user was when they hit sign-in (for return-to). */
    returnTo: string;
    /** Should we run the profile-check + maybe-redirect-to-onboarding flow? */
    runProfileCheck: boolean;
    /** Tag for analytics ("auth-button", "auth-dialog", "auth-gate"). */
    source: string;
}

export function setPendingSignIn(flow: PendingSignInFlow): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(flow));
    } catch {
        // sessionStorage blocked (private browsing, restricted webview)
    }
}

export function readPendingSignIn(): PendingSignInFlow | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PendingSignInFlow;
    } catch {
        return null;
    }
}

export function clearPendingSignIn(): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.removeItem(PENDING_KEY);
    } catch {
        // ignore
    }
}

/**
 * Initiate Google sign-in. On mobile/PWA/in-app browsers this NEVER returns
 * a UserCredential — the page navigates away and back. The auth-context
 * handler picks up the result on the next page load.
 *
 * On desktop it returns a UserCredential when the popup completes.
 *
 * @param flow — what to do after sign-in completes (used by both popup +
 *               redirect paths so behaviour is identical regardless of mode).
 */
export async function signInWithGoogle(
    flow: Omit<PendingSignInFlow, "returnTo"> & { returnTo?: string },
): Promise<UserCredential | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const useRedirect = shouldUseRedirect();
    const returnTo =
        flow.returnTo ??
        (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");

    if (useRedirect) {
        // Persist so the redirect handler in auth-context can replay the
        // post-login intent. This MUST happen before the redirect call —
        // signInWithRedirect navigates the page away immediately.
        setPendingSignIn({ ...flow, returnTo });
        await signInWithRedirect(auth, provider);
        return null; // page is navigating away
    }

    // Desktop popup path
    return signInWithPopup(auth, provider);
}

/**
 * Called once on app load by auth-context. If the previous session
 * initiated a redirect-based sign-in, this completes it and returns the
 * pending flow + the freshly-signed-in user.
 *
 * Returns null if no pending sign-in was found.
 */
export async function consumePendingSignIn(): Promise<{
    user: User;
    flow: PendingSignInFlow;
} | null> {
    try {
        const result = await getRedirectResult(auth);
        if (!result) return null;
        const flow = readPendingSignIn();
        clearPendingSignIn();
        return {
            user: result.user,
            flow: flow ?? { returnTo: "/", runProfileCheck: true, source: "unknown" },
        };
    } catch (err) {
        clearPendingSignIn();
        // Surface the error to the caller so they can toast appropriately.
        throw err;
    }
}
