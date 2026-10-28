/**
 * GET    /api/sampark/[orgId]/google-calendar — the school's Google Calendar status
 *        (GoogleCalendarStatus: configured, state, account, chosen calendar, sync and
 *        push health). Never a token; missing configuration is named, never shown.
 * DELETE /api/sampark/[orgId]/google-calendar — disconnect: stop the push channel,
 *        revoke the refresh token at Google, delete the connection and synced copy.
 * Auth:  x-user-id (401) + requireOrgAdmin (403). Sampark flag (404).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { disconnectGoogleCalendar, getGoogleCalendarStatus, googleCalendarDeps } from '@/server/sampark/google-calendar';
import { errorResponse, guardOrgRoute } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await getGoogleCalendarStatus(await googleCalendarDeps(), guard.orgId));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_STATUS');
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await disconnectGoogleCalendar(await googleCalendarDeps(), guard.orgId));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_DISCONNECT');
    }
}
