'use client';

import { useEffect } from 'react';
import { ref, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

export function usePresence(uid: string | undefined) {
    useEffect(() => {
        if (!uid) return;

        const presenceRef = ref(rtdb, `presence/${uid}`);

        set(presenceRef, { online: true, lastSeen: serverTimestamp() });

        const disconnectRef = onDisconnect(presenceRef);
        disconnectRef.set({ online: false, lastSeen: serverTimestamp() });

        return () => {
            disconnectRef.cancel();
            set(presenceRef, { online: false, lastSeen: serverTimestamp() });
        };
    }, [uid]);
}
