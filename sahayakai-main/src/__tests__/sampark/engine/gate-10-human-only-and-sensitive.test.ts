/**
 * @jest-environment node
 *
 * CLASS GATE 10 (partial, slice 1) — a human-only purpose, or a child-specific
 * purpose about a child with a sensitive flag, never produces a dialable
 * ('approved') intent. Class-wide notices are the one deliberate exception for
 * sensitive flags (plan §2E): they name no child.
 */
import { materialiseCampaignIntents } from '@/lib/sampark/audience';
import { PURPOSE_CATALOGUE, type PurposeSpec } from '@/lib/sampark/catalogue';
import { evaluateGate, type GateInput } from '@/lib/sampark/policy/gate';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SensitiveFlag } from '@/types/sampark';

import { campaign, guardian, ORG, prefs, school, student, testClock, WED_11_IST } from './_fixtures';

const ALL = Object.values(PURPOSE_CATALOGUE);
const HUMAN_ONLY = ALL.filter((p) => p.mode === 'human_only');
const CHILD_DIALABLE = ALL.filter((p) => p.mode !== 'human_only' && p.audience === 'child');
const CLASS_AVAILABLE = ALL.filter((p) => p.audience === 'class' && p.status === 'available');
const FLAGS: SensitiveFlag[] = ['domestic_issue', 'severe_illness', 'counsellor_referral', 'custody_restriction', 'safeguarding_open'];

function input(spec: PurposeSpec, overrides: Partial<GateInput> = {}): GateInput {
    return {
        school: school({ emergencyBypassConsent: true }),
        spec,
        guardian: guardian('g1', { studentIds: ['s1'] }),
        students: [student('s1')],
        // Everything granted, so only the rule under test can refuse.
        preferences: prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted', hpc_input: 'granted' }),
        suppression: null,
        recentCallsToPhone: 0,
        carrierKind: 'simulated',
        now: WED_11_IST,
        stage: 'materialise',
        ...overrides,
    };
}

async function materialiseAll(purpose: PurposeSpec['id'], sensitive: SensitiveFlag[]) {
    const repo = createMemorySamparkRepo();
    await repo.upsertSchool(school());
    await repo.upsertStudents(ORG, [student('s1', { guardianIds: ['g1'], sensitiveFlags: sensitive }), student('s2', { guardianIds: ['g2'] })]);
    await repo.upsertGuardians(ORG, [guardian('g1', { studentIds: ['s1'] }), guardian('g2', { studentIds: ['s2'] })]);
    await repo.upsertPreferences([
        prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted', hpc_input: 'granted' }),
        prefs('g2', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted', hpc_input: 'granted' }),
    ]);
    const c = campaign({ purpose });
    await repo.createCampaign(c);
    await materialiseCampaignIntents({ repo, clock: testClock() }, c, school(), 'simulated');
    return repo.listIntentsByCampaign(ORG, c.id);
}

describe('class gate 10 — human-only purposes', () => {
    it('the catalogue has the eight human-only purposes, none with attempts', () => {
        expect(HUMAN_ONLY.map((p) => p.id).sort()).toEqual(
            ['child_missing', 'child_unwell', 'counsellor_meeting', 'discipline_decision', 'fee_hardship', 'safeguarding', 'security_incident', 'wellbeing'],
        );
        for (const p of HUMAN_ONLY) expect(p.maxAttempts).toBe(0);
    });

    it.each(HUMAN_ONLY.map((p) => [p.id, p] as const))('%s is blocked at both stages, even if marked available', (_id, spec) => {
        for (const stage of ['materialise', 'dispatch'] as const) {
            expect(evaluateGate(input(spec, { stage }))).toEqual({ kind: 'block', reason: 'human_only_purpose' });
            expect(evaluateGate(input({ ...spec, status: 'available' }, { stage }))).toEqual({ kind: 'block', reason: 'human_only_purpose' });
        }
    });

    it.each(HUMAN_ONLY.map((p) => [p.id] as const))('a %s campaign materialises no approved intent', async (id) => {
        const intents = await materialiseAll(id, []);
        expect(intents).toHaveLength(2);
        for (const i of intents) expect(i).toMatchObject({ status: 'blocked', blockReason: 'human_only_purpose' });
    });
});

describe('class gate 10 — sensitive flags', () => {
    it.each(CHILD_DIALABLE.map((p) => [p.id, p] as const))('%s about a flagged child is blocked (every flag)', (_id, spec) => {
        const available = { ...spec, status: 'available' as const };
        for (const flag of FLAGS) {
            expect(evaluateGate(input(available, { students: [student('s1', { sensitiveFlags: [flag] })] }))).toEqual({ kind: 'block', reason: 'sensitive_flag' });
        }
        // Control: the same purpose about an unflagged child is not blocked for this reason.
        const unflagged = evaluateGate(input(available));
        expect(unflagged.kind === 'block' ? unflagged.reason : unflagged.kind).not.toBe('sensitive_flag');
    });

    it('a flagged sibling in a bundle blocks a child-specific call for the whole bundle', () => {
        const spec = { ...PURPOSE_CATALOGUE.fee_due, status: 'available' as const };
        const v = evaluateGate(input(spec, { students: [student('s1'), student('s2', { sensitiveFlags: ['custody_restriction'] })] }));
        expect(v).toEqual({ kind: 'block', reason: 'sensitive_flag' });
    });

    it.each(CHILD_DIALABLE.map((p) => [p.id] as const))('a %s campaign including a flagged child materialises no approved intent for that child', async (id) => {
        const intents = await materialiseAll(id, ['domestic_issue']);
        const flagged = intents.find((i) => i.studentIds.includes('s1'));
        expect(flagged?.status).toBe('blocked');
        expect(intents.filter((i) => i.status === 'approved')).toEqual([]); // slice 1: child purposes are not yet available at all
    });

    it.each(CLASS_AVAILABLE.map((p) => [p.id] as const))('class-wide %s still reaches the family of a flagged child (names no child)', async (id) => {
        const intents = await materialiseAll(id, ['domestic_issue']);
        expect(intents.find((i) => i.studentIds.includes('s1'))?.status).toBe('approved');
    });
});
