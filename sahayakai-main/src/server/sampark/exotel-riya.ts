/**
 * Riya over Exotel — the one public carrier leg of a Sampark call (the media stream goes straight
 * from Exotel to the bridge; the context and result legs are shared, see vobiz-riya.ts):
 *
 *   POST /api/webhooks/exotel-riya/status?t=…   (Exotel StatusCallback, JSON or form)
 *        answered → note the CallSid · terminal completed → carrier ended (the bridge settles the
 *        conversation) · busy / no-answer / failed / canceled → `initiation_failure`
 *
 * Exotel does not sign callbacks (developer.exotel.com/docs/references/webhooks). The URL's
 * purpose-scoped token is the authentication: it was minted for this one call, is useless on any
 * other endpoint, and the stored call must be an Exotel call. Exotel retries on non-200, so the
 * route always answers 200 and the reducer makes repeats harmless.
 */

import { logger } from '@/lib/logger';
import { exotelOutcome } from '@/lib/exotel/client';
import { verifyVobizToken } from '@/lib/vobiz/tokens';
import { BRIDGE_AGENT_ID } from '@/lib/sampark/conversation/bridge-carrier';
import { SAMPARK_EXOTEL_DOMAINS } from '@/lib/sampark/conversation/exotel-provider';
import { bridgeConversationId } from '@/lib/sampark/conversation/types';
import { parseVobizRiyaRef } from '@/lib/sampark/conversation/vobiz-provider';
import type { RiyaWebhookEvent } from '@/lib/sampark/conversation/webhook';
import { applyConversationEvent, noteCarrierEnded, type RiyaDeps } from '@/server/sampark/conversation';

import { bridgeCarrierEnabled } from './vobiz-riya';

const LOG = 'SAMPARK_EXOTEL_RIYA';

/** Flatten Exotel's payload (JSON or form) to the few string fields we read. */
export function exotelStatusFields(body: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (!body || typeof body !== 'object') return out;
    const src = body as Record<string, unknown>;
    for (const k of ['CallSid', 'Status', 'EventType', 'ConversationDuration', 'Duration', 'CustomField']) {
        const v = src[k];
        if (typeof v === 'string' || typeof v === 'number') out[k] = String(v).slice(0, 200);
    }
    return out;
}

export async function handleExotelRiyaStatus(deps: RiyaDeps, token: string | null, fields: Record<string, string>): Promise<{ status: 200 }> {
    const env = deps.env ?? process.env;
    if (!bridgeCarrierEnabled(env, 'exotel')) return { status: 200 };
    const parsed = parseVobizRiyaRef(await verifyVobizToken(SAMPARK_EXOTEL_DOMAINS.STATUS, token));
    if (!parsed) {
        logger.warn('Exotel Riya status refused', LOG, { reason: 'token' });
        return { status: 200 };
    }
    const call = await deps.calls.getCall(parsed.orgId, parsed.callId);
    if (!call || call.orgId !== parsed.orgId || call.provider !== 'exotel') return { status: 200 };
    const sid = (fields.CallSid || '').slice(0, 64);
    const at = deps.clock.now().toISOString();
    const outcome = exotelOutcome(fields.Status);
    if (outcome === 'open') {
        // e.g. EventType=answered / Status=in-progress: the bridge has the call now. Note it once.
        await deps.calls.mutateCall(call.orgId, call.id, (c) => (c.state === 'initiated' && c.providerStatus === 'initiated'
            ? { ...c, providerStatus: 'ringing', ...(sid && !c.providerCallId ? { providerCallId: sid } : {}), updatedAt: at }
            : null));
        return { status: 200 };
    }
    if (outcome === 'answered') {
        const seconds = Number(fields.ConversationDuration || fields.Duration || 0);
        await noteCarrierEnded(deps, call.orgId, call.id, seconds > 0 ? seconds : null);
        return { status: 200 };
    }
    const event: RiyaWebhookEvent = {
        kind: 'initiation_failure',
        eventId: `exotel-terminal:${sid || call.id}`,
        eventTimestamp: Math.floor(deps.clock.now().getTime() / 1000),
        agentId: BRIDGE_AGENT_ID.exotel,
        conversationId: call.providerConversationId ?? bridgeConversationId('exotel', sid || call.id),
        failureReason: outcome,
    };
    await applyConversationEvent(deps, call.orgId, call.id, event);
    return { status: 200 };
}
