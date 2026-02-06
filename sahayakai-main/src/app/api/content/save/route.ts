
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { SaveContentSchema } from '@/ai/schemas/content-schemas';
import { z } from 'zod';

/**
 * @swagger
 * /api/content/save:
 *   post:
 *     summary: Save generated content to user library
 *     description: Validates and saves lesson plans, quizzes, etc. to Firestore.
 *     tags:
 *       - Content
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaveContentRequest'
 *     responses:
 *       200:
 *         description: Content saved successfully
 *       400:
 *         description: Validation error or missing User ID
 *       500:
 *         description: Database error
 */
export async function POST(request: Request) {
    try {
        // 1. Auth Check (Validated by Middleware)
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        // 2. Parse Body & Validate Schema
        const body = await request.json();
        const validationResult = SaveContentSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                { error: 'Schema Validation Failed', details: validationResult.error.format() },
                { status: 400 }
            );
        }

        const validContent = validationResult.data;

        // 3. Save to DB via Adapter
        // The adapter expects BaseContent<T>, and our types align.
        await dbAdapter.saveContent(userId, validContent as any);

        return NextResponse.json({ success: true, id: validContent.id });

    } catch (error) {
        console.error('Save Content API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
