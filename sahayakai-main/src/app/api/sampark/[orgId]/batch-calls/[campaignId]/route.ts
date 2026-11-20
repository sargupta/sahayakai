/**
 * GET  /api/sampark/[orgId]/batch-calls/[campaignId] — one campaign: progress, every recipient's
 *      outcome, and the calls it placed (synopsis and answers; transcripts stay on the server).
 * POST /api/sampark/[orgId]/batch-calls/[campaignId] — { action: pause | resume | cancel | retry | advance }.
 *      `advance` runs one pass of the queue (what the scheduler does) while the page is open.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { actOnBatch, BatchActionSchema, batchDeps, getBatch } from '@/server/sampark/batch-calls';
import { guardBatchRoute } from '@/server/sampark/batch-http';
import { DocIdSchema, errorResponse, invalidRequest, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string; campaignId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const p = await params;
    const guard = await guardBatchRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.campaignId);
    if (!id.success) return invalidRequest(id.error);
    try {
        return NextResponse.json(await getBatch(await batchDeps(await samparkContext()), guard.orgId, guard.uid, id.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_BATCH');
    }
}

export async function POST(req: NextRequest, { params }: Params) {
    const p = await params;
    const guard = await guardBatchRoute(req, p.orgId);
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse(p.campaignId);
    if (!id.success) return invalidRequest(id.error);
    const body = await parseBody(req, BatchActionSchema);
    if ('response' in body) return body.response;
    try {
        return NextResponse.json(await actOnBatch(await batchDeps(await samparkContext()), guard.orgId, guard.uid, id.data, body.data));
    } catch (err) {
        return errorResponse(err, 'SAMPARK_BATCH_ACTION');
    }
}
