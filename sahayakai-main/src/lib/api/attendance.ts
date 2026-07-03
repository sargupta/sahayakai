/**
 * Typed client for the /api/attendance/* CRUD boundary — tranche 5.
 *
 * Function names and signatures are IDENTICAL to the migrated server actions
 * (src/app/actions/attendance.ts, deleted) so components only change their
 * import path. Errors surface as thrown Error-compatible ApiError whose
 * `message` carries the same strings the actions threw (client code matches
 * on e.g. `err.message === 'PREMIUM_REQUIRED'`).
 */

import { apiFetch } from '@/lib/api/client';
import type {
    ClassRecord, Student, DailyAttendanceRecord,
    ParentOutreach, StudentAttendanceSummary, AttendanceStatus, OutreachReason,
} from '@/types/attendance';
import type { Language, GradeLevel, Subject } from '@/types';
import type { StudentPerformanceSummary } from '@/server/attendance';

export type { StudentPerformanceSummary };

// ── Class Management ──────────────────────────────────────────────────────────

export async function createClassAction(data: {
    name: string;
    subject: Subject;
    gradeLevel: GradeLevel;
    section?: string;
    academicYear: string;
}): Promise<{ classId: string }> {
    return apiFetch('/api/attendance/classes', { method: 'POST', body: data });
}

export async function getClassesAction(): Promise<ClassRecord[]> {
    return apiFetch('/api/attendance/classes');
}

export async function getClassAction(classId: string): Promise<ClassRecord | null> {
    return apiFetch(`/api/attendance/classes/${encodeURIComponent(classId)}`);
}

export async function updateClassAction(classId: string, data: {
    name?: string;
    subject?: Subject;
    gradeLevel?: GradeLevel;
    section?: string;
}): Promise<void> {
    await apiFetch(`/api/attendance/classes/${encodeURIComponent(classId)}`, { method: 'PATCH', body: data });
}

export async function deleteClassAction(classId: string): Promise<void> {
    await apiFetch(`/api/attendance/classes/${encodeURIComponent(classId)}`, { method: 'DELETE' });
}

// ── Student Management ────────────────────────────────────────────────────────

export async function addStudentAction(classId: string, data: {
    name: string;
    rollNumber: number;
    parentPhone: string;
    parentLanguage: Language;
}): Promise<{ studentId: string }> {
    return apiFetch(`/api/attendance/classes/${encodeURIComponent(classId)}/students`, { method: 'POST', body: data });
}

export async function getStudentsAction(classId: string): Promise<Student[]> {
    return apiFetch(`/api/attendance/classes/${encodeURIComponent(classId)}/students`);
}

export async function updateStudentAction(classId: string, studentId: string, data: {
    name?: string;
    rollNumber?: number;
    parentPhone?: string;
    parentLanguage?: Language;
}): Promise<void> {
    await apiFetch(
        `/api/attendance/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
        { method: 'PATCH', body: data },
    );
}

export async function deleteStudentAction(classId: string, studentId: string): Promise<void> {
    await apiFetch(
        `/api/attendance/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
        { method: 'DELETE' },
    );
}

// ── Attendance Recording ──────────────────────────────────────────────────────

export async function saveAttendanceAction(
    classId: string,
    date: string,  // YYYY-MM-DD
    records: Record<string, AttendanceStatus>,
): Promise<void> {
    await apiFetch(`/api/attendance/classes/${encodeURIComponent(classId)}/records`, {
        method: 'POST',
        body: { date, records },
    });
}

export async function getAttendanceForDateAction(
    classId: string,
    date: string,
): Promise<DailyAttendanceRecord | null> {
    return apiFetch(
        `/api/attendance/classes/${encodeURIComponent(classId)}/records?date=${encodeURIComponent(date)}`,
    );
}

export async function getMonthlyAttendanceAction(
    classId: string,
    year: number,
    month: number,  // 1–12
): Promise<Record<string, DailyAttendanceRecord>> {
    return apiFetch(
        `/api/attendance/classes/${encodeURIComponent(classId)}/records?year=${year}&month=${month}`,
    );
}

// ── Student Attendance Summary ────────────────────────────────────────────────

export async function getStudentSummariesAction(
    classId: string,
    year: number,
    month: number,
): Promise<StudentAttendanceSummary[]> {
    return apiFetch(
        `/api/attendance/classes/${encodeURIComponent(classId)}/summaries?year=${year}&month=${month}`,
    );
}

// ── Parent Outreach ───────────────────────────────────────────────────────────

export async function saveOutreachRecordAction(data: {
    classId: string;
    className: string;
    studentId: string;
    studentName: string;
    parentPhone: string;
    parentLanguage: Language;
    reason: OutreachReason;
    teacherNote?: string;
    generatedMessage: string;
    deliveryMethod: 'twilio_call' | 'whatsapp_copy';
    performanceContext?: import('@/types/attendance').PerformanceContext;
}): Promise<{ outreachId: string }> {
    return apiFetch('/api/attendance/outreach-records', { method: 'POST', body: data });
}

export async function getOutreachHistoryAction(
    classId: string,
    studentId?: string,
): Promise<ParentOutreach[]> {
    const params = new URLSearchParams({ classId });
    if (studentId) params.set('studentId', studentId);
    return apiFetch(`/api/attendance/outreach-records?${params.toString()}`);
}

// ── Twilio config check ───────────────────────────────────────────────────────

export async function getTwilioConfigStatusAction(): Promise<{ configured: boolean }> {
    return apiFetch('/api/attendance/twilio-config');
}

// ── Outreach triage helpers ───────────────────────────────────────────────────

export async function getStudentAbsenceDatesAction(
    classId: string,
    studentId: string,
    limitDays: number = 30,
): Promise<string[]> {
    return apiFetch(
        `/api/attendance/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}/absences?limitDays=${limitDays}`,
    );
}

export async function getClassPerformanceSummariesAction(
    classId: string,
): Promise<StudentPerformanceSummary[]> {
    return apiFetch(`/api/attendance/classes/${encodeURIComponent(classId)}/performance`);
}

export async function getStudentsWithRecentBehavioralOutreachAction(
    classId: string,
    lookbackDays: number = 30,
): Promise<string[]> {
    return apiFetch(
        `/api/attendance/classes/${encodeURIComponent(classId)}/behavioral-outreach?lookbackDays=${lookbackDays}`,
    );
}
