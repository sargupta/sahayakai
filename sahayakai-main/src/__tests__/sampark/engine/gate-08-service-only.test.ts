/**
 * @jest-environment node
 *
 * CLASS GATE 8 — every purpose is classified service or promotional in the
 * catalogue, and no promotional purpose can be scheduled: the gate refuses it,
 * materialisation refuses the whole campaign, and the dispatcher never dials
 * an intent whose purpose has become promotional.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { availablePurposes, isDialable, PURPOSE_CATALOGUE, purposeSpec } from '@/lib/sampark/catalogue';
import { runDispatchTick } from '@/lib/sampark/dispatch/dispatcher';
import { evaluateGate } from '@/lib/sampark/policy/gate';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { PurposeId } from '@/types/sampark';

import { campaign, DEFAULT_OPTS, deps, guardian, ORG, prefs, school, scriptedCarrier, seedFamilies, student, testClock, WED_11_IST } from './_fixtures';

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

/** Purposes the mocked catalogue reports as promotional (to prove the engine refuses them). */
const mockPromotional = new Set<string>();
jest.mock('@/lib/sampark/catalogue', () => {
    const actual = jest.requireActual('@/lib/sampark/catalogue');
    return {
        ...actual,
        purposeSpec: (id: string) => {
            const spec = actual.purposeSpec(id);
            return mockPromotional.has(id) ? { ...spec, commercial: 'promotional' } : spec;
        },
    };
});

afterEach(() => mockPromotional.clear());

describe('class gate 8 — the catalogue', () => {
    it('classifies every purpose, and every one is a service purpose', () => {
        const entries = Object.values(PURPOSE_CATALOGUE);
        expect(entries.length).toBe(32);
        for (const spec of entries) expect(spec.commercial).toBe('service');
    });

    it('every available purpose is service and dialable', () => {
        for (const spec of availablePurposes()) {
            expect(spec.commercial).toBe('service');
            expect(isDialable(spec.id)).toBe(true);
        }
    });
});

describe('class gate 8 — a promotional purpose is never schedulable', () => {
    it('the gate blocks a promotional spec at both stages', () => {
        const promo = { ...purposeSpec('ptm_invite'), commercial: 'promotional' as const };
        for (const stage of ['materialise', 'dispatch'] as const) {
            const v = evaluateGate({
                school: school(),
                spec: promo,
                guardian: guardian('g1', { studentIds: ['s1'] }),
                students: [student('s1')],
                preferences: prefs('g1'),
                suppression: null,
                recentCallsToPhone: 0,
                carrierKind: 'simulated',
                now: WED_11_IST,
                stage,
            });
            expect(v).toEqual({ kind: 'block', reason: 'human_only_purpose' });
        }
    });

    it('materialisation refuses the campaign outright and writes nothing', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 3);
        const c = campaign();
        await repo.createCampaign(c);
        mockPromotional.add('ptm_invite');
        await expect(materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated')).rejects.toThrow(/NOT_SCHEDULABLE/);
        expect(await repo.listIntentsByCampaign(ORG, c.id)).toEqual([]);
    });

    it('an approved intent whose purpose became promotional is blocked at dispatch and never dialled', async () => {
        const repo = createMemorySamparkRepo();
        const clock = testClock();
        await seedFamilies(repo, 2);
        const c = campaign({ mode: 'practice' }); // approved in the school's mode (H2)
        await repo.createCampaign(c);
        await materialiseCampaignIntents({ repo, clock }, c, school(), 'simulated');
        mockPromotional.add('ptm_invite');
        const carrier = scriptedCarrier(() => 'full');
        await runDispatchTick(deps(repo, clock, carrier), DEFAULT_OPTS);
        expect(carrier.requests).toHaveLength(0);
        for (const i of await repo.listIntentsByCampaign(ORG, c.id)) expect(i).toMatchObject({ status: 'blocked', blockReason: 'human_only_purpose' });
    });

    it('every catalogue purpose, if it were promotional, would be refused by materialisation', async () => {
        for (const id of Object.keys(PURPOSE_CATALOGUE) as PurposeId[]) {
            const repo = createMemorySamparkRepo();
            await seedFamilies(repo, 1);
            mockPromotional.add(id);
            await expect(materialiseCampaignIntents({ repo, clock: testClock() }, campaign({ purpose: id }), school(), 'simulated')).rejects.toThrow(/NOT_SCHEDULABLE/);
            mockPromotional.clear();
        }
    });
});
