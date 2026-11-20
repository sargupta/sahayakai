/**
 * Signed, short-lived, purpose-scoped tokens for the Vobiz call path.
 *
 * THE PROBLEM
 *
 * Two endpoints on this path must be reachable by Vobiz, which means reachable
 * by anyone: the answer webhook (which returns the call's control XML) and the
 * media WebSocket on the sidecar (behind which sits a billable Gemini Live
 * session). Twilio signs its webhooks and `twilio-validate` checks that
 * signature; Vobiz does not sign, so an unsigned public route would let anyone
 * drive our call control or open a metered audio socket.
 *
 * Instead of trusting the caller, we sign the URL. Every Vobiz-facing URL
 * carries a token minted at dial time and bound to one outreach record.
 *
 * DOMAIN SEPARATION
 *
 * All tokens are signed with `SAHAYAKAI_REQUEST_SIGNING_KEY` — the same secret
 * the sidecar already mounts — but each purpose signs a DIFFERENT message:
 *
 *   web voice (existing)  hmac(key, "<uid>.<exp>")
 *   answer webhook        hmac(key, "vobiz-answer.<outreachId>.<exp>")
 *   media stream          hmac(key, "vobiz-call.<outreachId>.<exp>")
 *   status webhook        hmac(key, "vobiz-status.<outreachId>.<exp>")
 *
 * The wire shape is `<principal>.<exp>.<sig>` throughout, so the sidecar's
 * existing parser needs no change. But a token minted for one purpose cannot
 * validate for another, and neither can validate against the web voice stream
 * in `vidya_voice/router.py`, because each verifier reconstructs its own
 * message before comparing. Cross-surface reuse fails on the HMAC itself rather
 * than on a check someone has to remember to write — which is what makes this
 * survive the next endpoint added to this path.
 */

import crypto from 'node:crypto';

import { getSecret } from '@/lib/secrets';

const SIGNING_KEY_SECRET_NAME = 'SAHAYAKAI_REQUEST_SIGNING_KEY';

/** The purposes a Vobiz token may carry. One domain tag per reachable endpoint. */
export const VOBIZ_DOMAINS = {
    /** Authorises fetching the call-control XML for one outreach record. */
    ANSWER: 'vobiz-answer',
    /** Authorises opening one billable media stream for one outreach record. */
    STREAM: 'vobiz-call',
    /** Authorises reporting ring/hangup progress for one outreach record. */
    STATUS: 'vobiz-status',
    /** Sampark Riya over Vobiz: call-control XML for one Sampark call (sampark~org~call). */
    SAMPARK_RIYA_ANSWER: 'sampark-riya-answer',
    /** Sampark Riya over Vobiz: ring/hangup progress for one Sampark call. */
    SAMPARK_RIYA_STATUS: 'sampark-riya-status',
    /** Sampark Riya over Vobiz: the bridge fetching one call's variables. */
    SAMPARK_RIYA_CONTEXT: 'sampark-riya-context',
} as const;

export type VobizDomain = (typeof VOBIZ_DOMAINS)[keyof typeof VOBIZ_DOMAINS];

/**
 * Ring time runs to 30s and the parent then has to answer, so the web path's
 * 120s TTL is too tight — these are minted before dialling and presented once
 * the leg connects. Five minutes covers ring-plus-answer with margin while
 * staying far shorter than a call.
 */
export const VOBIZ_TOKEN_TTL_SECONDS = 300;

/**
 * The media-stream token needs only the answer-to-connect gap.
 *
 * It is minted in the answer webhook, after the parent has already picked up,
 * and Vobiz presents it seconds later when it opens the media socket. It rides
 * in the stream URL (moving it out needs carrier support), so whoever sees that
 * URL in a carrier log or a proxy can open a billable socket until it expires.
 * Sixty seconds covers the connect with a wide margin and is a fifth of the
 * default; a call already in progress is not affected, because the token is
 * checked only when the socket opens.
 */
export const VOBIZ_STREAM_TTL_SECONDS = 60;

/**
 * Status tokens need a MUCH longer life than the others.
 *
 * `hangup_url` fires when the call ENDS, not when it starts, so its token has to
 * still be valid after a full-length conversation. The sidecar caps a session at
 * 600s; 30 minutes covers that plus ring time with generous margin. Minting a
 * status token at the default 300s would silently drop the hangup callback for
 * every call longer than five minutes, leaving those records stuck at
 * `initiated` forever — the failure would look like a Firestore bug, not a token
 * expiry, which is exactly why this constant is separate and explained.
 */
export const VOBIZ_STATUS_TTL_SECONDS = 1800;

let cachedKey: { value: string; loadedAt: number } | null = null;
const KEY_TTL_MS = 5 * 60 * 1000;

async function getSigningKey(): Promise<string> {
    const now = Date.now();
    if (cachedKey && now - cachedKey.loadedAt < KEY_TTL_MS) return cachedKey.value;
    // Trimmed for the same reason `lib/sidecar/signing` trims: a secret added
    // from a file with a trailing newline otherwise signs under a different key
    // than the sidecar's own newline-stripped read, and every check fails silently.
    const trimmed = ((await getSecret(SIGNING_KEY_SECRET_NAME)) || '').trim();
    if (!trimmed || trimmed.length < 32) {
        throw new Error(
            `[vobiz.tokens] ${SIGNING_KEY_SECRET_NAME} must be at least 32 chars; ` +
                `got length ${trimmed.length}`,
        );
    }
    cachedKey = { value: trimmed, loadedAt: now };
    return trimmed;
}

/** The exact message signed. Exported so a test cannot drift from the implementation. */
export function vobizTokenMessage(domain: VobizDomain, outreachId: string, exp: number): string {
    return `${domain}.${outreachId}.${exp}`;
}

function sign(key: string, message: string): string {
    return crypto.createHmac('sha256', key).update(message, 'utf8').digest('base64url');
}

/** The expiry exactly as the minter writes it: a positive integer with no sign, padding or junk. */
const CANONICAL_EXP = /^[1-9][0-9]*$/;
/** base64url without padding: the alphabet the minter's `digest('base64url')` emits. */
const BASE64URL_NO_PAD = /^[A-Za-z0-9_-]+$/;
/** HMAC-SHA256 is 32 bytes. */
const SIGNATURE_BYTES = 32;

export interface VobizToken {
    token: string;
    expiresAt: number;
}

export async function mintVobizToken(
    domain: VobizDomain,
    outreachId: string,
    ttlSeconds: number = VOBIZ_TOKEN_TTL_SECONDS,
): Promise<VobizToken> {
    if (!outreachId || outreachId.includes('.')) {
        // The wire format splits on the first two dots, so a dotted id would be
        // torn apart and verify against the wrong message. Firestore ids contain
        // no dots; refuse loudly rather than mint a token that never validates.
        throw new Error('[vobiz.tokens] outreachId must be non-empty and contain no "."');
    }
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = sign(await getSigningKey(), vobizTokenMessage(domain, outreachId, exp));
    return { token: `${outreachId}.${exp}.${sig}`, expiresAt: exp };
}

/**
 * Verify a token for one specific domain.
 *
 * Returns the outreach id it authorises, or `null`. The domain is a REQUIRED
 * argument with no default: a caller cannot accidentally accept "any Vobiz
 * token" by omitting it.
 */
export async function verifyVobizToken(
    domain: VobizDomain,
    token: string | null | undefined,
): Promise<string | null> {
    if (!token) return null;
    const parts = token.split('.');
    // Exactly three segments. A dotted id would produce more and must not be
    // silently re-joined into something that validates.
    if (parts.length !== 3) return null;
    const [outreachId, expRaw, sig] = parts;
    if (!outreachId) return null;

    // Accept ONLY the canonical form the minter emits. `parseInt` read "0179...",
    // "179abc" and " 179" as the same expiry, so one signature verified for many
    // different strings; a verifier should accept exactly one spelling of a token.
    if (!CANONICAL_EXP.test(expRaw)) return null;
    const exp = Number(expRaw);
    if (!Number.isSafeInteger(exp)) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;

    // The signature must be unpadded base64url that round-trips: Node's decoder
    // ignores padding, stray characters and the unused low bits of the last
    // character, so several spellings decode to the same 32 bytes.
    if (!BASE64URL_NO_PAD.test(sig)) return null;
    const presented = Buffer.from(sig, 'base64url');
    if (presented.length !== SIGNATURE_BYTES || presented.toString('base64url') !== sig) return null;

    // Constant-time compare of the raw HMAC bytes (equal lengths by construction).
    const expected = crypto
        .createHmac('sha256', await getSigningKey())
        .update(vobizTokenMessage(domain, outreachId, exp), 'utf8')
        .digest();
    if (!crypto.timingSafeEqual(expected, presented)) return null;
    return outreachId;
}

/** Test-only: drop the cached key so a test can rotate the secret. */
export function _resetVobizKeyCacheForTest(): void {
    cachedKey = null;
}
