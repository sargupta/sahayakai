/**
 * Guardian phone numbers: classification, hashing, encryption.
 *
 * Plan §4② and class gate 4. A full number is stored in exactly one place —
 * `SamparkGuardian.phoneEnc` (AES-256-GCM) — and is decrypted only by the
 * dispatcher at the moment of dialling. Everything else keys on a peppered
 * SHA-256 hash (suppressions, frequency caps) or shows the last four digits.
 *
 * SYNTHETIC NUMBERS. Demo data uses the reserved `+915…` range. Indian mobile
 * numbers start with 6–9, so a `+915` number is not a mobile in any series and
 * cannot ring a real phone even if every other safeguard failed. `classifyPhone`
 * reports it as 'synthetic', and only the simulated carrier accepts it.
 *
 * Keys: SAMPARK_PII_KEY (base64, 32 bytes) and SAMPARK_PHONE_PEPPER. Both are
 * required; there is no insecure default, because a default key would silently
 * "work" in production.
 */

import crypto from 'node:crypto';

import type { PhoneClass } from '@/types/sampark';

const IN_MOBILE = /^\+91[6-9]\d{9}$/;
const IN_SYNTHETIC = /^\+915\d{9}$/;

/** Normalise common Indian formats to E.164. Returns null if it cannot. */
export function normalizeIndianPhone(raw: string): string | null {
    const digits = raw.replace(/[^\d+]/g, '');
    if (/^\+\d{10,15}$/.test(digits)) return digits;
    const bare = digits.replace(/^\+/, '');
    if (/^\d{10}$/.test(bare)) return `+91${bare}`;
    if (/^91\d{10}$/.test(bare)) return `+${bare}`;
    if (/^0\d{10}$/.test(bare)) return `+91${bare.slice(1)}`;
    return null;
}

/**
 * A dedicated caller id the school supplies: a full E.164 number (leading +, 10-15 digits) that the
 * normaliser leaves unchanged. Landlines, toll-free and virtual numbers are fine here (unlike guardian
 * numbers); whether it may be used for a real carrier is decided by policy/carrier-readiness.ts.
 */
export function isValidCallerId(value: string): boolean {
    return /^\+\d{10,15}$/.test(value) && normalizeIndianPhone(value) === value;
}

export function classifyPhone(e164: string): PhoneClass {
    if (IN_SYNTHETIC.test(e164)) return 'synthetic';
    if (IN_MOBILE.test(e164)) return 'mobile';
    return 'invalid';
}

export function phoneLast4(e164: string): string {
    return e164.replace(/\D/g, '').slice(-4);
}

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is not configured`);
    return value;
}

export function hashPhone(e164: string): string {
    return crypto.createHash('sha256').update(`${e164}|${requiredEnv('SAMPARK_PHONE_PEPPER')}`).digest('hex');
}

function piiKey(): Buffer {
    const key = Buffer.from(requiredEnv('SAMPARK_PII_KEY'), 'base64');
    if (key.length !== 32) throw new Error('SAMPARK_PII_KEY must be 32 bytes, base64-encoded');
    return key;
}

/** AES-256-GCM. Output: base64(iv[12] | tag[16] | ciphertext). */
export function encryptPhone(e164: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', piiKey(), iv);
    const ct = Buffer.concat([cipher.update(e164, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decryptPhone(enc: string): string {
    const raw = Buffer.from(enc, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', piiKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
