/**
 * The call-control XML Vobiz fetches when a parent picks up.
 *
 * Kept as a pure function so the wire format is unit-testable without standing
 * up a route — the two attributes below are load-bearing and were both learned
 * the expensive way on the Suraksha build:
 *
 *   bidirectional="true"   we send audio back, not just receive it
 *   keepCallAlive="true"   WITHOUT this Vobiz hangs up roughly a second after
 *                          handing off the verb, killing the call mid-greeting.
 *                          Ending the call is therefore an explicit REST hangup
 *                          (see `hangupVobizCall`), never "close the socket".
 *
 * `contentType` declares the INBOUND wire format. μ-law 8 kHz is the
 * known-working default; L16/16 kHz is available behind a flag because it gives
 * materially cleaner speech recognition, but it must be confirmed on a real call
 * before being trusted — which is why the default here is the conservative one.
 */

/** Escape the five XML metacharacters. Applied to every interpolated value. */
export function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export type VobizInboundFormat = 'mulaw8k' | 'l16_16k';

export const VOBIZ_CONTENT_TYPES: Record<VobizInboundFormat, string> = {
    mulaw8k: 'audio/x-mulaw;rate=8000',
    l16_16k: 'audio/x-l16;rate=16000',
};

export interface AnswerXmlOptions {
    /** Absolute wss:// URL of the sidecar's telephony media endpoint. */
    streamUrl: string;
    /** Inbound wire format. Defaults to the known-working μ-law 8k. */
    inboundFormat?: VobizInboundFormat;
}

/**
 * Build the `<Response><Stream>…</Stream></Response>` document.
 *
 * The stream URL is escaped as XML TEXT because it is the element's body, not
 * an attribute — its query string carries `&` separators which must arrive at
 * Vobiz as `&amp;` or the document does not parse.
 */
export function buildVobizAnswerXml(options: AnswerXmlOptions): string {
    const contentType = VOBIZ_CONTENT_TYPES[options.inboundFormat ?? 'mulaw8k'];
    return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response>' +
        `<Stream bidirectional="true" keepCallAlive="true" contentType="${contentType}">` +
        escapeXml(options.streamUrl) +
        '</Stream>' +
        '</Response>'
    );
}

/**
 * Convert the sidecar's https base URL into a wss:// origin.
 *
 * Returns null for anything that is not http(s), so a misconfigured env cannot
 * produce a `<Stream>` pointing at a URL Vobiz will silently fail to dial.
 */
export function toWebSocketOrigin(baseUrl: string): string | null {
    const trimmed = baseUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
    if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
    return null;
}
