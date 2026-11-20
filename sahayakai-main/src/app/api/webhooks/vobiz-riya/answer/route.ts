/**
 * POST /api/webhooks/vobiz-riya/answer?t=<token> — Vobiz asks what to do with an answered
 * Sampark Riya call. Returns a <Stream> to the SahayakAI bridge for that ONE call, or <Hangup/>
 * (bad token, unknown or settled call, school paused). See server/sampark/vobiz-riya.ts.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { riyaDeps } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';
import { handleVobizRiyaAnswer } from '@/server/sampark/vobiz-riya';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HANGUP = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';

export async function POST(req: NextRequest) {
    try {
        const url = new URL(req.url);
        let callUuid: string | null = null;
        try {
            const form = await req.formData();
            callUuid = String(form.get('CallUUID') ?? form.get('call_uuid') ?? '') || null;
        } catch {
            // Vobiz sends a form; anything else still gets an answer.
        }
        const out = await handleVobizRiyaAnswer(await riyaDeps(await samparkContext()), url.searchParams.get('t'), callUuid);
        return new NextResponse(out.xml, { status: out.status, headers: { 'content-type': 'application/xml', 'cache-control': 'no-store' } });
    } catch (err) {
        logger.error('Vobiz Riya answer failed', err, 'SAMPARK_VOBIZ_RIYA');
        return new NextResponse(HANGUP, { status: 200, headers: { 'content-type': 'application/xml' } });
    }
}
