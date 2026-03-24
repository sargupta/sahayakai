'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { outboxManager } from '@/lib/message-outbox';
import { OutboxMessage, Message, MessageType, SharedResource } from '@/types/messages';
import { sendMessageAction } from '@/app/actions/messages';
import { useAuth } from '@/context/auth-context';
import { v4 as uuidv4 } from 'uuid';

interface SendParams {
    conversationId?: string;  // optional override, defaults to hook's conversationId
    text: string;
    type?: MessageType;
    resource?: SharedResource;
    audioUrl?: string;
    audioDuration?: number;
    localBlobUrl?: string;
}

/**
 * Hook for managing the offline message outbox for a conversation.
 *
 * Returns:
 * - outboxMessages: pending messages in the outbox for this conversation
 * - sendWithOutbox: send a message via the outbox (offline-first)
 * - retryMessage: retry a failed message
 * - mergeWithFirestore: takes Firestore messages and returns merged+sorted array
 */
export function useMessageOutbox(conversationId: string) {
    const { user } = useAuth();
    const [outboxMessages, setOutboxMessages] = useState<OutboxMessage[]>([]);
    const conversationIdRef = useRef(conversationId);
    conversationIdRef.current = conversationId;

    // Load outbox messages (sync from in-memory cache)
    const refreshOutbox = useCallback(() => {
        setOutboxMessages(outboxManager.getMessages(conversationIdRef.current));
    }, []);

    // Flush: attempt to send all queued messages
    const flush = useCallback(() => {
        outboxManager.flush(async (msg) => {
            return sendMessageAction({
                conversationId: msg.conversationId,
                text: msg.text,
                type: msg.type,
                resource: msg.resource,
                audioUrl: msg.audioUrl,
                audioDuration: msg.audioDuration,
                clientMessageId: msg.clientMessageId,
            });
        });
        // Refresh after flush kicks off (status changes to 'sending')
        refreshOutbox();
        // Also refresh after a short delay to pick up sent/failed statuses
        setTimeout(refreshOutbox, 1000);
        setTimeout(refreshOutbox, 3000);
    }, [refreshOutbox]);

    useEffect(() => {
        // Load from IndexedDB into cache, then refresh
        outboxManager.loadCache().then(refreshOutbox);

        // Listen for online events to trigger flush
        const handleOnline = () => flush();
        window.addEventListener('online', handleOnline);

        // Subscribe to outbox changes
        const unsubscribe = outboxManager.subscribe(() => {
            refreshOutbox();
        });

        return () => {
            window.removeEventListener('online', handleOnline);
            unsubscribe?.();
        };
    }, [conversationId, flush, refreshOutbox]);

    // Enqueue a new message into the outbox
    const sendWithOutbox = useCallback(
        (params: SendParams) => {
            const clientMessageId = uuidv4();
            const outboxMsg: OutboxMessage = {
                clientMessageId,
                conversationId: conversationIdRef.current,
                text: params.text,
                type: params.type ?? 'text',
                resource: params.resource,
                audioUrl: params.audioUrl,
                audioDuration: params.audioDuration,
                localBlobUrl: params.localBlobUrl,
                status: 'queued',
                retryCount: 0,
                createdAt: Date.now(),
            };

            outboxManager.enqueue(outboxMsg);
            refreshOutbox();
            flush();

            return clientMessageId;
        },
        [flush, refreshOutbox],
    );

    // Retry a failed message
    const retryMessage = useCallback(
        (clientMessageId: string) => {
            outboxManager.updateStatus(clientMessageId, 'queued');
            refreshOutbox();
            flush();
        },
        [flush, refreshOutbox],
    );

    // Convert an outbox message to a Message shape for rendering
    const outboxToMessage = useCallback((om: OutboxMessage): Message => ({
        id: om.clientMessageId,
        clientMessageId: om.clientMessageId,
        type: om.type,
        text: om.text,
        senderId: user?.uid ?? '',
        senderName: user?.displayName ?? 'You',
        senderPhotoURL: user?.photoURL ?? null,
        resource: om.resource,
        audioUrl: om.audioUrl,
        audioDuration: om.audioDuration,
        readBy: [],
        createdAt: null,
        deliveryStatus: om.status === 'queued' || om.status === 'sending' ? 'sending' : om.status === 'failed' ? 'failed' : 'sent',
    }), [user]);

    // Merge outbox messages with Firestore messages for display
    const mergeWithFirestore = useCallback(
        (firestoreMessages: Message[]): Message[] => {
            // Build a set of clientMessageIds already in Firestore
            const confirmedIds = new Set<string>();
            for (const msg of firestoreMessages) {
                if (msg.clientMessageId) {
                    confirmedIds.add(msg.clientMessageId);
                }
            }

            // Filter outbox to only items not yet confirmed in Firestore
            const pendingOutbox = outboxMessages.filter(
                (om) => !confirmedIds.has(om.clientMessageId),
            );

            // Clean up sent items that are now in Firestore
            for (const om of outboxMessages) {
                if (confirmedIds.has(om.clientMessageId)) {
                    outboxManager.remove(om.clientMessageId);
                }
            }

            // Convert pending outbox to Message shape and append
            return [
                ...firestoreMessages,
                ...pendingOutbox.map(outboxToMessage),
            ];
        },
        [outboxMessages, outboxToMessage],
    );

    return {
        outboxMessages,
        sendWithOutbox,
        retryMessage,
        mergeWithFirestore,
    };
}
