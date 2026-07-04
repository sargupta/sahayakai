/**
 * Typed client wrappers for /api/messages/* (tranche 5 migration).
 *
 * Exported names and signatures are IDENTICAL to the old server actions in
 * src/app/actions/messages.ts — components/hooks only change their import
 * path. Identity is never sent for authorization: the middleware-verified
 * Bearer token (attached by apiFetch) is the only trusted identity; uid
 * parameters are cross-checked server-side exactly as before.
 */
import { apiFetch } from '@/lib/api/client';
import type { SharedResource } from '@/types/messages';

export async function getOrCreateDirectConversationAction(
    myUid: string,
    otherUid: string,
): Promise<{ conversationId: string }> {
    return apiFetch('/api/messages/conversations/direct', { body: { myUid, otherUid } });
}

export async function createGroupConversationAction(
    creatorUid: string,
    participantUids: string[],  // must include creatorUid
    name: string,
): Promise<{ conversationId: string }> {
    return apiFetch('/api/messages/conversations/group', { body: { creatorUid, participantUids, name } });
}

export async function sendMessageAction(params: {
    conversationId: string;
    text: string;
    type?: 'text' | 'resource' | 'audio';
    resource?: SharedResource;
    audioUrl?: string;
    audioDuration?: number;
    clientMessageId?: string;
}): Promise<{ messageId: string }> {
    return apiFetch('/api/messages/send', { body: params });
}

export async function markConversationReadAction(
    conversationId: string,
    userId: string,
): Promise<void> {
    await apiFetch('/api/messages/mark-read', { body: { conversationId, userId } });
}

export async function getTotalUnreadCountAction(userId: string): Promise<number> {
    const { total } = await apiFetch<{ total: number }>(
        `/api/messages/unread-count?userId=${encodeURIComponent(userId)}`,
    );
    return total;
}

export async function acknowledgeDeliveryAction(
    conversationId: string,
    messageIds: string[],
): Promise<void> {
    await apiFetch('/api/messages/ack-delivery', { body: { conversationId, messageIds } });
}
