/**
 * Vobiz telephony client — outbound dial + active hangup.
 *
 * WHY THIS EXISTS
 *
 * Parent calls have always gone out over Twilio, whose account is on TRIAL and
 * therefore reaches exactly one verified number (`+916363740720`). Every real
 * parent number is rejected at the provider, so the feature is unusable in the
 * field regardless of what the app does. Vobiz is already the company's voice
 * carrier for the Suraksha agent and owns a real Indian origination number, so
 * routing parent calls through it removes the blocker outright rather than
 * waiting on a Twilio upgrade.
 *
 * WIRE CONTRACT (taken from the working Suraksha dialer, not from docs)
 *
 *   POST {BASE}/Account/{AUTH_ID}/Call/
 *   headers: X-Auth-ID, X-Auth-Token, Content-Type: application/json
 *   body:    { from, to, answer_url, answer_method, hangup_url, ring_url, ring_timeout }
 *   -> 200/201/202 with { request_uuid }
 *
 * `to` and `from` are BARE DIGITS with the country code and no `+`. Our stored
 * `parentPhone` is E.164, so it is normalised here rather than at each call
 * site — passing a `+`-prefixed number silently fails to connect.
 */

/** What the provider returns once a call is accepted for dialling. */
export interface VobizCallHandle {
    /** Vobiz's own identifier. Stored as `callSid` so downstream code is provider-agnostic. */
    requestUuid: string;
}

export interface VobizConfig {
    authId: string;
    authToken: string;
    baseUrl: string;
    fromNumber: string;
}

/**
 * Read + validate provider configuration.
 *
 * Returns `null` rather than throwing so the caller can map a missing
 * configuration onto the same `provider_unconfigured` category the Twilio path
 * already uses — an operator problem where retrying never helps.
 */
export function readVobizConfig(env: NodeJS.ProcessEnv = process.env): VobizConfig | null {
    const authId = env.VOBIZ_AUTH_ID?.trim();
    const authToken = env.VOBIZ_AUTH_TOKEN?.trim();
    const fromNumber = env.VOBIZ_FROM_NUMBER?.trim();
    // Default matches the Suraksha deployment. Overridable so a staging tenant
    // never has to be reached by editing code.
    const baseUrl = (env.VOBIZ_BASE_URL?.trim() || 'https://api.vobiz.ai/api/v1').replace(/\/+$/, '');
    if (!authId || !authToken || !fromNumber) return null;
    return { authId, authToken, baseUrl, fromNumber };
}

/**
 * E.164 (or anything a human typed) -> the bare digit string Vobiz expects.
 *
 * A ten-digit Indian mobile gains the `91` country code, matching the
 * normalisation the Suraksha dialer performs. Everything else keeps its digits
 * in order; we never invent a country code for a number that already has one.
 */
export function toVobizNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
}

export interface PlaceCallOptions {
    to: string;
    answerUrl: string;
    hangupUrl: string;
    ringUrl?: string;
    /** Seconds to ring before abandoning. Mirrors the Twilio path's 30s. */
    ringTimeout?: number;
}

/** Categories the caller maps onto user-facing errors. Mirrors `twilio-errors`. */
export type VobizFailureCategory =
    | 'provider_unconfigured'
    | 'invalid_destination'
    | 'provider_rejected'
    | 'network';

export interface VobizFailure {
    category: VobizFailureCategory;
    /** Provider HTTP status, when there was a response at all. */
    status?: number;
}

export type VobizResult =
    | { ok: true; handle: VobizCallHandle }
    | { ok: false; failure: VobizFailure };

/**
 * Place one outbound call.
 *
 * The provider body is never returned to the caller and never logged verbatim —
 * it carries account identifiers. Callers receive a category only.
 */
export async function placeVobizCall(
    config: VobizConfig,
    options: PlaceCallOptions,
    fetchImpl: typeof fetch = fetch,
): Promise<VobizResult> {
    const to = toVobizNumber(options.to);
    // A short or empty destination would otherwise be handed to the provider,
    // which bills the attempt and returns an opaque rejection.
    if (to.length < 10) {
        return { ok: false, failure: { category: 'invalid_destination' } };
    }

    let res: Response;
    try {
        res = await fetchImpl(`${config.baseUrl}/Account/${config.authId}/Call/`, {
            method: 'POST',
            headers: {
                'X-Auth-ID': config.authId,
                'X-Auth-Token': config.authToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: toVobizNumber(config.fromNumber),
                to,
                answer_url: options.answerUrl,
                // The answer webhook is fetched with POST. Vobiz posts the call
                // parameters (CallUUID, To, From) as form fields, which the answer
                // route needs in order to bind the stream to this leg.
                answer_method: 'POST',
                hangup_url: options.hangupUrl,
                ...(options.ringUrl ? { ring_url: options.ringUrl } : {}),
                ring_timeout: options.ringTimeout ?? 30,
            }),
        });
    } catch {
        return { ok: false, failure: { category: 'network' } };
    }

    if (!(res.status === 200 || res.status === 201 || res.status === 202)) {
        return {
            ok: false,
            failure: {
                // 401/403 mean the credentials or the account are wrong: an
                // operator fix, not something a retry resolves.
                category: res.status === 401 || res.status === 403
                    ? 'provider_unconfigured'
                    : 'provider_rejected',
                status: res.status,
            },
        };
    }

    const body = (await res.json().catch(() => ({}))) as { request_uuid?: string };
    return {
        ok: true,
        handle: {
            // Vobiz has accepted the call even if we cannot read an id back. Losing
            // the id costs us status correlation, not the call, so we keep going
            // with an empty string rather than failing a connected call.
            requestUuid: body.request_uuid ?? '',
        },
    };
}

// ── Detailed placement (Sampark notice calls, hardening H7) ─────────────────
//
// `placeVobizCall` above is the teacher parent-call path's contract and stays
// exactly as it is. The Sampark dispatcher needs finer answers than its four
// categories, because two of them hide decisions that matter to a family:
//
//   - a 429 is the carrier saying "not now": nothing rang, so the family's
//     attempt must not be spent (the dispatcher requeues it shortly);
//   - a 5xx, or no answer at all, is an UNKNOWN outcome: the carrier may have
//     placed the call before failing to tell us, so it must never be re-dialled
//     automatically (a person decides);
//   - a DND / NDNC refusal must not be retried like an ordinary rejection.
//
// And it bounds the request with a timeout: `fetch` has none, and a dispatcher
// tick blocked on one hung request stops every school behind it.

/** Default time to wait for Vobiz to accept or refuse a call before treating the outcome as unknown. */
export const VOBIZ_PLACE_TIMEOUT_MS = 8000;

/** A DND / NDNC refusal, recognised in a 4xx body. Only this classification is kept; the body never leaves this module. */
const DND_BODY = /\b(dnd|ndnc|do not disturb)\b/i;

export type VobizDetailedFailureCategory =
    | VobizFailureCategory
    /** HTTP 429: the account is over its rate. Nothing was placed. */
    | 'rate_limited'
    /** HTTP 5xx (or an unexpected non-4xx status): the outcome is unknown, because the call may already have been placed. */
    | 'provider_error'
    /** A 4xx whose body names DND / NDNC: the number cannot receive these calls. */
    | 'dnd_blocked';

export interface VobizDetailedFailure {
    category: VobizDetailedFailureCategory;
    /** Provider HTTP status, when there was a response at all. */
    status?: number;
}

export type VobizDetailedResult =
    | { ok: true; handle: VobizCallHandle }
    | { ok: false; failure: VobizDetailedFailure };

export interface VobizPlaceOptions {
    /** Abort the request after this many milliseconds; the result is then `network`. Default 8000. */
    timeoutMs?: number;
}

/** The response body as text, or '' when it cannot be read (aborted, malformed, absent). */
async function bodyText(res: Response): Promise<string> {
    try {
        return await res.text();
    } catch {
        return '';
    }
}

/**
 * Place one outbound call, with the finer failure categories above and a timeout.
 *
 * Same request as `placeVobizCall` (same endpoint, headers and body). Categories:
 *   invalid_destination    the destination is too short to be a number (never sent);
 *   rate_limited           429;
 *   provider_error         5xx, or any other status that is neither an acceptance nor a 4xx —
 *                          outcome unknown;
 *   dnd_blocked            a 4xx (other than 429) whose body names DND / NDNC;
 *   provider_unconfigured  401 / 403;
 *   provider_rejected      any other 4xx;
 *   network                fetch threw, or the timeout aborted it — outcome unknown.
 *
 * The provider body is never returned and never logged: a 4xx body is read only to
 * recognise a DND refusal, and nothing of it is kept but that classification.
 */
export async function placeVobizCallDetailed(
    config: VobizConfig,
    options: PlaceCallOptions,
    fetchImpl: typeof fetch = fetch,
    { timeoutMs = VOBIZ_PLACE_TIMEOUT_MS }: VobizPlaceOptions = {},
): Promise<VobizDetailedResult> {
    const to = toVobizNumber(options.to);
    if (to.length < 10) {
        return { ok: false, failure: { category: 'invalid_destination' } };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let res: Response;
        try {
            res = await fetchImpl(`${config.baseUrl}/Account/${config.authId}/Call/`, {
                method: 'POST',
                headers: {
                    'X-Auth-ID': config.authId,
                    'X-Auth-Token': config.authToken,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: toVobizNumber(config.fromNumber),
                    to,
                    answer_url: options.answerUrl,
                    answer_method: 'POST',
                    hangup_url: options.hangupUrl,
                    ...(options.ringUrl ? { ring_url: options.ringUrl } : {}),
                    ring_timeout: options.ringTimeout ?? 30,
                }),
                signal: controller.signal,
            });
        } catch {
            // A dropped connection or the timeout: the request may have reached Vobiz.
            return { ok: false, failure: { category: 'network' } };
        }

        const status = res.status;
        if (status === 200 || status === 201 || status === 202) {
            // As in placeVobizCall: an accepted call with no readable id is still a placed call.
            let requestUuid = '';
            try {
                const body = (await res.json()) as { request_uuid?: unknown } | null;
                if (typeof body?.request_uuid === 'string') requestUuid = body.request_uuid;
            } catch {
                // An unreadable body costs the correlation id, not the call.
            }
            return { ok: true, handle: { requestUuid } };
        }
        if (status === 429) return { ok: false, failure: { category: 'rate_limited', status } };
        if (status >= 400 && status <= 499) {
            // A DND refusal is recognised even under 403, which some carriers use for it.
            if (DND_BODY.test(await bodyText(res))) return { ok: false, failure: { category: 'dnd_blocked', status } };
            if (status === 401 || status === 403) return { ok: false, failure: { category: 'provider_unconfigured', status } };
            return { ok: false, failure: { category: 'provider_rejected', status } };
        }
        // 5xx, and any status that is neither an acceptance nor a refusal (a 204, a 3xx): Vobiz may
        // have placed the call, so the outcome is unknown and the call must never be re-dialled.
        return { ok: false, failure: { category: 'provider_error', status } };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * End a live call from our side.
 *
 * The conversational path keeps the leg up with `keepCallAlive="true"`, so
 * closing the media stream does NOT end the call — hanging up is an explicit
 * REST action. Without this a finished conversation leaves the parent holding
 * an open, billing line.
 */
export async function hangupVobizCall(
    config: VobizConfig,
    callUuid: string,
    fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
    if (!callUuid) return false;
    try {
        const res = await fetchImpl(`${config.baseUrl}/Account/${config.authId}/Call/${callUuid}/`, {
            method: 'DELETE',
            headers: { 'X-Auth-ID': config.authId, 'X-Auth-Token': config.authToken },
        });
        return res.ok || res.status === 204;
    } catch {
        return false;
    }
}
