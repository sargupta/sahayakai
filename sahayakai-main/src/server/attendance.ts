/**
 * Attendance domain service — tranche 5 API-boundary migration.
 *
 * Logic moved verbatim from src/app/actions/attendance.ts (deleted). Each
 * function takes the middleware-verified `uid` as its first argument; the
 * /api/attendance/* routes are thin shells (auth → validate → call → JSON).
 *
 * Forensic fixes that MUST survive any refactor:
 * - F9-004: saveAttendance validates dates against IST, not server-UTC.
 * - F9-006: addStudent enforces the 40-student cap inside a transaction.
 * - H9:     saveAttendance validates the client-supplied records map
 *           (student ids must belong to the class, statuses in-enum,
 *           hard cap on entry count) before writing.
 * - H2:     saveOutreachRecord verifies class ownership + student membership
 *           before seeding the Twilio call pipeline.
 */

import { getDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { dbAdapter } from '@/lib/db/adapter';
import type {
    ClassRecord, Student, DailyAttendanceRecord,
    ParentOutreach, StudentAttendanceSummary, AttendanceStatus, OutreachReason,
} from '@/types/attendance';
import type { Language, GradeLevel, Subject } from '@/types';
import { hasAdvancedPlan } from '@/lib/plan-utils';

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

// ── Error → HTTP status mapping (used by the route shells) ───────────────────
//
// The old server actions surfaced errors as thrown Error messages that client
// code matches on (e.g. `err.message === 'PREMIUM_REQUIRED'`). The routes
// keep the exact message in `{ error }` and add a RESTish status code.

const NOT_FOUND_MESSAGES = new Set([
    'Class not found',
    'Student not found in this class',
    'User not found',
]);

const VALIDATION_PATTERNS: RegExp[] = [
    /^Class name is required$/,
    /^Academic year is required$/,
    /^Student name is required$/,
    /^Student name too long/,
    /^Roll number must be/,
    /^Invalid phone number/,
    /^Maximum 40 students per class$/,
    /^Cannot mark attendance/,
    /^Too many attendance entries/,
    /^Unknown student in attendance records/,
    /^Invalid attendance status/,
];

export function attendanceErrorStatus(err: unknown): { message: string; status: number } {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    if (message === 'Unauthorized') return { message, status: 403 };
    if (message === 'PREMIUM_REQUIRED') return { message, status: 403 };
    if (NOT_FOUND_MESSAGES.has(message)) return { message, status: 404 };
    if (VALIDATION_PATTERNS.some((p) => p.test(message))) return { message, status: 400 };
    // Unknown internals never leak to the client.
    return { message: 'Internal Server Error', status: 500 };
}

// ── Class Management ──────────────────────────────────────────────────────────

export async function createClass(uid: string, data: {
    name: string;
    subject: Subject;
    gradeLevel: GradeLevel;
    section?: string;
    academicYear: string;
}): Promise<{ classId: string }> {
    try {
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
    } catch (err) {
        logger.error('createClass failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function getClasses(uid: string): Promise<ClassRecord[]> {
    try {
    const db = await getDb();

    // No composite index needed — equality filter only, sort in JS
    const snap = await db.collection('classes')
        .where('teacherUid', '==', uid)
        .get();

    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ClassRecord))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err) {
        logger.error('getClasses failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function getClass(uid: string, classId: string): Promise<ClassRecord | null> {
    try {
    const db = await getDb();

    const doc = await db.collection('classes').doc(classId).get();
    if (!doc.exists) return null;

    const data = doc.data() as Omit<ClassRecord, 'id'>;
    if (data.teacherUid !== uid) throw new Error('Unauthorized');

    return { id: doc.id, ...data };
    } catch (err) {
        logger.error('getClass failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function updateClass(uid: string, classId: string, data: {
    name?: string;
    subject?: Subject;
    gradeLevel?: GradeLevel;
    section?: string;
}): Promise<void> {
    try {
    const db = await getDb();

    const doc = await db.collection('classes').doc(classId).get();
    if (!doc.exists) throw new Error('Class not found');
    if (doc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    await db.collection('classes').doc(classId).update({
        ...data,
        updatedAt: new Date().toISOString(),
    });
    } catch (err) {
        logger.error('updateClass failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function deleteClass(uid: string, classId: string): Promise<void> {
    try {
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
    } catch (err) {
        logger.error('deleteClass failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

// ── Student Management ────────────────────────────────────────────────────────

export async function addStudent(uid: string, classId: string, data: {
    name: string;
    rollNumber: number;
    parentPhone: string;
    parentLanguage: Language;
}): Promise<{ studentId: string }> {
    try {
    await requireProPlan(uid);
    const db = await getDb();

    const classRef = db.collection('classes').doc(classId);
    const classDoc = await classRef.get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

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

    const studentsCol = classRef.collection('students');
    const ref = studentsCol.doc();
    const student: Omit<Student, 'id'> = {
        classId,
        name: data.name.trim(),
        rollNumber: data.rollNumber,
        parentPhone: phone,
        parentLanguage: data.parentLanguage,
        createdAt: now,
        updatedAt: now,
    };

    // F9-006 fix: enforce 40-student limit inside a transaction so concurrent
    // adds can't both pass the count check and end up creating the 41st row.
    // Read the class doc's `studentCount` (kept in sync by the writes below)
    // inside the txn; reject and increment atomically.
    const { FieldValue } = await import('firebase-admin/firestore');
    await db.runTransaction(async (tx) => {
        const freshClass = await tx.get(classRef);
        if (!freshClass.exists) throw new Error('Class not found');
        if (freshClass.data()!.teacherUid !== uid) throw new Error('Unauthorized');
        const currentCount = (freshClass.data()!.studentCount as number | undefined) ?? 0;
        if (currentCount >= 40) throw new Error('Maximum 40 students per class');

        tx.set(ref, student);
        tx.update(classRef, {
            studentCount: FieldValue.increment(1),
            updatedAt: now,
        });
    });

    return { studentId: ref.id };
    } catch (err) {
        logger.error('addStudent failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function getStudents(uid: string, classId: string): Promise<Student[]> {
    try {
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    const snap = await db.collection('classes').doc(classId)
        .collection('students')
        .orderBy('rollNumber', 'asc')
        .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
    } catch (err) {
        logger.error('getStudents failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function updateStudent(uid: string, classId: string, studentId: string, data: {
    name?: string;
    rollNumber?: number;
    parentPhone?: string;
    parentLanguage?: Language;
}): Promise<void> {
    try {
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
    } catch (err) {
        logger.error('updateStudent failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function deleteStudent(uid: string, classId: string, studentId: string): Promise<void> {
    try {
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
    } catch (err) {
        logger.error('deleteStudent failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

// ── Attendance Recording ──────────────────────────────────────────────────────

export async function saveAttendance(
    uid: string,
    classId: string,
    date: string,  // YYYY-MM-DD
    records: Record<string, AttendanceStatus>,
): Promise<void> {
    try {
    await requireProPlan(uid);
    const db = await getDb();

    // F9-004 fix: validate against IST, not server-UTC. Cloud Run runs in UTC,
    // so between 18:30Z–24:00Z (00:00–05:30 IST) the server's `today` is one
    // day BEHIND the teacher's IST calendar. A teacher marking attendance at
    // 00:30 IST hit "Cannot mark attendance for future dates" because the
    // server still thought it was yesterday. Compute today/seven-days-ago in
    // Asia/Kolkata explicitly via Intl rather than relying on the host TZ.
    const istFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const istDateString = (d: Date) => istFormatter.format(d); // YYYY-MM-DD in IST
    const todayStr = istDateString(new Date());
    const sevenDaysAgoStr = (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 7);
        return istDateString(d);
    })();

    if (date > todayStr) throw new Error('Cannot mark attendance for future dates');
    if (date < sevenDaysAgoStr) throw new Error('Cannot mark attendance older than 7 days');

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    // H9 fix: validate the client-supplied `records` map before writing it
    // verbatim. Without this, a caller could inject arbitrary studentId keys or
    // out-of-enum status values straight into the attendance doc, or push an
    // oversized document.
    const VALID_STATUSES: ReadonlySet<string> = new Set<AttendanceStatus>(['present', 'absent', 'late']);
    const MAX_RECORDS = 200; // hard cap — a class holds ≤40 students; guards against oversized-doc writes

    const recordEntries = Object.entries(records);
    if (recordEntries.length > MAX_RECORDS) {
        throw new Error(`Too many attendance entries (max ${MAX_RECORDS})`);
    }

    // Fetch the class's real student ids once and reject any key that isn't one.
    const studentsSnap = await db.collection('classes').doc(classId)
        .collection('students').get();
    const validStudentIds = new Set(studentsSnap.docs.map((d) => d.id));

    for (const [studentId, status] of recordEntries) {
        if (!validStudentIds.has(studentId)) {
            throw new Error(`Unknown student in attendance records: ${studentId}`);
        }
        if (!VALID_STATUSES.has(status as string)) {
            throw new Error(`Invalid attendance status for ${studentId}: ${String(status)}`);
        }
    }

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
    } catch (err) {
        logger.error('saveAttendance failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function getAttendanceForDate(
    uid: string,
    classId: string,
    date: string,
): Promise<DailyAttendanceRecord | null> {
    try {
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return null;
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    const doc = await db.collection('attendance').doc(classId)
        .collection('records').doc(date).get();

    return doc.exists ? (doc.data() as DailyAttendanceRecord) : null;
    } catch (err) {
        logger.error('getAttendanceForDate failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function getMonthlyAttendance(
    uid: string,
    classId: string,
    year: number,
    month: number,  // 1–12
): Promise<Record<string, DailyAttendanceRecord>> {
    try {
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
    } catch (err) {
        logger.error('getMonthlyAttendance failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

// ── Student Attendance Summary ────────────────────────────────────────────────

export async function getStudentSummaries(
    uid: string,
    classId: string,
    year: number,
    month: number,
): Promise<StudentAttendanceSummary[]> {
    try {
    const db = await getDb();

    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) return [];
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    // Query students and monthly attendance in parallel — avoids double auth round-trip
    // of calling getStudents + getMonthlyAttendance (each re-checks auth).
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
    } catch (err) {
        logger.error('getStudentSummaries failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

// ── Parent Outreach ───────────────────────────────────────────────────────────

export async function saveOutreachRecord(uid: string, data: {  // premium gate enforced here
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
    try {
    await requireProPlan(uid);
    const db = await getDb();

    // H2 fix: verify the caller owns the class AND that the student belongs to
    // it BEFORE writing the outreach doc. Without this a caller could seed the
    // Twilio call pipeline with an attacker-chosen classId / studentId /
    // parentPhone. Mirror the ownership check used by every other action here.
    const classDoc = await db.collection('classes').doc(data.classId).get();
    if (!classDoc.exists) throw new Error('Class not found');
    if (classDoc.data()!.teacherUid !== uid) throw new Error('Unauthorized');

    // Student must be a real member of this class (classes/{classId}/students/{studentId}).
    const studentDoc = await db.collection('classes').doc(data.classId)
        .collection('students').doc(data.studentId).get();
    if (!studentDoc.exists) throw new Error('Student not found in this class');

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
    } catch (err) {
        logger.error('saveOutreachRecord failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

export async function getOutreachHistory(
    uid: string,
    classId: string,
    studentId?: string,
): Promise<ParentOutreach[]> {
    try {
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
    } catch (err) {
        logger.error('getOutreachHistory failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

// ── Twilio config check ───────────────────────────────────────────────────────

export async function getTwilioConfigStatus(uid: string): Promise<{ configured: boolean }> {
    try {
        const configured = !!(
            process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN &&
            process.env.TWILIO_PHONE_NUMBER
        );
        return { configured };
    } catch (err) {
        logger.error('getTwilioConfigStatus failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

// ── Outreach triage helpers (added for Contact-Parent demo polish) ───────────
//
// These two read-only helpers power the "Needs outreach today" banner and
// the reason-aware Add-Note panel in ContactParentModal. They surface
// per-student academic and absence signals so the teacher can pick the
// right student × reason for outreach without scrolling the alphabetical
// roster. Both auth-gated on class ownership; no plan gate (read-only).

/**
 * Returns the most recent `limitDays` dates (YYYY-MM-DD, descending) on which
 * the given student was marked `absent`. Powers the "Absent days" panel that
 * replaces the marks card when reason=consecutive_absences.
 */
export async function getStudentAbsenceDates(
    uid: string,
    classId: string,
    studentId: string,
    limitDays: number = 30,
): Promise<string[]> {
    try {
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
    } catch (err) {
        logger.error('getStudentAbsenceDates failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
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

export async function getClassPerformanceSummaries(
    uid: string,
    classId: string,
): Promise<StudentPerformanceSummary[]> {
    try {
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
    } catch (err) {
        logger.error('getClassPerformanceSummaries failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}

/**
 * Returns the studentIds for which the most recent `parent_outreach` record
 * within the past `lookbackDays` was a behavioral concern. Lets the class
 * page surface a "Behavioral concern" group in the triage banner without
 * an extra round-trip to behavior-specific collections (which don't exist).
 */
export async function getStudentsWithRecentBehavioralOutreach(
    uid: string,
    classId: string,
    lookbackDays: number = 30,
): Promise<string[]> {
    try {
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
    } catch (err) {
        logger.error('getStudentsWithRecentBehavioralOutreach failed', err, 'ATTENDANCE', { userId: uid });
        throw err;
    }
}
