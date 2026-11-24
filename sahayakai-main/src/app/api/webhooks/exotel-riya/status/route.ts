/**
 * POST /api/webhooks/exotel-riya/status?t=<token> — Exotel's StatusCallback for one Sampark Riya
 * call (we ask for JSON; a form body is read too). The token is the authentication (Exotel does not
 * sign callbacks). Always 200 within Exotel's 15 s: it retries otherwise, and the reducer is
 * idempotent anyway. See server/sampark/exotel-riya.ts.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { readBodyCapped } from '@/lib/http/read-body-capped';
import { logger } from '@/lib/logger';
import { riyaDeps } from '@/server/sampark/conversation';
import { exotelStatusFields, handleExotelRiyaStatus } from '@/server/sampark/exotel-riya';
import { samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_STATUS_BYTES = 32 * 1024;

export async function POST(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const raw = await readBodyCapped(req, MAX_STATUS_BYTES);
        let body: unknown = null;
        if (raw) {
            const type = req.headers.get('content-type') ?? '';
            try {
                body = type.includes('json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
            } catch {
                body = null;
            }
        }
        await handleExotelRiyaStatus(await riyaDeps(await samparkContext()), url.searchParams.get('t'), exotelStatusFields(body));
    } catch (err) {
        logger.error('Exotel Riya status failed', err, 'SAMPARK_EXOTEL_RIYA');
    }
    return new NextResponse('OK', { status: 200 });
}
