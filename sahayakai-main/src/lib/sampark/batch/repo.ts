/**
 * Persistence port for class-wide batch campaigns, with the in-memory adapter used by tests.
 * The Firestore adapter is firestore-repo.ts (layout in types.ts).
 */

import type { BatchCampaign } from './types';

export interface BatchCampaignRepo {
    /** Create-only. False when a campaign with this id already exists (it is NOT overwritten). */
    createIfAbsent(c: BatchCampaign): Promise<boolean>;
    get(orgId: string, id: string): Promise<BatchCampaign | null>;
    /** Transactional read-modify-write; `mutate` returns null to leave the record unchanged. */
    mutate(orgId: string, id: string, mutate: (current: BatchCampaign) => BatchCampaign | null): Promise<BatchCampaign | null>;
    /** Newest first. */
    list(orgId: string, limit: number): Promise<BatchCampaign[]>;
    /** Campaigns the queue still has to look at (`open`), any order, at most `limit`. */
    listOpen(orgId: string, limit: number): Promise<BatchCampaign[]>;
    /** Campaigns with this dedupe key (any status). */
    findByDedupeKey(orgId: string, dedupeKey: string): Promise<BatchCampaign[]>;
}

function copy<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

export function createMemoryBatchRepo(): BatchCampaignRepo & { records: Map<string, BatchCampaign> } {
    const records = new Map<string, BatchCampaign>();
    const key = (orgId: string, id: string) => `${orgId}/${id}`;
    return {
        records,
        async createIfAbsent(c) {
            const k = key(c.orgId, c.id);
            if (records.has(k)) return false;
            records.set(k, copy(c));
            return true;
        },
        async get(orgId, id) {
            const c = records.get(key(orgId, id));
            return c ? copy(c) : null;
        },
        async mutate(orgId, id, mutate) {
            const k = key(orgId, id);
            const current = records.get(k);
            if (!current) return null;
            const next = mutate(copy(current));
            if (next) records.set(k, copy({ ...next, version: current.version + 1 }));
            return copy(records.get(k) as BatchCampaign);
        },
        async list(orgId, limit) {
            return [...records.values()].filter((c) => c.orgId === orgId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(copy);
        },
        async listOpen(orgId, limit) {
            return [...records.values()].filter((c) => c.orgId === orgId && c.open).slice(0, limit).map(copy);
        },
        async findByDedupeKey(orgId, dedupeKey) {
            return [...records.values()].filter((c) => c.orgId === orgId && c.dedupeKey === dedupeKey).map(copy);
        },
    };
}
