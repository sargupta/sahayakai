/**
 * HTTP client for the sahayakai-agents lesson-plan sidecar endpoint.
 *
 * Used by the lesson-plan dispatcher when `lessonPlanSidecarMode` is
 * `shadow`, `canary`, or `full`. Mirrors `parent-call-client.ts`:
 *
 * 1. Mints a Google ID token scoped to `SAHAYAKAI_AGENTS_AUDIENCE`.
 * 2. HMAC-signs the body with `SAHAYAKAI_REQUEST_SIGNING_KEY`.
 * 3. Bounds the request to 60 s via `AbortController`.
 *
 * The 60 s timeout is wider than parent-call's 3.5 s because lesson plan
 * is a non-realtime synchronous request: the sidecar runs up to 4
 * sequential Gemini calls (writer → evaluator → reviser → evaluator-on-v2)
 * with `run_resiliently` retry bursts on each. Cloud Run timeoutSeconds
 * is set to 120 s for this path so 60 s client-side leaves headroom for
 * the response trip.
 *
 * Errors mirror the parent-call client so the dispatcher's fall-through
 * logic stays uniform:
 * - `LessonPlanSidecarConfigError` — env vars missing
 * - `LessonPlanSidecarTimeoutError` — client-side abort fired
 * - `LessonPlanSidecarHttpError` — non-2xx response
 * - `LessonPlanSidecarBehaviouralError` — 502 with "Behavioural guard"
 *   in the body. Indicates the post-orchestration guard tripped on the
 *   final plan text. Genkit fallback is still attempted because Genkit
 *   has its own behavioural guard with different rules.
 *
 * Phase 3 §3.4.
 */

import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { getFirebaseAppCheckToken } from '@/lib/firebase-app-check';

import { newRequestId, signRequest } from './signing';

// ─── Errors ────────────────────────────────────────────────────────────────

export class LessonPlanSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LessonPlanSidecarConfigError';
  }
}

export class LessonPlanSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Lesson-plan sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'LessonPlanSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class LessonPlanSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Lesson-plan sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'LessonPlanSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

/**
 * The sidecar's post-orchestration behavioural guard tripped (502 with
 * `Behavioural guard failed:` in the body). Unlike parent-call, lesson
 * plan generation can fall back to Genkit on a behavioural fail because
 * the Genkit lesson-plan flow has its own (different) guard rules — the
 * two paths are not redundant. Caller decides.
 */
export class LessonPlanSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(`Lesson-plan sidecar behavioural guard failed (${axisHint}): ${details}`);
    this.name = 'LessonPlanSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

// ─── Wire schemas ──────────────────────────────────────────────────────────

// Phase N.2 — Forensic audit P1 #22. Wire types now imported from
// `types.generated.ts` (regenerated from the Pydantic source of truth
// via `sahayakai-agents/scripts/codegen_ts.py`). Public surface
// preserved: dispatchers / tests still import `Sidecar{LessonPlan,
// LessonPlanActivity,LessonPlanRequest,LessonPlanResponse}`.
import type {
  Activity as GenLessonPlanActivity,
  LessonPlanRequest as GenLessonPlanRequest,
  LessonPlanResponse as GenLessonPlanResponse,
} from './types.generated';

export type SidecarLessonPlanActivity = GenLessonPlanActivity;
export type SidecarLessonPlanRequest = GenLessonPlanRequest;
export type SidecarLessonPlanResponse = GenLessonPlanResponse;

// ─── ID-token client cache ────────────────────────────────────────────────

const TIMEOUT_MS = 60_000;
const AUDIENCE_ENV = 'SAHAYAKAI_AGENTS_AUDIENCE';
const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';

/**
 * Same lazy-cache pattern as `parent-call-client.ts`. Eviction on
 * rejection so a transient cold-start metadata-server failure does
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
export function _resetLessonPlanTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface CallSidecarLessonPlanOptions {
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
   * Phase R.2: Firebase App Check token forwarded from the browser.
   * Set as `X-Firebase-AppCheck` header. When undefined / null the
   * header is omitted; the sidecar's `SAHAYAKAI_REQUIRE_APP_CHECK`
   * flag decides whether that's a 401 or accepted (rollout mode).
   */
  appCheckToken?: string | null;
}

/**
 * Call the sidecar's `POST /v1/lesson-plan/generate` endpoint.
 *
 * Returns a typed response on 200, throws a typed error on every other
 * outcome. The dispatcher chooses the fallback strategy.
 */
export async function callSidecarLessonPlan(
  request: SidecarLessonPlanRequest,
  options: CallSidecarLessonPlanOptions = {},
): Promise<SidecarLessonPlanResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) {
    throw new LessonPlanSidecarConfigError(`${BASE_URL_ENV} is not set`);
  }
  if (!audience) {
    throw new LessonPlanSidecarConfigError(`${AUDIENCE_ENV} is not set`);
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/lesson-plan/generate`;
  const rawBody = JSON.stringify(request);
  // Phase R.2: signRequest produces the HMAC + timestamp. App Check
  // (if provided by the caller) is attached as a third header below.
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
      throw new LessonPlanSidecarTimeoutError(Date.now() - startedAt);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const excerpt = text.slice(0, 500);

    if (res.status === 502 && /behavioural\s+guard/i.test(text)) {
      // Pull the axis hint if the sidecar embeds one. The current
      // sidecar wraps everything in `code: INTERNAL` so the regex is
      // forgiving — fall back to "unknown" when no parens are present.
      const axisMatch = text.match(/\(([a-z_]+)\)/i);
      throw new LessonPlanSidecarBehaviouralError(axisMatch?.[1] ?? 'unknown', excerpt);
    }
    throw new LessonPlanSidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarLessonPlanResponse;
}
