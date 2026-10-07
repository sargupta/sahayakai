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
 * Failure mapping (VobizFailure category → outcome):
 *   provider_rejected                          → retryable (Vobiz answered and refused: nothing rang)
 *   provider_unconfigured, invalid_destination → not retryable (an operator problem)
 *   network                                    → THROWS. The request may have reached Vobiz before
 *       the connection dropped, so whether the phone rang is unknown. A thrown place leaves the
 *       call 'dialing' for the sweep, which hands it to a person and never re-dials (plan §4⑦).
 *       Retrying here could ring a family twice.
 *
 * The number dialled is never logged. Class gate 2: only the carrier factory
 * (src/server/sampark/carrier.ts) constructs this; only the dispatcher calls `place`.
 */

import { logger } from '@/lib/logger';
import { classifyPhone } from '@/lib/sampark/phone';
import type { Carrier, PlaceCallRequest, PlaceCallResult } from '@/lib/sampark/ports';
import { voicePrincipal, type SamparkVoiceDomain } from '@/lib/sampark/voice/tokens';
import { placeVobizCall, type VobizConfig, type VobizFailureCategory } from '@/lib/vobiz/client';

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
    placeCall?: typeof placeVobizCall;
}

/** Only for categories where Vobiz provably did not place the call; `network` never reaches this table. */
const RETRYABLE: Record<Exclude<VobizFailureCategory, 'network'>, boolean> = {
    provider_rejected: true,
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
    const placeCall = deps.placeCall ?? placeVobizCall;

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
            if (category === 'network') {
                logger.warn('Sampark Vobiz place outcome unknown (network); leaving the call for the sweep', LOG_CONTEXT, { orgId: call.orgId, callId: call.id });
                throw new Error('vobiz_network_outcome_unknown');
            }
            logger.warn('Sampark Vobiz call was not placed', LOG_CONTEXT, { orgId: call.orgId, callId: call.id, category, httpStatus: httpStatus ?? null });
            return { ok: false, reason: `vobiz_${category}`, retryable: RETRYABLE[category] };
        },
    };
}
