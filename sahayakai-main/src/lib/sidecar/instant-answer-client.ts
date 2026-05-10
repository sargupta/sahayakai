/**
 * HTTP client for the sahayakai-agents instant-answer ADK agent.
 *
 * Used by the instant-answer dispatcher when `instantAnswerSidecarMode`
 * is `shadow`, `canary`, or `full`. Same auth + signing pattern as
 * parent-call / lesson-plan / vidya:
 *
 * 1. Mints a Google ID token scoped to `SAHAYAKAI_AGENTS_AUDIENCE`.
 * 2. HMAC-signs the body with `SAHAYAKAI_REQUEST_SIGNING_KEY`.
 * 3. Bounds the request to 10 s via `AbortController`.
 *
 * 10 s timeout sits between vidya's 8 s (voice-bound classifier) and
 * lesson-plan's 60 s (multi-call writer/evaluator/reviser). Instant
 * answer is one Gemini call with Google Search grounding — typically
 * 2-4 s end-to-end, so 10 s leaves ~6 s headroom against the
 * tail latency a grounded call can hit when search results are
 * abnormally large.
 *
 * Phase B §B.5.
 */

import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { getFirebaseAppCheckToken } from '@/lib/firebase-app-check';

import { newRequestId, signRequest } from './signing';

// ─── Errors ────────────────────────────────────────────────────────────────

export class InstantAnswerSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstantAnswerSidecarConfigError';
  }
}

export class InstantAnswerSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Instant-answer sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'InstantAnswerSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class InstantAnswerSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Instant-answer sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'InstantAnswerSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

/**
 * Behavioural-guard 502 from the sidecar's post-generation guard
 * (length / video-URL / forbidden-phrase / script-match). Per the
 * supervisor architecture proposal, instant-answer behavioural fail
 * IS recoverable on the Genkit fallback path — the Genkit flow has
 * its own (different) safety pass and may succeed where the strict
 * sidecar guard rejected. So callers DO fall back here.
 */
export class InstantAnswerSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(
      `Instant-answer sidecar behavioural guard failed (${axisHint}): ${details}`,
    );
    this.name = 'InstantAnswerSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

// ─── Wire schemas ──────────────────────────────────────────────────────────

// Phase N.2 — Forensic audit P1 #22. Wire types now imported from
// `types.generated.ts` (regenerated from the Pydantic source of truth
// via `sahayakai-agents/scripts/codegen_ts.py`). Public surface
// preserved: dispatchers / tests still import `Sidecar{InstantAnswer,
// InstantAnswerRequest,InstantAnswerResponse}`.
import type {
  InstantAnswerRequest as GenInstantAnswerRequest,
  InstantAnswerResponse as GenInstantAnswerResponse,
} from './types.generated';

export type SidecarInstantAnswerRequest = GenInstantAnswerRequest;
export type SidecarInstantAnswerResponse = GenInstantAnswerResponse;

// ─── ID-token client cache ────────────────────────────────────────────────

const TIMEOUT_MS = 10_000;
const AUDIENCE_ENV = 'SAHAYAKAI_AGENTS_AUDIENCE';
const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';

/**
 * Same lazy-cache + reject-eviction pattern as parent-call /
 * lesson-plan / vidya clients. A transient cold-start failure does
 * not poison the entire instance.
 */
const tokenClientByAudience = new Map<string, Promise<IdTokenClient>>();

async function getTokenClient(audience: string): Promise<IdTokenClient> {
  let cached = tokenClientByAudience.get(audience);
  if (!cached) {
    const auth = new GoogleAuth();
    const p = auth.getIdTokenClient(audience);
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
export function _resetInstantAnswerTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface CallSidecarInstantAnswerOptions {
  /** Override the timeout for tests / local dev. */
  timeoutMs?: number;
  /** Optional fetch impl for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /**
   * Forensic fix P1 #18 - caller-supplied request id for telemetry
   * correlation. Defaults to a freshly minted hex id.
   */
  requestId?: string;
  /**
   * Phase R.2 + Phase U.delta: Firebase App Check token forwarded from
   * the browser. Set as `X-Firebase-AppCheck` header. When `undefined`
   * the client auto-fetches via `getFirebaseAppCheckToken()` (returns
   * null on server / SSR). When `null` the header is omitted. The
   * sidecar's `SAHAYAKAI_REQUIRE_APP_CHECK` flag governs enforcement.
   */
  appCheckToken?: string | null;
}

/**
 * Call the sidecar's `POST /v1/instant-answer/answer` endpoint.
 *
 * Returns a typed response on 200, throws a typed error on every other
 * outcome. The dispatcher chooses the fallback strategy.
 */
export async function callSidecarInstantAnswer(
  request: SidecarInstantAnswerRequest,
  options: CallSidecarInstantAnswerOptions = {},
): Promise<SidecarInstantAnswerResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) {
    throw new InstantAnswerSidecarConfigError(
      `${BASE_URL_ENV} is not set`,
    );
  }
  if (!audience) {
    throw new InstantAnswerSidecarConfigError(
      `${AUDIENCE_ENV} is not set`,
    );
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/instant-answer/answer`;
  const rawBody = JSON.stringify(request);
  const { timestamp, digest } = await signRequest(rawBody);

  const tokenClient = await getTokenClient(audience);
  const authHeaders = await tokenClient.getRequestHeaders();

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId ?? newRequestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  // Phase R.2 + Phase U.delta: auto-fetch App Check token when caller
  // does not pass one. `getFirebaseAppCheckToken()` returns null on
  // server / SSR — pure-server callers silently omit the header.
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
      throw new InstantAnswerSidecarTimeoutError(Date.now() - startedAt);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const excerpt = text.slice(0, 500);

    if (res.status === 502 && /behavioural\s+guard/i.test(text)) {
      const axisMatch = text.match(/\(([a-z_]+)\)/i);
      throw new InstantAnswerSidecarBehaviouralError(
        axisMatch?.[1] ?? 'unknown',
        excerpt,
      );
    }
    throw new InstantAnswerSidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarInstantAnswerResponse;
}
