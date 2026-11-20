/**
 * @jest-environment node
 *
 * Regression (P1, cost abuse): the anonymous VIDYA live-voice limiter keyed on the FIRST
 * X-Forwarded-For entry, which the client controls, so rotating that header minted
 * unlimited Gemini Live stream tokens. The key now comes from clientAddress (the last
 * entry our own infrastructure appended); a rotated client prefix must not reset the 6/hour limit.
 */
import { clientAddress } from '@/lib/client-address';

jest.mock('@/lib/sidecar/signing', () => ({
    mintPublicStreamToken: jest.fn(async () => ({ token: 'tok', expiresInSeconds: 60 })),
}));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

const h = (xff?: string, realIp?: string) => ({
    get: (k: string) => (k === 'x-forwarded-for' ? xff ?? null : k === 'x-real-ip' ? realIp ?? null : null),
});

describe('clientAddress (the one helper this route reads)', () => {
    it('uses the last X-Forwarded-For entry, never the client-supplied first one', () => {
        expect(clientAddress({ headers: h('1.1.1.1, 2.2.2.2, 203.0.113.9') } as any, {})).toBe('203.0.113.9');
    });
    it('ignores empty entries and never trusts x-real-ip', () => {
        expect(clientAddress({ headers: h(' , ') } as any, {})).toBe('unknown');
        expect(clientAddress({ headers: h(undefined, '198.51.100.4') } as any, {})).toBe('unknown');
    });
});

describe('POST /api/vidya-voice/public-session', () => {
    const saved = { ...process.env };
    let POST: (r: any) => Promise<Response>;
    beforeAll(async () => {
        process.env.VIDYA_VOICE_PUBLIC_ENABLED = 'true';
        process.env.NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL = 'https://agents.test';
        ({ POST } = (await import('@/app/api/vidya-voice/public-session/route')) as any);
    });
    afterAll(() => {
        process.env = saved;
    });
    const call = (xff: string) => POST({ headers: h(xff), json: async () => ({}) });

    it('a rotated client-supplied prefix does not reset the per-address limit', async () => {
        const statuses: number[] = [];
        for (let i = 0; i < 8; i++) statuses.push((await call(`10.0.0.${i}, 203.0.113.50`)).status);
        expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
        expect(statuses.slice(6)).toEqual([429, 429]);
    });

    it('a different real address still gets its own allowance', async () => {
        expect((await call('10.9.9.9, 203.0.113.51')).status).toBe(200);
    });
});
