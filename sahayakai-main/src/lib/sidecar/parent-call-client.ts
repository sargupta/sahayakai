/**
 * HTTP client for the sahayakai-agents Python sidecar.
 *
 * Used by the parent-call dispatcher when `parentCallSidecarMode` is
 * `shadow`, `canary`, or `full`. Does three things the raw `fetch`
 * does not:
 *
 * 1. **Mints a Google ID token** scoped to the sidecar Cloud Run URL
 *    (`SAHAYAKAI_AGENTS_AUDIENCE`) so the sidecar's IAM-invoker check
 *    passes. Uses `google-auth-library`'s `getIdTokenClient(audience)`,
 *    the canonical pattern for service-to-service Cloud Run calls.
 *
 * 2. **HMAC-signs the body** with `SAHAYAKAI_REQUEST_SIGNING_KEY`
 *    (Secret Manager) so the sidecar can detect tampering before
 *    dispatch. See `signing.ts` for the wire shape.
 *
 * 3. **Bounds the request to 3.5 s** via `AbortController`. The sidecar
 *    has its own 8 s `timeoutSeconds` on Cloud Run and Twilio gives
 *    us 15 s end-to-end including STT and TTS. 3.5 s leaves ~5 s of
 *    margin for TTS speak budget and the sidecar's resilient backoff;
 *    timing out client-side prevents a slow sidecar from blowing the
 *    whole TwiML window.
 *
 * Errors are surfaced as typed shapes so the caller can decide whether
 * to fall back to Genkit (`SidecarTimeoutError`, `SidecarHttpError`),
 * fail the call (`SidecarConfigError`), or surface as canned wrap-up
 * (`SidecarBehaviouralError` → 502 from the sidecar's fail-closed guard).
 *
 * Round-2 audit reference: P0 BEHAV-1 (sidecar fail-closed must
 * propagate to Twilio fallback path), TRANSPORT-1 (3.5 s ceiling).
 */

import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { getFirebaseAppCheckToken } from '@/lib/firebase-app-check';

import { newRequestId, signRequest } from './signing';

// ─── Errors ────────────────────────────────────────────────────────────────

export class SidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SidecarConfigError';
  }
}

export class SidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'SidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class SidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'SidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

/**
 * The sidecar's behavioural guard tripped (502 with axis info). Genkit
 * fallback should NOT be tried — the model output is suspect and the
 * canned safe-wrap-up is the right next step.
 */
export class SidecarBehaviouralError extends Error {
  readonly axis: string;
  constructor(axis: string, details: string) {
    super(`Sidecar behavioural guard failed (${axis}): ${details}`);
    this.name = 'SidecarBehaviouralError';
    this.axis = axis;
  }
}

// ─── Wire schemas ──────────────────────────────────────────────────────────

// Phase N.2 — Forensic audit P1 #22. Wire types now imported from
// `types.generated.ts` (regenerated from the Pydantic source of truth
// via `sahayakai-agents/scripts/codegen_ts.py`). Public surface
// preserved: dispatchers / tests still import `Sidecar{ReplyRequest,
// ReplyResponse}`.
import type {
  AgentReplyRequest as GenAgentReplyRequest,
  AgentReplyResponse as GenAgentReplyResponse,
} from './types.generated';

export type SidecarReplyRequest = GenAgentReplyRequest;
export type SidecarReplyResponse = GenAgentReplyResponse;

// ─── ID-token client cache ────────────────────────────────────────────────

const TIMEOUT_MS = 3_500;
const AUDIENCE_ENV = 'SAHAYAKAI_AGENTS_AUDIENCE';
const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';

/**
 * `IdTokenClient` lazily refreshes the ID token internally; caching the
 * client across requests amortises the JWT-mint cost. One client per
 * audience for the lifetime of the Cloud Run instance.
 *
 * Round-2 audit P0 CACHE-1 fix (30-agent review, groups B2 + C5):
 * a rejected promise stays cached forever. If the FIRST
 * `getIdTokenClient(audience)` rejects (transient metadata-server
 * 500 during cold start), every subsequent caller awaits the SAME
 * rejection until process restart. Adding `.catch()`-on-eviction so
 * a transient failure doesn't poison the entire instance.
 */
const tokenClientByAudience = new Map<string, Promise<IdTokenClient>>();

async function getTokenClient(audience: string): Promise<IdTokenClient> {
  let cached = tokenClientByAudience.get(audience);
  if (!cached) {
    const auth = new GoogleAuth();
    const p = auth.getIdTokenClient(audience);
    // Evict on rejection so the next caller can retry. Without this,
    // a one-off cold-start 500 from the metadata server would lock
    // the instance into "every dispatch fails for the next hour".
    p.catch(() => tokenClientByAudience.delete(audience));
    tokenClientByAudience.set(audience, p);
    cached = p;
  }
  return cached;
}

/**
 * Test-only: clear the IdToken cache. Lets unit tests simulate cold
 * start without restarting the process.
 */
export function _resetTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface CallSidecarReplyOptions {
  /** Override the timeout for tests / local dev. */
  timeoutMs?: number;
  /** Optional fetch impl for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /**
   * Forensic fix P1 #18 — caller-supplied request id for telemetry
   * correlation across the dispatcher and the Python sidecar. Defaults
   * to a freshly minted hex id; pass through if you already have one
   * (e.g. from Next.js middleware) so the whole chain shares a key.
   */
  requestId?: string;
  /**
   * Phase R.2: Firebase App Check token forwarded from the browser.
   * Set as `X-Firebase-AppCheck` header. When undefined / null the
   * header is omitted; the sidecar's `SAHAYAKAI_REQUIRE_APP_CHECK`
   * flag decides whether that's a 401 or accepted (rollout mode).
   */
  appCheckToken?: string | null;
}

/**
 * Call the sidecar's `/v1/parent-call/reply` endpoint.
 *
 * Returns a typed response on 200, throws a typed error on every other
 * outcome. The dispatcher in `route.ts` chooses the fallback strategy.
 */
export async function callSidecarReply(
  request: SidecarReplyRequest,
  options: CallSidecarReplyOptions = {},
): Promise<SidecarReplyResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) {
    throw new SidecarConfigError(`${BASE_URL_ENV} is not set`);
  }
  if (!audience) {
    throw new SidecarConfigError(`${AUDIENCE_ENV} is not set`);
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/parent-call/reply`;
  const rawBody = JSON.stringify(request);
  // Wave 4 fix 4 / P1 REPLAY-1: signRequest binds digest to a
  // per-request timestamp. The matching `X-Request-Timestamp` header
  // MUST be sent alongside the digest or the sidecar rejects.
  // Phase R.2: App Check token is the third auth layer; getting it
  // BEFORE signing keeps the wire ordering legible (auth → integrity
  // → attestation) even though the order does not affect verification.
  const { timestamp, digest } = await signRequest(rawBody);

  const tokenClient = await getTokenClient(audience);
  const authHeaders = await tokenClient.getRequestHeaders();

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId ?? newRequestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  // Compose the header bag. App Check is auto-fetched when the caller
  // does not pass an explicit value — `getFirebaseAppCheckToken()`
  // returns `null` server-side (no browser, no reCAPTCHA challenge),
  // so pure-server callers (cron jobs, Twilio callbacks) silently
  // omit the header. The sidecar's `SAHAYAKAI_REQUIRE_APP_CHECK` flag
  // governs whether a missing header is a 401 or accepted.
  // `appCheckToken: null` opts out explicitly (e.g. tests).
  const appCheckToken =
    options.appCheckToken === undefined
      ? await getFirebaseAppCheckToken()
      : options.appCheckToken;
  const headers: Record<string, string> = {
    ...authHeaders,
    'Content-Type': 'application/json',
    'X-Content-Digest': digest,
    'X-Request-Timestamp': timestamp,
    'X-Request-ID': requestId,
  };
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: rawBody,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SidecarTimeoutError(Date.now() - startedAt);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const excerpt = text.slice(0, 500);

    if (res.status === 502 && /behavioural\s+guard/i.test(text)) {
      // Sidecar's fail-closed behavioural guard tripped. Pull axis if
      // present so observability can break down by rule.
      const axisMatch = text.match(/\(([a-z_]+)\)/i);
      throw new SidecarBehaviouralError(axisMatch?.[1] ?? 'unknown', excerpt);
    }
    throw new SidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarReplyResponse;
}
