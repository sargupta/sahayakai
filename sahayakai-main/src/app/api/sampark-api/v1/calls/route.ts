/**
 * POST /api/sampark-api/v1/calls — ask Sampark to place ONE call to one family.
 *
 * Input:  { purpose, guardianId, studentId, facts | campaignId, idempotencyKey (uuid),
 *           confirmedAnnouncement } (strict). `confirmedAnnouncement` is the announcement the
 *         preview returned; if what Sampark would say has changed since, the call is refused.
 *         Practice scenarios are not accepted here.
 * Output: { call: SamparkApiCall, duplicate: boolean } — 201, or 200 when this idempotency key
 *         had already placed this call (nothing new is dialled).
 * Errors: 409 API_KEY_DAILY_CAP_REACHED when this key has made SAMPARK_API_KEY_DAILY_CAP new call
 *         requests (default 20; refused ones count too) in the last 24 hours; and the same refusals as the console (GATE_BLOCKED,
 *         OUTSIDE_CALLING_HOURS, UNRESOLVED_PREVIOUS_CALL, ANNOUNCEMENT_CHANGED,
 *         RIYA_CALL_IN_PROGRESS, TEST_CALL_CAP_REACHED, LIVE_MODE_NOT_AVAILABLE, …).
 * Auth:   API key with the `sampark` scope. The school is the key's; the caller is recorded as
 *         `api-key:<keyId>`.
 * Flags:  SAMPARK_ENABLED, SAMPARK_ELEVENLABS_ENABLED and SAMPARK_API_V1_ENABLED === 'true', else 404.
 * Rules:  every gate in startRiyaCall applies unchanged. In Test mode only the school's test
 *         phone rings; Live mode is refused.
 */

import {
    apiErrorResponse, apiJson, apiKeyDailyCap, ApiStartSchema, apiUnavailable, guardApiV1, parseApiBody, reserveDailyCall, toApiCall,
} from '@/server/sampark/api-v1';
import { SamparkServiceError } from '@/server/sampark/errors';
import { apiV1Deps } from '@/server/sampark/api-v1-runtime';
import { riyaCallId, riyaDeps, startRiyaCall } from '@/server/sampark/conversation';
import { samparkContext } from '@/server/sampark/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const guard = await guardApiV1(req, apiV1Deps, 'place');
    if ('response' in guard) return guard.response;
    const body = await parseApiBody(req, ApiStartSchema);
    if ('response' in body) return body.response;
    try {
        const orgId = guard.principal.orgId;
        const deps = await riyaDeps(await samparkContext());
        // A retry of a call that already exists uses no budget: startRiyaCall returns it as a duplicate
        // (or refuses a key reused by another caller). Only a new call reserves a slot, and the slot is
        // reserved before anything can dial. If the budget cannot be checked, no call starts (503).
        const existing = await deps.calls.getCall(orgId, riyaCallId(orgId, body.data.idempotencyKey));
        if (!existing) {
            try {
                await reserveDailyCall(apiV1Deps.dailyCap, guard.principal.keyId, body.data.idempotencyKey, Date.now(), apiKeyDailyCap(apiV1Deps.env ?? process.env));
            } catch (err) {
                if (err instanceof SamparkServiceError) throw err;
                return apiUnavailable(err);
            }
        }
        const result = await startRiyaCall(deps, orgId, guard.actor, body.data);
        return apiJson(result.duplicate ? 200 : 201, { call: toApiCall(result.call), duplicate: result.duplicate });
    } catch (err) {
        return apiErrorResponse(err, 'SAMPARK_API_V1_START');
    }
}
