/**
 * POST /api/sampark/[orgId]/campaigns/[id]/cancel — stop a campaign.
 *
 * Input:  none.
 * Output: Campaign ('cancelled'). Every intent still waiting (approved /
 *         retry_wait) becomes 'cancelled'; a call already in progress is left
 *         to finish and be recorded.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read + 1 update + 1 write per waiting intent + 1 audit write.
 * Done:   409 for a completed or already-cancelled campaign; the dispatcher
 *         places no further calls for it.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { cancelCampaign } from '@/server/sampark/campaigns';
import { DocIdSchema, errorResponse, guardOrgRoute, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
    const p = await params;
    const guard = await guardOrgRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.id);
    if (!id.success) return invalidRequest(id.error);
    try {
        return NextResponse.json(await cancelCampaign(await samparkContext(), guard.orgId, id.data, guard.uid));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CANCEL');
    }
}
