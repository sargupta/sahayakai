/**
 * Server-side Firebase App Check token minting (Q4A — AppCheck restore).
 *
 * Background:
 *   The browser bridge in `@/lib/firebase-app-check` mints App Check tokens
 *   via reCAPTCHA v3, but that only works inside a real browser. All the
 *   sidecar clients in `src/lib/sidecar/*-client.ts` run inside Next.js
 *   API routes (server-side) — `getFirebaseAppCheckToken()` always
 *   returns `null` from there, so the `X-Firebase-AppCheck` header was
 *   being silently omitted and the sidecar had to set
 *   `SAHAYAKAI_REQUIRE_APP_CHECK=false` to keep dispatchers working.
 *
 *   This helper closes that gap using firebase-admin's
 *   `appCheck().createToken(appId)` API, which mints a 1-hour valid
 *   token without a reCAPTCHA challenge. Tokens are cached in-process
 *   and refreshed when they enter a 10-minute expiry buffer, so the
 *   per-request overhead is ~0 on warm pods.
 *
 * Config:
 *   - `NEXT_PUBLIC_FIREBASE_APP_ID` (or `FIREBASE_APP_ID`) — the Web
 *     App ID registered with Firebase App Check. Defaults to the prod
 *     web app id baked into `src/lib/firebase.ts`.
 *   - Requires the firebase-admin service account to have the
 *     `firebaseappcheck.tokens.create` permission (granted by
 *     `roles/firebase.sdkAdminServiceAgent` or `roles/editor`).
 *
 * Failure mode:
 *   On mint failure we re-throw a `AppCheckMintError`. Callers SHOULD
 *   use `getServerAppCheckTokenOrNull()` which catches and returns
 *   null — the sidecar will then reject the request when
 *   `SAHAYAKAI_REQUIRE_APP_CHECK=true`, which is the desired safe
 *   behaviour. We never silently return an empty string because that
 *   would defeat the gate.
 */

import { getApp } from 'firebase-admin/app';
import { getAppCheck } from 'firebase-admin/app-check';

import { initializeFirebase } from '@/lib/firebase-admin';

const DEFAULT_WEB_APP_ID = '1:640589855975:web:624436f873a78069aa3642';
const REFRESH_BUFFER_MS = 10 * 60 * 1000; // 10 minutes

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

let cached: CachedToken | null = null;
let inflight: Promise<{ token: string }> | null = null;

export class AppCheckMintError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AppCheckMintError';
    this.cause = cause;
  }
}

function getAppId(): string {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    process.env.FIREBASE_APP_ID ||
    DEFAULT_WEB_APP_ID
  );
}

/**
 * Mint (or return a cached) Firebase App Check token for the
 * configured Web App. Cache is in-process and refreshed when the
 * token enters a 10-minute expiry buffer.
 */
export async function mintServerAppCheckToken(): Promise<{ token: string }> {
  const now = Date.now();
  if (cached && cached.expiresAtMs - now > REFRESH_BUFFER_MS) {
    return { token: cached.token };
  }

  // Coalesce concurrent mints — under burst load we'd otherwise hit
  // the AppCheck API once per request on cold start.
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      await initializeFirebase();
      const adminApp = getApp();
      const appCheck = getAppCheck(adminApp);
      const appId = getAppId();
      // ttlMillis is optional; default is 1h which is what we want.
      const result = await appCheck.createToken(appId);
      const ttlMs = typeof result.ttlMillis === 'number' ? result.ttlMillis : 60 * 60 * 1000;
      cached = {
        token: result.token,
        expiresAtMs: Date.now() + ttlMs,
      };
      return { token: result.token };
    } catch (err) {
      cached = null;
      throw new AppCheckMintError(
        `Failed to mint server-side App Check token: ${(err as Error)?.message ?? String(err)}`,
        err,
      );
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Safe wrapper for the sidecar clients. Returns the token string on
 * success, `null` on failure (logged once). Callers that omit the
 * `X-Firebase-AppCheck` header will be rejected by the sidecar when
 * `SAHAYAKAI_REQUIRE_APP_CHECK=true` — which is the intended fail-safe
 * behaviour for the restore rollout.
 */
export async function getServerAppCheckTokenOrNull(): Promise<string | null> {
  try {
    const { token } = await mintServerAppCheckToken();
    return token;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[app-check-mint] server mint failed', (err as Error)?.message);
    return null;
  }
}

/** Test-only: clear the in-process cache. */
export function _resetAppCheckMintCacheForTest(): void {
  cached = null;
  inflight = null;
}
