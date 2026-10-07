/**
 * The Vobiz notice carrier (phase 2a contract §3) — the first carrier that
 * reaches a real phone. In phase 2a it rings ONLY a school's own test phone:
 *
 *   - it refuses any destination that is not an Indian mobile (`classifyPhone`),
 *     so a synthetic `+915…` demo number or a landline can never be dialled
 *     (class gate 4's last line of defence);
 *   - it refuses any call whose record does not say `destination: 'test_phone'`.
 *     Live mode is refused by the carrier factory and by the dispatcher already;
 *     this is the third, independent refusal, so no single slip can ring a parent
 *     before phase 2b removes it in its own reviewed change.
 *
 * Every URL handed to Vobiz is built from `publicBaseUrl` (SAMPARK_PUBLIC_BASE_URL,
 * an https origin), never from a request's Host header (plan §16 row 21), and
 * carries a short-lived, domain-scoped token for the principal
 * `${orgId}~${callId}`. The answer token opens the notice; the status token is
 * shared by the ring and hangup callbacks, which the status route tells apart
 * by `kind`.
 *
 * `place` returns no events: the call's lifecycle arrives later through the
 * voice webhooks, which feed the same reducer and settle the intent. The
 * dispatcher keeps the call open with a longer lease meanwhile.
 *
 * Placing goes through `placeVobizCallDetailed` (hardening H7): the teacher path's
 * `placeVobizCall` is left exactly as it is, and the detailed variant adds the
 * categories below and an 8-second timeout.
 *
 * Failure mapping (VobizDetailedFailure category → outcome):
 *   rate_limited                               → requeue: Vobiz refused for capacity and nothing
 *       rang, so the family's attempt is not spent; the dispatcher requeues the intent a minute
 *       or so later under a new call id (dispatch/settle.ts, up to MAX_CARRIER_REQUEUES times)
 *   provider_rejected                          → retryable (Vobiz answered and refused: nothing rang)
 *   dnd_blocked                                → not retryable (the number cannot take these calls)
 *   provider_unconfigured, invalid_destination → not retryable (an operator problem)
 *   provider_error, network                    → THROW. A 5xx, a dropped connection or the timeout:
 *       the request may have reached Vobiz and the call been placed, so whether the phone rang is
 *       unknown. A thrown place leaves the call 'dialing' for the sweep, which hands it to a person
 *       and never re-dials (plan §4⑦). Retrying here could ring a family twice.
 *
 * The number dialled is never logged. Class gate 2: only the carrier factory
 * (src/server/sampark/carrier.ts) constructs this; only the dispatcher calls `place`.
 */

import { logger } from '@/lib/logger';
import { classifyPhone } from '@/lib/sampark/phone';
import type { Carrier, PlaceCallRequest, PlaceCallResult } from '@/lib/sampark/ports';
import { voicePrincipal, type SamparkVoiceDomain } from '@/lib/sampark/voice/tokens';
import { placeVobizCallDetailed, type VobizConfig, type VobizDetailedFailureCategory } from '@/lib/vobiz/client';

/** Seconds Vobiz lets the phone ring before giving up (matches the teacher parent-call path). */
export const VOBIZ_RING_TIMEOUT_SECONDS = 30;

const LOG_CONTEXT = 'SAMPARK_VOBIZ_CARRIER';

export interface VobizNoticeCarrierDeps {
    /** From readVobizConfig(). */
    config: VobizConfig;
    /** SAMPARK_PUBLIC_BASE_URL — must be an https origin. */
    publicBaseUrl: string;
    /** Stream V's mintSamparkVoiceToken. */
    mintToken: (domain: SamparkVoiceDomain, principal: string, ttlSeconds?: number) => Promise<string>;
    /** Injectable for tests. Named placeCall (not place) so class gate 2's `.place(` scan stays precise. */
    placeCall?: typeof placeVobizCallDetailed;
}

/** Categories whose outcome is unknown: the call may have been placed, so it is never retried. */
type UnknownOutcome = 'network' | 'provider_error';

/** Only for categories where Vobiz provably did not place the call; the unknown outcomes never reach this table. */
const RETRYABLE: Record<Exclude<VobizDetailedFailureCategory, UnknownOutcome>, boolean> = {
    rate_limited: true,
    provider_rejected: true,
    dnd_blocked: false,
    provider_unconfigured: false,
    invalid_destination: false,
};

/** The https origin every callback URL is built from; throws for anything else. */
function callbackOrigin(raw: string): string {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error('Vobiz notice carrier: publicBaseUrl is not a URL');
    }
    if (url.protocol !== 'https:') throw new Error('Vobiz notice carrier: publicBaseUrl must be https');
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
        throw new Error('Vobiz notice carrier: publicBaseUrl must be a bare origin');
    }
    return url.origin;
}

function refuse(reason: string): PlaceCallResult {
    return { ok: false, reason, retryable: false };
}

export function createVobizNoticeCarrier(deps: VobizNoticeCarrierDeps): Carrier {
    if (process.env.SAMPARK_LIVE_DIAL_ENABLED !== 'true') {
        throw new Error('Vobiz notice carrier: SAMPARK_LIVE_DIAL_ENABLED is not "true"');
    }
    const base = callbackOrigin(deps.publicBaseUrl);
    const placeCall = deps.placeCall ?? placeVobizCallDetailed;

    return {
        kind: 'vobiz',
        async place(req: PlaceCallRequest): Promise<PlaceCallResult> {
            const { call } = req;
            if (call.destination !== 'test_phone') return refuse('guardian_dial_not_enabled');
            if (classifyPhone(req.destinationE164) !== 'mobile') return refuse('destination_not_mobile');

            const principal = voicePrincipal(call.orgId, call.id);
            let answerToken: string;
            let statusToken: string;
            try {
                answerToken = await deps.mintToken('sampark-answer', principal);
                statusToken = await deps.mintToken('sampark-status', principal);
            } catch {
                // The provider was never contacted, so this is a clean failure; the signing
                // key may simply be unreachable for a moment.
                logger.warn('Sampark Vobiz carrier could not mint callback tokens', LOG_CONTEXT, { orgId: call.orgId, callId: call.id });
                return { ok: false, reason: 'callback_token_unavailable', retryable: true };
            }

            const answer = encodeURIComponent(answerToken);
            const status = encodeURIComponent(statusToken);
            const result = await placeCall(deps.config, {
                to: req.destinationE164,
                answerUrl: `${base}/api/webhooks/sampark-voice/answer?t=${answer}`,
                hangupUrl: `${base}/api/webhooks/sampark-voice/status?kind=hangup&t=${status}`,
                ringUrl: `${base}/api/webhooks/sampark-voice/status?kind=ring&t=${status}`,
                ringTimeout: VOBIZ_RING_TIMEOUT_SECONDS,
            });

            if (result.ok) return { ok: true, providerCallId: result.handle.requestUuid, events: [] };

            const { category, status: httpStatus } = result.failure;
            if (category === 'network' || category === 'provider_error') {
                logger.warn('Sampark Vobiz place outcome unknown; leaving the call for the sweep', LOG_CONTEXT, { orgId: call.orgId, callId: call.id, category, httpStatus: httpStatus ?? null });
                throw new Error(`vobiz_${category}_outcome_unknown`);
            }
            logger.warn('Sampark Vobiz call was not placed', LOG_CONTEXT, { orgId: call.orgId, callId: call.id, category, httpStatus: httpStatus ?? null });
            if (category === 'rate_limited') return { ok: false, reason: 'vobiz_rate_limited', retryable: true, requeue: true };
            return { ok: false, reason: `vobiz_${category}`, retryable: RETRYABLE[category] };
        },
    };
}
