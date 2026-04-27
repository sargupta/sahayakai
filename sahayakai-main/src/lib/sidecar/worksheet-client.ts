/**
 * HTTP client for worksheet wizard ADK agent (Phase D.4).
 * Multimodal — wire request carries the imageDataUri.
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { signRequest } from './signing';

export class WorksheetSidecarConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'WorksheetSidecarConfigError'; }
}
export class WorksheetSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Worksheet sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'WorksheetSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}
export class WorksheetSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Worksheet sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'WorksheetSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}
export class WorksheetSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(`Worksheet sidecar behavioural guard failed (${axisHint}): ${details}`);
    this.name = 'WorksheetSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

export interface SidecarWorksheetActivity {
  type: 'question' | 'puzzle' | 'creative_task';
  content: string;
  explanation: string;
  chalkboardNote?: string;
}
export interface SidecarWorksheetAnswerKeyEntry {
  activityIndex: number;
  answer: string;
}
export interface SidecarWorksheetRequest {
  imageDataUri: string;
  prompt: string;
  language?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  teacherContext?: string | null;
  userId: string;
}
export interface SidecarWorksheetResponse {
  title: string;
  gradeLevel: string;
  subject: string;
  learningObjectives: string[];
  studentInstructions: string;
  activities: SidecarWorksheetActivity[];
  answerKey: SidecarWorksheetAnswerKeyEntry[];
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

const TIMEOUT_MS = 25_000; // multimodal calls are slower
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
export function _resetWorksheetTokenCacheForTest(): void { tokenClientByAudience.clear(); }

export interface CallSidecarWorksheetOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function callSidecarWorksheet(
  request: SidecarWorksheetRequest,
  options: CallSidecarWorksheetOptions = {},
): Promise<SidecarWorksheetResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) throw new WorksheetSidecarConfigError(`${BASE_URL_ENV} is not set`);
  if (!audience) throw new WorksheetSidecarConfigError(`${AUDIENCE_ENV} is not set`);

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/worksheet/generate`;
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
      throw new WorksheetSidecarTimeoutError(Date.now() - startedAt);
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
      throw new WorksheetSidecarBehaviouralError(axisMatch?.[1] ?? 'unknown', excerpt);
    }
    throw new WorksheetSidecarHttpError(res.status, excerpt);
  }
  return (await res.json()) as SidecarWorksheetResponse;
}
