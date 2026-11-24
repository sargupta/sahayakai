/**
 * Riya over Plivo — the two public carrier legs of a Sampark call (the context and result legs are
 * shared with every bridge carrier, see vobiz-riya.ts):
 *
 *   POST /api/webhooks/plivo-riya/answer?t=…              (Plivo, token + V3 signature)
 *        → <Stream> to the bridge's /telephony/plivo/stream for ONE call, or <Hangup/>
 *   POST /api/webhooks/plivo-riya/status?kind=ring|hangup&t=…   (Plivo, token + V3 signature)
 *        → ringing / a call that never connected becomes `initiation_failure` / carrier ended
 *
 * Two independent checks on every callback: the purpose-scoped token says WHICH call (and that we
 * issued the URL), and Plivo's X-Plivo-Signature-V3 says the request came from Plivo. The stored
 * call must be a Plivo call. Every result goes through the same idempotent reducer as Vobiz.
 */

import { logger } from '@/lib/logger';
import { plivoRingFailure, verifyPlivoSignatureV3 } from '@/lib/plivo/client';
import { escapeXml, toWebSocketOrigin } from '@/lib/vobiz/answer-xml';
import { mintVobizToken, verifyVobizToken } from '@/lib/vobiz/tokens';
import { BRIDGE_AGENT_ID } from '@/lib/sampark/conversation/bridge-carrier';
import { readPlivoRiyaConfig, SAMPARK_PLIVO_DOMAINS, type PlivoRiyaConfig } from '@/lib/sampark/conversation/plivo-provider';
import { bridgeConversationId, isTerminalConversationState } from '@/lib/sampark/conversation/types';
import { parseVobizRiyaRef } from '@/lib/sampark/conversation/vobiz-provider';
import type { RiyaWebhookEvent } from '@/lib/sampark/conversation/webhook';
import { pauseStopsPurpose } from '@/lib/sampark/policy/pause';
import { applyConversationEvent, noteCarrierEnded, type RiyaDeps } from '@/server/sampark/conversation';

import { bridgeCarrierEnabled } from './vobiz-riya';

const LOG = 'SAMPARK_PLIVO_RIYA';
const HANGUP_XML = '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>';

type Env = Record<string, string | undefined>;

/** What a Plivo callback route hands the handler: the public path+query Plivo called, its form and signature headers. */
export interface PlivoCallback {
    /** `/api/webhooks/plivo-riya/answer?t=…` exactly as received (path + query). */
    pathAndQuery: string;
    form: Record<string, string>;
    signature: string | null;
    nonce: string | null;
}

/**
 * Plivo signs the URL it called, which is our PUBLIC url (SAMPARK_PUBLIC_BASE_URL), not the
 * internal one Cloud Run hands the app. In `log` mode a bad signature is logged and the token alone
 * decides (for diagnosing a first live call); `enforce` refuses it.
 */
function signatureOk(cfg: PlivoRiyaConfig, cb: PlivoCallback): boolean {
    const url = `${cfg.publicBaseUrl}${cb.pathAndQuery}`;
    const check = verifyPlivoSignatureV3(cfg.plivo.authToken, url, cb.form, cb.nonce, cb.signature);
    if (check.ok) return true;
    logger.warn('Plivo callback signature not verified', LOG, { reason: check.reason, mode: cfg.signatureMode });
    return cfg.signatureMode === 'log';
}

async function plivoCallFor(deps: RiyaDeps, ref: string | null) {
    const parsed = parseVobizRiyaRef(ref);
    if (!parsed) return null;
    const call = await deps.calls.getCall(parsed.orgId, parsed.callId);
    if (!call || call.orgId !== parsed.orgId || call.provider !== 'plivo') return null;
    return call;
}

function config(env: Env): PlivoRiyaConfig | null {
    if (!bridgeCarrierEnabled(env, 'plivo')) return null;
    const cfg = readPlivoRiyaConfig(env);
    return cfg.ok ? cfg.config : null;
}

function token(pathAndQuery: string): string | null {
    return new URL(pathAndQuery, 'https://x.invalid').searchParams.get('t');
}

// ── answer ─────────────────────────────────────────────────────────────────

export async function handlePlivoRiyaAnswer(deps: RiyaDeps, cb: PlivoCallback): Promise<{ status: 200 | 404; xml: string }> {
    const env = deps.env ?? process.env;
    const cfg = config(env);
    if (!cfg) return { status: 404, xml: HANGUP_XML };
    if (!signatureOk(cfg, cb)) return { status: 200, xml: HANGUP_XML };
    const call = await plivoCallFor(deps, await verifyVobizToken(SAMPARK_PLIVO_DOMAINS.ANSWER, token(cb.pathAndQuery)));
    if (!call || isTerminalConversationState(call.state)) {
        logger.warn('Plivo Riya answer refused', LOG, { reason: call ? 'terminal' : 'token_or_call' });
        return { status: 200, xml: HANGUP_XML };
    }
    const school = await deps.repo.getSchool(call.orgId);
    if (!school || pauseStopsPurpose(school.pause, call.purpose)) {
        logger.info('Plivo Riya answer: school paused, hanging up', LOG, { orgId: call.orgId });
        return { status: 200, xml: HANGUP_XML };
    }
    const origin = toWebSocketOrigin(cfg.bridgeBaseUrl);
    if (!origin) return { status: 200, xml: HANGUP_XML };
    const callUuid = (cb.form.CallUUID || '').slice(0, 64);
    const ref = `sampark~${call.orgId}~${call.id}`;
    const stream = await mintVobizToken(SAMPARK_PLIVO_DOMAINS.STREAM, ref, 300);
    const status = await mintVobizToken(SAMPARK_PLIVO_DOMAINS.STATUS, ref, 60 * 60);
    const params = new URLSearchParams({ t: stream.token, cuid: callUuid, lang: 'English', agent: 'riya' });
    return {
        status: 200,
        xml: buildPlivoAnswerXml({
            streamUrl: `${origin}/telephony/plivo/stream?${params.toString()}`,
            // Plivo's own view of the stream (started / stopped / failed + reason), for diagnosis.
            statusCallbackUrl: `${cfg.publicBaseUrl}/api/webhooks/plivo-riya/status?kind=stream&t=${encodeURIComponent(status.token)}`,
        }),
    };
}

/**
 * Plivo's <Stream>: bidirectional, keepCallAlive (the bridge hangs up over REST), μ-law 8 kHz in,
 * `audioTrack="inbound"` stated (the only track Plivo allows with bidirectional), and Plivo's stream
 * status callback. https://www.plivo.com/docs/voice/xml/audio-streaming
 */
export function buildPlivoAnswerXml(opts: { streamUrl: string; statusCallbackUrl: string }): string {
    return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response>' +
        `<Stream bidirectional="true" audioTrack="inbound" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000" statusCallbackUrl="${escapeXml(opts.statusCallbackUrl)}" statusCallbackMethod="POST">` +
        escapeXml(opts.streamUrl) +
        '</Stream>' +
        '</Response>'
    );
}

// ── status (ring / hangup) ────────────────────────────────────────────────────

export async function handlePlivoRiyaStatus(deps: RiyaDeps, kind: string | null, cb: PlivoCallback): Promise<{ status: 200 }> {
    const env = deps.env ?? process.env;
    const cfg = config(env);
    if (!cfg || !signatureOk(cfg, cb)) return { status: 200 };
    const call = await plivoCallFor(deps, await verifyVobizToken(SAMPARK_PLIVO_DOMAINS.STATUS, token(cb.pathAndQuery)));
    if (!call) return { status: 200 };
    const form = cb.form;
    const uuid = (form.CallUUID || form.RequestUUID || '').slice(0, 64);
    const at = deps.clock.now().toISOString();
    if (kind === 'stream') {
        // Plivo's report on the media stream itself. Logged (no personal data) so a silent call can
        // be told apart: Plivo never connected / connected and failed / stopped normally.
        logger.info('Plivo stream status', LOG, {
            orgId: call.orgId, callId: call.id,
            event: (form.Event || '').slice(0, 40), status: (form.Status || form.StreamStatus || '').slice(0, 40),
            reason: (form.StatusReason || form.Reason || '').slice(0, 80), streamId: (form.StreamID || form.StreamId || '').slice(0, 64),
        });
        return { status: 200 };
    }
    if (kind === 'ring') {
        await deps.calls.mutateCall(call.orgId, call.id, (c) => {
            if (c.state !== 'initiated') return null;
            const ringing = c.providerStatus === 'initiated';
            // Keep Plivo's CallUUID for "Check status" (call detail records are keyed by it).
            const learnId = Boolean(form.CallUUID) && c.providerCallId !== form.CallUUID.slice(0, 64);
            if (!ringing && !learnId) return null;
            return { ...c, ...(ringing ? { providerStatus: 'ringing' as const } : {}), ...(learnId ? { providerCallId: form.CallUUID.slice(0, 64) } : {}), updatedAt: at };
        });
        return { status: 200 };
    }
    if (kind !== 'hangup') return { status: 200 };
    const billed = Number(form.BillDuration || form.Duration || 0);
    const answered = Boolean(form.AnswerTime?.trim()) || billed > 0;
    if (answered) {
        // The bridge reports the conversation itself (post_call); the line is down, so free its slot.
        await noteCarrierEnded(deps, call.orgId, call.id, billed > 0 ? billed : null);
        return { status: 200 };
    }
    const event: RiyaWebhookEvent = {
        kind: 'initiation_failure',
        eventId: `plivo-hangup:${uuid || call.id}`,
        eventTimestamp: Math.floor(deps.clock.now().getTime() / 1000),
        agentId: BRIDGE_AGENT_ID.plivo,
        conversationId: call.providerConversationId ?? bridgeConversationId('plivo', uuid || call.id),
        failureReason: plivoRingFailure(form.HangupCauseName || form.HangupCause || form.HangupCauseCode),
    };
    await applyConversationEvent(deps, call.orgId, call.id, event);
    return { status: 200 };
}
