/**
 * The progress rules A1–A5 (plan §2A). Pure and deterministic: the same
 * students, signals, thresholds and clock always give the same drafts, in the
 * same order (students sorted by id).
 *
 * These evaluators are exported for the engine (which runs them only for rules
 * a school has ADOPTED) and for the backtest (which runs them on proposed
 * thresholds to show what WOULD have been flagged). Nothing else may call them:
 * a class-gate test scans for it, so "rules are inert until adopted" cannot be
 * bypassed by a new caller.
 *
 * Shared principles:
 *  - Every draft carries EVIDENCE: what data triggered it.
 *  - A child who triggers a rule but is suppressed (sensitive flag, counsellor,
 *    open wellbeing matter, left school) yields an ExcludedChild with a plain
 *    reason instead of a draft. A child who does not trigger yields nothing.
 *  - Nurse/counsellor/confidential notes never reach a rule (usableNotes).
 *  - Concern purposes (A1, A3, A4) draft a REQUEST TO TALK; no field of a draft
 *    is ever spoken to the parent. Evidence is for the approver only.
 */

import { addDays, istParts, istInstant } from '@/lib/sampark/policy/ist';
import type { SamparkStudent } from '@/types/sampark';

import { excluded, suppressionFor } from './eligibility';
import {
    SUPPORT_RESPONDENT_TYPES,
    TEACHING_RESPONDENT_TYPES,
    daysBetween,
    usableNotes,
    type AssessmentScore,
    type AttendanceMark,
    type CrmSignals,
    type HpcNote,
} from './signals';
import type {
    AbsenceTodayThresholds,
    AcademicThresholds,
    AttendanceThresholds,
    ClassConfirmation,
    ConductThresholds,
    EvidenceItem,
    ExcludedChild,
    ProposalDraft,
    RecognitionThresholds,
    RuleId,
} from './types';

export interface RuleOutput {
    drafts: ProposalDraft[];
    excluded: ExcludedChild[];
}

export interface RuleContext {
    asOf: Date;
    /** IST calendar date of asOf. */
    today: string;
    students: readonly SamparkStudent[];
    signals: CrmSignals;
}

export function emptyOutput(): RuleOutput {
    return { drafts: [], excluded: [] };
}

function sortedStudents(ctx: RuleContext): SamparkStudent[] {
    return [...ctx.students].sort((a, b) => a.id.localeCompare(b.id));
}

function sectionOf(s: SamparkStudent) {
    return { grade: s.grade, section: s.section };
}

/** End of the IST day `days` after `from`. */
function endOfDay(from: string, days: number): string {
    return new Date(istInstant(addDays(from, days + 1), 0, 0).getTime() - 1).toISOString();
}

function pct(n: number): string {
    return `${Math.round(n)}%`;
}

function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
    const out = new Map<string, T[]>();
    for (const item of items) {
        const k = key(item);
        const list = out.get(k);
        if (list) list.push(item);
        else out.set(k, [item]);
    }
    return out;
}

// ── A1 attendance ───────────────────────────────────────────────────────────

function classKey(s: Pick<SamparkStudent, 'grade' | 'section'>): string {
    return `${s.grade}|${String(s.section).toUpperCase()}`;
}

export function evaluateAttendance(ctx: RuleContext, th: AttendanceThresholds): RuleOutput {
    const out = emptyOutput();
    const byStudent = groupBy(ctx.signals.attendance, (m) => m.studentId);
    // The school-day calendar of each class = the distinct dates any of its students were marked.
    // A student with NO mark on a calendar day breaks a streak (an unmarked day is not an absence).
    const studentsById = new Map(ctx.students.map((s) => [s.id, s]));
    const calendars = new Map<string, string[]>();
    for (const [studentId, marks] of byStudent) {
        const s = studentsById.get(studentId);
        if (!s) continue;
        const key = classKey(s);
        const set = new Set(calendars.get(key) ?? []);
        for (const m of marks) if (m.date <= ctx.today) set.add(m.date);
        calendars.set(key, [...set].sort());
    }

    for (const student of sortedStudents(ctx)) {
        const marks = new Map<string, AttendanceMark>((byStudent.get(student.id) ?? []).map((m) => [m.date, m]));
        const calendar = calendars.get(classKey(student)) ?? [];
        if (calendar.length === 0 || marks.size === 0) continue;

        // Current streak of unexplained absences ending on the latest school day.
        let streak = 0;
        const streakDates: string[] = [];
        for (let i = calendar.length - 1; i >= 0; i--) {
            const m = marks.get(calendar[i]);
            if (m && m.status === 'absent' && !m.leaveNote) {
                streak++;
                streakDates.push(calendar[i]);
            } else break;
        }
        streakDates.reverse();

        // Session attendance over the school days on record.
        const marked = calendar.filter((d) => marks.has(d));
        const presentDays = marked.filter((d) => {
            const st = marks.get(d)!.status;
            return st === 'present' || st === 'late';
        }).length;
        const sessionPct = marked.length > 0 ? (presentDays / marked.length) * 100 : 100;
        const sessionTriggered = marked.length >= th.minSessionDaysElapsed && sessionPct < th.sessionAttendancePercentBelow;
        const streakTriggered = streak >= th.minConsecutiveAbsentDays;
        if (!streakTriggered && !sessionTriggered) continue;

        const suppress = suppressionFor('attendance_talk', student, ctx.signals);
        if (suppress) {
            out.excluded.push(excluded(student.id, 'attendance_talk', suppress));
            continue;
        }

        const evidence: EvidenceItem[] = [];
        if (streakTriggered) {
            evidence.push({
                kind: 'attendance',
                date: streakDates[streakDates.length - 1],
                text: `Absent ${streak} school days in a row (${streakDates.slice(-8).join(', ')}) with no leave note.`,
            });
        }
        if (sessionTriggered) {
            evidence.push({
                kind: 'attendance',
                date: null,
                text: `Present ${presentDays} of ${marked.length} marked school days (${pct(sessionPct)}), below the ${th.sessionAttendancePercentBelow}% the school adopted. Leave days count as not present.`,
            });
        }
        const trigger = streakTriggered ? `streak:${streakDates[0]}` : `session:${calendar[calendar.length - 1].slice(0, 7)}`;
        out.drafts.push({
            dedupeKey: `attendance_talk:${student.id}:${trigger}`,
            purpose: 'attendance_talk',
            studentId: student.id,
            section: sectionOf(student),
            facts: null,
            summary: streakTriggered
                ? `Absent ${streak} school days in a row`
                : `Attendance ${pct(sessionPct)} over ${marked.length} school days`,
            evidence,
            alreadyKnown: hasOpenMeeting(ctx.signals, student.id, 'attendance'),
            expiresAt: endOfDay(ctx.today, 7),
        });
    }
    return out;
}

function hasOpenMeeting(signals: CrmSignals, studentId: string, reasonCode: string): boolean {
    return signals.meetings.some((m) => m.studentId === studentId && m.reasonCode === reasonCode && (m.status === 'requested' || m.status === 'scheduled'));
}

// ── A2 same-day unexplained absence ─────────────────────────────────────────

/**
 * A2 (plan §2A): absent by `absentByHour` IST with no leave note, and ONLY after
 * the class teacher confirms that no message came through the diary or class
 * group. Without a confirmation for the class-day the child is reported as
 * "awaiting class confirmation" and no draft exists.
 *
 * The class teacher's confirmation is itself the approval ("one tap per class
 * per day"): a draft carries `preApprovedBy`.
 */
export function evaluateAbsenceToday(ctx: RuleContext, th: AbsenceTodayThresholds, confirmations: readonly ClassConfirmation[]): RuleOutput {
    const out = emptyOutput();
    const p = istParts(ctx.asOf);
    if (p.hour < th.absentByHour || p.hour >= th.latestProposalHour) return out;

    const todays = new Map<string, AttendanceMark>();
    for (const m of ctx.signals.attendance) if (m.date === ctx.today) todays.set(m.studentId, m);

    for (const student of sortedStudents(ctx)) {
        const m = todays.get(student.id);
        if (!m || m.status !== 'absent' || m.leaveNote) continue;

        const suppress = suppressionFor('absence_today', student, ctx.signals);
        if (suppress) {
            out.excluded.push(excluded(student.id, 'absence_today', suppress));
            continue;
        }
        const confirmation = confirmations.find(
            (c) => c.date === ctx.today && c.grade === student.grade && c.section.toUpperCase() === String(student.section).toUpperCase(),
        );
        if (!confirmation) {
            out.excluded.push({
                studentId: student.id,
                purpose: 'absence_today',
                code: 'awaiting_class_confirmation',
                plain: `Marked absent today with no leave note. Waiting for the class teacher of ${student.grade}${student.section} to confirm that no message came through the diary or class group.`,
            });
            continue;
        }
        out.drafts.push({
            dedupeKey: `absence_today:${student.id}:${ctx.today}`,
            purpose: 'absence_today',
            studentId: student.id,
            section: sectionOf(student),
            facts: null,
            summary: 'Absent today with no message',
            evidence: [
                { kind: 'attendance', date: ctx.today, text: `Marked absent on ${ctx.today} with no leave note on record.` },
                { kind: 'summary', date: ctx.today, text: `The class teacher confirmed at ${confirmation.confirmedAt} that no message came through the diary or class group.` },
            ],
            alreadyKnown: false,
            expiresAt: endOfDay(ctx.today, 0),
            preApprovedBy: confirmation.confirmedBy,
        });
    }
    return out;
}

// ── A3 academic ─────────────────────────────────────────────────────────────

interface AssessmentAverage {
    assessmentId: string;
    name: string;
    date: string;
    average: number;
}

/** One average per assessment over its SCORED rows. A missed or exempt test is skipped, never scored as zero. */
export function assessmentAverages(rows: readonly AssessmentScore[]): AssessmentAverage[] {
    const byAssessment = groupBy(rows, (r) => r.assessmentId);
    const out: AssessmentAverage[] = [];
    for (const [assessmentId, list] of byAssessment) {
        const scored = list.filter((r) => r.status === 'scored' && r.marks !== null && r.maxMarks > 0);
        if (scored.length === 0) continue;
        const average = scored.reduce((sum, r) => sum + ((r.marks as number) / r.maxMarks) * 100, 0) / scored.length;
        out.push({ assessmentId, name: list[0].assessmentName, date: list.map((r) => r.date).sort()[0], average });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.assessmentId.localeCompare(b.assessmentId));
}

export function evaluateAcademic(ctx: RuleContext, th: AcademicThresholds): RuleOutput {
    const out = emptyOutput();
    const byStudent = groupBy(ctx.signals.assessments.filter((a) => a.date <= ctx.today), (a) => a.studentId);

    for (const student of sortedStudents(ctx)) {
        const averages = assessmentAverages(byStudent.get(student.id) ?? []);
        // Never one test: both shapes need at least two assessments the child actually sat.
        if (averages.length < 2) continue;

        const lastK = averages.slice(-th.minAssessments);
        const lowAverage = lastK.length >= th.minAssessments ? lastK.reduce((s, a) => s + a.average, 0) / lastK.length : null;
        const low = lowAverage !== null && lowAverage < th.averagePercentBelow;

        const need = th.dropAssessments + 1;
        const window = averages.slice(-need);
        let sustainedDrop = false;
        if (window.length === need) {
            const falling = window.every((a, i) => i === 0 || a.average < window[i - 1].average);
            sustainedDrop = falling && window[0].average - window[need - 1].average >= th.minTotalDropPoints;
        }
        if (!low && !sustainedDrop) continue;

        const suppress = suppressionFor('academic_talk', student, ctx.signals);
        if (suppress) {
            out.excluded.push(excluded(student.id, 'academic_talk', suppress));
            continue;
        }
        const evidence: EvidenceItem[] = [];
        if (low && lowAverage !== null) {
            evidence.push({
                kind: 'assessment',
                date: lastK[lastK.length - 1].date,
                text: `Average ${pct(lowAverage)} over the last ${lastK.length} assessments (${lastK.map((a) => `${a.name} ${pct(a.average)}`).join(', ')}), below ${th.averagePercentBelow}%.`,
            });
        }
        if (sustainedDrop) {
            evidence.push({
                kind: 'assessment',
                date: window[need - 1].date,
                text: `Fell across ${need} assessments: ${window.map((a) => `${a.name} ${pct(a.average)}`).join(' → ')}.`,
            });
        }
        evidence.push({ kind: 'summary', date: null, text: 'Averages are over the subjects the child sat. A missed or exempt test is not counted and never scored as zero.' });
        const latest = averages[averages.length - 1];
        out.drafts.push({
            dedupeKey: `academic_talk:${student.id}:${latest.assessmentId}`,
            purpose: 'academic_talk',
            studentId: student.id,
            section: sectionOf(student),
            facts: null,
            summary: sustainedDrop ? `Results fell across ${need} assessments` : `Average ${pct(lowAverage as number)} over ${lastK.length} assessments`,
            evidence,
            alreadyKnown: hasOpenMeeting(ctx.signals, student.id, 'academic_progress'),
            expiresAt: endOfDay(ctx.today, 7),
        });
    }
    return out;
}

// ── A4 conduct ──────────────────────────────────────────────────────────────

function withinDays(date: string, today: string, windowDays: number): boolean {
    const d = daysBetween(date, today);
    return d >= 0 && d < windowDays;
}

export function evaluateConduct(ctx: RuleContext, th: ConductThresholds): RuleOutput {
    const out = emptyOutput();
    const notes = usableNotes(ctx.signals.hpc);
    const byStudent = groupBy(notes, (n) => n.studentId);

    for (const student of sortedStudents(ctx)) {
        const concerns = (byStudent.get(student.id) ?? [])
            .filter((n) => n.sentiment === 'concern' && withinDays(n.observedOn, ctx.today, th.windowDays))
            .sort((a, b) => a.observedOn.localeCompare(b.observedOn) || a.id.localeCompare(b.id));
        if (concerns.length < th.minConcernNotes) continue;
        const teaching = concerns.filter((n) => (TEACHING_RESPONDENT_TYPES as readonly string[]).includes(n.respondentType));
        // Non-teaching staff may SUPPORT a trigger but never cause one.
        if (teaching.length === 0) continue;

        const suppress = suppressionFor('conduct_talk', student, ctx.signals);
        if (suppress) {
            out.excluded.push(excluded(student.id, 'conduct_talk', suppress));
            continue;
        }
        out.drafts.push({
            dedupeKey: `conduct_talk:${student.id}:${teaching[teaching.length - 1].id}`,
            purpose: 'conduct_talk',
            studentId: student.id,
            section: sectionOf(student),
            facts: null,
            summary: `${concerns.length} concern notes in ${th.windowDays} days, ${teaching.length} from a teacher`,
            evidence: concerns.map((n) => noteEvidence(n)),
            alreadyKnown: hasOpenMeeting(ctx.signals, student.id, 'conduct'),
            expiresAt: endOfDay(ctx.today, 7),
        });
    }
    return out;
}

function noteEvidence(n: HpcNote): EvidenceItem {
    const supporting = (SUPPORT_RESPONDENT_TYPES as readonly string[]).includes(n.respondentType);
    return {
        kind: 'note',
        date: n.observedOn,
        source: n.respondentType,
        // Non-confidential staff words, for the approver only. Confidential entries never reach this point.
        text: `${n.respondentType.replace('_', ' ')}${supporting ? ' (supporting only)' : ''}: ${n.note ?? '(no note text)'}`,
    };
}

// ── A5 recognition ──────────────────────────────────────────────────────────

export function evaluateRecognition(ctx: RuleContext, th: RecognitionThresholds): RuleOutput {
    const out = emptyOutput();
    const notes = usableNotes(ctx.signals.hpc);
    const byStudent = groupBy(notes, (n) => n.studentId);

    for (const student of sortedStudents(ctx)) {
        const mine = byStudent.get(student.id) ?? [];
        const positives = mine
            .filter((n) => n.sentiment === 'positive' && withinDays(n.observedOn, ctx.today, th.windowDays))
            .sort((a, b) => a.observedOn.localeCompare(b.observedOn) || a.id.localeCompare(b.id));
        const respondents = new Set(positives.map((n) => n.respondentType));
        const notesTrigger = positives.length >= th.minPositiveNotes && respondents.size >= th.minRespondents;

        // Rubric level-up: the same unit and ability, rated higher than the previous rating, inside the window.
        let levelUp: { note: HpcNote; from: HpcNote } | null = null;
        if (th.rubricLevelUp) {
            const rated = mine.filter((n) => n.rubric && n.ability).sort((a, b) => a.observedOn.localeCompare(b.observedOn) || a.id.localeCompare(b.id));
            const latestByKey = new Map<string, HpcNote>();
            for (const n of rated) {
                const key = `${n.unitId ?? '-'}|${n.ability}`;
                const prev = latestByKey.get(key);
                if (prev && prev.rubric && n.rubric && n.rubric.level > prev.rubric.level && withinDays(n.observedOn, ctx.today, th.windowDays)) {
                    levelUp = { note: n, from: prev };
                }
                latestByKey.set(key, n);
            }
        }
        if (!notesTrigger && !levelUp) continue;

        const suppress = suppressionFor('recognition', student, ctx.signals);
        if (suppress) {
            out.excluded.push(excluded(student.id, 'recognition', suppress));
            continue;
        }
        const evidence: EvidenceItem[] = [];
        if (notesTrigger) {
            evidence.push(
                ...positives.map<EvidenceItem>((n) => ({
                    kind: 'note',
                    date: n.observedOn,
                    source: n.respondentType,
                    text: `${n.respondentType.replace('_', ' ')}: ${n.note ?? '(positive observation)'}`,
                })),
            );
        }
        if (levelUp) {
            evidence.push({
                kind: 'rubric',
                date: levelUp.note.observedOn,
                text: `Moved from ${levelUp.from.rubric!.label} to ${levelUp.note.rubric!.label} (${levelUp.note.ability}).`,
            });
        }
        const anchor = notesTrigger ? positives[positives.length - 1].id : levelUp!.note.id;
        out.drafts.push({
            dedupeKey: `recognition:${student.id}:${anchor}`,
            purpose: 'recognition',
            studentId: student.id,
            section: sectionOf(student),
            facts: null,
            summary: notesTrigger ? `${positives.length} positive notes from ${respondents.size} respondents` : 'Moved up a level on the progress card',
            evidence,
            alreadyKnown: false,
            expiresAt: endOfDay(ctx.today, 7),
            ...(th.autoApprove ? { preApprovedBy: 'auto' } : {}),
        });
    }
    return out;
}

export type ProgressRuleId = Extract<RuleId, 'attendance_talk' | 'absence_today' | 'academic_talk' | 'conduct_talk' | 'recognition'>;
