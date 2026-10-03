/**
 * @jest-environment node
 *
 * CLASS GATE 16 (R2-6) — a real-carrier selection (vobiz / knowlarity) can NEVER dispatch unless
 *   SAMPARK_LIVE_DIAL_ENABLED is exactly 'true'  AND  the school has a caller id  AND
 *   the school confirmed that number is registered to it  AND  (as before) the number being called and the
 *   school are not synthetic / demo.
 *
 * The matrix below walks EVERY combination of the conditions for each real provider and asserts the verdict is
 * 'allow' for exactly the one combination where all hold. A new condition added to the readiness rule without a
 * matching row here breaks the "exactly one allow" assertion. The end-to-end half proves a dispatcher with a real
 * carrier places zero calls for every not-ready school, and that the server-side carrier factory still hands out
 * no real carrier at all in this release.
 */
import { purposeSpec } from '@/lib/sampark/catalogue';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { callerIdReady } from '@/lib/sampark/policy/carrier-readiness';
import { evaluateGate, type GateInput } from '@/lib/sampark/policy/gate';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { isValidCallerId } from '@/lib/sampark/phone';
import { carrierFor, carrierKindForDryRun } from '@/server/sampark/carrier';
import type { CarrierKind, SchoolCarrierSettings } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, guardian, prefs, school, scriptedCarrier, seedFamilies, student, testClock, WED_11_IST } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
afterEach(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

const REAL: Exclude<CarrierKind, 'simulated'>[] = ['vobiz', 'knowlarity'];
const FLAGS = [undefined, 'false', 'TRUE', '1', 'true'] as const;
const CALLER_IDS = [null, '', '9876543210', '+91 98765 43210', '+915000000001' /* synthetic range */, '+918000012345'] as const;
const REGISTERED = [false, true] as const;
const PROVIDERS = ['simulated', 'vobiz', 'knowlarity'] as const;

function input(over: Partial<GateInput>): GateInput {
    return {
        school: school(),
        spec: purposeSpec('ptm_invite'),
        guardian: guardian('g1', { studentIds: ['s1'], phoneClass: 'mobile' }),
        students: [student('s1')],
        preferences: prefs('g1'),
        suppression: null,
        recentCallsToPhone: 0,
        carrierKind: 'vobiz',
        now: WED_11_IST,
        stage: 'dispatch',
        ...over,
    };
}

function carrier(callerId: string | null, registeredToSchool: boolean, provider: SchoolCarrierSettings['provider']): SchoolCarrierSettings {
    return { callerId, registeredToSchool, provider };
}

describe('class gate 16 — the gate, every combination', () => {
    it.each(REAL)('%s: exactly one combination of the conditions allows the call', (kind) => {
        const allowed: string[] = [];
        for (const flag of FLAGS) {
            for (const callerId of CALLER_IDS) {
                for (const registered of REGISTERED) {
                    for (const provider of PROVIDERS) {
                        if (flag === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
                        else process.env.SAMPARK_LIVE_DIAL_ENABLED = flag;
                        const v = evaluateGate(input({ carrierKind: kind, school: school({ mode: 'live', carrier: carrier(callerId, registered, provider) }) }));
                        if (v.kind === 'allow') allowed.push(JSON.stringify({ flag, callerId, registered, provider }));
                    }
                }
            }
        }
        expect(allowed).toEqual([JSON.stringify({ flag: 'true', callerId: '+918000012345', registered: true, provider: kind })]);
    });

    it.each(REAL)('%s: a school with NO carrier settings at all is blocked, flag on', (kind) => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(evaluateGate(input({ carrierKind: kind, school: school({ mode: 'live' }) }))).toEqual({ kind: 'block', reason: 'caller_id_not_ready' });
        expect(evaluateGate(input({ carrierKind: kind, school: school({ mode: 'live', carrier: null }) }))).toEqual({ kind: 'block', reason: 'caller_id_not_ready' });
    });

    it('is checked at BOTH stages: un-registering the number after approval stops the call at dispatch', () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const ready = school({ mode: 'live', carrier: carrier('+918000012345', true, 'vobiz') });
        expect(evaluateGate(input({ school: ready, stage: 'materialise' })).kind).toBe('allow');
        const revoked = school({ mode: 'live', carrier: carrier('+918000012345', false, 'vobiz') });
        expect(evaluateGate(input({ school: revoked, stage: 'dispatch' }))).toEqual({ kind: 'block', reason: 'caller_id_not_ready' });
    });

    it('synthetic guardian numbers and demo schools stay blocked even with a ready number (class gate 4 unchanged)', () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const ready = carrier('+918000012345', true, 'vobiz');
        expect(evaluateGate(input({ school: school({ mode: 'live', carrier: ready }), guardian: guardian('g1', { phoneClass: 'synthetic' }) }))).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
        expect(evaluateGate(input({ school: school({ mode: 'live', isDemo: true, carrier: ready }) }))).toEqual({ kind: 'block', reason: 'synthetic_number_not_allowed' });
    });

    it('the simulated carrier needs no number, but a missing settings object still reads as not ready for real ones', () => {
        delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
        expect(evaluateGate(input({ carrierKind: 'simulated', school: school() })).kind).toBe('allow');
        expect(callerIdReady({ carrier: undefined }, 'simulated')).toBe(false); // absent settings: "nothing set"
        expect(callerIdReady({ carrier: carrier(null, false, 'simulated') }, 'simulated')).toBe(true);
    });
});

describe('class gate 16 — end to end through the dispatcher', () => {
    it('with a real carrier and the flag on, every not-ready school produces zero place() calls', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const notReady: (SchoolCarrierSettings | null | undefined)[] = [
            undefined,
            null,
            carrier(null, true, 'vobiz'),
            carrier('+918000012345', false, 'vobiz'),
            carrier('+918000012345', true, 'knowlarity'), // saved provider differs from the carrier being used
            carrier('+915000000001', true, 'vobiz'),
        ];
        for (const c of notReady) {
            const repo = createMemorySamparkRepo();
            const clock = testClock();
            await seedFamilies(repo, 3, { school: { mode: 'live', carrier: c }, guardian: { phoneClass: 'mobile' } });
            await repo.createCampaign(campaign());
            await materialiseCampaignIntents({ repo, clock }, campaign(), school({ mode: 'live', carrier: c }), 'simulated'); // approved earlier
            const real = scriptedCarrier(() => 'full', 'vobiz');
            const report = await runDispatchTick(deps(repo, clock, real), DEFAULT_OPTS);
            expect({ c, placed: real.requests.length, blocked: report.blocked }).toEqual({ c, placed: 0, blocked: 3 });
        }
    });

    it('positive control: a ready school with a real mobile dials, and the call records the number parents see', async () => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        const ready = carrier('+918000012345', true, 'vobiz');
        await seedFamilies(repo, 2, { school: { mode: 'live', carrier: ready }, guardian: { phoneClass: 'mobile' } });
        await repo.createCampaign(campaign());
        await materialiseCampaignIntents({ repo, clock }, campaign(), school({ mode: 'live', carrier: ready }), 'vobiz');
        const real = scriptedCarrier(() => 'full', 'vobiz');
        await runDispatchTick(deps(repo, clock, real), DEFAULT_OPTS);
        expect(real.requests).toHaveLength(2);
        expect(real.requests.every((r) => r.call.callerId === '+918000012345')).toBe(true);
    });
});

describe('class gate 16 — the server-side carrier factory', () => {
    it.each(['test', 'live'] as const)('hands out no real carrier in %s mode even for a fully ready school with the flag on', (mode) => {
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        for (const provider of ['vobiz', 'knowlarity'] as const) {
            const s = school({ mode, carrier: carrier('+918000012345', true, provider) });
            expect(() => carrierFor(s)).toThrow(expect.objectContaining({ code: 'LIVE_DIAL_DISABLED' }));
            expect(carrierKindForDryRun(s)).toBe(provider);
        }
    });

    it('practice always gets the simulated carrier whatever the saved provider says', () => {
        expect(carrierFor(school({ mode: 'practice', carrier: carrier('+918000012345', true, 'vobiz') })).kind).toBe('simulated');
    });
});

describe('caller id validation (the repo phone utilities)', () => {
    it.each([
        ['+918000012345', true],
        ['+913530000000', true],
        ['+18005550100', true],
        ['9876543210', false],
        ['+91 98765 43210', false],
        ['+91', false],
        ['', false],
        ['+9198765432101234567', false],
    ])('%j → %s', (v, ok) => {
        expect(isValidCallerId(v)).toBe(ok);
    });
});
