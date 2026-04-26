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

/**
 * Round-2 audit P0 ROTATION-1 fix (30-agent review, groups B3 + D4):
 * the signing-key cache had no TTL. After
 * `scripts/generate-signing-key.sh` rotates the secret, Cloud Run
 * instances kept using the OLD key for HOURS until cold-restart —
 * meanwhile sidecar verifies with the NEW key (which it re-reads on
 * fresh requests via firebase-admin), so 100% of HMAC checks fail
 * and the dispatcher's behavioural-error path drops every parent
 * call to canned safe wrap-up.
 *
 * 5-minute TTL keeps the original cache benefit (avoid Secret Manager
 * call on every TwiML hop) while bounding the post-rotation mismatch
 * window. Operator workflow: rotate secret, redeploy sidecar, then
 * within ≤5 min the Next.js cache also picks up the new value.
 */
const SIGNING_KEY_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  value: string;
  loadedAt: number;
}
let cachedSigningKey: CacheEntry | null = null;

async function getSigningKey(): Promise<string> {
  const now = Date.now();
  if (cachedSigningKey && now - cachedSigningKey.loadedAt < SIGNING_KEY_TTL_MS) {
    return cachedSigningKey.value;
  }
  const secret = await getSecret(SIGNING_KEY_SECRET_NAME);
  // Defensive: trim trailing whitespace/newlines that may have leaked
  // in from a `gcloud secrets versions add --data-file` if the input
  // file had a trailing newline. Without trim, the digest computed
  // here diverges from the digest the sidecar computes on its own
  // (newline-stripped) read — silent HMAC mismatch.
  const trimmed = (secret || '').trim();
  if (!trimmed || trimmed.length < 32) {
    throw new Error(
      `[sidecar.signing] ${SIGNING_KEY_SECRET_NAME} must be at least 32 chars; ` +
        `got length ${trimmed.length}`,
    );
  }
  cachedSigningKey = { value: trimmed, loadedAt: now };
  return trimmed;
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
