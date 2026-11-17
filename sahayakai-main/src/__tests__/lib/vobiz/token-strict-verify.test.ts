/**
 * Gate: a Vobiz token verifies in exactly ONE spelling, the one the minter emits.
 *
 * The verifier parsed the expiry with `parseInt`, so "0<exp>", "<exp>abc", " <exp>" and "+<exp>"
 * all verified with the same signature: one signed token, many accepted strings. The class is any
 * non-canonical spelling of a valid token being accepted, so this generates the variants instead
 * of listing a few:
 *  - expiry: leading zeros, sign, whitespace, trailing junk, a different radix or exponent;
 *  - signature: padding, the standard base64 alphabet, whitespace, and the unused low bits of the
 *    last character (decodes to the same bytes, spelled differently);
 *  - the whole token: surrounding whitespace and control characters.
 * Every variant must be refused for every domain; the canonical token must still verify. The
 * comparison must be constant-time.
 */
import fs from 'fs';
import path from 'path';

jest.mock('@/lib/secrets', () => ({ getSecret: jest.fn().mockResolvedValue('k'.repeat(64)) }));

import { VOBIZ_DOMAINS, _resetVobizKeyCacheForTest, mintVobizToken, verifyVobizToken, type VobizDomain } from '@/lib/vobiz/tokens';

const DOMAINS = Object.values(VOBIZ_DOMAINS) as VobizDomain[];
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

beforeEach(() => _resetVobizKeyCacheForTest());

/** Same 32 bytes, different spelling: change the unused low 2 bits of the last character. */
function lowBitTwins(sig: string): string[] {
    const last = B64URL.indexOf(sig[sig.length - 1]);
    return [1, 2, 3].map((d) => sig.slice(0, -1) + B64URL[(last & ~3) | ((last + d) & 3)]);
}

function variants(token: string): string[] {
    const [id, exp, sig] = token.split('.');
    const v = (e: string, s = sig, i = id) => `${i}.${e}.${s}`;
    const expVariants = [
        `0${exp}`, `00${exp}`, `+${exp}`, ` ${exp}`, `${exp} `, `\t${exp}`, `${exp}\n`,
        `${exp}abc`, `${exp}x`, `${exp}0`.slice(0, -1) + 'O', `${exp}e0`, `0x${Number(exp).toString(16)}`,
        `${exp}_`, `${exp.slice(0, 3)}_${exp.slice(3)}`, `${exp}\u0000`, `${Number(exp) + 0.5}`.replace('.', ','),
    ];
    const sigVariants = [
        `${sig}=`, `${sig}==`, ` ${sig}`, `${sig} `, `${sig}\n`, sig.replace(/-/g, '+').replace(/_/g, '/') + '+',
        ...lowBitTwins(sig),
    ];
    return [
        ...expVariants.map((e) => v(e)),
        ...sigVariants.map((s) => v(exp, s)),
        ` ${token}`, `${token} `, `${token}\n`, `\u0000${token}`,
    ].filter((t) => t !== token);
}

describe.each(DOMAINS)('domain %s', (domain) => {
    it('the canonical token verifies', async () => {
        const { token } = await mintVobizToken(domain, 'outreach123');
        await expect(verifyVobizToken(domain, token)).resolves.toBe('outreach123');
    });

    it('every non-canonical variant of a valid token is refused', async () => {
        const { token } = await mintVobizToken(domain, 'outreach123');
        const all = variants(token);
        expect(all.length).toBeGreaterThanOrEqual(25);
        const accepted: string[] = [];
        for (const t of all) if ((await verifyVobizToken(domain, t)) !== null) accepted.push(JSON.stringify(t));
        expect(accepted).toEqual([]);
    });

    it('the low-bit twins really decode to the same signature bytes (so the check above is meaningful)', async () => {
        const { token } = await mintVobizToken(domain, 'outreach123');
        const sig = token.split('.')[2];
        for (const twin of lowBitTwins(sig)) {
            expect(twin).not.toBe(sig);
            expect(Buffer.from(twin, 'base64url').equals(Buffer.from(sig, 'base64url'))).toBe(true);
        }
    });
});

it('compares signatures in constant time, never with string equality', () => {
    const src = fs
        .readFileSync(path.resolve(__dirname, '../../../lib/vobiz/tokens.ts'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1'); // code only
    const verify = src.slice(src.indexOf('export async function verifyVobizToken'));
    expect(verify).toMatch(/crypto\.timingSafeEqual\(/);
    expect(verify).not.toMatch(/\b(sig|expected|presented)\s*[!=]==?\s*(sig|expected|presented)\b/);
    expect(verify).not.toMatch(/parseInt|parseFloat/);
});
