/**
 * Persistence port for Riya conversation calls, with the in-memory adapter used by
 * tests and the dry-run. The Firestore adapter is firestore-repo.ts.
 *
 * Layout (Admin SDK only; firestore.rules default-deny covers every sampark_* path):
 *   sampark_schools/{orgId}/sampark_conversation_calls/{callId}   ConversationCall (create-only)
 *   sampark_conversation_links/{providerConversationId}           { orgId, callId } (create-only)
 *
 * The link is global (a webhook carries a conversation id, not a school) and
 * create-only, so a forged or replayed event can never re-point a conversation at a
 * different school's call.
 */

import type { ConversationCall } from './types';

export interface ConversationLink {
    orgId: string;
    callId: string;
    createdAt: string;
}

export interface ConversationCallRepo {
    /** Create-only. False when a call with this id already exists (it is NOT overwritten). */
    createCallIfAbsent(call: ConversationCall): Promise<boolean>;
    getCall(orgId: string, callId: string): Promise<ConversationCall | null>;
    /** Transactional read-modify-write; `mutate` returns null to leave the record unchanged. */
    mutateCall(orgId: string, callId: string, mutate: (current: ConversationCall) => ConversationCall | null): Promise<ConversationCall | null>;
    listCalls(orgId: string, limit: number): Promise<ConversationCall[]>;
    /** Calls whose stored transcript is due for deletion (transcriptExpiresAt <= now), oldest first, at most `limit`. */
    listExpiredTranscripts(orgId: string, now: Date, limit: number): Promise<ConversationCall[]>;
    /** Create-only. False if the conversation id is already linked (to anything). */
    linkConversation(conversationId: string, link: ConversationLink): Promise<boolean>;
    getLink(conversationId: string): Promise<ConversationLink | null>;
    /** Calls to this phone hash created at or after `since` that could have rung a phone (not simulated). */
    countRealCallsToPhoneSince(orgId: string, phoneHash: string, since: Date): Promise<number>;
    /** Calls created at or after `since` in this school with this provider. */
    countCallsSince(orgId: string, since: Date, provider: ConversationCall['provider']): Promise<number>;
}

function copy<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

export function createMemoryConversationRepo(): ConversationCallRepo & { calls: Map<string, ConversationCall>; links: Map<string, ConversationLink> } {
    const calls = new Map<string, ConversationCall>();
    const links = new Map<string, ConversationLink>();
    const key = (orgId: string, id: string) => `${orgId}/${id}`;
    return {
        calls,
        links,
        async createCallIfAbsent(call) {
            const k = key(call.orgId, call.id);
            if (calls.has(k)) return false;
            calls.set(k, copy(call));
            return true;
        },
        async getCall(orgId, callId) {
            const c = calls.get(key(orgId, callId));
            return c ? copy(c) : null;
        },
        async mutateCall(orgId, callId, mutate) {
            const k = key(orgId, callId);
            const current = calls.get(k);
            if (!current) return null;
            const next = mutate(copy(current));
            if (next) calls.set(k, copy(next));
            return copy(calls.get(k) as ConversationCall);
        },
        async listCalls(orgId, limit) {
            return [...calls.values()]
                .filter((c) => c.orgId === orgId)
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
                .slice(0, limit)
                .map(copy);
        },
        async listExpiredTranscripts(orgId, now, limit) {
            const at = now.toISOString();
            return [...calls.values()]
                .filter((c) => c.orgId === orgId && c.transcriptExpiresAt !== null && c.transcriptExpiresAt <= at)
                .sort((a, b) => ((a.transcriptExpiresAt ?? '') < (b.transcriptExpiresAt ?? '') ? -1 : 1))
                .slice(0, limit)
                .map(copy);
        },
        async linkConversation(conversationId, link) {
            if (links.has(conversationId)) return false;
            links.set(conversationId, { ...link });
            return true;
        },
        async getLink(conversationId) {
            const l = links.get(conversationId);
            return l ? { ...l } : null;
        },
        async countRealCallsToPhoneSince(orgId, phoneHash, since) {
            const s = since.toISOString();
            return [...calls.values()].filter((c) => c.orgId === orgId && c.phoneHash === phoneHash && c.createdAt >= s && c.provider !== 'simulated').length;
        },
        async countCallsSince(orgId, since, provider) {
            const s = since.toISOString();
            return [...calls.values()].filter((c) => c.orgId === orgId && c.createdAt >= s && c.provider === provider).length;
        },
    };
}
