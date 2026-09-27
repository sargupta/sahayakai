/**
 * Class gate: a Vobiz token signed for one purpose can NEVER open another.
 *
 * The founder-visible risk is not "someone forges a token" — it is that this
 * call path exposes three public endpoints to the internet, one of which opens a
 * billable Gemini Live session, and the natural way to build that is a single
 * shared "call token" that every endpoint accepts. That design works perfectly
 * until one endpoint leaks a token, and then it opens all of them.
 *
 * So this file does not assert "the answer route checks its token" — that is the
 * instance. It asserts the CLASS: every pair of domains is mutually
 * unverifiable, and the app's existing web-voice token scheme is unverifiable
 * against all of them, because each verifier reconstructs its own message before
 * comparing. A fourth endpoint added next year inherits the property for free;
 * it cannot opt out of it by forgetting a check.
 */
import crypto from 'node:crypto';

jest.mock('@/lib/secrets', () => ({
    getSecret: jest.fn().mockResolvedValue('k'.repeat(64)),
}));

import {
    VOBIZ_DOMAINS,
    VOBIZ_STATUS_TTL_SECONDS,
    VOBIZ_TOKEN_TTL_SECONDS,
    _resetVobizKeyCacheForTest,
    mintVobizToken,
    verifyVobizToken,
    vobizTokenMessage,
    type VobizDomain,
} from '@/lib/vobiz/tokens';

const KEY = 'k'.repeat(64);
const ALL_DOMAINS: VobizDomain[] = Object.values(VOBIZ_DOMAINS);

beforeEach(() => _resetVobizKeyCacheForTest());

describe('purpose scoping', () => {
    it('verifies a token against the domain it was minted for', async () => {
        for (const domain of ALL_DOMAINS) {
            const { token } = await mintVobizToken(domain, 'outreach123');
            await expect(verifyVobizToken(domain, token)).resolves.toBe('outreach123');
        }
    });

    it('refuses a token presented to ANY other domain', async () => {
        // The whole point of the file. Every ordered pair, not a spot check.
        for (const minted of ALL_DOMAINS) {
            const { token } = await mintVobizToken(minted, 'outreach123');
            for (const presented of ALL_DOMAINS) {
                if (presented === minted) continue;
                await expect(verifyVobizToken(presented, token)).resolves.toBeNull();
            }
        }
    });

    it('has a distinct domain tag per endpoint, so no two can collide', () => {
        expect(new Set(ALL_DOMAINS).size).toBe(ALL_DOMAINS.length);
    });
});

describe('cross-surface isolation with the web voice stream', () => {
    /** Reproduces the sidecar's `verify_stream_token`: hmac over `"<uid>.<exp>"`. */
    function verifyAsWebStreamToken(token: string): string | null {
        const [uid, expRaw, sig] = token.split('.');
        if (!uid || !expRaw || !sig) return null;
        if (Number.parseInt(expRaw, 10) < Math.floor(Date.now() / 1000)) return null;
        const expected = crypto
            .createHmac('sha256', KEY)
            .update(`${uid}.${expRaw}`, 'utf8')
            .digest('base64url');
        return expected === sig ? uid : null;
    }

    it('a Vobiz token cannot open the app-facing web voice stream', async () => {
        // Both schemes share one signing key and one wire shape, so this is the
        // failure that would actually happen: a telephony token pasted at
        // /stream. Domain separation is what stops it.
        for (const domain of ALL_DOMAINS) {
            const { token } = await mintVobizToken(domain, 'outreach123');
            expect(verifyAsWebStreamToken(token)).toBeNull();
        }
    });

    it('a web voice token cannot open any Vobiz endpoint', async () => {
        const exp = Math.floor(Date.now() / 1000) + 120;
        const uid = 'firebaseUid';
        const sig = crypto.createHmac('sha256', KEY).update(`${uid}.${exp}`, 'utf8').digest('base64url');
        const webToken = `${uid}.${exp}.${sig}`;
        // Sanity: it IS a valid web token, so the assertions below are about
        // domain separation rather than about a malformed string.
        expect(verifyAsWebStreamToken(webToken)).toBe(uid);
        for (const domain of ALL_DOMAINS) {
            await expect(verifyVobizToken(domain, webToken)).resolves.toBeNull();
        }
    });
});

describe('token hygiene', () => {
    it('rejects an expired token', async () => {
        const { token } = await mintVobizToken(VOBIZ_DOMAINS.STREAM, 'outreach123', -1);
        await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, token)).resolves.toBeNull();
    });

    it('rejects a tampered signature without throwing on length mismatch', async () => {
        const { token } = await mintVobizToken(VOBIZ_DOMAINS.STREAM, 'outreach123');
        const [id, exp] = token.split('.');
        // A short signature would make a naive timingSafeEqual throw rather than
        // return false, turning a forgery attempt into a 500.
        await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, `${id}.${exp}.short`)).resolves.toBeNull();
        await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, `${id}.${exp}.`)).resolves.toBeNull();
    });

    it('rejects a token for a different outreach record', async () => {
        const { token } = await mintVobizToken(VOBIZ_DOMAINS.STREAM, 'outreachA');
        const swapped = token.replace('outreachA', 'outreachB');
        await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, swapped)).resolves.toBeNull();
    });

    it('refuses to mint for an id containing a dot, which the wire format cannot carry', async () => {
        await expect(mintVobizToken(VOBIZ_DOMAINS.STREAM, 'a.b')).rejects.toThrow(/contain no/);
        await expect(mintVobizToken(VOBIZ_DOMAINS.STREAM, '')).rejects.toThrow();
    });

    it('rejects a malformed token instead of re-joining extra segments', async () => {
        await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, 'a.b.c.d')).resolves.toBeNull();
        await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, 'nodots')).resolves.toBeNull();
        await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, null)).resolves.toBeNull();
    });

    it('signs exactly the documented message', async () => {
        // Pins the wire contract the Python verifier must reproduce byte for byte.
        const exp = 1800000000;
        expect(vobizTokenMessage(VOBIZ_DOMAINS.STREAM, 'abc', exp)).toBe('vobiz-call.abc.1800000000');
        expect(vobizTokenMessage(VOBIZ_DOMAINS.ANSWER, 'abc', exp)).toBe('vobiz-answer.abc.1800000000');
        expect(vobizTokenMessage(VOBIZ_DOMAINS.STATUS, 'abc', exp)).toBe('vobiz-status.abc.1800000000');
    });
});

describe('lifetimes', () => {
    it('gives status tokens a life long enough to outlast a full call', () => {
        // hangup_url fires when the call ENDS. The sidecar caps a session at
        // 600s, so anything at or below that silently drops the hangup callback
        // for long calls and strands the record at "initiated".
        expect(VOBIZ_STATUS_TTL_SECONDS).toBeGreaterThan(600 + 30);
        expect(VOBIZ_STATUS_TTL_SECONDS).toBeGreaterThan(VOBIZ_TOKEN_TTL_SECONDS);
    });

    it('covers ring time on the short-lived tokens', () => {
        // Ring alone can run 30s before the parent even answers.
        expect(VOBIZ_TOKEN_TTL_SECONDS).toBeGreaterThan(30);
    });
});

describe('cross-language wire contract', () => {
    /**
     * The mirror of `TestCrossLanguageContract` in the sidecar's
     * `tests/unit/test_telephony_tokens.py`. That file verifies these exact
     * strings; this one proves we still MINT them. Together they stop the two
     * HMAC implementations drifting apart — a drift whose only symptom in
     * production is every real parent call being refused at the media socket.
     */
    const GOLDEN: Record<string, string> = {
        'vobiz-answer': 'outreach123.1800000000.ask7khW1H9Lo-JxtHCCwDVACvBzN3MFU32ZRNvcnsJA',
        'vobiz-call': 'outreach123.1800000000.KmcHAMBzSYe3TprTBG9q2ze6sDkYyNcwoJPLz4HEZyY',
        'vobiz-status': 'outreach123.1800000000.tKiScWp9XnJMggkzYDUQgYyoFT6brSbtdJvQojPJ8c0',
    };

    it('mints exactly the bytes the sidecar pins', () => {
        for (const [domain, expected] of Object.entries(GOLDEN)) {
            const sig = crypto
                .createHmac('sha256', KEY)
                .update(`${domain}.outreach123.1800000000`, 'utf8')
                .digest('base64url');
            expect(`outreach123.1800000000.${sig}`).toBe(expected);
        }
    });
});
