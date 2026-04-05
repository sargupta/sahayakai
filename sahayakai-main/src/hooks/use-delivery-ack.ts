'use client';

import { useEffect, useRef, useCallback } from 'react';
import { acknowledgeDeliveryAction } from '@/app/actions/messages';

/**
 * Hook that tracks which messages become visible and batch-acknowledges delivery.
 *
 * Usage: attach `deliveryRef` to the message list container.
 * Call `observeMessage(messageId, element)` for each message from another user.
 */
export function useDeliveryAck(conversationId: string, myUid: string | undefined) {
    const pendingIds = useRef<Set<string>>(new Set());
    const flushTimer = useRef<NodeJS.Timeout | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const flush = useCallback(async () => {
        if (!myUid || pendingIds.current.size === 0) return;

        const ids = Array.from(pendingIds.current);
        pendingIds.current.clear();

        try {
            await acknowledgeDeliveryAction(conversationId, ids);
        } catch {
            // Re-add on failure for next flush
            ids.forEach(id => pendingIds.current.add(id));
        }
    }, [conversationId, myUid]);

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const msgId = (entry.target as HTMLElement).dataset.messageId;
                        if (msgId) {
                            pendingIds.current.add(msgId);

                            // Debounce flush to 2 seconds
                            if (flushTimer.current) clearTimeout(flushTimer.current);
                            flushTimer.current = setTimeout(flush, 2000);
                        }
                    }
                });
            },
            { threshold: 0.5 }
        );

        return () => {
            observerRef.current?.disconnect();
            if (flushTimer.current) {
                clearTimeout(flushTimer.current);
                // Flush remaining on unmount
                flush();
            }
        };
    }, [flush]);

    const observeMessage = useCallback((messageId: string, element: HTMLElement | null) => {
        if (!element || !observerRef.current) return;
        element.dataset.messageId = messageId;
        observerRef.current.observe(element);
    }, []);

    return { observeMessage };
}
