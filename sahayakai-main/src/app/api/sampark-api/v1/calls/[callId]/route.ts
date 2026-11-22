/**
 * GET /api/sampark-api/v1/calls/[callId] — the state and outcome of a call this school's integration placed.
 *
 * Output: { call: SamparkApiCall }. Never the transcript, the phone number or provider ids.
 * Errors: 404 CALL_NOT_FOUND for an unknown id, another school's call, or a call staff placed
 *         from the console (those are not the integration's to read).
 * Auth:   API key with the `sampark` scope. The school is the key's.
 * Flags:  SAMPARK_ENABLED, SAMPARK_ELEVENLABS_ENABLED and SAMPARK_API_V1_ENABLED === 'true', else 404.
 */

import { apiErrorResponse, apiJson, getApiCall, guardApiV1 } from '@/server/sampark/api-v1';
import { apiV1Deps } from '@/server/sampark/api-v1-runtime';
import { getRiyaCall, riyaDeps } from '@/server/sampark/conversation';
import { DocIdSchema, invalidRequest, samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ callId: string }> }) {
    const guard = await guardApiV1(req, apiV1Deps, 'read');
    if ('response' in guard) return guard.response;
    const id = DocIdSchema.safeParse((await params).callId);
    if (!id.success) return invalidRequest(id.error);
    try {
        const deps = await riyaDeps(await samparkContext());
        const orgId = guard.principal.orgId;
        return apiJson(200, { call: await getApiCall(deps, orgId, id.data, () => getRiyaCall(deps, orgId, id.data)) });
    } catch (err) {
        return apiErrorResponse(err, 'SAMPARK_API_V1_CALL');
    }
}
