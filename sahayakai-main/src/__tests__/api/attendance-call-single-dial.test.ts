/**
 * CLASS GATE — one outreach record can ring a parent at most once.
 *
 * Bug: /api/attendance/call had no "already dialled" check, so repeating the
 * POST with the same outreachId placed a new real call every time. For EVERY
 * provider (twilio, vobiz, exotel), the second POST must return 409
 * ALREADY_DIALLED and contact no provider; the first must still dial (control).
 */
import { NextResponse } from 'next/server';
import { createFakeDb, lastJsonBody, type Store } from '../helpers/fake-attendance-db';

const PHONE = '+919812345678';
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
    isDestinationAllowed: jest.requireActual('@/lib/vobiz/client').isDestinationAllowed,
    placeVobizCall: (...a: unknown[]) => placeVobizCall(...a),
    readVobizConfig: () => ({ authId: 'a', authToken: 't', fromNumber: '+911', baseUrl: 'https://x' }),
}));

function req(body: unknown) {
    return {
        json: async () => body,
        headers: { get: (k: string) => ({ 'x-user-id': 'teacher-A', host: 'app.test' } as Record<string, string>)[k] ?? null },
    } as any;
}

const ENV_KEYS = ['VOICE_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'VOICE_EXOTEL_CALL_URL', 'CALL_ALLOWED_DESTINATIONS'];
const PROVIDERS: Record<string, Record<string, string>> = {
    twilio: { VOICE_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_PHONE_NUMBER: '+1555' },
    vobiz: { VOICE_PROVIDER: 'vobiz' },
    exotel: { VOICE_PROVIDER: 'exotel', VOICE_EXOTEL_CALL_URL: 'https://voice.test/api/exotel/call' },
};

describe.each(Object.keys(PROVIDERS))('provider=%s', (provider) => {
    let POST: (r: any) => Promise<Response>;
    const fetchMock = jest.fn();
    const saved: Record<string, string | undefined> = {};
    beforeAll(async () => {
        POST = (await import('@/app/api/attendance/call/route')).POST as any;
        for (const k of ENV_KEYS) saved[k] = process.env[k];
    });
    afterAll(() => {
        for (const k of ENV_KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
    });
    beforeEach(() => {
        for (const k of ENV_KEYS) delete process.env[k];
        Object.assign(process.env, PROVIDERS[provider]);
        store = { parent_outreach: { o1: { teacherUid: 'teacher-A', parentPhone: PHONE, classId: 'c1', studentId: 's1', callStatus: 'initiated' } } };
        (global as any).__fakeDb = createFakeDb(store);
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ sid: 'CA1', callSid: 'x' }) });
        (global as any).fetch = fetchMock;
        placeVobizCall.mockReset();
        placeVobizCall.mockResolvedValue({ ok: true, handle: { requestUuid: 'uuid1' } });
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    const contacted = () => fetchMock.mock.calls.length + placeVobizCall.mock.calls.length;

    it('first POST dials; a repeated POST is 409 ALREADY_DIALLED and dials nothing', async () => {
        expect((await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }))).status).toBe(200);
        const afterFirst = contacted();
        expect(afterFirst).toBeGreaterThan(0);
        expect(store.parent_outreach.o1.dialClaimedAt).toBeTruthy();

        const second = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(second.status).toBe(409);
        expect(lastJsonBody(jsonSpy).code).toBe('ALREADY_DIALLED');
        expect(contacted()).toBe(afterFirst);
    });

    it('a record that already carries a callSid (dialled before this guard) is refused', async () => {
        store.parent_outreach.o1.callSid = 'CA-old';
        const res = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(409);
        expect(contacted()).toBe(0);
    });

    it("another teacher's record is still 403, and is not claimed", async () => {
        store.parent_outreach.o1.teacherUid = 'teacher-B';
        const res = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(403);
        expect(store.parent_outreach.o1.dialClaimedAt).toBeUndefined();
        expect(contacted()).toBe(0);
    });
});
