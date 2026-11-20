/**
 * POST /api/sampark/[orgId]/batch-calls/preview — what a class-wide campaign would do. No writes,
 * no calls: eligible families, exclusions with reasons, totals, the line Riya will say, provider.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { providerChoiceFromCookieHeader } from '@/lib/sampark/provider-choice';
import { batchDeps, BatchPreviewSchema, previewBatch } from '@/server/sampark/batch-calls';
import { guardBatchRoute } from '@/server/sampark/batch-http';
import { errorResponse, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardBatchRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, BatchPreviewSchema);
    if ('response' in body) return body.response;
    try {
        const deps = await batchDeps(await samparkContext());
        deps.providerChoice = providerChoiceFromCookieHeader(req.headers.get('cookie'));
        return NextResponse.json(await previewBatch(deps, guard.orgId, guard.uid, body.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_BATCH_PREVIEW');
    }
}
