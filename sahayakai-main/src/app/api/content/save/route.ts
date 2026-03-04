
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';
import { SaveContentSchema } from '@/ai/schemas/content-schemas';
import { z } from 'zod';
import { logger } from '@/lib/logger';

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

        // 3. Storage Logic (Ensure file exists in Storage with proper name)
        // Only if 'data' is present. If data is missing, we assume it's just a metadata update?
        // But for 'save', we usually have data.
        if (validContent.data) {
            const { getStorageInstance } = await import('@/lib/firebase-admin');
            const { format } = await import('date-fns');
            const { v4: uuidv4 } = await import('uuid');

            const storage = await getStorageInstance();
            const now = new Date();
            const timestamp = format(now, 'yyyyMMdd_HHmmss');

            // Generate clean filename
            const title = validContent.title || validContent.topic || 'Untitled';
            const safeTitle = title.substring(0, 50).replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_|_$/g, '');

            // Determine folder and extension
            let ext = 'json';
            let folder = 'others';
            const type = validContent.type;

            if (type === 'worksheet') {
                ext = 'md';
                folder = 'worksheets';
            } else if (type === 'lesson-plan') folder = 'lesson-plans';
            else if (type === 'quiz') folder = 'quizzes';
            else if (type === 'rubric') folder = 'rubrics';
            else if (type === 'visual-aid') {
                // Visual aids might store image data URI in 'data.imageDataUri'
                // But the main content data is usually the JSON metadata around it.
                // The image itself is often stored separately or embedded.
                // For 'visual-aid', validContent.data is likely the VisualAidOutput JSON.
                folder = 'visual-aids';
            }
            else if (type === 'instant-answer') folder = 'instant-answers';
            else if (type === 'virtual-field-trip') folder = 'virtual-field-trips';

            const fileName = `${timestamp}_${safeTitle}.${ext}`;
            const filePath = `users/${userId}/${folder}/${fileName}`;
            const file = storage.bucket().file(filePath);

            // For visual-aid: extract the base64 image and save as PNG separately
            // then strip imageDataUri from the Firestore document to avoid 1MB limit.
            if (type === 'visual-aid' && validContent.data?.imageDataUri) {
                const imageDataUri = validContent.data.imageDataUri as string;
                const base64Data = imageDataUri.replace(/^data:image\/\w+;base64,/, '');
                const imageBuffer = Buffer.from(base64Data, 'base64');

                const imgPath = `users/${userId}/visual-aids/${timestamp}_${safeTitle}.png`;
                const imgFile = storage.bucket().file(imgPath);
                const imgToken = uuidv4();
                await imgFile.save(imageBuffer, {
                    resumable: false,
                    metadata: {
                        contentType: 'image/png',
                        metadata: { firebaseStorageDownloadTokens: imgToken },
                    },
                });

                const imgStorageRef = `https://firebasestorage.googleapis.com/v0/b/${storage.bucket().name}/o/${encodeURIComponent(imgPath)}?alt=media&token=${imgToken}`;

                // Replace the heavy base64 with just the Storage URL
                validContent.data = {
                    ...(validContent.data as object),
                    imageDataUri: undefined,  // Strip from Firestore
                    storageRef: imgStorageRef, // Keep light reference
                };

                validContent.storagePath = imgPath;
            } else {
                // Prep content for other types
                let contentToSave: any = validContent.data;
                if (ext === 'json' && typeof contentToSave !== 'string') {
                    contentToSave = JSON.stringify(contentToSave);
                }

                const downloadToken = uuidv4();
                await file.save(contentToSave as any, {
                    resumable: false,
                    metadata: {
                        contentType: ext === 'json' ? 'application/json' : 'text/plain',
                        metadata: {
                            firebaseStorageDownloadTokens: downloadToken,
                        }
                    },
                });

                // Update content with storage path
                validContent.storagePath = filePath;
            }
        }

        // 4. Save to DB via Adapter
        await dbAdapter.saveContent(userId, validContent as any);

        return NextResponse.json({ success: true, id: validContent.id });

    } catch (error) {
        console.error("DEBUG SAVE ERROR:", error);
        const failedType = (request as any).body?.type || 'unknown';
        logger.error(`Save Content API Failed for type: ${failedType}`, error, 'CONTENT', { userId: request.headers.get('x-user-id') });
        return NextResponse.json(
            { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
