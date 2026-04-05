import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { logger } from '@/lib/logger';
import { publishStorageCleanup } from '@/lib/pubsub';

/**
 * @swagger
 * /api/content/delete:
 *   delete:
 *     summary: Soft-delete a content item
 *     description: Marks content as deleted (recoverable). Also removes the associated GCS file.
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
 *         description: Content deleted
 *       400:
 *         description: Missing id
 *       404:
 *         description: Content not found or already deleted
 */
export async function DELETE(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized: Missing User Identity' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        // Soft-delete in Firestore and get back the GCS path (if any)
        const storagePath = await dbAdapter.softDeleteContent(userId, id);

        if (storagePath === null) {
            // softDeleteContent returns null when the doc doesn't exist
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        // Enqueue async GCS cleanup via Pub/Sub — the subscriber handles the actual deletion
        // with automatic retries. This keeps the HTTP response fast and decoupled.
        if (storagePath) {
            await publishStorageCleanup({ storagePath, userId, contentId: id });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        logger.error('Delete Content API Failed', error, 'CONTENT', { userId: request.headers.get('x-user-id') });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
