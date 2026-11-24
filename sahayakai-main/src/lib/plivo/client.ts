/**
 * Plivo voice client — outbound dial, read-only call lookup, webhook signature (V3).
 *
 * Used only by the Sampark Riya path (src/lib/sampark/conversation/plivo-provider.ts). Plivo is a
 * phone CARRIER here: it rings the family and, on answer, streams the call's audio both ways to
 * SahayakAI's Riya bridge through a Plivo `<Stream>` (see plivo-riya.ts). Riya's conversation
 * runs on the bridge exactly as for Vobiz.
 *
 * WIRE CONTRACT (official docs, read 2026-11-24)
 *
 *   POST https://api.plivo.com/v1/Account/{auth_id}/Call/        HTTP Basic auth_id:auth_token
 *     JSON { from, to, answer_url, answer_method, hangup_url, hangup_method, ring_url, ring_method,
 *            ring_timeout, time_limit }
 *     -> 201 { message: "call fired", request_uuid, api_id }
 *     https://www.plivo.com/docs/voice/api/call/make-a-call
 *   GET  https://api.plivo.com/v1/Account/{auth_id}/Call/{call_uuid}/    (call detail record)
 *   Signature: X-Plivo-Signature-V3 / X-Plivo-Signature-V3-Nonce, HMAC-SHA256 (auth token) of
 *     "<url with sorted query>.<sorted POST params as name+value>.<nonce>", base64; the header may
 *     hold several comma-separated signatures (one per active token).
 *     https://www.plivo.com/docs/voice/concepts/signature-validation
 *
 * `from` / `to` are digits with the country code and no `+`. Credentials never leave this module
 * and no provider body is returned or logged (it carries account identifiers).
 */

import crypto from 'node:crypto';

import type { VobizDetailedFailure } from '@/lib/vobiz/client';

type Env = Record<string, string | undefined>;

export const PLIVO_DEFAULT_BASE_URL = 'https://api.plivo.com/v1';

export interface PlivoConfig {
    authId: string;
    authToken: string;
    /** Voice-enabled Plivo number (caller id), digits with country code. */
    fromNumber: string;
    baseUrl: string;
}

/** Names only in the problem list, never values. */
export function readPlivoConfig(env: Env = process.env): { ok: true; config: PlivoConfig } | { ok: false; problems: string[] } {
    const authId = env.PLIVO_AUTH_ID?.trim();
    const authToken = env.PLIVO_AUTH_TOKEN?.trim();
    const fromNumber = env.PLIVO_FROM_NUMBER?.trim();
    const baseUrl = (env.PLIVO_BASE_URL?.trim() || PLIVO_DEFAULT_BASE_URL).replace(/\/+$/, '');
    const problems: string[] = [];
    // Plivo Auth IDs are 20 upper-case alphanumerics (MA… main account, SA… subaccount).
    if (!authId || !/^[A-Z0-9]{20}$/.test(authId)) problems.push('PLIVO_AUTH_ID');
    if (!authToken) problems.push('PLIVO_AUTH_TOKEN');
    if (!fromNumber || toPlivoNumber(fromNumber).length < 10) problems.push('PLIVO_FROM_NUMBER');
    if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(`${baseUrl}/`)) problems.push('PLIVO_BASE_URL');
    if (problems.length || !authId || !authToken || !fromNumber) return { ok: false, problems };
    return { ok: true, config: { authId, authToken, fromNumber, baseUrl } };
}

/** E.164 or typed digits -> what Plivo expects (digits, country code, no `+`). A bare 10-digit Indian mobile gains 91. */
export function toPlivoNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
}

function basicAuth(cfg: Pick<PlivoConfig, 'authId' | 'authToken'>): string {
    return `Basic ${Buffer.from(`${cfg.authId}:${cfg.authToken}`, 'utf8').toString('base64')}`;
}

export interface PlivoPlaceOptions {
    to: string;
    answerUrl: string;
    hangupUrl: string;
    ringUrl?: string;
    ringTimeout: number;
    timeLimit: number;
}

export type PlivoPlaceResult = { ok: true; requestUuid: string } | { ok: false; failure: VobizDetailedFailure };

export const PLIVO_PLACE_TIMEOUT_MS = 8000;

const DND_BODY = /\b(dnd|ndnc|do not disturb)\b/i;

/**
 * Place one outbound call. Same failure categories as the Vobiz detailed dialler so the Sampark
 * mapping (and its "never auto-redial an unknown outcome" rule) is identical:
 *   429 rate_limited · 401/403 provider_unconfigured · DND 4xx dnd_blocked · other 4xx
 *   provider_rejected · 5xx/odd status provider_error (unknown) · throw/timeout network (unknown).
 */
export async function placePlivoCall(
    cfg: PlivoConfig,
    options: PlivoPlaceOptions,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = PLIVO_PLACE_TIMEOUT_MS,
): Promise<PlivoPlaceResult> {
    const to = toPlivoNumber(options.to);
    if (to.length < 10) return { ok: false, failure: { category: 'invalid_destination' } };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let res: Response;
        try {
            res = await fetchImpl(`${cfg.baseUrl}/Account/${cfg.authId}/Call/`, {
                method: 'POST',
                headers: { Authorization: basicAuth(cfg), 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    from: toPlivoNumber(cfg.fromNumber),
                    to,
                    answer_url: options.answerUrl,
                    answer_method: 'POST',
                    hangup_url: options.hangupUrl,
                    hangup_method: 'POST',
                    ...(options.ringUrl ? { ring_url: options.ringUrl, ring_method: 'POST' } : {}),
                    ring_timeout: options.ringTimeout,
                    time_limit: options.timeLimit,
                }),
                signal: controller.signal,
            });
        } catch {
            return { ok: false, failure: { category: 'network' } };
        }
        const status = res.status;
        if (status === 200 || status === 201 || status === 202) {
            let requestUuid = '';
            try {
                const body = (await res.json()) as { request_uuid?: unknown } | null;
                // `to` may hold several destinations, in which case request_uuid is an array; we send one.
                const r = body?.request_uuid;
                if (typeof r === 'string') requestUuid = r;
                else if (Array.isArray(r) && typeof r[0] === 'string') requestUuid = r[0];
            } catch {
                // an unreadable body costs the correlation id, not the call
            }
            return { ok: true, requestUuid };
        }
        if (status === 429) {
            const ra = Number(res.headers?.get?.('retry-after') ?? NaN);
            return { ok: false, failure: { category: 'rate_limited', status, ...(Number.isInteger(ra) && ra > 0 && ra <= 86_400 ? { retryAfterSeconds: ra } : {}) } };
        }
        if (status >= 400 && status <= 499) {
            let text = '';
            try {
                text = await res.text();
            } catch {
                // ignore
            }
            if (DND_BODY.test(text)) return { ok: false, failure: { category: 'dnd_blocked', status } };
            if (status === 401 || status === 403) return { ok: false, failure: { category: 'provider_unconfigured', status } };
            return { ok: false, failure: { category: 'provider_rejected', status } };
        }
        return { ok: false, failure: { category: 'provider_error', status } };
    } finally {
        clearTimeout(timer);
    }
}

/** What "Check status" needs from Plivo's call detail record. */
export interface PlivoCallRecord {
    ended: boolean;
    answered: boolean;
    billSeconds: number;
    hangupCause: string;
}

export type PlivoLookup = { kind: 'found'; record: PlivoCallRecord } | { kind: 'not_found' } | { kind: 'error'; status: number | null };

/** Read-only: GET /Call/{uuid}/ (the call detail record of a finished call). */
export async function getPlivoCall(cfg: PlivoConfig, callUuid: string, fetchImpl: typeof fetch = fetch): Promise<PlivoLookup> {
    let res: Response;
    try {
        res = await fetchImpl(`${cfg.baseUrl}/Account/${cfg.authId}/Call/${encodeURIComponent(callUuid)}/`, {
            headers: { Authorization: basicAuth(cfg), Accept: 'application/json' },
            signal: AbortSignal.timeout(20_000),
        });
    } catch {
        return { kind: 'error', status: null };
    }
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'error', status: res.status };
    let body: Record<string, unknown> = {};
    try {
        body = ((await res.json()) ?? {}) as Record<string, unknown>;
    } catch {
        return { kind: 'error', status: res.status };
    }
    const billSeconds = Number(body.bill_duration ?? body.call_duration ?? 0) || 0;
    return {
        kind: 'found',
        record: {
            ended: typeof body.end_time === 'string' && body.end_time !== '',
            answered: (typeof body.answer_time === 'string' && body.answer_time !== '') || billSeconds > 0,
            billSeconds,
            hangupCause: String(body.hangup_cause_name ?? body.hangup_cause ?? ''),
        },
    };
}

/**
 * Plivo hangup cause → the ElevenLabs-shaped initiation failure, for a call that never connected.
 * Plivo reports causes as names ("Busy Line", "No Answer", "Ring Timeout Reached", "Cancelled",
 * "Rejected", …) or codes; anything unrecognised stays `unknown` (never guessed).
 */
export function plivoRingFailure(cause: string | null | undefined): 'busy' | 'no-answer' | 'unknown' {
    const c = (cause ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (c.includes('BUSY')) return 'busy';
    if (c.includes('NO_ANSWER') || c.includes('TIMEOUT') || c.includes('CANCEL') || c.includes('REJECT') || c.includes('NO_USER_RESPONSE')) return 'no-answer';
    return 'unknown';
}

// ── webhook signature (V3) ────────────────────────────────────────────────────

/** The URL part of the signed string: scheme://host[:port]/path, plus the query sorted by name. */
function v3BaseUrl(url: string): string {
    const u = new URL(url);
    const keys = [...new Set([...u.searchParams.keys()])].sort();
    const query = keys.flatMap((k) => u.searchParams.getAll(k).sort().map((v) => `${k}=${v}`)).join('&');
    return `${u.protocol}//${u.host}${u.pathname}${query ? `?${query}` : ''}`;
}

/** The exact string Plivo signs for a POST callback (exported so tests pin it). */
export function plivoV3SignedString(url: string, params: Record<string, string>, nonce: string): string {
    const body = Object.keys(params)
        .sort()
        .map((k) => `${k}${params[k]}`)
        .join('');
    return `${v3BaseUrl(url)}.${body}.${nonce}`;
}

export function plivoV3Signature(authToken: string, url: string, params: Record<string, string>, nonce: string): string {
    return crypto.createHmac('sha256', authToken).update(plivoV3SignedString(url, params, nonce), 'utf8').digest('base64');
}

export type PlivoSignatureCheck = { ok: true } | { ok: false; reason: 'no_secret' | 'missing' | 'mismatch' };

/**
 * Verify X-Plivo-Signature-V3 for a POST callback.
 *
 * `url` must be the PUBLIC url Plivo called (our SAMPARK_PUBLIC_BASE_URL + path + query), not the
 * internal url the request arrived on behind Cloud Run's proxy. Constant-time compare against each
 * comma-separated signature (Plivo sends one per active auth token).
 */
export function verifyPlivoSignatureV3(
    authToken: string | undefined,
    url: string,
    params: Record<string, string>,
    nonce: string | null,
    signatureHeader: string | null,
): PlivoSignatureCheck {
    if (!authToken) return { ok: false, reason: 'no_secret' };
    if (!nonce || !signatureHeader) return { ok: false, reason: 'missing' };
    const expected = Buffer.from(plivoV3Signature(authToken, url, params, nonce));
    for (const candidate of signatureHeader.split(',')) {
        const got = Buffer.from(candidate.trim());
        if (got.length === expected.length && crypto.timingSafeEqual(got, expected)) return { ok: true };
    }
    return { ok: false, reason: 'mismatch' };
}
