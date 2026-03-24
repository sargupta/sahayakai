'use client';

import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface PresenceDotProps {
    uid: string;
    className?: string;
}

export function PresenceDot({ uid, className }: PresenceDotProps) {
    const [online, setOnline] = useState(false);

    useEffect(() => {
        const presenceRef = ref(rtdb, `presence/${uid}/online`);
        const unsub = onValue(presenceRef, (snap) => {
            setOnline(snap.val() === true);
        });
        return () => unsub();
    }, [uid]);

    return (
        <div className={cn(
            "h-2.5 w-2.5 rounded-full border-2 border-white",
            online ? "bg-green-500" : "bg-slate-300",
            className
        )} />
    );
}
