/**
 * GET  /api/sampark/[orgId]/google-calendar/events?from=ISO&to=ISO — occurrences in
 *      [from, to) (at most 100 days), read live from the school's Google calendar.
 * POST CreateEventSchema — create an event (optionally repeating). Idempotent on
 *      `requestId`: a retried create returns the same event (201 created / 200 existing).
 * Auth: x-user-id (401) + requireOrgAdmin (403). Sampark flag (404).
 * A calendar event never creates or triggers a phone call.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { CreateEventSchema } from '@/lib/sampark/google-calendar/types';
import { createGoogleEvent, googleCalendarDeps, listGoogleEvents } from '@/server/sampark/google-calendar';
import { errorResponse, guardOrgRoute, invalidRequest, parseBody } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Instant = z.string().datetime({ offset: true });
const RangeSchema = z.object({ from: Instant, to: Instant });

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const url = new URL(req.url);
    const q = RangeSchema.safeParse({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
    if (!q.success) return invalidRequest(q.error);
    try {
        return NextResponse.json(await listGoogleEvents(await googleCalendarDeps(), guard.orgId, new Date(q.data.from), new Date(q.data.to)));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_EVENTS');
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, CreateEventSchema);
    if ('response' in body) return body.response;
    try {
        const result = await createGoogleEvent(await googleCalendarDeps(), guard.orgId, guard.uid, body.data);
        return NextResponse.json(result, { status: result.created ? 201 : 200 });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_CREATE');
    }
}
