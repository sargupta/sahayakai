import type { Subject, Language, Timestamp } from './index';

// --- Assessment Types ---

export const ASSESSMENT_TYPES = ['unit_test', 'mid_term', 'final_exam', 'assignment', 'practical', 'project'] as const;
export type AssessmentType = typeof ASSESSMENT_TYPES[number];

export const TERMS = ['term1', 'term2', 'annual'] as const;
export type Term = typeof TERMS[number];

export const CBSE_GRADES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D', 'E'] as const;
export type CBSEGrade = typeof CBSE_GRADES[number];

// Co-scholastic rating for NEP 2020 holistic assessment
export const CO_SCHOLASTIC_RATINGS = ['A', 'B', 'C', 'D', 'E'] as const;
export type CoScholasticRating = typeof CO_SCHOLASTIC_RATINGS[number];

// --- Firestore Document: classes/{classId}/assessment_batches/{batchId} ---
export interface AssessmentBatch {
    id: string;
    classId: string;
    teacherUid: string;
    name: string;              // "Unit Test 1 - Algebra"
    type: AssessmentType;
    subject: Subject;
    maxMarks: number;
    term: Term;
    date: string;              // YYYY-MM-DD
    academicYear: string;      // "2025-26"
    studentCount: number;      // denormalized count
    classAverage?: number;     // denormalized after calculation
    createdAt: string;         // ISO string
    updatedAt: string;
}

// --- Firestore Document: classes/{classId}/students/{studentId}/assessments/{assessmentId} ---
export interface Assessment {
    id: string;
    classId: string;
    batchId: string;           // references AssessmentBatch
    studentId: string;
    teacherUid: string;
    type: AssessmentType;
    name: string;
    subject: Subject;
    maxMarks: number;
    marksObtained: number;
    percentage: number;        // computed: (marksObtained/maxMarks) * 100
    grade?: string;            // CBSE: A1-E, ICSE: percentage-based
    term: Term;
    academicYear: string;
    date: string;              // YYYY-MM-DD

    // NEP 2020 co-scholastic (optional, for holistic assessment)
    coScholastic?: CoScholasticEntry[];

    remarks?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CoScholasticEntry {
    skill: string;             // "Critical Thinking", "Teamwork", "Communication"
    rating: CoScholasticRating;
}

// --- Input types for batch marks entry ---
export interface StudentMarkEntry {
    studentId: string;
    studentName: string;       // denormalized for display
    marksObtained: number;
    grade?: string;
    remarks?: string;
    coScholastic?: CoScholasticEntry[];
}

export interface BatchMarksInput {
    classId: string;
    name: string;
    type: AssessmentType;
    subject: Subject;
    maxMarks: number;
    term: Term;
    date: string;
    academicYear: string;
    marks: StudentMarkEntry[];
}

// --- Computed/aggregated types for dashboards ---
export interface ClassAssessmentSummary {
    batchId: string;
    batchName: string;
    subject: Subject;
    maxMarks: number;
    totalStudents: number;
    averageMarks: number;
    averagePercentage: number;
    highestMarks: number;
    lowestMarks: number;
    passCount: number;         // marks >= 33%
    failCount: number;
    distribution: {            // grade distribution
        grade: string;
        count: number;
    }[];
}

export interface StudentPerformanceTrend {
    studentId: string;
    studentName: string;
    assessments: {
        date: string;
        subject: Subject;
        name: string;
        percentage: number;
        grade?: string;
    }[];
    overallAverage: number;
    attendanceRate?: number;   // from attendance system
    isAtRisk: boolean;         // average < 35%
}
