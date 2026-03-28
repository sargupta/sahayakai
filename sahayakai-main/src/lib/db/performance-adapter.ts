import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';
import type { Assessment, AssessmentBatch, BatchMarksInput, ClassAssessmentSummary, StudentPerformanceTrend } from '@/types/performance';

const CLASSES_COLLECTION = 'classes';

export const performanceAdapter = {

    // --- Assessment Batch Operations ---

    async saveAssessmentBatch(input: BatchMarksInput, teacherUid: string): Promise<string> {
        const db = await getDb();
        const batch = db.batch();
        const now = new Date().toISOString();

        // 1. Create the batch metadata doc
        const batchRef = db.collection(CLASSES_COLLECTION)
            .doc(input.classId)
            .collection('assessment_batches')
            .doc();

        const batchDoc: AssessmentBatch = {
            id: batchRef.id,
            classId: input.classId,
            teacherUid,
            name: input.name,
            type: input.type,
            subject: input.subject,
            maxMarks: input.maxMarks,
            term: input.term,
            date: input.date,
            academicYear: input.academicYear,
            studentCount: input.marks.length,
            createdAt: now,
            updatedAt: now,
        };

        batch.set(batchRef, batchDoc);

        // 2. Fan-out: write each student's assessment
        for (const entry of input.marks) {
            const assessmentRef = db.collection(CLASSES_COLLECTION)
                .doc(input.classId)
                .collection('students')
                .doc(entry.studentId)
                .collection('assessments')
                .doc();

            const assessment: Assessment = {
                id: assessmentRef.id,
                classId: input.classId,
                batchId: batchRef.id,
                studentId: entry.studentId,
                teacherUid,
                type: input.type,
                name: input.name,
                subject: input.subject,
                maxMarks: input.maxMarks,
                marksObtained: entry.marksObtained,
                percentage: Math.round((entry.marksObtained / input.maxMarks) * 100 * 100) / 100,
                grade: entry.grade,
                term: input.term,
                academicYear: input.academicYear,
                date: input.date,
                coScholastic: entry.coScholastic,
                remarks: entry.remarks,
                createdAt: now,
                updatedAt: now,
            };

            batch.set(assessmentRef, assessment);
        }

        await batch.commit();
        logger.info(`[performance] Saved batch ${batchRef.id} with ${input.marks.length} student marks`);
        return batchRef.id;
    },

    async listAssessmentBatches(classId: string): Promise<AssessmentBatch[]> {
        const db = await getDb();
        const snapshot = await db.collection(CLASSES_COLLECTION)
            .doc(classId)
            .collection('assessment_batches')
            .orderBy('date', 'desc')
            .get();

        return snapshot.docs.map(doc => doc.data() as AssessmentBatch);
    },

    // --- Student Assessment Operations ---

    async getStudentAssessments(
        classId: string,
        studentId: string,
        filters?: { subject?: string; term?: string; academicYear?: string }
    ): Promise<Assessment[]> {
        const db = await getDb();
        let query = db.collection(CLASSES_COLLECTION)
            .doc(classId)
            .collection('students')
            .doc(studentId)
            .collection('assessments')
            .orderBy('date', 'desc') as FirebaseFirestore.Query;

        if (filters?.subject) {
            query = query.where('subject', '==', filters.subject);
        }
        if (filters?.term) {
            query = query.where('term', '==', filters.term);
        }
        if (filters?.academicYear) {
            query = query.where('academicYear', '==', filters.academicYear);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as Assessment);
    },

    // --- Aggregation Operations ---

    async getClassAssessmentSummary(classId: string, batchId: string): Promise<ClassAssessmentSummary | null> {
        const db = await getDb();

        // Get batch metadata
        const batchDoc = await db.collection(CLASSES_COLLECTION)
            .doc(classId)
            .collection('assessment_batches')
            .doc(batchId)
            .get();

        if (!batchDoc.exists) return null;
        const batchData = batchDoc.data() as AssessmentBatch;

        // Get all students in the class
        const studentsSnapshot = await db.collection(CLASSES_COLLECTION)
            .doc(classId)
            .collection('students')
            .get();

        // For each student, get their assessment for this batch
        const assessments: Assessment[] = [];
        for (const studentDoc of studentsSnapshot.docs) {
            const assessmentSnapshot = await db.collection(CLASSES_COLLECTION)
                .doc(classId)
                .collection('students')
                .doc(studentDoc.id)
                .collection('assessments')
                .where('batchId', '==', batchId)
                .limit(1)
                .get();

            if (!assessmentSnapshot.empty) {
                assessments.push(assessmentSnapshot.docs[0].data() as Assessment);
            }
        }

        if (assessments.length === 0) return null;

        const marks = assessments.map(a => a.marksObtained);
        const passThreshold = batchData.maxMarks * 0.33;

        // Grade distribution
        const gradeMap = new Map<string, number>();
        for (const a of assessments) {
            const grade = a.grade || 'Ungraded';
            gradeMap.set(grade, (gradeMap.get(grade) || 0) + 1);
        }

        return {
            batchId,
            batchName: batchData.name,
            subject: batchData.subject,
            maxMarks: batchData.maxMarks,
            totalStudents: assessments.length,
            averageMarks: Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 100) / 100,
            averagePercentage: Math.round((marks.reduce((a, b) => a + b, 0) / marks.length / batchData.maxMarks * 100) * 100) / 100,
            highestMarks: Math.max(...marks),
            lowestMarks: Math.min(...marks),
            passCount: marks.filter(m => m >= passThreshold).length,
            failCount: marks.filter(m => m < passThreshold).length,
            distribution: Array.from(gradeMap.entries()).map(([grade, count]) => ({ grade, count })),
        };
    },

    async getStudentPerformanceTrend(classId: string, studentId: string): Promise<StudentPerformanceTrend | null> {
        const db = await getDb();

        // Get student info
        const studentDoc = await db.collection(CLASSES_COLLECTION)
            .doc(classId)
            .collection('students')
            .doc(studentId)
            .get();

        if (!studentDoc.exists) return null;
        const studentData = studentDoc.data()!;

        // Get all assessments
        const assessments = await this.getStudentAssessments(classId, studentId);

        if (assessments.length === 0) {
            return {
                studentId,
                studentName: studentData.name || '',
                assessments: [],
                overallAverage: 0,
                isAtRisk: false,
            };
        }

        const avgPercentage = assessments.reduce((sum, a) => sum + a.percentage, 0) / assessments.length;

        return {
            studentId,
            studentName: studentData.name || '',
            assessments: assessments.map(a => ({
                date: a.date,
                subject: a.subject,
                name: a.name,
                percentage: a.percentage,
                grade: a.grade,
            })),
            overallAverage: Math.round(avgPercentage * 100) / 100,
            isAtRisk: avgPercentage < 35,
        };
    },
};
