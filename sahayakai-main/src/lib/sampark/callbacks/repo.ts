/**
 * Persistence port for callbacks, with the in-memory adapter used by tests and the
 * dry run. The Firestore adapter is firestore-repo.ts; the layout is in types.ts.
 */

import type { SamparkCallback } from './types';

export interface CallbackRepo {
    /** Create-only. False when a callback with this id already exists (it is NOT overwritten). */
    createIfAbsent(cb: SamparkCallback): Promise<boolean>;
    get(orgId: string, id: string): Promise<SamparkCallback | null>;
    /** Transactional read-modify-write; `mutate` returns null to leave the record unchanged. */
    mutate(orgId: string, id: string, mutate: (current: SamparkCallback) => SamparkCallback | null): Promise<{ record: SamparkCallback; changed: boolean } | null>;
    /** Callbacks with scheduledAt in [fromIso, toIso), earliest first. */
    listScheduledBetween(orgId: string, fromIso: string, toIso: string, limit: number): Promise<SamparkCallback[]>;
    /** Proposals waiting for a person (their time may be unset). */
    listProposed(orgId: string, limit: number): Promise<SamparkCallback[]>;
    /** The worker's queue: queueAt <= nowIso, earliest first. */
    listQueued(orgId: string, nowIso: string, limit: number): Promise<SamparkCallback[]>;
}

function copy<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

export function createMemoryCallbackRepo(): CallbackRepo & { records: Map<string, SamparkCallback> } {
    const records = new Map<string, SamparkCallback>();
    const key = (orgId: string, id: string) => `${orgId}/${id}`;
    const inSchool = (orgId: string) => [...records.values()].filter((c) => c.orgId === orgId);
    return {
        records,
        async createIfAbsent(cb) {
            const k = key(cb.orgId, cb.id);
            if (records.has(k)) return false;
            records.set(k, copy(cb));
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
            if (next) records.set(k, copy(next));
            return { record: copy(records.get(k) as SamparkCallback), changed: next !== null };
        },
        async listScheduledBetween(orgId, fromIso, toIso, limit) {
            return inSchool(orgId)
                .filter((c) => c.scheduledAt !== null && c.scheduledAt >= fromIso && c.scheduledAt < toIso)
                .sort((a, b) => (a.scheduledAt as string).localeCompare(b.scheduledAt as string))
                .slice(0, limit)
                .map(copy);
        },
        async listProposed(orgId, limit) {
            return inSchool(orgId)
                .filter((c) => c.status === 'proposed')
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, limit)
                .map(copy);
        },
        async listQueued(orgId, nowIso, limit) {
            return inSchool(orgId)
                .filter((c) => c.queueAt !== null && c.queueAt <= nowIso)
                .sort((a, b) => (a.queueAt as string).localeCompare(b.queueAt as string))
                .slice(0, limit)
                .map(copy);
        },
    };
}
