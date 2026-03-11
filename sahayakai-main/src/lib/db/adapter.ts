import { getDb } from '@/lib/firebase-admin';
import { BaseContent, ContentType, UserProfile } from '@/types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

const USERS_COLLECTION = 'users';
const CONTENT_COLLECTION = 'content';

export const dbAdapter = {
    // --- User Profile Operations ---

    async getUser(uid: string): Promise<UserProfile | null> {
        const db = await getDb();
        const doc = await db.collection(USERS_COLLECTION).doc(uid).get();
        if (!doc.exists) return null;
        return { uid, ...doc.data() } as UserProfile;
    },

    async getUsers(uids: string[]): Promise<UserProfile[]> {
        if (!uids.length) return [];
        const db = await getDb();
        const snapshot = await db.collection(USERS_COLLECTION)
            .where('uid', 'in', uids.slice(0, 10))
            .get();
        return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
    },

    async createUser(profile: UserProfile): Promise<void> {
        const db = await getDb();
        await db.collection(USERS_COLLECTION).doc(profile.uid).set(profile, { merge: true });
    },

    async updateUser(uid: string, data: Partial<UserProfile>): Promise<void> {
        const db = await getDb();
        const docRef = db.collection(USERS_COLLECTION).doc(uid);

        // Use set with merge: true to handle cases where the document might not exist (upsert)
        await docRef.set({
            ...data,
            uid, // Ensure UID is always present
            lastLogin: FieldValue.serverTimestamp(),
        }, { merge: true });
    },

    // --- Content Library Operations ---

    async saveContent<T = any>(userId: string, content: BaseContent<T>): Promise<void> {
        const db = await getDb();

        // Helper to remove undefined values recursively as Firestore rejects them
        const removeUndefined = (obj: any): any => {
            if (obj === undefined) return null; // Should not happen for keys, but for values
            if (obj === null) return null;
            if (typeof obj !== 'object') return obj;

            // Preserve Firestore Timestamp and Date objects
            // Checks for 'toDate' method which exists on Firestore Timestamps
            if (obj instanceof Date || (obj.toDate && typeof obj.toDate === 'function')) {
                return obj;
            }

            if (Array.isArray(obj)) {
                return obj.map(v => removeUndefined(v)).filter(v => v !== undefined);
            }

            const newObj: any = {};
            for (const key in obj) {
                const val = removeUndefined(obj[key]);
                if (val !== undefined) {
                    newObj[key] = val;
                }
            }
            return newObj;
        };

        try {
            await db
                .collection(USERS_COLLECTION)
                .doc(userId)
                .collection(CONTENT_COLLECTION)
                .doc(content.id)
                .set({
                    ...removeUndefined(content),
                    updatedAt: FieldValue.serverTimestamp(),
                }, { merge: true });
            const typeName = content.type || 'unknown';
            logger.info(`Successfully saved ${typeName} content ID: ${content.id}`, 'DATABASE', { userId, contentId: content.id, type: content.type });
        } catch (error) {
            const typeName = content?.type || 'unknown';
            logger.error(`Failed to save ${typeName} content ID: ${content?.id}`, error, 'DATABASE', { userId, contentId: content?.id });
            throw error;
        }
    },

    async getContent<T = any>(userId: string, contentId: string): Promise<BaseContent<T> | null> {
        const db = await getDb();
        const doc = await db
            .collection(USERS_COLLECTION)
            .doc(userId)
            .collection(CONTENT_COLLECTION)
            .doc(contentId)
            .get();

        if (!doc.exists) return null;
        return doc.data() as BaseContent;
    },

    async listContent(
        userId: string,
        filters?: {
            type?: ContentType;
            limit?: number;
            gradeLevels?: string[];
            subjects?: string[];
            cursorId?: string; // ID of the last doc from the previous page
        }
    ): Promise<{ items: BaseContent[]; nextCursor?: string }> {
        const db = await getDb();
        const pageSize = filters?.limit ?? 20;
        const collectionRef = db.collection(USERS_COLLECTION).doc(userId).collection(CONTENT_COLLECTION);
        let query = collectionRef.orderBy('createdAt', 'desc');

        if (filters?.type) {
            query = query.where('type', '==', filters.type);
        }

        if (filters?.gradeLevels && filters.gradeLevels.length > 0) {
            // Note: Limited to 10 items in array-contains-any
            query = query.where('gradeLevel', 'in', filters.gradeLevels.slice(0, 10));
        }

        if (filters?.subjects && filters.subjects.length > 0) {
            query = query.where('subject', 'in', filters.subjects.slice(0, 10));
        }

        // Resolve cursor document for startAfter
        if (filters?.cursorId) {
            const cursorDoc = await collectionRef.doc(filters.cursorId).get();
            if (cursorDoc.exists) {
                query = query.startAfter(cursorDoc);
            }
        }

        // Fetch one extra to know if there's a next page
        query = query.limit(pageSize + 1);

        const snapshot = await query.get();
        const allDocs = snapshot.docs;
        const hasMore = allDocs.length > pageSize;
        const pageDocs = hasMore ? allDocs.slice(0, pageSize) : allDocs;

        // Filter out soft-deleted items client-side — backward compatible with
        // older documents that predate the deletedAt field (they're treated as active).
        const items = pageDocs
            .map(doc => doc.data() as BaseContent)
            .filter(item => !item.deletedAt);

        const nextCursor = hasMore ? pageDocs[pageDocs.length - 1].id : undefined;
        return { items, nextCursor };
    },

    async softDeleteContent(userId: string, contentId: string): Promise<string | null> {
        const db = await getDb();
        const docRef = db
            .collection(USERS_COLLECTION)
            .doc(userId)
            .collection(CONTENT_COLLECTION)
            .doc(contentId);

        const doc = await docRef.get();
        if (!doc.exists) return null;

        const storagePath = (doc.data() as BaseContent)?.storagePath ?? null;

        // expiresAt is the TTL field Firestore uses to auto-purge 30 days from now.
        // deletedAt stays as the actual deletion timestamp for filtering/display.
        const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
        await docRef.update({
            deletedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            expiresAt,
        });

        logger.info(`Soft-deleted content ID: ${contentId}`, 'DATABASE', { userId, contentId });
        return storagePath;
    },

    async deleteContent(userId: string, contentId: string): Promise<void> {
        const db = await getDb();
        await db
            .collection(USERS_COLLECTION)
            .doc(userId)
            .collection(CONTENT_COLLECTION)
            .doc(contentId)
            .delete();
    },

    serialize<T>(data: T): T {
        return JSON.parse(JSON.stringify(data, (key, value) => {
            // Handle Firestore Timestamps
            if (value && typeof value === 'object' && '_seconds' in value && '_nanoseconds' in value) {
                return new Date(value._seconds * 1000).toISOString();
            }
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        }));
    },

    // --- Feedback Operations ---
    async saveFeedback(userId: string, feedbackData: any): Promise<void> {
        const db = await getDb();
        await db.collection('feedback').add({
            userId,
            ...feedbackData,
            createdAt: FieldValue.serverTimestamp(),
        });
        logger.info(`Feedback saved`, 'DATABASE', { userId, type: feedbackData.type });
    }
};
