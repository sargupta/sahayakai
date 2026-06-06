/**
 * HMAC-signed cookie helper for the profile-complete flag used by the
 * onboarding-redirect guard in `src/middleware.ts`.
 *
 * Cookie format: `<userId>.<base64url(hmacSha256(secret, userId))>`
 *
 * Why HMAC instead of a Firebase custom claim?
 *  - Custom claims require the client to force-refresh its ID token (or
 *    re-sign-in) to pick up the new value — friction the moment the user
 *    finishes onboarding.
 *  - A signed cookie is set immediately, validated cheaply in middleware
 *    (no extra Firestore read per request), and tamper-resistant.
 *
 * Edge-runtime compatible: uses Web Crypto's SubtleCrypto for HMAC.
 */

export const PROFILE_COMPLETE_COOKIE = 'sahayakai_profile_complete';
export const PROFILE_COMPLETE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// We resolve the secret at call time so a missing env var only breaks
// the feature (not the build). When unset we fall back to a per-process
// random — middleware running in the SAME process will validate it
// consistently; users will need to re-onboard after a deploy. Acceptable
// for a soft-launch.
let _runtimeFallback: string | null = null;
function getSecret(): string {
    const secret = process.env.PROFILE_COMPLETE_COOKIE_SECRET;
    if (secret && secret.length >= 16) return secret;
    if (!_runtimeFallback) {
        _runtimeFallback = `runtime-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    }
    return _runtimeFallback;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
    // Prefer SubtleCrypto (edge runtime). Fall back to Node `crypto` when
    // SubtleCrypto isn't available (jsdom test env, older Node).
    const subtle = (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) as
        | SubtleCrypto
        | undefined;
    if (subtle) {
        const enc = new TextEncoder();
        const key = await subtle.importKey(
            'raw',
            enc.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );
        const sig = await subtle.sign('HMAC', key, enc.encode(message));
        const bytes = new Uint8Array(sig);
        let s = '';
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return hmacSha256Sync(secret, message);
}

// Synchronous version using Node crypto for the API route (avoids making
// the POST handler more complex than it needs to be).
function hmacSha256Sync(secret: string, message: string): string {
    // Lazily required so this file stays edge-importable.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createHmac } = require('crypto') as typeof import('crypto');
    return createHmac('sha256', secret)
        .update(message)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

export function signProfileCompleteCookie(userId: string): string {
    const sig = hmacSha256Sync(getSecret(), userId);
    return `${userId}.${sig}`;
}

/**
 * Async verifier — safe to call from edge middleware. Returns the userId
 * embedded in the cookie on success, null otherwise.
 */
export async function verifyProfileCompleteCookie(
    cookieValue: string | undefined,
): Promise<string | null> {
    if (!cookieValue) return null;
    const idx = cookieValue.lastIndexOf('.');
    if (idx <= 0 || idx === cookieValue.length - 1) return null;
    const userId = cookieValue.slice(0, idx);
    const sig = cookieValue.slice(idx + 1);
    if (!userId || !sig) return null;
    try {
        const expected = await hmacSha256(getSecret(), userId);
        // constant-time compare
        if (expected.length !== sig.length) return null;
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
            diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
        }
        return diff === 0 ? userId : null;
    } catch {
        return null;
    }
}
