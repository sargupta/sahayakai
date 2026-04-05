
import { NextResponse } from 'next/server';
import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';

/**
 * @swagger
 * /api/ai/lesson-plan:
 *   post:
 *     summary: Generate a Lesson Plan
 *     description: Uses AI to generate a detailed 5E lesson plan and saves it to the user's library.
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
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 example: "Photosynthesis"
 *               gradeLevels:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Class 5"]
 *               language:
 *                 type: string
 *                 enum: [English, Hindi, Bengali, Kannada, Tamil, Telugu, Marathi]
 *                 example: "English"
 *               resourceLevel:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: low
 *               difficultyLevel:
 *                 type: string
 *                 enum: [remedial, standard, advanced] 
 *                 default: standard
 *               useRuralContext:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Generated Lesson Plan
 *       400:
 *         description: Invalid input
 *       500:
 *         description: AI Generation failed
 */
async function _handler(request: Request) {
    let topicText = 'Unknown Topic';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        topicText = body.topic || 'Unknown Topic';

        // Call the AI Flow
        // We inject the userId so the flow handles persistence automatically.
        const output = await generateLessonPlan({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(`Lesson Plan API Failed for topic: "${topicText}"`, error, 'LESSON_PLAN', {
            path: "/api/ai/lesson-plan",
            userId: request.headers.get('x-user-id'),
            errorMessage
        });

        if (errorMessage.includes('Safety Violation')) {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        return NextResponse.json(
            { error: 'AI generation failed. Please try again.' },
            { status: 500 }
        );
    }
}

export const POST = withPlanCheck('lesson-plan')(_handler);
