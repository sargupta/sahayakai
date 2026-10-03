/**
 * CLASS GATE — a dial that never happened must not look like a dial in flight.
 *
 * Bug class: the outreach doc was created as `callStatus: 'initiated'` before any
 * call existed, and the 5-minute per-student dedup counts everything that is not
 * `failed`. So ANY refusal in /api/attendance/call (calling hours, opt-out, bad
 * phone, provider down, ...) that returned early without touching the doc locked
 * the teacher out for five minutes and left the modal spinning — for a call that
 * was never placed.
 *
 * This table drives the REAL outreach route and the REAL call route for every
 * non-2xx exit of the call route, for each provider, and asserts the same three
 * things every time:
 *   1. the response really is a refusal (non-2xx),
 *   2. the outreach doc is not left `initiated` (it is `failed` + a category),
 *   3. an immediate retry by the teacher (a fresh outreach POST) is NOT blocked
 *      by dedup.
 * A static meta-test then fails if the route gains a refusal category the table
 * does not cover, or a raw non-2xx `NextResponse.json` that bypasses `refuse()`.
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { createFakeDb, type Store } from '../helpers/fake-attendance-db';
import { phoneSuppressionId } from '@/lib/call-suppression';

const PHONE = '+919812345678';
let store: Store;
let windowAllowed = true;
let vobizConfigured = true;
const placeVobizCall = jest.fn();
const fetchMock = jest.fn();

jest.spyOn(NextResponse, 'json');
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => (global as any).__fakeDb }));
jest.mock('@/lib/db/adapter', () => ({ dbAdapter: { getUser: async () => ({ planType: 'pro', displayName: 'T' }) } }));
jest.mock('@/lib/plan-utils', () => ({ hasAdvancedPlan: () => true }));
jest.mock('@/lib/calling-hours', () => ({
    checkCallingWindow: () =>
        windowAllowed
            ? { allowed: true, istHour: 12, istTime: '12:00 IST', reason: '', nextAllowedAt: null }
            : { allowed: false, istHour: 2, istTime: '02:00 IST', reason: 'Calls are only placed 9am to 9pm IST.', nextAllowedAt: new Date() },
}));
jest.mock('@/lib/voice-pipeline/health', () => ({ getEffectiveMode: async () => 'batch' }));
jest.mock('@/lib/vobiz/tokens', () => ({
    VOBIZ_DOMAINS: { ANSWER: 'answer', STATUS: 'status' },
    VOBIZ_STATUS_TTL_SECONDS: 1800,
    mintVobizToken: async () => ({ token: 'tok' }),
}));
jest.mock('@/lib/vobiz/client', () => ({
    placeVobizCall: (...a: unknown[]) => placeVobizCall(...a),
    readVobizConfig: () =>
        vobizConfigured ? { authId: 'a', authToken: 't', fromNumber: '+911', baseUrl: 'https://x' } : null,
}));

function req(body: unknown, userId = 'teacher-A') {
    return {
        json: async () => body,
        headers: { get: (k: string) => ({ 'x-user-id': userId, host: 'app.test' } as Record<string, string>)[k] ?? null },
    } as any;
}

const OUTREACH_BODY = {
    classId: 'c1', className: 'Class 6A', studentId: 's1', studentName: 'Asha',
    parentLanguage: 'Hindi', reason: 'absence', generatedMessage: 'hello', deliveryMethod: 'twilio_call',
};

const ENV_KEYS = [
    'VOICE_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
    'VOICE_EXOTEL_CALL_URL', 'TWILIO_TEST_OVERRIDE_NUMBER',
];
const TWILIO_ENV = { VOICE_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_PHONE_NUMBER: '+1555' };
const VOBIZ_ENV = { VOICE_PROVIDER: 'vobiz' };
const EXOTEL_ENV = { VOICE_PROVIDER: 'exotel', VOICE_EXOTEL_CALL_URL: 'https://voice.test/api/exotel/call' };

interface Scenario {
    name: string;
    /** Must equal a `refuse(..., category)` category in the call route (or `none`). */
    category: string;
    status: number;
    env: Record<string, string>;
    /** Mutate the world after the outreach doc exists, before the call. */
    arrange?: (outreachId: string) => void;
    callBody?: (outreachId: string) => Record<string, unknown>;
}

const twilioFails = (status: number, code?: number): Scenario['arrange'] => () =>
    fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({ code }) });

const SCENARIOS: Scenario[] = [
    // ── provider-independent refusals ──────────────────────────────────────
    { name: 'outside calling hours (twilio)', category: 'outside_calling_hours', status: 409, env: TWILIO_ENV, arrange: () => { windowAllowed = false; } },
    { name: 'outside calling hours (vobiz)', category: 'outside_calling_hours', status: 409, env: VOBIZ_ENV, arrange: () => { windowAllowed = false; } },
    { name: 'outside calling hours (exotel)', category: 'outside_calling_hours', status: 409, env: EXOTEL_ENV, arrange: () => { windowAllowed = false; } },
    { name: 'parent opted out (twilio)', category: 'opted_out', status: 409, env: TWILIO_ENV, arrange: () => { store.call_suppressions = { [phoneSuppressionId(PHONE)]: { reason: 'opt_out' } }; } },
    { name: 'parent opted out (vobiz)', category: 'opted_out', status: 409, env: VOBIZ_ENV, arrange: () => { store.call_suppressions = { [phoneSuppressionId(PHONE)]: { reason: 'opt_out' } }; } },
    { name: 'parent opted out (exotel)', category: 'opted_out', status: 409, env: EXOTEL_ENV, arrange: () => { store.call_suppressions = { [phoneSuppressionId(PHONE)]: { reason: 'opt_out' } }; } },
    { name: 'stored phone is not E.164', category: 'invalid_destination', status: 422, env: TWILIO_ENV, arrange: (id) => { store.parent_outreach[id].parentPhone = '12345'; } },
    { name: 'missing parentLanguage', category: 'invalid_request', status: 400, env: TWILIO_ENV, callBody: (id) => ({ outreachId: id }) },
    // ── twilio ─────────────────────────────────────────────────────────────
    { name: 'twilio not configured', category: 'provider_unconfigured', status: 503, env: { VOICE_PROVIDER: 'twilio' } },
    { name: 'twilio unsupported language', category: 'unsupported_language', status: 422, env: TWILIO_ENV, callBody: (id) => ({ outreachId: id, parentLanguage: 'Klingon' }) },
    { name: 'twilio bad credentials (20003)', category: 'provider_unconfigured', status: 503, env: TWILIO_ENV, arrange: twilioFails(401, 20003) },
    { name: 'twilio unreachable destination (21211)', category: 'destination_unreachable', status: 422, env: TWILIO_ENV, arrange: twilioFails(400, 21211) },
    { name: 'twilio throttled (retryable)', category: 'provider_transient', status: 502, env: TWILIO_ENV, arrange: twilioFails(429, 20429) },
    { name: 'twilio unknown error', category: 'unknown', status: 502, env: TWILIO_ENV, arrange: twilioFails(418, undefined) },
    { name: 'twilio fetch throws', category: 'internal_error', status: 500, env: TWILIO_ENV, arrange: () => fetchMock.mockRejectedValue(new Error('socket hang up')) },
    // ── vobiz ──────────────────────────────────────────────────────────────
    { name: 'vobiz not configured', category: 'provider_unconfigured', status: 503, env: VOBIZ_ENV, arrange: () => { vobizConfigured = false; } },
    { name: 'vobiz invalid destination', category: 'invalid_destination', status: 422, env: VOBIZ_ENV, arrange: () => placeVobizCall.mockResolvedValue({ ok: false, failure: { category: 'invalid_destination' } }) },
    { name: 'vobiz network failure', category: 'network', status: 502, env: VOBIZ_ENV, arrange: () => placeVobizCall.mockResolvedValue({ ok: false, failure: { category: 'network' } }) },
    { name: 'vobiz rejected', category: 'provider_rejected', status: 502, env: VOBIZ_ENV, arrange: () => placeVobizCall.mockResolvedValue({ ok: false, failure: { category: 'provider_rejected', status: 500 } }) },
    { name: 'vobiz credentials rejected', category: 'provider_unconfigured', status: 502, env: VOBIZ_ENV, arrange: () => placeVobizCall.mockResolvedValue({ ok: false, failure: { category: 'provider_unconfigured', status: 401 } }) },
    { name: 'vobiz client throws', category: 'internal_error', status: 500, env: VOBIZ_ENV, arrange: () => placeVobizCall.mockRejectedValue(new Error('boom')) },
    // ── exotel ─────────────────────────────────────────────────────────────
    { name: 'exotel url unset', category: 'provider_unconfigured', status: 503, env: { VOICE_PROVIDER: 'exotel' } },
    { name: 'exotel voicebot refuses (422)', category: 'provider_rejected', status: 422, env: EXOTEL_ENV, arrange: () => fetchMock.mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: 'no phone' }) }) },
    { name: 'exotel voicebot refuses (403)', category: 'provider_rejected', status: 403, env: EXOTEL_ENV, arrange: () => fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'nope' }) }) },
    { name: 'exotel unreachable', category: 'network', status: 502, env: EXOTEL_ENV, arrange: () => fetchMock.mockRejectedValue(new Error('ECONNREFUSED')) },
];

describe('every non-2xx exit of /api/attendance/call leaves the doc truthful and the teacher unblocked', () => {
    let outreachPOST: (r: any) => Promise<Response>;
    let callPOST: (r: any) => Promise<Response>;
    const saved: Record<string, string | undefined> = {};

    beforeAll(async () => {
        outreachPOST = (await import('@/app/api/attendance/outreach/route')).POST as any;
        callPOST = (await import('@/app/api/attendance/call/route')).POST as any;
        for (const k of ENV_KEYS) saved[k] = process.env[k];
    });
    afterAll(() => {
        for (const k of ENV_KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
    });
    beforeEach(() => {
        store = {
            classes: { c1: { teacherUid: 'teacher-A' } },
            'classes/c1/students': { s1: { name: 'Asha', parentPhone: PHONE, parentLanguage: 'Hindi' } },
        };
        (global as any).__fakeDb = createFakeDb(store);
        windowAllowed = true;
        vobizConfigured = true;
        for (const k of ENV_KEYS) delete process.env[k];
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ sid: 'CA1', callSid: 'x' }) });
        (global as any).fetch = fetchMock;
        placeVobizCall.mockReset();
        placeVobizCall.mockResolvedValue({ ok: true, handle: { requestUuid: 'uuid1' } });
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    const createOutreach = async () => {
        const res = await outreachPOST(req(OUTREACH_BODY));
        expect(res.status).toBe(200);
        return Object.keys(store.parent_outreach)[0];
    };

    it('outreach creation does not claim a call is in flight', async () => {
        const id = await createOutreach();
        expect(store.parent_outreach[id].callStatus).toBe('pending');
    });

    it.each(SCENARIOS)('$name -> $status', async (sc) => {
        Object.assign(process.env, sc.env);
        const id = await createOutreach();
        sc.arrange?.(id);

        const res = await callPOST(req(sc.callBody ? sc.callBody(id) : { outreachId: id, parentLanguage: 'Hindi' }));

        // 1. a real refusal
        expect(res.status).toBe(sc.status);
        // 2. the doc says the dial did not happen
        const doc = store.parent_outreach[id];
        expect(doc.callStatus).not.toBe('initiated');
        expect(doc.callStatus).toBe('failed');
        expect(doc.callFailureCategory).toBe(sc.category);
        expect(doc.callSid).toBeUndefined();
        // 3. the teacher can immediately try again: dedup does not block
        windowAllowed = true;
        const retry = await outreachPOST(req(OUTREACH_BODY));
        expect(retry.status).not.toBe(429);
        // An opted-out parent is still (correctly) refused on retry, but by the
        // opt-out rule, never by the dedup window.
        expect(retry.status).toBe(sc.category === 'opted_out' ? 409 : 200);
    });

    it('control: a successful dial IS recorded as initiated and DOES hold the dedup window', async () => {
        Object.assign(process.env, TWILIO_ENV);
        const id = await createOutreach();
        const res = await callPOST(req({ outreachId: id, parentLanguage: 'Hindi' }));
        expect(res.status).toBe(200);
        expect(store.parent_outreach[id].callStatus).toBe('initiated');
        const retry = await outreachPOST(req(OUTREACH_BODY));
        expect(retry.status).toBe(429);
    });

    it('a call placed but followed by a bookkeeping error is never rewritten as failed', async () => {
        Object.assign(process.env, VOBIZ_ENV);
        const id = await createOutreach();
        const db = (global as any).__fakeDb;
        const realCollection = db.collection;
        // The provider accepts, then the doc update that records the callSid throws.
        db.collection = (name: string) => {
            const c = realCollection(name);
            if (name !== 'parent_outreach') return c;
            return { ...c, doc: (docId?: string) => ({ ...c.doc(docId), update: async () => { throw new Error('write failed'); } }) };
        };
        const res = await callPOST(req({ outreachId: id, parentLanguage: 'Hindi' }));
        expect(res.status).toBe(500);
        expect(placeVobizCall).toHaveBeenCalled();
        expect(store.parent_outreach[id].callStatus).toBe('pending'); // untouched, not 'failed'
    });

    it('double-tap protection: a fresh pending outreach blocks a second one, a stale pending one does not', async () => {
        Object.assign(process.env, TWILIO_ENV);
        const id = await createOutreach();
        expect((await outreachPOST(req(OUTREACH_BODY))).status).toBe(429);
        store.parent_outreach[id].createdAt = new Date(Date.now() - 60_000).toISOString();
        expect((await outreachPOST(req(OUTREACH_BODY))).status).toBe(200);
    });

    it('someone else\'s outreach is refused without being modified', async () => {
        Object.assign(process.env, TWILIO_ENV);
        const id = await createOutreach();
        const before = { ...store.parent_outreach[id] };
        const res = await callPOST(req({ outreachId: id, parentLanguage: 'Hindi' }, 'teacher-B'));
        expect(res.status).toBe(403);
        expect(store.parent_outreach[id]).toEqual(before);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('a live call (callSid set) is never marked failed by a later refusal', async () => {
        Object.assign(process.env, TWILIO_ENV);
        const id = await createOutreach();
        store.parent_outreach[id].callSid = 'CA_LIVE';
        store.parent_outreach[id].callStatus = 'initiated';
        windowAllowed = false;
        const res = await callPOST(req({ outreachId: id, parentLanguage: 'Hindi' }));
        expect(res.status).toBe(409);
        expect(store.parent_outreach[id].callStatus).toBe('initiated');
    });
});

describe('table completeness (static)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../app/api/attendance/call/route.ts'), 'utf8');

    it('every refusal category the route can emit has a table row', () => {
        const emitted = new Set<string>();
        // refuse({...}, status, 'category') — category is the last string arg.
        for (const m of src.matchAll(/refuse\([\s\S]*?,\s*(?:\d{3}|[\w.\s?:=<>&|'"()]+?),\s*'([a-z_]+)'\s*,?\s*\)/g)) {
            emitted.add(m[1]);
        }
        for (const m of src.matchAll(/refusalCategories\.set\([^,]+,\s*'([a-z_]+)'\)/g)) emitted.add(m[1]);
        // categories forwarded from provider failures are enumerated by the
        // table through their concrete providers (twilio/vobiz rows above).
        const covered = new Set(SCENARIOS.map((s) => s.category));
        const uncovered = [...emitted].filter((c) => !covered.has(c));
        expect(emitted.size).toBeGreaterThan(5); // the regex found something
        expect(uncovered).toEqual([]);
    });

    it('no provider path returns a raw non-2xx NextResponse.json (must use refuse())', () => {
        const start = src.indexOf('async function forwardToExotel');
        const end = src.indexOf('export async function POST');
        let region = src.slice(start, end);
        // resolveOutreachTarget's 404/403 intentionally touch nothing (not the caller's doc).
        region = region.replace(/async function resolveOutreachTarget[\s\S]*?\n}\n/, '');
        const raw = region
            .split('NextResponse.json(')
            .slice(1)
            .map((chunk) => chunk.split(';')[0])
            .filter((call) => /status\s*[:}]/.test(call) && !/^body, \{ status \}\)/.test(call));
        expect(raw).toEqual([]);
    });

    it('POST funnels every post-ownership response through releaseOutreach', () => {
        const post = src.slice(src.indexOf('export async function POST'));
        expect(post).toMatch(/res\.status >= 400 && !ctx\.callPlaced/);
        expect(post).toMatch(/releaseOutreach\(db, outreachId, target\.data/);
    });
});
