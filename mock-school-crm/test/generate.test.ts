import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, isSchoolDay, weekday } from '../src/calendar';
import type { CrmStudent } from '../src/contract/crm-schema';
import { DEFAULT_ANCHOR_DATE, FOUNDATIONAL_DOMAINS, HOLIDAYS, MIDDLE_SUBJECTS, PREPARATORY_SUBJECTS, generateState, stageForGrade } from '../src/generate';
import {
    AssessmentRecordSchema,
    AttendanceRecordSchema,
    HpcEntrySchema,
    IncidentSchema,
    MeetingRequestSchema,
    RESPONDENT_TYPES,
    SchoolEventSchema,
    type HpcEntry,
} from '../src/schemas';
import type { CrmState } from '../src/state';
import { freshState } from './helpers';

const state: CrmState = freshState();
const live = state.students.filter((s) => !s.deleted);
const liveGuardians = state.guardians.filter((g) => !g.deleted);
const share = (n: number, d: number) => (n / d) * 100;

// ── Determinism ──────────────────────────────────────────────────────────────

test('generation is deterministic and never reads Math.random or the wall clock', () => {
    const RealDate = Date;
    const realRandom = Math.random;
    class GuardDate extends RealDate {
        constructor(...args: unknown[]) {
            if (args.length === 0) throw new Error('generator read the wall clock (new Date())');
            super(...(args as [number]));
        }
        static override now(): number {
            throw new Error('generator read the wall clock (Date.now())');
        }
    }
    globalThis.Date = GuardDate as DateConstructor;
    Math.random = () => {
        throw new Error('generator used Math.random');
    };
    let a: string;
    let b: string;
    try {
        a = JSON.stringify(generateState());
        b = JSON.stringify(generateState());
    } finally {
        globalThis.Date = RealDate;
        Math.random = realRandom;
    }
    assert.equal(a, b);
    assert.notEqual(JSON.stringify(generateState({ seed: 'another-seed' }).students), JSON.stringify(state.students));
});

test('the anchor date is validated', () => {
    assert.throws(() => generateState({ anchorDate: '2026-02-30' }));
    assert.throws(() => generateState({ anchorDate: '2025-09-30' }));
    assert.doesNotThrow(() => generateState({ anchorDate: '2026-10-12' }));
});

// ── Roster ───────────────────────────────────────────────────────────────────

test('school: Hillview Demo School, grades 1-10 x A/B, about 20 per class', () => {
    assert.equal(state.school.name, 'Hillview Demo School, Siliguri');
    assert.deepEqual(state.school.rubricScale, { id: 'bpa', labels: ['Beginner', 'Proficient', 'Advanced'] });
    const classes = new Map<string, number>();
    for (const s of live) classes.set(`${s.grade}${s.section}`, (classes.get(`${s.grade}${s.section}`) ?? 0) + 1);
    assert.equal(classes.size, 20);
    for (const [key, n] of classes) assert.ok(n >= 19 && n <= 21, `${key} has ${n}`);
    assert.ok(live.length >= 390 && live.length <= 410, `${live.length} students`);
    for (const s of live) {
        const rolls = live.filter((x) => x.grade === s.grade && x.section === s.section).map((x) => x.rollNo);
        assert.equal(new Set(rolls).size, rolls.length, `duplicate roll numbers in ${s.grade}${s.section}`);
    }
});

test('no product names anywhere in the school data', () => {
    const { planted: _planted, ...data } = state;
    assert.doesNotMatch(JSON.stringify(data), /sampark|sahayak/i);
});

test('guardian languages are ne 40 / bn 25 / hi 20 / en 15, with exactly the 3 planted nulls', () => {
    const count = (code: string | null) => liveGuardians.filter((g) => g.preferredLanguage === code).length;
    const n = liveGuardians.length;
    for (const [code, target] of [['ne', 40], ['bn', 25], ['hi', 20], ['en', 15]] as const) {
        const pct = share(count(code), n);
        assert.ok(Math.abs(pct - target) <= 3, `${code} is ${pct.toFixed(1)}%, target ${target}%`);
    }
    const nulls = state.guardians.filter((g) => g.preferredLanguage === null).map((g) => g.id).sort();
    assert.deepEqual(nulls, [...state.planted.nullLanguageGuardians].sort());
    assert.equal(nulls.length, 3);
});

test('notices consent: ~80% granted, ~12% unknown (null or status unknown), ~8% denied; others mostly null', () => {
    const n = liveGuardians.length;
    const granted = liveGuardians.filter((g) => g.consent.notices?.status === 'granted').length;
    const unknown = liveGuardians.filter((g) => g.consent.notices === null || g.consent.notices.status === 'unknown').length;
    const denied = liveGuardians.filter((g) => g.consent.notices?.status === 'denied').length;
    assert.ok(Math.abs(share(granted, n) - 80) <= 4, `granted ${share(granted, n)}`);
    assert.ok(Math.abs(share(unknown, n) - 12) <= 4, `unknown ${share(unknown, n)}`);
    assert.ok(Math.abs(share(denied, n) - 8) <= 4, `denied ${share(denied, n)}`);
    assert.ok(liveGuardians.some((g) => g.consent.notices === null));
    assert.ok(liveGuardians.some((g) => g.consent.notices?.status === 'unknown'));
    for (const group of ['progress', 'recordedConversation', 'hpcInput'] as const) {
        const nulls = liveGuardians.filter((g) => g.consent[group] === null).length;
        assert.ok(share(nulls, n) >= 85, `${group} should be mostly null`);
    }
});

test('phones: every guardian is +915 + 9 digits, synthetic, unique', () => {
    for (const g of state.guardians) {
        assert.match(g.phone, /^\+915\d{9}$/, g.id);
        assert.equal(g.synthetic, true);
    }
    assert.equal(new Set(state.guardians.map((g) => g.phone)).size, state.guardians.length);
});

test('fee categories, boarding and transport', () => {
    const rte = live.filter((s) => s.feeCategory === 'rte');
    assert.ok(share(rte.length, live.length) >= 3 && share(rte.length, live.length) <= 8, `rte ${share(rte.length, live.length)}%`);
    assert.ok(rte.every((s) => s.grade <= 8), 'RTE applies to classes 1-8');
    for (const cat of ['regular', 'waived', 'scholarship', 'staff_ward'] as const) assert.ok(live.some((s) => s.feeCategory === cat), cat);
    const withRoute = share(live.filter((s) => s.transportRoute !== null).length, live.length);
    assert.ok(withRoute >= 55 && withRoute <= 65, `transport ${withRoute}%`);
    assert.ok(live.every((s) => s.transportRoute === null || /^R[1-6]$/.test(s.transportRoute)));
    const boarders = live.filter((s) => s.boarding);
    assert.ok(boarders.length >= 3 && boarders.length <= 25);
    assert.ok(boarders.every((s) => s.transportRoute === null));
});

test('guardian links: every link resolves, exactly one primary per student', () => {
    const ids = new Set(state.guardians.map((g) => g.id));
    for (const s of state.students) {
        for (const l of s.guardians) assert.ok(ids.has(l.guardianId), `${s.id} → ${l.guardianId}`);
        assert.equal(s.guardians.filter((l) => l.isPrimary).length, 1, `${s.id} primary count`);
    }
});

test('spoken first names are in the right script, and Aarav is আরভ in Bengali', () => {
    for (const s of live) {
        const n = s.spokenFirstName;
        if (n.hi) assert.match(n.hi, /^[ऀ-ॿ ]+$/, `${s.id} hi`);
        if (n.ne) assert.match(n.ne, /^[ऀ-ॿ ]+$/, `${s.id} ne`);
        if (n.bn) assert.match(n.bn, /^[ঀ-৿ ]+$/, `${s.id} bn`);
        if (n.en) assert.match(n.en, /^[A-Za-z ]+$/, `${s.id} en`);
        if (n.en === 'Aarav') {
            if (n.bn) assert.equal(n.bn, 'আরভ');
            if (n.hi) assert.equal(n.hi, 'आरव');
        }
    }
    assert.ok(!JSON.stringify(state.students).includes('আরব'), 'আরব reads "Arab"');
});

// ── Planted cases ────────────────────────────────────────────────────────────

const student = (id: string): CrmStudent => {
    const s = state.students.find((x) => x.id === id);
    assert.ok(s, `student ${id}`);
    return s;
};

test('planted: siblings in different grades share both guardians', () => {
    const [a, b] = state.planted.siblings.studentIds.map(student) as [CrmStudent, CrmStudent];
    assert.notEqual(a.grade, b.grade);
    const ids = (s: CrmStudent) => s.guardians.map((l) => l.guardianId).sort();
    assert.deepEqual(ids(a), ids(b));
    assert.equal(ids(a).length, 2);
    assert.ok([...a.guardians, ...b.guardians].every((l) => l.isGuardianOfRecord));
});

test('planted: blended family, step-parent is not the step-child\'s guardian of record', () => {
    const p = state.planted.blendedFamily;
    const step = student(p.stepChildId);
    const joint = student(p.jointChildId);
    const stepLink = step.guardians.find((l) => l.guardianId === p.stepParentId);
    assert.deepEqual(stepLink, { guardianId: p.stepParentId, isPrimary: false, isGuardianOfRecord: false });
    assert.ok(joint.guardians.find((l) => l.guardianId === p.stepParentId)?.isGuardianOfRecord);
    assert.ok(step.guardians.find((l) => l.guardianId === p.motherId)?.isGuardianOfRecord);
});

test('planted: sensitive flags, do-not-contact, left, tombstones', () => {
    assert.deepEqual(student(state.planted.counsellorReferral.studentId).sensitiveFlags, ['counsellor_referral']);
    assert.deepEqual(student(state.planted.custodyRestriction.studentId).sensitiveFlags, ['custody_restriction']);
    assert.equal(live.filter((s) => s.sensitiveFlags.length > 0).length, 2);
    const dnc = state.guardians.filter((g) => g.doNotContact);
    assert.deepEqual(dnc.map((g) => g.id), [state.planted.doNotContactGuardian.guardianId]);
    assert.equal(student(state.planted.leftStudent.studentId).status, 'left');
    const recent = Date.parse(`${addDays(DEFAULT_ANCHOR_DATE, -3)}T00:00:00+05:30`);
    for (const id of state.planted.tombstones.studentIds) {
        const s = student(id);
        assert.equal(s.deleted, true);
        assert.ok(Date.parse(s.updatedAt) >= recent, `${id} updated recently`);
    }
    assert.equal(state.students.filter((s) => s.deleted).length, 2);
    const deletedGuardians = state.guardians.filter((g) => g.deleted);
    assert.deepEqual(deletedGuardians.map((g) => g.id), state.planted.tombstones.guardianIds);
    // A deleted guardian is only referenced by deleted students.
    for (const g of deletedGuardians) {
        for (const s of state.students.filter((x) => x.guardians.some((l) => l.guardianId === g.id))) assert.equal(s.deleted, true);
    }
});

test('planted: some spoken names are missing, a quoted guardian name exists', () => {
    assert.ok(state.planted.missingSpokenNames.length >= 3);
    for (const m of state.planted.missingSpokenNames) {
        const s = student(m.studentId);
        for (const lang of m.missing) assert.equal(s.spokenFirstName[lang as 'en'], undefined);
    }
    assert.match(state.planted.csvQuotingGuardian.fullName, /"/);
});

test('planted cases live in grades 4 and 7 (so the fixture subset carries them)', () => {
    const p = state.planted;
    const ids = [
        ...p.siblings.studentIds,
        p.blendedFamily.stepChildId,
        p.blendedFamily.jointChildId,
        p.counsellorReferral.studentId,
        p.custodyRestriction.studentId,
        p.doNotContactGuardian.studentId,
        p.leftStudent.studentId,
        ...p.tombstones.studentIds,
        ...p.plantedRteStudents,
        p.attendance.absenceStreak.studentId,
        p.attendance.lowAttendance.studentId,
        p.assessments.sustainedDrop.studentId,
        p.assessments.missedTest.studentId,
        ...Object.values(p.hpc).map((h) => h.studentId),
    ];
    for (const id of ids) assert.ok([4, 7].includes(student(id).grade), `${id} is in grade ${student(id).grade}`);
});

// ── Holistic progress card ───────────────────────────────────────────────────

test('HPC entries: ~3000, valid, NCERT stage structure, all respondent types', () => {
    const entries = state.hpcEntries;
    assert.ok(entries.length >= 2500 && entries.length <= 3500, `${entries.length} entries`);
    const byStudent = new Map(state.students.map((s) => [s.id, s]));
    for (const e of entries) {
        const r = HpcEntrySchema.safeParse(e);
        assert.ok(r.success, `${e.id}: ${r.success ? '' : JSON.stringify(r.error.issues)}`);
        const s = byStudent.get(e.studentId);
        assert.ok(s, e.studentId);
        assert.equal(e.stage, stageForGrade(s.grade));
        if (e.unit) {
            const expected = { foundational: 'domain', preparatory: 'subject', middle: 'subject', secondary: 'project' }[e.stage];
            assert.equal(e.unit.kind, expected, `${e.id} unit kind`);
        }
        if (e.rubric) assert.equal(e.rubric.scaleId, 'bpa');
        if (e.respondent.type === 'teacher' || ['bus_attendant', 'coach', 'librarian'].includes(e.respondent.type)) {
            assert.ok(typeof e.note === 'string' && e.note.length > 0, `${e.id} has a note`);
        }
        if (['self', 'peer', 'parent'].includes(e.respondent.type)) assert.equal(e.note, null);
    }
    assert.equal(FOUNDATIONAL_DOMAINS.length, 6);
    assert.equal(PREPARATORY_SUBJECTS.length, 6);
    assert.equal(MIDDLE_SUBJECTS.length, 9);
    for (const type of RESPONDENT_TYPES) assert.ok(entries.some((e) => e.respondent.type === type), `respondent ${type}`);
    for (const stage of ['foundational', 'preparatory', 'middle', 'secondary']) assert.ok(entries.some((e) => e.stage === stage));
    for (const e of entries.filter((x) => x.confidential)) {
        assert.equal(e.note, null);
        assert.ok(e.reasonCode);
    }
});

/** Plan §2A rule shapes, evaluated over the 14 days ending on the anchor. */
function windowEntries(studentId: string): HpcEntry[] {
    const from = addDays(state.anchorDate, -13);
    return state.hpcEntries.filter((e) => e.studentId === studentId && e.observedOn >= from && e.observedOn <= state.anchorDate);
}
const TEACHING = new Set(['teacher']);
const a4Fires = (id: string) => {
    const concerns = windowEntries(id).filter((e) => e.sentiment === 'concern' && !e.confidential);
    return concerns.length >= 2 && concerns.some((e) => TEACHING.has(e.respondent.type));
};
const a5Fires = (id: string) => {
    const positives = windowEntries(id).filter((e) => e.sentiment === 'positive');
    return positives.length >= 2 && new Set(positives.map((e) => e.respondent.type)).size >= 2;
};

test('HPC plants: exactly the planted students satisfy the 14-day conduct and recognition shapes', () => {
    const p = state.planted.hpc;
    assert.equal(a4Fires(p.conductShouldTrigger.studentId), true);
    assert.equal(a4Fires(p.staffOnlyMustNotTrigger.studentId), false);
    assert.equal(windowEntries(p.staffOnlyMustNotTrigger.studentId).filter((e) => e.sentiment === 'concern').length, 2);
    assert.equal(a5Fires(p.positiveRecognition.studentId), true);
    const others = live.filter((s) => ![p.conductShouldTrigger.studentId, p.positiveRecognition.studentId].includes(s.id));
    assert.deepEqual(others.filter((s) => a4Fires(s.id) || a5Fires(s.id)).map((s) => s.id), []);
    const counsellor = state.hpcEntries.find((e) => e.id === p.counsellorConfidential.entryIds[0]);
    assert.equal(counsellor?.confidential, true);
    assert.equal(counsellor?.note, null);
});

// ── Attendance, assessments, events, meetings, incidents ────────────────────

test('attendance: last 30 school days, valid, with a current 4-day streak in grade 4', () => {
    const offDays = new Set([...HOLIDAYS.map((h) => h.date), ...state.events.filter((e) => e.kind === 'closure').map((e) => e.date)]);
    const dates = [...new Set(state.attendance.map((r) => r.date))].sort();
    assert.equal(dates.length, 30);
    assert.equal(dates[dates.length - 1], state.anchorDate);
    for (const d of dates) assert.ok(isSchoolDay(d, offDays), `${d} (weekday ${weekday(d)}) is not a school day`);
    for (const r of state.attendance.slice(0, 500)) assert.ok(AttendanceRecordSchema.safeParse(r).success, r.id);

    const { studentId, dates: streak } = state.planted.attendance.absenceStreak;
    assert.equal(student(studentId).grade, 4);
    assert.deepEqual(streak, dates.slice(-4));
    const mine = state.attendance.filter((r) => r.studentId === studentId).sort((x, y) => (x.date < y.date ? -1 : 1));
    assert.deepEqual(mine.slice(-4).map((r) => r.status), ['absent', 'absent', 'absent', 'absent']);
    assert.ok(mine.slice(-4).every((r) => !r.leaveNote));
    assert.notEqual(mine[mine.length - 5]?.status, 'absent');

    // Nobody else ends on a current streak of 3+.
    const byStudent = new Map<string, string[]>();
    for (const r of [...state.attendance].sort((x, y) => (x.date < y.date ? -1 : 1))) {
        const list = byStudent.get(r.studentId) ?? [];
        list.push(r.status);
        byStudent.set(r.studentId, list);
    }
    for (const [id, statuses] of byStudent) {
        if (id === studentId || id === state.planted.leftStudent.studentId) continue;
        assert.ok(!statuses.slice(-3).every((st) => st === 'absent'), `${id} has an unplanted streak`);
    }
    assert.ok(state.planted.attendance.lowAttendance.presentRate < 0.75);
});

test('assessments: valid; a sustained drop; a missed test is null, never zero', () => {
    for (const r of state.assessments) assert.ok(AssessmentRecordSchema.safeParse(r).success, r.id);
    const { PT1, PT2, HY } = state.planted.assessments.sustainedDrop.averages as Record<string, number>;
    assert.ok(PT1 !== undefined && PT2 !== undefined && HY !== undefined);
    assert.ok(PT1 > PT2 && PT2 > HY && HY < 45, JSON.stringify({ PT1, PT2, HY }));
    const missed = state.assessments.filter((r) => r.studentId === state.planted.assessments.missedTest.studentId && r.assessmentId === 'PT2');
    assert.ok(missed.length > 0);
    assert.ok(missed.every((r) => r.status === 'absent' && r.marks === null));
    assert.ok(state.assessments.every((r) => r.status === 'scored' || r.marks === null));
});

test('events: PTM for 7B on 2026-10-10 10:00 in the school hall, annual day, a closure', () => {
    for (const e of state.events) assert.ok(SchoolEventSchema.safeParse(e).success, e.id);
    const ptm = state.events.find((e) => e.id === state.planted.events.ptm7B);
    assert.deepEqual(
        ptm && { kind: ptm.kind, date: ptm.date, startTime: ptm.startTime, venueId: ptm.venueId, audience: ptm.audience },
        { kind: 'ptm', date: '2026-10-10', startTime: '10:00', venueId: 'school_hall', audience: { kind: 'sections', sections: [{ grade: 7, section: 'B' }] } },
    );
    assert.equal(state.events.find((e) => e.id === state.planted.events.annualDay)?.kind, 'annual_day');
    assert.equal(state.events.find((e) => e.id === state.planted.events.closure)?.closure?.emergency, true);
});

test('meetings and incidents: valid, reason codes only, never note text', () => {
    for (const m of state.meetings) assert.ok(MeetingRequestSchema.safeParse(m).success, m.id);
    assert.ok(state.meetings.some((m) => m.id === state.planted.meetings.sustainedDropRequest && m.reasonCode === 'academic_progress'));
    assert.ok(state.incidents.length >= 20);
    for (const i of state.incidents) {
        assert.ok(IncidentSchema.safeParse(i).success, i.id);
        assert.ok(!('note' in i) && !('text' in i) && !('description' in i));
    }
    assert.equal(IncidentSchema.safeParse({ ...state.incidents[0], note: 'x' }).success, false, 'the schema rejects note text');
});
