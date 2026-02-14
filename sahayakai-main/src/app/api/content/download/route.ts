
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { getStorageInstance } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * @swagger
 * /api/content/download:
 *   get:
 *     summary: Get a signed download URL for a content item
 *     description: Returns a temporary signed URL to download files directly from Firebase Storage.
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Signed URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 downloadUrl:
 *                   type: string
 *                 filename:
 *                   type: string
 *       404:
 *         description: Content or file not found
 */
export async function GET(request: Request) {
    try {
        // 1. Auth Check
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Query
        const { searchParams } = new URL(request.url);
        const contentId = searchParams.get('id');

        if (!contentId) {
            return NextResponse.json({ error: 'Missing content ID' }, { status: 400 });
        }

        // 3. Metadata Lookup
        const content = await dbAdapter.getContent(userId, contentId);
        if (!content) {
            return NextResponse.json({ error: 'Content not found' }, { status: 404 });
        }

        // 4. Verify Storage Path exists
        if (!content.storagePath) {
            return NextResponse.json({
                error: 'File not available in storage',
                details: 'This content might be from an older version or failed to save correctly.'
            }, { status: 404 });
        }

        // 5. Generate Signed URL
        const storage = await getStorageInstance();
        const bucket = storage.bucket();
        const file = bucket.file(content.storagePath);

        const [exists] = await file.exists();
        if (!exists) {
            return NextResponse.json({ error: 'File missing from storage bucket' }, { status: 404 });
        }

        // Sanitize filename for header - strict alphanumeric to prevent header splitting
        const safeTitle = (content.title || 'content').replace(/[^a-z0-9]/gi, '_');
        const extension = content.storagePath.split('.').pop() || 'file';
        const downloadFilename = `SahayakAI_${safeTitle}.${extension}`;

        // Generate URL valid for 15 minutes
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000,
            responseDisposition: `attachment; filename="${downloadFilename}"`
        });

        return NextResponse.json({
            downloadUrl: url,
            filename: downloadFilename
        });

    } catch (error) {
        console.error('Download API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
