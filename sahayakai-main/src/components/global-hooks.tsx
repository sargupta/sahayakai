'use client';

import { usePresence } from '@/hooks/use-presence';
import { useFcmRegistration } from '@/hooks/use-fcm-registration';
import { useAuth } from '@/context/auth-context';

/**
 * Mounts global client-side hooks that need to run app-wide:
 * - RTDB presence (online/offline status)
 * - FCM push notification registration
 */
export function GlobalHooks() {
    const { user } = useAuth();
    usePresence(user?.uid);
    useFcmRegistration();
    return null;
}
