/**
 * GET /api/sampark/[orgId]/suppressions — the do-not-call list.
 *
 * Input:  none.
 * Output: { suppressions: Suppression[] } newest first (phone hash + last-4 only).
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 collection read.
 * Done:   a keypad-9 opt-out from a simulated call appears here with verification 'pending'.
 *
 * POST /api/sampark/[orgId]/suppressions — reverse a suppression.
 *
 * Input:  { phoneHash: string, reason: string }
 * Output: { suppression: Suppression } the reversed suppression with audit fields.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 read + 1 write.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, guardOrgRoute, samparkContext } from '@/server/sampark/http';
import { listSuppressions, reverseSuppression } from '@/server/sampark/suppressions';

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        const body = await req.json();
        const { phoneHash, reason } = body as { phoneHash?: string; reason?: string };
        if (!phoneHash || !reason) {
            return NextResponse.json({ error: 'phoneHash and reason are required' }, { status: 400 });
        }
        const suppression = await reverseSuppression(await samparkContext(), guard.orgId, phoneHash, reason, guard.uid);
        return NextResponse.json({ suppression });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_SUPPRESSION_REVERSE');
    }
}
