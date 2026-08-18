import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { mintStreamToken } from '@/lib/sidecar/signing';
import {
  callSidecarVidyaVoiceStartSession,
  VidyaVoiceSidecarConfigError,
  VidyaVoiceSidecarHttpError,
  VidyaVoiceSidecarTimeoutError,
  type SidecarVidyaVoiceStartRequest,
} from '@/lib/sidecar/vidya-voice-client';

/**
 * VIDYA voice (Gemini Live via Vertex) — authorise a live-voice session.
 *
 * POST /api/vidya-voice/start-session
 *   Returns everything the client needs to open the sidecar's Vertex Live
 *   WebSocket proxy: the `wsUrl`, a short-lived signed `streamToken`, and
 *   the language to speak. The client connects to `wsUrl?t=<streamToken>`
 *   and streams mic PCM up / receives model audio + tool-calls down.
 *   Vertex authenticates with the sidecar's own ADC — no Google credential
 *   ever reaches the device; only this opaque, expiring token, which the
 *   sidecar verifies (HMAC) before opening a billable session.
 *
 *   Why Vertex behind a proxy and not the Developer-API ephemeral token:
 *   the Gemini Developer API's India prepaid tier is depleted and neither
 *   GCP billing nor startup credits fund it — that path is billing-dead.
 *   Vertex AI Live bills to Cloud Billing. Vertex has no client-facing
 *   ephemeral token, so the sidecar has to terminate the socket.
 *
 * Auth: middleware verifies the Firebase ID token and injects `x-user-id`
 *   — the same gate as every other authenticated route.
 *
 * Two gates, both closed by default:
 *   1. `VIDYA_VOICE_LIVE_ENABLED` must be `"true"`.
 *   2. the caller's uid must appear in `VIDYA_VOICE_LIVE_ALLOWED_UIDS`
 *      (comma-separated). Unset or empty means NOBODY — a live socket is
 *      billable and unrehearsed, so it opens for a named canary cohort,
 *      not for whoever happens to tap the orb.
 *   Either gate closed returns the same 503 and the client stays on the
 *   turn-based STT → classifier → TTS pipeline. Live is strictly
 *   additive; the turn-based path is never removed.
 *
 * Runtime: Node. `node:crypto` HMAC for the stream token, and the
 *   Developer-API rollback path needs `google-auth-library` (OIDC) —
 *   neither runs on the edge.
 */
export const runtime = 'nodejs';

const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';
const ALLOWLIST_ENV = 'VIDYA_VOICE_LIVE_ALLOWED_UIDS';
const STREAM_PATH = '/v1/vidya-voice/stream';

/**
 * Which transport this build authorises. `vertex-proxy` is the funded
 * path and the only one that ships.
 *
 * `developer-api` is the ROLLBACK TARGET: if Vertex Live has an outage,
 * flip this constant, redeploy, and the route goes back to minting a
 * Developer-API ephemeral token through the sidecar. That branch below
 * is therefore unreachable but deliberately intact and type-checked —
 * do not delete it as dead code. It costs nothing while this constant
 * says `vertex-proxy`; rebuilding it under an outage would cost hours.
 *
 * The type annotation is the union on purpose so the comparison stays
 * legal and the branch keeps compiling.
 */
const TRANSPORT: 'vertex-proxy' | 'developer-api' = 'vertex-proxy';

// Pydantic `max_length` bounds on the sidecar's `SessionStartRequest`
// (schemas.py). Enforced here too so a hostile payload gets a clean 400
// at the edge instead of a 422 bounced back from the sidecar.
const MAX = {
  grade: 50,
  subject: 100,
  language: 10,
  schoolContext: 2000,
  path: 500,
  uiStateKeys: 20,
} as const;

function clampStr(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, max);
}

/**
 * Parse the canary allowlist. Comma-separated uids; whitespace and empty
 * entries are ignored. Firebase uids are case-sensitive, so this is an
 * exact match — no lower-casing.
 *
 * Unset, empty, or all-whitespace yields an EMPTY set, which denies
 * everyone. Fail-closed is the point: `VIDYA_VOICE_LIVE_ENABLED` is
 * already `true` in the deployed environment (see cloudbuild.yaml), so
 * an allowlist that defaulted to "everyone" would open a billable Live
 * socket for the whole user base the moment this merges.
 */
function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

/** Convert the sidecar https base URL to the wss stream endpoint. */
function toStreamWsUrl(baseUrl: string): string {
  const base = baseUrl
    .replace(/\/+$/, '')
    .replace(/^http:/, 'ws:')
    .replace(/^https:/, 'wss:');
  return `${base}${STREAM_PATH}`;
}

interface RawBody {
  teacherProfile?: unknown;
  currentScreenContext?: unknown;
  detectedLanguage?: unknown;
}

export async function POST(request: NextRequest) {
  // 1. Auth — middleware injects x-user-id from the verified Firebase token.
  const uid = request.headers.get('x-user-id');
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Feature flag — default OFF keeps the client on the turn-based pipeline.
  if (process.env.VIDYA_VOICE_LIVE_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Live voice is not available right now' },
      { status: 503 },
    );
  }

  // 3. Canary allowlist. Same 503 as the flag being off — a teacher who
  //    is not in the cohort should see the ordinary "not available"
  //    fallback, not an access-denied that invites probing.
  if (!parseAllowlist(process.env[ALLOWLIST_ENV]).has(uid)) {
    return NextResponse.json(
      { error: 'Live voice is not available right now' },
      { status: 503 },
    );
  }

  // 4. Parse + validate the body. The sidecar re-validates with
  //    `extra="forbid"`, so we build ONLY the allowed keys.
  const body = (await request.json().catch(() => null)) as RawBody | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const profile =
    body.teacherProfile && typeof body.teacherProfile === 'object'
      ? (body.teacherProfile as Record<string, unknown>)
      : {};
  const screen =
    body.currentScreenContext && typeof body.currentScreenContext === 'object'
      ? (body.currentScreenContext as Record<string, unknown>)
      : null;

  const path = clampStr(screen?.path, MAX.path);
  if (!path) {
    return NextResponse.json(
      { error: 'currentScreenContext.path is required' },
      { status: 400 },
    );
  }

  // uiState: bounded dict[str, str]. Drop anything non-string; cap key count.
  let uiState: Record<string, string> | null = null;
  if (screen?.uiState && typeof screen.uiState === 'object') {
    const entries = Object.entries(screen.uiState as Record<string, unknown>)
      .filter((e): e is [string, string] => typeof e[1] === 'string')
      .slice(0, MAX.uiStateKeys);
    if (entries.length > 0) uiState = Object.fromEntries(entries);
  }

  const sidecarRequest: SidecarVidyaVoiceStartRequest = {
    teacherProfile: {
      preferredGrade: clampStr(profile.preferredGrade, MAX.grade) ?? null,
      preferredSubject: clampStr(profile.preferredSubject, MAX.subject) ?? null,
      preferredLanguage:
        clampStr(profile.preferredLanguage, MAX.language) ?? null,
      schoolContext: clampStr(profile.schoolContext, MAX.schoolContext) ?? null,
    },
    currentScreenContext: { path, uiState },
    detectedLanguage: clampStr(body.detectedLanguage, MAX.language) ?? null,
  };

  // 5a. ROLLBACK PATH — unreachable while TRANSPORT is `vertex-proxy`.
  //     Kept whole so a Vertex Live outage is a one-constant redeploy
  //     rather than a rewrite. Mints a Developer-API ephemeral token via
  //     the sidecar and returns that response 1:1.
  if (TRANSPORT === 'developer-api') {
    try {
      const session = await callSidecarVidyaVoiceStartSession(sidecarRequest);
      return NextResponse.json(session);
    } catch (error) {
      if (error instanceof VidyaVoiceSidecarConfigError) {
        logger.error('VIDYA voice sidecar misconfigured', error, 'VIDYA_VOICE');
        return NextResponse.json(
          { error: 'Live voice is not available right now' },
          { status: 503 },
        );
      }
      if (error instanceof VidyaVoiceSidecarTimeoutError) {
        logger.error('VIDYA voice sidecar timed out', error, 'VIDYA_VOICE');
        return NextResponse.json(
          { error: 'Live voice session timed out, please try again' },
          { status: 504 },
        );
      }
      if (error instanceof VidyaVoiceSidecarHttpError) {
        // Surface the sidecar's status class without leaking its body.
        logger.error(
          `VIDYA voice sidecar HTTP ${error.status}`,
          error,
          'VIDYA_VOICE',
        );
        const status = error.status >= 500 ? 502 : error.status;
        return NextResponse.json(
          { error: 'Could not start a live voice session' },
          { status },
        );
      }
      logger.error('VIDYA voice start-session failed', error, 'VIDYA_VOICE');
      return NextResponse.json(
        { error: 'Could not start a live voice session' },
        { status: 500 },
      );
    }
  }

  // 5b. Vertex proxy — the shipping path. The body is validated above so
  //     a malformed payload still fails the same way it did when the
  //     sidecar mint consumed it; the proxy only needs uid + language,
  //     but the client contract must not silently loosen.
  const baseUrl = process.env[BASE_URL_ENV];
  if (!baseUrl) {
    logger.error(`${BASE_URL_ENV} is not set`, undefined, 'VIDYA_VOICE');
    return NextResponse.json(
      { error: 'Live voice is not available right now' },
      { status: 503 },
    );
  }

  try {
    const { token, expiresInSeconds } = await mintStreamToken(uid);
    return NextResponse.json({
      mode: 'vertex-proxy',
      wsUrl: toStreamWsUrl(baseUrl),
      streamToken: token,
      expiresInSeconds,
      languageCode:
        sidecarRequest.detectedLanguage ??
        sidecarRequest.teacherProfile.preferredLanguage ??
        'en',
    });
  } catch (error) {
    logger.error('VIDYA voice start-session failed', error, 'VIDYA_VOICE');
    return NextResponse.json(
      { error: 'Could not start a live voice session' },
      { status: 500 },
    );
  }
}
