/**
 * POST /api/webhooks/vobiz-riya/status?kind=ring|hangup&t=<token> — Vobiz call progress for one
 * Sampark Riya call. A hangup that never connected (busy, no answer) settles the call as an
 * initiation failure; a connected call is settled by the bridge's post-call event instead.
 * Always 200: Vobiz must not retry into a loop, and the reducer is idempotent anyway.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { riyaDeps } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';
import { handleVobizRiyaStatus } from '@/server/sampark/vobiz-riya';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const form: Record<string, string> = {};
        try {
            for (const [k, v] of (await req.formData()).entries()) if (typeof v === 'string') form[k] = v.slice(0, 200);
        } catch {
            // no form body
        }
        await handleVobizRiyaStatus(await riyaDeps(await samparkContext()), url.searchParams.get('t'), url.searchParams.get('kind'), form);
    } catch (err) {
        logger.error('Vobiz Riya status failed', err, 'SAMPARK_VOBIZ_RIYA');
    }
    return new NextResponse('OK', { status: 200 });
}
