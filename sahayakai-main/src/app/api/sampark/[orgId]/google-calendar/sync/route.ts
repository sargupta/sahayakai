/**
 * POST /api/sampark/[orgId]/google-calendar/sync — "Sync now": an incremental sync
 * (full when Google's sync token expired) of the school's calendar. The manual path
 * when push notifications are not available (e.g. on localhost).
 * Output: SyncReport { full, changed, removed }.
 * Auth: x-user-id (401) + requireOrgAdmin (403). Sampark flag (404).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { googleCalendarDeps, syncGoogleCalendar } from '@/server/sampark/google-calendar';
import { errorResponse, guardOrgRoute } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await syncGoogleCalendar(await googleCalendarDeps(), guard.orgId));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_SYNC');
    }
}
