'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ref, set, onValue, remove } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

export function useTypingIndicator(conversationId: string, myUid: string | undefined) {
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [otherTypingName, setOtherTypingName] = useState<string | undefined>();
    const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setTyping = useCallback(() => {
        if (!myUid || !conversationId) return;

        // Debounce: only write once per 500ms
        if (debounceRef.current) return;

        const typingRef = ref(rtdb, `typing/${conversationId}/${myUid}`);
        set(typingRef, true);

        debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
        }, 500);

        // Auto-clear after 3 seconds
        if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = setTimeout(() => {
            remove(typingRef);
        }, 3000);
    }, [conversationId, myUid]);

    useEffect(() => {
        if (!conversationId || !myUid) return;

        const typingRef = ref(rtdb, `typing/${conversationId}`);
        const unsub = onValue(typingRef, (snap) => {
            const val = snap.val();
            if (!val) {
                setIsOtherTyping(false);
                setOtherTypingName(undefined);
                return;
            }
            const otherUids = Object.keys(val).filter((uid) => uid !== myUid && val[uid] === true);
            setIsOtherTyping(otherUids.length > 0);
            setOtherTypingName(otherUids.length > 0 ? otherUids[0] : undefined);
        });

        return () => {
            unsub();
            // Clear own typing on unmount
            const myTypingRef = ref(rtdb, `typing/${conversationId}/${myUid}`);
            remove(myTypingRef);
            if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [conversationId, myUid]);

    return { isOtherTyping, otherTypingName, setTyping };
}
