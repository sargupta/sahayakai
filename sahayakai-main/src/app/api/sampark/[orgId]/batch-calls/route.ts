/**
 * GET  /api/sampark/[orgId]/batch-calls — the classes this person may run class-wide outreach for,
 *      and the school's recent batch campaigns (only those for classes they manage).
 * POST /api/sampark/[orgId]/batch-calls — start ONE class-wide campaign (one Riya call per family).
 *
 * POST input: { grade, section, reason, facts, excluded[], requestKey (uuid), confirmedRecipientCount,
 *               confirmedSampleAnnouncement, confirmRealCalls, scenario? }
 *   The browser names the class and families by id only; names, phones and lines come from records.
 * Output: GET  { classes: BatchClass[], campaigns: BatchCampaignView[] }
 *         POST { campaign: BatchCampaignView, duplicate } (201, or 200 for a repeated request key)
 * Errors: 409 DUPLICATE_CAMPAIGN, RECIPIENTS_CHANGED, ANNOUNCEMENT_CHANGED, REAL_CALL_CONFIRMATION_REQUIRED,
 *         NOT_BATCHABLE, BATCH_PROVIDER_NOT_SUPPORTED, REAL_BATCH_DISABLED, …; 403 CLASS_NOT_AUTHORISED.
 * Auth:   x-user-id (401) + org admin or assigned teacher (403) + class authority per request.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { providerChoiceFromCookieHeader } from '@/lib/sampark/provider-choice';
import { batchDeps, BatchCreateSchema, createBatch, listBatchClasses, listBatches } from '@/server/sampark/batch-calls';
import { guardBatchRoute } from '@/server/sampark/batch-http';
import { errorResponse, parseBody, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardBatchRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    try {
        const deps = await batchDeps(await samparkContext());
        const [classes, campaigns] = await Promise.all([listBatchClasses(deps, guard.orgId, guard.uid), listBatches(deps, guard.orgId, guard.uid)]);
        return NextResponse.json({ classes, campaigns });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_BATCH');
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
    const guard = await guardBatchRoute(req, (await params).orgId);
    if ('response' in guard) return guard.response;
    const body = await parseBody(req, BatchCreateSchema);
    if ('response' in body) return body.response;
    try {
        const deps = await batchDeps(await samparkContext());
        // The provider this person chose at the SamparkAI entry; the campaign keeps it for every call.
        deps.providerChoice = providerChoiceFromCookieHeader(req.headers.get('cookie'));
        const result = await createBatch(deps, guard.orgId, guard.uid, body.data);
        return NextResponse.json(result, { status: result.duplicate ? 200 : 201 });
    } catch (err) {
        return errorResponse(err, 'SAMPARK_BATCH_START');
    }
}
