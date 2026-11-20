/**
 * Gate: the Vobiz media-stream token lives only as long as the answer-to-connect gap.
 *
 * The stream token rides in the WebSocket URL Vobiz opens, and opening that socket starts a
 * billable session for an unauthenticated caller. It was minted with the default 300 s although
 * it is needed only for the seconds between the answer webhook and the socket opening. So:
 *  - the TTL is pinned at 60 s, shorter than the default;
 *  - the token the answer route actually puts in the stream URL expires within 60 s, and is
 *    refused 61 s later;
 *  - every place in src/ that mints a STREAM token passes VOBIZ_STREAM_TTL_SECONDS, so a new
 *    caller cannot fall back to the default.
 */
import fs from 'fs';
import path from 'path';

jest.mock('@/lib/secrets', () => ({ getSecret: jest.fn().mockResolvedValue('k'.repeat(64)) }));
jest.mock('@/lib/calling-hours', () => {
    const actual = jest.requireActual('@/lib/calling-hours');
    return { ...actual, checkCallingWindow: () => actual.checkCallingWindow(new Date('2026-11-16T06:30:00.000Z')) };
});
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
const outreach: Record<string, unknown> = { parentLanguage: 'Hindi', callStatus: 'initiated' };
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: () => ({
            doc: () => ({
                get: async () => ({ exists: true, data: () => outreach }),
                update: async () => undefined,
            }),
        }),
    }),
}));

import {
    VOBIZ_DOMAINS,
    VOBIZ_STREAM_TTL_SECONDS,
    VOBIZ_TOKEN_TTL_SECONDS,
    _resetVobizKeyCacheForTest,
    mintVobizToken,
    verifyVobizToken,
} from '@/lib/vobiz/tokens';
import { GET as answerGET } from '@/app/api/attendance/vobiz/answer/route';

const SRC = path.resolve(__dirname, '../../..');

beforeEach(() => {
    _resetVobizKeyCacheForTest();
    process.env.VOBIZ_STREAM_BASE_URL = 'https://telephony.test';
    jest.restoreAllMocks();
});

it('pins the stream TTL at 60 s, a fifth of the default', () => {
    expect(VOBIZ_STREAM_TTL_SECONDS).toBe(60);
    expect(VOBIZ_STREAM_TTL_SECONDS).toBeLessThan(VOBIZ_TOKEN_TTL_SECONDS);
});

it('the token in the stream URL expires within 60 s and is refused after it', async () => {
    const { token: answerToken } = await mintVobizToken(VOBIZ_DOMAINS.ANSWER, 'o1');
    const res = await answerGET({
        method: 'GET',
        url: `https://app.test/api/attendance/vobiz/answer?t=${encodeURIComponent(answerToken)}&CallUUID=cu1`,
        headers: { get: () => null },
    } as any);
    const xml = (await res.text()).replace(/&amp;/g, '&');
    const streamToken = decodeURIComponent(xml.match(/[?&]t=([^&<]+)/)![1]);
    const exp = Number(streamToken.split('.')[1]);
    const now = Math.floor(Date.now() / 1000);
    expect(exp - now).toBeGreaterThan(0);
    expect(exp - now).toBeLessThanOrEqual(VOBIZ_STREAM_TTL_SECONDS);

    await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, streamToken)).resolves.toBe('o1');
    const later = Date.now() + (VOBIZ_STREAM_TTL_SECONDS + 1) * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(later);
    await expect(verifyVobizToken(VOBIZ_DOMAINS.STREAM, streamToken)).resolves.toBeNull();
});

it('every STREAM token minted in src/ passes VOBIZ_STREAM_TTL_SECONDS', () => {
    const offenders: string[] = [];
    let found = 0;
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p);
            } else if (/\.(ts|tsx)$/.test(e.name)) {
                const src = fs.readFileSync(p, 'utf8');
                for (const m of src.matchAll(/mintVobizToken\(\s*VOBIZ_DOMAINS\.STREAM\b[^)]*\)/g)) {
                    found++;
                    if (!/VOBIZ_STREAM_TTL_SECONDS/.test(m[0])) offenders.push(`${path.relative(SRC, p)}: ${m[0]}`);
                }
            }
        }
    };
    walk(SRC);
    expect(found).toBeGreaterThan(0); // the scan must see the answer route's mint
    expect(offenders).toEqual([]);
});
