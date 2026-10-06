/**
 * POST|GET /api/webhooks/sampark-voice/status?kind=ring|hangup&t=<sampark-status token>
 *
 * Vobiz's ring and hangup callbacks for a Sampark notice call.
 *
 * Input:  t, kind (query, both set by us when the carrier built the URLs);
 *         CallUUID, HangupCause or Status/CallStatus, Duration, BillDuration
 *         (form or JSON body, or query — Vobiz's docs show both encodings).
 * Output: 200 { ok: true } — including for a bad or expired token (logged, nothing
 *         changes) and for retried or duplicated callbacks (idempotent). 500 only
 *         when our own storage failed, so Vobiz's retry can finish the job.
 * Auth:   the signed token. Public prefix /api/webhooks/.
 * Flags:  SAMPARK_ENABLED !== 'true' → 404.
 * Cost:   one call transaction; on hangup, settleCall (intent, suppression, campaign counts).
 * Done:   the call log shows how the call ended and the intent has moved on.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { samparkContext, samparkDisabledResponse } from '@/server/sampark/http';
import { handleSamparkStatus, readVoiceFields } from '@/server/sampark/voice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function status(req: NextRequest): Promise<NextResponse> {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    try {
        const fields = await readVoiceFields(req);
        await handleSamparkStatus(await samparkContext(), {
            token: req.nextUrl.searchParams.get('t'),
            kind: req.nextUrl.searchParams.get('kind'),
            fields,
        });
        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
        logger.error('Sampark status webhook failed', err, 'SAMPARK_VOICE');
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}

export const GET = status;
export const POST = status;
