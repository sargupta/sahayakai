/**
 * GET /api/webhooks/vobiz-riya/context?t=<token> — the SahayakAI bridge fetches ONE Sampark call's
 * Riya variables (server-to-server; the token is signed with the key only the bridge and this app
 * hold). Never cached. 404 for anything that is not a live Vobiz call.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { riyaDeps } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';
import { handleVobizRiyaContext } from '@/server/sampark/vobiz-riya';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const out = await handleVobizRiyaContext(await riyaDeps(await samparkContext()), new URL(req.url).searchParams.get('t'));
        return NextResponse.json(out.body, { status: out.status, headers: { 'cache-control': 'no-store' } });
    } catch (err) {
        logger.error('Vobiz Riya context failed', err, 'SAMPARK_VOBIZ_RIYA');
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
