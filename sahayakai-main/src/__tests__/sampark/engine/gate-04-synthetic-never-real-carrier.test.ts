/**
 * @jest-environment node
 *
 * CLASS GATE 4 — no synthetic number, and no number belonging to a demo school,
 * can reach a real carrier in any mode — even with SAMPARK_LIVE_DIAL_ENABLED='true'.
 * The simulated carrier (Practice mode) accepts both.
 */
import { purposeSpec } from '@/lib/sampark/catalogue';
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { evaluateGate, type GateInput } from '@/lib/sampark/policy/gate';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkMode } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, guardian, ORG, prefs, READY_VOBIZ, school, scriptedCarrier, seedFamilies, student, testClock, WED_11_IST } from './_fixtures';

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
    it.each(MODES)('synthetic numbers are refused by a real carrier in %s mode, flag on, at both stages', (mode) => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        for (const stage of ['materialise', 'dispatch'] as const) {
            for (const spec of [purposeSpec('ptm_invite'), purposeSpec('emergency_closure')]) {
                const v = evaluateGate(input({ school: school({ mode }), guardian: guardian('g1', { phoneClass: 'synthetic' }), stage, spec, now: new Date('2026-10-07T02:00:00Z') }));
                expect(v).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
            }
        }
    });

    it.each(MODES)('a demo school never reaches a real carrier in %s mode, even for a real mobile number, flag on', (mode) => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const v = evaluateGate(input({ school: school({ mode, isDemo: true }), guardian: guardian('g1', { phoneClass: 'mobile' }) }));
        expect(v).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
    });

    it('both are allowed on the simulated carrier', () => {
        delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        expect(evaluateGate(input({ carrierKind: 'simulated', guardian: guardian('g1', { phoneClass: 'synthetic' }) })).kind).toBe('allow');
        expect(evaluateGate(input({ carrierKind: 'simulated', school: school({ isDemo: true }) })).kind).toBe('allow');
    });

    it('positive control: a real mobile at a non-demo school in live mode passes only when the flag is exactly "true"', () => {
        const live = { school: school({ mode: 'live', carrier: READY_VOBIZ }), guardian: guardian('g1', { phoneClass: 'mobile' }) };
        delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        expect(evaluateGate(input(live))).toEqual({ kind: 'block', reason: 'mode_forbids_dialing' });
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(evaluateGate(input(live)).kind).toBe('allow');
    });
});

describe('class gate 4 — end to end through the dispatcher', () => {
    it('with a real-carrier kind and the flag on, synthetic numbers and demo schools produce zero place() calls', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 3, { school: { mode: 'live' } }); // synthetic phones (fixture default)
        const c = campaign();
        await repo.createCampaign(c);
        const res = await materialiseCampaignIntents({ repo, clock }, c, school({ mode: 'live' }), 'vobiz');
        expect(res.blocked).toEqual({ synthetic_number_not_allowed: 3 });

        // Even if intents were approved by a simulated-carrier materialisation, dispatch re-checks against the real carrier.
        const repo2 = createMemorySamparkRepo();
        await seedFamilies(repo2, 3, { school: { mode: 'live', isDemo: true }, guardian: { phoneClass: 'mobile' } });
        await repo2.createCampaign(campaign());
        await materialiseCampaignIntents({ repo: repo2, clock }, campaign(), school({ mode: 'live', isDemo: true }), 'simulated');
        const fakeVobiz = scriptedCarrier(() => 'full', 'vobiz');
        const report = await runDispatchTick(deps(repo2, clock, fakeVobiz), DEFAULT_OPTS);
        expect(fakeVobiz.requests).toHaveLength(0);
        expect(report.blocked).toBe(3);
        for (const i of await repo2.listIntentsByCampaign(ORG, 'camp-ptm')) {
            expect(i).toMatchObject({ status: 'blocked', blockReason: 'synthetic_number_not_allowed' });
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
