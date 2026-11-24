/**
 * Riya over Exotel: Exotel rings the family and, on answer, opens a bidirectional AgentStream
 * WebSocket to SahayakAI's Riya bridge (`/telephony/exotel/stream`), where Riya's workflow runs on
 * Gemini Live exactly as for Vobiz. Same Sampark start path, gates, records and reducer.
 *
 *   start   POST Exotel Calls/connect with StreamUrl = wss://bridge/telephony/exotel/stream?t=<token>
 *           (signed, bound to ONE Sampark call, minted at dial time because Exotel takes the URL up
 *           front) and a status callback bound by its own token. No child data in any URL.
 *   status  /api/webhooks/exotel-riya/status → answered / terminal (busy, no-answer, failed,
 *           completed). Exotel does not sign webhooks; the token is the authentication.
 *   result  the bridge posts the post-call event to the shared signed event leg.
 *
 * Media: Exotel streams 16-bit PCM, 8 kHz, mono, little-endian, base64 (not μ-law), with events
 * connected/start/media/dtmf/mark/stop and outbound media/mark/clear; the bridge converts at the
 * edge (sahayakai-agents telephony/exotel_frames.py). The stream ends when the bridge closes the
 * socket; TimeLimit caps the call regardless.
 * Docs: https://developer.exotel.com/docs/agentstream/connect-voice-ai ,
 *       https://developer.exotel.com/docs/agentstream/websocket-protocol
 */

import crypto from 'node:crypto';

import { EXOTEL_STREAM_URL_MAX, placeExotelStreamCall, readExotelConfig, type ExotelConfig } from '@/lib/exotel/client';
import { toWebSocketOrigin } from '@/lib/vobiz/answer-xml';
import { warmTelephony } from '@/lib/vobiz/warm';
import { mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';

import { carrierFailureToOutbound, httpsBase, readBridgeBaseUrl, RIYA_BRIDGE_RING_TIMEOUT_SECONDS, RIYA_BRIDGE_TIME_LIMIT_SECONDS } from './bridge-carrier';
import type { OutboundCallResult } from './elevenlabs-client';
import { bridgeConversationId } from './types';
import { vobizRiyaRef } from './vobiz-provider';

type Env = Record<string, string | undefined>;

export const SAMPARK_EXOTEL_DOMAINS = {
    STATUS: VOBIZ_DOMAINS.SAMPARK_RIYA_EXOTEL_STATUS,
    STREAM: VOBIZ_DOMAINS.EXOTEL_STREAM,
} as const;

/**
 * The stream token is minted at DIAL time (Exotel takes the URL with the call), so it must outlive
 * ring + answer: 30 s ring plus generous carrier set-up. It is burned on first use by the bridge.
 */
export const EXOTEL_STREAM_TOKEN_TTL_SECONDS = 300;

/** Longest stream token we put in the path (kept well inside Exotel's 600-character URL limit). */
export const EXOTEL_STREAM_TOKEN_MAX = 256;

export interface ExotelRiyaConfig {
    exotel: ExotelConfig;
    publicBaseUrl: string;
    bridgeBaseUrl: string;
}

export type ExotelRiyaConfigResult = { ok: true; config: ExotelRiyaConfig } | { ok: false; problems: string[] };

/** Names only in `problems`, never values. */
export function readExotelRiyaConfig(env: Env = process.env): ExotelRiyaConfigResult {
    const problems: string[] = [];
    if (env.SAMPARK_EXOTEL_RIYA_ENABLED !== 'true') problems.push('SAMPARK_EXOTEL_RIYA_ENABLED');
    const exotel = readExotelConfig(env);
    if (!exotel.ok) problems.push(...exotel.problems);
    const publicBaseUrl = httpsBase(env.SAMPARK_PUBLIC_BASE_URL);
    if (!publicBaseUrl) problems.push('SAMPARK_PUBLIC_BASE_URL');
    const bridge = readBridgeBaseUrl(env);
    if (!bridge.url) problems.push(bridge.settingName);
    if (!env.SAHAYAKAI_REQUEST_SIGNING_KEY?.trim()) problems.push('SAHAYAKAI_REQUEST_SIGNING_KEY');
    if (problems.length || !exotel.ok || !publicBaseUrl || !bridge.url) return { ok: false, problems };
    return { ok: true, config: { exotel: exotel.config, publicBaseUrl, bridgeBaseUrl: bridge.url } };
}

export interface StartExotelRiyaInput {
    toNumberE164: string;
    orgId: string;
    callId: string;
}

/**
 * The bridge URL Exotel opens on answer. Exported so tests pin its shape and length limits.
 *
 * `?t=<token>` is a CUSTOM PARAMETER, not a URL Exotel keeps: Exotel opens the bare path and hands
 * the query's pairs back inside its first frames (seen on a real call, 2026-11-24). The bridge reads
 * the token from there before anything billable starts. Exotel allows up to 3 pairs, 256 chars.
 */
export function exotelStreamUrl(bridgeBaseUrl: string, streamToken: string): string | null {
    const origin = toWebSocketOrigin(bridgeBaseUrl);
    if (!origin) return null;
    if (!/^[A-Za-z0-9~._-]+$/.test(streamToken) || streamToken.length > EXOTEL_STREAM_TOKEN_MAX) return null;
    const query = new URLSearchParams({ t: streamToken }).toString();
    if (query.length > EXOTEL_STREAM_TOKEN_MAX) return null;
    const url = `${origin}/telephony/exotel/stream?${query}`;
    return url.length <= EXOTEL_STREAM_URL_MAX ? url : null;
}

/** Place the call on Exotel. Accepted → `exotel:<CallSid>`; refusals map like Vobiz; unknown is never redialled. */
export async function startExotelRiyaCall(cfg: ExotelRiyaConfig, input: StartExotelRiyaInput, fetchImpl: typeof fetch = fetch): Promise<OutboundCallResult> {
    const ref = vobizRiyaRef(input.orgId, input.callId);
    const stream = await mintVobizToken(SAMPARK_EXOTEL_DOMAINS.STREAM, ref, EXOTEL_STREAM_TOKEN_TTL_SECONDS);
    const status = await mintVobizToken(SAMPARK_EXOTEL_DOMAINS.STATUS, ref, 60 * 60);
    const streamUrl = exotelStreamUrl(cfg.bridgeBaseUrl, stream.token);
    // Too long for Exotel (a very long school id): refuse before anything rings.
    if (!streamUrl) return { kind: 'rejected', category: 'invalid_request', httpStatus: null, providerMessage: 'stream_url_too_long' };
    warmTelephony();
    const placed = await placeExotelStreamCall(
        cfg.exotel,
        {
            to: input.toNumberE164,
            streamUrl,
            statusCallbackUrl: `${cfg.publicBaseUrl}/api/webhooks/exotel-riya/status?t=${encodeURIComponent(status.token)}`,
            ringTimeout: RIYA_BRIDGE_RING_TIMEOUT_SECONDS,
            timeLimit: RIYA_BRIDGE_TIME_LIMIT_SECONDS,
            // Our call id only (opaque hex): lets an operator match Exotel's dashboard to a record.
            customField: input.callId,
        },
        fetchImpl,
    );
    if (placed.ok) {
        const sid = placed.callSid || `unknown-${crypto.randomUUID()}`;
        return { kind: 'accepted', conversationId: bridgeConversationId('exotel', sid), sipCallId: placed.callSid || null };
    }
    return carrierFailureToOutbound(placed.failure);
}
