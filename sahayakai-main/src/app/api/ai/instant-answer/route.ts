import { NextResponse } from 'next/server';
import { instantAnswer } from '@/ai/flows/instant-answer';
import { logger } from '@/lib/utils';

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
export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();

        const output = await instantAnswer({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error: any) {
        console.error('Instant Answer API Error:', error);

        const errorMessage = error.message || 'Internal Server Error';
        const errorCode = error.errorCode || 'UNKNOWN_ERROR';
        const context = error.context || null;

        logger.error("Instant Answer API Failed", error, {
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
                details: errorMessage,
                context: context
            },
            { status: 500 }
        );
    }
}
