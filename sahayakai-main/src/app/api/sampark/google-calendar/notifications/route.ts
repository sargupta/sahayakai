/**
 * POST /api/sampark/google-calendar/notifications — Google Calendar push
 * notifications (public: Google sends no user token; listed in middleware).
 *
 * The body is empty and nothing in the headers is trusted on its own: the channel id
 * must be known, its token must match the stored hash, the resource id must match,
 * the channel must be current for its school, and a repeated message number is
 * ignored. A valid notification triggers an incremental sync against the API.
 * Statuses: 200 handled/ignored, 403 bad token or resource, 404 unknown channel,
 * 500 sync failed (Google retries; the scheduler's fallback sync also covers it).
 * Flag: Sampark (404).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { googleCalendarDeps, handleGoogleNotification } from '@/server/sampark/google-calendar';
import { samparkDisabledResponse } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const disabled = samparkDisabledResponse();
    if (disabled) return disabled;
    try {
        const result = await handleGoogleNotification(await googleCalendarDeps(), (name) => req.headers.get(name));
        return new NextResponse(null, { status: result.status });
    } catch (err) {
        logger.error('Google Calendar notification failed', err, 'SAMPARK_GCAL_NOTIFY');
        return new NextResponse(null, { status: 500 });
    }
}
