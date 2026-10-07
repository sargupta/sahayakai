/**
 * Signed, short-lived, purpose-scoped tokens for the Sampark voice webhooks.
 *
 * Vobiz does not sign its callbacks, so every URL we hand it carries a token
 * instead (the same reasoning as `src/lib/vobiz/tokens.ts`, which guards the
 * teacher parent-call path). The wire shape and the HMAC scheme are the same —
 * `<principal>.<exp>.<sig>`, signed with SAHAYAKAI_REQUEST_SIGNING_KEY — but
 * every Sampark domain signs a different message, so:
 *
 *   - a token for one Sampark endpoint never validates at another (an audio
 *     token cannot drive the keypad, a menu-step token cannot confirm an opt-out);
 *   - no Sampark token validates on the teacher path, and no teacher-path token
 *     validates here, because the domain tags differ.
 *
 * Principals: calls → `${orgId}~${callId}`; audio → `${orgId}~${clipKey}`.
 * Org ids, call ids (hex) and clip keys (hex) contain no '.', which the wire
 * format splits on; a dotted principal is refused rather than mis-signed.
 *
 * TTLs (seconds): answer 300 (minted at dial, presented on answer after up to
 * 30 s of ringing); status 1800 (the hangup fires when the call ENDS); gather
 * 120 (minted fresh in each response); audio 900 (fetched while the call plays).
 */

import crypto from 'node:crypto';

import { getSecret } from '@/lib/secrets';

const SIGNING_KEY_SECRET_NAME = 'SAHAYAKAI_REQUEST_SIGNING_KEY';

export type SamparkVoiceDomain =
    | 'sampark-answer'
    | 'sampark-gather-menu'
    | 'sampark-gather-optout'
    | 'sampark-status'
    | 'sampark-audio';

export const SAMPARK_VOICE_TTL_SECONDS: Record<SamparkVoiceDomain, number> = {
    'sampark-answer': 300,
    'sampark-gather-menu': 120,
    'sampark-gather-optout': 120,
    'sampark-status': 1800,
    'sampark-audio': 900,
};

let cachedKey: { value: string; loadedAt: number } | null = null;
const KEY_TTL_MS = 5 * 60 * 1000;

async function getSigningKey(): Promise<string> {
    const now = Date.now();
    if (cachedKey && now - cachedKey.loadedAt < KEY_TTL_MS) return cachedKey.value;
    const trimmed = ((await getSecret(SIGNING_KEY_SECRET_NAME)) || '').trim();
    if (trimmed.length < 32) {
        throw new Error(`[sampark.voice.tokens] ${SIGNING_KEY_SECRET_NAME} must be at least 32 chars; got length ${trimmed.length}`);
    }
    cachedKey = { value: trimmed, loadedAt: now };
    return trimmed;
}

/** The exact message signed. Exported so a test cannot drift from the implementation. */
export function samparkVoiceTokenMessage(domain: SamparkVoiceDomain, principal: string, exp: number): string {
    return `${domain}.${principal}.${exp}`;
}

function sign(key: string, message: string): string {
    return crypto.createHmac('sha256', key).update(message, 'utf8').digest('base64url');
}

/** `${orgId}~${id}` — the principal for a call or a clip. */
export function voicePrincipal(orgId: string, id: string): string {
    return `${orgId}~${id}`;
}

/** Splits a principal back into [orgId, id]; null if it is not exactly two non-empty parts. */
export function parseVoicePrincipal(principal: string): { orgId: string; id: string } | null {
    const parts = principal.split('~');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return { orgId: parts[0], id: parts[1] };
}

export async function mintSamparkVoiceToken(domain: SamparkVoiceDomain, principal: string, ttlSeconds?: number): Promise<string> {
    if (!principal || principal.includes('.')) {
        throw new Error('[sampark.voice.tokens] principal must be non-empty and contain no "."');
    }
    const exp = Math.floor(Date.now() / 1000) + (ttlSeconds ?? SAMPARK_VOICE_TTL_SECONDS[domain]);
    const sig = sign(await getSigningKey(), samparkVoiceTokenMessage(domain, principal, exp));
    return `${principal}.${exp}.${sig}`;
}

/** The principal this token authorises for `domain`, or null. The domain is required: there is no "any Sampark token". */
export async function verifySamparkVoiceToken(domain: SamparkVoiceDomain, token: string | null | undefined): Promise<string | null> {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [principal, expRaw, sig] = parts;
    const exp = Number.parseInt(expRaw, 10);
    if (!principal || !sig || !Number.isFinite(exp) || String(exp) !== expRaw) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    const expected = Buffer.from(sign(await getSigningKey(), samparkVoiceTokenMessage(domain, principal, exp)), 'utf8');
    const given = Buffer.from(sig, 'utf8');
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
    return principal;
}

/** The expiry (unix seconds) carried by a token, without verifying it. For burn records only. */
export function tokenExpiry(token: string): number | null {
    const exp = Number.parseInt(token.split('.')[1] ?? '', 10);
    return Number.isFinite(exp) ? exp : null;
}

/** The burn key for a single-use token: sha256 hex, so the token itself is never stored. */
export function tokenBurnKey(token: string): string {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Test-only: drop the cached key so a test can rotate the secret. */
export function _resetSamparkVoiceKeyCacheForTest(): void {
    cachedKey = null;
}
