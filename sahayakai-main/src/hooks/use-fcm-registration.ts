'use client';

import { useEffect, useRef } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '@/lib/fcm-client';
import { useAuth } from '@/context/auth-context';

/**
 * Registers FCM token on mount when user is authenticated.
 * Handles foreground message display.
 */
export function useFcmRegistration() {
    const { user } = useAuth();
    const registeredRef = useRef(false);

    useEffect(() => {
        if (!user || registeredRef.current) return;
        registeredRef.current = true;

        (async () => {
            const token = await requestNotificationPermission();
            if (!token) return;

            // Save token to server
            try {
                await fetch('/api/fcm/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
            } catch {
                // Silent fail — will retry on next app start
            }
        })();

        // Handle foreground messages (show toast or in-app notification)
        let unsub: (() => void) | null = null;
        onForegroundMessage((payload) => {
            // Don't show browser notification if app is focused — the real-time listener handles it
            // But we could show a toast here if desired
            console.log('[FCM] Foreground message:', payload);
        }).then(fn => { unsub = fn; });

        return () => {
            unsub?.();
            registeredRef.current = false;
        };
    }, [user]);
}
