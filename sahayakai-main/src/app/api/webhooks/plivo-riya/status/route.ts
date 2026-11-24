/**
 * POST /api/webhooks/plivo-riya/status?kind=ring|hangup&t=<token> — Plivo call progress for one
 * Sampark Riya call (token + X-Plivo-Signature-V3). A hangup that never connected settles the call
 * as an initiation failure; a connected call is settled by the bridge's post-call event instead.
 * Always 200: Plivo must not retry into a loop, and the reducer is idempotent anyway.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { riyaDeps } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';
import { handlePlivoRiyaStatus } from '@/server/sampark/plivo-riya';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const form: Record<string, string> = {};
        try {
            // Full values: the signature is computed over them. Only a few are read afterwards.
            for (const [k, v] of (await req.formData()).entries()) if (typeof v === 'string') form[k] = v;
        } catch {
            // no form body
        }
        await handlePlivoRiyaStatus(await riyaDeps(await samparkContext()), url.searchParams.get('kind'), {
            pathAndQuery: `${url.pathname}${url.search}`,
            form,
            signature: req.headers.get('x-plivo-signature-v3'),
            nonce: req.headers.get('x-plivo-signature-v3-nonce'),
        });
    } catch (err) {
        logger.error('Plivo Riya status failed', err, 'SAMPARK_PLIVO_RIYA');
    }
    return new NextResponse('OK', { status: 200 });
}
