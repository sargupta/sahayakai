/**
 * HTTP client for the sahayakai-agents VIDYA orchestrator endpoint.
 *
 * Used by the VIDYA dispatcher when `vidyaSidecarMode` is `shadow`,
 * `canary`, or `full`. Mirrors `parent-call-client.ts` and
 * `lesson-plan-client.ts`:
 *
 * 1. Mints a Google ID token scoped to `SAHAYAKAI_AGENTS_AUDIENCE`.
 * 2. HMAC-signs the body with `SAHAYAKAI_REQUEST_SIGNING_KEY`.
 * 3. Bounds the request to 12 s via `AbortController`.
 *
 * 12s budget = 5s sidecar backoff + 4s p99 classifier + 1.5s network +
 * 1.5s headroom. Was 8s; bumped per Phase M.2 forensic audit (p99
 * latency exceeded 8s on canary cohort, triggering false-positive
 * timeouts and 2× genkit fallback cost).
 *
 * Phase 5 §5.7; bumped Phase M.2.
 */

import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { newRequestId, signRequest } from './signing';

// ─── Errors ────────────────────────────────────────────────────────────────

export class VidyaSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VidyaSidecarConfigError';
  }
}

export class VidyaSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`VIDYA sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'VidyaSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class VidyaSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`VIDYA sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'VidyaSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

/**
 * The sidecar's behavioural guard tripped. Like lesson-plan (and
 * unlike parent-call), VIDYA falls back to Genkit on this error
 * because the Genkit `agentRouterFlow` has its own non-redundant
 * intent-classification + safety pass — the teacher still gets a
 * useful response.
 */
export class VidyaSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(`VIDYA sidecar behavioural guard failed (${axisHint}): ${details}`);
    this.name = 'VidyaSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

// ─── Wire schemas ──────────────────────────────────────────────────────────

/**
 * Mirror of `VidyaRequest` in
 * `sahayakai-agents/src/sahayakai_agents/agents/vidya/schemas.py`.
 * Hand-typed for now; replaced by `dist/types.generated.ts` when the
 * codegen step lands.
 *
 * Phase L.2 — `userId` is required. The Python schema removed the
 * `vidya-supervisor` placeholder when delegating to instant-answer;
 * the dispatcher now forwards the authenticated uid through the wire.
 */
export interface SidecarVidyaRequest {
  message: string;
  chatHistory: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  currentScreenContext: {
    path: string;
    uiState: Record<string, string> | null;
  };
  teacherProfile: {
    preferredGrade?: string | null;
    preferredSubject?: string | null;
    preferredLanguage?: string | null;
    schoolContext?: string | null;
  };
  detectedLanguage?: string | null;
  /**
   * Authenticated teacher uid, required. Pattern matches the Python
   * schema: alphanumeric + underscore + hyphen only — defends
   * downstream Firestore document IDs against path-injection.
   */
  userId: string;
}

export type SidecarVidyaFlow =
  | 'lesson-plan'
  | 'quiz-generator'
  | 'visual-aid-designer'
  | 'worksheet-wizard'
  | 'virtual-field-trip'
  | 'teacher-training'
  | 'rubric-generator'
  | 'exam-paper'
  | 'video-storyteller';

export interface SidecarVidyaAction {
  type: 'NAVIGATE_AND_FILL';
  flow: SidecarVidyaFlow;
  params: {
    topic: string | null;
    gradeLevel: string | null;
    subject: string | null;
    language: string | null;
    ncertChapter: {
      number: number;
      title: string;
      learningOutcomes: string[];
    } | null;
    /**
     * Phase N.1 — index pointers into the parent `plannedActions`
     * list. Each int is the position of an EARLIER action whose
     * output this action consumes (e.g. a rubric that grades a
     * lesson plan at index 0 sets `dependsOn: [0]`). Bounded at 2
     * entries by the Python schema; deeper graphs split into
     * separate teacher-confirmed sessions. Defaults to `[]` for
     * independent actions.
     */
    dependsOn?: number[];
  };
}

export interface SidecarVidyaResponse {
  response: string;
  action: SidecarVidyaAction | null;
  intent: string;
  sidecarVersion: string;
  latencyMs: number;
  /**
   * Phase N.1 — typed planned-action queue (replaces Phase G's
   * `followUpSuggestion: string | null`).
   *
   * Up to 3 ordered `VidyaAction`s the orchestrator authored for a
   * compound request ("lesson plan AND a rubric"). The first entry
   * mirrors the legacy `action` field for backward compat; the rest
   * are the queue of follow-ups the OmniOrb renders as chips. Empty
   * for unknown / instant-answer / unroutable paths. The supervisor
   * does NOT auto-execute — every entry is teacher-confirmed.
   */
  plannedActions?: SidecarVidyaAction[];
}

// ─── ID-token client cache ────────────────────────────────────────────────

const TIMEOUT_MS = 12_000;
const AUDIENCE_ENV = 'SAHAYAKAI_AGENTS_AUDIENCE';
const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';

/**
 * Same lazy-cache pattern as parent-call / lesson-plan clients.
 * Eviction on rejection so a transient cold-start metadata-server
 * failure does not poison the entire instance.
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
export function _resetVidyaTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface CallSidecarVidyaOptions {
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
 * Call the sidecar's `POST /v1/vidya/orchestrate` endpoint.
 *
 * Returns a typed response on 200, throws a typed error on every other
 * outcome. The dispatcher chooses the fallback strategy.
 */
export async function callSidecarVidya(
  request: SidecarVidyaRequest,
  options: CallSidecarVidyaOptions = {},
): Promise<SidecarVidyaResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) {
    throw new VidyaSidecarConfigError(`${BASE_URL_ENV} is not set`);
  }
  if (!audience) {
    throw new VidyaSidecarConfigError(`${AUDIENCE_ENV} is not set`);
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/vidya/orchestrate`;
  const rawBody = JSON.stringify(request);
  // Phase R.2: signRequest builds the HMAC + timestamp pair; App Check
  // (when provided by the caller) is attached as a third auth header
  // below.
  const { timestamp, digest } = await signRequest(rawBody);

  const tokenClient = await getTokenClient(audience);
  const authHeaders = await tokenClient.getRequestHeaders();

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId ?? newRequestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  const headers: Record<string, string> = {
    ...authHeaders,
    'Content-Type': 'application/json',
    'X-Content-Digest': digest,
    'X-Request-Timestamp': timestamp,
    'X-Request-ID': requestId,
  };
  if (options.appCheckToken) {
    headers['X-Firebase-AppCheck'] = options.appCheckToken;
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
      throw new VidyaSidecarTimeoutError(Date.now() - startedAt);
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
      throw new VidyaSidecarBehaviouralError(
        axisMatch?.[1] ?? 'unknown',
        excerpt,
      );
    }
    throw new VidyaSidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarVidyaResponse;
}
