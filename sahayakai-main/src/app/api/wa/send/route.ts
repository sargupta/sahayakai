import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { baileysClient } from '@/lib/social/worker-client';

/**
 * Outbound WhatsApp dispatch.
 *
 *   channel: 'byo'   → teacher's own number via Baileys worker
 *   channel: 'brand' → SahayakAI brand number via Meta Cloud API (TODO Week 1)
 *
 * Auth: relies on the project's existing middleware that injects
 * `x-user-id` after Firebase ID-token verification.
 */

const Body = z.object({
    channel: z.enum(['byo', 'brand']).default('byo'),
    to: z.string().min(8),
    text: z.string().optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(['image', 'audio', 'document', 'video']).optional(),
    caption: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const teacherUid = req.headers.get('x-user-id');
    if (!teacherUid) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { channel, ...args } = parsed.data;

    try {
        if (channel === 'byo') {
            const result = await baileysClient.send({ teacherUid, ...args });
            return NextResponse.json(result);
        }
        // TODO Week 1: Meta Cloud API path.
        return NextResponse.json({ error: 'brand_channel_not_yet_implemented' }, { status: 501 });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        // Worker returns 429 for cap-reached — surface it through.
        const status = /\b429\b/.test(message) ? 429 : 502;
        return NextResponse.json({ error: 'send_failed', detail: message }, { status });
    }
}
