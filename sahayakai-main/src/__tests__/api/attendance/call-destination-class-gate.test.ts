/**
 * Class gate: the platform can only ever dial the parent number on the
 * student's record.
 *
 * WHAT HAPPENED
 * `POST /api/attendance/outreach-records` stored the request body's
 * `parentPhone` on the parent_outreach doc, and `POST /api/attendance/call`
 * dialled whatever that doc held. Any gold/premium teacher could therefore
 * write an outreach for one of their own students carrying ANY number, then
 * make the company's telephony account ring it.
 *
 * WHAT THIS GATE CATCHES
 * Not "that one writer stores the wrong field" — that is the instance. The
 * class is: a destination that is not the student's current, recorded parent
 * phone must never reach a provider, whichever route wrote the outreach doc
 * and whichever provider is configured. So the tests below write the doc
 * DIRECTLY (as any present or future writer could) and assert the call route
 * refuses it before contacting Vobiz, Twilio or the Exotel voicebot — and,
 * separately, that the outreach-records writer no longer stores the body's
 * phone at all.
 */

import { NextResponse } from 'next/server';

// ── Fake Firestore ───────────────────────────────────────────────────────────

type Data = Record<string, unknown>;
const store: {
    outreach: Record<string, Data>;
    classes: Record<string, Data>;
    students: Record<string, Record<string, Data>>;
    writes: { id: string; rec: Data }[];
} = { outreach: {}, classes: {}, students: {}, writes: [] };

function snap(id: string, data: Data | undefined) {
    return { id, exists: !!data, data: () => data };
}

function outreachRef(id?: string) {
    const docId = id ?? `out_${Math.random().toString(36).slice(2, 9)}`;
    return {
        id: docId,
        get: async () => snap(docId, store.outreach[docId]),
        set: async (rec: Data) => {
            store.outreach[docId] = rec;
            store.writes.push({ id: docId, rec });
        },
        update: async (patch: Data) => {
            store.outreach[docId] = { ...(store.outreach[docId] ?? {}), ...patch };
        },
    };
}

function classRef(classId: string) {
    return {
        id: classId,
        get: async () => snap(classId, store.classes[classId]),
        collection: () => ({
            doc: (studentId: string) => ({
                id: studentId,
                get: async () => snap(studentId, store.students[classId]?.[studentId]),
            }),
        }),
    };
}

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (name: string) => ({
            doc: (id?: string) => (name === 'classes' ? classRef(id as string) : outreachRef(id)),
        }),
    }),
}));

// ── Everything else the routes touch ─────────────────────────────────────────

jest.mock('@/lib/calling-hours', () => ({
    checkCallingWindow: () => ({ allowed: true, istHour: 11, istTime: '11:00 IST', reason: '', nextAllowedAt: null }),
}));

const placeVobizCall = jest.fn(async () => ({ ok: true, handle: { requestUuid: 'vobiz-req-1' } }));
jest.mock('@/lib/vobiz/client', () => ({
    readVobizConfig: () => ({ authId: 'a', authToken: 't', fromNumber: '+918000000000', baseUrl: 'https://vobiz.test' }),
    placeVobizCall: (...args: unknown[]) => (placeVobizCall as unknown as (...a: unknown[]) => unknown)(...args),
}));

jest.mock('@/lib/vobiz/tokens', () => ({
    VOBIZ_DOMAINS: { ANSWER: 'vobiz-answer', STREAM: 'vobiz-call', STATUS: 'vobiz-status' },
    VOBIZ_STATUS_TTL_SECONDS: 1800,
    mintVobizToken: async () => ({ token: 'tok' }),
}));

jest.mock('@/lib/voice-pipeline/health', () => ({ getEffectiveMode: async () => 'batch' }));

jest.mock('@/lib/db/adapter', () => ({ dbAdapter: { getUser: jest.fn(async () => ({ planType: 'gold' })) } }));
jest.mock('@/lib/plan-utils', () => ({ hasAdvancedPlan: () => true }));

// Imported after the mocks.
import { POST as callPOST } from '@/app/api/attendance/call/route';
import { POST as recordsPOST } from '@/app/api/attendance/outreach-records/route';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEACHER = 'teacher-A';
const PARENT = '+919812345678';        // on the student's record
const STRANGER = '+919999999999';      // attacker-chosen

function request(body: unknown, userId: string | null = TEACHER) {
    const headers = new Map<string, string>([['host', 'app.test']]);
    if (userId) headers.set('x-user-id', userId);
    return {
        json: async () => body,
        headers: { get: (k: string) => headers.get(k) ?? null },
    } as unknown as Parameters<typeof callPOST>[0];
}

function seedOutreach(id: string, overrides: Data = {}) {
    store.outreach[id] = {
        teacherUid: TEACHER,
        classId: 'c1',
        studentId: 's1',
        parentPhone: PARENT,
        parentLanguage: 'Hindi',
        callStatus: 'initiated',
        ...overrides,
    };
}

/** Body of the last JSON response (the jest Response polyfill does not round-trip bodies). */
let jsonSpy: jest.SpyInstance;
function lastJson(): { body: Record<string, unknown>; status: number } {
    const calls = jsonSpy.mock.calls;
    const [body, init] = calls[calls.length - 1] as [Record<string, unknown>, { status?: number } | undefined];
    return { body, status: init?.status ?? 200 };
}

async function call(outreachId: string) {
    await callPOST(request({ outreachId, parentLanguage: 'Hindi' }));
    return lastJson();
}

const fetchMock = jest.fn();
const PROVIDERS = ['vobiz', 'twilio', 'exotel'] as const;

function providerWasContacted(): boolean {
    return placeVobizCall.mock.calls.length > 0 || fetchMock.mock.calls.length > 0;
}

function dialledNumber(provider: (typeof PROVIDERS)[number]): string | null {
    if (provider === 'vobiz') return (placeVobizCall.mock.calls[0] as unknown as [unknown, { to: string }])?.[1]?.to ?? null;
    if (provider === 'twilio') {
        const init = fetchMock.mock.calls[0]?.[1] as { body: URLSearchParams } | undefined;
        return init ? new URLSearchParams(init.body.toString()).get('To') : null;
    }
    // Exotel: the voicebot dials the doc's phone itself; the route only forwards the id.
    return fetchMock.mock.calls.length > 0 ? String(store.outreach['o1']?.parentPhone) : null;
}

beforeEach(() => {
    store.outreach = {};
    store.writes = [];
    store.classes = { c1: { teacherUid: TEACHER } };
    store.students = { c1: { s1: { name: 'Riya', parentPhone: PARENT } } };
    placeVobizCall.mockClear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ sid: 'CA1', callSid: 'exo-1' }),
        text: async () => '',
    }));
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'secret';
    process.env.TWILIO_PHONE_NUMBER = '+18000000000';
    process.env.VOICE_EXOTEL_CALL_URL = 'https://voicebot.test/api/exotel/call';
    delete process.env.VOBIZ_TEST_OVERRIDE_NUMBER;
    delete process.env.TWILIO_TEST_OVERRIDE_NUMBER;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jsonSpy = jest.spyOn(NextResponse, 'json');
});

afterEach(() => {
    delete process.env.VOICE_PROVIDER;
    jest.restoreAllMocks();
});

// ── The class gate: /api/attendance/call ─────────────────────────────────────

describe.each(PROVIDERS)('POST /api/attendance/call with VOICE_PROVIDER=%s', (provider) => {
    beforeEach(() => {
        process.env.VOICE_PROVIDER = provider;
    });

    it('refuses an outreach carrying a number that is not the student record’s, before contacting the provider', async () => {
        seedOutreach('o1', { parentPhone: STRANGER });
        const { status, body } = await call('o1');
        expect(status).toBe(409);
        expect(body.code).toBe('PHONE_MISMATCH');
        expect(providerWasContacted()).toBe(false);
    });

    it('refuses an outreach with no phone at all', async () => {
        seedOutreach('o1', { parentPhone: undefined });
        const { status } = await call('o1');
        expect(status).toBe(409);
        expect(providerWasContacted()).toBe(false);
    });

    it('refuses when the teacher no longer owns the class', async () => {
        seedOutreach('o1');
        store.classes.c1 = { teacherUid: 'teacher-B' };
        const { status } = await call('o1');
        expect(status).toBe(403);
        expect(providerWasContacted()).toBe(false);
    });

    it('refuses when the student has left the class', async () => {
        seedOutreach('o1');
        store.students.c1 = {};
        const { status } = await call('o1');
        expect(status).toBe(404);
        expect(providerWasContacted()).toBe(false);
    });

    it('refuses when the student record has no valid phone', async () => {
        seedOutreach('o1', { parentPhone: 'not-a-number' });
        store.students.c1.s1 = { name: 'Riya', parentPhone: 'not-a-number' };
        const { status } = await call('o1');
        expect(status).toBe(422);
        expect(providerWasContacted()).toBe(false);
    });

    it('refuses another teacher’s outreach', async () => {
        seedOutreach('o1', { teacherUid: 'teacher-B' });
        const { status } = await call('o1');
        expect(status).toBe(403);
        expect(providerWasContacted()).toBe(false);
    });

    it('dials the student record’s number when everything matches', async () => {
        seedOutreach('o1');
        const { status } = await call('o1');
        expect(status).toBe(200);
        expect(providerWasContacted()).toBe(true);
        expect(dialledNumber(provider)).toBe(PARENT);
    });
});

// ── The instance: /api/attendance/outreach-records ───────────────────────────

describe('POST /api/attendance/outreach-records', () => {
    const base = {
        classId: 'c1',
        className: 'Class 4A',
        studentId: 's1',
        studentName: 'Riya',
        parentLanguage: 'Hindi',
        reason: 'consecutive_absences',
        generatedMessage: 'msg',
    };

    it('ignores a caller-supplied phone and stores the student record’s', async () => {
        await recordsPOST(request({ ...base, parentPhone: STRANGER, deliveryMethod: 'twilio_call' }));
        expect(lastJson().status).toBe(200);
        expect(store.writes).toHaveLength(1);
        expect(store.writes[0].rec.parentPhone).toBe(PARENT);
    });

    it('accepts a body without parentPhone (the field is ignored)', async () => {
        await recordsPOST(request({ ...base, deliveryMethod: 'twilio_call' }));
        expect(lastJson().status).toBe(200);
        expect(store.writes[0].rec.parentPhone).toBe(PARENT);
    });

    it('refuses a call-type record for a student with no phone on file, and writes nothing', async () => {
        store.students.c1.s1 = { name: 'Riya' };
        await recordsPOST(request({ ...base, parentPhone: STRANGER, deliveryMethod: 'twilio_call' }));
        expect(lastJson()).toEqual({ status: 400, body: { error: 'Student has no valid parent phone on record' } });
        expect(store.writes).toHaveLength(0);
    });

    it('still records a WhatsApp-copy outreach without a phone, storing none', async () => {
        store.students.c1.s1 = { name: 'Riya' };
        await recordsPOST(request({ ...base, parentPhone: STRANGER, deliveryMethod: 'whatsapp_copy' }));
        expect(lastJson().status).toBe(200);
        expect(store.writes[0].rec.parentPhone).toBe('');
    });

    it('end to end: a spoofed record cannot make the platform ring the spoofed number', async () => {
        process.env.VOICE_PROVIDER = 'vobiz';
        await recordsPOST(request({ ...base, parentPhone: STRANGER, deliveryMethod: 'twilio_call' }));
        const { outreachId } = lastJson().body as { outreachId: string };
        const { status } = await call(outreachId);
        expect(status).toBe(200);
        expect((placeVobizCall.mock.calls[0] as unknown as [unknown, { to: string }])[1].to).toBe(PARENT);
    });
});

