/**
 * POST|GET /api/webhooks/sampark-voice/answer?t=<sampark-answer token>
 *
 * Vobiz fetches this when the callee picks up a Sampark notice call.
 *
 * Input:  t (query) — the answer token minted at dial time for `${orgId}~${callId}`;
 *         CallUUID (form / JSON body or query).
 * Output: call-control XML, ALWAYS HTTP 200 — the message inside a one-key
 *         Gather, or EMPTY_HANGUP_XML when anything says the call may not speak
 *         (flags, Test mode, calling window, campaign, suppression, verified audio).
 * Auth:   the signed token (Vobiz does not sign callbacks). Public prefix /api/webhooks/.
 * Flags:  SAMPARK_ENABLED !== 'true' → EMPTY_HANGUP_XML, so a call in flight hangs up cleanly.
 * Cost:   reads school, call, campaign and two clip records; one call transaction.
 * Done:   the parent hears the message and can press 1, 2 or 9.
 *
 * Every URL in the XML comes from SAMPARK_PUBLIC_BASE_URL (server/sampark/voice.ts),
 * never from this request's Host header.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { EMPTY_HANGUP_XML } from '@/lib/sampark/voice/xml';
import { samparkContext } from '@/server/sampark/http';
import { handleSamparkAnswer, readVoiceFields, samparkVoiceEnabled, voiceXmlResponse } from '@/server/sampark/voice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function answer(req: NextRequest): Promise<NextResponse> {
    if (!samparkVoiceEnabled()) return voiceXmlResponse(EMPTY_HANGUP_XML);
    try {
        const fields = await readVoiceFields(req);
        const result = await handleSamparkAnswer(await samparkContext(), {
            token: req.nextUrl.searchParams.get('t'),
            callUuid: fields.CallUUID?.trim() || null,
        });
        return voiceXmlResponse(result.xml);
    } catch (err) {
        logger.error('Sampark answer webhook failed; hanging up', err, 'SAMPARK_VOICE');
        return voiceXmlResponse(EMPTY_HANGUP_XML);
    }
}

export const GET = answer;
export const POST = answer;
