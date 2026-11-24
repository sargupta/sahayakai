/**
 * What the three bridge carriers (Vobiz, Plivo, Exotel) share on the Sampark side.
 *
 * Each carrier rings the family itself and streams the call's audio to SahayakAI's Riya bridge.
 * Riya's context (GET …/vobiz-riya/context) and post-call result (POST …/vobiz-riya/event) are the
 * SAME signed legs for all three — the bridge has one client for them — so only the carrier leg
 * differs per provider. This module holds the pieces that must not drift between carriers.
 */

import type { VobizDetailedFailure } from '@/lib/vobiz/client';

import type { OutboundCallResult } from './elevenlabs-client';
import { RIYA_VOBIZ_RING_TIMEOUT_SECONDS, RIYA_VOBIZ_TIME_LIMIT_SECONDS, VOBIZ_RIYA_AGENT_ID } from './vobiz-provider';
import type { BridgeCarrier } from './types';

type Env = Record<string, string | undefined>;

/** Agent id recorded on bridge calls, per carrier (ElevenLabs calls record the hosted agent's id). */
export const BRIDGE_AGENT_ID: Record<BridgeCarrier, string> = {
    vobiz: VOBIZ_RIYA_AGENT_ID,
    plivo: 'sahayakai-plivo-riya',
    exotel: 'sahayakai-exotel-riya',
};

/** Same ring timeout and hard time limit on every carrier: the bridge ends Riya at 600 s, the carrier a minute later. */
export const RIYA_BRIDGE_RING_TIMEOUT_SECONDS = RIYA_VOBIZ_RING_TIMEOUT_SECONDS;
export const RIYA_BRIDGE_TIME_LIMIT_SECONDS = RIYA_VOBIZ_TIME_LIMIT_SECONDS;

/** An https base URL (or http on localhost), trailing slashes removed; null otherwise. */
export function httpsBase(raw: string | undefined): string | null {
    const v = raw?.trim().replace(/\/+$/, '');
    if (!v) return null;
    try {
        const u = new URL(v);
        return u.protocol === 'https:' || (u.protocol === 'http:' && /^(127\.0\.0\.1|localhost)$/.test(u.hostname)) ? v : null;
    } catch {
        return null;
    }
}

/**
 * The bridge's https base. One bridge serves every carrier: RIYA_BRIDGE_BASE_URL when set,
 * else the existing VOBIZ_STREAM_BASE_URL (so a Vobiz-only deployment needs no new setting).
 */
export function readBridgeBaseUrl(env: Env): { url: string | null; settingName: string } {
    if (env.RIYA_BRIDGE_BASE_URL?.trim()) return { url: httpsBase(env.RIYA_BRIDGE_BASE_URL), settingName: 'RIYA_BRIDGE_BASE_URL' };
    return { url: httpsBase(env.VOBIZ_STREAM_BASE_URL), settingName: 'RIYA_BRIDGE_BASE_URL' };
}

/** A carrier's refusal → the same categories ElevenLabs and Vobiz use. Network/5xx = unknown (never auto-redialled). */
export function carrierFailureToOutbound(f: VobizDetailedFailure): OutboundCallResult {
    switch (f.category) {
        case 'provider_unconfigured':
            return { kind: 'rejected', category: 'auth', httpStatus: f.status ?? null };
        case 'rate_limited':
            return { kind: 'rejected', category: 'rate_limited', httpStatus: f.status ?? null, ...(f.retryAfterSeconds ? { providerMessage: `retry_after=${f.retryAfterSeconds}` } : {}) };
        case 'invalid_destination':
            return { kind: 'rejected', category: 'invalid_request', httpStatus: null };
        case 'dnd_blocked':
            return { kind: 'rejected', category: 'provider_rejected', httpStatus: f.status ?? null, providerMessage: 'dnd_blocked' };
        case 'provider_rejected':
            return { kind: 'rejected', category: 'provider_rejected', httpStatus: f.status ?? null };
        case 'provider_error':
            return { kind: 'unknown', category: 'server_error', httpStatus: f.status ?? null };
        default:
            return { kind: 'unknown', category: 'network', httpStatus: null };
    }
}
