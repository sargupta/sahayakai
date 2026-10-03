/**
 * GET /api/sampark/[orgId]/campaigns/[id] — a campaign and its audience dry run.
 *
 * Input:  none.
 * Output: { campaign: Campaign, audience: { guardians, byLanguage, blocked } } —
 *         the materialise-stage gate evaluated for every guardian of record in
 *         the audience (the same bundling and gate the materialiser uses).
 *         NO writes.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   students + guardians + preferences + suppressions + ≤5000 recent calls.
 * Done:   the approver sees how many families will be called, in which
 *         languages, and how many are blocked and why, before approving.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getCampaignDetail } from '@/server/sampark/campaigns';
import { DocIdSchema, errorResponse, guardOrgRoute, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string; id: string }> }) {
    const p = await params;
    const guard = await guardOrgRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.id);
    if (!id.success) return invalidRequest(id.error);
    try {
        return NextResponse.json(await getCampaignDetail(await samparkContext(), guard.orgId, id.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CAMPAIGN');
    }
}
