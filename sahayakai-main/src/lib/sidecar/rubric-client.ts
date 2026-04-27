/**
 * HTTP client for the rubric-generator ADK agent (Phase D.1).
 * Same pattern as parent-message-client.ts.
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { signRequest } from './signing';

export class RubricSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RubricSidecarConfigError';
  }
}

export class RubricSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Rubric sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'RubricSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class RubricSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Rubric sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'RubricSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

export class RubricSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(`Rubric sidecar behavioural guard failed (${axisHint}): ${details}`);
    this.name = 'RubricSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

export interface SidecarRubricLevel {
  name: string;
  description: string;
  points: number;
}

export interface SidecarRubricCriterion {
  name: string;
  description: string;
  levels: SidecarRubricLevel[];
}

export interface SidecarRubricRequest {
  assignmentDescription: string;
  gradeLevel?: string | null;
  subject?: string | null;
  language?: string | null;
  teacherContext?: string | null;
  userId: string;
}

export interface SidecarRubricResponse {
  title: string;
  description: string;
  criteria: SidecarRubricCriterion[];
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

export function _resetRubricTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

export interface CallSidecarRubricOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function callSidecarRubric(
  request: SidecarRubricRequest,
  options: CallSidecarRubricOptions = {},
): Promise<SidecarRubricResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) throw new RubricSidecarConfigError(`${BASE_URL_ENV} is not set`);
  if (!audience) throw new RubricSidecarConfigError(`${AUDIENCE_ENV} is not set`);

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/rubric/generate`;
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
      throw new RubricSidecarTimeoutError(Date.now() - startedAt);
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
      throw new RubricSidecarBehaviouralError(axisMatch?.[1] ?? 'unknown', excerpt);
    }
    throw new RubricSidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarRubricResponse;
}
