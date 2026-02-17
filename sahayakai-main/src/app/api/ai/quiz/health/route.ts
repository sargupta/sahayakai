import { NextResponse } from 'next/server';
import { generateQuiz } from '@/ai/flows/quiz-generator';

/**
 * Health check endpoint for quiz generation diagnostics.
 * Tests the quiz generation pipeline without user authentication or storage.
 * 
 * Usage: GET /api/ai/quiz/health
 */
export async function GET() {
    const startTime = Date.now();

    try {
        // Minimal test input - bypasses user ID to skip Firestore/Storage
        const testQuiz = await generateQuiz({
            topic: "Basic addition for Class 1 students",
            gradeLevel: "Class 1",
            language: "English",
            numQuestions: 3,
            questionTypes: ["multiple-choice"],
            userId: undefined // Skip storage operations
        });

        const duration = Date.now() - startTime;

        return NextResponse.json({
            status: 'OK',
            message: 'Quiz generation is working correctly',
            duration: `${duration}ms`,
            diagnostics: {
                easyGenerated: !!testQuiz.easy,
                mediumGenerated: !!testQuiz.medium,
                hardGenerated: !!testQuiz.hard,
                allVariantsGenerated: !!(testQuiz.easy && testQuiz.medium && testQuiz.hard),
                sampleQuestion: testQuiz.easy?.questions?.[0]?.question || testQuiz.medium?.questions?.[0]?.question || testQuiz.hard?.questions?.[0]?.question
            }
        });
    } catch (error) {
        const duration = Date.now() - startTime;

        // Detailed error response for diagnostics
        const errorDetails = {
            status: 'FAIL',
            message: error instanceof Error ? error.message : String(error),
            duration: `${duration}ms`,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            // Check for common error patterns
            diagnostics: {
                isAPIKeyError: error instanceof Error && (
                    error.message?.includes('API key') ||
                    error.message?.includes('Secret Manager') ||
                    error.message?.includes('Configuration Error')
                ),
                isQuotaError: error instanceof Error && (
                    error.message?.includes('429') ||
                    error.message?.includes('quota') ||
                    error.message?.includes('RESOURCE_EXHAUSTED')
                ),
                isAuthError: error instanceof Error && (
                    error.message?.includes('401') ||
                    error.message?.includes('403') ||
                    error.message?.includes('PERMISSION_DENIED')
                ),
                isSchemaError: error instanceof Error && (
                    error.message?.includes('Schema validation') ||
                    error.message?.includes('parse')
                )
            },
            timestamp: new Date().toISOString()
        };

        console.error('[Quiz Health Check] FAILED:', errorDetails);

        return NextResponse.json(errorDetails, { status: 500 });
    }
}
