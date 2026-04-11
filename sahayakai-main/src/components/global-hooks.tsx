'use client';

import { useEffect } from 'react';
import { usePresence } from '@/hooks/use-presence';
import { useFcmRegistration } from '@/hooks/use-fcm-registration';
import { useAuth } from '@/context/auth-context';

/**
 * Mounts global client-side hooks that need to run app-wide:
 * - RTDB presence (online/offline status)
 * - FCM push notification registration
 * - Last-sync timestamp for offline page
 */
export function GlobalHooks() {
    const { user } = useAuth();
    usePresence(user?.uid);
    useFcmRegistration();

    // Write last-sync timestamp so offline.html can show "Last synced: ..."
    useEffect(() => {
        if (navigator.onLine) {
            try { localStorage.setItem('sahayakai-last-sync', new Date().toISOString()); } catch {}
        }
    }, []);

    return null;
}
