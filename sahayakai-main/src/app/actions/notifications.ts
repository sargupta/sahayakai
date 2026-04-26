"use server";

import { getDb } from "@/lib/firebase-admin";
import { dbAdapter } from "@/lib/db/adapter";
import { Notification } from "@/types";
import { revalidatePath } from "next/cache";
import { requireAuth, getAuthUserIdOrNull } from "@/lib/auth-helpers";

/**
 * Server-only helper called from other server actions (community.ts,
 * messages.ts, connections.ts) to write a notification doc.
 *
 * Wave 1 hardening: the senderId field is now stamped from the session uid
 * if available — clients can no longer spoof who sent a notification by
 * passing a different senderId. Recipient is still arbitrary (server-side
 * code chooses who receives), since this is server→server.
 */
export async function createNotification(notification: Omit<Notification, 'id' | 'isRead' | 'createdAt'>) {
    const db = await getDb();
    const callerUid = await getAuthUserIdOrNull(); // null when invoked from a non-request context

    const newNotification = {
        ...notification,
        // Override senderId with the authenticated uid when the caller has one.
        // This prevents a malicious client (which CAN call this server action
        // directly because it's exported) from spoofing the sender.
        ...(callerUid ? { senderId: callerUid } : {}),
        isRead: false,
        createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('notifications').add(newNotification);
    return docRef.id;
}

/**
 * Get the caller's notifications.
 *
 * Wave 1: dropped trust-the-client `userId` parameter. The optional positional
 * `_userId` is preserved for one release so existing call sites compile —
 * the value is ignored.
 */
export async function getNotificationsAction(_userId?: string) {
    const userId = await requireAuth();
    void _userId;
    const db = await getDb();
    const snapshot = await db.collection('notifications')
        .where('recipientId', '==', userId)
        .limit(50)
        .get();

    const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Notification[];

    // In-memory sort (resilient to missing indexes)
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return dbAdapter.serialize(notifications);
}

/**
 * Mark a single notification as read.
 *
 * Wave 1: now validates the notification's recipientId matches the caller.
 * Previously any signed-in user could mark any notification (anywhere in
 * the system) as read by passing its id.
 */
export async function markNotificationAsReadAction(notificationId: string) {
    const userId = await requireAuth();
    const db = await getDb();
    const ref = db.collection('notifications').doc(notificationId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data();
    if (data?.recipientId !== userId) {
        throw new Error('Forbidden: not the recipient of this notification');
    }
    await ref.update({ isRead: true });
    revalidatePath("/notifications");
}

/**
 * Mark all of the caller's notifications as read.
 *
 * Wave 1: dropped trust-the-client `userId` parameter (caller could mark
 * anyone's notifications by passing arbitrary uid). The positional arg is
 * preserved for one release.
 */
export async function markAllAsReadAction(_userId?: string) {
    const userId = await requireAuth();
    void _userId;
    const db = await getDb();
    const snapshot = await db.collection('notifications')
        .where('recipientId', '==', userId)
        .where('isRead', '==', false)
        .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isRead: true });
    });

    await batch.commit();
    revalidatePath("/notifications");
}
