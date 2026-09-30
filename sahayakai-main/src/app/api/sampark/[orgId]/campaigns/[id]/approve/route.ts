/**
 * POST /api/sampark/[orgId]/campaigns/[id]/approve — approve a draft.
 *
 * Input:  none.
 * Output: Campaign, now 'rendering' (draft → rendering). The render job then
 *         renders and verifies the audio, materialises one intent per guardian
 *         of record and schedules it; nothing is dialled by this request.
 *         An audit entry records who approved and what they saw.
 * Auth:   x-user-id (401) + requireOrgAdmin (403) — the org admin stands in
 *         for the principal/coordinator in slice 1.
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read + 1 update + 1 audit write.
 * Done:   409 for anything but a draft, or an expired campaign.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { approveCampaign } from '@/server/sampark/campaigns';
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
        return NextResponse.json(await approveCampaign(await samparkContext(), guard.orgId, id.data, guard.uid));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_APPROVE');
    }
}
