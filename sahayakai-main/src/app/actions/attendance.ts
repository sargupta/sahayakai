'use server';

import { getDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { dbAdapter } from '@/lib/db/adapter';
import type {
    ClassRecord, Student, DailyAttendanceRecord,
    ParentOutreach, StudentAttendanceSummary, AttendanceStatus, OutreachReason,
} from '@/types/attendance';
import type { Language, GradeLevel, Subject } from '@/types';

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string> {
    const h = await headers();
    const uid = h.get('x-user-id');
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

// ── Plan guard ────────────────────────────────────────────────────────────────

async function requireProPlan(uid: string): Promise<void> {
    const profile = await dbAdapter.getUser(uid);
    if (!profile) throw new Error('User not found');
    if (profile.planType !== 'pro' && profile.planType !== 'institution') {
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

    // Cascade-delete subcollections — Firestore does NOT auto-delete children.
    // students: max 40 docs — batch delete.
    // attendance records: use recursiveDelete on the container doc.
    const [studentsSnap] = await Promise.all([
        db.collection('classes').doc(classId).collection('students').get(),
    ]);

    const batch = db.batch();
    studentsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.collection('classes').doc(classId));
    await batch.commit();

    // recursiveDelete handles attendance/{classId}/records/* and the container doc
    await db.recursiveDelete(db.collection('attendance').doc(classId));
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
}): Promise<{ outreachId: string }> {
    const uid = await getAuthUserId();
    await requireProPlan(uid);
    const db = await getDb();

    const now = new Date().toISOString();
    const ref = db.collection('parent_outreach').doc();

    const record: Omit<ParentOutreach, 'id'> = {
        teacherUid: uid,
        classId: data.classId,
        className: data.className,
        studentId: data.studentId,
        studentName: data.studentName,
        parentPhone: data.parentPhone,
        parentLanguage: data.parentLanguage,
        reason: data.reason,
        teacherNote: data.teacherNote,
        generatedMessage: data.generatedMessage,
        deliveryMethod: data.deliveryMethod,
        callStatus: data.deliveryMethod === 'twilio_call' ? 'initiated' : 'manual',
        createdAt: now,
        updatedAt: now,
    };

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
