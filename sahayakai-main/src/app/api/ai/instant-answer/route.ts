import { NextResponse } from 'next/server';
import { instantAnswer } from '@/ai/flows/instant-answer';
import { logger } from '@/lib/utils';
import { withPlanCheck } from '@/lib/plan-guard';

/**
 * @swagger
 * /api/ai/instant-answer:
 *   post:
 *     summary: Get an Instant Answer
 *     description: Provides a direct answer to a user's question, augmented by Google Search.
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
 *                 example: "What is photosynthesis?"
 *               language:
 *                 type: string
 *                 example: "English"
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 5"
 *     responses:
 *       200:
 *         description: Generated Answer
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

        const body = await request.json();
        questionText = body.question || 'Unknown Question';

        const output = await instantAnswer({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error: any) {
        const errorMessage = error.message || 'Internal Server Error';
        const errorCode = error.errorCode || 'UNKNOWN_ERROR';
        const context = error.context || null;

        logger.error(`Instant Answer API Failed for question: "${questionText}"`, error, {
            path: "/api/ai/instant-answer",
            userId: request.headers.get('x-user-id'),
            errorMessage,
            errorCode,
            context
        });

        return NextResponse.json(
            {
                error: errorMessage,
                errorCode: errorCode,
                context: context
            },
            { status: 500 }
        );
    }
}

export const POST = withPlanCheck('instant-answer')(_handler);
