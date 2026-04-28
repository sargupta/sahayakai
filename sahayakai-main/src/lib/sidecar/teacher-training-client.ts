/**
 * HTTP client for teacher-training ADK agent (Phase D.2).
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { newRequestId, signRequest } from './signing';

export class TeacherTrainingSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeacherTrainingSidecarConfigError';
  }
}

export class TeacherTrainingSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Teacher-training sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'TeacherTrainingSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class TeacherTrainingSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(
      `Teacher-training sidecar returned HTTP ${status}: ${bodyExcerpt}`,
    );
    this.name = 'TeacherTrainingSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

export class TeacherTrainingSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(
      `Teacher-training sidecar behavioural guard failed (${axisHint}): ${details}`,
    );
    this.name = 'TeacherTrainingSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

export interface SidecarTeacherTrainingAdvicePoint {
  strategy: string;
  pedagogy: string;
  explanation: string;
}

export interface SidecarTeacherTrainingRequest {
  question: string;
  language?: string | null;
  subject?: string | null;
  userId: string;
}

export interface SidecarTeacherTrainingResponse {
  introduction: string;
  advice: SidecarTeacherTrainingAdvicePoint[];
  conclusion: string;
  gradeLevel: string | null;
  subject: string | null;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

const TIMEOUT_MS = 12_000;
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

export function _resetTeacherTrainingTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

export interface CallSidecarTeacherTrainingOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * Forensic fix P1 #18 - caller-supplied request id for telemetry
   * correlation. Defaults to a freshly minted hex id.
   */
  requestId?: string;
}

export async function callSidecarTeacherTraining(
  request: SidecarTeacherTrainingRequest,
  options: CallSidecarTeacherTrainingOptions = {},
): Promise<SidecarTeacherTrainingResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl)
    throw new TeacherTrainingSidecarConfigError(
      `${BASE_URL_ENV} is not set`,
    );
  if (!audience)
    throw new TeacherTrainingSidecarConfigError(
      `${AUDIENCE_ENV} is not set`,
    );

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/teacher-training/advise`;
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

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        'X-Content-Digest': digest,
        'X-Request-Timestamp': timestamp,
        'X-Request-ID': requestId,
      },
      body: rawBody,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TeacherTrainingSidecarTimeoutError(Date.now() - startedAt);
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
      throw new TeacherTrainingSidecarBehaviouralError(
        axisMatch?.[1] ?? 'unknown',
        excerpt,
      );
    }
    throw new TeacherTrainingSidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarTeacherTrainingResponse;
}
