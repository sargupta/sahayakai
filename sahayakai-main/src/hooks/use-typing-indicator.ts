'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Typing indicator, on Firestore (Mumbai) — data-residency migration off RTDB.
 * See docs/MUMBAI_REGION_MIGRATION_RUNBOOK.md §6.3.
 *
 * Model: ONE doc per conversation — `typing_status/{conversationId}` — holding
 * `{ [uid]: <expiry Timestamp> }`. A user is "typing" while their expiry is in
 * the future. Writes are debounced to ≤1 / TYPING_DEBOUNCE_MS to bound cost;
 * entries self-expire (no delete needed), and `expireAt` lets a TTL policy
 * reap idle docs. Same external contract as the old RTDB hook.
 */
const TYPING_TTL_MS = 4_000;       // how long a keystroke keeps you "typing"
const TYPING_DEBOUNCE_MS = 2_000;  // at most one write per this window

export function useTypingIndicator(conversationId: string, myUid: string | undefined) {
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [otherTypingName, setOtherTypingName] = useState<string | undefined>();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const setTyping = useCallback(() => {
        if (!myUid || !conversationId) return;
        if (debounceRef.current) return; // within debounce window

        setDoc(
            doc(db, 'typing_status', conversationId),
            {
                [myUid]: Timestamp.fromMillis(Date.now() + TYPING_TTL_MS),
                expireAt: serverTimestamp(),
            },
            { merge: true },
        ).catch(() => { /* typing is best-effort */ });

        debounceRef.current = setTimeout(() => { debounceRef.current = null; }, TYPING_DEBOUNCE_MS);
    }, [conversationId, myUid]);

    useEffect(() => {
        if (!conversationId || !myUid) return;

        const ref = doc(db, 'typing_status', conversationId);
        let recomputeTimer: ReturnType<typeof setTimeout> | null = null;
        let current: Record<string, Timestamp> = {};

        const recompute = () => {
            const now = Date.now();
            const others = Object.entries(current)
                .filter(([uid, exp]) => uid !== myUid && exp instanceof Timestamp && exp.toMillis() > now)
                .map(([uid]) => uid);
            setIsOtherTyping(others.length > 0);
            setOtherTypingName(others[0]);
            // Re-run when the soonest entry expires so the indicator clears
            // even without a new snapshot.
            if (recomputeTimer) { clearTimeout(recomputeTimer); recomputeTimer = null; }
            if (others.length > 0) recomputeTimer = setTimeout(recompute, TYPING_TTL_MS);
        };

        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = (snap.data() ?? {}) as Record<string, unknown>;
                current = Object.fromEntries(
                    Object.entries(data).filter(([k, v]) => k !== 'expireAt' && v instanceof Timestamp),
                ) as Record<string, Timestamp>;
                recompute();
            },
            () => { setIsOtherTyping(false); setOtherTypingName(undefined); },
        );

        return () => {
            unsub();
            if (recomputeTimer) clearTimeout(recomputeTimer);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            // Best-effort: expire own entry immediately on unmount.
            setDoc(ref, { [myUid]: Timestamp.fromMillis(0) }, { merge: true }).catch(() => {});
        };
    }, [conversationId, myUid]);

    return { isOtherTyping, otherTypingName, setTyping };
}
