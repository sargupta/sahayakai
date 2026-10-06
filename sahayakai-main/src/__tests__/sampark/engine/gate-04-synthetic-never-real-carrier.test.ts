/**
 * @jest-environment node
 *
 * CLASS GATE 4 — no synthetic number, and no number belonging to a demo school,
 * can reach a real carrier when the call rings a GUARDIAN — in any mode, even with
 * SAMPARK_LIVE_DIAL_ENABLED='true'. The simulated carrier (Practice mode) accepts both.
 *
 * Phase 2a carve-out: in TEST mode a call rings the school's own verified test
 * phone, not the guardian's number, so rules 6 and 7 do not describe it. The
 * carve-out is scoped to test mode only — a 'test_phone' destination claimed in
 * practice or live mode is still judged as a guardian call and refused.
 */
import { purposeSpec } from '@/lib/sampark/catalogue';
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { evaluateGate, type GateInput } from '@/lib/sampark/policy/gate';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkMode } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, guardian, ORG, prefs, school, scriptedCarrier, seedFamilies, student, testClock, testModeSchool, TEST_PHONE, WED_11_IST } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

const MODES: SamparkMode[] = ['practice', 'test', 'live'];

function input(overrides: Partial<GateInput>): GateInput {
    return {
        school: school(),
        spec: purposeSpec('ptm_invite'),
        guardian: guardian('g1', { studentIds: ['s1'] }),
        students: [student('s1')],
        preferences: prefs('g1'),
        suppression: null,
        recentCallsToPhone: 0,
        carrierKind: 'vobiz',
        now: WED_11_IST,
        stage: 'dispatch',
        ...overrides,
    };
}

describe('class gate 4 — the gate', () => {
    it.each(MODES)('synthetic numbers are refused by a real carrier for a guardian destination in %s mode, flag on, at both stages', (mode) => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        for (const stage of ['materialise', 'dispatch'] as const) {
            for (const spec of [purposeSpec('ptm_invite'), purposeSpec('emergency_closure')]) {
                const v = evaluateGate(input({ school: school({ mode }), guardian: guardian('g1', { phoneClass: 'synthetic' }), stage, spec, destination: 'guardian', now: new Date('2026-10-07T02:00:00Z') }));
                expect(v).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
            }
        }
    });

    it.each(MODES)('a demo school never reaches a real carrier for a guardian destination in %s mode, even for a real mobile number, flag on', (mode) => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const v = evaluateGate(input({ school: school({ mode, isDemo: true }), guardian: guardian('g1', { phoneClass: 'mobile' }), destination: 'guardian' }));
        expect(v).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
    });

    it.each(['practice', 'live'] as const)('with no destination given, %s mode is judged as a guardian call (the default)', (mode) => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(evaluateGate(input({ school: school({ mode }), guardian: guardian('g1', { phoneClass: 'synthetic' }) }))).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
        expect(evaluateGate(input({ school: school({ mode, isDemo: true }), guardian: guardian('g1', { phoneClass: 'mobile' }) }))).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
    });

    it.each(['practice', 'live'] as const)('the test-phone carve-out is scoped to test mode: claiming a test_phone destination in %s mode changes nothing', (mode) => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const synthetic = evaluateGate(input({ school: school({ mode }), guardian: guardian('g1', { phoneClass: 'synthetic' }), destination: 'test_phone' }));
        expect(synthetic).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
        const demo = evaluateGate(input({ school: school({ mode, isDemo: true }), guardian: guardian('g1', { phoneClass: 'mobile' }), destination: 'test_phone' }));
        expect(demo).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
    });

    it('test mode, test-phone destination (the default there): a synthetic guardian and a demo school may rehearse on the real carrier', () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const test = school(testModeSchool());
        expect(evaluateGate(input({ school: test, guardian: guardian('g1', { phoneClass: 'synthetic' }) })).kind).toBe('allow');
        expect(evaluateGate(input({ school: { ...test, isDemo: true }, guardian: guardian('g1', { phoneClass: 'synthetic' }), destination: 'test_phone' })).kind).toBe('allow');
    });

    it('test mode still refuses an invalid guardian number and still needs the live-dial flag', () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const test = school(testModeSchool());
        expect(evaluateGate(input({ school: test, guardian: guardian('g1', { phoneClass: 'invalid' }) }))).toEqual({ kind: 'block', reason: 'invalid_number' });
        delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        expect(evaluateGate(input({ school: test, guardian: guardian('g1', { phoneClass: 'synthetic' }) }))).toEqual({ kind: 'block', reason: 'mode_forbids_dialing' });
    });

    it('both are allowed on the simulated carrier', () => {
        delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        expect(evaluateGate(input({ carrierKind: 'simulated', guardian: guardian('g1', { phoneClass: 'synthetic' }) })).kind).toBe('allow');
        expect(evaluateGate(input({ carrierKind: 'simulated', school: school({ isDemo: true }) })).kind).toBe('allow');
    });

    it('positive control: a real mobile at a non-demo school in live mode passes the gate only when the flag is exactly "true"', () => {
        const live = { school: school({ mode: 'live' }), guardian: guardian('g1', { phoneClass: 'mobile' }) };
        delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        expect(evaluateGate(input(live))).toEqual({ kind: 'block', reason: 'mode_forbids_dialing' });
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(evaluateGate(input(live)).kind).toBe('allow');
    });
});

describe('class gate 4 — end to end through the dispatcher', () => {
    it('materialising for a real carrier in live mode blocks every synthetic number', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 3, { school: { mode: 'live' } }); // synthetic phones (fixture default)
        const c = campaign();
        await repo.createCampaign(c);
        const res = await materialiseCampaignIntents({ repo, clock }, c, school({ mode: 'live' }), 'vobiz');
        expect(res.blocked).toEqual({ synthetic_number_not_allowed: 3 });
    });

    it('a real carrier offered for guardian calls (practice mode) re-checks at dispatch: demo school and synthetic numbers → zero place() calls', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        for (const setup of [{ school: { isDemo: true }, guardian: { phoneClass: 'mobile' as const } }, { school: {}, guardian: {} }]) {
            const repo = createMemorySamparkRepo();
            const clock = testClock();
            await seedFamilies(repo, 3, setup);
            await repo.createCampaign(campaign());
            // Approved by a simulated-carrier materialisation; dispatch must re-check against the real one.
            await materialiseCampaignIntents({ repo, clock }, campaign(), school(setup.school), 'simulated');
            const fakeVobiz = scriptedCarrier(() => 'full', 'vobiz');
            const report = await runDispatchTick(deps(repo, clock, fakeVobiz), DEFAULT_OPTS);
            expect(fakeVobiz.requests).toHaveLength(0);
            expect(report.blocked).toBe(3);
            for (const i of await repo.listIntentsByCampaign(ORG, 'camp-ptm')) {
                expect(i).toMatchObject({ status: 'blocked', blockReason: 'synthetic_number_not_allowed' });
            }
        }
    });

    it('live mode never reaches the gate or the carrier: nothing is claimed or dialled', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 3, { guardian: { phoneClass: 'mobile' } });
        await repo.createCampaign(campaign());
        await materialiseCampaignIntents({ repo, clock }, campaign(), school(), 'simulated');
        await repo.upsertSchool(school({ mode: 'live' }));
        const fakeVobiz = scriptedCarrier(() => 'full', 'vobiz');
        const report = await runDispatchTick(deps(repo, clock, fakeVobiz), DEFAULT_OPTS);
        expect(fakeVobiz.requests).toHaveLength(0);
        expect(report.errors).toEqual([expect.stringMatching(/^hillview-demo: LIVE_MODE_NOT_AVAILABLE/)]);
        expect(await repo.listCalls(ORG, { limit: 10 })).toEqual([]);
    });

    it('test mode: the synthetic audience rehearses on the real carrier, and every call rings the test phone', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 2, { school: testModeSchool({ isDemo: true }) }); // synthetic guardians, demo school
        await repo.createCampaign(campaign());
        const res = await materialiseCampaignIntents({ repo, clock }, campaign(), school(testModeSchool({ isDemo: true })), 'vobiz');
        expect(res.blocked).toEqual({});
        const fakeVobiz = scriptedCarrier(() => 'full', 'vobiz');
        for (let i = 0; i < 2; i++) {
            await runDispatchTick(deps(repo, clock, fakeVobiz), DEFAULT_OPTS);
            clock.advance(60_000);
        }
        expect(fakeVobiz.requests).toHaveLength(2);
        for (const r of fakeVobiz.requests) {
            expect(r.destinationE164).toBe(TEST_PHONE);
            expect(r.call.destination).toBe('test_phone');
        }
    });

    it('the same audience dials normally on the simulated carrier', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 3, { school: { isDemo: true } });
        await repo.createCampaign(campaign());
        await materialiseCampaignIntents({ repo, clock }, campaign(), school({ isDemo: true }), 'simulated');
        const sim = scriptedCarrier(() => 'full');
        expect((await runDispatchTick(deps(repo, clock, sim), DEFAULT_OPTS)).dialed).toBe(3);
    });
});
