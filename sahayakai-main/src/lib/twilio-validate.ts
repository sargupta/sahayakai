import crypto from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Validates that a request genuinely came from Twilio by checking
 * the X-Twilio-Signature header against TWILIO_AUTH_TOKEN.
 *
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 *
 * Skipped in development (localhost) where Twilio can't reach our server directly.
 *
 * IMPORTANT: On Cloud Run behind a load balancer, req.url returns the internal
 * URL (e.g. http://localhost:8080/...) — NOT the public URL Twilio signed against.
 * We reconstruct the canonical URL from X-Forwarded-Proto + Host headers.
 */
export function validateTwilioSignature(req: NextRequest): boolean {
    const host = req.headers.get('host') ?? '';
    if (host.includes('localhost')) return true; // skip in dev

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return false;

    const signature = req.headers.get('x-twilio-signature');
    if (!signature) return false;

    const url = getCanonicalUrl(req);
    return verifySignature(authToken, signature, url, {});
}

/**
 * Validates Twilio signature for POST requests with form data.
 */
export function validateTwilioSignaturePost(
    req: NextRequest,
    params: Record<string, string>
): boolean {
    const host = req.headers.get('host') ?? '';
    if (host.includes('localhost')) return true;

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return false;

    const signature = req.headers.get('x-twilio-signature');
    if (!signature) return false;

    const url = getCanonicalUrl(req);
    return verifySignature(authToken, signature, url, params);
}

/**
 * Reconstruct the public-facing URL that Twilio used for signing.
 * Cloud Run sets X-Forwarded-Proto and forwards the original Host header.
 */
function getCanonicalUrl(req: NextRequest): string {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    const host = req.headers.get('host') ?? '';
    const parsed = new URL(req.url);
    return `${proto}://${host}${parsed.pathname}${parsed.search}`;
}

function verifySignature(
    authToken: string,
    signature: string,
    url: string,
    params: Record<string, string>
): boolean {
    // 1. Start with the full URL (including query string for GET)
    let data = url;

    // 2. Sort POST params alphabetically and append key+value
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
        data += key + params[key];
    }

    // 3. HMAC-SHA1 with auth token, then base64
    const computed = crypto
        .createHmac('sha1', authToken)
        .update(data)
        .digest('base64');

    // 4. Constant-time comparison
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(computed)
        );
    } catch {
        return false; // different lengths
    }
}

/**
 * Validates E.164 phone number format.
 * Indian numbers: +91 followed by 10 digits.
 * General: + followed by 7-15 digits.
 */
export function isValidE164(phone: string): boolean {
    return /^\+[1-9]\d{6,14}$/.test(phone);
}
