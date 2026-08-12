import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import {
  callSidecarVidyaVoiceStartSession,
  VidyaVoiceSidecarConfigError,
  VidyaVoiceSidecarHttpError,
  VidyaVoiceSidecarTimeoutError,
  type SidecarVidyaVoiceStartRequest,
} from '@/lib/sidecar/vidya-voice-client';

/**
 * VIDYA voice (Gemini Live) — mint an ephemeral session token.
 *
 * POST /api/vidya-voice/start-session
 *   Proxies to the `sahayakai-agents` sidecar's
 *   `POST /v1/vidya-voice/start-session`, which mints a short-lived
 *   Gemini Live token bound to this teacher's Live config and returns
 *   it plus the WSS URL the OmniOrb client opens directly. Audio bytes
 *   flow client ↔ Google; neither this route nor the sidecar sees audio.
 *
 * Auth: middleware verifies the Firebase ID token and injects
 *   `x-user-id` — the same gate as every other authenticated route.
 *
 * Feature-flagged: `VIDYA_VOICE_LIVE_ENABLED` must be `"true"`. When
 *   OFF (the default) this returns 503 and the client stays on the
 *   existing turn-based STT → classifier → TTS pipeline. Gemini Live
 *   is strictly additive — the TTS/STT path is never removed.
 *
 * Runtime: Node. The sidecar client needs `google-auth-library` (OIDC)
 *   and `node:crypto` (HMAC body digest) — neither runs on the edge.
 */
export const runtime = 'nodejs';

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

  // 3. Parse + validate the body. The sidecar re-validates with
  //    `extra="forbid"`, so we forward ONLY the allowed keys.
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

  // 4. Mint via the sidecar; return the response 1:1.
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
