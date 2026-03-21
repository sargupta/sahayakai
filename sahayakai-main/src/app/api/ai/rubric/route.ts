
import { NextResponse } from 'next/server';
import { generateRubric } from '@/ai/flows/rubric-generator';
import { logger } from '@/lib/logger';

/**
 * @swagger
 * /api/ai/rubric:
 *   post:
 *     summary: Generate a Rubric
 *     description: Uses AI to generate a detailed performance rubric for an assignment.
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
 *               - assignmentDescription
 *             properties:
 *               assignmentDescription:
 *                 type: string
 *                 example: "A grade 5 project on renewable energy sources."
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 5"
 *               language:
 *                 type: string
 *                 example: "English"
 *     responses:
 *       200:
 *         description: Generated Rubric
 *       400:
 *         description: Invalid input
 *       500:
 *         description: AI Generation failed
 */
export async function POST(request: Request) {
    let assignmentText = 'Unknown Assignment';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        assignmentText = body.assignmentDescription || 'Unknown Assignment';

        const output = await generateRubric({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        logger.error(`Rubric API Failed for assignment: "${assignmentText}"`, error, 'RUBRIC', { userId: request.headers.get('x-user-id') });

        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
