/**
 * POST /api/webhooks/vobiz-riya/event — the SahayakAI bridge's post-call result for one Sampark
 * Riya call (HMAC `x-riya-bridge-signature: t=..,v1=..` over "<t>.<body>"). Applied through the
 * same idempotent reducer as the ElevenLabs post-call webhook.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { MAX_WEBHOOK_BYTES } from '@/lib/sampark/conversation/webhook';
import { riyaDeps } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';
import { handleVobizRiyaEvent } from '@/server/sampark/vobiz-riya';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
    try {
        const raw = await req.text();
        const out = await handleVobizRiyaEvent(await riyaDeps(await samparkContext()), raw, req.headers.get('x-riya-bridge-signature'));
        return NextResponse.json(out.body, { status: out.status });
    } catch (err) {
        logger.error('Vobiz Riya event failed', err, 'SAMPARK_VOBIZ_RIYA');
        // 500 → the bridge retries; the reducer makes a retry harmless.
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

/** Health: the console checks this before a real Vobiz call (signature check configured, feature on). */
export async function GET() {
    const on = process.env.SAMPARK_ENABLED === 'true' && process.env.SAMPARK_ELEVENLABS_ENABLED === 'true' && process.env.SAMPARK_VOBIZ_RIYA_ENABLED === 'true';
    if (!on) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const ready = Boolean(process.env.SAHAYAKAI_REQUEST_SIGNING_KEY?.trim());
    return NextResponse.json({ ok: ready, signatureCheck: ready }, { status: ready ? 200 : 503, headers: { 'cache-control': 'no-store' } });
}
