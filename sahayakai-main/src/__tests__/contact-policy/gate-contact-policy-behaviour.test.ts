/** @jest-environment node */
/**
 * BEHAVIOURAL GATE (Sampark + MCP integration brief, Step 2): one set of contact rules
 * for every parent call, proved through the real boundaries — POST /api/attendance/call
 * (the teacher path) on each carrier it can use, and Sampark's dispatcher — with every
 * carrier mocked (global fetch records any attempt to reach Twilio, Vobiz or the Exotel
 * voicebot) and synthetic data only. Clocks are fixed; nothing reads the machine's zone.
 *
 *   1. a number on the school's suppression list → teacher call refused `opted_out`, no carrier;
 *   2. a fifth routine call in 30 days → `frequency_cap`, whichever paths made the first four;
 *   3. 19:05 IST → `outside_hours`, no carrier;
 *   4. a keypad 9 on a Sampark call → the next teacher call to that number is refused;
 *   5. a teacher call counts towards Sampark's cap (its dispatcher blocks, never dials);
 *   6. the D4 emergency exception is narrow: Sampark may still ring a closure at 20:00 IST
 *      past the cap, but never past an opt-out of everything, and a teacher cannot use it.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('@/lib/voice-pipeline/health', () => ({ getEffectiveMode: async () => 'batch' }));
jest.mock('@/lib/vobiz/tokens', () => ({
    VOBIZ_DOMAINS: { ANSWER: 'answer', STATUS: 'status' },
    VOBIZ_STATUS_TTL_SECONDS: 1800,
    mintVobizToken: async () => ({ token: 'tok' }),
}));

// ── fake Firestore for the teacher path (outreach, profiles, memberships) ───
const mockDocs = new Map<string, Record<string, any>>();
function mockDoc(path: string): any {
    return {
        get: async () => ({ id: path.split('/').pop(), exists: mockDocs.has(path), data: () => mockDocs.get(path) }),
        update: async (data: Record<string, unknown>) => { mockDocs.set(path, { ...mockDocs.get(path), ...data }); },
        collection: (c: string) => ({ doc: (id: string) => mockDoc(`${path}/${c}/${id}`) }),
    };
}
const mockDb = { collection: (c: string) => ({ doc: (id: string) => mockDoc(`${c}/${id}`) }) };
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockDb, initializeFirebase: async () => undefined }));

import { NextResponse } from 'next/server';

import { checkContact } from '@/lib/contact-policy';
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { closureExpiry } from '@/lib/sampark/closure';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { recordOptOut } from '@/lib/sampark/dispatch/settle';
import { campaignDedupeKey, intentIdFor } from '@/lib/sampark/intents';
import { istInstant } from '@/lib/sampark/policy/ist';
import { hashPhone } from '@/lib/sampark/phone';
import type { SamparkRepo } from '@/lib/sampark/ports';
import { setSamparkRepoForTests } from '@/lib/sampark/repo/factory';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { Campaign, SamparkCall } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, ORG, scriptedCarrier, seedFamilies, school, testClock } from '../sampark/engine/_fixtures';

/** Synthetic parent number (test value). */
const PARENT = '+919812345678';
const TEACHER = 'teacher-a';
/** Wed 7 Oct 2026 at the given IST wall clock. */
const ist = (hour: number, minute = 0) => istInstant('2026-10-07', hour, minute);

// ── carriers: any attempt to reach one is recorded ──────────────────────────
const carrierHits: string[] = [];
const realFetch = global.fetch;
beforeAll(() => {
    process.env.SAMPARK_PII_KEY = Buffer.alloc(32, 7).toString('base64');
    process.env.SAMPARK_PHONE_PEPPER = 'test-pepper';
    (global as any).fetch = async (url: string) => {
        carrierHits.push(String(url));
        const body = String(url).includes('twilio') ? { sid: 'CA_synthetic' } : String(url).includes('vobiz') ? { request_uuid: 'vobiz-synthetic' } : { callSid: 'exotel-synthetic' };
        return { ok: true, status: 201, json: async () => body, text: async () => JSON.stringify(body) };
    };
});
afterAll(() => {
    (global as any).fetch = realFetch;
    setSamparkRepoForTests(null);
});

const PROVIDERS = {
    twilio: { VOICE_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'ACsynthetic', TWILIO_AUTH_TOKEN: 'synthetic', TWILIO_PHONE_NUMBER: '+15550001111' },
    vobiz: { VOICE_PROVIDER: 'vobiz', VOBIZ_AUTH_ID: 'MA_SYNTH', VOBIZ_AUTH_TOKEN: 'synthetic', VOBIZ_FROM_NUMBER: '+918000000000' },
    exotel: { VOICE_PROVIDER: 'exotel', VOICE_EXOTEL_CALL_URL: 'https://voicebot.example.test/api/exotel/call' },
} as const;
type Provider = keyof typeof PROVIDERS;
const ENV_KEYS = [...new Set(Object.values(PROVIDERS).flatMap((p) => Object.keys(p))), 'TWILIO_TEST_OVERRIDE_NUMBER', 'VOBIZ_TEST_OVERRIDE_NUMBER'];

let repo: SamparkRepo;
let outreachSeq = 0;

beforeEach(() => {
    carrierHits.length = 0;
    mockDocs.clear();
    outreachSeq = 0;
    for (const k of ENV_KEYS) delete process.env[k];
    repo = createMemorySamparkRepo();
    setSamparkRepoForTests(repo);
    mockDocs.set(`users/${TEACHER}`, { organizationId: ORG });
    mockDocs.set(`organizations/${ORG}`, { name: 'Hillview Demo School' });
    mockDocs.set(`organizations/${ORG}/members/${TEACHER}`, { userId: TEACHER, role: 'teacher' });
});
afterEach(() => jest.useRealTimers());

function newOutreach(phone = PARENT): string {
    outreachSeq += 1;
    const id = `out-${outreachSeq}`;
    mockDocs.set(`parent_outreach/${id}`, { teacherUid: TEACHER, parentPhone: phone, parentLanguage: 'Hindi', deliveryMethod: 'twilio_call', callStatus: 'initiated' });
    return id;
}

const jsonSpy = jest.spyOn(NextResponse, 'json');
/** POST /api/attendance/call as the teacher, at a fixed instant, through one provider. */
async function teacherCall(at: Date, provider: Provider, outreachId = newOutreach(), extraBody: Record<string, unknown> = {}) {
    Object.assign(process.env, PROVIDERS[provider]);
    jest.useFakeTimers({ now: at, doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'clearImmediate', 'queueMicrotask', 'hrtime', 'performance'] });
    const { POST } = await import('@/app/api/attendance/call/route');
    const req = {
        headers: { get: (k: string) => ({ 'x-user-id': TEACHER, host: 'app.sahayak.test' } as Record<string, string>)[k.toLowerCase()] ?? null },
        json: async () => ({ outreachId, parentLanguage: 'Hindi', ...extraBody }),
    };
    jsonSpy.mockClear();
    await POST(req as never);
    jest.useRealTimers();
    const last = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    return { status: (last[1] as { status?: number } | undefined)?.status ?? 200, body: last[0] as any, outreachId };
}

async function seedTeacherContacts(n: number, at: Date) {
    for (let i = 0; i < n; i++) {
        await repo.recordContact({ id: `teacher_seed${i}`, orgId: ORG, phoneHash: hashPhone(PARENT), kind: 'routine', source: 'teacher', at: at.toISOString() });
    }
}

/** A real (non-simulated) Sampark call to the parent, entered the only way calls enter the repo: a claim. */
async function seedSamparkCall(id: string, at: Date, overrides: Partial<SamparkCall> = {}): Promise<SamparkCall> {
    const call = {
        id, orgId: ORG, intentId: `i-${id}`, campaignId: 'camp', purpose: 'ptm_invite', guardianId: 'g1',
        phoneHash: hashPhone(PARENT), phoneLast4: '5678', destination: 'guardian', language: 'Hindi', variant: 'default',
        attempt: 1, state: 'dialing', leaseUntil: null, carrier: 'vobiz', providerCallId: null,
        outcome: { heard: 'full', digits: '', confirmed: false, declined: false, optOut: 'none' },
        durationSeconds: 40, billedSeconds: 60, costPaise: null, audioSeconds: 40,
        createdAt: at.toISOString(), updatedAt: at.toISOString(), endedAt: null, failureReason: null, settledAt: null,
        ...overrides,
    } as SamparkCall;
    await repo.createIntentIfAbsent({ id: call.intentId, orgId: ORG, status: 'approved', notBefore: null, attempts: 0, maxAttempts: 3 } as never);
    expect(await repo.claimIntentForDial(ORG, call.intentId, call, at)).toBe('claimed');
    return call;
}

describe.each(Object.keys(PROVIDERS) as Provider[])('teacher path via %s', (provider) => {
    it('within the rules the call is placed and leaves one ledger entry (a retry of the same outreach adds none)', async () => {
        const res = await teacherCall(ist(11), provider);
        expect(res.status).toBe(200);
        expect(carrierHits).toHaveLength(1);
        await teacherCall(ist(11, 1), provider, res.outreachId);
        expect(await repo.countContactsToPhoneSince(hashPhone(PARENT), ist(0), 'routine')).toBe(1);
    });

    it('1. opted out on the school list → 409 OPTED_OUT, carrier never reached, outreach released', async () => {
        await repo.upsertSuppression({ orgId: ORG, phoneHash: hashPhone(PARENT), phoneLast4: '5678', scope: 'routine', source: 'office', officeVerification: 'confirmed', createdAt: ist(9).toISOString(), callId: null } as never);
        const res = await teacherCall(ist(11), provider);
        expect(res).toMatchObject({ status: 409, body: { code: 'OPTED_OUT' } });
        expect(carrierHits).toEqual([]);
        expect(mockDocs.get(`parent_outreach/${res.outreachId}`)).toMatchObject({ callStatus: 'failed', callFailureCategory: 'contact_policy_opted_out' });
    });

    it('2. a fifth routine call in 30 days → 409 FREQUENCY_CAP (two Sampark calls + two teacher calls before it)', async () => {
        await seedSamparkCall('c1', ist(10));
        await seedSamparkCall('c2', ist(10, 5));
        await teacherCall(ist(10, 30), provider);
        await teacherCall(ist(10, 40), provider);
        expect(carrierHits).toHaveLength(2);
        const res = await teacherCall(ist(11), provider);
        expect(res).toMatchObject({ status: 409, body: { code: 'FREQUENCY_CAP' } });
        expect(carrierHits).toHaveLength(2);
    });

    it('3. 19:05 IST → 409 OUTSIDE_CALLING_HOURS with the next opening at 10:00 IST; carrier never reached', async () => {
        const res = await teacherCall(ist(19, 5), provider);
        expect(res).toMatchObject({ status: 409, body: { code: 'OUTSIDE_CALLING_HOURS', nextAllowedAt: istInstant('2026-10-08', 10).toISOString() } });
        expect(res.body.error).toMatch(/10:00 and 19:00 IST/);
        expect(carrierHits).toEqual([]);
    });

    it('a contact store that cannot be read → 503 CONTACT_POLICY_UNAVAILABLE; never dials (fail closed)', async () => {
        repo.getSuppression = async () => { throw new Error('UNAVAILABLE'); };
        const res = await teacherCall(ist(11), provider);
        expect(res).toMatchObject({ status: 503, body: { code: 'CONTACT_POLICY_UNAVAILABLE' } });
        expect(carrierHits).toEqual([]);
    });
});

describe('teacher path: the school and the test override', () => {
    it('a teacher with no verified school: no school opt-out list, but the hours and the per-number cap still apply', async () => {
        mockDocs.delete(`organizations/${ORG}/members/${TEACHER}`); // profile says ORG, membership does not
        await repo.upsertSuppression({ orgId: ORG, phoneHash: hashPhone(PARENT), phoneLast4: '5678', scope: 'all', source: 'office', officeVerification: 'confirmed', createdAt: ist(9).toISOString(), callId: null } as never);
        expect((await teacherCall(ist(11), 'twilio')).status).toBe(200);
        expect((await teacherCall(ist(19, 5), 'twilio')).body.code).toBe('OUTSIDE_CALLING_HOURS');
        await seedTeacherContacts(3, ist(10));
        expect((await teacherCall(ist(11, 30), 'twilio')).body.code).toBe('FREQUENCY_CAP');
    });

    it('a test-override call rings the tester: the parent\'s rules still apply, but the parent\'s count does not grow', async () => {
        process.env.TWILIO_TEST_OVERRIDE_NUMBER = '+15550009999';
        expect((await teacherCall(ist(11), 'twilio')).status).toBe(200);
        expect(await repo.countContactsToPhoneSince(hashPhone(PARENT), ist(0), 'routine')).toBe(0);
        expect((await teacherCall(ist(19, 5), 'twilio')).body.code).toBe('OUTSIDE_CALLING_HOURS');
    });
});

describe('4. a keypad 9 on a Sampark call blocks the next teacher call to that number', () => {
    it.each(Object.keys(PROVIDERS) as Provider[])('via %s', async (provider) => {
        const call = await seedSamparkCall('c9', ist(10), { outcome: { heard: 'full', digits: '99', confirmed: false, declined: false, optOut: 'confirmed' } });
        await recordOptOut(repo, { ...call, state: 'completed' }, ist(10, 1));
        const res = await teacherCall(ist(11), provider);
        expect(res).toMatchObject({ status: 409, body: { code: 'OPTED_OUT' } });
        expect(carrierHits).toEqual([]);
    });
});

describe('Sampark dispatcher, through runDispatchTick', () => {
    async function samparkCampaign(c: Partial<Campaign> = {}, at = ist(11)) {
        const clock = testClock(at);
        await seedFamilies(repo, 1, { guardian: { phoneHash: hashPhone(PARENT) } });
        const camp = campaign({ mode: 'practice', ...c });
        await repo.createCampaign(camp);
        await materialiseCampaignIntents({ repo, clock }, camp, school(), 'simulated');
        const carrier = scriptedCarrier(() => 'full');
        return { clock, carrier, d: deps(repo, clock, carrier), intentId: intentIdFor(campaignDedupeKey(camp.id, 'g001')) };
    }

    it('5. teacher calls count towards Sampark\'s cap: after four, the campaign intent is blocked and never dialled', async () => {
        const s = await samparkCampaign();
        await teacherCall(ist(10, 10), 'twilio');
        await teacherCall(ist(10, 20), 'vobiz');
        await teacherCall(ist(10, 30), 'exotel');
        await seedTeacherContacts(1, ist(10, 40));
        await runDispatchTick(s.d, DEFAULT_OPTS);
        expect(s.carrier.requests).toHaveLength(0);
        expect(await repo.getIntent(ORG, s.intentId)).toMatchObject({ status: 'blocked', blockReason: 'frequency_cap' });
    });

    it('…and with three, the campaign still calls (the cap is four)', async () => {
        const s = await samparkCampaign();
        await seedTeacherContacts(3, ist(10));
        await runDispatchTick(s.d, DEFAULT_OPTS);
        expect(s.carrier.requests).toHaveLength(1);
    });

    it('the dispatcher runs the shared check itself: a store that cannot be read defers, never dials', async () => {
        const s = await samparkCampaign();
        const countCalls = repo.countCallsToPhoneSince.bind(repo);
        let n = 0;
        // let the gate's own count through, then fail the shared check's suppression read
        repo.getSuppression = async () => { if (++n > 1) throw new Error('UNAVAILABLE'); return null; };
        repo.countCallsToPhoneSince = countCalls;
        await runDispatchTick(s.d, DEFAULT_OPTS);
        expect(s.carrier.requests).toHaveLength(0);
        expect((await repo.getIntent(ORG, s.intentId))?.status).not.toBe('dialing');
    });

    describe('6. the D4 emergency closure exception stays narrow', () => {
        const CLOSURE = '2026-10-08';
        const d4 = { id: 'camp-d4', purpose: 'emergency_closure' as const, facts: { kind: 'emergency_closure' as const, date: CLOSURE, reason: 'rain_landslide' as const, busesRunning: false }, expiresAt: closureExpiry(CLOSURE).toISOString() };

        it('rings at 20:00 IST past the routine cap — routine calls may not', async () => {
            const s = await samparkCampaign(d4, ist(20));
            await seedTeacherContacts(4, ist(10));
            await runDispatchTick(s.d, DEFAULT_OPTS);
            expect(s.carrier.requests).toHaveLength(1);
            const routine = await checkContact({ orgId: ORG, phone: { e164: PARENT }, kind: 'routine', at: ist(20) }, repo);
            expect(routine).toMatchObject({ allowed: false });
        });

        it('never past an opt-out of everything (scope all)', async () => {
            const s = await samparkCampaign(d4, ist(20));
            await repo.upsertSuppression({ orgId: ORG, phoneHash: hashPhone(PARENT), phoneLast4: '5678', scope: 'all', source: 'office', officeVerification: 'confirmed', createdAt: ist(9).toISOString(), callId: null } as never);
            await runDispatchTick(s.d, DEFAULT_OPTS);
            expect(s.carrier.requests).toHaveLength(0);
        });

        it('a teacher cannot claim it: asking for an emergency at 19:30 IST is still a refused routine call', async () => {
            const res = await teacherCall(ist(19, 30), 'twilio', undefined, { kind: 'emergency', purpose: 'emergency_closure' });
            expect(res).toMatchObject({ status: 409, body: { code: 'OUTSIDE_CALLING_HOURS' } });
            expect(carrierHits).toEqual([]);
        });
    });
});
