/**
 * CLASS GATE — nothing places a parent call without checking do-not-call.
 *
 * Bug class: a code path that can dial a parent but never consults the
 * suppression list, so a parent who said "do not call me" (and was told "it has
 * been noted") is called again. The instance was /api/attendance/call; the class
 * is "any route that reaches a voice provider".
 *
 * Two layers:
 *  1. STATIC — every source file that can reach a provider must either call
 *     `refuseIfParentOptedOut` before the first provider reference in its POST
 *     handler, or be on a short, justified allowlist. A new route that dials
 *     fails this test until it does one or the other.
 *  2. BEHAVIOURAL — with a suppression record present, the real call route
 *     returns 409 PARENT_OPTED_OUT and contacts NO provider, for each provider
 *     (twilio, vobiz, exotel). A control run without the record proves the
 *     provider mocks are reachable, so the "not called" assertions mean something.
 */

import fs from 'fs';
import path from 'path';

// ── Static layer ─────────────────────────────────────────────────────────────

const SRC = path.resolve(__dirname, '../..');
const PROVIDER_MARKERS = [
    /Calls\.json/,
    /placeVobizCall\s*\(/,
    /forwardToExotel\s*\(/,
    /forwardToVobiz\s*\(/,
    /VOICE_EXOTEL_CALL_URL/,
    /from ['"]twilio['"]/,
];

/** Files that reach a provider WITHOUT dialling a parent. Each needs a reason. */
const ALLOWLIST: Record<string, string> = {
    'lib/vobiz/client.ts':
        'Provider client implementation; callers are gated, not the client.',
    'app/api/demo-call/route.ts':
        'Public "Hear the Call" lead magnet: dials the visitor\'s OWN number with a fixed ' +
        'script behind Turnstile + rate gates. No parent record or teacher involved.',
};

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === '__tests__' || e.name === 'node_modules') continue;
            walk(p, out);
        } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) {
            out.push(p);
        }
    }
    return out;
}

function providerFiles(): string[] {
    return walk(SRC)
        .filter((f) => {
            const src = fs.readFileSync(f, 'utf8');
            return PROVIDER_MARKERS.some((m) => m.test(src));
        })
        .map((f) => path.relative(SRC, f).split(path.sep).join('/'));
}

describe('call-suppression gate (static)', () => {
    const files = providerFiles();

    it('finds the known call route (guards against the scan silently matching nothing)', () => {
        expect(files).toContain('app/api/attendance/call/route.ts');
    });

    it('allowlist entries still exist (no stale exemptions)', () => {
        for (const f of Object.keys(ALLOWLIST)) {
            expect(fs.existsSync(path.join(SRC, f))).toBe(true);
        }
    });

    it('every provider-reaching file checks suppression before its first provider reference in POST', () => {
        const offenders: string[] = [];
        for (const rel of files) {
            if (ALLOWLIST[rel]) continue;
            const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
            const postAt = src.search(/export\s+async\s+function\s+POST\b/);
            if (postAt < 0) {
                offenders.push(`${rel}: reaches a provider but has no POST handler to gate`);
                continue;
            }
            const post = src.slice(postAt);
            const check = post.search(/refuseIfParentOptedOut\s*\(/);
            const firstProvider = Math.min(
                ...PROVIDER_MARKERS.map((m) => post.search(m)).filter((i) => i >= 0),
            );
            if (check < 0) offenders.push(`${rel}: POST never calls refuseIfParentOptedOut`);
            else if (check > firstProvider) {
                offenders.push(`${rel}: suppression is checked AFTER a provider is referenced`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('the outreach creation route also refuses opted-out parents', () => {
        const src = fs.readFileSync(path.join(SRC, 'app/api/attendance/outreach/route.ts'), 'utf8');
        expect(src).toMatch(/refuseIfParentOptedOut\s*\(/);
    });
});

// ── Behavioural layer ────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { createFakeDb, lastJsonBody, type Store } from '../helpers/fake-attendance-db';
import { phoneSuppressionId } from '@/lib/call-suppression';

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
    placeVobizCall: (...a: unknown[]) => placeVobizCall(...a),
    readVobizConfig: () => ({ authId: 'a', authToken: 't', fromNumber: '+911', baseUrl: 'https://x' }),
}));

function req(body: unknown) {
    return {
        json: async () => body,
        headers: { get: (k: string) => ({ 'x-user-id': 'teacher-A', host: 'app.test' } as Record<string, string>)[k] ?? null },
    } as any;
}

const ENV_KEYS = [
    'VOICE_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
    'VOICE_EXOTEL_CALL_URL', 'VOBIZ_TEST_OVERRIDE_NUMBER', 'TWILIO_TEST_OVERRIDE_NUMBER',
];
const PROVIDERS: Record<string, Record<string, string>> = {
    twilio: { VOICE_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_PHONE_NUMBER: '+1555' },
    vobiz: { VOICE_PROVIDER: 'vobiz' },
    exotel: { VOICE_PROVIDER: 'exotel', VOICE_EXOTEL_CALL_URL: 'https://voice.test/api/exotel/call' },
};

describe.each(Object.keys(PROVIDERS))('call route behaviour with provider=%s', (provider) => {
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
        store = {
            parent_outreach: {
                o1: { teacherUid: 'teacher-A', parentPhone: PHONE, classId: 'c1', studentId: 's1', callStatus: 'initiated' },
            },
        };
        (global as any).__fakeDb = createFakeDb(store);
        fetchMock.mockReset();
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ sid: 'CA1', callSid: 'x' }) });
        (global as any).fetch = fetchMock;
        placeVobizCall.mockReset();
        placeVobizCall.mockResolvedValue({ ok: true, handle: { requestUuid: 'uuid1' } });
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    const contacted = () => fetchMock.mock.calls.length + placeVobizCall.mock.calls.length;

    it('control: without a suppression record the provider IS contacted', async () => {
        const res = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(200);
        expect(contacted()).toBeGreaterThan(0);
    });

    it('opted-out parent: 409 PARENT_OPTED_OUT and no provider is contacted', async () => {
        store.call_suppressions = { [phoneSuppressionId(PHONE)]: { reason: 'opt_out' } };
        const res = await POST(req({ outreachId: 'o1', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(409);
        expect(lastJsonBody(jsonSpy).code).toBe('PARENT_OPTED_OUT');
        expect(contacted()).toBe(0);
    });

    it('suppression also covers a sibling outreach sharing the same number', async () => {
        store.call_suppressions = { [phoneSuppressionId(PHONE)]: { reason: 'opt_out' } };
        store.parent_outreach.o2 = { teacherUid: 'teacher-A', parentPhone: PHONE, studentId: 'sibling' };
        const res = await POST(req({ outreachId: 'o2', parentLanguage: 'Hindi' }));
        expect(res.status).toBe(409);
        expect(contacted()).toBe(0);
    });
});

describe('outreach route refuses opted-out parents before creating a doc', () => {
    it('409 PARENT_OPTED_OUT, nothing written', async () => {
        jest.resetModules();
        jest.doMock('@/lib/db/adapter', () => ({ dbAdapter: { getUser: async () => ({ planType: 'pro' }) } }));
        jest.doMock('@/lib/plan-utils', () => ({ hasAdvancedPlan: () => true }));
        store = {
            classes: { c1: { teacherUid: 'teacher-A' } },
            'classes/c1/students': { s1: { parentPhone: PHONE } },
            call_suppressions: { [phoneSuppressionId(PHONE)]: { reason: 'opt_out' } },
        };
        (global as any).__fakeDb = createFakeDb(store);
        const { POST } = await import('@/app/api/attendance/outreach/route');
        const res = await POST(req({
            classId: 'c1', className: 'C', studentId: 's1', studentName: 'S',
            parentLanguage: 'Hindi', reason: 'absence', generatedMessage: 'hi', deliveryMethod: 'twilio_call',
        }));
        expect(res.status).toBe(409);
        expect(lastJsonBody(jsonSpy).code).toBe('PARENT_OPTED_OUT');
        expect(Object.keys(store.parent_outreach ?? {})).toHaveLength(0);
    });
});
