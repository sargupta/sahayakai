/**
 * HTTP client for visual aid designer ADK agent (Phase E.3).
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { newRequestId, signRequest } from './signing';

export class VisualAidSidecarConfigError extends Error {
  constructor(message: string) { super(message); this.name = 'VisualAidSidecarConfigError'; }
}
export class VisualAidSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Visual-aid sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'VisualAidSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}
export class VisualAidSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Visual-aid sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'VisualAidSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}
export class VisualAidSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(`Visual-aid sidecar behavioural guard failed (${axisHint}): ${details}`);
    this.name = 'VisualAidSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

export interface SidecarVisualAidRequest {
  prompt: string;
  language?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  userId: string;
}

export interface SidecarVisualAidResponse {
  imageDataUri: string;
  pedagogicalContext: string;
  discussionSpark: string;
  subject: string;
  sidecarVersion: string;
  latencyMs: number;
  imageModelUsed: string;
  metadataModelUsed: string;
}

const TIMEOUT_MS = 110_000;  // 90s sidecar image timeout + 20s headroom for the metadata call + transport
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
export function _resetVisualAidTokenCacheForTest(): void { tokenClientByAudience.clear(); }

export interface CallSidecarVisualAidOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * Forensic fix P1 #18 - caller-supplied request id for telemetry
   * correlation. Defaults to a freshly minted hex id.
   */
  requestId?: string;
}

export async function callSidecarVisualAid(
  request: SidecarVisualAidRequest,
  options: CallSidecarVisualAidOptions = {},
): Promise<SidecarVisualAidResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) throw new VisualAidSidecarConfigError(`${BASE_URL_ENV} is not set`);
  if (!audience) throw new VisualAidSidecarConfigError(`${AUDIENCE_ENV} is not set`);

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/visual-aid/generate`;
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
      throw new VisualAidSidecarTimeoutError(Date.now() - startedAt);
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
      throw new VisualAidSidecarBehaviouralError(axisMatch?.[1] ?? 'unknown', excerpt);
    }
    throw new VisualAidSidecarHttpError(res.status, excerpt);
  }
  return (await res.json()) as SidecarVisualAidResponse;
}
