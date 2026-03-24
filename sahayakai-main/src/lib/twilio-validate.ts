import crypto from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Validates that a request genuinely came from Twilio by checking
 * the X-Twilio-Signature header against TWILIO_AUTH_TOKEN.
 *
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 *
 * Skipped in development (localhost) where Twilio can't reach our server directly.
 */
export function validateTwilioSignature(req: NextRequest): boolean {
    const host = req.headers.get('host') ?? '';
    if (host.includes('localhost')) return true; // skip in dev

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return false;

    const signature = req.headers.get('x-twilio-signature');
    if (!signature) return false;

    // Build the full URL Twilio used (protocol + host + path + query)
    const url = req.url;

    // For GET requests, params are in the URL; for POST (form), params are in the body.
    // Twilio signs GET requests using only the URL (no body params).
    // For POST, we need sorted form params — but our twiml route is GET-based
    // and twiml-status uses formData which we validate separately.
    // This helper handles the GET case; POST callers pass params explicitly.
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

    const url = req.url;
    return verifySignature(authToken, signature, url, params);
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
