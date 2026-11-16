/**
 * POST|GET /api/webhooks/sampark-voice/gather?t=<sampark-gather-menu | sampark-gather-optout token>
 *
 * Vobiz posts the parent's keypress here (the Gather action of the answer or
 * opt-out document).
 *
 * Input:  t (query) — single-use gather token; its DOMAIN says which prompt was
 *         answered (menu or opt-out confirmation); Digits, CallUUID (form / JSON body or query).
 * Output: call-control XML, ALWAYS HTTP 200 — the confirmation clip, the opt-out
 *         confirmation prompt, or EMPTY_HANGUP_XML (replayed token, call already
 *         ended, kill switch off, no verified audio).
 * Auth:   the signed, single-use token. Public prefix /api/webhooks/.
 * Flags:  SAMPARK_ENABLED !== 'true' → EMPTY_HANGUP_XML.
 * Cost:   one token burn, one call transaction, school + campaign + up to two clip reads.
 * Done:   the key is on the call record (a 9 even if it arrived after the hangup)
 *         and the parent hears the matching reply.
 */

import type { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { EMPTY_HANGUP_XML } from '@/lib/sampark/voice/xml';
import { samparkContext } from '@/server/sampark/http';
import { handleSamparkGather, readVoiceFields, samparkVoiceEnabled, voiceXmlResponse } from '@/server/sampark/voice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function gather(req: NextRequest): Promise<NextResponse> {
    if (!samparkVoiceEnabled()) return voiceXmlResponse(EMPTY_HANGUP_XML);
    try {
        const fields = await readVoiceFields(req);
        const result = await handleSamparkGather(await samparkContext(), {
            token: req.nextUrl.searchParams.get('t'),
            digits: fields.Digits ?? null,
            callUuid: fields.CallUUID?.trim() || null,
        });
        return voiceXmlResponse(result.xml);
    } catch (err) {
        logger.error('Sampark gather webhook failed; hanging up', err, 'SAMPARK_VOICE');
        return voiceXmlResponse(EMPTY_HANGUP_XML);
    }
}

export const GET = gather;
export const POST = gather;
