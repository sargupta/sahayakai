/**
 * HTTP client for virtual field-trip ADK agent (Phase D.3).
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { newRequestId, signRequest } from './signing';

export class VirtualFieldTripSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VirtualFieldTripSidecarConfigError';
  }
}

export class VirtualFieldTripSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Virtual field-trip sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'VirtualFieldTripSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class VirtualFieldTripSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Virtual field-trip sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'VirtualFieldTripSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

export class VirtualFieldTripSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(
      `Virtual field-trip sidecar behavioural guard failed (${axisHint}): ${details}`,
    );
    this.name = 'VirtualFieldTripSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

export interface SidecarVirtualFieldTripStop {
  name: string;
  description: string;
  educationalFact: string;
  reflectionPrompt: string;
  googleEarthUrl: string;
  culturalAnalogy: string;
  explanation: string;
}

export interface SidecarVirtualFieldTripRequest {
  topic: string;
  language?: string | null;
  gradeLevel?: string | null;
  userId: string;
}

export interface SidecarVirtualFieldTripResponse {
  title: string;
  stops: SidecarVirtualFieldTripStop[];
  gradeLevel: string;
  subject: string;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

const TIMEOUT_MS = 15_000;
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

export function _resetVirtualFieldTripTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

export interface CallSidecarVirtualFieldTripOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * Forensic fix P1 #18 - caller-supplied request id for telemetry
   * correlation. Defaults to a freshly minted hex id.
   */
  requestId?: string;
}

export async function callSidecarVirtualFieldTrip(
  request: SidecarVirtualFieldTripRequest,
  options: CallSidecarVirtualFieldTripOptions = {},
): Promise<SidecarVirtualFieldTripResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl)
    throw new VirtualFieldTripSidecarConfigError(`${BASE_URL_ENV} is not set`);
  if (!audience)
    throw new VirtualFieldTripSidecarConfigError(`${AUDIENCE_ENV} is not set`);

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/virtual-field-trip/plan`;
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
      throw new VirtualFieldTripSidecarTimeoutError(Date.now() - startedAt);
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
      throw new VirtualFieldTripSidecarBehaviouralError(
        axisMatch?.[1] ?? 'unknown',
        excerpt,
      );
    }
    throw new VirtualFieldTripSidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarVirtualFieldTripResponse;
}
