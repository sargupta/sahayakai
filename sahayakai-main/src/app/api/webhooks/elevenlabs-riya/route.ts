/**
 * POST /api/webhooks/elevenlabs-riya — ElevenLabs post-call webhooks for the Riya agent
 * (post_call_transcription, call_initiation_failure; audio is not subscribed).
 *
 * Public by path (/api/webhooks/ is a public prefix in middleware.ts); authenticated
 * in-handler by the ElevenLabs HMAC signature (ELEVENLABS_WEBHOOK_SECRET) with a 30-minute
 * replay window, then matched to OUR call through a create-only link and our agent id.
 * The raw body is read once, size-bounded, and verified before it is parsed.
 *
 * Responses: 200 applied, duplicate, ignored or not ours · 401 bad signature · 400 unreadable ·
 *            413 too large · 503 not yet linked (young event; ElevenLabs retries) or unconfigured ·
 *            404 when SAMPARK_ENABLED or SAMPARK_ELEVENLABS_ENABLED is off.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { MAX_WEBHOOK_BYTES } from '@/lib/sampark/conversation/webhook';
import { handleRiyaWebhook, riyaDeps } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    if (process.env.SAMPARK_ENABLED !== 'true' || process.env.SAMPARK_ELEVENLABS_ENABLED !== 'true') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
    try {
        const raw = await req.text();
        if (Buffer.byteLength(raw, 'utf8') > MAX_WEBHOOK_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
        const outcome = await handleRiyaWebhook(await riyaDeps(await samparkContext()), raw, req.headers.get('elevenlabs-signature'));
        return NextResponse.json(outcome.body, { status: outcome.status });
    } catch (err) {
        logger.error('Riya webhook failed', err, 'SAMPARK_RIYA_WEBHOOK');
        // 500 → ElevenLabs retries; the reducer makes a retry harmless.
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

/**
 * GET — health check over the public URL, for the console's pre-call checklist and the deploy
 * smoke test: 200 when Riya is on and a webhook secret is configured (signature checking will
 * run), 503 when the secret is missing, 404 when the flags are off. Reveals nothing else.
 */
export async function GET() {
    if (process.env.SAMPARK_ENABLED !== 'true' || process.env.SAMPARK_ELEVENLABS_ENABLED !== 'true') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const ready = Boolean(process.env.ELEVENLABS_WEBHOOK_SECRET?.trim());
    return NextResponse.json({ ok: ready, signatureCheck: ready }, { status: ready ? 200 : 503, headers: { 'cache-control': 'no-store' } });
}
