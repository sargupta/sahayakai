/**
 * Firestore adapter for CallbackRepo (layout in types.ts).
 *
 * Every query is a single-field filter/order on one school's subcollection
 * (scheduledAt range, status equality, queueAt range), so Firestore's automatic
 * single-field indexes serve them and no composite index is needed. Chained
 * style with literal collection ids so Gate 12 (scripts/ci/check-firestore-indexes.mjs)
 * can read them.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { CallbackRepo } from './repo';
import type { SamparkCallback } from './types';

/** gRPC ALREADY_EXISTS — what `.create()` throws when the document exists. */
const ALREADY_EXISTS = 6;

function isAlreadyExists(err: unknown): boolean {
    const e = err as { code?: unknown; message?: unknown };
    return e?.code === ALREADY_EXISTS || e?.code === 'already-exists' || /ALREADY_EXISTS/i.test(String(e?.message ?? ''));
}

function clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export class FirestoreCallbackRepo implements CallbackRepo {
    constructor(private readonly db: Firestore) {}

    private ref(orgId: string, id: string) {
        return this.db.collection('sampark_schools').doc(orgId).collection('sampark_callbacks').doc(id);
    }

    async createIfAbsent(cb: SamparkCallback): Promise<boolean> {
        try {
            await this.ref(cb.orgId, cb.id).create(clean(cb));
            return true;
        } catch (err) {
            if (isAlreadyExists(err)) return false;
            throw err;
        }
    }

    async get(orgId: string, id: string): Promise<SamparkCallback | null> {
        const snap = await this.ref(orgId, id).get();
        return snap.exists ? (snap.data() as SamparkCallback) : null;
    }

    async mutate(orgId: string, id: string, mutate: (current: SamparkCallback) => SamparkCallback | null) {
        const ref = this.ref(orgId, id);
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return null;
            const current = snap.data() as SamparkCallback;
            const next = mutate(current);
            if (!next) return { record: current, changed: false };
            tx.set(ref, clean(next));
            return { record: next, changed: true };
        });
    }

    async listScheduledBetween(orgId: string, fromIso: string, toIso: string, limit: number): Promise<SamparkCallback[]> {
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_callbacks')
            .where('scheduledAt', '>=', fromIso)
            .where('scheduledAt', '<', toIso)
            .orderBy('scheduledAt')
            .limit(limit)
            .get();
        return snap.docs.map((d) => d.data() as SamparkCallback);
    }

    async listProposed(orgId: string, limit: number): Promise<SamparkCallback[]> {
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_callbacks')
            .where('status', '==', 'proposed')
            .limit(limit)
            .get();
        return snap.docs.map((d) => d.data() as SamparkCallback).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    async listQueued(orgId: string, nowIso: string, limit: number): Promise<SamparkCallback[]> {
        // queueAt is null on proposed and terminal records; a range filter never matches null.
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_callbacks')
            .where('queueAt', '<=', nowIso)
            .orderBy('queueAt')
            .limit(limit)
            .get();
        return snap.docs.map((d) => d.data() as SamparkCallback);
    }
}
