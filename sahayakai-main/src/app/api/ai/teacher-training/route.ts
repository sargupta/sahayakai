import { NextResponse } from 'next/server';
import { getTeacherTrainingAdvice } from '@/ai/flows/teacher-training';

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
export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();

        const output = await getTeacherTrainingAdvice({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        console.error('Teacher Training API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
