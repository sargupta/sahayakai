/**
 * HTTP client for the VIDYA voice (Gemini Live) session-start endpoint.
 *
 * POST /v1/vidya-voice/start-session on the `sahayakai-agents` sidecar
 * mints a short-lived Gemini Live ephemeral token (bound to the Live
 * model + tool surface for THIS teacher's session) and returns it plus
 * the WSS URL the client opens directly. Audio bytes flow client ↔
 * Google; the sidecar never sees audio — it only mints the token.
 *
 * Auth to the sidecar is identical to every other client in this
 * directory (see `worksheet-client.ts`): a Google OIDC ID token
 * scoped to `SAHAYAKAI_AGENTS_AUDIENCE`, an HMAC body digest
 * (`X-Content-Digest` + `X-Request-Timestamp`, replay-bounded), a
 * correlation `X-Request-ID`, and — when available — a Firebase App
 * Check token. NOTHING new about the transport; only the route and
 * payload differ.
 *
 * This path is ADDITIVE and feature-flagged upstream (the route gates
 * on `VIDYA_VOICE_LIVE_ENABLED`). The existing turn-based STT →
 * classifier → TTS pipeline stays the default and the fallback.
 */
import { GoogleAuth, type IdTokenClient } from 'google-auth-library';

import { getServerAppCheckTokenOrNull } from '@/lib/sidecar/app-check-mint';

import { newRequestId, signRequest } from './signing';
import type {
  SessionStartRequest as GenSessionStartRequest,
  SessionStartResponse as GenSessionStartResponse,
} from './types.generated';

// Public surface preserved as the sidecar-prefixed aliases the rest of
// the codebase uses for wire types (matches the `Sidecar*` convention
// in the sibling clients).
export type SidecarVidyaVoiceStartRequest = GenSessionStartRequest;
export type SidecarVidyaVoiceStartResponse = GenSessionStartResponse;

export class VidyaVoiceSidecarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VidyaVoiceSidecarConfigError';
  }
}
export class VidyaVoiceSidecarTimeoutError extends Error {
  readonly elapsedMs: number;
  constructor(elapsedMs: number) {
    super(`VIDYA voice sidecar request timed out after ${elapsedMs}ms`);
    this.name = 'VidyaVoiceSidecarTimeoutError';
    this.elapsedMs = elapsedMs;
  }
}
export class VidyaVoiceSidecarHttpError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`VIDYA voice sidecar returned HTTP ${status}: ${bodyExcerpt}`);
    this.name = 'VidyaVoiceSidecarHttpError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt;
  }
}

// Token minting is a single `auth_tokens.create()` round-trip to
// Google, but a cold Cloud Run instance can add several seconds — keep
// the ceiling generous enough that a cold start still completes.
const TIMEOUT_MS = 20_000;
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
export function _resetVidyaVoiceTokenCacheForTest(): void {
  tokenClientByAudience.clear();
}

export interface CallSidecarVidyaVoiceOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Caller-supplied request id for telemetry correlation. Defaults to a fresh id. */
  requestId?: string;
  /**
   * Firebase App Check token. When `undefined` the client auto-fetches
   * via `getServerAppCheckTokenOrNull()` (returns null on server / SSR).
   * When `null` the header is omitted.
   */
  appCheckToken?: string | null;
}

export async function callSidecarVidyaVoiceStartSession(
  request: SidecarVidyaVoiceStartRequest,
  options: CallSidecarVidyaVoiceOptions = {},
): Promise<SidecarVidyaVoiceStartResponse> {
  const baseUrl = process.env[BASE_URL_ENV];
  const audience = process.env[AUDIENCE_ENV];
  if (!baseUrl) throw new VidyaVoiceSidecarConfigError(`${BASE_URL_ENV} is not set`);
  if (!audience) throw new VidyaVoiceSidecarConfigError(`${AUDIENCE_ENV} is not set`);

  const url = `${baseUrl.replace(/\/+$/, '')}/v1/vidya-voice/start-session`;
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

  const appCheckToken =
    options.appCheckToken === undefined
      ? await getServerAppCheckTokenOrNull()
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
      throw new VidyaVoiceSidecarTimeoutError(Date.now() - startedAt);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new VidyaVoiceSidecarHttpError(res.status, text.slice(0, 500));
  }
  return (await res.json()) as SidecarVidyaVoiceStartResponse;
}
