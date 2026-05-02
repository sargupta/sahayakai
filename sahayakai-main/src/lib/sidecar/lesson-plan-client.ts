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

import { signRequest } from './signing';

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

/**
 * Mirror of `LessonPlanRequest` in
 * `sahayakai-agents/src/sahayakai_agents/agents/lesson_plan/schemas.py`.
 * Hand-typed for now; will be replaced by `dist/types.generated.ts`
 * when the codegen step lands.
 */
export interface SidecarLessonPlanRequest {
  topic: string;
  language?: string;
  gradeLevels?: string[];
  useRuralContext?: boolean;
  ncertChapter?: {
    title: string;
    number: number;
    subject?: string;
    learningOutcomes: string[];
  };
  resourceLevel?: 'low' | 'medium' | 'high';
  difficultyLevel?: 'remedial' | 'standard' | 'advanced';
  subject?: string;
  teacherContext?: string;
  /**
   * Phase J.4 hot-fix (B3 inconsistency): every other agent's
   * `userId` is required on the wire; lesson-plan was the odd one
   * out. The dispatcher already has it (`LessonPlanDispatchInput`
   * declares it required) — we just forward it through.
   */
  userId: string;
}

export interface SidecarLessonPlanActivity {
  phase: 'Engage' | 'Explore' | 'Explain' | 'Elaborate' | 'Evaluate';
  name: string;
  description: string;
  duration: string;
  teacherTips: string | null;
  understandingCheck: string | null;
}

export interface SidecarLessonPlanResponse {
  title: string;
  gradeLevel: string | null;
  duration: string | null;
  subject: string | null;
  objectives: string[];
  keyVocabulary: Array<{ term: string; meaning: string }> | null;
  materials: string[];
  activities: SidecarLessonPlanActivity[];
  assessment: string | null;
  homework: string | null;
  language: string;

  /** Phase 3 telemetry — number of revision passes the sidecar ran (0 or 1). */
  revisionsRun: number;
  /** The evaluator's verdict on the SHIPPED plan (post-revision if any). */
  rubric: {
    scores: {
      grade_level_alignment: number;
      objective_assessment_match: number;
      resource_level_realism: number;
      language_naturalness: number;
      scaffolding_present: number;
      inclusion_signals: number;
      cultural_appropriateness: number;
    };
    safety: boolean;
    rationale: string;
    fail_reasons: string[];
  };
  sidecarVersion: string;
}

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
  const { timestamp, digest } = await signRequest(rawBody);

  const tokenClient = await getTokenClient(audience);
  const authHeaders = await tokenClient.getRequestHeaders();

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        'X-Content-Digest': digest,
        'X-Request-Timestamp': timestamp,
      },
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
