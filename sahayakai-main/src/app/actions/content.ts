'use server';

import { dbAdapter } from '@/lib/db/adapter';
import { BaseContent, ContentType } from '@/types';
import { getStorageInstance } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Timestamp } from 'firebase-admin/firestore';
import { aggregateUserMetrics } from './aggregator';
import { revalidatePath } from 'next/cache';
import { trackTeacherContent } from '@/lib/teacher-activity-tracker';
import { requireAuth } from '@/lib/auth-helpers';
import { validateAdmin } from '@/lib/auth-utils';

/**
 * Get the caller's own content. Wave 1 dropped trust-the-client `userId`
 * parameter — every prior caller passed `user.uid`, which an attacker could
 * substitute for any uid to dump that user's full library.
 */
export async function getUserContent(_userId?: string): Promise<BaseContent[]> {
    const userId = await requireAuth();
    void _userId;
    try {
        const { items: content } = await dbAdapter.listContent(userId, { limit: 100 });

        // Serialize Timestamps for client components as Next.js cannot serialize Class instances
        return content.map(item => ({
            ...item,
            createdAt: {
                seconds: (item.createdAt as any)?.seconds || (typeof (item.createdAt as any)?.toDate === 'function' ? Math.floor((item.createdAt as any).toDate().getTime() / 1000) : Math.floor(Date.now() / 1000)),
                nanoseconds: (item.createdAt as any)?.nanoseconds || 0,
                toDate: () => new Date(),
            },
            updatedAt: {
                seconds: (item.updatedAt as any)?.seconds || (typeof (item.updatedAt as any)?.toDate === 'function' ? Math.floor((item.updatedAt as any).toDate().getTime() / 1000) : Math.floor(Date.now() / 1000)),
                nanoseconds: (item.updatedAt as any)?.nanoseconds || 0,
                toDate: () => new Date(),
            }
        })) as unknown as BaseContent[];
    } catch (error) {
        logger.error("Failed to fetch user content", error, 'DATABASE', { userId });
        return [];
    }
}

/**
 * Context-Aware Smart Search for the Library
 * Searches user content and boosts matches based on teacher profile (Grade, Subject, Language)
 *
 * Wave 1: dropped trust-the-client `userId` parameter — caller could search
 * any user's library by passing arbitrary uid.
 */
export async function searchContentAction(_userId: string, query: string): Promise<BaseContent[]> {
    const userId = await requireAuth();
    void _userId;
    try {
        // 1. Fetch user profile for context
        const profile = await dbAdapter.getUser(userId);

        // 2. Initial filter by user ID (Security boundary)
        const { items: allContent } = await dbAdapter.listContent(userId, { limit: 200 });

        // 3. Perform Smart Search & Ranking
        const searchTerms = query.toLowerCase().split(/\s+/);

        const rankedResults = allContent
            .map(item => {
                let score = 0;
                const titleLower = item.title.toLowerCase();
                const topicLower = (item.topic || "").toLowerCase();

                // Term matching (Title boost)
                searchTerms.forEach(term => {
                    if (titleLower.includes(term)) score += 10;
                    if (topicLower.includes(term)) score += 5;
                });

                // Context Affinity Boosts
                if (profile) {
                    // Grade Level Affinity
                    if (profile.teachingGradeLevels?.includes(item.gradeLevel as any)) score += 15;

                    // Subject Affinity
                    if (profile.subjects?.includes(item.subject as any)) score += 15;

                    // Language Affinity
                    if (profile.preferredLanguage === item.language) score += 10;
                }

                return { ...item, _searchScore: score };
            })
            .filter(item => item._searchScore > 0 || query === "") // Show all if query empty, else only matches
            .sort((a, b) => b._searchScore - a._searchScore);

        // Remove ephemeral score before returning
        return rankedResults.map(({ _searchScore, ...item }: any) => item);

    } catch (error) {
        logger.error("Smart Search failed", error, 'DATABASE', { userId, query });
        return [];
    }
}

/**
 * Save content to the caller's library.
 *
 * Wave 1: dropped trust-the-client `userId`. Previously a caller could write
 * anything into anyone's library + Storage bucket by passing a different uid.
 */
export async function saveToLibrary(_userId: string, type: ContentType, title: string, data: any): Promise<{ success: boolean; id?: string; error?: string }> {
    const userId = await requireAuth();
    void _userId;
    try {
        const storage = await getStorageInstance();
        const now = new Date();
        const timestamp = format(now, 'yyyyMMdd_HHmmss');
        const contentId = uuidv4();
        const safeTitle = title.substring(0, 50).replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_|_$/g, '');

        // Determine file extension and sub-path
        let ext = 'json';
        let folder = 'other';
        if (type === 'worksheet') {
            ext = 'md';
            folder = 'worksheets';
        } else if (type === 'lesson-plan') {
            folder = 'lesson-plans';
        } else if (type === 'quiz') {
            folder = 'quizzes';
        } else if (type === 'rubric') {
            folder = 'rubrics';
        } else if (type === 'visual-aid') {
            ext = 'png';
            folder = 'visual-aids';
        } else if (type === 'instant-answer') {
            folder = 'instant-answers';
        } else if (type === 'virtual-field-trip') {
            folder = 'virtual-field-trips';
        }

        const fileName = `${timestamp}_${safeTitle}.${ext}`;
        const filePath = `users/${userId}/${folder}/${fileName}`;
        const file = storage.bucket().file(filePath);

        // Prep content for storage
        const storageContent = (ext === 'json') ? JSON.stringify(data) : data;

        const downloadToken = uuidv4();
        await file.save(storageContent, {
            resumable: false,
            metadata: {
                contentType: ext === 'json' ? 'application/json' : (ext === 'md' ? 'text/markdown' : 'image/png'),
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken,
                }
            },
        });

        await dbAdapter.saveContent(userId, {
            id: contentId,
            type,
            title,
            topic: title,
            storagePath: filePath,
            data,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
        } as any);

        revalidatePath("/my-library");
        revalidatePath("/impact-dashboard");

        // Background aggregation of totals for the dashboard
        aggregateUserMetrics(userId).catch(e => logger.error("Aggregator error during save", e));

        // Track this content creation event for the Impact Dashboard
        // This fires a 'content_created' event to /api/teacher-activity which updates
        // sessions_last_7_days, content_created_last_7_days in teacher_analytics/{userId}
        trackTeacherContent(type, { success: true });

        logger.info(`Content successfully saved to library`, 'STORAGE', { userId, contentId, type, path: filePath });
        return { success: true, id: contentId };
    } catch (error: any) {
        logger.error("Failed to save to library", error, 'STORAGE', { userId, type, title });
        // Wave 2b: don't leak Firebase/Storage internals to the client. The
        // raw error.message can contain bucket names, Secret-Manager paths,
        // or gRPC codes that are useful to an attacker.
        return { success: false, error: 'Failed to save. Please try again.' };
    }
}

/**
 * Record a PDF download by saving the binary to Storage + a tracking doc.
 *
 * Wave 1: dropped trust-the-client `userId`. Same spoof attack — caller could
 * write PDFs into anyone's Storage path.
 */
export async function recordPdfDownload(_userId: string, title: string, base64Data: string, type: ContentType = 'lesson-plan'): Promise<{ success: boolean; path?: string; error?: string }> {
    const Sentry = await import('@sentry/nextjs');
    const userId = await requireAuth();
    void _userId;

    return Sentry.withServerActionInstrumentation('recordPdfDownload', { recordResponse: true }, async () => {
        try {
            const pdfTimer = logger.startTimer(`Processing PDF Export`, 'STORAGE', { userId, type, title });
            const storage = await getStorageInstance();
            const bucket = storage.bucket();
            const now = new Date();
            const timestamp = format(now, 'yyyyMMdd_HHmmss');
            const safeTitle = title.substring(0, 50).replace(/[^a-z0-9]+/gi, '_').toLowerCase().replace(/^_|_$/g, '');

            let folder = 'others';
            if (type === 'lesson-plan') folder = 'lesson-plans';
            else if (type === 'quiz') folder = 'quizzes';
            else if (type === 'rubric') folder = 'rubrics';
            else if (type === 'worksheet') folder = 'worksheets';

            const fileName = `${timestamp}_${safeTitle}.pdf`;
            const filePath = `users/${userId}/${folder}/${fileName}`;
            const file = bucket.file(filePath);

            const buffer = await Sentry.startSpan({ name: 'Base64 to Buffer', op: 'serialize' }, async () => {
                const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
                return Buffer.from(base64Content, 'base64');
            });

            const downloadToken = uuidv4();
            await Sentry.startSpan({ name: 'GCP Storage Write', op: 'storage.write' }, async () => {
                await file.save(buffer, {
                    resumable: false,
                    metadata: {
                        contentType: 'application/pdf',
                        metadata: {
                            firebaseStorageDownloadTokens: downloadToken,
                        }
                    },
                });
            });

            // Track in DB as a PDF record — roll back the GCS file if this write fails
            // to prevent orphaned PDFs that can never be retrieved or deleted.
            const contentId = `pdf_${uuidv4().substring(0, 8)}`;
            try {
                await Sentry.startSpan({ name: 'Firestore Write', op: 'db.firestore.write' }, async () => {
                    const { Timestamp } = await import('firebase-admin/firestore');
                    await dbAdapter.saveContent(userId, {
                        id: contentId,
                        type: 'pdf' as any,
                        title: title + " (PDF Export)",
                        topic: title,
                        storagePath: filePath,
                        data: { format: 'pdf', timestamp: now.toISOString() },
                        isPublic: false,
                        isDraft: false,
                        createdAt: Timestamp.fromDate(now),
                        updatedAt: Timestamp.fromDate(now),
                    } as any);
                });
            } catch (dbError: any) {
                // Rollback: delete the orphaned GCS file
                bucket.file(filePath).delete()
                    .catch((cleanupErr: any) => logger.error('GCS PDF rollback failed', cleanupErr, 'STORAGE', { userId, filePath }));
                throw dbError;
            }

            pdfTimer.stop({ size: buffer.length });
            return { success: true, path: filePath };
        } catch (error: any) {
            logger.error(`Failed to record PDF download`, error, 'STORAGE', { title, type });
            // Wave 2b: scrub error.message before sending to the client.
            return { success: false, error: 'Failed to record PDF download.' };
        }
    });
}

/**
 * Diagnostic: write a tiny test file to Storage to confirm the bucket is
 * reachable. Wave 1 gates this to admins only — the previous default
 * `'user-123'` would write a bucket file under that constant uid path.
 */
export async function testStorageConnection(_userId: string = 'user-123'): Promise<{ success: boolean; message: string }> {
    const userId = await requireAuth();
    await validateAdmin(userId);
    void _userId;
    try {
        const storage = await getStorageInstance();
        const bucket = storage.bucket();
        const testPath = `users/${userId}/test_connection.json`;
        const testFile = bucket.file(testPath);

        logger.info(`Attempting write to bucket: ${bucket.name}`, 'STORAGE_TEST', { userId, path: testPath });

        await testFile.save(JSON.stringify({
            status: "connected",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        }), {
            resumable: false, // Explicitly disable to avoid flaky behavior with Large payloads
            contentType: 'application/json'
        });

        logger.info(`SUCCESS: File written to ${testPath}`, 'STORAGE_TEST', { bucket: bucket.name });
        return { success: true, message: `Successfully wrote to ${testPath} in bucket ${bucket.name}` };
    } catch (error: any) {
        logger.error(`FAILURE: Failed to write to storage`, error, 'STORAGE_TEST', { userId });
        return { success: false, message: error.message };
    }
}
