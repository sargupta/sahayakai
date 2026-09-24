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
