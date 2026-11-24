/**
 * Riya over Plivo: Plivo rings the family; on answer our answer webhook returns a bidirectional
 * Plivo `<Stream>` to SahayakAI's Riya bridge (`/telephony/plivo/stream`), where Riya's workflow
 * runs on Gemini Live exactly as for Vobiz. Same Sampark start path, gates, records and reducer.
 *
 *   start   POST Plivo /Call/ with answer/hangup/ring URLs bound by short-lived tokens to ONE
 *           Sampark call (`sampark~{orgId}~{callId}`). No child data in any URL.
 *   answer  /api/webhooks/plivo-riya/answer → `<Stream bidirectional keepCallAlive
 *           contentType="audio/x-mulaw;rate=8000">wss://bridge/telephony/plivo/stream?t=…</Stream>`
 *   status  /api/webhooks/plivo-riya/status?kind=ring|hangup → ringing / never-connected failure /
 *           carrier ended (token + Plivo V3 signature).
 *   result  the bridge posts the post-call event to the shared signed event leg.
 *
 * Plivo's stream protocol is the one Vobiz mirrors (start/media events in, playAudio/clearAudio
 * out, μ-law 8 kHz), so the bridge reuses its frame handling; ending the call is a Plivo REST
 * hangup from the bridge (keepCallAlive keeps the leg up when the socket closes).
 * Docs: https://www.plivo.com/docs/voice/xml/audio-streaming
 */

import crypto from 'node:crypto';

import { readPlivoConfig, placePlivoCall, type PlivoConfig } from '@/lib/plivo/client';
import { warmTelephony } from '@/lib/vobiz/warm';
import { mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';

import { carrierFailureToOutbound, httpsBase, readBridgeBaseUrl, RIYA_BRIDGE_RING_TIMEOUT_SECONDS, RIYA_BRIDGE_TIME_LIMIT_SECONDS } from './bridge-carrier';
import type { OutboundCallResult } from './elevenlabs-client';
import { bridgeConversationId } from './types';
import { vobizRiyaRef } from './vobiz-provider';

type Env = Record<string, string | undefined>;

export const SAMPARK_PLIVO_DOMAINS = {
    ANSWER: VOBIZ_DOMAINS.SAMPARK_RIYA_PLIVO_ANSWER,
    STATUS: VOBIZ_DOMAINS.SAMPARK_RIYA_PLIVO_STATUS,
    STREAM: VOBIZ_DOMAINS.PLIVO_STREAM,
} as const;

export interface PlivoRiyaConfig {
    plivo: PlivoConfig;
    publicBaseUrl: string;
    bridgeBaseUrl: string;
    /** `enforce` (default): a Plivo callback without a valid V3 signature is refused. `log`: refused only by token. */
    signatureMode: 'enforce' | 'log';
}

export type PlivoRiyaConfigResult = { ok: true; config: PlivoRiyaConfig } | { ok: false; problems: string[] };

/** Names only in `problems`, never values. */
export function readPlivoRiyaConfig(env: Env = process.env): PlivoRiyaConfigResult {
    const problems: string[] = [];
    if (env.SAMPARK_PLIVO_RIYA_ENABLED !== 'true') problems.push('SAMPARK_PLIVO_RIYA_ENABLED');
    const plivo = readPlivoConfig(env);
    if (!plivo.ok) problems.push(...plivo.problems);
    const publicBaseUrl = httpsBase(env.SAMPARK_PUBLIC_BASE_URL);
    if (!publicBaseUrl) problems.push('SAMPARK_PUBLIC_BASE_URL');
    const bridge = readBridgeBaseUrl(env);
    if (!bridge.url) problems.push(bridge.settingName);
    if (!env.SAHAYAKAI_REQUEST_SIGNING_KEY?.trim()) problems.push('SAHAYAKAI_REQUEST_SIGNING_KEY');
    const mode = env.SAMPARK_PLIVO_SIGNATURE_MODE?.trim() || 'enforce';
    if (mode !== 'enforce' && mode !== 'log') problems.push('SAMPARK_PLIVO_SIGNATURE_MODE');
    if (problems.length || !plivo.ok || !publicBaseUrl || !bridge.url) return { ok: false, problems };
    return { ok: true, config: { plivo: plivo.config, publicBaseUrl, bridgeBaseUrl: bridge.url, signatureMode: mode as 'enforce' | 'log' } };
}

export interface StartPlivoRiyaInput {
    toNumberE164: string;
    orgId: string;
    callId: string;
}

/** Place the call on Plivo. Accepted → `plivo:<request_uuid>`; refusals map like Vobiz; unknown is never redialled. */
export async function startPlivoRiyaCall(cfg: PlivoRiyaConfig, input: StartPlivoRiyaInput, fetchImpl: typeof fetch = fetch): Promise<OutboundCallResult> {
    const ref = vobizRiyaRef(input.orgId, input.callId);
    const answer = await mintVobizToken(SAMPARK_PLIVO_DOMAINS.ANSWER, ref, 15 * 60);
    const status = await mintVobizToken(SAMPARK_PLIVO_DOMAINS.STATUS, ref, 60 * 60);
    const base = `${cfg.publicBaseUrl}/api/webhooks/plivo-riya`;
    warmTelephony();
    const placed = await placePlivoCall(
        cfg.plivo,
        {
            to: input.toNumberE164,
            answerUrl: `${base}/answer?t=${encodeURIComponent(answer.token)}`,
            hangupUrl: `${base}/status?kind=hangup&t=${encodeURIComponent(status.token)}`,
            ringUrl: `${base}/status?kind=ring&t=${encodeURIComponent(status.token)}`,
            ringTimeout: RIYA_BRIDGE_RING_TIMEOUT_SECONDS,
            timeLimit: RIYA_BRIDGE_TIME_LIMIT_SECONDS,
        },
        fetchImpl,
    );
    if (placed.ok) {
        const uuid = placed.requestUuid || `unknown-${crypto.randomUUID()}`;
        return { kind: 'accepted', conversationId: bridgeConversationId('plivo', uuid), sipCallId: placed.requestUuid || null };
    }
    return carrierFailureToOutbound(placed.failure);
}
