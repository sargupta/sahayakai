/**
 * GET  /api/sampark/[orgId]/riya — Riya availability for this school and its latest calls.
 * POST /api/sampark/[orgId]/riya — start ONE Riya call to one family.
 *
 * POST input: { purpose, guardianId, studentId, facts | campaignId, idempotencyKey (uuid),
 *               confirmedAnnouncement, scenario? (Practice only) }
 *   The browser names WHO by record id only. The phone number, the names, the class
 *   and the school are resolved on the server from Sampark records; there is no way
 *   to send a phone number. In Test mode the call rings ONLY the school's test phone;
 *   Live mode is refused.
 * Output: GET  { availability: RiyaAvailability, calls: ConversationCallView[] }
 *         POST { call: ConversationCallView, duplicate: boolean } (201, or 200 for a repeat key)
 * Errors: 409 with a stable code (LIVE_MODE_NOT_AVAILABLE, GATE_BLOCKED, OUTSIDE_CALLING_HOURS,
 *         RIYA_CALL_IN_PROGRESS, UNRESOLVED_PREVIOUS_CALL, ANNOUNCEMENT_CHANGED, …).
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED and SAMPARK_ELEVENLABS_ENABLED === 'true' else 404.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { riyaDeps, riyaOverview, RiyaStartSchema, startRiyaCall } from '@/server/sampark/conversation';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { errorResponse, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await riyaOverview(await riyaDeps(await samparkContext()), guard.orgId));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_RIYA');
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, RiyaStartSchema);
    if ('response' in body) return body.response;
    try {
        const deps = await riyaDeps(await samparkContext());
        const result = await startRiyaCall(deps, guard.orgId, guard.uid, body.data);
        return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_RIYA_START');
    }
}
