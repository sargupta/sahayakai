/**
 * POST /api/sampark/[orgId]/riya/preview — what a Riya call would do, without doing it.
 *
 * Input:  { purpose, guardianId, studentId, facts | campaignId }
 * Output: RiyaPreview — the recipient (names and last four digits only), the phone that
 *         would ring, the exact variables and announcement, the masked agent and phone-number
 *         ids, and every reason the call would be refused. Nothing is written or dialled.
 * Auth:   x-user-id (401) + requireOrgAdmin (403).
 * Flags:  SAMPARK_ENABLED and SAMPARK_ELEVENLABS_ENABLED === 'true' else 404.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { previewRiyaCall, riyaDeps, RiyaPreviewSchema } from '@/server/sampark/conversation';
import { guardRiyaRoute } from '@/server/sampark/conversation-http';
import { errorResponse, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardRiyaRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, RiyaPreviewSchema);
    if ('response' in body) return body.response;
    try {
        const deps = await riyaDeps(await samparkContext());
        return NextResponse.json(await previewRiyaCall(deps, guard.orgId, body.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_RIYA_PREVIEW');
    }
}
