/**
 * GET /api/sampark/[orgId]/calendar?from=ISO&to=ISO — the school's schedule in [from, to)
 * (at most 62 days): callbacks and staff-scheduled calls, campaign calls, the PTMs /
 * events / closures campaigns announce, and holidays, as one typed event list with a
 * de-duplicated summary. Read-only; edits go through the callback and campaign routes.
 * Output: CalendarResponse (src/server/sampark/calendar.ts). Never a phone number
 * beyond its last four digits.
 * Auth:   x-user-id (401) + requireOrgAdmin (403). Sampark flag (404). Callbacks are
 *         included only when Riya is on (`sources.callbacks`).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { CalendarQuerySchema, loadCalendar } from '@/server/sampark/calendar';
import { errorResponse, guardOrgRoute, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const url = new URL(req.url);
    const q = CalendarQuerySchema.safeParse({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
    if (!q.success) return invalidRequest(q.error);
    try {
        return NextResponse.json(await loadCalendar(await samparkContext(), guard.orgId, q.data.from, q.data.to));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALENDAR');
    }
}
