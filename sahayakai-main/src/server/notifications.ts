/**
 * Notifications service — logic migrated verbatim from
 * src/app/actions/notifications.ts (tranche 5, docs/API_MIGRATION_PATTERN.md).
 * Routes under /api/notifications/* derive `userId` from the
 * middleware-verified `x-user-id` header and pass it in explicitly.
 *
 * Security invariants preserved from the action module (Wave 1):
 *   - reads/writes are always scoped to the authenticated caller's uid
 *   - markNotificationAsRead validates recipientId matches the caller
 *
 * Note: the action's `revalidatePath('/notifications')` calls are dropped —
 * the /notifications page fetches client-side and NotificationFeed already
 * calls router.refresh() after every mutation (see triggerRefresh).
 */
import { getDb } from '@/lib/firebase-admin';
import { dbAdapter } from '@/lib/db/adapter';
import { Notification } from '@/types';

/**
 * Get the caller's notifications.
 */
export async function getNotifications(userId: string) {
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
 * Wave 1: validates the notification's recipientId matches the caller.
 * Previously any signed-in user could mark any notification (anywhere in
 * the system) as read by passing its id.
 */
export async function markNotificationAsRead(userId: string, notificationId: string) {
    const db = await getDb();
    const ref = db.collection('notifications').doc(notificationId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data();
    if (data?.recipientId !== userId) {
        throw new Error('Forbidden: not the recipient of this notification');
    }
    await ref.update({ isRead: true });
}

/**
 * Mark all of the caller's notifications as read.
 */
export async function markAllAsRead(userId: string) {
    const db = await getDb();
    const snapshot = await db.collection('notifications')
        .where('recipientId', '==', userId)
        .where('isRead', '==', false)
        .get();

    // Firestore caps a batch at 500 writes. A user with >500 unread would throw
    // on commit() and NONE would get marked read. Chunk into batches of <=500
    // and commit each (mirrors the PAGE_SIZE=500 chunking in messages.ts).
    const BATCH_LIMIT = 500;
    for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
        const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        chunk.forEach(doc => {
            batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();
    }
}
