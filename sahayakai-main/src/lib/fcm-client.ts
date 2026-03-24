'use client';

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from '@/lib/firebase';

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

async function getMessagingInstance() {
    if (messagingInstance) return messagingInstance;
    const supported = await isSupported();
    if (!supported) return null;
    messagingInstance = getMessaging(app);
    return messagingInstance;
}

/**
 * Request notification permission and get FCM token.
 * Returns the token string, or null if permission denied or not supported.
 */
export async function requestNotificationPermission(): Promise<string | null> {
    try {
        const messaging = await getMessagingInstance();
        if (!messaging) return null;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        // VAPID key from Firebase Console → Cloud Messaging → Web configuration
        const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        });

        return token;
    } catch {
        return null;
    }
}

/**
 * Register a handler for foreground messages.
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(
    callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void
): Promise<(() => void) | null> {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    return onMessage(messaging, (payload) => {
        callback({
            title: payload.notification?.title,
            body: payload.notification?.body,
            data: payload.data,
        });
    });
}
