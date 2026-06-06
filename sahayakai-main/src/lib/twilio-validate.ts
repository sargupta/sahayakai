import crypto from 'crypto';
import { NextRequest } from 'next/server';

/**
 * F8-01 hardening (P0): the localhost skip used to be `host.includes('localhost')`,
 * which let an attacker forge `Host: localhost.evil.com` and bypass signature
 * validation entirely on Cloud Run. We now require:
 *   1. NODE_ENV !== 'production' (never skip in prod, full stop), AND
 *   2. Exact host equality against an allow-list (`localhost`, `localhost:<port>`,
 *      `127.0.0.1`, `127.0.0.1:<port>`), AND
 *   3. Test/dev signals — Jest/Vitest envs OR an explicit
 *      `TWILIO_DISABLE_VALIDATION=1` opt-in for local dev with ngrok off.
 *
 * In any production deployment, validation is mandatory — no host header can
 * disable it.
 */
function isLocalDevHost(host: string): boolean {
    // Exact equality only — no substring match. Strips the value at the first
    // comma in case the proxy concatenated multiple hosts.
    const first = host.split(',')[0].trim().toLowerCase();
    return (
        first === 'localhost' ||
        first === '127.0.0.1' ||
        /^localhost:\d+$/.test(first) ||
        /^127\.0\.0\.1:\d+$/.test(first)
    );
}

function shouldSkipValidation(req: NextRequest): boolean {
    // Production NEVER skips, regardless of headers.
    if (process.env.NODE_ENV === 'production') return false;

    const host = req.headers.get('host') ?? '';
    if (!isLocalDevHost(host)) return false;

    // Only skip in test runners or when explicitly opted in via env.
    const isTestEnv =
        process.env.NODE_ENV === 'test' ||
        !!process.env.JEST_WORKER_ID ||
        !!process.env.VITEST;
    const explicitOptIn = process.env.TWILIO_DISABLE_VALIDATION === '1';
    return isTestEnv || explicitOptIn;
}

/**
 * Validates that a request genuinely came from Twilio by checking
 * the X-Twilio-Signature header against TWILIO_AUTH_TOKEN.
 *
 * See: https://www.twilio.com/docs/usage/security#validating-requests
 *
 * Skipped in test/dev only (see shouldSkipValidation).
 *
 * IMPORTANT: On Cloud Run behind a load balancer, req.url returns the internal
 * URL (e.g. http://localhost:8080/...) — NOT the public URL Twilio signed against.
 * We reconstruct the canonical URL from X-Forwarded-Proto + Host headers.
 */
export function validateTwilioSignature(req: NextRequest): boolean {
    if (shouldSkipValidation(req)) return true;

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
    if (shouldSkipValidation(req)) return true;

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
