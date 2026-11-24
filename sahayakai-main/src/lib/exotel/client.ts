/**
 * Exotel voice client for Sampark outbound calls.
 *
 * Reads credentials from environment variables (never hard-coded):
 *   EXOTEL_SID          — Exotel account SID
 *   EXOTEL_API_KEY      — Exotel API key
 *   EXOTEL_API_TOKEN    — Exotel API token
 *   EXOTEL_SUBDOMAIN    — API subdomain, e.g. api.exotel.com
 *   EXOTEL_CALLER_ID    — Verified Exotel phone number (E.164)
 *   EXOTEL_APP_ID       — Exotel app ID for the call flow
 *
 * Docs: https://developer.exotel.com/docs/voice-api
 */

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

export interface ExotelConfig {
    sid: string;
    apiKey: string;
    apiToken: string;
    subdomain: string;
    callerId: string;
    appId: string;
}

function readConfig(): ExotelConfig | null {
    const sid = process.env.EXOTEL_SID;
    const apiKey = process.env.EXOTEL_API_KEY;
    const apiToken = process.env.EXOTEL_API_TOKEN;
    const subdomain = process.env.EXOTEL_SUBDOMAIN ?? 'api.exotel.com';
    const callerId = process.env.EXOTEL_CALLER_ID;
    const appId = process.env.EXOTEL_APP_ID;
    if (!sid || !apiKey || !apiToken || !callerId || !appId) return null;
    return { sid, apiKey, apiToken, subdomain, callerId, appId };
}

/** Place an outbound call through Exotel. */
export async function placeExotelCall(
    to: string,
    opts: { url?: string; statusCallback?: string; timeout?: number } = {}
): Promise<ExotelCallResponse> {
    const cfg = readConfig();
    if (!cfg) {
        return {
            ok: false,
            code: 'VOICE_NOT_CONFIGURED',
            message: 'Exotel credentials are not set. Set EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_CALLER_ID, EXOTEL_APP_ID.',
            status: 503,
        };
    }

    const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiToken}`).toString('base64');
    const url = `https://${cfg.subdomain}/v2/accounts/${cfg.sid}/calls`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: cfg.callerId,
                to,
                caller_id: cfg.callerId,
                url: opts.url ?? `https://${cfg.subdomain}/v2/accounts/${cfg.sid}/apps/${cfg.appId}/exoml`,
                status_callback: opts.statusCallback,
                time_limit: opts.timeout ?? 30,
            }),
        });

        const data = (await res.json().catch(() => ({}))) as {
            call_sid?: string;
            status?: string;
            error?: string;
            message?: string;
            code?: string | number;
        };

        if (!res.ok) {
            return {
                ok: false,
                code: String(data?.code ?? 'EXOTEL_ERROR'),
                message: data?.message ?? data?.error ?? 'Exotel call failed',
                status: res.status,
            };
        }

        return {
            ok: true,
            callSid: data.call_sid ?? `exotel-${Date.now()}`,
            status: data.status ?? 'initiated',
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

/** Check whether Exotel is configured at all. */
export function exotelConfigured(): boolean {
    return readConfig() !== null;
}