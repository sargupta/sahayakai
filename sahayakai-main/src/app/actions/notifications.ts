"use server";

import { getDb } from "@/lib/firebase-admin";
import { dbAdapter } from "@/lib/db/adapter";
import { Notification } from "@/types";
import { revalidatePath } from "next/cache";

export async function createNotification(notification: Omit<Notification, 'id' | 'isRead' | 'createdAt'>) {
    const db = await getDb();

    const newNotification = {
        ...notification,
        isRead: false,
        createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('notifications').add(newNotification);
    return docRef.id;
}

export async function getNotificationsAction(userId: string) {
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

export async function markNotificationAsReadAction(notificationId: string) {
    const db = await getDb();
    await db.collection('notifications').doc(notificationId).update({
        isRead: true
    });
    revalidatePath("/notifications");
}

export async function markAllAsReadAction(userId: string) {
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
