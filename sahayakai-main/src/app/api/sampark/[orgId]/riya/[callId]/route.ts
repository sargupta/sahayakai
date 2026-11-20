/**
 * GET /api/sampark/[orgId]/riya/[callId] — one Riya call: status, provider ids (masked
 * agent ids), duration, failure reason, the answers the agent collected and, only when
 * this deployment stores transcripts (SAMPARK_RIYA_STORE_TRANSCRIPTS), the transcript
 * until it expires. Never a phone number.
 * Auth:   x-user-id (401) + requireOrgAdmin (403). Flags as the other Riya routes.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getRiyaCall, riyaDeps } from '@/server/sampark/conversation';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { DocIdSchema, errorResponse, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; callId: string }> }) {
    const p = await params;
    const guard = await guardRiyaRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.callId);
    if (!id.success) return invalidRequest(id.error);
    try {
        return NextResponse.json(await getRiyaCall(await riyaDeps(await samparkContext()), guard.orgId, id.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_RIYA_CALL');
    }
}
