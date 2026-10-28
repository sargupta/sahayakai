/**
 * Google tokens at rest: AES-256-GCM with SAMPARK_GCAL_TOKEN_KEY (base64, 32 bytes),
 * the same format as guardian phones (src/lib/sampark/phone.ts) but its own key, and
 * the school's orgId as associated data, so a ciphertext copied into another school's
 * record does not decrypt. There is no default key.
 */

import crypto from 'node:crypto';

const KEY_ENV = 'SAMPARK_GCAL_TOKEN_KEY';

function tokenKey(env: Record<string, string | undefined> = process.env): Buffer {
    const raw = env[KEY_ENV]?.trim();
    if (!raw) throw new Error(`${KEY_ENV} is not configured`);
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error(`${KEY_ENV} must be 32 bytes, base64-encoded`);
    return key;
}

export function hasTokenKey(env: Record<string, string | undefined> = process.env): boolean {
    try {
        tokenKey(env);
        return true;
    } catch {
        return false;
    }
}

/** Output: base64(iv[12] | tag[16] | ciphertext), bound to orgId. */
export function encryptToken(plain: string, orgId: string, env?: Record<string, string | undefined>): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(env), iv);
    cipher.setAAD(Buffer.from(`gcal:${orgId}`, 'utf8'));
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decryptToken(enc: string, orgId: string, env?: Record<string, string | undefined>): string {
    const raw = Buffer.from(enc, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(env), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(`gcal:${orgId}`, 'utf8'));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

export function sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
}

/** PKCE S256 challenge for a verifier. */
export function pkceChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}
