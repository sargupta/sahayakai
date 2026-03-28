
import { NextResponse } from 'next/server';
import { generateExamPaper } from '@/ai/flows/exam-paper-generator';
import { logger } from '@/lib/logger';
import { withPlanCheck } from '@/lib/plan-guard';

/**
 * @swagger
 * /api/ai/exam-paper:
 *   post:
 *     summary: Generate a Board-Pattern Exam Paper
 *     description: Uses AI to generate a complete exam paper following official board blueprints with answer keys and marking schemes.
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
 *               - board
 *               - gradeLevel
 *               - subject
 *               - chapters
 *             properties:
 *               board:
 *                 type: string
 *                 example: "CBSE"
 *               gradeLevel:
 *                 type: string
 *                 example: "Class 10"
 *               subject:
 *                 type: string
 *                 example: "Mathematics"
 *               chapters:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Quadratic Equations", "Triangles"]
 *               difficulty:
 *                 type: string
 *                 enum: [easy, moderate, hard, mixed]
 *                 example: "mixed"
 *               language:
 *                 type: string
 *                 example: "English"
 *               includeAnswerKey:
 *                 type: boolean
 *                 example: true
 *               includeMarkingScheme:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Generated Exam Paper
 *       400:
 *         description: Invalid input
 *       500:
 *         description: AI Generation failed
 */
async function _handler(request: Request) {
    let paperDesc = 'Unknown Paper';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        paperDesc = `${body.board || ''} ${body.gradeLevel || ''} ${body.subject || ''}`.trim() || 'Unknown Paper';

        if (!body.board || !body.gradeLevel || !body.subject || !body.chapters?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: board, gradeLevel, subject, chapters' },
                { status: 400 }
            );
        }

        const output = await generateExamPaper({
            ...body,
            userId: userId
        });

        return NextResponse.json(output);

    } catch (error) {
        logger.error(`Exam Paper API Failed for: "${paperDesc}"`, error, 'EXAM_PAPER', { userId: request.headers.get('x-user-id') });

        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export const POST = withPlanCheck('exam-paper')(_handler);
