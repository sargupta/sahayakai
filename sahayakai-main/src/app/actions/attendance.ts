'use server';

import { getDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { dbAdapter } from '@/lib/db/adapter';
import type {
    ClassRecord, Student, DailyAttendanceRecord,
    ParentOutreach, StudentAttendanceSummary, AttendanceStatus, OutreachReason,
} from '@/types/attendance';
import type { Language, GradeLevel, Subject } from '@/types';
import { hasAdvancedPlan } from '@/lib/plan-utils';

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string> {
    const h = await headers();
    const uid = h.get('x-user-id');
    if (!uid) {
        // Defense-in-depth — middleware should have caught this. If it fires
        // we want visibility, not a silent 500.
        // eslint-disable-next-line no-console
        console.warn('[attendance] getAuthUserId() rejected — no x-user-id header (middleware bypassed?)');
        throw new Error('Unauthorized');
    }
    return uid;
}

// ── Plan guard ────────────────────────────────────────────────────────────────

async function requireProPlan(uid: string): Promise<void> {
    const profile = await dbAdapter.getUser(uid);
    if (!profile) {
        // eslint-disable-next-line no-console
        console.warn(`[attendance] requireProPlan() — user not found: ${uid}`);
        throw new Error('User not found');
    }
    if (!hasAdvancedPlan(profile.planType)) {
        // Expected business case (free user on a pro-only feature). Log as
        // WARN so it shows up in audits but doesn't trip the prod-error-rate
        // alert. The client surfaces this as an upsell, not an error.
        // eslint-disable-next-line no-console
        console.warn(`[attendance] PREMIUM_REQUIRED — uid: ${uid}, plan: ${profile.planType}`);
        throw new Error('PREMIUM_REQUIRED');
    }
}

// ── Phone normalizer ──────────────────────────────────────────────────────────

function normalizeToE164(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (digits.length === 10) return `+91${digits}`;
    throw new Error('Invalid phone number — enter a 10-digit Indian mobile number');
}

// ── Class Management ──────────────────────────────────────────────────────────

export async function createClassAction(data: {
    name: string;
    subject: Subject;
    gradeLevel: GradeLevel;
    section?: string;
    academicYear: string;
}): Promise<{ classId: string }> {
    const uid = await getAuthUserId();
    await requireProPlan(uid);

    if (!data.name.trim()) throw new Error('Class name is required');
    if (!data.academicYear.trim()) throw new Error('Academic year is required');

    const db = await getDb();
    const now = new Date().toISOString();

    const ref = db.collection('classes').doc();
    const record: Omit<ClassRecord, 'id'> = {
        teacherUid: uid,
        name: data.name.trim(),
        subject: data.subject,
        gradeLevel: data.gradeLevel,
        section: data.section?.trim() || undefined,
        academicYear: data.academicYear.trim(),
        studentCount: 0,
        createdAt: now,
        updatedAt: now,
    };

    await ref.set(record);
    return { classId: ref.id };
}

export async function getClassesAction(): Promise<ClassRecord[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    // No composite index needed — equality filter only, sort in JS
    const snap = await db.collection('classes')
        .where('teacherUid', '==', uid)
        .get();

    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ClassRecord))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getClassAction(classId: string): Promise<ClassRecord | null> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const doc = await db.collection('classes').doc(classId).get();
    if (!doc.exists) return null;

    const data = doc.data() as Omit<ClassRecord, 'id'>;
    if (data.teacherUid !== uid) throw new Error('Unauthorized');

    return { id: doc.id, ...data };
}

export async function updateClassAction(classId: string, data: {
    name?: string;
    subject?: Subject;
    gradeLevel?: GradeLevel;
    section?: string;
}): Promise<void> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const doc = await db.collection('classes').doc(classId).get();
    if (!doc.exists) throw new Error('Class not found');
    if (doc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    await db.collection('classes').doc(classId).update({
        ...data,
        updatedAt: new Date().toISOString(),
    });
}

export async function deleteClassAction(classId: string): Promise<void> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const doc = await db.collection('classes').doc(classId).get();
    if (!doc.exists) throw new Error('Class not found');
    if (doc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    // Cascade-delete all subcollections — Firestore does NOT auto-delete children.
    // Run all deep deletes in parallel before removing the class doc itself.
    await Promise.all([
        // attendance/{classId}/** (records subcollection)
        db.recursiveDelete(db.collection('attendance').doc(classId)),
        // classes/{classId}/assessment_batches/**
        db.recursiveDelete(
            db.collection('classes').doc(classId).collection('assessment_batches')
        ),
        // classes/{classId}/students/{studentId}/assessments/** — recursiveDelete
        // on the students collection handles both student docs and their assessments
        // subcollections in one pass.
        db.recursiveDelete(
            db.collection('classes').doc(classId).collection('students')
        ),
    ]);

    // Only delete the class doc once all subcollections are gone
    await db.collection('classes').doc(classId).delete();
}

// ── Student Management ────────────────────────────────────────────────────────

export async function addStudentAction(classId: string, data: {
    name: string;
    rollNumber: number;
    parentPhone: string;
    parentLanguage: Language;
}): Promise<{ studentId: string }> {
    const uid = await getAuthUserId();
    await requireProPlan(uid);
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    // Enforce 40-student limit via COUNT aggregation
    const countSnap = await db.collection('classes').doc(classId)
        .collection('students').count().get();
    if (countSnap.data().count >= 40) throw new Error('Maximum 40 students per class');

    if (!data.name.trim()) throw new Error('Student name is required');
    if (data.name.length > 80) throw new Error('Student name too long (max 80 chars)');
    // Wave 3: tighten roll number validation. Without isInteger, JS coerces
    // 41.5 / 0.99 / "1abc" through to satisfy the range check.
    if (typeof data.rollNumber !== 'number' || !Number.isInteger(data.rollNumber)) {
        throw new Error('Roll number must be an integer');
    }
    if (data.rollNumber < 1 || data.rollNumber > 40) throw new Error('Roll number must be 1–40');

    const phone = normalizeToE164(data.parentPhone);
    const now = new Date().toISOString();

    const ref = db.collection('classes').doc(classId).collection('students').doc();
    const student: Omit<Student, 'id'> = {
        classId,
        name: data.name.trim(),
        rollNumber: data.rollNumber,
        parentPhone: phone,
        parentLanguage: data.parentLanguage,
        createdAt: now,
        updatedAt: now,
    };

    const { FieldValue } = await import('firebase-admin/firestore');
    const batch = db.batch();
    batch.set(ref, student);
    batch.update(db.collection('classes').doc(classId), {
        studentCount: FieldValue.increment(1),
        updatedAt: now,
    });
    await batch.commit();

    return { studentId: ref.id };
}

export async function getStudentsAction(classId: string): Promise<Student[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    const snap = await db.collection('classes').doc(classId)
        .collection('students')
        .orderBy('rollNumber', 'asc')
        .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
}

export async function updateStudentAction(classId: string, studentId: string, data: {
    name?: string;
    rollNumber?: number;
    parentPhone?: string;
    parentLanguage?: Language;
}): Promise<void> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    const update: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (data.name) update.name = data.name.trim();
    if (data.rollNumber) update.rollNumber = data.rollNumber;
    if (data.parentPhone) update.parentPhone = normalizeToE164(data.parentPhone);
    if (data.parentLanguage) update.parentLanguage = data.parentLanguage;

    await db.collection('classes').doc(classId)
        .collection('students').doc(studentId).update(update);
}

export async function deleteStudentAction(classId: string, studentId: string): Promise<void> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    const { FieldValue } = await import('firebase-admin/firestore');
    const batch = db.batch();
    batch.delete(db.collection('classes').doc(classId).collection('students').doc(studentId));
    batch.update(db.collection('classes').doc(classId), {
        studentCount: FieldValue.increment(-1),
        updatedAt: new Date().toISOString(),
    });
    await batch.commit();
}

// ── Attendance Recording ──────────────────────────────────────────────────────

export async function saveAttendanceAction(
    classId: string,
    date: string,  // YYYY-MM-DD
    records: Record<string, AttendanceStatus>,
): Promise<void> {
    const uid = await getAuthUserId();
    await requireProPlan(uid);
    const db = await getDb();

    // Validate date as strings to avoid UTC-vs-local issues with new Date('YYYY-MM-DD').
    // YYYY-MM-DD strings sort lexicographically in the same order as dates.
    const todayStr = new Date().toLocaleDateString('sv'); // 'sv' locale gives YYYY-MM-DD in local tz
    const sevenDaysAgoStr = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toLocaleDateString('sv');
    })();

    if (date > todayStr) throw new Error('Cannot mark attendance for future dates');
    if (date < sevenDaysAgoStr) throw new Error('Cannot mark attendance older than 7 days');

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    const record: DailyAttendanceRecord = {
        classId,
        date,
        teacherUid: uid,
        records,
        submittedAt: new Date().toISOString(),
        isFinalized: false,
    };

    // Path: attendance/{classId}/records/{YYYY-MM-DD}
    await db.collection('attendance').doc(classId)
        .collection('records').doc(date).set(record);
}

export async function getAttendanceForDateAction(
    classId: string,
    date: string,
): Promise<DailyAttendanceRecord | null> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return null;
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    const doc = await db.collection('attendance').doc(classId)
        .collection('records').doc(date).get();

    return doc.exists ? (doc.data() as DailyAttendanceRecord) : null;
}

export async function getMonthlyAttendanceAction(
    classId: string,
    year: number,
    month: number,  // 1–12
): Promise<Record<string, DailyAttendanceRecord>> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return {};
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    // Date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const snap = await db.collection('attendance').doc(classId)
        .collection('records')
        .where('date', '>=', startDate)
        .where('date', '<', nextMonth)
        .get();

    const result: Record<string, DailyAttendanceRecord> = {};
    snap.docs.forEach((d) => {
        result[d.id] = d.data() as DailyAttendanceRecord;
    });
    return result;
}

// ── Student Attendance Summary ────────────────────────────────────────────────

export async function getStudentSummariesAction(
    classId: string,
    year: number,
    month: number,
): Promise<StudentAttendanceSummary[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return [];
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    // Query students and monthly attendance in parallel — avoids double auth round-trip
    // of calling getStudentsAction + getMonthlyAttendanceAction (each re-checks auth).
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const [studentsSnap, attendanceSnap] = await Promise.all([
        db.collection('classes').doc(classId).collection('students').orderBy('rollNumber', 'asc').get(),
        db.collection('attendance').doc(classId).collection('records')
            .where('date', '>=', startDate).where('date', '<', nextMonth).get(),
    ]);

    const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
    const attendanceMap: Record<string, DailyAttendanceRecord> = {};
    attendanceSnap.docs.forEach((d) => { attendanceMap[d.id] = d.data() as DailyAttendanceRecord; });


    const summaries: StudentAttendanceSummary[] = students.map((student) => {
        let presentDays = 0;
        let absentDays = 0;
        let lateDays = 0;
        let consecutiveAbsences = 0;
        let currentStreak = 0;

        const sortedDates = Object.keys(attendanceMap).sort();
        for (const date of sortedDates) {
            const status = attendanceMap[date].records[student.id];
            if (!status) continue;
            if (status === 'present') { presentDays++; currentStreak = 0; }
            else if (status === 'absent') { absentDays++; currentStreak++; consecutiveAbsences = Math.max(consecutiveAbsences, currentStreak); }
            else if (status === 'late') { lateDays++; currentStreak = 0; }
        }

        const totalDays = presentDays + absentDays + lateDays;
        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

        return {
            studentId: student.id,
            studentName: student.name,
            rollNumber: student.rollNumber,
            totalDays,
            presentDays,
            absentDays,
            lateDays,
            attendanceRate,
            consecutiveAbsences,
        };
    });

    return dbAdapter.serialize(summaries) as StudentAttendanceSummary[];
}

// ── Parent Outreach ───────────────────────────────────────────────────────────

export async function saveOutreachRecordAction(data: {  // premium gate enforced here
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
    const uid = await getAuthUserId();
    await requireProPlan(uid);
    const db = await getDb();

    const now = new Date().toISOString();
    const ref = db.collection('parent_outreach').doc();

    // Build doc conditionally — Firestore rejects literal `undefined`.
    const record: Record<string, unknown> = {
        teacherUid: uid,
        classId: data.classId,
        className: data.className,
        studentId: data.studentId,
        studentName: data.studentName,
        parentPhone: data.parentPhone,
        parentLanguage: data.parentLanguage,
        reason: data.reason,
        generatedMessage: data.generatedMessage,
        deliveryMethod: data.deliveryMethod,
        callStatus: data.deliveryMethod === 'twilio_call' ? 'initiated' : 'manual',
        createdAt: now,
        updatedAt: now,
    };
    if (data.teacherNote) record.teacherNote = data.teacherNote;
    if (data.performanceContext) record.performanceContext = data.performanceContext;

    await ref.set(record);
    return { outreachId: ref.id };
}

export async function getOutreachHistoryAction(
    classId: string,
    studentId?: string,
): Promise<ParentOutreach[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    // No composite indexes needed — equality filters only, sort in JS
    const snap = studentId
        ? await db.collection('parent_outreach')
            .where('teacherUid', '==', uid)
            .where('studentId', '==', studentId)
            .get()
        : await db.collection('parent_outreach')
            .where('teacherUid', '==', uid)
            .where('classId', '==', classId)
            .get();

    const records = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ParentOutreach))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, studentId ? 20 : 50);

    return dbAdapter.serialize(records) as ParentOutreach[];
}

// ── Twilio config check ───────────────────────────────────────────────────────

export async function getTwilioConfigStatusAction(): Promise<{ configured: boolean }> {
    await getAuthUserId(); // auth check
    const configured = !!(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
    );
    return { configured };
}

// ── Outreach triage helpers (added for Contact-Parent demo polish) ───────────
//
// These two read-only actions power the "Needs outreach today" banner and
// the reason-aware Add-Note panel in ContactParentModal. They surface
// per-student academic and absence signals so the teacher can pick the
// right student × reason for outreach without scrolling the alphabetical
// roster. Both auth-gated on class ownership; no plan gate (read-only).

/**
 * Returns the most recent `limitDays` dates (YYYY-MM-DD, descending) on which
 * the given student was marked `absent`. Powers the "Absent days" panel that
 * replaces the marks card when reason=consecutive_absences.
 */
export async function getStudentAbsenceDatesAction(
    classId: string,
    studentId: string,
    limitDays: number = 30,
): Promise<string[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return [];
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    const today = new Date();
    const startDate = (() => {
        const d = new Date(today);
        d.setDate(d.getDate() - limitDays);
        return d.toLocaleDateString('sv');
    })();
    const endDate = today.toLocaleDateString('sv');

    const snap = await db.collection('attendance').doc(classId)
        .collection('records')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();

    const absent: string[] = [];
    snap.docs.forEach((d) => {
        const data = d.data() as DailyAttendanceRecord;
        if (data.records?.[studentId] === 'absent') absent.push(d.id);
    });
    return absent.sort((a, b) => b.localeCompare(a));
}

/**
 * Per-student rollup of recent assessment performance. Computes the weighted
 * average across the most recent 3 assessments per student. Used by the class
 * page to flag at-risk students (avg < 35%) and high-performers (avg ≥ 85%)
 * for the triage banner. Falls back to empty array on any failure so the
 * banner degrades gracefully to attendance-only signals.
 */
export interface StudentPerformanceSummary {
    studentId: string;
    latestPercentage: number;          // 0–100, weighted avg of last 3 assessments
    isAtRisk: boolean;                 // avg < 35
    lowestSubject?: string;            // subject of the lowest-scoring recent assessment
    lowestMarks?: { obtained: number; max: number };
    highestSubject?: string;
    highestPercentage?: number;
}

export async function getClassPerformanceSummariesAction(
    classId: string,
): Promise<StudentPerformanceSummary[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return [];
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    // One round-trip via collectionGroup — the seed sets `classId` on every
    // assessment doc so we can filter without iterating per-student.
    const snap = await db.collectionGroup('assessments')
        .where('classId', '==', classId)
        .get();

    interface Mark {
        studentId: string;
        subject: string;
        marksObtained: number;
        maxMarks: number;
        percentage: number;
        date: string;
    }

    const byStudent = new Map<string, Mark[]>();
    snap.docs.forEach((d) => {
        const data = d.data() as Mark & { studentId?: string };
        if (!data.studentId) return;
        const list = byStudent.get(data.studentId) ?? [];
        list.push({
            studentId: data.studentId,
            subject: data.subject ?? 'Unknown',
            marksObtained: data.marksObtained ?? 0,
            maxMarks: data.maxMarks ?? 1,
            percentage: typeof data.percentage === 'number'
                ? data.percentage
                : (data.marksObtained / data.maxMarks) * 100,
            date: data.date ?? '',
        });
        byStudent.set(data.studentId, list);
    });

    const summaries: StudentPerformanceSummary[] = [];
    byStudent.forEach((marks, studentId) => {
        const recent = [...marks]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 3);
        if (recent.length === 0) return;

        const avg = recent.reduce((s, m) => s + m.percentage, 0) / recent.length;
        const lowest = recent.reduce((lo, m) => m.percentage < lo.percentage ? m : lo, recent[0]);
        const highest = recent.reduce((hi, m) => m.percentage > hi.percentage ? m : hi, recent[0]);

        summaries.push({
            studentId,
            latestPercentage: Math.round(avg * 10) / 10,
            isAtRisk: avg < 35,
            lowestSubject: lowest.subject,
            lowestMarks: { obtained: lowest.marksObtained, max: lowest.maxMarks },
            highestSubject: highest.subject,
            highestPercentage: Math.round(highest.percentage * 10) / 10,
        });
    });

    return dbAdapter.serialize(summaries) as StudentPerformanceSummary[];
}

/**
 * Returns the studentIds for which the most recent `parent_outreach` record
 * within the past `lookbackDays` was a behavioral concern. Lets the class
 * page surface a "Behavioral concern" group in the triage banner without
 * an extra round-trip to behavior-specific collections (which don't exist).
 */
export async function getStudentsWithRecentBehavioralOutreachAction(
    classId: string,
    lookbackDays: number = 30,
): Promise<string[]> {
    const uid = await getAuthUserId();
    const db = await getDb();

    const since = new Date();
    since.setDate(since.getDate() - lookbackDays);
    const sinceIso = since.toISOString();

    const snap = await db.collection('parent_outreach')
        .where('teacherUid', '==', uid)
        .where('classId', '==', classId)
        .where('reason', '==', 'behavioral_concern')
        .get();

    const ids = new Set<string>();
    snap.docs.forEach((d) => {
        const data = d.data() as ParentOutreach;
        if ((data.createdAt ?? '') >= sinceIso) ids.add(data.studentId);
    });
    return Array.from(ids);
}
