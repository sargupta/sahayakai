/** @jest-environment node */
/**
 * Riya mapping — the wire contract with the hosted agent and the facts → variables builder.
 *
 * CLASS GATE: the six `call_purpose` ids and fourteen variables are pinned against the
 * agent export (fixtures/riya-agent-contract.json). A renamed purpose, a UI label leaking
 * onto the wire, or a variable the agent reads but we never send fails here, not on a call.
 */

import contract from './fixtures/riya-agent-contract.json';

import { buildRiyaVariables, RiyaFactsSchema, spokenDateList, type RiyaFacts } from '@/lib/sampark/conversation/facts';
import {
    DEFAULT_RIYA_PURPOSES,
    enabledRiyaPurposes,
    RIYA_PURPOSES,
    RIYA_VARIABLES,
    riyaPurposeSpec,
    RiyaPurposeSchema,
    type RiyaPurpose,
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
};

const build = (purpose: RiyaPurpose, facts: RiyaFacts = FACTS[purpose], over: Partial<Parameters<typeof buildRiyaVariables>[0]> = {}) =>
    buildRiyaVariables({ purpose, facts, school: SCHOOL, student: STUDENT, now: WED_11_IST, ...over });

describe('the wire contract with the Riya agent export', () => {
    it('uses exactly the six call_purpose values the workflow edges match', () => {
        expect([...RIYA_PURPOSES].sort()).toEqual(contract.callPurposeEdgeValues);
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

    it('the agent forbids prompt, first-message and voice overrides, so none are sent', () => {
        expect(contract.clientOverridesAllowed).toEqual({ first_message: false, prompt: false, voice_id: false });
    });

    it('rejects any purpose that is not one of the six, including UI labels', () => {
        expect(RiyaPurposeSchema.safeParse('PTM invitation').success).toBe(false);
        expect(RiyaPurposeSchema.safeParse('ptm_invite').success).toBe(false); // the Sampark id, not the agent's
        expect(RiyaPurposeSchema.safeParse('exam_notice').success).toBe(false);
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
    });
});
