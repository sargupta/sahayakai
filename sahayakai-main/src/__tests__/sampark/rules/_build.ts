/**
 * Synthetic-signal builders for the rules tests. Not a test file.
 * Calendar: 2026-09-30 is a Wednesday and "today" for every test.
 */

import type { AssessmentScore, AttendanceMark, CrmSignals, FeeDue, HpcNote } from '@/lib/sampark/rules/signals';
import { emptySignals } from '@/lib/sampark/rules/signals';
import type { SamparkStudent } from '@/types/sampark';

import { ORG } from './_fixture';

export function stu(id: string, over: Partial<SamparkStudent> = {}): SamparkStudent {
    return {
        orgId: ORG,
        id,
        grade: 7,
        section: 'B',
        spokenFirstName: { English: id, Hindi: id, Bengali: id, Nepali: id },
        displayName: `Student ${id}`,
        feeCategory: 'regular',
        sensitiveFlags: [],
        boarding: false,
        transportRoute: null,
        guardianIds: [`g-${id}`],
        active: true,
        crmUpdatedAt: '2026-09-01T00:00:00.000Z',
        importedAt: '2026-09-01T00:00:00.000Z',
        ...over,
    };
}

/** School days (Mon-Fri) ending on `end`, oldest first. */
export function schoolDays(count: number, end = '2026-09-30'): string[] {
    const out: string[] = [];
    let d = new Date(`${end}T00:00:00Z`);
    while (out.length < count) {
        const wd = d.getUTCDay();
        if (wd !== 0 && wd !== 6) out.unshift(d.toISOString().slice(0, 10));
        d = new Date(d.getTime() - 86_400_000);
    }
    return out;
}

type MarkSpec = AttendanceMark['status'] | { status: AttendanceMark['status']; leaveNote: boolean };

export function marks(studentId: string, days: string[], pattern: (i: number, date: string) => MarkSpec): AttendanceMark[] {
    return days.map((date, i) => {
        const p = pattern(i, date);
        const o = typeof p === 'string' ? { status: p, leaveNote: false } : p;
        return { studentId, date, status: o.status, leaveNote: o.leaveNote };
    });
}

export function note(id: string, studentId: string, over: Partial<HpcNote> = {}): HpcNote {
    return {
        id,
        studentId,
        observedOn: '2026-09-28',
        respondentType: 'teacher',
        sentiment: 'neutral',
        note: 'a note',
        confidential: false,
        reasonCode: null,
        unitId: null,
        ability: null,
        rubric: null,
        ...over,
    };
}

export function score(studentId: string, assessmentId: string, date: string, pct: number | null, subjectId = 'maths'): AssessmentScore {
    return {
        studentId,
        assessmentId,
        assessmentName: assessmentId,
        subjectId,
        date,
        maxMarks: 100,
        marks: pct,
        status: pct === null ? 'absent' : 'scored',
    };
}

export function due(id: string, studentId: string, dueDate: string, amountRupees = 12500, status: FeeDue['status'] = 'open'): FeeDue {
    return { id, studentId, dueDate, amountRupees, status, label: 'Second instalment' };
}

export function signals(over: Partial<CrmSignals> = {}): CrmSignals {
    return { ...emptySignals(), ...over };
}
