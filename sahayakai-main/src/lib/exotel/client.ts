/**
 * Exotel voice client — outbound call straight into a bidirectional AgentStream, read-only lookup.
 *
 * Used only by the Sampark Riya path (src/lib/sampark/conversation/exotel-provider.ts). Exotel is a
 * phone CARRIER here. Its "Connect Voice AI" mode takes the WebSocket URL on the call itself, so
 * each call carries its own short-lived, signed bridge URL and no App Bazaar flow is needed:
 *
 *   POST https://{subdomain}/v1/Accounts/{sid}/Calls/connect         HTTP Basic api_key:api_token
 *     form: From (family) · CallerId (ExoPhone) · StreamUrl (wss, ≤600 chars) ·
 *           StreamType=bidirectional · TimeLimit · TimeOut · StatusCallback ·
 *           StatusCallbackEvents[]=terminal · StatusCallbackContentType=application/json · CustomField
 *     -> 200 { Call: { Sid, Status, ... } }
 *     https://developer.exotel.com/docs/agentstream/connect-voice-ai
 *   GET  https://{subdomain}/v1/Accounts/{sid}/Calls/{CallSid}.json  (call details)
 *
 * Region: the subdomain is the account's cluster — `api.exotel.com` (Singapore) or
 * `api.in.exotel.com` (Mumbai, India accounts). Calling the wrong one fails authentication, so it
 * is required explicitly rather than defaulted
 * (https://developer.exotel.com/docs/references/authentication).
 *
 * Exotel does not sign webhooks (https://developer.exotel.com/docs/references/webhooks); our status
 * callback URL carries a purpose-scoped token bound to one call instead (same scheme as Vobiz).
 */

import type { VobizDetailedFailure } from '@/lib/vobiz/client';

type Env = Record<string, string | undefined>;

/** The two documented API clusters. Anything else is refused (a typo would fail auth at dial time). */
export const EXOTEL_SUBDOMAINS = ['api.exotel.com', 'api.in.exotel.com'] as const;

export interface ExotelConfig {
    apiKey: string;
    apiToken: string;
    accountSid: string;
    /** `api.exotel.com` or `api.in.exotel.com`. */
    subdomain: string;
    /** The ExoPhone (virtual number) the family sees as caller id. */
    callerId: string;
    /** Test-only override of the https origin (local fake carrier). */
    baseOrigin: string;
}

/** Names only in the problem list, never values. */
export function readExotelConfig(env: Env = process.env): { ok: true; config: ExotelConfig } | { ok: false; problems: string[] } {
    const apiKey = env.EXOTEL_API_KEY?.trim();
    const apiToken = env.EXOTEL_API_TOKEN?.trim();
    const accountSid = env.EXOTEL_ACCOUNT_SID?.trim();
    const subdomain = env.EXOTEL_SUBDOMAIN?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const callerId = env.EXOTEL_CALLER_ID?.trim();
    const problems: string[] = [];
    if (!apiKey) problems.push('EXOTEL_API_KEY');
    if (!apiToken) problems.push('EXOTEL_API_TOKEN');
    if (!accountSid || !/^[A-Za-z0-9_-]{2,64}$/.test(accountSid)) problems.push('EXOTEL_ACCOUNT_SID');
    if (!subdomain || !(EXOTEL_SUBDOMAINS as readonly string[]).includes(subdomain)) problems.push('EXOTEL_SUBDOMAIN');
    if (!callerId || callerId.replace(/\D/g, '').length < 10) problems.push('EXOTEL_CALLER_ID');
    // Local fake carrier only (http on localhost); production always uses https://{subdomain}.
    const override = env.EXOTEL_BASE_ORIGIN?.trim().replace(/\/+$/, '');
    if (override && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(override)) problems.push('EXOTEL_BASE_ORIGIN');
    if (problems.length || !apiKey || !apiToken || !accountSid || !subdomain || !callerId) return { ok: false, problems };
    return { ok: true, config: { apiKey, apiToken, accountSid, subdomain, callerId, baseOrigin: override || `https://${subdomain}` } };
}

/** E.164 → the form Exotel's examples use for Indian numbers (0-prefixed national) or +E.164 elsewhere. */
export function toExotelNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `0${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `0${digits.slice(2)}`;
    return `+${digits}`;
}

function basicAuth(cfg: Pick<ExotelConfig, 'apiKey' | 'apiToken'>): string {
    return `Basic ${Buffer.from(`${cfg.apiKey}:${cfg.apiToken}`, 'utf8').toString('base64')}`;
}

/** Documented maximum length of StreamUrl. */
export const EXOTEL_STREAM_URL_MAX = 600;

export interface ExotelPlaceOptions {
    to: string;
    streamUrl: string;
    statusCallbackUrl: string;
    /** Seconds Exotel rings before giving up (TimeOut). */
    ringTimeout: number;
    /** Longest the call may last once answered (TimeLimit, max 14400). */
    timeLimit: number;
    /** Our own reference, echoed back in callbacks (≤128 chars). No personal data. */
    customField: string;
}

export type ExotelPlaceResult = { ok: true; callSid: string } | { ok: false; failure: VobizDetailedFailure };

export const EXOTEL_PLACE_TIMEOUT_MS = 8000;

const DND_BODY = /\b(dnd|ndnc|do not disturb)\b/i;

/** Same failure categories as the Vobiz / Plivo diallers (unknown outcomes are never redialled). */
export async function placeExotelStreamCall(
    cfg: ExotelConfig,
    options: ExotelPlaceOptions,
    fetchImpl: typeof fetch = fetch,
    timeoutMs = EXOTEL_PLACE_TIMEOUT_MS,
): Promise<ExotelPlaceResult> {
    const digits = options.to.replace(/\D/g, '');
    if (digits.length < 10) return { ok: false, failure: { category: 'invalid_destination' } };
    if (options.streamUrl.length > EXOTEL_STREAM_URL_MAX || !/^wss?:\/\//.test(options.streamUrl)) {
        // Never sent: Exotel would refuse it, and a cut-off URL would carry a broken token.
        return { ok: false, failure: { category: 'provider_rejected' } };
    }
    const form = new URLSearchParams();
    form.set('From', toExotelNumber(options.to));
    form.set('CallerId', cfg.callerId);
    form.set('StreamUrl', options.streamUrl);
    form.set('StreamType', 'bidirectional');
    form.set('TimeLimit', String(Math.min(14400, Math.max(1, Math.floor(options.timeLimit)))));
    form.set('TimeOut', String(Math.max(1, Math.floor(options.ringTimeout))));
    form.set('StatusCallback', options.statusCallbackUrl);
    form.append('StatusCallbackEvents[]', 'terminal');
    form.append('StatusCallbackEvents[]', 'answered');
    form.set('StatusCallbackContentType', 'application/json');
    form.set('CustomField', options.customField.slice(0, 128));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let res: Response;
        try {
            res = await fetchImpl(`${cfg.baseOrigin}/v1/Accounts/${encodeURIComponent(cfg.accountSid)}/Calls/connect.json`, {
                method: 'POST',
                headers: { Authorization: basicAuth(cfg), 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
                body: form.toString(),
                signal: controller.signal,
            });
        } catch {
            return { ok: false, failure: { category: 'network' } };
        }
        const status = res.status;
        if (status === 200 || status === 201 || status === 202) {
            let callSid = '';
            try {
                const body = (await res.json()) as { Call?: { Sid?: unknown } } | null;
                if (typeof body?.Call?.Sid === 'string') callSid = body.Call.Sid;
            } catch {
                // an unreadable body costs the correlation id, not the call
            }
            return { ok: true, callSid };
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

export interface ExotelCallRecord {
    /** Exotel status: queued | ringing | in-progress | completed | failed | busy | no-answer | canceled. */
    status: string;
    durationSeconds: number;
}

export type ExotelLookup = { kind: 'found'; record: ExotelCallRecord } | { kind: 'not_found' } | { kind: 'error'; status: number | null };

/** Read-only: GET /Calls/{CallSid}.json */
export async function getExotelCall(cfg: ExotelConfig, callSid: string, fetchImpl: typeof fetch = fetch): Promise<ExotelLookup> {
    let res: Response;
    try {
        res = await fetchImpl(`${cfg.baseOrigin}/v1/Accounts/${encodeURIComponent(cfg.accountSid)}/Calls/${encodeURIComponent(callSid)}.json`, {
            headers: { Authorization: basicAuth(cfg), Accept: 'application/json' },
            signal: AbortSignal.timeout(20_000),
        });
    } catch {
        return { kind: 'error', status: null };
    }
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'error', status: res.status };
    try {
        const body = (await res.json()) as { Call?: { Status?: unknown; Duration?: unknown } } | null;
        return {
            kind: 'found',
            record: { status: String(body?.Call?.Status ?? '').toLowerCase(), durationSeconds: Number(body?.Call?.Duration ?? 0) || 0 },
        };
    } catch {
        return { kind: 'error', status: res.status };
    }
}

/**
 * Exotel status → how a call ended. Exotel reports `completed` only for an ANSWERED call (an
 * unanswered one is busy / no-answer / failed / canceled), so `completed` is a carrier end and
 * the bridge's post-call event settles the conversation. Anything else is still `open`.
 */
export function exotelOutcome(status: string | null | undefined): 'answered' | 'busy' | 'no-answer' | 'unknown' | 'open' {
    switch ((status ?? '').toLowerCase()) {
        case 'completed':
            return 'answered';
        case 'busy':
            return 'busy';
        case 'no-answer':
        case 'canceled':
        case 'cancelled':
            return 'no-answer';
        case 'failed':
            return 'unknown';
        default:
            return 'open';
    }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Sampark voice calls (simple outbound via ExoML, not AgentStream).
 *
 * Separate config + call path from the Riya bridge above. Reads its own env vars
 * (never hard-coded):
 *   EXOTEL_SID          — Exotel account SID
 *   EXOTEL_API_KEY      — Exotel API key
 *   EXOTEL_API_TOKEN    — Exotel API token
 *   EXOTEL_SUBDOMAIN    — API subdomain, e.g. api.exotel.com
 *   EXOTEL_CALLER_ID    — Verified Exotel phone number (E.164)
 *   EXOTEL_APP_ID       — Exotel app ID for the call flow
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface SamparkExotelConfig {
    sid: string;
    apiKey: string;
    apiToken: string;
    subdomain: string;
    callerId: string;
    appId: string;
}

export interface ExotelCallResult {
    ok: true;
    callSid: string;
    status: string;
}
export interface ExotelCallError {
    ok: false;
    code: string;
    message: string;
    status?: number;
}
export type ExotelCallResponse = ExotelCallResult | ExotelCallError;

function readSamparkConfig(): SamparkExotelConfig | null {
    const sid = process.env.EXOTEL_SID;
    const apiKey = process.env.EXOTEL_API_KEY;
    const apiToken = process.env.EXOTEL_API_TOKEN;
    const subdomain = process.env.EXOTEL_SUBDOMAIN ?? 'api.exotel.com';
    const callerId = process.env.EXOTEL_CALLER_ID;
    const appId = process.env.EXOTEL_APP_ID;
    if (!sid || !apiKey || !apiToken || !callerId || !appId) return null;
    return { sid, apiKey, apiToken, subdomain, callerId, appId };
}

/** Place an outbound Sampark voice call through Exotel (v1 API). */
export async function placeExotelCall(
    to: string,
    opts: { url?: string; statusCallback?: string; timeout?: number } = {}
): Promise<ExotelCallResponse> {
    const cfg = readSamparkConfig();
    if (!cfg) {
        return {
            ok: false,
            code: 'VOICE_NOT_CONFIGURED',
            message: 'Exotel credentials are not set. Set EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_CALLER_ID, EXOTEL_APP_ID.',
            status: 503,
        };
    }

    const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiToken}`).toString('base64');
    const url = `https://${cfg.subdomain}/v1/Accounts/${cfg.sid}/Calls/connect`;

    const params = new URLSearchParams();
    params.set('From', cfg.callerId);
    params.set('To', to);
    params.set('CallerId', cfg.callerId);
    params.set('Url', opts.url ?? `https://${cfg.subdomain}/v1/Accounts/${cfg.sid}/Apps/${cfg.appId}/Exoml`);
    if (opts.statusCallback) params.set('StatusCallback', opts.statusCallback);
    params.set('TimeLimit', String(opts.timeout ?? 30));

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        const text = await res.text();

        if (!res.ok) {
            const msg = text.match(/<Message>(.*?)<\/Message>/)?.[1] ?? text.slice(0, 200);
            return {
                ok: false,
                code: 'EXOTEL_ERROR',
                message: msg,
                status: res.status,
            };
        }

        const callSidMatch = text.match(/<Sid>(.*?)<\/Sid>/);
        const statusMatch = text.match(/<Status>(.*?)<\/Status>/);

        return {
            ok: true,
            callSid: callSidMatch?.[1] ?? `exotel-${Date.now()}`,
            status: statusMatch?.[1] ?? 'initiated',
        };
    } catch (error) {
        return {
            ok: false,
            code: 'EXOTEL_REQUEST_FAILED',
            message: error instanceof Error ? error.message : 'Unknown Exotel error',
            status: 502,
        };
    }
}

/** Check whether Exotel is configured for Sampark voice calls at all. */
export function exotelConfigured(): boolean {
    return readSamparkConfig() !== null;
}
