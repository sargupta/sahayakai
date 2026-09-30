/**
 * GET /api/sampark/[orgId]/overview — the console landing numbers.
 *
 * Input:  none.
 * Output: SamparkOverview (window open now, guardians by language/consent,
 *         today's calls in IST, active campaigns, last import). Last-4 only.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first). 404
 *         SAMPARK_NOT_ENABLED if the school has no Sampark record.
 * Cost:   5 collection reads (guardians, suppressions, ≤1000 calls,
 *         ≤200 campaigns, latest import) + preferences getAll.
 * Done:   numbers match the imported snapshot and the call log.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, samparkContext } from '@/server/sampark/http';
import { getOverview } from '@/server/sampark/overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json(await getOverview(await samparkContext(), guard.orgId));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_OVERVIEW');
    }
}
