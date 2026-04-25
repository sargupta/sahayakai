/**
 * HMAC-SHA256 body integrity for sahayakai-agents sidecar requests.
 *
 * Why a body digest on top of the Cloud Run ID token:
 *
 * - The ID token authenticates the *caller* (Next.js runtime SA) but
 *   does not bind to the request body. A token captured in transit
 *   could be replayed against a different body.
 * - The shared HMAC secret (`SAHAYAKAI_REQUEST_SIGNING_KEY`) lives only
 *   in Secret Manager and is mounted into both the Next.js runtime and
 *   the Python sidecar. It is rotated independently of the ID-token
 *   issuer.
 * - The sidecar middleware verifies the digest header before dispatch;
 *   any mismatch returns 400 before the body is parsed.
 *
 * Wire shape:
 *   X-Content-Digest: sha256=<base64(hmac(secret, rawBody))>
 *
 * The header name `X-Content-Digest` is intentionally distinct from
 * `Content-Digest` (RFC 9530) — we are NOT computing a plain content
 * hash; we are computing a keyed MAC. The `sha256=` prefix matches the
 * scheme the sidecar parses.
 */

import crypto from 'node:crypto';

import { getSecret } from '@/lib/secrets';

const SIGNING_KEY_SECRET_NAME = 'SAHAYAKAI_REQUEST_SIGNING_KEY';

/** In-process cache for the signing key. The secret value rarely changes
 *  and Secret Manager fetches add latency to every TwiML hop. Cache for
 *  the lifetime of the Cloud Run instance; rotation reboots the
 *  instance via gcloud anyway.
 */
let cachedSigningKey: string | null = null;

async function getSigningKey(): Promise<string> {
  if (cachedSigningKey) return cachedSigningKey;
  const secret = await getSecret(SIGNING_KEY_SECRET_NAME);
  if (!secret || secret.length < 32) {
    throw new Error(
      `[sidecar.signing] ${SIGNING_KEY_SECRET_NAME} must be at least 32 chars; ` +
        `got length ${secret?.length ?? 0}`,
    );
  }
  cachedSigningKey = secret;
  return secret;
}

/**
 * Compute the `X-Content-Digest` header value for a request body.
 *
 * The body is hashed verbatim — callers must pass the exact bytes that
 * will be sent on the wire (no JSON re-stringification after digest
 * computation). Mismatch between digest input and wire bytes is the
 * single most common cause of 400 Bad Digest in Cloud Run middlewares.
 */
export async function computeBodyDigest(rawBody: string): Promise<string> {
  const key = await getSigningKey();
  const mac = crypto.createHmac('sha256', key).update(rawBody, 'utf8').digest('base64');
  return `sha256=${mac}`;
}

/**
 * Test-only: clear the cached signing key. Lets unit tests rotate the
 * key without restarting the process. Not exported through index.
 */
export function _resetSigningKeyCacheForTest(): void {
  cachedSigningKey = null;
}
