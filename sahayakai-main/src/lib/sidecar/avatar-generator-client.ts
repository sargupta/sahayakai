/**
 * HTTP client for avatar-generator ADK agent (Phase F.2).
 *
 * Sidecar returns ONLY the image data URI. Storage write (Firebase
 * Storage + users/{uid}/avatars/) stays in the Next.js Genkit flow
 * because the sidecar has no Firebase/Storage credentials.
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';
import { newRequestId, signRequest } from './signing';

export class AvatarSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarSidecarConfigError';
  }
}

export class AvatarSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`Avatar sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'AvatarSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}

export class AvatarSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Avatar sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'AvatarSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

export class AvatarSidecarBehaviouralError extends Error {
  readonly axisHint: string;
  constructor(axisHint: string, details: string) {
    super(`Avatar sidecar behavioural guard failed (${axisHint}): ${details}`);
    this.name = 'AvatarSidecarBehaviouralError';
    this.axisHint = axisHint;
  }
}

export interface SidecarAvatarRequest {
  name: string;
  userId: string;
}

export interface SidecarAvatarResponse {
  imageDataUri: string;
  sidecarVersion: string;
  latencyMs: number;
  modelUsed: string;
}

// Image generation can stall — match the visual-aid 90s budget plus a
// small network buffer. The Next.js side already runs avatar generation
// inside a 120s `maxDuration`; 100s here keeps headroom for the pre/
// post storage write.
const TIMEOUT_MS = 100_000;
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

export function _resetAvatarTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

export interface CallSidecarAvatarOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * Forensic fix P1 #18 - caller-supplied request id for telemetry
   * correlation. Defaults to a freshly minted hex id.
   */
  requestId?: string;
}

export async function callSidecarAvatar(
  request: SidecarAvatarRequest,
  options: CallSidecarAvatarOptions = {},
): Promise<SidecarAvatarResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl)
    throw new AvatarSidecarConfigError(`${BASE_URL_ENV} is not set`);
  if (!audience)
    throw new AvatarSidecarConfigError(`${AUDIENCE_ENV} is not set`);

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/avatar-generator/generate`;
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
      throw new AvatarSidecarTimeoutError(Date.now() - startedAt);
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
      throw new AvatarSidecarBehaviouralError(
        axisMatch?.[1] ?? 'unknown',
        excerpt,
      );
    }
    throw new AvatarSidecarHttpError(res.status, excerpt);
  }

  return (await res.json()) as SidecarAvatarResponse;
}
