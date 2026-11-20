/**
 * CLASS GATE — a refused parent call never leaves its outreach record 'initiated'.
 *
 * The modal creates the outreach (callStatus 'initiated') and only then asks
 * /api/attendance/call to dial. Bug class: a refusal in the call route that returns without
 * releasing that record. A record left 'initiated' reads as a call in progress (the modal
 * reopens on "Calling..." for 24 h and then shows "Call completed") and holds the per-student
 * dedup window (only an explicit 'failed' releases it), although nobody was dialled. The
 * instances were the hours refusal, both do-not-call refusals, the unsupported-language 422
 * and the unconfigured-provider 503s.
 *
 * Layers:
 *  1. BEHAVIOURAL — every refusal the route can make on a record the teacher owns, for each
 *     provider where it applies, leaves the record 'failed' with a callFailureCategory and
 *     contacts no provider. Records the teacher does NOT own are never written.
 *  2. STRUCTURAL — once ownership is confirmed POST has exactly ONE return, after releasing any
 *     refusal; placeOwnedCall can hand back only a refuseBeforeDial refusal or a provider's own
 *     response; and no provider path can return before it contacts the provider. So a refusal
 *     added anywhere after ownership (in POST, in placeOwnedCall or in a provider path) cannot
 *     skip the release: it fails here even though the behavioural list does not know it.
 *  3. OUTREACH — /api/attendance/outreach creates no call record outside 10:00-19:00 IST, so
 *     there is nothing to strand in the first place.
 */

import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { createFakeDb, lastJsonBody, type Store } from '../helpers/fake-attendance-db';
import { phoneSuppressionId } from '@/lib/call-suppression';

const PHONE = '+919800000103'; // made-up, +9198000001xx test range
const OTHER_PHONE = '+919800000104';
const jsonSpy = jest.spyOn(NextResponse, 'json');

/** IST wall-clock instant on a fixed weekday. */
const ist = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 16, h - 5, m - 30));

jest.mock('@/lib/calling-hours', () => {
    const actual = jest.requireActual('@/lib/calling-hours');
    return { ...actual, checkCallingWindow: (at?: Date) => actual.checkCallingWindow(at ?? (global as any).__gateNow) };
});
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => (global as any).__fakeDb }));
jest.mock('@/lib/voice-pipeline/health', () => ({ getEffectiveMode: async () => 'batch' }));
jest.mock('@/lib/vobiz/tokens', () => ({
    VOBIZ_DOMAINS: { ANSWER: 'answer', STATUS: 'status' },
    VOBIZ_STATUS_TTL_SECONDS: 1800,
    mintVobizToken: async () => ({ token: 'tok' }),
}));
jest.mock('@/lib/vobiz/warm', () => ({ warmTelephony: () => undefined }));
const placeVobizCall = jest.fn();
let vobizConfigured = true;
jest.mock('@/lib/vobiz/client', () => ({
    placeVobizCall: (...a: unknown[]) => placeVobizCall(...a),
    readVobizConfig: () => (vobizConfigured ? { authId: 'a', authToken: 't', fromNumber: '+911', baseUrl: 'https://x' } : null),
    isDestinationAllowed: (phone: string) => jest.requireActual('@/lib/vobiz/client').isDestinationAllowed(phone),
}));
jest.mock('@/lib/db/adapter', () => ({ dbAdapter: { getUser: async () => ({ planType: 'pro', displayName: 'T' }) } }));
jest.mock('@/lib/plan-utils', () => ({ hasAdvancedPlan: () => true }));

const ENV_KEYS = [
    'VOICE_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
    'VOICE_EXOTEL_CALL_URL', 'VOBIZ_TEST_OVERRIDE_NUMBER', 'TWILIO_TEST_OVERRIDE_NUMBER', 'CALL_ALLOWED_DESTINATIONS',
];
const PROVIDERS: Record<string, Record<string, string>> = {
    twilio: { VOICE_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_PHONE_NUMBER: '+1555' },
    vobiz: { VOICE_PROVIDER: 'vobiz' },
    exotel: { VOICE_PROVIDER: 'exotel', VOICE_EXOTEL_CALL_URL: 'https://voice.test/api/exotel/call' },
};

function req(body: unknown, userId = 'teacher-A') {
    return {
        json: async () => body,
        headers: { get: (k: string) => ({ 'x-user-id': userId, host: 'app.test' } as Record<string, string>)[k] ?? null },
    } as any;
}

let store: Store;
const fetchMock = jest.fn();
const saved: Record<string, string | undefined> = {};
const contacted = () => fetchMock.mock.calls.length + placeVobizCall.mock.calls.length;

function seed(overrides: Record<string, unknown> = {}) {
    store = {
        parent_outreach: {
            o1: { teacherUid: 'teacher-A', parentPhone: PHONE, classId: 'c1', studentId: 's1', callStatus: 'initiated', ...overrides },
        },
        classes: { c1: { teacherUid: 'teacher-A' } },
        'classes/c1/students': { s1: { parentPhone: PHONE } },
    };
    (global as any).__fakeDb = createFakeDb(store);
}

/** The fake db with the do-not-call lookup failing, as a Firestore outage would. */
function suppressionLookupFails() {
    const base = (global as any).__fakeDb;
    (global as any).__fakeDb = {
        ...base,
        collection: (name: string) =>
            name === 'call_suppressions'
                ? { doc: () => ({ get: async () => { throw new Error('UNAVAILABLE'); } }) }
                : base.collection(name),
    };
}

beforeAll(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; });
afterAll(() => { for (const k of ENV_KEYS) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]); });
beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    (global as any).__gateNow = ist(12);
    vobizConfigured = true;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ sid: 'CA1', callSid: 'x' }) });
    (global as any).fetch = fetchMock;
    placeVobizCall.mockReset();
    placeVobizCall.mockResolvedValue({ ok: true, handle: { requestUuid: 'uuid1' } });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    seed();
});

async function callRoute(body: Record<string, unknown> = { outreachId: 'o1', parentLanguage: 'Hindi' }, userId?: string) {
    const { POST } = await import('@/app/api/attendance/call/route');
    return POST(req(body, userId));
}

// ── 1. Behavioural ──────────────────────────────────────────────────────────

type Refusal = {
    name: string;
    providers: string[];
    arrange: () => void;
    body?: Record<string, unknown>;
    status: number;
    category: string;
};

const REFUSALS: Refusal[] = [
    { name: 'outside calling hours (19:20 IST)', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { (global as any).__gateNow = ist(19, 20); }, status: 409, category: 'outside_calling_hours' },
    { name: 'outside calling hours (09:30 IST)', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { (global as any).__gateNow = ist(9, 30); }, status: 409, category: 'outside_calling_hours' },
    { name: 'parent opted out', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { store.call_suppressions = { [phoneSuppressionId(PHONE)]: { reason: 'opt_out' } }; }, status: 409, category: 'parent_opted_out' },
    { name: 'do-not-call lookup failed', providers: ['twilio', 'vobiz', 'exotel'], arrange: suppressionLookupFails, status: 503, category: 'suppression_check_failed' },
    { name: 'destination not on the server allow-list', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { process.env.CALL_ALLOWED_DESTINATIONS = '+919800000999'; }, status: 403, category: 'destination_not_allowed' },
    { name: 'Twilio not configured', providers: ['twilio'], arrange: () => { delete process.env.TWILIO_AUTH_TOKEN; }, status: 503, category: 'provider_unconfigured' },
    { name: 'Vobiz not configured', providers: ['vobiz'], arrange: () => { vobizConfigured = false; }, status: 503, category: 'provider_unconfigured' },
    { name: 'Exotel not configured', providers: ['exotel'], arrange: () => { delete process.env.VOICE_EXOTEL_CALL_URL; }, status: 503, category: 'provider_unconfigured' },
    { name: 'language Twilio cannot speak', providers: ['twilio'], arrange: () => undefined, body: { outreachId: 'o1', parentLanguage: 'Klingon' }, status: 422, category: 'language_unsupported' },
    { name: 'phone no longer matches the student', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { store['classes/c1/students'].s1.parentPhone = OTHER_PHONE; }, status: 409, category: 'phone_mismatch' },
    { name: 'student removed from the class', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { delete store['classes/c1/students'].s1; }, status: 404, category: 'student_not_found' },
    { name: 'student has no valid phone', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { store['classes/c1/students'].s1.parentPhone = '12345'; }, status: 422, category: 'no_valid_parent_phone' },
    { name: 'teacher no longer owns the class', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { store.classes.c1.teacherUid = 'teacher-B'; }, status: 403, category: 'class_not_owned' },
    { name: 'record missing its class', providers: ['twilio', 'vobiz', 'exotel'], arrange: () => { delete store.parent_outreach.o1.classId; }, status: 422, category: 'outreach_incomplete' },
];

const CASES = REFUSALS.flatMap((r) => r.providers.map((p) => [`${r.name} [${p}]`, p, r] as const));

describe.each(CASES)('refusal: %s', (_label, provider, refusal) => {
    it('releases the record (failed + category) and contacts no provider', async () => {
        Object.assign(process.env, PROVIDERS[provider]);
        refusal.arrange();
        const res = await callRoute(refusal.body);
        expect(res.status).toBe(refusal.status);
        expect(contacted()).toBe(0);
        expect(store.parent_outreach.o1.callStatus).toBe('failed');
        expect(store.parent_outreach.o1.callFailureCategory).toBe(refusal.category);
    });
});

describe.each(Object.keys(PROVIDERS))('records the teacher does not own are never written [%s]', (provider) => {
    it("another teacher's record: 403 and untouched", async () => {
        Object.assign(process.env, PROVIDERS[provider]);
        (global as any).__gateNow = ist(20);
        const before = { ...store.parent_outreach.o1 };
        const res = await callRoute(undefined, 'teacher-B');
        expect(res.status).toBe(403);
        expect(store.parent_outreach.o1).toEqual(before);
        expect(contacted()).toBe(0);
    });

    it('a record that does not exist: 404 and nothing created', async () => {
        Object.assign(process.env, PROVIDERS[provider]);
        const res = await callRoute({ outreachId: 'nope', parentLanguage: 'Hindi' });
        expect(res.status).toBe(404);
        expect(store.parent_outreach.nope).toBeUndefined();
    });

    it('control: inside the window with nothing wrong, the provider IS contacted', async () => {
        Object.assign(process.env, PROVIDERS[provider]);
        const res = await callRoute();
        expect(res.status).toBe(200);
        expect(contacted()).toBeGreaterThan(0);
    });
});

// ── 2. Structural ───────────────────────────────────────────────────────────

describe('structural: no refusal after ownership can skip the release', () => {
    // Comments removed, so prose like "one return" is not read as code.
    const SRC = fs
        .readFileSync(path.resolve(__dirname, '../../app/api/attendance/call/route.ts'), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
    const returnsIn = (code: string) => Array.from(code.matchAll(/\breturn\b[^;]*/g), (m) => m[0].replace(/\s+/g, ' ').trim());
    const fnBody = (name: string) => {
        const start = SRC.search(new RegExp(`(async )?function ${name}\\b`));
        expect(start).toBeGreaterThanOrEqual(0);
        const rest = SRC.slice(start);
        const next = rest.slice(1).search(/\n(export )?(async )?function |\ntype |\ninterface /);
        return next < 0 ? rest : rest.slice(0, next + 1);
    };

    it('POST has exactly one return once ownership is confirmed, and it follows the release', () => {
        const post = fnBody('POST');
        const owned = post.search(/if \(target\.owned\) await markNotDialled\(db, outreachId, target\.category\);\s*return target\.response;\s*\}/);
        expect(owned).toBeGreaterThan(0);
        const afterOwnership = post.slice(owned).replace(/^[\s\S]*?return target\.response;\s*\}/, '');
        expect(returnsIn(afterOwnership)).toEqual(['return outcome.response']);
        expect(afterOwnership).toMatch(/if \(outcome\.refused\) await markNotDialled\(db, outreachId, outcome\.category\);\s*return outcome\.response;/);
    });

    it('placeOwnedCall hands back only a refuseBeforeDial refusal or a provider response', () => {
        // alreadyDialled: a repeated POST on a record the first request already dialled. Not
        // released on purpose: marking it failed would overwrite a call that may be in progress.
        const allowed = /^return \{ refused: (true, \.\.\.refusal \}|false, response: (await (forwardToExotel|forwardToVobiz|placeTwilioCall)\(|alreadyDialled\(ctx\) \}))/;
        const returns = returnsIn(fnBody('placeOwnedCall'));
        expect(returns.length).toBeGreaterThanOrEqual(4);
        expect(returns.filter((r) => !allowed.test(r))).toEqual([]);
    });

    it.each([
        ['forwardToExotel', /await fetch\(/],
        ['forwardToVobiz', /placeVobizCall\(/],
        ['placeTwilioCall', /Calls\.json/],
    ])('%s has no return before it contacts the provider', (name, providerCall) => {
        const body = fnBody(name);
        const at = body.search(providerCall);
        expect(at).toBeGreaterThan(0);
        expect(returnsIn(body.slice(0, at))).toEqual([]);
    });
});

// ── 3. Outreach creates no call record outside the window ───────────────────

describe('outreach: no call record is created outside 10:00-19:00 IST', () => {
    async function createOutreach(deliveryMethod: 'twilio_call' | 'whatsapp_copy') {
        store = {
            classes: { c1: { teacherUid: 'teacher-A' } },
            'classes/c1/students': { s1: { parentPhone: PHONE } },
        };
        (global as any).__fakeDb = createFakeDb(store);
        const { POST } = await import('@/app/api/attendance/outreach/route');
        return POST(req({
            classId: 'c1', className: 'C', studentId: 's1', studentName: 'S',
            parentLanguage: 'Hindi', reason: 'consecutive_absences', generatedMessage: 'm', deliveryMethod,
        }));
    }

    it.each([[9, 59], [6, 0], [19, 0], [19, 20], [23, 30]])('%i:%i IST: 409 OUTSIDE_CALLING_HOURS and no record', async (h, m) => {
        (global as any).__gateNow = ist(h, m);
        const res = await createOutreach('twilio_call');
        expect(res.status).toBe(409);
        expect(lastJsonBody(jsonSpy).code).toBe('OUTSIDE_CALLING_HOURS');
        expect(Object.keys(store.parent_outreach ?? {})).toHaveLength(0);
    });

    it('the body is the same one the call route returns', async () => {
        (global as any).__gateNow = ist(19, 20);
        await createOutreach('twilio_call');
        const fromOutreach = lastJsonBody(jsonSpy);
        seed();
        await callRoute();
        expect(lastJsonBody(jsonSpy)).toEqual(fromOutreach);
    });

    it('control: inside the window the record is created', async () => {
        (global as any).__gateNow = ist(10, 0);
        const res = await createOutreach('twilio_call');
        expect(res.status).toBe(200);
        expect(Object.keys(store.parent_outreach ?? {})).toHaveLength(1);
    });

    it('a WhatsApp copy is not a call and is never refused for hours', async () => {
        (global as any).__gateNow = ist(22, 0);
        const res = await createOutreach('whatsapp_copy');
        expect(res.status).toBe(200);
    });
});
