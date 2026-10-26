/**
 * @jest-environment node
 *
 * GATE H8 (custody) — no purpose ever allows a call about a custody-restricted
 * child, class-wide notices and emergencies included. The office informs that
 * family by hand.
 *
 * The bug class: the gate let every sensitive flag through for class-wide purposes,
 * because such a notice names no child. But a closure, an early dismissal or an
 * event says when and where the child will be — exactly what a restricted guardian
 * must not learn from an automated call. The sweep below covers every purpose in
 * the catalogue (as catalogued and forced 'available'), both stages, both carriers
 * and destinations, every consent state and the emergency consent bypass, the
 * child alone and bundled with a sibling, and every other flag alongside. A control
 * sweep without the custody flag proves the sweep reaches the rule at all.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { PURPOSE_CATALOGUE, type PurposeSpec } from '@/lib/sampark/catalogue';
import { evaluateGate, type GateInput } from '@/lib/sampark/policy/gate';
import { istInstant } from '@/lib/sampark/policy/ist';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { ConsentStatus, SensitiveFlag } from '@/types/sampark';

import { campaign, guardian, ORG, prefs, school, student, testClock, testModeSchool } from './_fixtures';

const ENV = process.env.SAMPARK_LIVE_DIAL_ENABLED;
beforeAll(() => {
    process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
});
afterAll(() => {
    if (ENV === undefined) delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    else process.env.SAMPARK_LIVE_DIAL_ENABLED = ENV;
});

const SPECS: PurposeSpec[] = Object.values(PURPOSE_CATALOGUE).flatMap((p) => [p, { ...p, status: 'available' as const }]);
const OTHER_FLAGS: SensitiveFlag[][] = [[], ['domestic_issue'], ['safeguarding_open', 'severe_illness']];
const CONSENT: ConsentStatus[] = ['granted', 'unknown'];
// 07:00 IST on a Wednesday: inside the emergency window, outside the routine one (dispatch defers routine calls).
const NOW_OPTIONS = [istInstant('2026-10-07', 11), istInstant('2026-10-07', 7)];
const DIAL = [
    { carrierKind: 'simulated' as const, school: school({ emergencyBypassConsent: true }) },
    { carrierKind: 'vobiz' as const, school: school({ ...testModeSchool(), emergencyBypassConsent: true }), destination: 'test_phone' as const },
    { carrierKind: 'vobiz' as const, school: school({ mode: 'live', emergencyBypassConsent: true }), destination: 'guardian' as const },
];

function* sweep(custody: boolean): Generator<GateInput> {
    for (const spec of SPECS) {
        for (const stage of ['materialise', 'dispatch'] as const) {
            for (const dial of DIAL) {
                for (const consent of CONSENT) {
                    for (const others of OTHER_FLAGS) {
                        for (const sibling of [false, true]) {
                            for (const now of NOW_OPTIONS) {
                                const flags: SensitiveFlag[] = custody ? [...others, 'custody_restriction'] : others;
                                const children = [student('s1', { sensitiveFlags: flags })];
                                if (sibling) children.push(student('s2'));
                                yield {
                                    ...dial,
                                    spec,
                                    guardian: guardian('g1', { studentIds: children.map((c) => c.id), phoneClass: 'mobile' }),
                                    students: children,
                                    preferences: prefs('g1', { notices: consent, progress: consent, recorded_conversation: consent, hpc_input: consent }),
                                    suppression: null,
                                    recentCallsToPhone: 0,
                                    now,
                                    stage,
                                };
                            }
                        }
                    }
                }
            }
        }
    }
}

describe('gate h8 — a custody-restricted child is never the subject of an automated call', () => {
    it('no purpose, stage, carrier, consent state or bundle ever allows it', () => {
        let cases = 0;
        for (const input of sweep(true)) {
            const v = evaluateGate(input);
            cases += 1;
            if (v.kind === 'allow') throw new Error(`allowed: ${input.spec.id} (${input.spec.status}) at ${input.stage} on ${input.carrierKind}`);
        }
        expect(cases).toBeGreaterThan(1000);
    }, 30_000); // a sweep of over 1,000 cases; slow under a fully parallel run

    it('control: without the custody flag the same sweep does allow calls, and every class-wide refusal of a custody child names custody', () => {
        let allowed = 0;
        for (const input of sweep(false)) if (evaluateGate(input).kind === 'allow') allowed += 1;
        expect(allowed).toBeGreaterThan(0);
        // Where only the custody flag differs and the purpose is class-wide, the recorded reason is custody.
        const custodyRuns = [...sweep(true)];
        const plainRuns = [...sweep(false)];
        custodyRuns.forEach((input, i) => {
            if (input.spec.audience !== 'class' || evaluateGate(plainRuns[i]).kind !== 'allow') return;
            expect(evaluateGate(input)).toEqual({ kind: 'block', reason: 'custody_restricted' });
        });
    }, 30_000); // a sweep of over 1,000 cases; slow under a fully parallel run

    it.each(Object.values(PURPOSE_CATALOGUE).filter((p) => p.audience === 'class' && p.status === 'available').map((p) => [p.id] as const))(
        'a %s campaign blocks the restricted family (and the sibling bundled with it) and reaches every other family',
        async (purpose) => {
            const repo = createMemorySamparkRepo();
            await repo.upsertSchool(school({ emergencyBypassConsent: true }));
            await repo.upsertStudents(ORG, [
                student('s1', { guardianIds: ['g1'], sensitiveFlags: ['custody_restriction'] }),
                student('s1-sib', { guardianIds: ['g1'] }),
                student('s2', { guardianIds: ['g2'] }),
            ]);
            await repo.upsertGuardians(ORG, [guardian('g1', { studentIds: ['s1', 's1-sib'] }), guardian('g2', { studentIds: ['s2'] })]);
            await repo.upsertPreferences([prefs('g1'), prefs('g2')]);
            const c = campaign({ purpose });
            await repo.createCampaign(c);
            const res = await materialiseCampaignIntents({ repo, clock: testClock() }, c, school({ emergencyBypassConsent: true }), 'simulated');
            expect(res.blocked).toEqual({ custody_restricted: 1 });
            const intents = await repo.listIntentsByCampaign(ORG, c.id);
            expect(intents.find((i) => i.guardianId === 'g1')).toMatchObject({ status: 'blocked', blockReason: 'custody_restricted', studentIds: ['s1', 's1-sib'] });
            expect(intents.find((i) => i.guardianId === 'g2')).toMatchObject({ status: 'approved' });
        },
    );
});
