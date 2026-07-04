'use client';

import { useEffect } from 'react';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Presence, on Firestore (Mumbai) — data-residency migration off RTDB
 * (which has no India region). See docs/MUMBAI_REGION_MIGRATION_RUNBOOK.md §6.
 *
 * Firestore has no `onDisconnect`, so presence is a HEARTBEAT: while the tab
 * is visible we refresh `lastSeen` every heartbeat; readers (PresenceDot)
 * treat a stale `lastSeen` as offline. A crashed/closed tab simply stops
 * beating and goes stale within PRESENCE_STALE_MS — the same UX RTDB gave via
 * onDisconnect, a few seconds slower. `expireAt` lets a Firestore TTL policy
 * garbage-collect abandoned docs.
 *
 * Cost note: one small write per online tab per heartbeat, ONLY while the tab
 * is visible. Validate at concurrency before large rollouts (runbook §6.3).
 */
export const PRESENCE_HEARTBEAT_MS = 30_000;
export const PRESENCE_STALE_MS = 45_000; // > heartbeat, tolerant of one missed beat

export function usePresence(uid: string | undefined) {
    useEffect(() => {
        if (!uid) return;
        const ref = doc(db, 'presence', uid);

        const writeOnline = () =>
            setDoc(
                ref,
                {
                    online: true,
                    lastSeen: serverTimestamp(),
                    expireAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
                },
                { merge: true },
            ).catch(() => { /* presence is best-effort; never surface */ });

        const writeOffline = () =>
            setDoc(ref, { online: false, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});

        let timer: ReturnType<typeof setInterval> | null = null;
        const startBeat = () => { if (!timer) timer = setInterval(writeOnline, PRESENCE_HEARTBEAT_MS); };
        const stopBeat = () => { if (timer) { clearInterval(timer); timer = null; } };

        const onVisibility = () => {
            if (document.visibilityState === 'visible') { writeOnline(); startBeat(); }
            else { stopBeat(); writeOffline(); }
        };

        writeOnline();
        startBeat();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', writeOffline); // tab close/navigate away

        return () => {
            stopBeat();
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', writeOffline);
            writeOffline();
        };
    }, [uid]);
}
