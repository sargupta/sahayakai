/**
 * POST /api/sampark/[orgId]/riya/[callId]/reconcile — ask ElevenLabs for the conversation's
 * final status when its post-call webhook has not arrived. Read-only at the provider; never
 * dials. Only a final provider status ('done', 'failed') changes the call.
 * Auth:   x-user-id (401) + requireOrgAdmin (403). Flags as the other Riya routes.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { reconcileRiyaCall, riyaDeps } from '@/server/sampark/conversation';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { DocIdSchema, errorResponse, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; callId: string }> }) {
    const p = await params;
    const guard = await guardRiyaRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.callId);
    if (!id.success) return invalidRequest(id.error);
    try {
        return NextResponse.json(await reconcileRiyaCall(await riyaDeps(await samparkContext()), guard.orgId, id.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_RIYA_RECONCILE');
    }
}
