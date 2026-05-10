/**
 * HTTP client for the rubric-generator ADK agent (Phase D.1).
 * Same pattern as parent-message-client.ts.
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { getFirebaseAppCheckToken } from '@/lib/firebase-app-check';

import { newRequestId, signRequest } from './signing';

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

// Phase N.2 — Forensic audit P1 #22. Wire types now imported from
// `types.generated.ts` (regenerated from the Pydantic source of truth
// via `sahayakai-agents/scripts/codegen_ts.py`). Public surface
// preserved: dispatchers / tests still import `Sidecar{Rubric,
// RubricLevel,RubricCriterion,RubricRequest,RubricResponse}`.
import type {
  RubricCriterion as GenRubricCriterion,
  RubricGeneratorRequest as GenRubricRequest,
  RubricGeneratorResponse as GenRubricResponse,
  RubricLevel as GenRubricLevel,
} from './types.generated';

export type SidecarRubricLevel = GenRubricLevel;
export type SidecarRubricCriterion = GenRubricCriterion;
export type SidecarRubricRequest = GenRubricRequest;
export type SidecarRubricResponse = GenRubricResponse;

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
  /**
   * Forensic fix P1 #18 - caller-supplied request id for telemetry
   * correlation. Defaults to a freshly minted hex id.
   */
  requestId?: string;
  /**
   * Phase R.2 + Phase U.delta: Firebase App Check token. When
   * `undefined` the client auto-fetches via `getFirebaseAppCheckToken()`
   * (returns null on server / SSR). When `null` the header is omitted.
   */
  appCheckToken?: string | null;
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
