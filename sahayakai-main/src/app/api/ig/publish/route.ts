import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { igClient } from '@/lib/social/worker-client';

/**
 * Publish an IG post.
 *
 *   channel: 'graph'      → @sahayakai brand handle via Instagram Graph API (TODO Week 1)
 *   channel: 'instagrapi' → burner / personal-business account via ig-worker
 *
 * Admin-only — restrict via existing admin middleware before merging
 * to develop.
 */

const Body = z.object({
    channel: z.enum(['graph', 'instagrapi']).default('graph'),
    account: z.string().optional(),
    mediaUrl: z.string().url(),
    caption: z.string(),
    kind: z.enum(['photo', 'reel', 'story']).default('photo'),
});

export async function POST(req: NextRequest) {
    const uid = req.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { channel, account, mediaUrl, caption, kind } = parsed.data;

    if (channel === 'instagrapi') {
        if (!account) return NextResponse.json({ error: 'account_required' }, { status: 400 });
        try {
            const result = await igClient.post(account, mediaUrl, caption, kind);
            return NextResponse.json(result);
        } catch (err) {
            const detail = err instanceof Error ? err.message : 'unknown';
            return NextResponse.json({ error: 'post_failed', detail }, { status: 502 });
        }
    }
    // TODO Week 1: Graph API publish (container → publish two-step).
    return NextResponse.json({ error: 'graph_channel_not_yet_implemented' }, { status: 501 });
}
