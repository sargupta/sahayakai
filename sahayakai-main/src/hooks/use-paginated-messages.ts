'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    collection, query, orderBy, limitToLast, onSnapshot,
    endBefore, getDocs, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Message } from '@/types/messages';

const PAGE_SIZE = 30;

interface UsePaginatedMessagesReturn {
    messages: Message[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    loadMore: () => Promise<void>;
}

export function usePaginatedMessages(conversationId: string): UsePaginatedMessagesReturn {
    const [realtimeMessages, setRealtimeMessages] = useState<Message[]>([]);
    const [olderMessages, setOlderMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const oldestCursorRef = useRef<Timestamp | null>(null);

    // Real-time listener for the most recent PAGE_SIZE messages
    useEffect(() => {
        setRealtimeMessages([]);
        setOlderMessages([]);
        setLoading(true);
        setHasMore(true);
        oldestCursorRef.current = null;

        const msgCol = collection(db, 'conversations', conversationId, 'messages');
        const q = query(msgCol, orderBy('createdAt', 'asc'), limitToLast(PAGE_SIZE));

        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            setRealtimeMessages(msgs);
            setLoading(false);

            // Set cursor from the oldest realtime message
            if (msgs.length > 0 && msgs[0].createdAt) {
                oldestCursorRef.current = msgs[0].createdAt;
            }

            // If we got fewer than PAGE_SIZE, there are no older messages
            if (snap.docs.length < PAGE_SIZE) {
                setHasMore(false);
            }
        });

        return () => unsub();
    }, [conversationId]);

    // Load older messages (static fetch, not real-time)
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || !oldestCursorRef.current) return;

        setLoadingMore(true);
        try {
            const msgCol = collection(db, 'conversations', conversationId, 'messages');
            const q = query(
                msgCol,
                orderBy('createdAt', 'asc'),
                endBefore(oldestCursorRef.current),
                limitToLast(PAGE_SIZE),
            );

            const snap = await getDocs(q);
            const older = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));

            if (older.length < PAGE_SIZE) {
                setHasMore(false);
            }

            if (older.length > 0 && older[0].createdAt) {
                oldestCursorRef.current = older[0].createdAt;
            }

            // Prepend older messages, deduplicating by ID
            setOlderMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const newOlder = older.filter(m => !existingIds.has(m.id));
                return [...newOlder, ...prev];
            });
        } finally {
            setLoadingMore(false);
        }
    }, [conversationId, loadingMore, hasMore]);

    // Merge older + realtime, deduplicate
    const messages = (() => {
        const olderIds = new Set(olderMessages.map(m => m.id));
        const deduped = [
            ...olderMessages,
            ...realtimeMessages.filter(m => !olderIds.has(m.id)),
        ];
        return deduped;
    })();

    return { messages, loading, loadingMore, hasMore, loadMore };
}
