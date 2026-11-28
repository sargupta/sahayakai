import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { igClient } from '@/lib/social/worker-client';

/**
 * Send a DM reply on Instagram.
 *
 *   channel: 'graph'      → only valid inside the 24h customer-service window (TODO Week 1)
 *   channel: 'instagrapi' → cold outreach DM via burner / personal-business account
 */

const Body = z.object({
    channel: z.enum(['graph', 'instagrapi']).default('instagrapi'),
    account: z.string().optional(),
    toUsername: z.string().min(1),
    text: z.string().min(1),
});

export async function POST(req: NextRequest) {
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { channel, account, toUsername, text } = parsed.data;

    if (channel === 'instagrapi') {
        if (!account) return NextResponse.json({ error: 'account_required' }, { status: 400 });
        try {
            const result = await igClient.dm(account, toUsername, text);
            return NextResponse.json(result);
        } catch (err) {
            const detail = err instanceof Error ? err.message : 'unknown';
            return NextResponse.json({ error: 'dm_failed', detail }, { status: 502 });
        }
    }
    return NextResponse.json({ error: 'graph_channel_not_yet_implemented' }, { status: 501 });
}
