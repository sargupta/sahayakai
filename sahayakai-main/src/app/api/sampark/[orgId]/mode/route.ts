/**
 * PUT /api/sampark/[orgId]/mode — change the school's calling mode.
 *
 * Input:  { mode: 'practice' | 'test' | 'live' }
 * Output: SamparkSchoolView (see the school route). Phase 2a:
 *           practice → always allowed;
 *           test     → 409 { error: 'LIVE_DIAL_DISABLED' | 'PUBLIC_BASE_URL_MISSING'
 *                      | 'CARRIER_UNCONFIGURED' } when this deployment cannot place
 *                      real calls (liveDialBlocker), 409 TEST_PHONE_MISSING when no
 *                      test phone is saved; otherwise every call rings only that phone;
 *           live     → 409 { error: 'LIVE_MODE_NOT_AVAILABLE' } — no parent can be
 *                      called in this phase.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read, at most 1 write + 1 audit write (every change is audited).
 * Done:   no request can move a school to live; test needs the deployment and a phone.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, parseBody, samparkContext } from '@/server/sampark/http';
import { ModeSchema, schoolView, setSchoolMode } from '@/server/sampark/school';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, ModeSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(schoolView(await setSchoolMode(await samparkContext(), guard.orgId, guard.uid, body.data.mode)));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_MODE');
    }
}
