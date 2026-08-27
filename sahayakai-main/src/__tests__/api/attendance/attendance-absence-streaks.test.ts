/**
 * Absence-streak semantics — the "we told a parent their child is absent
 * right now, and the child was in class" regression.
 *
 * `getStudentSummaries` used to publish ONE number, `consecutiveAbsences`,
 * computed as the month's high-water mark (`Math.max(...)`) but documented and
 * rendered as "current streak". A child absent Mon–Wed and present every day
 * since still scored 3, so the triage banner listed them, the roster line said
 * "3 absent in a row", and the modal shipped `consecutiveAbsentDays: 3` into
 * the parent-call script — which reads it out in the present tense.
 *
 * The fix splits the two meanings apart by name:
 *   currentAbsenceStreak  — trailing run, may be spoken in the present tense
 *   longestAbsenceStreak  — month high-water mark, retrospective reporting only
 *
 * The fixtures below deliberately give students where the two numbers DIFFER;
 * a single-number implementation cannot satisfy them.
 */

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: {
        getUser: jest.fn(async () => ({ planType: 'pro' })),
        serialize: (x: unknown) => x,
    },
}));

jest.mock('@/lib/plan-utils', () => ({
    hasAdvancedPlan: () => true,
}));

// ── In-memory firestore double ──────────────────────────────────────────────
//
// Only the read path getStudentSummaries walks: one class doc, its students
// subcollection (ordered by roll), and the class's attendance records filtered
// to the requested month.

interface FakeStudent { id: string; name: string; rollNumber: number }

const UID = 'teacher-A';
const CLASS_ID = 'c1';

let fakeStudents: FakeStudent[] = [];
/** date (YYYY-MM-DD) → studentId → status */
let fakeRecords: Record<string, Record<string, string>> = {};

const snapOf = (docs: Array<{ id: string; data: () => unknown }>) => ({ docs });

jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({
        collection: (coll: string) => ({
            doc: (id: string) => {
                if (coll === 'classes') {
                    return {
                        get: async () => ({ exists: id === CLASS_ID, data: () => ({ teacherUid: UID }) }),
                        collection: () => ({
                            orderBy: () => ({
                                get: async () => snapOf(
                                    [...fakeStudents]
                                        .sort((a, b) => a.rollNumber - b.rollNumber)
                                        .map((s) => ({ id: s.id, data: () => ({ name: s.name, rollNumber: s.rollNumber }) })),
                                ),
                            }),
                        }),
                    };
                }
                if (coll === 'attendance') {
                    // .where('date','>=',start).where('date','<',nextMonth).get()
                    const bounds: Array<[string, string]> = [];
                    const query = {
                        where: (_field: string, op: string, value: string) => {
                            bounds.push([op, value]);
                            return query;
                        },
                        get: async () => {
                            const lo = bounds.find(([op]) => op === '>=')?.[1] ?? '';
                            const hi = bounds.find(([op]) => op === '<')?.[1] ?? '9999-99-99';
                            return snapOf(
                                Object.keys(fakeRecords)
                                    .filter((date) => date >= lo && date < hi)
                                    .map((date) => ({ id: date, data: () => ({ date, records: fakeRecords[date] }) })),
                            );
                        },
                    };
                    return { collection: () => query };
                }
                return {};
            },
        }),
    }),
}));

// ── Fixture ─────────────────────────────────────────────────────────────────
//
// June 2026, ten marked school days (Mon–Fri of the first two weeks).

const SCHOOL_DAYS = [
    '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05',
    '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12',
];

/** 'A' = absent, 'P' = present, 'L' = late — one character per school day. */
const ROSTER: Array<{ id: string; name: string; rollNumber: number; pattern: string }> = [
    // The reported bug: a 3-day run early in the month, back in class ever
    // since. Max streak 3, current streak 0.
    { id: 's1', name: 'Asha',    rollNumber: 1, pattern: 'AAAPPPPPPP' },
    // A longer run that ended, plus a live run at the month's edge.
    // Max streak 4, current streak 2.
    { id: 's2', name: 'Bikram',  rollNumber: 2, pattern: 'AAAAPPPPAA' },
    // Never absent. Both numbers 0.
    { id: 's3', name: 'Chandan', rollNumber: 3, pattern: 'PPPPPPPPPP' },
    // Absent throughout — the one case where the two numbers legitimately agree.
    { id: 's4', name: 'Dipa',    rollNumber: 4, pattern: 'AAAAAAAAAA' },
    // A late day breaks a run exactly like a present day does.
    // Max streak 2, current streak 0.
    { id: 's5', name: 'Esha',    rollNumber: 5, pattern: 'AAPPPPPPPL' },
];

const STATUS: Record<string, string> = { A: 'absent', P: 'present', L: 'late' };

function loadFixture() {
    fakeStudents = ROSTER.map(({ id, name, rollNumber }) => ({ id, name, rollNumber }));
    fakeRecords = {};
    SCHOOL_DAYS.forEach((date, i) => {
        fakeRecords[date] = {};
        for (const student of ROSTER) {
            fakeRecords[date][student.id] = STATUS[student.pattern[i]];
        }
    });
}

const byName = (rows: Array<{ studentName: string }>, name: string) =>
    rows.find((r) => r.studentName === name)!;

describe('getStudentSummaries — current vs longest absence streak', () => {
    beforeEach(loadFixture);

    it('sanity: the fixture patterns line up with the marked school days', () => {
        for (const student of ROSTER) {
            expect(student.pattern).toHaveLength(SCHOOL_DAYS.length);
        }
    });

    it('reports a healed 3-day run as 0 current / 3 longest', async () => {
        const { getStudentSummaries } = await import('@/server/attendance');
        const asha = byName(await getStudentSummaries(UID, CLASS_ID, 2026, 6), 'Asha');

        // The bug: this was 3, and 3 is what got read out to Asha's parent.
        expect(asha.currentAbsenceStreak).toBe(0);
        expect(asha.longestAbsenceStreak).toBe(3);
        expect(asha.absentDays).toBe(3);
    });

    it('reports a live run at the month edge separately from a longer healed run', async () => {
        const { getStudentSummaries } = await import('@/server/attendance');
        const bikram = byName(await getStudentSummaries(UID, CLASS_ID, 2026, 6), 'Bikram');

        expect(bikram.currentAbsenceStreak).toBe(2);
        expect(bikram.longestAbsenceStreak).toBe(4);
        expect(bikram.absentDays).toBe(6);
    });

    it('treats a late day as breaking the run, same as a present day', async () => {
        const { getStudentSummaries } = await import('@/server/attendance');
        const esha = byName(await getStudentSummaries(UID, CLASS_ID, 2026, 6), 'Esha');

        expect(esha.currentAbsenceStreak).toBe(0);
        expect(esha.longestAbsenceStreak).toBe(2);
    });

    it('leaves both numbers at 0 for a student with perfect attendance', async () => {
        const { getStudentSummaries } = await import('@/server/attendance');
        const chandan = byName(await getStudentSummaries(UID, CLASS_ID, 2026, 6), 'Chandan');

        expect(chandan.currentAbsenceStreak).toBe(0);
        expect(chandan.longestAbsenceStreak).toBe(0);
    });

    it('agrees on both numbers when the student never came back', async () => {
        const { getStudentSummaries } = await import('@/server/attendance');
        const dipa = byName(await getStudentSummaries(UID, CLASS_ID, 2026, 6), 'Dipa');

        expect(dipa.currentAbsenceStreak).toBe(10);
        expect(dipa.longestAbsenceStreak).toBe(10);
    });

    it('flags only students who are absent NOW for parent outreach', async () => {
        const { getStudentSummaries } = await import('@/server/attendance');
        const summaries = await getStudentSummaries(UID, CLASS_ID, 2026, 6);

        // The >= 2 bar the class page uses to build the "needs outreach today"
        // triage group. Asha and Esha are back in class; they must not appear.
        const flagged = summaries
            .filter((s) => s.currentAbsenceStreak >= 2)
            .map((s) => s.studentName)
            .sort();
        expect(flagged).toEqual(['Bikram', 'Dipa']);

        // Against the month's high-water mark, four of five students would be
        // called — this is the list the bug produced.
        const wouldHaveBeenFlagged = summaries
            .filter((s) => s.longestAbsenceStreak >= 2)
            .map((s) => s.studentName)
            .sort();
        expect(wouldHaveBeenFlagged).toEqual(['Asha', 'Bikram', 'Dipa', 'Esha']);
    });
});

// ── Source-level guard ──────────────────────────────────────────────────────
//
// The behavioural tests above pin the computation. This pins the wiring: the
// class of bug is a retrospective number reaching a present-tense consumer,
// and the consumers are React components whose full mount drags in Firebase
// auth, the language context, and fetch. Reading the source is the cheap way
// to keep the two numbers from being swapped back.

import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (rel: string) => readFileSync(resolve(__dirname, '../../../', rel), 'utf8');

describe('outreach path reads the CURRENT streak, never the month high-water mark', () => {
    it('the contact-parent modal sends the current streak to the call script', () => {
        const source = read('components/attendance/contact-parent-modal.tsx');
        expect(source).toMatch(/consecutiveAbsentDays:\s*currentAbsenceStreak/);
        expect(source).not.toMatch(/longestAbsenceStreak/);
    });

    it('the class page triages and labels on the current streak only', () => {
        const source = read('app/attendance/[classId]/page.tsx');
        expect(source).toMatch(/currentAbsenceStreak/);
        expect(source).not.toMatch(/longestAbsenceStreak/);
    });

    it('the summary type no longer carries the ambiguous single name', () => {
        // `consecutiveAbsences` read as "current" and computed as "max". No
        // field may go back to carrying both meanings under one name.
        const source = read('types/attendance.ts');
        expect(source).not.toMatch(/consecutiveAbsences/);
        expect(source).toMatch(/currentAbsenceStreak:\s*number/);
        expect(source).toMatch(/longestAbsenceStreak:\s*number/);
    });
});
