/**
 * POST /api/sampark/[orgId]/riya/[callId]/review — a person records what they found about a
 * call whose outcome is unknown ({ note: 'did_not_ring' | 'rang' | 'cannot_tell' }). Only then
 * may the same announcement be sent to that family again. Nothing is re-dialled by this.
 * Auth:   x-user-id (401) + requireOrgAdmin (403). Flags as the other Riya routes.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { reviewRiyaCall, riyaDeps, RiyaReviewSchema } from '@/server/sampark/conversation';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { DocIdSchema, errorResponse, invalidRequest, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; callId: string }> }) {
    const p = await params;
    const guard = await guardRiyaRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.callId);
    if (!id.success) return invalidRequest(id.error);
    const body = await parseBody(req, RiyaReviewSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(await reviewRiyaCall(await riyaDeps(await samparkContext()), guard.orgId, id.data, guard.uid, body.data.note));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_RIYA_REVIEW');
    }
}
