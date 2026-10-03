/**
 * @jest-environment node
 *
 * CLASS GATE (plan §2E, §13 gate 10) — sensitive flags and eligibility.
 *
 * A counsellor referral, custody restriction, "domestic issue" or "severe
 * illness" barrier suppresses ALL automated calls about that child except
 * class-wide D notices. Nurse and counsellor notes are excluded from every
 * rule. Every excluded child gets a plain reason. Checked at BOTH layers: the
 * rules (before a proposal exists) and the policy gate (materialise/dispatch).
 */
import { PURPOSE_CATALOGUE } from '@/lib/sampark/catalogue';
import { evaluateGate } from '@/lib/sampark/policy/gate';
import { feeExclusionFor, suppressionFor, SENSITIVE_FLAG_PLAIN } from '@/lib/sampark/rules/eligibility';
import { evaluateRule, runAdoptedRules } from '@/lib/sampark/rules/engine';
import { DEFAULT_THRESHOLDS } from '@/lib/sampark/rules/thresholds';
import { RULE_IDS } from '@/lib/sampark/rules/types';
import { usableNotes } from '@/lib/sampark/rules/signals';
import { istDate } from '@/lib/sampark/policy/ist';
import type { SensitiveFlag } from '@/types/sampark';
import { guardian, prefs, school } from '../engine/_fixtures';

import { due, marks, note, schoolDays, score, signals, stu } from './_build';
import { ALL_ADOPTED, ANCHOR_11_IST, loadFixtureSignals, loadFixtureStudents } from './_fixture';

const FLAGS: SensitiveFlag[] = ['counsellor_referral', 'custody_restriction', 'domestic_issue', 'severe_illness', 'safeguarding_open'];
const NOW = ANCHOR_11_IST;
const EMPTY = signals();

describe('property: a sensitive flag suppresses every non-class-wide purpose, at both layers', () => {
    const purposes = Object.values(PURPOSE_CATALOGUE);

    it.each(FLAGS)('rule layer: %s suppresses every child-audience purpose and no class-wide one', (flag) => {
        const child = stu('x', { sensitiveFlags: [flag] });
        for (const spec of purposes) {
            const r = suppressionFor(spec.id, child, EMPTY);
            if (spec.audience === 'class') expect({ purpose: spec.id, r }).toEqual({ purpose: spec.id, r: null });
            else expect({ purpose: spec.id, code: r?.code }).toEqual({ purpose: spec.id, code: 'sensitive_flag' });
        }
    });

    it.each(FLAGS)('gate layer: %s never lets a child-audience purpose through, even via an approved proposal', (flag) => {
        const child = stu('x', { sensitiveFlags: [flag] });
        const g = guardian('g-x', { phoneClass: 'synthetic', studentIds: ['x'] });
        for (const spec of purposes) {
            const verdict = evaluateGate({
                school: school(),
                spec,
                guardian: g,
                students: [child],
                preferences: prefs('g-x', { notices: 'granted', progress: 'granted' }),
                suppression: null,
                recentCallsToPhone: 0,
                carrierKind: 'simulated',
                now: new Date('2026-10-07T05:30:00Z'),
                stage: 'dispatch',
                viaProposal: true,
            });
            if (spec.audience === 'child') expect({ purpose: spec.id, kind: verdict.kind }).not.toEqual({ purpose: spec.id, kind: 'allow' });
            if (spec.audience === 'child' && spec.mode !== 'human_only' && spec.status !== 'planned') {
                expect({ purpose: spec.id, verdict }).toEqual({ purpose: spec.id, verdict: { kind: 'block', reason: 'sensitive_flag' } });
            }
        }
    });

    it('a class-wide notice still reaches a flagged child\'s family (D notices name no child)', () => {
        const child = stu('x', { sensitiveFlags: ['custody_restriction'] });
        const verdict = evaluateGate({
            school: school(),
            spec: PURPOSE_CATALOGUE.emergency_closure,
            guardian: guardian('g-x', { studentIds: ['x'] }),
            students: [child],
            preferences: prefs('g-x'),
            suppression: null,
            recentCallsToPhone: 0,
            carrierKind: 'simulated',
            now: new Date('2026-10-07T05:30:00Z'),
            stage: 'dispatch',
        });
        expect(verdict.kind).toBe('allow');
    });

    it('rule-driven purposes are refused at the gate without an approved proposal', () => {
        const verdict = evaluateGate({
            school: school(),
            spec: PURPOSE_CATALOGUE.academic_talk,
            guardian: guardian('g-x', { studentIds: ['x'] }),
            students: [stu('x')],
            preferences: prefs('g-x', { progress: 'granted' }),
            suppression: null,
            recentCallsToPhone: 0,
            carrierKind: 'simulated',
            now: new Date('2026-10-07T05:30:00Z'),
            stage: 'dispatch',
        });
        expect(verdict).toEqual({ kind: 'block', reason: 'purpose_not_available' });
    });
});

describe('every rule, for a child who would trigger it, gives a plain reason and no draft when flagged', () => {
    /** One child who trips ALL rules at once, then each sensitive flag is added in turn. */
    function triggering(flag: SensitiveFlag | null) {
        const s = stu('x', { sensitiveFlags: flag ? [flag] : [] });
        const days = schoolDays(30);
        const sig = signals({
            attendance: [...marks('x', days, (i) => (i >= 26 ? 'absent' : 'present')), ...marks('peer', days, () => 'present')],
            assessments: [score('x', 'PT1', '2026-07-20', 83), score('x', 'PT2', '2026-08-20', 60), score('x', 'HY', '2026-09-20', 39)],
            hpc: [
                note('c1', 'x', { sentiment: 'concern', observedOn: '2026-09-25' }),
                note('c2', 'x', { sentiment: 'concern', respondentType: 'bus_attendant', observedOn: '2026-09-26' }),
                note('p1', 'x', { sentiment: 'positive', observedOn: '2026-09-27' }),
                note('p2', 'x', { sentiment: 'positive', respondentType: 'coach', observedOn: '2026-09-28' }),
            ],
            feeDues: [due('d1', 'x', '2026-10-05'), due('d2', 'x', '2026-09-25')],
        });
        return { students: [s, stu('peer')], sig };
    }
    const confirmations = [{ id: 'c', orgId: 'hillview-demo', date: '2026-09-30', grade: 7, section: 'B', confirmedBy: 't', confirmedAt: '2026-09-30T04:40:00.000Z' }];

    it('control: the same child unflagged triggers every rule', () => {
        const { students, sig } = triggering(null);
        const todaySig = { ...sig, attendance: [...sig.attendance] };
        const r = runAdoptedRules({ asOf: NOW, students, signals: todaySig, adoptions: ALL_ADOPTED, confirmations });
        const purposes = new Set(r.drafts.filter((d) => d.studentId === 'x').map((d) => d.purpose));
        expect([...purposes].sort()).toEqual([...RULE_IDS].sort());
    });

    it.each(FLAGS)('with %s, no rule produces a draft and each says why in plain words', (flag) => {
        const { students, sig } = triggering(flag);
        const r = runAdoptedRules({ asOf: NOW, students, signals: sig, adoptions: ALL_ADOPTED, confirmations });
        expect(r.drafts.filter((d) => d.studentId === 'x')).toEqual([]);
        const mine = r.excluded.filter((e) => e.studentId === 'x');
        expect(new Set(mine.map((e) => e.purpose))).toEqual(new Set(RULE_IDS));
        for (const e of mine) {
            expect(e.code).toBe('sensitive_flag');
            expect(e.plain).toContain(SENSITIVE_FLAG_PLAIN[flag]);
            expect(e.plain).toMatch(/No automated call goes out about this child/);
        }
    });
});

describe('counsellor involvement, open wellbeing matters and enrolment', () => {
    it('counsellor notes (a card entry) suppress even without a flag, and are never read as evidence', () => {
        const counsellor = note('k1', 'x', { respondentType: 'counsellor', confidential: true, note: null, reasonCode: 'counselling_session', sentiment: 'concern' });
        expect(suppressionFor('academic_talk', stu('x'), signals({ hpc: [counsellor] }))).toMatchObject({ code: 'counsellor_involved' });
    });
    it('an open bullying incident or wellbeing meeting suppresses automated calls', () => {
        expect(suppressionFor('conduct_talk', stu('x'), signals({ incidents: [{ studentId: 'x', reasonCode: 'bullying_reported', severity: 'medium', status: 'open' }] }))).toMatchObject({ code: 'open_wellbeing_matter' });
        expect(suppressionFor('conduct_talk', stu('x'), signals({ meetings: [{ studentId: 'x', reasonCode: 'wellbeing', status: 'requested' }] }))).toMatchObject({ code: 'open_wellbeing_matter' });
        // closed incidents and completed meetings do not
        expect(suppressionFor('conduct_talk', stu('x'), signals({ incidents: [{ studentId: 'x', reasonCode: 'bullying_reported', severity: 'medium', status: 'closed' }] }))).toBeNull();
        expect(suppressionFor('conduct_talk', stu('x'), signals({ meetings: [{ studentId: 'x', reasonCode: 'wellbeing', status: 'completed' }] }))).toBeNull();
    });
    it('a child who has left is never called about', () => {
        expect(suppressionFor('attendance_talk', stu('x', { active: false }), EMPTY)).toMatchObject({ code: 'left_school' });
    });
    it('RTE, fee-waived, scholarship and staff-ward families are excluded from fee calls only', () => {
        expect(feeExclusionFor(stu('x', { feeCategory: 'rte' }))).toMatchObject({ code: 'fee_category_rte' });
        expect(feeExclusionFor(stu('x', { feeCategory: 'waived' }))).toMatchObject({ code: 'fee_category_waived' });
        expect(feeExclusionFor(stu('x', { feeCategory: 'scholarship' }))).toMatchObject({ code: 'fee_category_scholarship' });
        expect(feeExclusionFor(stu('x', { feeCategory: 'staff_ward' }))).toMatchObject({ code: 'fee_category_staff_ward' });
        expect(feeExclusionFor(stu('x', { feeCategory: 'regular' }))).toBeNull();
        expect(suppressionFor('attendance_talk', stu('x', { feeCategory: 'rte' }), EMPTY)).toBeNull();
    });
});

describe('nurse and counsellor notes are excluded from every rule', () => {
    it('usableNotes drops them, and any confidential entry, before a rule sees anything', () => {
        const notes = [
            note('n1', 'x', { respondentType: 'nurse', confidential: true, note: null, reasonCode: 'sick_bay_visit' }),
            note('n2', 'x', { respondentType: 'counsellor', confidential: true, note: null, reasonCode: 'counselling_session' }),
            note('n3', 'x', { respondentType: 'teacher', confidential: true, note: null }),
            note('n4', 'x', { respondentType: 'teacher' }),
            note('n5', 'x', { respondentType: 'peer' }),
        ];
        expect(usableNotes(notes).map((n) => n.id)).toEqual(['n4']);
    });
    it('concern or positive entries from nurse/counsellor never trigger A4 or A5, however many', () => {
        const spam = ['nurse', 'counsellor'].flatMap((who, i) =>
            [0, 1, 2].flatMap((j) => [
                note(`${who}-c${j}`, 'x', { respondentType: who, confidential: true, note: null, reasonCode: 'wellbeing_check_in', sentiment: 'concern', observedOn: `2026-09-2${i + j}` }),
                note(`${who}-p${j}`, 'x', { respondentType: who, confidential: true, note: null, reasonCode: 'wellbeing_check_in', sentiment: 'positive', observedOn: `2026-09-2${i + j}` }),
            ]),
        );
        const ctx = { asOf: NOW, today: istDate(NOW), students: [stu('x')], signals: signals({ hpc: spam }) };
        expect(evaluateRule('conduct_talk', ctx, DEFAULT_THRESHOLDS.conduct_talk)).toEqual({ drafts: [], excluded: [] });
        expect(evaluateRule('recognition', ctx, DEFAULT_THRESHOLDS.recognition)).toEqual({ drafts: [], excluded: [] });
    });
    it('the CRM contract refuses confidential note text, so only reason codes can ever arrive', () => {
        const { HpcNoteSchema } = jest.requireActual('@/lib/sampark/rules/signals') as typeof import('@/lib/sampark/rules/signals');
        const bad = { ...note('n1', 'x', { respondentType: 'counsellor', confidential: true, reasonCode: 'counselling_session' }), note: 'parents are divorcing' };
        expect(HpcNoteSchema.safeParse(bad).success).toBe(false);
        expect(HpcNoteSchema.safeParse({ ...bad, note: null }).success).toBe(true);
        // a nurse entry flagged non-confidential but carrying text is refused too
        expect(HpcNoteSchema.safeParse({ ...bad, confidential: false, respondentType: 'nurse' }).success).toBe(false);
    });
    it('over the mock CRM term, no evidence text ever comes from a nurse or counsellor entry', () => {
        const students = loadFixtureStudents();
        const sig = loadFixtureSignals();
        const confidentialIds = new Set(sig.hpc.filter((n) => n.confidential || n.respondentType === 'nurse' || n.respondentType === 'counsellor').map((n) => n.id));
        expect(confidentialIds.size).toBeGreaterThan(0);
        const r = runAdoptedRules({ asOf: NOW, students, signals: sig, adoptions: ALL_ADOPTED });
        for (const d of r.drafts) for (const e of d.evidence) expect(['nurse', 'counsellor']).not.toContain(e.source);
    });
});

describe('the mock CRM planted cases', () => {
    const students = loadFixtureStudents();
    const sig = loadFixtureSignals();
    const r = runAdoptedRules({ asOf: NOW, students, signals: sig, adoptions: ALL_ADOPTED });

    it('the counsellor-referral child (Kunal) and the custody-restriction child (Kripa) get nothing dialable, with reasons', () => {
        for (const id of ['stu_0251', 'stu_0125']) {
            expect(r.drafts.filter((d) => d.studentId === id)).toEqual([]);
        }
        const kunalFee = r.excluded.find((e) => e.studentId === 'stu_0251' && e.purpose === 'fee_due');
        expect(kunalFee?.code).toBe('sensitive_flag');
        expect(kunalFee?.plain).toMatch(/counsellor referral/);
        const kripa = r.excluded.find((e) => e.studentId === 'stu_0125' && e.purpose === 'fee_overdue');
        expect(kripa?.plain).toMatch(/custody restriction/);
    });
    it('the RTE-quota child with a due (Neha) gets no fee call, with a reason', () => {
        expect(r.drafts.filter((d) => d.studentId === 'stu_0273' && d.purpose === 'fee_due')).toEqual([]);
        expect(r.excluded.find((e) => e.studentId === 'stu_0273' && e.purpose === 'fee_due')).toMatchObject({ code: expect.stringMatching(/^fee_category_/) });
    });
    it('every excluded child has a non-empty plain reason', () => {
        expect(r.excluded.length).toBeGreaterThan(3);
        for (const e of r.excluded) expect(e.plain.length).toBeGreaterThan(20);
    });
});
