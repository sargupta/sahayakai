/**
 * POST /api/sampark-api/v1/calls/preview — what a call would say and whether it may be placed. Dials nothing.
 *
 * Input:  { purpose, guardianId, studentId, facts | campaignId } (strict). WHO is named by
 *         Sampark record id only; there is no phone number and no school id in a request.
 * Output: { preview: SamparkApiPreview } — `ok`, the refusals if any, and the announcement to
 *         send back as `confirmedAnnouncement` when placing the call.
 * Auth:   API key with the `sampark` scope (Authorization: Bearer sk_sahayak_…). The school is the key's.
 * Flags:  SAMPARK_ENABLED, SAMPARK_ELEVENLABS_ENABLED and SAMPARK_API_V1_ENABLED === 'true', else 404.
 */

import { apiErrorResponse, apiJson, ApiPreviewSchema, guardApiV1, parseApiBody, toApiPreview } from '@/server/sampark/api-v1';
import { apiV1Deps } from '@/server/sampark/api-v1-runtime';
import { previewRiyaCall, riyaDeps } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const guard = await guardApiV1(req, apiV1Deps, 'place');
    if ('response' in guard) return guard.response;
    const body = await parseApiBody(req, ApiPreviewSchema);
    if ('response' in body) return body.response;
    try {
        const deps = await riyaDeps(await samparkContext());
        return apiJson(200, { preview: toApiPreview(await previewRiyaCall(deps, guard.principal.orgId, body.data)) });
    } catch (err) {
        return apiErrorResponse(err, 'SAMPARK_API_V1_PREVIEW');
    }
}
