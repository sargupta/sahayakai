import { NextRequest, NextResponse } from 'next/server';
import { generateQuiz } from '@/ai/flows/quiz-generator';
import { logger } from '@/lib/logger';
import { validateAdmin } from '@/lib/auth-utils';

/**
 * Health check endpoint for quiz generation diagnostics.
 * Tests the quiz generation pipeline.
 *
 * Wave 2 hardening: this endpoint runs an actual AI generation call. Without
 * gating, anyone could hit `/api/ai/quiz/health` in a loop and consume our
 * Vertex AI quota for free. Now requires admin auth (same gate as cost
 * dashboard / log dashboard).
 *
 * For pure liveness without cost, use the standard `/api/health` instead.
 *
 * Usage: GET /api/ai/quiz/health  (admin-only)
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    // Admin gate — use the same x-user-id header pattern as the rest of the app.
    const userId = request.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json(
            { error: 'Unauthorized — quiz health check is admin-only' },
            { status: 401 },
        );
    }
    try {
        await validateAdmin(userId);
    } catch {
        return NextResponse.json(
            { error: 'Forbidden — admin role required' },
            { status: 403 },
        );
    }

    try {
        // Minimal test input - bypasses user ID to skip Firestore/Storage
        const testQuiz = await generateQuiz({
            topic: "Basic addition for Class 1 students",
            gradeLevel: "Class 1",
            language: "English",
            numQuestions: 3,
            questionTypes: ["multiple_choice"],
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
                sampleQuestion: testQuiz.easy?.questions?.[0]?.questionText || testQuiz.medium?.questions?.[0]?.questionText || testQuiz.hard?.questions?.[0]?.questionText
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

        logger.error('[Quiz Health Check] FAILED', error, 'HEALTH_CHECK', errorDetails);

        return NextResponse.json(errorDetails, { status: 500 });
    }
}
