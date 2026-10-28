/**
 * GET /api/sampark/[orgId]/google-calendar/calendars — calendars the connected
 *     account OWNS (the scope only allows changing those), with the selected one.
 * PUT { calendarId } — choose the school's calendar; restarts sync and push for it.
 * Auth: x-user-id (401) + requireOrgAdmin (403). Sampark flag (404).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { googleCalendarDeps, listCalendarChoices, selectCalendar } from '@/server/sampark/google-calendar';
import { errorResponse, guardOrgRoute, parseBody } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SelectSchema = z.object({ calendarId: z.string().min(1).max(512) }).strict();

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json({ calendars: await listCalendarChoices(await googleCalendarDeps(), guard.orgId) });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_CALENDARS');
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, SelectSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(await selectCalendar(await googleCalendarDeps(), guard.orgId, body.data.calendarId));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_GCAL_SELECT');
    }
}
