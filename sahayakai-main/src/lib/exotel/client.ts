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
 * Uses Exotel v1 REST API (v2 is not supported on this account).
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

/** Place an outbound call through Exotel (v1 API). */
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
            // Exotel v1 returns TwilioResponse XML on error; extract message crudely.
            const msg = text.match(/<Message>(.*?)<\/Message>/)?.[1] ?? text.slice(0, 200);
            return {
                ok: false,
                code: 'EXOTEL_ERROR',
                message: msg,
                status: res.status,
            };
        }

        // Parse Call Sid from XML response.
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

/** Check whether Exotel is configured at all. */
export function exotelConfigured(): boolean {
    return readConfig() !== null;
}