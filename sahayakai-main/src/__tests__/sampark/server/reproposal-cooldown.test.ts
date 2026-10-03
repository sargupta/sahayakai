/** @jest-environment node */
/**
 * The school chooses how long before the same child is proposed again for the
 * same purpose: 7 or 14 days (default 14). 7 is the floor; a school may be
 * stricter, never looser. The engine honours the ADOPTED value. Proposal
 * expiry stays 7 days. Practice mode only.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { runImport } from '@/lib/sampark/crm/import';
import type { CrmSource } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { createMemoryRulesRepo } from '@/lib/sampark/rules/memory-repo';
import type { CrmSignals } from '@/lib/sampark/rules/signals';
import { cooldownDaysOf, DEFAULT_THRESHOLDS, parseThresholds, THRESHOLD_SCHEMAS } from '@/lib/sampark/rules/thresholds';
import { DEFAULT_REPROPOSAL_COOLDOWN_DAYS, REPROPOSAL_COOLDOWN_OPTIONS } from '@/lib/sampark/rules/types';
import { enableSchool } from '@/server/sampark/school';
import { adoptRule, grantRole, listRules, runRules, type ProposalCtx } from '@/server/sampark/proposals';

import { marks, schoolDays, score, signals as sig } from '../rules/_build';
import { ADMIN, CRM_SCHOOL, crmConsent, crmGuardian, crmStudent, ORG, setPhoneEnv, testClock } from './_helpers';

beforeAll(setPhoneEnv);

const DAY = 86_400_000;
const MON = new Date('2026-10-05T05:30:00Z');
const PRINCIPAL = { uid: ADMIN, isOrgAdmin: true };
const SPOKEN = { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कूल' };
const consent = { notices: crmConsent('granted'), progress: crmConsent('granted'), recordedConversation: null, hpcInput: null };

function crm(): CrmSource {
    const students = [crmStudent('s-acad', { section: 'B', guardians: [{ guardianId: 'g-s-acad', isPrimary: true, isGuardianOfRecord: true }] })];
    const guardians = [crmGuardian('g-s-acad', { preferredLanguage: 'hi', consent })];
    return { kind: 'rest', fetchSchool: async () => CRM_SCHOOL, fetchStudents: async () => students, fetchGuardians: async () => guardians };
}

/** Sustained academic drop; each `extra` assessment is a NEW fact (new dedupe key), so only the cooldown can stop it. */
function academicSignals(extra: number): CrmSignals {
    const days = schoolDays(10, '2026-10-05');
    const scores = [score('s-acad', 'PT1', '2026-07-20', 83), score('s-acad', 'PT2', '2026-08-20', 60), score('s-acad', 'HY', '2026-09-20', 39)];
    for (let i = 1; i <= extra; i++) scores.push(score('s-acad', `X${i}`, `2026-09-2${i}`, 39 - i * 5));
    return sig({ attendance: marks('s-acad', days, () => 'present'), assessments: scores });
}

async function setup() {
    const clock = testClock(MON);
    const repo = createMemorySamparkRepo();
    const rules = createMemoryRulesRepo();
    let current = academicSignals(0);
    const ctx: ProposalCtx = { repo, rules, clock, loadSignals: async () => ({ signals: current, rejected: [] }) };
    await enableSchool({ repo, clock }, ORG, ADMIN, { displayName: 'Hillview Demo School', isDemo: true, spokenName: SPOKEN });
    expect((await runImport({ repo, clock }, ORG, crm(), ADMIN)).status).toBe('succeeded');
    await grantRole(ctx, ORG, { uid: 't7b', role: 'class_teacher', sections: [{ grade: 7, section: 'B' }], displayName: 'Mrs Rai' }, ADMIN);
    return { clock, ctx, setSignals: (s: CrmSignals) => (current = s) };
}

describe('threshold: reproposalCooldownDays', () => {
    const PURPOSES = ['attendance_talk', 'academic_talk', 'conduct_talk', 'recognition'] as const;

    it('defaults to 14, and the only options are 7 and 14', () => {
        expect(DEFAULT_REPROPOSAL_COOLDOWN_DAYS).toBe(14);
        expect([...REPROPOSAL_COOLDOWN_OPTIONS]).toEqual([7, 14]);
        for (const r of PURPOSES) expect(DEFAULT_THRESHOLDS[r].reproposalCooldownDays).toBe(14);
    });
    it('accepts 7 and 14 for every cooldown rule', () => {
        for (const r of PURPOSES) {
            for (const v of [7, 14]) {
                const parsed = parseThresholds(r, { ...DEFAULT_THRESHOLDS[r], reproposalCooldownDays: v });
                expect(parsed.ok && (parsed.value as { reproposalCooldownDays: number }).reproposalCooldownDays).toBe(v);
            }
        }
    });
    it('rejects anything looser than the floor or off the menu: 5, 10, 30, 0, negative, text', () => {
        for (const r of PURPOSES) {
            for (const v of [5, 10, 30, 0, -7, 6, 15, '7', null]) {
                const parsed = parseThresholds(r, { ...DEFAULT_THRESHOLDS[r], reproposalCooldownDays: v });
                expect(parsed.ok).toBe(false);
                if (!parsed.ok) expect(parsed.message).toMatch(/7 or 14/);
            }
        }
    });
    it('a record with no value (adopted before the choice existed) reads as the default, 14', () => {
        const { reproposalCooldownDays: _omit, ...legacy } = DEFAULT_THRESHOLDS.academic_talk;
        void _omit;
        const parsed = parseThresholds('academic_talk', legacy);
        expect(parsed.ok && parsed.value.reproposalCooldownDays).toBe(14);
        expect(cooldownDaysOf(legacy)).toBe(14);
        expect(cooldownDaysOf(undefined)).toBe(14);
        expect(cooldownDaysOf({ reproposalCooldownDays: 7 })).toBe(7);
        // a stored value off the menu (should be impossible) fails toward fewer calls
        expect(cooldownDaysOf({ reproposalCooldownDays: 3 })).toBe(14);
    });
    it('rules without a re-proposal cooldown do not take the field', () => {
        expect(THRESHOLD_SCHEMAS.fee_due.safeParse({ daysBeforeDue: 7, reproposalCooldownDays: 7 }).success).toBe(false);
        expect(THRESHOLD_SCHEMAS.absence_today.safeParse({ absentByHour: 10, latestProposalHour: 14, reproposalCooldownDays: 7 }).success).toBe(false);
    });
});

describe('the engine honours the adopted cooldown', () => {
    async function runWith(cooldown: 7 | 14 | undefined, gapDays: number) {
        const env = await setup();
        const thresholds = cooldown === undefined ? DEFAULT_THRESHOLDS.academic_talk : { ...DEFAULT_THRESHOLDS.academic_talk, reproposalCooldownDays: cooldown };
        const adopted = await adoptRule(env.ctx, ORG, 'academic_talk', { thresholds, adopterName: 'The Principal', acknowledged: true }, PRINCIPAL);
        const first = await runRules(env.ctx, ORG);
        expect(first.created).toBe(1);
        env.setSignals(academicSignals(1)); // a newer assessment: a different dedupe key, same child and purpose
        env.clock.set(new Date(MON.getTime() + gapDays * DAY + 3_600_000));
        const second = await runRules(env.ctx, ORG);
        return { adopted, second };
    }

    it('persists the choice in the adoption record, and the Rules tab reads it back', async () => {
        const env = await setup();
        const a = await adoptRule(env.ctx, ORG, 'academic_talk', { thresholds: { ...DEFAULT_THRESHOLDS.academic_talk, reproposalCooldownDays: 7 }, adopterName: 'The Principal', acknowledged: true }, PRINCIPAL);
        expect(a.thresholds).toMatchObject({ reproposalCooldownDays: 7 });
        expect((await env.ctx.rules.listAdoptionHistory(ORG))[0].thresholds).toMatchObject({ reproposalCooldownDays: 7 });
        const view = (await listRules(env.ctx, ORG)).rules.find((r) => r.ruleId === 'academic_talk')!;
        expect(view.thresholds).toMatchObject({ reproposalCooldownDays: 7 });
        expect(view.defaults).toMatchObject({ reproposalCooldownDays: 14 });
    });
    it('adoption without a value stores the default 14', async () => {
        const env = await setup();
        const { reproposalCooldownDays: _omit, ...legacy } = DEFAULT_THRESHOLDS.academic_talk;
        void _omit;
        const a = await adoptRule(env.ctx, ORG, 'academic_talk', { thresholds: legacy, adopterName: 'The Principal', acknowledged: true }, PRINCIPAL);
        expect(a.thresholds).toMatchObject({ reproposalCooldownDays: 14 });
    });
    it('adoption rejects 5, 10 and 30 with a plain message', async () => {
        const env = await setup();
        for (const v of [5, 10, 30]) {
            await expect(
                adoptRule(env.ctx, ORG, 'academic_talk', { thresholds: { ...DEFAULT_THRESHOLDS.academic_talk, reproposalCooldownDays: v }, adopterName: 'The Principal', acknowledged: true }, PRINCIPAL),
            ).rejects.toMatchObject({ message: expect.stringMatching(/7 or 14/) });
        }
    });

    it('proposal expiry stays 7 days whatever the cooldown', async () => {
        for (const cooldown of [7, 14] as const) {
            const env = await setup();
            await adoptRule(env.ctx, ORG, 'academic_talk', { thresholds: { ...DEFAULT_THRESHOLDS.academic_talk, reproposalCooldownDays: cooldown }, adopterName: 'The Principal', acknowledged: true }, PRINCIPAL);
            await runRules(env.ctx, ORG);
            const [p] = await env.ctx.rules.listProposals(ORG);
            // end of the IST day, 7 days after Mon 2026-10-05
            expect(p.expiresAt).toBe('2026-10-12T18:29:59.999Z');
        }
    });
    it('7: blocked on day 6, proposed again from day 8', async () => {
        expect((await runWith(7, 6)).second).toMatchObject({ created: 0, skippedCooldown: 1 });
        expect((await runWith(7, 8)).second).toMatchObject({ created: 1, skippedCooldown: 0 });
    });
    it('14: blocked on day 8 and day 13, proposed again from day 15', async () => {
        expect((await runWith(14, 8)).second).toMatchObject({ created: 0, skippedCooldown: 1 });
        expect((await runWith(14, 13)).second).toMatchObject({ created: 0, skippedCooldown: 1 });
        expect((await runWith(14, 15)).second).toMatchObject({ created: 1, skippedCooldown: 0 });
    });
    it('default (14 when the school does not choose): blocked on day 8', async () => {
        expect((await runWith(undefined, 8)).second).toMatchObject({ created: 0, skippedCooldown: 1 });
    });
});
