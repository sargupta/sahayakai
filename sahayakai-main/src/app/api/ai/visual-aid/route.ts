
import { NextResponse } from 'next/server';
import { generateVisualAid } from '@/ai/flows/visual-aid-designer';
import { logger } from '@/lib/logger';

/**
 * @swagger
 * /api/ai/visual-aid:
 *   post:
 *     summary: Generate a Visual Aid (Drawing)
 *     description: Uses AI to generate a blackboard-style chalk drawing for a specific topic.
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
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: "Structure of a plant cell"
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 6"
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: Generated Visual Aid
 *       400:
 *         description: Invalid input or Safety violation
 *       500:
 *         description: AI Generation failed
 */
export async function POST(request: Request) {
    let promptText = 'Unknown Prompt';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        promptText = body.prompt || 'Unknown Prompt';

        // Call the AI Flow
        const output = await generateVisualAid({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error: any) {
        logger.error(`Visual Aid API Failed for prompt: "${promptText}"`, error, 'VISUAL_AID', { userId: request.headers.get('x-user-id') });

        const errorMessage = error.message || 'Internal Server Error';
        const errorCode = error.errorCode || 'UNKNOWN_ERROR';
        const context = error.context || null;

        if (errorMessage.includes('Safety Violation')) {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

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
