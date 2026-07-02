import { NextResponse } from 'next/server';
import { TeacherTrainingInputSchema } from '@/ai/flows/teacher-training';
import { logger } from '@/lib/logger';
import { logAIError, handleAIError } from '@/lib/ai-error-response';
import { withPlanCheck } from '@/lib/plan-guard';
import { dispatchTeacherTraining } from '@/lib/sidecar/teacher-training-dispatch';

/**
 * @swagger
 * /api/ai/teacher-training:
 *   post:
 *     summary: Get Teacher Training Advice
 *     description: Provides personalized professional development advice and pedagogical strategy.
 *     tags:
 *       - AI Generation
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 example: "How do I manage a classroom of 40 students?"
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: Generated Advice
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: AI Generation failed
 */
async function _handler(request: Request) {
    let questionText = 'Unknown Question';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const json = await request.json();
        questionText = json.question || 'Unknown Question';

        // Validate input up-front so schema mismatches return HTTP 400 via
        // handleAIError instead of falling through to the generic 500 path
        // when Genkit's internal schema validator throws.
        // QA Lane A4 fix: schema requires userId, inject from session before parse.
        const body = TeacherTrainingInputSchema.parse({ ...json, userId });

        // Phase D.2: dispatcher routes Genkit vs ADK sidecar based on
        // SAHAYAKAI_TEACHER_TRAINING_MODE env (default: off).
        const dispatched = await dispatchTeacherTraining(body);
        return NextResponse.json({
            introduction: dispatched.introduction,
            advice: dispatched.advice,
            conclusion: dispatched.conclusion,
            gradeLevel: dispatched.gradeLevel,
            subject: dispatched.subject,
        });

    } catch (error: any) {
        // Zod schema mismatches → 400 via handleAIError (detects by name).
        // The name-based check is required because Next.js can load zod
        // from both CJS and ESM bundles, so `instanceof ZodError` may fail.
        if (error?.name === 'ZodError') {
            return handleAIError(error, 'TEACHER_TRAINING', {
                message: `Teacher Training API Failed for question: "${questionText}"`,
                userId: request.headers.get('x-user-id'),
            });
        }

        logAIError(error, 'TEACHER_TRAINING', { message: `Teacher Training API Failed for question: "${questionText}"`, userId: request.headers.get('x-user-id') });

        // Do NOT echo raw internal error strings to the client — they leak
        // model IDs, endpoints, and ADC/Secret-Manager hints. Full detail is
        // captured server-side by logAIError above.
        return NextResponse.json(
            {
                error: 'Failed to generate. Please try again.',
                code: 'INTERNAL_ERROR'
            },
            { status: 500 }
        );
    }
}

export const POST = withPlanCheck('teacher-training')(_handler);
