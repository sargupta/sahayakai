/**
 * Where a school's Google connection lives. Admin SDK only (firestore.rules
 * default-deny: no browser reads any of this).
 *
 *   sampark_gcal_connections/{orgId}                 the connection (tokens encrypted, bound to orgId)
 *   sampark_gcal_connections/{orgId}/events/{id}     events seen by sync (no tokens; the reconciled copy)
 *   sampark_gcal_oauth_states/{sha256(state)}        one pending consent: single use, 10 minutes
 *   sampark_gcal_channels/{channelId}                a push channel → its school (token hashed)
 *   sampark_dev_mock_google/{calendarId}             the local fake Google (mock mode only)
 *
 * Every document is keyed by, or carries, the orgId it belongs to; a service call
 * reads only the connection of the school its route was authorised for.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { MockBackend, MockCalendarDoc } from './mock-api';
import type { GoogleCalendarMode } from './types';

export interface StoredConnection {
    orgId: string;
    mode: GoogleCalendarMode;
    state: 'connected' | 'reconnect_required' | 'error';
    accountLabel: string | null;
    scopes: string[];
    refreshTokenEnc: string;
    accessTokenEnc: string | null;
    accessTokenExpiresAt: string | null;
    calendar: { id: string; summary: string; timeZone: string } | null;
    connectedBy: string;
    connectedAt: string;
    updatedAt: string;
    lastError: { code: string; message: string; at: string } | null;
    syncToken: string | null;
    lastSyncedAt: string | null;
    lastFullSyncAt: string | null;
    channel: { id: string; resourceId: string; expiresAt: string } | null;
    pushError: string | null;
}

export interface OAuthStateRecord {
    orgId: string;
    uid: string;
    codeVerifierEnc: string;
    redirectUri: string;
    mode: GoogleCalendarMode;
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
}

export interface ChannelRecord {
    orgId: string;
    calendarId: string;
    resourceId: string;
    tokenHash: string;
    expiresAt: string;
    lastMessageNumber: number;
}

export interface CachedEvent {
    id: string;
    summary: string;
    status: 'confirmed' | 'tentative' | 'cancelled';
    allDay: boolean;
    start: string;
    end: string;
    recurringEventId: string | null;
    recurrence: string[] | null;
    updated: string | null;
}

export type ConsumeResult = { ok: true; record: OAuthStateRecord } | { ok: false; reason: 'unknown' | 'used' | 'expired' };

export interface GoogleCalendarStore {
    getConnection(orgId: string): Promise<StoredConnection | null>;
    putConnection(conn: StoredConnection): Promise<void>;
    patchConnection(orgId: string, patch: Partial<StoredConnection>): Promise<void>;
    /** Removes the connection and its cached events. */
    deleteConnection(orgId: string): Promise<void>;
    listConnections(): Promise<StoredConnection[]>;
    putOAuthState(hash: string, record: OAuthStateRecord): Promise<void>;
    /** Atomically: exists, unused, unexpired → mark used and return it. */
    consumeOAuthState(hash: string, now: Date): Promise<ConsumeResult>;
    putChannel(id: string, record: ChannelRecord): Promise<void>;
    getChannel(id: string): Promise<ChannelRecord | null>;
    deleteChannel(id: string): Promise<void>;
    /** Atomically: true and records `n` only when it is newer than the last message seen. */
    advanceChannelMessage(id: string, n: number): Promise<boolean>;
    applySync(orgId: string, upserts: CachedEvent[], deletes: string[], reset: boolean): Promise<void>;
    getCachedEvent(orgId: string, id: string): Promise<CachedEvent | null>;
    countCachedEvents(orgId: string): Promise<number>;
}

function clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export class FirestoreGoogleCalendarStore implements GoogleCalendarStore {
    constructor(private readonly db: Firestore) {}

    private conn(orgId: string) {
        return this.db.collection('sampark_gcal_connections').doc(orgId);
    }

    async getConnection(orgId: string) {
        const snap = await this.conn(orgId).get();
        return snap.exists ? (snap.data() as StoredConnection) : null;
    }
    async putConnection(conn: StoredConnection) {
        await this.conn(conn.orgId).set(clean(conn));
    }
    async patchConnection(orgId: string, patch: Partial<StoredConnection>) {
        await this.conn(orgId).update(clean(patch));
    }
    async deleteConnection(orgId: string) {
        const events = await this.conn(orgId).collection('events').get();
        for (let i = 0; i < events.docs.length; i += 400) {
            const batch = this.db.batch();
            for (const d of events.docs.slice(i, i + 400)) batch.delete(d.ref);
            await batch.commit();
        }
        await this.conn(orgId).delete();
    }
    async listConnections() {
        const snap = await this.db.collection('sampark_gcal_connections').get();
        return snap.docs.map((d) => d.data() as StoredConnection);
    }
    async putOAuthState(hash: string, record: OAuthStateRecord) {
        await this.db.collection('sampark_gcal_oauth_states').doc(hash).set(clean(record));
    }
    async consumeOAuthState(hash: string, now: Date): Promise<ConsumeResult> {
        const ref = this.db.collection('sampark_gcal_oauth_states').doc(hash);
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return { ok: false, reason: 'unknown' } as const;
            const record = snap.data() as OAuthStateRecord;
            if (record.usedAt) return { ok: false, reason: 'used' } as const;
            if (Date.parse(record.expiresAt) <= now.getTime()) return { ok: false, reason: 'expired' } as const;
            tx.update(ref, { usedAt: now.toISOString() });
            return { ok: true, record } as const;
        });
    }
    async putChannel(id: string, record: ChannelRecord) {
        await this.db.collection('sampark_gcal_channels').doc(id).set(clean(record));
    }
    async getChannel(id: string) {
        const snap = await this.db.collection('sampark_gcal_channels').doc(id).get();
        return snap.exists ? (snap.data() as ChannelRecord) : null;
    }
    async deleteChannel(id: string) {
        await this.db.collection('sampark_gcal_channels').doc(id).delete();
    }
    async advanceChannelMessage(id: string, n: number) {
        const ref = this.db.collection('sampark_gcal_channels').doc(id);
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return false;
            if ((snap.data() as ChannelRecord).lastMessageNumber >= n) return false;
            tx.update(ref, { lastMessageNumber: n });
            return true;
        });
    }
    async applySync(orgId: string, upserts: CachedEvent[], deletes: string[], reset: boolean) {
        const events = this.conn(orgId).collection('events');
        if (reset) {
            const all = await events.get();
            for (let i = 0; i < all.docs.length; i += 400) {
                const batch = this.db.batch();
                for (const d of all.docs.slice(i, i + 400)) batch.delete(d.ref);
                await batch.commit();
            }
        }
        const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [
            ...upserts.map((e) => (b: FirebaseFirestore.WriteBatch) => void b.set(events.doc(e.id), clean(e))),
            ...deletes.map((id) => (b: FirebaseFirestore.WriteBatch) => void b.delete(events.doc(id))),
        ];
        for (let i = 0; i < ops.length; i += 400) {
            const batch = this.db.batch();
            for (const op of ops.slice(i, i + 400)) op(batch);
            await batch.commit();
        }
    }
    async getCachedEvent(orgId: string, id: string) {
        const snap = await this.conn(orgId).collection('events').doc(id).get();
        return snap.exists ? (snap.data() as CachedEvent) : null;
    }
    async countCachedEvents(orgId: string) {
        const snap = await this.conn(orgId).collection('events').count().get();
        return snap.data().count;
    }
}

export class MemoryGoogleCalendarStore implements GoogleCalendarStore {
    connections = new Map<string, StoredConnection>();
    states = new Map<string, OAuthStateRecord>();
    channels = new Map<string, ChannelRecord>();
    events = new Map<string, Map<string, CachedEvent>>();

    async getConnection(orgId: string) {
        return structuredClone(this.connections.get(orgId) ?? null);
    }
    async putConnection(conn: StoredConnection) {
        this.connections.set(conn.orgId, clean(conn));
    }
    async patchConnection(orgId: string, patch: Partial<StoredConnection>) {
        const cur = this.connections.get(orgId);
        if (!cur) throw new Error('NOT_FOUND');
        this.connections.set(orgId, clean({ ...cur, ...patch }));
    }
    async deleteConnection(orgId: string) {
        this.connections.delete(orgId);
        this.events.delete(orgId);
    }
    async listConnections() {
        return [...this.connections.values()].map((c) => structuredClone(c));
    }
    async putOAuthState(hash: string, record: OAuthStateRecord) {
        this.states.set(hash, clean(record));
    }
    async consumeOAuthState(hash: string, now: Date): Promise<ConsumeResult> {
        const record = this.states.get(hash);
        if (!record) return { ok: false, reason: 'unknown' };
        if (record.usedAt) return { ok: false, reason: 'used' };
        if (Date.parse(record.expiresAt) <= now.getTime()) return { ok: false, reason: 'expired' };
        record.usedAt = now.toISOString();
        return { ok: true, record: structuredClone(record) };
    }
    async putChannel(id: string, record: ChannelRecord) {
        this.channels.set(id, clean(record));
    }
    async getChannel(id: string) {
        return structuredClone(this.channels.get(id) ?? null);
    }
    async deleteChannel(id: string) {
        this.channels.delete(id);
    }
    async advanceChannelMessage(id: string, n: number) {
        const c = this.channels.get(id);
        if (!c || c.lastMessageNumber >= n) return false;
        c.lastMessageNumber = n;
        return true;
    }
    async applySync(orgId: string, upserts: CachedEvent[], deletes: string[], reset: boolean) {
        const map = reset || !this.events.has(orgId) ? new Map<string, CachedEvent>() : this.events.get(orgId)!;
        for (const e of upserts) map.set(e.id, clean(e));
        for (const id of deletes) map.delete(id);
        this.events.set(orgId, map);
    }
    async getCachedEvent(orgId: string, id: string) {
        return structuredClone(this.events.get(orgId)?.get(id) ?? null);
    }
    async countCachedEvents(orgId: string) {
        return this.events.get(orgId)?.size ?? 0;
    }
}

/** The local fake Google's data, in the Firestore EMULATOR (config.ts refuses mock mode elsewhere). */
export function firestoreMockBackend(db: Firestore): MockBackend {
    const ref = (calendarId: string) => db.collection('sampark_dev_mock_google').doc(encodeURIComponent(calendarId));
    return {
        async load(calendarId) {
            const snap = await ref(calendarId).get();
            return snap.exists ? (snap.data() as MockCalendarDoc) : { seq: 0, events: {} };
        },
        async save(calendarId, doc) {
            await ref(calendarId).set(clean(doc));
        },
    };
}
