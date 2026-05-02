/**
 * HTTP client for the sahayakai-agents parent-message-generator
 * ADK agent.
 *
 * Same auth + signing pattern as the other ADK agent clients
 * (parent-call / lesson-plan / vidya / instant-answer):
 *   1. Google ID token scoped to `SAHAYAKAI_AGENTS_AUDIENCE`.
 *   2. HMAC-SHA256 body digest + `X-Request-Timestamp` replay
 *      protection.
 *   3. 8 s client-side timeout via `AbortController` (one Gemini call,
 *      ~1-3 s typical; 8 s leaves headroom for tail latency).
 *
 * Phase C §C.5.
 */

import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { signRequest } from './signing';

// ─── Errors ────────────────────────────────────────────────────────────────

export class ParentMessageSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParentMessageSidecarConfigError';
  }
}

export class ParentMessageSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Parent-message sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'ParentMessageSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class ParentMessageSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(
      `Parent-message sidecar returned HTTP ${status}: ${bodyExcerpt}`,
    );
    this.name = 'ParentMessageSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

/**
 * Behavioural-guard 502 from the sidecar. Per the supervisor
 * architecture proposal, parent-message behavioural-fail IS
 * recoverable on the Genkit fallback path so callers DO fall back.
 */
export class ParentMessageSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(
      `Parent-message sidecar behavioural guard failed (${axisHint}): ${details}`,
    );
    this.name = 'ParentMessageSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

// ─── Wire schemas ──────────────────────────────────────────────────────────

export interface SidecarParentMessageRequest {
  studentName: string;
  className: string;
  subject: string;
  reason:
    | 'consecutive_absences'
    | 'poor_performance'
    | 'behavioral_concern'
    | 'positive_feedback';
  reasonContext?: string | null;
  teacherNote?: string | null;
  parentLanguage:
    | 'English' | 'Hindi' | 'Tamil' | 'Telugu' | 'Kannada' | 'Malayalam'
    | 'Bengali' | 'Marathi' | 'Gujarati' | 'Punjabi' | 'Odia';
  consecutiveAbsentDays?: number | null;
  teacherName?: string | null;
  schoolName?: string | null;
  performanceContext?: {
    latestPercentage?: number | null;
    isAtRisk?: boolean | null;
    subjectBreakdown?: Array<{
      subject: string;
      name: string;
      marksObtained: number;
      maxMarks: number;
      percentage: number;
      date: string;
    }> | null;
  } | null;
  performanceSummary?: string | null;
  userId: string;
}

export interface SidecarParentMessageResponse {
  message: string;
  languageCode: string;
  wordCount: number;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

// ─── ID-token client cache ────────────────────────────────────────────────

const TIMEOUT_MS = 8_000;
const AUDIENCE_ENV = 'SAHAYAKAI_AGENTS_AUDIENCE';
const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';

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

export function _resetParentMessageTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface CallSidecarParentMessageOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function callSidecarParentMessage(
  request: SidecarParentMessageRequest,
  options: CallSidecarParentMessageOptions = {},
): Promise<SidecarParentMessageResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) {
    throw new ParentMessageSidecarConfigError(`${BASE_URL_ENV} is not set`);
  }
  if (!audience) {
    throw new ParentMessageSidecarConfigError(`${AUDIENCE_ENV} is not set`);
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/parent-message/generate`;
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
      throw new ParentMessageSidecarTimeoutError(Date.now() - startedAt);
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
      throw new ParentMessageSidecarBehaviouralError(
        axisMatch?.[1] ?? 'unknown',
        excerpt,
      );
    }
    throw new ParentMessageSidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarParentMessageResponse;
}
