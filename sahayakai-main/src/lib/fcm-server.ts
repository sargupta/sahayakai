import { getDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * Send push notification to a user's registered devices.
 * Fire-and-forget — errors are silently caught.
 */
export async function sendPushToUser(
    recipientUid: string,
    notification: { title: string; body: string },
    data?: Record<string, string>,
): Promise<void> {
    try {
        const db = await getDb();

        // Get all FCM tokens for this user
        const tokensSnap = await db
            .collection('users')
            .doc(recipientUid)
            .collection('fcm_tokens')
            .get();

        if (tokensSnap.empty) return;

        const tokens = tokensSnap.docs.map(d => d.data().token as string).filter(Boolean);
        if (tokens.length === 0) return;

        const message: admin.messaging.MulticastMessage = {
            tokens,
            notification: {
                title: notification.title,
                body: notification.body,
            },
            data: data ?? {},
            webpush: {
                fcmOptions: {
                    link: data?.link || '/messages',
                },
            },
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Clean up invalid tokens
        if (response.failureCount > 0) {
            const batch = db.batch();
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                    // Find and delete the stale token doc
                    const staleToken = tokens[idx];
                    const tokenHash = Buffer.from(staleToken).toString('base64url').slice(0, 20);
                    batch.delete(
                        db.collection('users').doc(recipientUid).collection('fcm_tokens').doc(tokenHash)
                    );
                }
            });
            await batch.commit().catch(() => {});
        }
    } catch {
        // Fire-and-forget — never block message send on push failure
    }
}
