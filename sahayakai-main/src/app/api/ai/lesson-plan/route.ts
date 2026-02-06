
import { NextResponse } from 'next/server';
import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { z } from 'zod';

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
export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();

        // Call the AI Flow
        // We inject the userId so the flow handles persistence automatically.
        const output = await generateLessonPlan({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        console.error('Lesson Plan API Error:', error);

        // Handle specific AI errors if possible
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Safety Violation')) {
            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        return NextResponse.json(
            { error: 'Internal Server Error', details: errorMessage },
            { status: 500 }
        );
    }
}
