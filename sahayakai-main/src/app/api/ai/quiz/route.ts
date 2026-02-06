
import { NextResponse } from 'next/server';
import { generateQuiz } from '@/ai/flows/quiz-generator';

/**
 * @swagger
 * /api/ai/quiz:
 *   post:
 *     summary: Generate a Quiz
 *     description: Uses AI to generate a structured quiz with multiple choice, true/false, or short answer questions.
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
 *                 example: "Human Skeleton"
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 5"
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *                 default: medium
 *               language:
 *                 type: string
 *                 example: "English"
 *               numberOfQuestions:
 *                 type: number
 *                 default: 5
 *               questionTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [multiple_choice, true_false, fill_in_the_blanks, short_answer]
 *                 example: ["multiple_choice", "true_false"]
 *     responses:
 *       200:
 *         description: Generated Quiz
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
        const output = await generateQuiz({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        console.error('Quiz API Error:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: errorMessage },
            { status: 500 }
        );
    }
}
