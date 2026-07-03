/**
 * Typed client wrappers for /api/notifications/* (tranche 5 migration).
 *
 * Exported names and signatures are IDENTICAL to the old server actions in
 * src/app/actions/notifications.ts — components only change their import
 * path. The optional positional `_userId` params (Wave 1 leftovers — the
 * value was already ignored server-side) are preserved so call sites compile
 * unchanged; identity comes from the Bearer token attached by apiFetch.
 */
import { apiFetch } from '@/lib/api/client';
import type { Notification } from '@/types';

export async function getNotificationsAction(_userId?: string): Promise<Notification[]> {
    void _userId;
    return apiFetch('/api/notifications');
}

export async function markNotificationAsReadAction(notificationId: string): Promise<void> {
    await apiFetch('/api/notifications/mark-read', { body: { notificationId } });
}

export async function markAllAsReadAction(_userId?: string): Promise<void> {
    void _userId;
    await apiFetch('/api/notifications/mark-all-read', { method: 'POST', body: {} });
}
