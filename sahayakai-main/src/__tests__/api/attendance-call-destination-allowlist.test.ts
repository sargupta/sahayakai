/**
 * @jest-environment node
 *
 * CALL_ALLOWED_DESTINATIONS — the test/staging guard that makes a stack able to
 * dial ONLY approved numbers. It is checked on the FINAL destination (after any
 * test override), before any provider is contacted, so a missing or wrong
 * override can never fall back to a real parent's number.
 */
import { NextResponse } from 'next/server';
import { createFakeDb, lastJsonBody, type Store } from '../helpers/fake-attendance-db';
import { isDestinationAllowed } from '@/lib/vobiz/client';

const APPROVED = '+918431339732';
const REAL_PARENT = '+919812345678';
let store: Store;
const jsonSpy = jest.spyOn(NextResponse, 'json');

jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => (global as any).__fakeDb }));
jest.mock('@/lib/calling-hours', () => ({
    checkCallingWindow: () => ({ allowed: true, istHour: 12, istTime: '12:00 IST', reason: '', nextAllowedAt: null }),
}));
jest.mock('@/lib/voice-pipeline/health', () => ({ getEffectiveMode: async () => 'batch' }));
jest.mock('@/lib/vobiz/tokens', () => ({
    VOBIZ_DOMAINS: { ANSWER: 'answer', STATUS: 'status' },
    VOBIZ_STATUS_TTL_SECONDS: 1800,
    mintVobizToken: async () => ({ token: 'tok' }),
}));
const placeVobizCall = jest.fn();
jest.mock('@/lib/vobiz/client', () => ({
    ...jest.requireActual('@/lib/vobiz/client'),
    placeVobizCall: (...a: unknown[]) => placeVobizCall(...a),
    readVobizConfig: () => ({ authId: 'a', authToken: 't', fromNumber: '+911', baseUrl: 'https://x' }),
}));

function req(body: unknown) {
    return {
        json: async () => body,
        headers: { get: (k: string) => ({ 'x-user-id': 'teacher-A', host: 'app.test' } as Record<string, string>)[k] ?? null },
    } as any;
}

const ENV_KEYS = ['VOICE_PROVIDER', 'VOBIZ_TEST_OVERRIDE_NUMBER', 'CALL_ALLOWED_DESTINATIONS',
    'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'TWILIO_TEST_OVERRIDE_NUMBER'];

describe('isDestinationAllowed', () => {
    it('is unrestricted when unset (production)', () => {
        expect(isDestinationAllowed(REAL_PARENT, {})).toBe(true);
        expect(isDestinationAllowed(REAL_PARENT, { CALL_ALLOWED_DESTINATIONS: ' ' })).toBe(true);
    });

    it('compares in the exact form the carrier receives', () => {
        const env = { CALL_ALLOWED_DESTINATIONS: '+91 84313 39732' };
        for (const form of ['+918431339732', '918431339732', '8431339732', '+91-8431-339732']) {
            expect(isDestinationAllowed(form, env)).toBe(true);
        }
        expect(isDestinationAllowed('+918431339733', env)).toBe(false);
        expect(isDestinationAllowed(REAL_PARENT, env)).toBe(false);
    });
});

describe('call route with CALL_ALLOWED_DESTINATIONS', () => {
    let POST: (r: any) => Promise<Response>;
    const saved: Record<string, string | undefined> = {};
    const fetchMock = jest.fn();

    beforeAll(async () => {
        POST = (await import('@/app/api/attendance/call/route')).POST as any;
        for (const k of ENV_KEYS) saved[k] = process.env[k];
    });
    afterAll(() => {
        for (const k of ENV_KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
    });
    beforeEach(() => {
        for (const k of ENV_KEYS) delete process.env[k];
        store = { parent_outreach: { o1: { teacherUid: 'teacher-A', parentPhone: REAL_PARENT, callStatus: 'initiated' } } };
        (global as any).__fakeDb = createFakeDb(store);
        placeVobizCall.mockReset().mockResolvedValue({ ok: true, handle: { requestUuid: 'uuid1' } });
        fetchMock.mockReset().mockResolvedValue({ ok: true, status: 201, json: async () => ({ sid: 'CA1' }) });
        (global as any).fetch = fetchMock;
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        process.env.CALL_ALLOWED_DESTINATIONS = APPROVED;
    });

    it('vobiz: without an override the real parent number is refused and nothing is dialled', async () => {
        process.env.VOICE_PROVIDER = 'vobiz';
        const res = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(403);
        expect(lastJsonBody(jsonSpy).code).toBe('DESTINATION_NOT_ALLOWED');
        expect(placeVobizCall).not.toHaveBeenCalled();
        expect(store.parent_outreach.o1).toMatchObject({ callStatus: 'failed', callFailureCategory: 'destination_not_allowed' });
    });

    it('vobiz: with the approved override, the provider receives exactly that number', async () => {
        process.env.VOICE_PROVIDER = 'vobiz';
        process.env.VOBIZ_TEST_OVERRIDE_NUMBER = APPROVED;
        const res = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(200);
        expect(placeVobizCall).toHaveBeenCalledTimes(1);
        expect(placeVobizCall.mock.calls[0][1].to).toBe(APPROVED);
    });

    it('vobiz: an override that is not on the list is refused too', async () => {
        process.env.VOICE_PROVIDER = 'vobiz';
        process.env.VOBIZ_TEST_OVERRIDE_NUMBER = '+918431339733';
        const res = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(403);
        expect(placeVobizCall).not.toHaveBeenCalled();
    });

    it('twilio: the same guard applies, before Twilio is contacted', async () => {
        Object.assign(process.env, { VOICE_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_PHONE_NUMBER: '+1555' });
        const res = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(403);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
