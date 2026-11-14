/**
 * Riya over Vobiz: SahayakAI's own bridge (Vobiz media stream → Gemini Live, Riya's
 * workflow state machine in sahayakai-agents/telephony/riya.py) as the second real
 * provider behind the SAME Sampark start path, gates and records as ElevenLabs.
 *
 * What differs from ElevenLabs is only the transport:
 *   - start: we place the call on Vobiz ourselves (REST), with answer/hangup URLs bound by
 *     a short-lived token to ONE Sampark call (`sampark~{orgId}~{callId}`). No child data in
 *     any URL: the bridge fetches the 19 variables from a signed context endpoint.
 *   - results: the bridge posts ONE normalised `post_call` event (same shape the ElevenLabs
 *     webhook parser produces) to a signed endpoint; ring failures (busy / no answer) come from
 *     Vobiz's hangup callback as `initiation_failure`. Both go through `applyEvent()`.
 *
 * Secrets stay server-side: Vobiz credentials (VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN), the signing key
 * shared with the bridge (SAHAYAKAI_REQUEST_SIGNING_KEY). Nothing here is sent to a browser.
 */

import crypto from 'node:crypto';

import { placeVobizCallDetailed, readVobizConfig, type VobizConfig } from '@/lib/vobiz/client';
import { mintVobizToken, VOBIZ_DOMAINS } from '@/lib/vobiz/tokens';

import type { OutboundCallResult } from './elevenlabs-client';

type Env = Record<string, string | undefined>;

/** Agent id recorded on Vobiz calls (ElevenLabs calls record the hosted agent's id). */
export const VOBIZ_RIYA_AGENT_ID = 'sahayakai-vobiz-riya';

/** Token domains for the Sampark ↔ Vobiz ↔ bridge legs (distinct from the attendance ones). */
export const SAMPARK_VOBIZ_DOMAINS = {
    ANSWER: VOBIZ_DOMAINS.SAMPARK_RIYA_ANSWER,
    STATUS: VOBIZ_DOMAINS.SAMPARK_RIYA_STATUS,
    /** The bridge's own stream token domain (the bridge verifies it): unchanged. */
    STREAM: VOBIZ_DOMAINS.STREAM,
    /** The bridge asks for one call's variables with this. */
    CONTEXT: VOBIZ_DOMAINS.SAMPARK_RIYA_CONTEXT,
} as const;

export interface VobizRiyaConfig {
    vobiz: VobizConfig;
    /** https base the phone company calls back on (SAMPARK_PUBLIC_BASE_URL). */
    publicBaseUrl: string;
    /** https base of the bridge (VOBIZ_STREAM_BASE_URL); its wss origin goes into the <Stream>. */
    bridgeBaseUrl: string;
}

export type VobizRiyaConfigResult = { ok: true; config: VobizRiyaConfig } | { ok: false; problems: string[] };

function httpsBase(raw: string | undefined): string | null {
    const v = raw?.trim().replace(/\/+$/, '');
    if (!v) return null;
    try {
        const u = new URL(v);
        return u.protocol === 'https:' || (u.protocol === 'http:' && /^(127\.0\.0\.1|localhost)$/.test(u.hostname)) ? v : null;
    } catch {
        return null;
    }
}

/** Names only in `problems`, never values. */
export function readVobizRiyaConfig(env: Env = process.env): VobizRiyaConfigResult {
    const problems: string[] = [];
    if (env.SAMPARK_VOBIZ_RIYA_ENABLED !== 'true') problems.push('SAMPARK_VOBIZ_RIYA_ENABLED');
    const vobiz = readVobizConfig(env as NodeJS.ProcessEnv);
    if (!vobiz) problems.push('VOBIZ_AUTH_ID/VOBIZ_AUTH_TOKEN/VOBIZ_FROM_NUMBER');
    const publicBaseUrl = httpsBase(env.SAMPARK_PUBLIC_BASE_URL);
    if (!publicBaseUrl) problems.push('SAMPARK_PUBLIC_BASE_URL');
    const bridgeBaseUrl = httpsBase(env.VOBIZ_STREAM_BASE_URL);
    if (!bridgeBaseUrl) problems.push('VOBIZ_STREAM_BASE_URL');
    if (!env.SAHAYAKAI_REQUEST_SIGNING_KEY?.trim()) problems.push('SAHAYAKAI_REQUEST_SIGNING_KEY');
    if (problems.length || !vobiz || !publicBaseUrl || !bridgeBaseUrl) return { ok: false, problems };
    return { ok: true, config: { vobiz, publicBaseUrl, bridgeBaseUrl } };
}

/** The id every Vobiz-leg token carries: one Sampark call. No dots (token wire format). */
export function vobizRiyaRef(orgId: string, callId: string): string {
    return `sampark~${orgId}~${callId}`;
}

export function parseVobizRiyaRef(ref: string | null | undefined): { orgId: string; callId: string } | null {
    const m = /^sampark~([A-Za-z0-9_-]{1,128})~([a-f0-9]{32})$/.exec(ref ?? '');
    return m ? { orgId: m[1], callId: m[2] } : null;
}

/** Conversation id recorded for a Vobiz call: the Vobiz call uuid, namespaced so it can never collide with an ElevenLabs id. */
export function vobizConversationId(callUuid: string): string {
    return `vobiz:${callUuid}`;
}

/** Seconds Vobiz rings a family before giving up. */
export const RIYA_VOBIZ_RING_TIMEOUT_SECONDS = 30;
/**
 * Vobiz `time_limit` on every Riya call: Vobiz itself disconnects an answered call after this many
 * seconds, whatever happens to the bridge or to us. The bridge ends Riya's conversations at 600 s
 * (VOBIZ_MAX_CALL_SECONDS); this sits a minute above so the bridge's own goodbye wins. Without it
 * Vobiz's default is 4 hours.
 */
export const RIYA_VOBIZ_TIME_LIMIT_SECONDS = 660;
/**
 * After this long from placing it, a Riya Vobiz call can no longer be connected at the provider:
 * ring timeout + time limit + 3 minutes for carrier set-up and late callbacks. Only past this point
 * may a call with no reported end be recovered (and only after a provider lookup). It is below the
 * per-school lock lifetime (15 min), so a lock never lapses while a call may still be live.
 */
export const RIYA_VOBIZ_HARD_END_MS = (RIYA_VOBIZ_RING_TIMEOUT_SECONDS + RIYA_VOBIZ_TIME_LIMIT_SECONDS) * 1000 + 3 * 60_000;

export interface StartVobizRiyaInput {
    toNumberE164: string;
    orgId: string;
    callId: string;
}

/**
 * Place the call on Vobiz. Accepted → `{ kind: 'accepted', conversationId: vobiz:<uuid> }`.
 * A refusal maps onto the same categories as ElevenLabs; a network/5xx outcome is `unknown`
 * (the phone may ring: never auto-redialled, exactly as for ElevenLabs).
 */
export async function startVobizRiyaCall(
    cfg: VobizRiyaConfig,
    input: StartVobizRiyaInput,
    fetchImpl: typeof fetch = fetch,
): Promise<OutboundCallResult> {
    const ref = vobizRiyaRef(input.orgId, input.callId);
    const answer = await mintVobizToken(SAMPARK_VOBIZ_DOMAINS.ANSWER, ref, 15 * 60);
    const status = await mintVobizToken(SAMPARK_VOBIZ_DOMAINS.STATUS, ref, 60 * 60);
    const base = `${cfg.publicBaseUrl}/api/webhooks/vobiz-riya`;
    const placed = await placeVobizCallDetailed(
        cfg.vobiz,
        {
            to: input.toNumberE164,
            answerUrl: `${base}/answer?t=${encodeURIComponent(answer.token)}`,
            hangupUrl: `${base}/status?kind=hangup&t=${encodeURIComponent(status.token)}`,
            ringUrl: `${base}/status?kind=ring&t=${encodeURIComponent(status.token)}`,
            ringTimeout: RIYA_VOBIZ_RING_TIMEOUT_SECONDS,
            timeLimit: RIYA_VOBIZ_TIME_LIMIT_SECONDS,
        },
        fetchImpl,
    );
    if (placed.ok) {
        // An accepted call with no readable id still rang: give it a unique local id so it links.
        const uuid = placed.handle.requestUuid || `unknown-${crypto.randomUUID()}`;
        return { kind: 'accepted', conversationId: vobizConversationId(uuid), sipCallId: placed.handle.requestUuid || null };
    }
    const f = placed.failure;
    switch (f.category) {
        case 'provider_unconfigured':
            return { kind: 'rejected', category: 'auth', httpStatus: f.status ?? null };
        case 'rate_limited':
            // CPS / concurrency / error budget (Vobiz answers all three with 429). Nothing rang.
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

// ---- bridge ⇄ Sampark message signing ------------------------------------------------

/** Max age of a signed bridge message (seconds). */
export const BRIDGE_SIGNATURE_WINDOW_SECONDS = 15 * 60;

/** `t=<unix>,v1=<base64url HMAC-SHA256(key, "<t>.<body>")>` — the bridge signs post-call events this way. */
export function signBridgeBody(key: string, body: string, nowSec: number): string {
    const mac = crypto.createHmac('sha256', key).update(`${nowSec}.${body}`, 'utf8').digest('base64url');
    return `t=${nowSec},v1=${mac}`;
}

export function verifyBridgeSignature(
    key: string | undefined,
    body: string,
    header: string | null,
    nowSec: number,
): { ok: true } | { ok: false; reason: 'no_secret' | 'missing' | 'malformed' | 'stale' | 'mismatch' } {
    if (!key) return { ok: false, reason: 'no_secret' };
    if (!header) return { ok: false, reason: 'missing' };
    const m = /^t=(\d{1,12}),v1=([A-Za-z0-9_-]{20,100})$/.exec(header.trim());
    if (!m) return { ok: false, reason: 'malformed' };
    const t = Number(m[1]);
    if (Math.abs(nowSec - t) > BRIDGE_SIGNATURE_WINDOW_SECONDS) return { ok: false, reason: 'stale' };
    const expected = crypto.createHmac('sha256', key).update(`${t}.${body}`, 'utf8').digest('base64url');
    const a = Buffer.from(expected);
    const b = Buffer.from(m[2]);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'mismatch' };
    return { ok: true };
}

/** Vobiz hangup cause → the ElevenLabs-shaped initiation failure, when the call never connected. */
export function vobizRingFailure(cause: string | null | undefined): 'busy' | 'no-answer' | 'unknown' {
    switch ((cause ?? '').toUpperCase()) {
        case 'USER_BUSY':
            return 'busy';
        case 'NO_ANSWER':
        case 'NO_USER_RESPONSE':
        case 'TIMEOUT':
        case 'ORIGINATOR_CANCEL':
        case 'CALL_REJECTED':
            return 'no-answer';
        default:
            return 'unknown';
    }
}
