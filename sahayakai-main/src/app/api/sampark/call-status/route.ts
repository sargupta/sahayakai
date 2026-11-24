/**
 * POST /api/sampark/call-status — Exotel status callback for Sampark calls.
 *
 * Logs call status changes (initiated, ringing, answered, completed, failed).
 * Does not return sensitive data.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

interface ExotelStatusBody {
    CallSid?: unknown;
    CallStatus?: unknown;
    To?: unknown;
    From?: unknown;
    Direction?: unknown;
    Duration?: unknown;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<NextResponse> {
    const body = (await req.json().catch(() => ({}))) as ExotelStatusBody;
    const { CallSid, CallStatus, To, From, Direction, Duration } = body;

    logger.info('[sampark/call-status] Exotel callback', 'SAMPARK', {
        callSid: typeof CallSid === 'string' ? CallSid : null,
        status: typeof CallStatus === 'string' ? CallStatus : null,
        to: typeof To === 'string' ? To : null,
        from: typeof From === 'string' ? From : null,
        direction: typeof Direction === 'string' ? Direction : null,
        duration: typeof Duration === 'number' ? Duration : null,
    });

    return NextResponse.json({ received: true });
}