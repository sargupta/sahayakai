/**
 * Riya over Vobiz — the four public legs of a Sampark call run by SahayakAI's own bridge.
 *
 *   POST /api/webhooks/vobiz-riya/answer   (Vobiz, token)  → <Stream> to the bridge for ONE call
 *   POST /api/webhooks/vobiz-riya/status   (Vobiz, token)  → ring / hangup; a call that never
 *                                                              connected becomes `initiation_failure`
 *   GET  /api/webhooks/vobiz-riya/context  (bridge, token) → that call's 19 variables (server-to-server)
 *   POST /api/webhooks/vobiz-riya/event    (bridge, HMAC)  → the normalised `post_call` result
 *
 * Every leg is bound to one Sampark call (`sampark~{orgId}~{callId}`) and every result goes through
 * `applyConversationEvent()` — the same idempotent reducer, settle, callback proposal and synopsis as
 * the ElevenLabs webhook. Nothing here trusts a request's claims about which call it is: the token
 * or signature says so, and the stored call must be a Vobiz call.
 */

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { buildVobizAnswerXml, toWebSocketOrigin } from '@/lib/vobiz/answer-xml';
import { mintVobizToken, verifyVobizToken } from '@/lib/vobiz/tokens';
import { isTerminalConversationState, type ConversationTranscriptTurn } from '@/lib/sampark/conversation/types';
import {
    parseVobizRiyaRef,
    readVobizRiyaConfig,
    SAMPARK_VOBIZ_DOMAINS,
    verifyBridgeSignature,
    vobizConversationId,
    vobizRingFailure,
    VOBIZ_RIYA_AGENT_ID,
} from '@/lib/sampark/conversation/vobiz-provider';
import { MAX_TRANSCRIPT_TURNS, MAX_TURN_CHARS, MAX_WEBHOOK_BYTES, normaliseDataCollection, type RiyaWebhookEvent } from '@/lib/sampark/conversation/webhook';
import { pauseStopsPurpose } from '@/lib/sampark/policy/pause';
import { applyConversationEvent, noteCarrierEnded, riyaEnabled, type RiyaDeps } from '@/server/sampark/conversation';

const LOG = 'SAMPARK_VOBIZ_RIYA';
const HANGUP_XML = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';

type Env = Record<string, string | undefined>;

function enabled(env: Env): boolean {
    return env.SAMPARK_ENABLED === 'true' && riyaEnabled(env) && env.SAMPARK_VOBIZ_RIYA_ENABLED === 'true';
}

async function vobizCallFor(deps: RiyaDeps, ref: string | null) {
    const parsed = parseVobizRiyaRef(ref);
    if (!parsed) return null;
    const call = await deps.calls.getCall(parsed.orgId, parsed.callId);
    if (!call || call.orgId !== parsed.orgId || call.provider !== 'vobiz') return null;
    return call;
}

// ── answer ─────────────────────────────────────────────────────────────────

export async function handleVobizRiyaAnswer(deps: RiyaDeps, token: string | null, callUuid: string | null): Promise<{ status: 200 | 404; xml: string }> {
    const env = deps.env ?? process.env;
    if (!enabled(env)) return { status: 404, xml: HANGUP_XML };
    const call = await vobizCallFor(deps, await verifyVobizToken(SAMPARK_VOBIZ_DOMAINS.ANSWER, token));
    // A bad token, an unknown call, or a call already settled: hang up rather than stream.
    if (!call || isTerminalConversationState(call.state)) {
        logger.warn('Vobiz Riya answer refused', LOG, { reason: call ? 'terminal' : 'token_or_call' });
        return { status: 200, xml: HANGUP_XML };
    }
    const school = await deps.repo.getSchool(call.orgId);
    if (!school || pauseStopsPurpose(school.pause, call.purpose)) {
        logger.info('Vobiz Riya answer: school paused, hanging up', LOG, { orgId: call.orgId });
        return { status: 200, xml: HANGUP_XML };
    }
    const cfg = readVobizRiyaConfig(env);
    const origin = cfg.ok ? toWebSocketOrigin(cfg.config.bridgeBaseUrl) : null;
    if (!origin) return { status: 200, xml: HANGUP_XML };
    const ref = `sampark~${call.orgId}~${call.id}`;
    const stream = await mintVobizToken(SAMPARK_VOBIZ_DOMAINS.STREAM, ref, 300);
    const params = new URLSearchParams({ t: stream.token, cuid: (callUuid ?? '').slice(0, 64), lang: 'English', agent: 'riya' });
    return { status: 200, xml: buildVobizAnswerXml({ streamUrl: `${origin}/telephony/vobiz/stream?${params.toString()}` }) };
}

// ── status (ring / hangup) ────────────────────────────────────────────────────

export async function handleVobizRiyaStatus(
    deps: RiyaDeps,
    token: string | null,
    kind: string | null,
    form: Record<string, string>,
): Promise<{ status: 200 }> {
    const env = deps.env ?? process.env;
    if (!enabled(env)) return { status: 200 };
    const call = await vobizCallFor(deps, await verifyVobizToken(SAMPARK_VOBIZ_DOMAINS.STATUS, token));
    if (!call) return { status: 200 };
    const uuid = (form.CallUUID || form.call_uuid || form.RequestUUID || '').slice(0, 64);
    const at = deps.clock.now().toISOString();
    if (kind === 'ring') {
        await deps.calls.mutateCall(call.orgId, call.id, (c) => (c.state === 'initiated' && c.providerStatus === 'initiated' ? { ...c, providerStatus: 'ringing', updatedAt: at } : null));
        return { status: 200 };
    }
    if (kind !== 'hangup') return { status: 200 };
    const answered = Boolean(form.AnswerTime?.trim()) || Number(form.BillDuration || form.Duration || 0) > 0;
    if (answered) {
        // The bridge reports the conversation itself (post_call). Note the carrier's end: the line is
        // down, so its slot is free now (a batch launches its next family without waiting).
        await noteCarrierEnded(deps, call.orgId, call.id);
        return { status: 200 };
    }
    const event: RiyaWebhookEvent = {
        kind: 'initiation_failure',
        eventId: `vobiz-hangup:${uuid || call.id}`,
        eventTimestamp: Math.floor(deps.clock.now().getTime() / 1000),
        agentId: VOBIZ_RIYA_AGENT_ID,
        conversationId: call.providerConversationId ?? vobizConversationId(uuid || call.id),
        failureReason: vobizRingFailure(form.HangupCause || form.hangup_cause),
    };
    await applyConversationEvent(deps, call.orgId, call.id, event);
    return { status: 200 };
}

// ── context (bridge → Sampark) ────────────────────────────────────────────────

export interface VobizRiyaContext {
    agentWorkflow: 'riya';
    productContext: 'sampark';
    riyaVariables: Record<string, string>;
    parentLanguage: 'English';
    /** The bridge keeps no transcript for Sampark calls; it reports it once, here decides retention. */
    callId: string;
}

export async function handleVobizRiyaContext(deps: RiyaDeps, token: string | null): Promise<{ status: 200 | 404; body: VobizRiyaContext | { ok: false } }> {
    const env = deps.env ?? process.env;
    if (!enabled(env)) return { status: 404, body: { ok: false } };
    const call = await vobizCallFor(deps, await verifyVobizToken(SAMPARK_VOBIZ_DOMAINS.CONTEXT, token));
    if (!call || isTerminalConversationState(call.state) || !call.variables) return { status: 404, body: { ok: false } };
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(call.variables)) vars[k] = typeof v === 'string' ? v : '';
    return {
        status: 200,
        body: { agentWorkflow: 'riya', productContext: 'sampark', riyaVariables: vars, parentLanguage: 'English', callId: call.id },
    };
}

// ── event (bridge → Sampark) ─────────────────────────────────────────────────

const Turn = z.object({
    role: z.enum(['agent', 'user']),
    message: z.string().max(MAX_TURN_CHARS * 2),
    timeInCallSecs: z.number().nonnegative().nullable().optional(),
});

export const VobizRiyaEventSchema = z
    .object({
        ref: z.string().max(200),
        callUuid: z.string().max(64),
        eventTimestamp: z.number().int().nonnegative(),
        status: z.enum(['done', 'failed']),
        durationSeconds: z.number().int().nonnegative().nullable(),
        terminationReason: z.string().max(300).nullable(),
        callSuccessful: z.enum(['success', 'failure', 'unknown']).nullable(),
        dataCollection: z.record(z.string(), z.string().max(400).nullable()),
        transcript: z.array(Turn).max(MAX_TRANSCRIPT_TURNS * 2),
    })
    .strict();

export async function handleVobizRiyaEvent(
    deps: RiyaDeps,
    rawBody: string,
    signatureHeader: string | null,
): Promise<{ status: 200 | 400 | 401 | 404 | 413 | 503; body: { ok: boolean; error?: string } }> {
    const env = deps.env ?? process.env;
    if (!enabled(env)) return { status: 404, body: { ok: false, error: 'Not found' } };
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) return { status: 413, body: { ok: false, error: 'too large' } };
    const nowSec = Math.floor((deps.wallClock ?? deps.clock).now().getTime() / 1000);
    const sig = verifyBridgeSignature(env.SAHAYAKAI_REQUEST_SIGNING_KEY?.trim(), rawBody, signatureHeader, nowSec);
    if (!sig.ok) {
        logger.warn('Vobiz Riya event refused', LOG, { reason: sig.reason });
        return { status: sig.reason === 'no_secret' ? 503 : 401, body: { ok: false, error: 'unauthorized' } };
    }
    let parsed: z.infer<typeof VobizRiyaEventSchema>;
    try {
        const r = VobizRiyaEventSchema.safeParse(JSON.parse(rawBody));
        if (!r.success) return { status: 400, body: { ok: false, error: 'unreadable' } };
        parsed = r.data;
    } catch {
        return { status: 400, body: { ok: false, error: 'unreadable' } };
    }
    const call = await vobizCallFor(deps, parsed.ref);
    if (!call) return { status: 200, body: { ok: true } }; // not ours: accept so it is not retried, change nothing
    // The signature and the ref already bind this report to THIS call (the bridge only ever got the
    // ref from a stream token minted for it). Vobiz's request uuid and the answered call's uuid are
    // the same value on outbound calls; if they ever differ, the call keeps the id it was placed
    // with and the report still applies — dropping a signed result would leave the call open forever.
    const reported = vobizConversationId(parsed.callUuid || call.id);
    const conversationId = call.providerConversationId ?? reported;
    if (conversationId !== reported) {
        logger.warn('Vobiz Riya event uuid differs from the placed call uuid; applied to the placed call', LOG, { orgId: call.orgId, callId: call.id });
    }
    const transcript: ConversationTranscriptTurn[] = parsed.transcript.slice(0, MAX_TRANSCRIPT_TURNS).map((t) => ({
        role: t.role,
        message: t.message.slice(0, MAX_TURN_CHARS),
        timeInCallSecs: t.timeInCallSecs ?? null,
    }));
    const event: RiyaWebhookEvent = {
        kind: 'post_call',
        eventId: `vobiz-post-call:${parsed.callUuid || call.id}`,
        eventTimestamp: parsed.eventTimestamp,
        agentId: VOBIZ_RIYA_AGENT_ID,
        conversationId,
        userId: `${call.orgId}~${call.id}`,
        status: parsed.status,
        durationSeconds: parsed.durationSeconds,
        terminationReason: parsed.terminationReason,
        callSuccessful: parsed.callSuccessful,
        // Same key allow-list and bounds as the ElevenLabs webhook.
        dataCollection: normaliseDataCollection(parsed.dataCollection),
        transcript,
    };
    await applyConversationEvent(deps, call.orgId, call.id, event);
    return { status: 200, body: { ok: true } };
}
