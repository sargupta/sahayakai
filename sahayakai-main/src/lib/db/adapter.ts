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
        return doc.data() as UserProfile;
    },

    async createUser(profile: UserProfile): Promise<void> {
        const db = await getDb();
        await db.collection(USERS_COLLECTION).doc(profile.uid).set(profile, { merge: true });
    },

    async updateUser(uid: string, data: Partial<UserProfile>): Promise<void> {
        const db = await getDb();
        await db.collection(USERS_COLLECTION).doc(uid).update({
            ...data,
            lastLogin: FieldValue.serverTimestamp(), // Always track activity
        });
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
                });
            logger.info(`Content saved successfully`, 'DATABASE', { userId, contentId: content.id, type: content.type });
        } catch (error) {
            logger.error(`Failed to save content`, error, 'DATABASE', { userId, contentId: content.id });
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
        filters?: { type?: ContentType; limit?: number }
    ): Promise<BaseContent[]> {
        const db = await getDb();
        let query = db.collection(USERS_COLLECTION).doc(userId).collection(CONTENT_COLLECTION).orderBy('createdAt', 'desc');

        if (filters?.type) {
            query = query.where('type', '==', filters.type);
        }

        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data() as BaseContent);
    },

    async deleteContent(userId: string, contentId: string): Promise<void> {
        const db = await getDb();
        await db
            .collection(USERS_COLLECTION)
            .doc(userId)
            .collection(CONTENT_COLLECTION)
            .doc(contentId)
            .delete();
    }
};
