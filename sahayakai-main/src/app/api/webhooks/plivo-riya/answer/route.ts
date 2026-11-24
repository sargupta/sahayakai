/**
 * POST /api/webhooks/plivo-riya/answer?t=<token> — Plivo asks what to do with an answered Sampark
 * Riya call. Returns a <Stream> to the SahayakAI bridge for that ONE call, or <Hangup/> (bad
 * token or signature, unknown or settled call, school paused). See server/sampark/plivo-riya.ts.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { riyaDeps } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';
import { handlePlivoRiyaAnswer } from '@/server/sampark/plivo-riya';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HANGUP = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';

export async function POST(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const form: Record<string, string> = {};
        try {
            for (const [k, v] of (await req.formData()).entries()) if (typeof v === 'string') form[k] = v;
        } catch {
            // Plivo sends a form; anything else still gets an answer (and fails the signature).
        }
        const out = await handlePlivoRiyaAnswer(await riyaDeps(await samparkContext()), {
            pathAndQuery: `${url.pathname}${url.search}`,
            form,
            signature: req.headers.get('x-plivo-signature-v3'),
            nonce: req.headers.get('x-plivo-signature-v3-nonce'),
        });
        return new NextResponse(out.xml, { status: out.status, headers: { 'content-type': 'application/xml', 'cache-control': 'no-store' } });
    } catch (err) {
        logger.error('Plivo Riya answer failed', err, 'SAMPARK_PLIVO_RIYA');
        return new NextResponse(HANGUP, { status: 200, headers: { 'content-type': 'application/xml' } });
    }
}
