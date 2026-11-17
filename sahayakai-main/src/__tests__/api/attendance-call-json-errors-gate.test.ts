/**
 * CLASS GATE — a failure in the parent-call flow always reaches the teacher as a message.
 *
 * Bug class: a server error the call route does not catch. Next.js answers an uncaught route
 * error with an EMPTY 500, the modal parsed every non-OK body with `await res.json()`, and the
 * teacher saw "Unexpected end of JSON input". The instance was a Firestore error while resolving
 * the call target, which moved outside the Twilio path's try/catch.
 *
 * Layers:
 *  1. SERVER — for every provider, a Firestore failure before dialling (getDb, or any of the
 *     three reads that resolve the target) returns a JSON 500 with an `error` string, and no
 *     provider is contacted.
 *  2. CLIENT — callErrorFromResponse never throws: a body that is not JSON becomes the fallback
 *     message, and a JSON body keeps its error and code.
 *  3. STRUCTURAL — the modal reads every failed attendance response through
 *     callErrorFromResponse, never with a bare `res.json()`.
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { createFakeDb, lastJsonBody, type Store } from '../helpers/fake-attendance-db';
import { callErrorFromResponse, CallRequestError } from '@/lib/attendance/call-errors';

const PHONE = '+919800000105'; // made-up, +9198000001xx test range
const jsonSpy = jest.spyOn(NextResponse, 'json');

jest.mock('@/lib/calling-hours', () => {
    const actual = jest.requireActual('@/lib/calling-hours');
    return { ...actual, checkCallingWindow: () => actual.checkCallingWindow(new Date('2026-11-16T06:30:00.000Z')) };
});
let getDbFails = false;
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => {
        if (getDbFails) throw new Error('getDb: UNAVAILABLE');
        return (global as any).__fakeDb;
    },
}));
jest.mock('@/lib/voice-pipeline/health', () => ({ getEffectiveMode: async () => 'batch' }));
jest.mock('@/lib/vobiz/tokens', () => ({
    VOBIZ_DOMAINS: { ANSWER: 'answer', STATUS: 'status' },
    VOBIZ_STATUS_TTL_SECONDS: 1800,
    mintVobizToken: async () => ({ token: 'tok' }),
}));
jest.mock('@/lib/vobiz/warm', () => ({ warmTelephony: () => undefined }));
const placeVobizCall = jest.fn();
jest.mock('@/lib/vobiz/client', () => ({
    placeVobizCall: (...a: unknown[]) => placeVobizCall(...a),
    readVobizConfig: () => ({ authId: 'a', authToken: 't', fromNumber: '+911', baseUrl: 'https://x' }),
}));

const ENV_KEYS = ['VOICE_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'VOICE_EXOTEL_CALL_URL'];
const PROVIDERS: Record<string, Record<string, string>> = {
    twilio: { VOICE_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_PHONE_NUMBER: '+1555' },
    vobiz: { VOICE_PROVIDER: 'vobiz' },
    exotel: { VOICE_PROVIDER: 'exotel', VOICE_EXOTEL_CALL_URL: 'https://voice.test/api/exotel/call' },
};

const req = () =>
    ({
        json: async () => ({ outreachId: 'o1', parentLanguage: 'Hindi' }),
        headers: { get: (k: string) => ({ 'x-user-id': 'teacher-A', host: 'app.test' } as Record<string, string>)[k] ?? null },
    }) as any;

/** A fake db whose reads of one collection fail, as a Firestore outage would. */
function dbFailingOn(failing: string) {
    const store: Store = {
        parent_outreach: { o1: { teacherUid: 'teacher-A', parentPhone: PHONE, classId: 'c1', studentId: 's1', callStatus: 'initiated' } },
        classes: { c1: { teacherUid: 'teacher-A' } },
        'classes/c1/students': { s1: { parentPhone: PHONE } },
    };
    const base = createFakeDb(store);
    const failingGet = { get: async () => { throw new Error(`${failing}: UNAVAILABLE`); } };
    const wrap = (name: string, coll: any): any => ({
        ...coll,
        doc: (id?: string) => {
            const ref = coll.doc(id);
            return {
                ...ref,
                ...(name === failing ? failingGet : {}),
                collection: (sub: string) => wrap(`${name}/${sub}`, ref.collection(sub)),
            };
        },
    });
    return { ...base, collection: (name: string) => wrap(name, base.collection(name)) };
}

const fetchMock = jest.fn();
const saved: Record<string, string | undefined> = {};
beforeAll(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; });
afterAll(() => { for (const k of ENV_KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]); });
beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    getDbFails = false;
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    placeVobizCall.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

const FAILURES: [string, () => void][] = [
    ['getDb', () => { getDbFails = true; }],
    ['the outreach read', () => { (global as any).__fakeDb = dbFailingOn('parent_outreach'); }],
    ['the class read', () => { (global as any).__fakeDb = dbFailingOn('classes'); }],
    ['the student read', () => { (global as any).__fakeDb = dbFailingOn('classes/students'); }],
];

describe.each(Object.keys(PROVIDERS))('server [%s]', (provider) => {
    it.each(FAILURES)('%s failing: JSON 500 with an error message, no provider contacted', async (_name, arrange) => {
        Object.assign(process.env, PROVIDERS[provider]);
        arrange();
        const { POST } = await import('@/app/api/attendance/call/route');
        const res = await POST(req());
        expect(res.status).toBe(500);
        const body = lastJsonBody(jsonSpy);
        expect(typeof body.error).toBe('string');
        expect(body.error.length).toBeGreaterThan(0);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(placeVobizCall).not.toHaveBeenCalled();
    });
});

describe('client: callErrorFromResponse', () => {
    it('turns a body that is not JSON into the fallback, without throwing', async () => {
        const err = await callErrorFromResponse(new Response('', { status: 500 }), 'Call failed');
        expect(err).toBeInstanceOf(CallRequestError);
        expect(err.message).toBe('Call failed');
        expect(err.code).toBeUndefined();
        const html = await callErrorFromResponse(new Response('<html>502 Bad Gateway</html>', { status: 502 }), 'Call failed');
        expect(html.message).toBe('Call failed');
    });

    it('keeps the route message and code from a JSON body', async () => {
        const res = new Response(JSON.stringify({ error: 'Internal error', code: 'INTERNAL' }), { status: 500 });
        const err = await callErrorFromResponse(res, 'Call failed');
        expect(err.message).toBe('Internal error');
        expect(err.code).toBe('INTERNAL');
    });
});

describe('structural: the modal reads failed responses safely', () => {
    const modal = fs.readFileSync(path.resolve(__dirname, '../../components/attendance/contact-parent-modal.tsx'), 'utf8');

    it('every failed attendance response goes through callErrorFromResponse', () => {
        expect(modal).toMatch(/from ["']@\/lib\/attendance\/call-errors["']/);
        // `if (!res.ok) { const err = await res.json() ...` is the shape that threw on an empty body.
        expect(modal).not.toMatch(/if \(!res\.ok\)\s*\{\s*const \w+ = await res\.json\(\)/);
        for (const route of ['/api/attendance/outreach', '/api/attendance/call']) {
            const at = modal.indexOf(`fetch('${route}'`);
            expect(at).toBeGreaterThan(0);
            expect(modal.slice(at, at + 1600)).toMatch(/if \(!res\.ok\) throw await callErrorFromResponse\(res,/);
        }
    });
});
