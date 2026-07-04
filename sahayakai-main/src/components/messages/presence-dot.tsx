'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { PRESENCE_STALE_MS } from '@/hooks/use-presence';

interface PresenceDotProps {
    uid: string;
    className?: string;
}

/**
 * Reads Firestore-Mumbai presence (see use-presence.ts). "Online" requires
 * both the explicit flag AND a fresh `lastSeen` — this recovers the
 * onDisconnect behaviour RTDB had: a crashed tab stops heartbeating, its
 * lastSeen goes stale, and the dot turns grey within PRESENCE_STALE_MS even
 * though no offline write ever arrived. A periodic recompute handles the
 * "writes simply stopped" case (no new snapshot fires).
 */
export function PresenceDot({ uid, className }: PresenceDotProps) {
    const [online, setOnline] = useState(false);
    const latest = useRef<{ online: boolean; lastSeenMs: number | null }>({ online: false, lastSeenMs: null });

    useEffect(() => {
        if (!uid) return;

        const recompute = () => {
            const { online: flag, lastSeenMs } = latest.current;
            setOnline(flag && lastSeenMs != null && Date.now() - lastSeenMs < PRESENCE_STALE_MS);
        };

        const unsub = onSnapshot(
            doc(db, 'presence', uid),
            (snap) => {
                const data = snap.data();
                const lastSeen = data?.lastSeen as Timestamp | undefined;
                latest.current = {
                    online: data?.online === true,
                    lastSeenMs: lastSeen ? lastSeen.toMillis() : null,
                };
                recompute();
            },
            () => { latest.current = { online: false, lastSeenMs: null }; setOnline(false); },
        );

        const tick = setInterval(recompute, PRESENCE_STALE_MS / 2);
        return () => { unsub(); clearInterval(tick); };
    }, [uid]);

    return (
        <div className={cn(
            "h-2.5 w-2.5 rounded-full border-2 border-white",
            online ? "bg-green-500" : "bg-slate-300",
            className,
        )} />
    );
}
