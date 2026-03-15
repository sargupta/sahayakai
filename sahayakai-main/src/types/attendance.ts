import type { Language, GradeLevel, Subject } from './index';

// ── Core Enums ───────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late';

export type OutreachReason =
    | 'consecutive_absences'
    | 'poor_performance'
    | 'behavioral_concern'
    | 'positive_feedback';

export type CallStatus = 'initiated' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'manual';

// ── Firestore: classes/{classId} ─────────────────────────────────────────────

export interface ClassRecord {
    id: string;
    teacherUid: string;
    name: string;           // e.g. "Class 6A"
    subject: Subject;
    gradeLevel: GradeLevel;
    section?: string;       // "A", "B", etc.
    academicYear: string;   // "2025-26"
    studentCount: number;   // denormalized
    createdAt: string;      // ISO string
    updatedAt: string;
}

// ── Firestore: classes/{classId}/students/{studentId} ────────────────────────

export interface Student {
    id: string;
    classId: string;
    rollNumber: number;         // 1–40
    name: string;
    parentPhone: string;        // E.164: +919876543210
    parentLanguage: Language;
    createdAt: string;
    updatedAt: string;
}

// ── Firestore: attendance/{classId}/records/{YYYY-MM-DD} ─────────────────────
// Parent doc attendance/{classId} is an empty container document.

export interface DailyAttendanceRecord {
    classId: string;
    date: string;                              // YYYY-MM-DD
    teacherUid: string;
    records: Record<string, AttendanceStatus>; // studentId → status
    submittedAt: string;                       // ISO string
    isFinalized: boolean;
}

// ── Firestore: parent_outreach/{outreachId} ──────────────────────────────────

export interface ParentOutreach {
    id: string;
    teacherUid: string;
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
    callSid?: string;
    callStatus?: CallStatus;
    createdAt: string;
    updatedAt: string;
}

// ── Computed (not stored) ────────────────────────────────────────────────────

export interface StudentAttendanceSummary {
    studentId: string;
    studentName: string;
    rollNumber: number;
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    attendanceRate: number;        // 0–100
    consecutiveAbsences: number;   // current streak
}

// ── Twilio language codes for <Say> ──────────────────────────────────────────

export const TWILIO_LANGUAGE_MAP: Record<Language, string | null> = {
    English:   'en-IN',
    Hindi:     'hi-IN',
    Tamil:     'ta-IN',
    Telugu:    'te-IN',
    Kannada:   'kn-IN',
    Malayalam: 'ml-IN',
    Bengali:   'bn-IN',
    Marathi:   null,   // Twilio doesn't support Marathi — use WhatsApp copy
    Gujarati:  null,
    Punjabi:   null,
    Odia:      null,
};

export const TWILIO_VOICE_MAP: Record<Language, string> = {
    English:   'Polly.Aditi',
    Hindi:     'Polly.Aditi',
    Tamil:     'Polly.Aditi',
    Telugu:    'Polly.Aditi',
    Kannada:   'Polly.Aditi',
    Malayalam: 'Polly.Aditi',
    Bengali:   'Polly.Aditi',
    Marathi:   'Polly.Aditi',
    Gujarati:  'Polly.Aditi',
    Punjabi:   'Polly.Aditi',
    Odia:      'Polly.Aditi',
};
