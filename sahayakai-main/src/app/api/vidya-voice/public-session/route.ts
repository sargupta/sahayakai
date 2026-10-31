/**
 * POST /api/vidya-voice/public-session — anonymous VIDYA voice on the landing page.
 *
 * Mints a PUBLIC stream token for the sidecar's `/v1/vidya-voice/stream`
 * socket. Unlike `/start-session` it needs no sign-in, and the token it
 * returns is scoped by the sidecar to a demo conversation: the same real
 * ADK / Gemini Live voice, but NO tools, NO teacher profile, NO app context
 * (enforced in sahayakai-agents `router.py` / `adk_live.py`, not here).
 *
 * Gates (fail closed, all return the same 503 a teacher would see):
 *   - `VIDYA_VOICE_PUBLIC_ENABLED === 'true'` (default off)
 *   - per-IP sliding-window limit (in-process; the sidecar adds its own
 *     public concurrency pool + 3-minute session cap)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { mintPublicStreamToken } from '@/lib/sidecar/signing';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const BASE_URL_ENV = 'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL';
const STREAM_PATH = '/v1/vidya-voice/stream';
const MAX_PER_IP_PER_HOUR = 6;
const WINDOW_MS = 60 * 60 * 1000;
const opensByIp = new Map<string, number[]>();

const ALLOWED_LANGS = new Set(['en', 'hi', 'kn', 'ta', 'te', 'mr', 'bn', 'gu', 'pa', 'ml', 'or']);

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'local').trim();
}

function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (opensByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_IP_PER_HOUR) {
    opensByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  opensByIp.set(ip, recent);
  if (opensByIp.size > 10_000) opensByIp.clear(); // bound memory under a flood
  return true;
}

function unavailable() {
  return NextResponse.json({ error: 'Live voice is not available right now' }, { status: 503 });
}

export async function POST(request: NextRequest) {
  if (process.env.VIDYA_VOICE_PUBLIC_ENABLED !== 'true') return unavailable();

  const baseUrl = process.env[BASE_URL_ENV];
  if (!baseUrl) {
    logger.error(`${BASE_URL_ENV} is not set`, undefined, 'VIDYA_VOICE');
    return unavailable();
  }
  if (!allow(clientIp(request))) {
    return NextResponse.json({ error: 'Please try again a little later' }, { status: 429 });
  }

  let language = 'en';
  try {
    const body = (await request.json()) as { detectedLanguage?: unknown };
    if (typeof body?.detectedLanguage === 'string' && ALLOWED_LANGS.has(body.detectedLanguage)) {
      language = body.detectedLanguage;
    }
  } catch {
    /* empty / malformed body → English */
  }

  try {
    const { token, expiresInSeconds } = await mintPublicStreamToken();
    const wsUrl = `${baseUrl.replace(/\/+$/, '').replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')}${STREAM_PATH}`;
    return NextResponse.json({ mode: 'public', wsUrl, streamToken: token, expiresInSeconds, languageCode: language });
  } catch (error) {
    logger.error('VIDYA public voice session failed', error, 'VIDYA_VOICE');
    return NextResponse.json({ error: 'Could not start a live voice session' }, { status: 500 });
  }
}
