/**
 * GET /api/sampark/[orgId]/calls?campaignId=&limit= — the call log.
 *
 * Input:  campaignId (optional), limit 1–500 (default 100).
 * Output: { calls: CallLogEntry[] } newest first — state, heard level, keys,
 *         opt-out, duration, carrier, guardian and children display names.
 *         Last-4 only.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED==='true' else 404 (checked first).
 * Cost:   1 indexed query + guardians getAll + students + intents.
 * Done:   every simulated attempt appears with its outcome.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { CallQuerySchema, listCallLog } from '@/server/sampark/calls';
import { errorResponse, guardOrgRoute, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardOrgRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const sp = req.nextUrl.searchParams;
    const query = CallQuerySchema.safeParse({ campaignId: sp.get('campaignId') || undefined, limit: sp.get('limit') || undefined });
    if (!query.success) return invalidRequest(query.error);
    try {
        return NextResponse.json({ calls: await listCallLog(await samparkContext(), guard.orgId, query.data) });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_CALLS');
    }
}
