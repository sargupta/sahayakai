/**
 * PUT /api/sampark/[orgId]/pause — pause or resume every call the school makes (H3).
 *
 * Input:  { paused: true, reason: string (1–200, staff-only, never spoken), scope?: 'all' | 'routine' }
 *         { paused: false }
 *           all     → no call starts (default);
 *           routine → no call starts except emergency closures.
 *         Pausing without a reason is 400 INVALID_REQUEST.
 * Output: SamparkSchoolView (see the school route), whose `pause` says who paused, when,
 *         why and the scope, or is null once resumed.
 * Effect: the dispatcher holds every campaign the pause covers; calls still ringing are
 *         hung up (a call already speaking finishes its message). Pausing again with the
 *         same reason and scope, or resuming a school that is not paused, changes nothing.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read, at most 1 write + 1 audit write; pausing also reads the school's latest
 *         1,000 calls and asks the carrier to end each ringing one (one audit write each).
 * Done:   a principal can stop the school's calls in one request, without a deploy.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, parseBody, samparkContext } from '@/server/sampark/http';
import { PauseSchema, schoolView, setSchoolPause } from '@/server/sampark/school';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, PauseSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(schoolView(await setSchoolPause(await samparkContext(), guard.orgId, guard.uid, body.data)));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_PAUSE');
    }
}
