
import { NextResponse } from 'next/server';
import { generateExamPaper } from '@/ai/flows/exam-paper-generator';
import { logger } from '@/lib/logger';
import { logAIError } from '@/lib/ai-error-response';
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
const VALID_DIFFICULTIES = ['easy', 'moderate', 'hard', 'mixed'] as const;

async function _handler(request: Request) {
    let paperDesc = 'Unknown Paper';
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
        }

        paperDesc = `${body.board || ''} ${body.gradeLevel || ''} ${body.subject || ''}`.trim() || 'Unknown Paper';

        if (!body.board || !body.gradeLevel || !body.subject) {
            return NextResponse.json(
                { error: 'Missing required fields: board, gradeLevel, subject' },
                { status: 400 }
            );
        }

        if (body.difficulty && !VALID_DIFFICULTIES.includes(body.difficulty as typeof VALID_DIFFICULTIES[number])) {
            return NextResponse.json(
                { error: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(', ')}` },
                { status: 400 }
            );
        }

        const output = await generateExamPaper({
            ...body,
            userId: userId
        } as Parameters<typeof generateExamPaper>[0]);

        return NextResponse.json(output);

    } catch (error) {
        logAIError(error, 'EXAM_PAPER', { message: `Exam Paper API Failed for: "${paperDesc}"`, userId: request.headers.get('x-user-id') });

        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export const POST = withPlanCheck('exam-paper')(_handler);

/**
 * PUT /api/ai/exam-paper
 * Save a previously generated exam paper to the user's content library.
 * The paper JSON is passed in the request body; this handler persists it
 * to Firestore + Firebase Storage under the authenticated user's path.
 */
async function _saveHandler(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const body = await request.json();
        if (!body.paper || typeof body.paper !== 'object') {
            return NextResponse.json({ error: 'Missing required field: paper' }, { status: 400 });
        }

        const { dbAdapter } = await import('@/lib/db/adapter');
        const { getStorageInstance } = await import('@/lib/firebase-admin');
        const { Timestamp } = await import('firebase-admin/firestore');
        const { v4: uuidv4 } = await import('uuid');
        const { format } = await import('date-fns');

        const paper = body.paper;
        const contentId = uuidv4();
        const now = new Date();
        const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
        const fileName = `${timestamp}-${contentId}.json`;
        const filePath = `users/${userId}/exam-papers/${fileName}`;

        const storage = await getStorageInstance();
        const file = storage.bucket().file(filePath);
        await file.save(JSON.stringify(paper), { contentType: 'application/json' });

        await dbAdapter.saveContent(userId, {
            id: contentId,
            type: 'exam-paper' as const,
            title: paper.title || `${paper.board || ''} ${paper.gradeLevel || ''} ${paper.subject || ''} Exam Paper`.trim(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gradeLevel: (paper.gradeLevel || 'Class 10') as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subject: (paper.subject || 'General') as any,
            topic: Array.isArray(paper.chapters) ? paper.chapters.join(', ') : (paper.subject || ''),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            language: (paper.language ?? 'English') as any,
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: paper,
        });

        return NextResponse.json({ success: true, contentId });
    } catch (error) {
        logger.error('Exam Paper Save Failed', error, 'EXAM_PAPER_SAVE', { userId: request.headers.get('x-user-id') });
        return NextResponse.json({ error: 'Failed to save exam paper' }, { status: 500 });
    }
}

export const PUT = withPlanCheck('exam-paper')(_saveHandler);
