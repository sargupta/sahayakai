import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';

/**
 * @swagger
 * /api/content/get:
 *   get:
 *     summary: Get a specific content item by ID
 *     tags:
 *       - Content
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The content item
 *       404:
 *         description: Content not found
 */
export async function GET(request: Request) {
    try {
        // 1. Auth Check (Validated by Middleware)
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        const content = await dbAdapter.getContent(userId, id);

        if (!content) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        const serialized = dbAdapter.serialize([content])[0];

        return NextResponse.json(serialized);

    } catch (error) {
        console.error('Get Content API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
