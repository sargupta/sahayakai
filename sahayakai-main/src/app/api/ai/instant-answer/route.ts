import { NextResponse } from 'next/server';
import { instantAnswer, InstantAnswerInputSchema } from '@/ai/flows/instant-answer';
import { handleAIError } from '@/lib/ai-error-response';
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

        const json = await request.json();
        questionText = json.question || 'Unknown Question';

        const body = InstantAnswerInputSchema.parse(json);

        const output = await instantAnswer({
            ...body,
            userId: userId,
        });

        return NextResponse.json(output);

    } catch (error) {
        // handleAIError: schema → 400, quota → 503 + Retry-After, else 500.
        return handleAIError(error, 'INSTANT_ANSWER', {
            message: `Instant Answer API Failed for question: "${questionText}"`,
            userId: request.headers.get('x-user-id'),
            extra: { path: '/api/ai/instant-answer' },
        });
    }
}

export const POST = withPlanCheck('instant-answer')(_handler);
