/** @jest-environment node */
/**
 * Riya mapping — the wire contract with the hosted agent and the facts → variables builder.
 *
 * CLASS GATE: the six `call_purpose` ids and nineteen variables are pinned against the
 * live agent (fixtures/riya-agent-contract.json). A renamed purpose, a UI label leaking
 * onto the wire, or a variable the agent reads but we never send fails here, not on a call.
 */

import contract from './fixtures/riya-agent-contract.json';

import { buildRiyaVariables, RiyaFactsSchema, spokenDateList, type RiyaFacts } from '@/lib/sampark/conversation/facts';
import {
    DEFAULT_RIYA_PURPOSES,
    enabledRiyaPurposes,
    OUTREACH_REASON_PURPOSE,
    outreachReasonForPurpose,
    RIYA_AGENT_PURPOSES_NOT_OFFERED,
    RIYA_PURPOSES,
    RIYA_VARIABLES,
    riyaPurposeSpec,
    RiyaPurposeSchema,
    type RiyaPurpose,
    SAMPARK_PRODUCT_CONTEXT,
} from '@/lib/sampark/conversation/riya-purposes';
import { RIYA_DATA_COLLECTION_KEYS } from '@/lib/sampark/conversation/types';
import { purposeSpec } from '@/lib/sampark/catalogue';

import { school, student } from '../engine/_fixtures';

const WED_11_IST = new Date('2026-10-07T05:30:00Z'); // Wednesday 7 Oct 2026, 11:00 IST
const SCHOOL = school({ holidays: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-11-12'] });
const STUDENT = student('s1', { spokenFirstName: { English: 'Asha' }, grade: 7, section: 'B' });

const FACTS: Record<RiyaPurpose, RiyaFacts> = {
    event_invitation: { purpose: 'event_invitation', eventType: 'annual_day', date: '2026-10-24', time: { hour: 10, minute: 0 } },
    ptm_invitation: { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 30 } },
    holiday_notice: { purpose: 'holiday_notice', dates: ['2026-10-20', '2026-10-19', '2026-10-21'] },
    exam_schedule_notice: {
        purpose: 'exam_schedule_notice',
        entries: [
            { subject: 'science', date: '2026-11-03', time: { hour: 9, minute: 0 } },
            { subject: 'mathematics', date: '2026-11-02', time: null },
        ],
    },
    absence_notice: { purpose: 'absence_notice', date: '2026-10-07' },
    emergency_closure: { purpose: 'emergency_closure', date: '2026-10-08', reason: 'heavy_rain', busesRunning: false },
    academic_performance: { purpose: 'academic_performance', subjects: ['mathematics', 'science'], concern: 'below_expected' },
    classroom_behaviour: { purpose: 'classroom_behaviour', observations: ['attention', 'disturbing_others'] },
    student_achievement: { purpose: 'student_achievement', achievement: 'top_marks', subject: 'english' },
};

const build = (purpose: RiyaPurpose, facts: RiyaFacts = FACTS[purpose], over: Partial<Parameters<typeof buildRiyaVariables>[0]> = {}) =>
    buildRiyaVariables({ purpose, facts, school: SCHOOL, student: STUDENT, now: WED_11_IST, ...over });

describe('the wire contract with the Riya agent export', () => {
    it('is pinned to the unified SARGVISION agent, whose number is assigned to it', () => {
        expect(contract.agentId).toBe('agent_0601m6hcjz53fa8rbc8mkn46vmw8');
        expect(contract.agentPhoneNumberId).toBe('phnum_5301m6hd2e5de5qaqf79txqf1hbq');
        expect(contract.phoneNumberAssignedAgentId).toBe(contract.agentId);
    });

    it('every call_purpose edge on the agent also requires product_context = sampark, and Sahayak sends exactly that', () => {
        expect(contract.productContext.variable).toBe('product_context');
        expect(contract.productContext.samparkValue).toBe(SAMPARK_PRODUCT_CONTEXT);
        expect(contract.productContext.callPurposeEdgesGatedOnSampark).toEqual(contract.callPurposeEdgeValues);
        // A call without the Sampark context can only reach the agent's safe exit, never a school workflow.
        expect(contract.productContext.fallbackIsUnconditionalAndLast).toBe(true);
        expect(contract.productContext.fallbackNodeLabel).toBe('Context Missing Safe Exit');
        expect(contract.productContext.productValuesRouted).toEqual(['athithi', 'sampark']);
        // product_context only routes; it is not a prompt variable, so it is not one of the nineteen.
        expect(RIYA_VARIABLES as readonly string[]).not.toContain('product_context');
    });

    it('uses the call_purpose values the workflow edges match, and knows the rest are not offered', () => {
        for (const p of RIYA_PURPOSES) expect(contract.callPurposeEdgeValues).toContain(p);
        expect([...RIYA_PURPOSES, ...RIYA_AGENT_PURPOSES_NOT_OFFERED].sort()).toEqual(contract.callPurposeEdgeValues);
    });

    it('sends the variables of the purposes it does not offer as the empty string', () => {
        const notOffered = new Set(RIYA_AGENT_PURPOSES_NOT_OFFERED.flatMap((p) => (contract.nodeVariables as Record<string, string[]>)[p]));
        for (const p of RIYA_PURPOSES) {
            const v = build(p).variables;
            for (const name of notOffered) if (!(contract.nodeVariables as Record<string, string[]>)[p].includes(name)) expect(v[name as keyof typeof v]).toBe('');
        }
    });

    it('declares every variable the prompt, first message and nodes reference — no more, no fewer', () => {
        expect([...RIYA_VARIABLES].sort()).toEqual(contract.promptVariables);
    });

    it('each workflow fills at least the variables its node reads', () => {
        for (const p of RIYA_PURPOSES) {
            const nodeVars = (contract.nodeVariables as Record<string, string[]>)[p];
            const filled = ['school_name', 'student_name', ...riyaPurposeSpec(p).factVariables];
            expect(nodeVars.filter((v) => !filled.includes(v))).toEqual([]);
        }
    });

    it('knows every data-collection id configured on the agent', () => {
        for (const key of contract.dataCollectionKeys) expect(RIYA_DATA_COLLECTION_KEYS).toContain(key);
    });

    it('the agent forbids prompt overrides; greeting and voice overrides exist only for Athithi Vani', () => {
        // Sahayak sends no conversation_config_override (riya-provider.test.ts pins the request shape).
        expect(contract.clientOverridesAllowed).toEqual({ first_message: true, prompt: false, voice_id: true });
    });

    it('rejects any purpose that is not one Sahayak offers, including UI labels', () => {
        expect(RiyaPurposeSchema.safeParse('PTM invitation').success).toBe(false);
        expect(RiyaPurposeSchema.safeParse('ptm_invite').success).toBe(false); // the Sampark id, not the agent's
        expect(RiyaPurposeSchema.safeParse('exam_notice').success).toBe(false);
        expect(RiyaPurposeSchema.safeParse('poor_performance').success).toBe(false); // the outreach reason, not the agent's id
        expect(RiyaPurposeSchema.safeParse('homework_followup').success).toBe(false);
        for (const p of RIYA_PURPOSES) expect(RiyaPurposeSchema.parse(p)).toBe(p);
    });

    it('maps every workflow onto a real, dialable Sampark purpose', () => {
        for (const p of RIYA_PURPOSES) {
            const spec = purposeSpec(riyaPurposeSpec(p).samparkPurpose);
            expect(spec.mode).not.toBe('human_only');
            expect(spec.consentGroup).not.toBeNull();
        }
        expect(purposeSpec(riyaPurposeSpec('emergency_closure').samparkPurpose).emergency).toBe(true);
    });
});

describe('enabled workflows', () => {
    it('defaults to PTM only', () => {
        expect(enabledRiyaPurposes({})).toEqual(['ptm_invitation']);
        expect(DEFAULT_RIYA_PURPOSES).toEqual(['ptm_invitation']);
    });
    it('reads the allow-list and ignores unknown ids', () => {
        expect(enabledRiyaPurposes({ SAMPARK_RIYA_PURPOSES: 'holiday_notice, nonsense ,ptm_invitation' })).toEqual(['ptm_invitation', 'holiday_notice']);
    });
});

describe('buildRiyaVariables — every workflow', () => {
    it.each(RIYA_PURPOSES)('%s: sends all fourteen variables, the call purpose verbatim, and fills its own', (purpose) => {
        const r = build(purpose);
        if (!r.ok) throw new Error(JSON.stringify(r.problems));
        expect(Object.keys(r.variables).sort()).toEqual([...RIYA_VARIABLES].sort());
        expect(r.variables.call_purpose).toBe(purpose);
        expect(r.variables.school_name).toBe('Hillview Demo School');
        expect(r.variables.student_name).toBe('Asha');
        for (const v of riyaPurposeSpec(purpose).requiredVariables) expect(r.variables[v]).not.toBe('');
        // Variables of other workflows are empty ("not provided"), never the export's demo values.
        const own = new Set(['school_name', 'student_name', 'call_purpose', ...riyaPurposeSpec(purpose).factVariables]);
        for (const [k, v] of Object.entries(r.variables)) if (!own.has(k)) expect(v).toBe('');
        expect(JSON.stringify(r.variables)).not.toMatch(/DPS Siliguri|Samuel Jackson|14th October/);
        for (const v of Object.values(r.variables)) expect(v).not.toMatch(/[{}]/);
        expect(r.announcement.length).toBeGreaterThan(20);
    });

    it('PTM: class and section from the student record, date and time in Indian English', () => {
        const r = build('ptm_invitation');
        expect(r.ok && r.variables).toMatchObject({ class_name: 'Seven', section_name: 'B', event_date: 'Saturday, the tenth of October', event_time: 'ten thirty in the morning' });
    });

    it('event: name from the reviewed event type', () => {
        const r = build('event_invitation');
        expect(r.ok && r.variables.event_name).toBe('Annual Day');
    });

    it('holidays: a consecutive run is said as a range', () => {
        const r = build('holiday_notice');
        expect(r.ok && r.variables.holiday_dates).toBe('Monday, the nineteenth of October to Wednesday, the twenty-first of October');
        expect(spokenDateList(['2026-10-19', '2026-11-12'])).toContain('; and ');
    });

    it('exams: sorted by date, subject names from the closed list', () => {
        const r = build('exam_schedule_notice');
        expect(r.ok && r.variables.exam_schedule).toBe('Mathematics on Monday, the second of November; Science on Tuesday, the third of November, at nine o\'clock in the morning');
    });

    it('closure: reason and bus line from the reviewed script; unknown buses → empty transport', () => {
        const r = build('emergency_closure');
        expect(r.ok && r.variables).toMatchObject({ closure_reason: 'heavy rain', transport_information: 'School buses will not run either.' });
        const r2 = build('emergency_closure', { ...FACTS.emergency_closure, busesRunning: null } as RiyaFacts);
        expect(r2.ok && r2.variables.transport_information).toBe('');
    });
});

describe('buildRiyaVariables — refuses rather than invents', () => {
    it('a school with no reviewed English name', () => {
        const r = build('ptm_invitation', FACTS.ptm_invitation, { school: { ...SCHOOL, spokenName: { ...SCHOOL.spokenName, English: '  ' } } });
        expect(r.ok).toBe(false);
        expect(!r.ok && r.problems).toContainEqual({ code: 'MISSING_VALUE', variable: 'school_name' });
    });

    it('a child with no English spoken name', () => {
        const r = build('ptm_invitation', FACTS.ptm_invitation, { student: { ...STUDENT, spokenFirstName: { Hindi: 'आशा' } } });
        expect(!r.ok && r.problems).toContainEqual({ code: 'MISSING_VALUE', variable: 'student_name' });
    });

    it('a section with no spoken form', () => {
        const r = build('ptm_invitation', FACTS.ptm_invitation, { student: { ...STUDENT, section: 'Z' } });
        expect(!r.ok && r.problems).toContainEqual({ code: 'MISSING_VALUE', variable: 'section_name' });
    });

    it('a date in the past', () => {
        const r = build('ptm_invitation', { purpose: 'ptm_invitation', date: '2026-10-01', time: { hour: 10, minute: 0 } });
        expect(!r.ok && r.problems).toContainEqual({ code: 'DATE_IN_PAST', date: '2026-10-01' });
    });

    it('a holiday that is not on the school calendar', () => {
        const r = build('holiday_notice', { purpose: 'holiday_notice', dates: ['2026-10-19', '2026-10-23'] });
        expect(!r.ok && r.problems).toContainEqual({ code: 'NOT_A_SCHOOL_HOLIDAY', date: '2026-10-23' });
    });

    it('an absence in the future or too long ago', () => {
        expect(build('absence_notice', { purpose: 'absence_notice', date: '2026-10-08' }).ok).toBe(false);
        expect(build('absence_notice', { purpose: 'absence_notice', date: '2026-09-30' }).ok).toBe(false);
        expect(build('absence_notice', { purpose: 'absence_notice', date: '2026-10-05' }).ok).toBe(true);
    });

    it('a closure more than a week ahead', () => {
        const r = build('emergency_closure', { purpose: 'emergency_closure', date: '2026-10-20', reason: 'bandh', busesRunning: null });
        expect(!r.ok && r.problems).toContainEqual({ code: 'DATE_TOO_FAR', date: '2026-10-20' });
    });

    it('facts of another workflow', () => {
        const r = build('holiday_notice', FACTS.ptm_invitation);
        expect(!r.ok && r.problems).toEqual([{ code: 'PURPOSE_MISMATCH' }]);
    });

    it('the schema refuses free text, unsayable times, unknown subjects and extra keys', () => {
        expect(RiyaFactsSchema.safeParse({ purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 15 } }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 22, minute: 0 } }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'ptm_invitation', date: '2026-02-30', time: { hour: 10, minute: 0 } }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 }, note: 'bring fees' }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'exam_schedule_notice', entries: [{ subject: 'Maths (syllabus ch 1-4)', date: '2026-11-02', time: null }] }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'emergency_closure', date: '2026-10-08', reason: 'a tiger was seen', busesRunning: false }).success).toBe(false);
        // Outreach workflows: closed choices only, never a sentence a teacher typed.
        expect(RiyaFactsSchema.safeParse({ purpose: 'academic_performance', subjects: ['mathematics'], concern: 'He is lazy and failing' }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'academic_performance', subjects: ['mathematics'], concern: 'below_expected', note: 'scored 12/100' }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'academic_performance', subjects: [], concern: 'below_expected' }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'academic_performance', subjects: ['english', 'english'], concern: 'below_expected' }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'academic_performance', subjects: ['english', 'hindi', 'science', 'mathematics'], concern: 'below_expected' }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'classroom_behaviour', observations: ['hit another child'] }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'classroom_behaviour', observations: [] }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'classroom_behaviour', observations: ['attention', 'disturbing_others', 'late_to_class', 'low_participation'] }).success).toBe(false);
        expect(RiyaFactsSchema.safeParse({ purpose: 'student_achievement', achievement: 'won the district quiz', subject: null }).success).toBe(false);
    });

    it('an achievement that names a subject needs one; one that does not refuses a subject', () => {
        const noSubject = build('student_achievement', { purpose: 'student_achievement', achievement: 'great_improvement', subject: null });
        expect(!noSubject.ok && noSubject.problems).toEqual([{ code: 'MISSING_VALUE', variable: 'achievement_details' }]);
        const stray = build('student_achievement', { purpose: 'student_achievement', achievement: 'full_attendance', subject: 'english' });
        expect(!stray.ok && stray.problems).toEqual([{ code: 'SUBJECT_NOT_EXPECTED' }]);
    });
});

describe('the four attendance outreach reasons (Sampark parent outreach)', () => {
    it('each reason is spoken through its own agent workflow, and the reason is recoverable from the call', () => {
        expect(OUTREACH_REASON_PURPOSE).toEqual({
            consecutive_absences: 'absence_notice',
            poor_performance: 'academic_performance',
            behavioral_concern: 'classroom_behaviour',
            positive_feedback: 'student_achievement',
        });
        for (const [reason, purpose] of Object.entries(OUTREACH_REASON_PURPOSE)) {
            expect(RIYA_PURPOSES).toContain(purpose);
            expect(contract.callPurposeEdgeValues).toContain(purpose);
            expect(outreachReasonForPurpose(purpose)).toBe(reason);
        }
        expect(outreachReasonForPurpose('ptm_invitation')).toBeNull();
    });

    it('scenario 1, consecutive absences: the absence workflow with the day of absence', () => {
        const r = build('absence_notice');
        if (!r.ok) throw new Error(JSON.stringify(r.problems));
        expect(r.variables.call_purpose).toBe('absence_notice');
        expect(r.variables.absence_date).toBe('Wednesday, the seventh of October');
        expect(r.announcement).toBe('Your child was marked absent on Wednesday, the seventh of October. Is your child with you right now?');
    });

    it('scenario 2, poor performance: the academic workflow with the closed concern and subject names', () => {
        const r = build('academic_performance');
        if (!r.ok) throw new Error(JSON.stringify(r.problems));
        expect(r.variables.call_purpose).toBe('academic_performance');
        expect(r.variables.academic_update).toBe("Your child's recent work in Mathematics and Science has been below the expected level.");
        expect(r.variables.behaviour_summary).toBe('');
        expect(r.variables.achievement_details).toBe('');
        const three = build('academic_performance', { purpose: 'academic_performance', subjects: ['english', 'hindi', 'science'], concern: 'missed_assessments' });
        expect(three.ok && three.variables.academic_update).toBe('Your child has missed recent tests or assignments in English, Hindi and Science.');
    });

    it('scenario 3, behavioural concern: the classroom-behaviour workflow with the chosen observations', () => {
        const r = build('classroom_behaviour');
        if (!r.ok) throw new Error(JSON.stringify(r.problems));
        expect(r.variables.call_purpose).toBe('classroom_behaviour');
        expect(r.variables.behaviour_summary).toBe('Your child has been having difficulty paying attention in class and has been disturbing other students during lessons.');
        expect(r.variables.academic_update).toBe('');
    });

    it('scenario 4, positive feedback: the achievement workflow with the chosen achievement', () => {
        const r = build('student_achievement');
        if (!r.ok) throw new Error(JSON.stringify(r.problems));
        expect(r.variables.call_purpose).toBe('student_achievement');
        expect(r.variables.achievement_details).toBe('Your child scored among the highest marks in the class in English.');
        const kind = build('student_achievement', { purpose: 'student_achievement', achievement: 'helpful_to_classmates', subject: null });
        expect(kind.ok && kind.variables.achievement_details).toBe('Your child has been very helpful and kind to classmates.');
    });

    it('the outreach workflows run under request-to-talk catalogue purposes, gated like every Riya call', () => {
        expect(riyaPurposeSpec('academic_performance').samparkPurpose).toBe('academic_talk');
        expect(riyaPurposeSpec('classroom_behaviour').samparkPurpose).toBe('conduct_talk');
        expect(riyaPurposeSpec('student_achievement').samparkPurpose).toBe('recognition');
        expect(riyaPurposeSpec('absence_notice').samparkPurpose).toBe('absence_today');
    });
});
