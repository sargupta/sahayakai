import { openDB, DBSchema } from 'idb';

interface SahayakDB extends DBSchema {
    drafts: {
        key: string;
        value: any;
    };
    lesson_plan_cache: {
        key: string;
        value: any;
    };
    telemetry: {
        key: number;
        value: any;
    };
    message_outbox: {
        key: string;
        value: any;
    };
    message_cache: {
        key: string;
        value: any;
        indexes: { conversationId: string };
    };
}

const DB_NAME = 'sahayak-ai-db';
const DB_VERSION = 3; // Increment version

export async function initDB() {
    return openDB<SahayakDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('drafts')) {
                db.createObjectStore('drafts');
            }
            if (!db.objectStoreNames.contains('lesson_plan_cache')) {
                db.createObjectStore('lesson_plan_cache');
            }
            if (!db.objectStoreNames.contains('telemetry')) {
                db.createObjectStore('telemetry', { autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('message_outbox')) {
                db.createObjectStore('message_outbox');
            }
            if (!db.objectStoreNames.contains('message_cache')) {
                const cacheStore = db.createObjectStore('message_cache');
                cacheStore.createIndex('conversationId', 'conversationId');
            }
        },
    });
}

export async function saveDraft(key: string, data: any) {
    const db = await initDB();
    return db.put('drafts', data, key);
}

export async function getDraft(key: string) {
    const db = await initDB();
    return db.get('drafts', key);
}

export async function saveCache(key: string, data: any) {
    const db = await initDB();
    return db.put('lesson_plan_cache', data, key);
}

export async function getCache(key: string) {
    const db = await initDB();
    return db.get('lesson_plan_cache', key);
}

export async function logEvent(event: any) {
    const db = await initDB();
    return db.add('telemetry', { ...event, timestamp: Date.now() });
}

export async function getPendingEvents() {
    const db = await initDB();
    const keys = await db.getAllKeys('telemetry');
    const values = await db.getAll('telemetry');
    return keys.map((key, i) => ({ key, value: values[i] }));
}

export async function clearEvent(key: number) {
    const db = await initDB();
    return db.delete('telemetry', key);
}

const MAX_TELEMETRY_ITEMS = 500;

export async function pruneOldTelemetry() {
    const db = await initDB();
    const allKeys = await db.getAllKeys('telemetry');
    if (allKeys.length <= MAX_TELEMETRY_ITEMS) return;
    const toDelete = allKeys.slice(0, allKeys.length - MAX_TELEMETRY_ITEMS);
    const tx = db.transaction('telemetry', 'readwrite');
    await Promise.all(toDelete.map((k) => tx.store.delete(k)));
    await tx.done;
}
