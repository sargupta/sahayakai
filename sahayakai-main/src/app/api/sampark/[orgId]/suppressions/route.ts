/**
 * GET /api/sampark/[orgId]/suppressions — the do-not-call list.
 *
 * Input:  none.
 * Output: { suppressions: Suppression[] } newest first (phone hash + last-4 only).
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 collection read.
 * Done:   a keypad-9 opt-out from a simulated call appears here with verification 'pending'.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, samparkContext } from '@/server/sampark/http';
import { listSuppressions } from '@/server/sampark/suppressions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        return NextResponse.json({ suppressions: await listSuppressions(await samparkContext(), guard.orgId) });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_SUPPRESSIONS');
    }
}
