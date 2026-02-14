'use server';

import { dbAdapter } from '@/lib/db/adapter';
import { BaseContent, ContentType } from '@/types';
import { getStorageInstance } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Timestamp } from 'firebase-admin/firestore';

export async function getUserContent(userId: string): Promise<BaseContent[]> {
    try {
        const content = await dbAdapter.listContent(userId);

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
 */
export async function searchContentAction(userId: string, query: string): Promise<BaseContent[]> {
    try {
        // 1. Fetch user profile for context
        const profile = await dbAdapter.getUser(userId);

        // 2. Initial filter by user ID (Security boundary)
        const allContent = await dbAdapter.listContent(userId);

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

export async function saveToLibrary(userId: string, type: ContentType, title: string, data: any): Promise<{ success: boolean; id?: string; error?: string }> {
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

        logger.info(`Content successfully saved to library`, 'STORAGE', { userId, contentId, type, path: filePath });
        return { success: true, id: contentId };
    } catch (error: any) {
        logger.error("Failed to save to library", error, 'STORAGE', { userId, type, title });
        return { success: false, error: error.message };
    }
}

export async function recordPdfDownload(userId: string, title: string, base64Data: string, type: ContentType = 'lesson-plan'): Promise<{ success: boolean; path?: string; error?: string }> {
    const Sentry = await import('@sentry/nextjs');

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

            // Track in DB as a PDF record
            const contentId = `pdf_${uuidv4().substring(0, 8)}`;
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

            pdfTimer.stop({ size: buffer.length });
            return { success: true, path: filePath };
        } catch (error: any) {
            logger.error(`Failed to record PDF download`, error, 'STORAGE', { title, type });
            return { success: false, error: error.message };
        }
    });
}

export async function testStorageConnection(userId: string = 'user-123'): Promise<{ success: boolean; message: string }> {
    try {
        const storage = await getStorageInstance();
        const bucket = storage.bucket();
        const testPath = `users/${userId}/test_connection.json`;
        const testFile = bucket.file(testPath);

        console.log(`[STORAGE_TEST] Attempting write to bucket: ${bucket.name}`);

        await testFile.save(JSON.stringify({
            status: "connected",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
        }), {
            resumable: false, // Explicitly disable to avoid flaky behavior with Large payloads
            contentType: 'application/json'
        });

        console.log(`[STORAGE_TEST] SUCCESS: File written to ${testPath}`);
        return { success: true, message: `Successfully wrote to ${testPath} in bucket ${bucket.name}` };
    } catch (error: any) {
        console.error("[STORAGE_TEST] FAILURE:", error);
        return { success: false, message: error.message };
    }
}
