/**
 * @jest-environment node
 *
 * The Vobiz notice carrier (phase 2a contract §3). No network: `placeCall` is a
 * fake that records what would have been sent, and the signing key comes from
 * a mocked getSecret. Covers: refusals before any provider contact (non-mobile
 * numbers, guardian destinations, flag off, non-https base), callback URLs built
 * from the configured base only with tokens that verify for exactly their own
 * domain, the failure mapping, and that the number never reaches a log.
 */
import { logger as mockedLogger } from '@/lib/logger';
import { createVobizNoticeCarrier, VOBIZ_RING_TIMEOUT_SECONDS, type VobizNoticeCarrierDeps } from '@/lib/sampark/dispatch/vobiz-carrier';
import type { PlaceCallRequest } from '@/lib/sampark/ports';
import { mintSamparkVoiceToken, verifySamparkVoiceToken, voicePrincipal, type SamparkVoiceDomain } from '@/lib/sampark/voice/tokens';
import type { PlaceCallOptions, VobizConfig, VobizFailureCategory, VobizResult } from '@/lib/vobiz/client';
import type { SamparkCall } from '@/types/sampark';

import { ORG, TEST_PHONE, TEST_PHONE_HASH, TEST_PHONE_LAST4 } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/secrets', () => ({ getSecret: async () => 'sampark-voice-test-signing-key-0123456789abcdef' }));

const logger = mockedLogger as unknown as Record<'info' | 'warn' | 'error' | 'debug', jest.Mock>;

const BASE = 'https://sampark-calls.example.test';
const CONFIG: VobizConfig = { authId: 'MA_TEST', authToken: 'tok', baseUrl: 'https://api.vobiz.test/api/v1', fromNumber: '+918000000000' };
const CALL_ID = 'c0ffee00c0ffee00c0ffee00c0ffee00';

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
beforeEach(() => {
    process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
    jest.clearAllMocks();
});
afterAll(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

function call(overrides: Partial<SamparkCall> = {}): SamparkCall {
    return {
        id: CALL_ID,
        orgId: ORG,
        intentId: 'intent-1',
        campaignId: 'camp-ptm',
        purpose: 'ptm_invite',
        guardianId: 'g001',
        phoneHash: TEST_PHONE_HASH,
        phoneLast4: TEST_PHONE_LAST4,
        destination: 'test_phone',
        language: 'Nepali',
        variant: 'default',
        attempt: 1,
        state: 'dialing',
        leaseUntil: '2026-10-07T05:32:00.000Z',
        carrier: 'vobiz',
        providerCallId: null,
        outcome: { heard: 'none', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: null,
        billedSeconds: null,
        costPaise: null,
        audioSeconds: 40,
        createdAt: '2026-10-07T05:30:00.000Z',
        updatedAt: '2026-10-07T05:30:00.000Z',
        endedAt: null,
        failureReason: null,
        ...overrides,
    };
}

function request(overrides: Partial<PlaceCallRequest> = {}, callOverrides: Partial<SamparkCall> = {}): PlaceCallRequest {
    return { call: call(callOverrides), destinationE164: TEST_PHONE, audioSeconds: 40, ...overrides };
}

function fakeVobiz(result: VobizResult = { ok: true, handle: { requestUuid: 'req-uuid-1' } }) {
    const sent: { config: VobizConfig; options: PlaceCallOptions }[] = [];
    const placeCall = jest.fn(async (config: VobizConfig, options: PlaceCallOptions) => {
        sent.push({ config, options });
        return result;
    });
    return { sent, placeCall };
}

function carrier(overrides: Partial<VobizNoticeCarrierDeps> = {}) {
    const fake = fakeVobiz();
    const c = createVobizNoticeCarrier({ config: CONFIG, publicBaseUrl: BASE, mintToken: mintSamparkVoiceToken, placeCall: fake.placeCall, ...overrides });
    return { carrier: c, ...fake };
}

describe('createVobizNoticeCarrier — construction', () => {
    it('is the vobiz carrier', () => {
        expect(carrier().carrier.kind).toBe('vobiz');
    });

    it.each([
        ['http', 'http://sampark-calls.example.test'],
        ['a path', 'https://sampark-calls.example.test/prefix'],
        ['a query', 'https://sampark-calls.example.test/?x=1'],
        ['credentials', 'https://user:pw@sampark-calls.example.test'],
        ['empty', ''],
        ['not a URL', 'sampark-calls.example.test'],
    ])('refuses a base URL with %s', (_label, base) => {
        expect(() => carrier({ publicBaseUrl: base })).toThrow(/publicBaseUrl/);
    });

    it.each([undefined, 'false', 'TRUE', '1'])('refuses to construct unless SAMPARK_LIVE_DIAL_ENABLED is exactly "true" (got %p)', (value) => {
        if (value === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        else process.env.SAMPARK_LIVE_DIAL_ENABLED = value;
        expect(() => carrier()).toThrow(/SAMPARK_LIVE_DIAL_ENABLED/);
    });

    it('accepts a trailing slash on the origin and never doubles it', async () => {
        const { carrier: c, sent } = carrier({ publicBaseUrl: `${BASE}/` });
        await c.place(request());
        expect(sent[0].options.answerUrl.startsWith(`${BASE}/api/webhooks/sampark-voice/answer?t=`)).toBe(true);
    });
});

describe('createVobizNoticeCarrier — place', () => {
    it('dials the test phone with callback URLs built from the configured base and returns no events', async () => {
        const { carrier: c, sent, placeCall } = carrier();
        const result = await c.place(request());
        expect(result).toEqual({ ok: true, providerCallId: 'req-uuid-1', events: [] });
        expect(placeCall).toHaveBeenCalledTimes(1);
        const { config, options } = sent[0];
        expect(config).toBe(CONFIG);
        expect(options.to).toBe(TEST_PHONE);
        expect(options.ringTimeout).toBe(VOBIZ_RING_TIMEOUT_SECONDS);
        expect(VOBIZ_RING_TIMEOUT_SECONDS).toBe(30);

        const answer = new URL(options.answerUrl);
        const hangup = new URL(options.hangupUrl);
        const ring = new URL(options.ringUrl ?? '');
        expect(`${answer.origin}${answer.pathname}`).toBe(`${BASE}/api/webhooks/sampark-voice/answer`);
        expect(`${hangup.origin}${hangup.pathname}`).toBe(`${BASE}/api/webhooks/sampark-voice/status`);
        expect(`${ring.origin}${ring.pathname}`).toBe(`${BASE}/api/webhooks/sampark-voice/status`);
        expect([...answer.searchParams.keys()]).toEqual(['t']);
        expect([...hangup.searchParams.entries()][0]).toEqual(['kind', 'hangup']);
        expect([...ring.searchParams.entries()][0]).toEqual(['kind', 'ring']);

        const answerToken = answer.searchParams.get('t');
        const statusToken = hangup.searchParams.get('t');
        // The exact URLs: nothing but the base, the route and the token.
        expect(options.answerUrl).toBe(`${BASE}/api/webhooks/sampark-voice/answer?t=${encodeURIComponent(answerToken ?? '')}`);
        expect(options.hangupUrl).toBe(`${BASE}/api/webhooks/sampark-voice/status?kind=hangup&t=${encodeURIComponent(statusToken ?? '')}`);
        expect(options.ringUrl).toBe(`${BASE}/api/webhooks/sampark-voice/status?kind=ring&t=${encodeURIComponent(statusToken ?? '')}`);
        expect(ring.searchParams.get('t')).toBe(statusToken);
    });

    it('signs each token for its own domain and the call principal, and for no other domain', async () => {
        const { carrier: c, sent } = carrier();
        await c.place(request());
        const answerToken = new URL(sent[0].options.answerUrl).searchParams.get('t');
        const statusToken = new URL(sent[0].options.hangupUrl).searchParams.get('t');
        const principal = voicePrincipal(ORG, CALL_ID);
        expect(principal).toBe(`${ORG}~${CALL_ID}`);
        expect(await verifySamparkVoiceToken('sampark-answer', answerToken)).toBe(principal);
        expect(await verifySamparkVoiceToken('sampark-status', statusToken)).toBe(principal);
        const others: SamparkVoiceDomain[] = ['sampark-gather-menu', 'sampark-gather-optout', 'sampark-audio'];
        for (const domain of [...others, 'sampark-status' as const]) expect(await verifySamparkVoiceToken(domain, answerToken)).toBeNull();
        for (const domain of [...others, 'sampark-answer' as const]) expect(await verifySamparkVoiceToken(domain, statusToken)).toBeNull();
    });

    it('mints tokens through the injected minter with the call principal', async () => {
        const mintToken = jest.fn(async (domain: SamparkVoiceDomain, principal: string) => `${principal}.9999999999.${domain}`);
        const { carrier: c, sent } = carrier({ mintToken });
        await c.place(request());
        expect(mintToken.mock.calls.map(([domain, principal]) => [domain, principal])).toEqual([
            ['sampark-answer', `${ORG}~${CALL_ID}`],
            ['sampark-status', `${ORG}~${CALL_ID}`],
        ]);
        expect(sent[0].options.answerUrl).toBe(`${BASE}/api/webhooks/sampark-voice/answer?t=${ORG}~${CALL_ID}.9999999999.sampark-answer`);
    });

    it.each([
        ['a synthetic demo number', '+915000000123'],
        ['a landline', '+911123456789'],
        ['a number without the country code', '9800000001'],
        ['a foreign number', '+14155550123'],
        ['an empty string', ''],
    ])('refuses %s before contacting Vobiz', async (_label, number) => {
        const { carrier: c, placeCall } = carrier();
        expect(await c.place(request({ destinationE164: number }))).toEqual({ ok: false, reason: 'destination_not_mobile', retryable: false });
        expect(placeCall).not.toHaveBeenCalled();
    });

    it.each([
        ['guardian', 'guardian' as const],
        ['missing (a pre-2a record, i.e. guardian)', undefined],
    ])('refuses a call whose destination is %s: phase 2a rings only the test phone', async (_label, destination) => {
        const { carrier: c, placeCall } = carrier();
        expect(await c.place(request({}, { destination }))).toEqual({ ok: false, reason: 'guardian_dial_not_enabled', retryable: false });
        expect(placeCall).not.toHaveBeenCalled();
    });

    it.each<[Exclude<VobizFailureCategory, 'network'>, boolean]>([
        ['provider_rejected', true],
        ['provider_unconfigured', false],
        ['invalid_destination', false],
    ])('maps a %s failure to retryable=%p', async (category, retryable) => {
        const fake = fakeVobiz({ ok: false, failure: { category, status: category === 'provider_rejected' ? 503 : undefined } });
        const c = createVobizNoticeCarrier({ config: CONFIG, publicBaseUrl: BASE, mintToken: mintSamparkVoiceToken, placeCall: fake.placeCall });
        expect(await c.place(request())).toEqual({ ok: false, reason: `vobiz_${category}`, retryable });
    });

    it('a network failure is an UNKNOWN outcome: it throws (left for the sweep), never a retryable failure', async () => {
        // The request may have reached Vobiz before the connection dropped; retrying could ring twice.
        const fake = fakeVobiz({ ok: false, failure: { category: 'network' } });
        const c = createVobizNoticeCarrier({ config: CONFIG, publicBaseUrl: BASE, mintToken: mintSamparkVoiceToken, placeCall: fake.placeCall });
        await expect(c.place(request())).rejects.toThrow('vobiz_network_outcome_unknown');
    });

    it('a token that cannot be minted is a clean, retryable failure: Vobiz is never contacted', async () => {
        const { carrier: c, placeCall } = carrier({ mintToken: async () => { throw new Error('signing key unavailable'); } });
        expect(await c.place(request())).toEqual({ ok: false, reason: 'callback_token_unavailable', retryable: true });
        expect(placeCall).not.toHaveBeenCalled();
    });

    it('a thrown provider error propagates, so the dispatcher leaves the call for the sweep', async () => {
        const c = createVobizNoticeCarrier({
            config: CONFIG,
            publicBaseUrl: BASE,
            mintToken: mintSamparkVoiceToken,
            placeCall: async () => { throw new Error('socket hang up'); },
        });
        await expect(c.place(request())).rejects.toThrow('socket hang up');
    });

    it('never writes the dialled number to a log, on success or failure', async () => {
        const spies = (['log', 'info', 'warn', 'error'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => undefined));
        try {
            await carrier().carrier.place(request());
            for (const category of ['network', 'provider_rejected', 'provider_unconfigured', 'invalid_destination'] as const) {
                const fake = fakeVobiz({ ok: false, failure: { category, status: 500 } });
                await createVobizNoticeCarrier({ config: CONFIG, publicBaseUrl: BASE, mintToken: mintSamparkVoiceToken, placeCall: fake.placeCall })
                    .place(request())
                    .catch(() => undefined); // network throws by design
            }
            await carrier({ mintToken: async () => { throw new Error('x'); } }).carrier.place(request());
            await carrier().carrier.place(request({ destinationE164: '+915000000123' }));
            expect(logger.warn).toHaveBeenCalled(); // the failures were logged — without the number
            const logged = JSON.stringify([
                ...Object.values(logger).map((m) => m.mock.calls),
                ...spies.map((s) => s.mock.calls),
            ]);
            expect(logged).not.toContain(TEST_PHONE.slice(1));
            expect(logged).not.toContain(TEST_PHONE.slice(-10));
            expect(logged).not.toContain('5000000123');
        } finally {
            for (const s of spies) s.mockRestore();
        }
    });
});
