/**
 * PUT /api/sampark/[orgId]/mode — change the school's calling mode.
 *
 * Input:  { mode: 'practice' | 'test' | 'live' }
 * Output: SamparkSchool. Slice 1: anything but 'practice' → 409
 *         { error: 'LIVE_DIAL_DISABLED' } — there is no real carrier yet, and
 *         SAMPARK_LIVE_DIAL_ENABLED stays false in cloudbuild.yaml.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read, at most 1 write + 1 audit write.
 * Done:   no request can move a school off practice mode in this release.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, parseBody, samparkContext } from '@/server/sampark/http';
import { ModeSchema, setSchoolMode } from '@/server/sampark/school';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, ModeSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(await setSchoolMode(await samparkContext(), guard.orgId, guard.uid, body.data.mode));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_MODE');
    }
}
