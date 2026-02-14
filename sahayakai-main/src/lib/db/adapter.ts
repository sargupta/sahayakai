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
        filters?: {
            type?: ContentType;
            limit?: number;
            gradeLevels?: string[];
            subjects?: string[];
        }
    ): Promise<BaseContent[]> {
        const db = await getDb();
        let query = db.collection(USERS_COLLECTION).doc(userId).collection(CONTENT_COLLECTION).orderBy('createdAt', 'desc');

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
    }
};
