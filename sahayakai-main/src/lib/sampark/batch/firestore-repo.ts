/**
 * Firestore adapter for BatchCampaignRepo (layout in types.ts).
 *
 * Every query is a single-field filter or order on one school's subcollection (createdAt order,
 * `open` equality, `dedupeKey` equality), so Firestore's automatic single-field indexes serve them
 * and no composite index is needed. Literal collection ids so Gate 12
 * (scripts/ci/check-firestore-indexes.mjs) can read them.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { BatchCampaignRepo } from './repo';
import type { BatchCampaign } from './types';

/** gRPC ALREADY_EXISTS — what `.create()` throws when the document exists. */
const ALREADY_EXISTS = 6;

function isAlreadyExists(err: unknown): boolean {
    const e = err as { code?: unknown; message?: unknown };
    return e?.code === ALREADY_EXISTS || e?.code === 'already-exists' || /ALREADY_EXISTS/i.test(String(e?.message ?? ''));
}

function clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export class FirestoreBatchRepo implements BatchCampaignRepo {
    constructor(private readonly db: Firestore) {}

    private ref(orgId: string, id: string) {
        return this.db.collection('sampark_schools').doc(orgId).collection('sampark_batch_campaigns').doc(id);
    }

    async createIfAbsent(c: BatchCampaign): Promise<boolean> {
        try {
            await this.ref(c.orgId, c.id).create(clean(c));
            return true;
        } catch (err) {
            if (isAlreadyExists(err)) return false;
            throw err;
        }
    }

    async get(orgId: string, id: string): Promise<BatchCampaign | null> {
        const snap = await this.ref(orgId, id).get();
        return snap.exists ? (snap.data() as BatchCampaign) : null;
    }

    async mutate(orgId: string, id: string, mutate: (current: BatchCampaign) => BatchCampaign | null): Promise<BatchCampaign | null> {
        const ref = this.ref(orgId, id);
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return null;
            const current = snap.data() as BatchCampaign;
            const next = mutate(clean(current));
            if (!next) return current;
            const written = { ...next, version: current.version + 1 };
            tx.set(ref, clean(written));
            return written;
        });
    }

    async list(orgId: string, limit: number): Promise<BatchCampaign[]> {
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_batch_campaigns')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snap.docs.map((d) => d.data() as BatchCampaign);
    }

    async listOpen(orgId: string, limit: number): Promise<BatchCampaign[]> {
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_batch_campaigns')
            .where('open', '==', true)
            .limit(limit)
            .get();
        return snap.docs.map((d) => d.data() as BatchCampaign);
    }

    async findByDedupeKey(orgId: string, dedupeKey: string): Promise<BatchCampaign[]> {
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_batch_campaigns')
            .where('dedupeKey', '==', dedupeKey)
            .limit(20)
            .get();
        return snap.docs.map((d) => d.data() as BatchCampaign);
    }
}
