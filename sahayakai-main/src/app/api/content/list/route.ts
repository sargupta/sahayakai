
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { ContentTypeSchema } from '@/ai/schemas/content-schemas';
import { z } from 'zod';

// Schema for Query Params
const ListContentQuerySchema = z.object({
    type: ContentTypeSchema.optional(),
    limit: z.coerce.number().min(1).max(50).default(20),
    gradeLevels: z.string().optional(), // Comma separated
    subjects: z.string().optional()     // Comma separated
});

/**
 * @swagger
 * /api/content/list:
 *   get:
 *     summary: List user's saved content
 *     description: Retrieve lesson plans, quizzes, etc. with filtering.
 *     tags:
 *       - Content
 *     security:
 *       - BearerAuth: []
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [lesson-plan, quiz, worksheet, visual-aid, rubric, micro-lesson, virtual-field-trip, instant-answer]
 *         description: Filter by content type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items to return (max 50)
 *       - in: query
 *         name: gradeLevels
 *         schema:
 *           type: string
 *         description: Comma-separated list of grades (e.g. "Class 5,Class 6")
 *       - in: query
 *         name: subjects
 *         schema:
 *           type: string
 *         description: Comma-separated list of subjects
 *     responses:
 *       200:
 *         description: List of content items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                 count:
 *                   type: integer
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Missing User ID
 */
export async function GET(request: Request) {
    try {
        // 1. Auth Check (Validated by Middleware)
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        // Parse & Validate Query Params
        const params = {
            type: searchParams.get('type') || undefined,
            limit: searchParams.get('limit') || undefined,
            gradeLevels: searchParams.get('gradeLevels') || undefined,
            subjects: searchParams.get('subjects') || undefined
        };

        const validationResult = ListContentQuerySchema.safeParse(params);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Invalid Query Parameters', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const { type, limit, gradeLevels, subjects } = validationResult.data;

        const items = await dbAdapter.listContent(userId, {
            type: type,
            limit: limit,
            gradeLevels: gradeLevels ? gradeLevels.split(',') : undefined,
            subjects: subjects ? subjects.split(',') : undefined
        });

        // Serialize timestamps (Firestore objects) to strings
        const serializedItems = dbAdapter.serialize(items);

        return NextResponse.json({
            items: serializedItems,
            count: items.length
        });

    } catch (error) {
        console.error('List Content API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
