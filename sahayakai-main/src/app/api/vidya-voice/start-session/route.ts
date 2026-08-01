import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { mintStreamToken } from '@/lib/sidecar/signing';

/**
 * VIDYA voice (Gemini Live via Vertex) — authorise a live-voice session.
 *
 * POST /api/vidya-voice/start-session
 *   Returns everything the OmniOrb client needs to open the sidecar's
 *   Vertex Live WebSocket proxy: the `wsUrl`, a short-lived signed
 *   `streamToken`, and the detected language. The client connects to
 *   `wsUrl?t=<streamToken>` and streams mic PCM up / receives model audio +
 *   tool-calls down. Vertex authenticates with the sidecar's own ADC — no
 *   Google credential ever reaches the client; only this opaque token, which
 *   the sidecar verifies (HMAC, expiring) before opening a billable session.
 *
 *   Why Vertex + a proxy (not the Developer-API ephemeral-token path): the
 *   Gemini Developer API's prepaid tier is unfunded here; Vertex AI Live is
 *   billed to Cloud Billing (startup credits). Vertex has no client-facing
 *   ephemeral token, so the sidecar terminates the socket.
 *
 * Auth: middleware verifies the Firebase ID token and injects `x-user-id`.
 * Feature-flagged: `VIDYA_VOICE_LIVE_ENABLED` must be `"true"`; OFF (default)
 *   returns 503 and the client stays on the turn-based STT/classifier/TTS
 *   pipeline (never removed).
 * Runtime: Node — `node:crypto` HMAC for the stream token.
 */
export const runtime = 'nodejs';

const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';
const STREAM_PATH = '/v1/vidya-voice/stream';
const MAX_LANG = 10;

function clampLang(v: unknown): string {
  if (typeof v !== 'string') return 'en';
  const t = v.trim().slice(0, MAX_LANG);
  return t.length === 0 ? 'en' : t;
}

/** Convert the sidecar https base URL to the wss stream endpoint. */
function toStreamWsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '').replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return `${base}${STREAM_PATH}`;
}

interface RawBody {
  detectedLanguage?: unknown;
  teacherProfile?: { preferredLanguage?: unknown } | null;
}

export async function POST(request: NextRequest) {
  const uid = request.headers.get('x-user-id');
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.VIDYA_VOICE_LIVE_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'Live voice is not available right now' },
      { status: 503 },
    );
  }

  const baseUrl = process.env[BASE_URL_ENV];
  if (!baseUrl) {
    logger.error(`${BASE_URL_ENV} is not set`, undefined, 'VIDYA_VOICE');
    return NextResponse.json(
      { error: 'Live voice is not available right now' },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as RawBody | null;
  const languageCode = clampLang(
    body?.detectedLanguage ?? body?.teacherProfile?.preferredLanguage,
  );

  try {
    const { token, expiresInSeconds } = await mintStreamToken(uid);
    return NextResponse.json({
      mode: 'vertex-proxy',
      wsUrl: toStreamWsUrl(baseUrl),
      streamToken: token,
      expiresInSeconds,
      languageCode,
    });
  } catch (error) {
    logger.error('VIDYA voice start-session failed', error, 'VIDYA_VOICE');
    return NextResponse.json(
      { error: 'Could not start a live voice session' },
      { status: 500 },
    );
  }
}
