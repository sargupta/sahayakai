/**
 * Firestore adapter for ConversationCallRepo (layout in repo.ts).
 *
 * Query chains use literal collection ids in the chained style so Gate 12
 * (scripts/ci/check-firestore-indexes.mjs) can see them; the composite index the
 * phone-hash count needs is declared in firestore.indexes.json.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { ConversationCallRepo, ConversationLink } from './repo';
import type { ConversationCall } from './types';

/** gRPC ALREADY_EXISTS — what `.create()` throws when the document exists. */
const ALREADY_EXISTS = 6;

function isAlreadyExists(err: unknown): boolean {
    const e = err as { code?: unknown; message?: unknown };
    return e?.code === ALREADY_EXISTS || e?.code === 'already-exists' || /ALREADY_EXISTS/i.test(String(e?.message ?? ''));
}

function clean<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export class FirestoreConversationRepo implements ConversationCallRepo {
    constructor(private readonly db: Firestore) {}

    private callRef(orgId: string, callId: string) {
        return this.db.collection('sampark_schools').doc(orgId).collection('sampark_conversation_calls').doc(callId);
    }

    async createCallIfAbsent(call: ConversationCall): Promise<boolean> {
        try {
            await this.callRef(call.orgId, call.id).create(clean(call));
            return true;
        } catch (err) {
            if (isAlreadyExists(err)) return false;
            throw err;
        }
    }

    async getCall(orgId: string, callId: string): Promise<ConversationCall | null> {
        const snap = await this.callRef(orgId, callId).get();
        return snap.exists ? (snap.data() as ConversationCall) : null;
    }

    async mutateCall(orgId: string, callId: string, mutate: (current: ConversationCall) => ConversationCall | null): Promise<ConversationCall | null> {
        const ref = this.callRef(orgId, callId);
        return this.db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            if (!snap.exists) return null;
            const current = snap.data() as ConversationCall;
            const next = mutate(current);
            if (!next) return current;
            tx.set(ref, clean(next));
            return next;
        });
    }

    async listCalls(orgId: string, limit: number): Promise<ConversationCall[]> {
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_conversation_calls')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snap.docs.map((d) => d.data() as ConversationCall);
    }

    async linkConversation(conversationId: string, link: ConversationLink): Promise<boolean> {
        try {
            await this.db.collection('sampark_conversation_links').doc(conversationId).create(clean(link));
            return true;
        } catch (err) {
            if (isAlreadyExists(err)) return false;
            throw err;
        }
    }

    async getLink(conversationId: string): Promise<ConversationLink | null> {
        const snap = await this.db.collection('sampark_conversation_links').doc(conversationId).get();
        return snap.exists ? (snap.data() as ConversationLink) : null;
    }

    async countRealCallsToPhoneSince(orgId: string, phoneHash: string, since: Date): Promise<number> {
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_conversation_calls')
            .where('phoneHash', '==', phoneHash)
            .where('createdAt', '>=', since.toISOString())
            .select('provider')
            .get();
        // Filtered here, not in the query: an inequality on `provider` would need its own index.
        return snap.docs.filter((d) => d.get('provider') !== 'simulated').length;
    }

    async countCallsSince(orgId: string, since: Date, provider: ConversationCall['provider']): Promise<number> {
        const snap = await this.db.collection('sampark_schools').doc(orgId).collection('sampark_conversation_calls')
            .where('createdAt', '>=', since.toISOString())
            .select('provider')
            .get();
        return snap.docs.filter((d) => d.get('provider') === provider).length;
    }
}
