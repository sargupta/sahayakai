'use server';

import { getDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { buildDirectConversationId, SharedResource } from '@/types/messages';
import { dbAdapter } from '@/lib/db/adapter';
import { createNotification } from './notifications';

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string> {
    const h = await headers();
    const uid = h.get('x-user-id');
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

// ── getOrCreateDirectConversation ─────────────────────────────────────────────
// Returns the conversation ID for a 1:1 DM, creating it if it doesn't exist.

export async function getOrCreateDirectConversationAction(
    myUid: string,
    otherUid: string,
): Promise<{ conversationId: string }> {
    const callerId = await getAuthUserId();
    if (callerId !== myUid) throw new Error('Unauthorized');
    if (myUid === otherUid) throw new Error('Cannot message yourself');

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const conversationId = buildDirectConversationId(myUid, otherUid);
    const convRef = db.collection('conversations').doc(conversationId);
    const doc = await convRef.get();

    if (!doc.exists) {
        // Fetch both profiles to denormalize names/photos
        const [me, other] = await Promise.all([
            dbAdapter.getUser(myUid),
            dbAdapter.getUser(otherUid),
        ]);

        await convRef.set({
            type: 'direct',
            participantIds: [myUid, otherUid],
            participants: {
                [myUid]: {
                    displayName: me?.displayName ?? 'Teacher',
                    photoURL: me?.photoURL ?? null,
                    preferredLanguage: me?.preferredLanguage ?? 'en',
                },
                [otherUid]: {
                    displayName: other?.displayName ?? 'Teacher',
                    photoURL: other?.photoURL ?? null,
                    preferredLanguage: other?.preferredLanguage ?? 'en',
                },
            },
            lastMessage: '',
            lastMessageAt: null,
            lastMessageSenderId: '',
            unreadCount: { [myUid]: 0, [otherUid]: 0 },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
    }

    return { conversationId };
}

// ── createGroupConversation ───────────────────────────────────────────────────

export async function createGroupConversationAction(
    creatorUid: string,
    participantUids: string[],  // must include creatorUid
    name: string,
): Promise<{ conversationId: string }> {
    const callerId = await getAuthUserId();
    if (callerId !== creatorUid) throw new Error('Unauthorized');
    if (participantUids.length < 2) throw new Error('Group needs at least 2 members');
    if (participantUids.length > 50) throw new Error('Group cannot exceed 50 members');
    if (!name.trim()) throw new Error('Group name is required');

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const allUids = Array.from(new Set([creatorUid, ...participantUids]));

    // Fetch all profiles in batches of 10 (Firestore 'in' query limit)
    const profileBatches = [];
    for (let i = 0; i < allUids.length; i += 10) {
        profileBatches.push(dbAdapter.getUsers(allUids.slice(i, i + 10)));
    }
    const profileResults = await Promise.all(profileBatches);
    const allProfiles = profileResults.flat();

    const participants: Record<string, { displayName: string; photoURL: string | null; preferredLanguage?: string }> = {};
    for (const p of allProfiles) {
        participants[p.uid] = {
            displayName: p.displayName ?? 'Teacher',
            photoURL: p.photoURL ?? null,
            preferredLanguage: p.preferredLanguage ?? 'en',
        };
    }

    const convRef = db.collection('conversations').doc();
    await convRef.set({
        type: 'group',
        name: name.trim(),
        createdBy: creatorUid,
        participantIds: allUids,
        participants,
        lastMessage: `${participants[creatorUid]?.displayName ?? 'Teacher'} created the group`,
        lastMessageAt: FieldValue.serverTimestamp(),
        lastMessageSenderId: creatorUid,
        unreadCount: Object.fromEntries(allUids.map((uid) => [uid, 0])),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    return { conversationId: convRef.id };
}

// ── sendMessage ───────────────────────────────────────────────────────────────

export async function sendMessageAction({
    conversationId,
    text,
    type = 'text',
    resource,
}: {
    conversationId: string;
    text: string;
    type?: 'text' | 'resource';
    resource?: SharedResource;
}): Promise<{ messageId: string }> {
    // Identity always comes from the server — client never supplies senderId
    const senderId = await getAuthUserId();

    const trimmed = text.trim();
    if (!trimmed && type === 'text') throw new Error('Message cannot be empty');
    if (trimmed.length > 1000) throw new Error('Message too long (max 1000 chars)');

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const convRef = db.collection('conversations').doc(conversationId);
    const convDoc = await convRef.get();
    if (!convDoc.exists) throw new Error('Conversation not found');

    const convData = convDoc.data()!;
    if (!convData.participantIds.includes(senderId)) throw new Error('Not a participant');

    // Denormalize sender info from conversation snapshot
    const senderSnap = convData.participants?.[senderId];

    // Atomic transaction: add message + update conversation preview + increment unread
    const msgRef = convRef.collection('messages').doc();

    await db.runTransaction(async (tx) => {
        const messagePayload: Record<string, any> = {
            type,
            text: trimmed,
            senderId,
            senderName: senderSnap?.displayName ?? 'Teacher',
            senderPhotoURL: senderSnap?.photoURL ?? null,
            readBy: [senderId],
            createdAt: FieldValue.serverTimestamp(),
        };
        if (type === 'resource' && resource) {
            messagePayload.resource = resource;
        }

        tx.set(msgRef, messagePayload);

        // Increment unreadCount for all OTHER participants
        const unreadUpdates: Record<string, any> = {};
        for (const uid of convData.participantIds) {
            if (uid !== senderId) {
                unreadUpdates[`unreadCount.${uid}`] = FieldValue.increment(1);
            }
        }

        const preview = type === 'resource'
            ? `📎 ${resource?.title ?? 'Shared a resource'}`
            : trimmed.slice(0, 80);

        tx.update(convRef, {
            lastMessage: preview,
            lastMessageAt: FieldValue.serverTimestamp(),
            lastMessageSenderId: senderId,
            updatedAt: FieldValue.serverTimestamp(),
            ...unreadUpdates,
        });
    });

    // Fire-and-forget notifications to other participants
    const recipients = (convData.participantIds as string[]).filter((uid) => uid !== senderId);
    const conversationName = convData.type === 'group'
        ? convData.name
        : senderSnap?.displayName ?? 'Teacher';

    for (const recipientId of recipients) {
        createNotification({
            recipientId,
            type: 'SYSTEM',
            title: `New message from ${conversationName}`,
            message: type === 'resource'
                ? `📎 ${resource?.title ?? 'Shared a resource'}`
                : trimmed.slice(0, 80),
            senderId,
            senderName: senderSnap?.displayName ?? 'Teacher',
            senderPhotoURL: senderSnap?.photoURL ?? undefined,
            link: `/messages?open=${conversationId}`,
        }).catch(() => {});
    }

    return { messageId: msgRef.id };
}

// ── markConversationRead ──────────────────────────────────────────────────────

export async function markConversationReadAction(
    conversationId: string,
    userId: string,
): Promise<void> {
    const callerId = await getAuthUserId();
    if (callerId !== userId) throw new Error('Unauthorized');

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const convRef = db.collection('conversations').doc(conversationId);

    // Reset unread badge
    await convRef.update({ [`unreadCount.${userId}`]: 0 });

    // Mark recent messages as read. Firestore cannot negate array-contains,
    // so we fetch the last 50 and use arrayUnion (idempotent — no-op if already read).
    const recentSnap = await convRef
        .collection('messages')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

    if (!recentSnap.empty) {
        const batch = db.batch();
        recentSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { readBy: FieldValue.arrayUnion(userId) });
        });
        await batch.commit();
    }
}

// ── getTotalUnreadCount ───────────────────────────────────────────────────────
// Used by the sidebar badge.

export async function getTotalUnreadCountAction(userId: string): Promise<number> {
    const callerId = await getAuthUserId();
    if (callerId !== userId) throw new Error('Unauthorized');

    const db = await getDb();
    const snap = await db
        .collection('conversations')
        .where('participantIds', 'array-contains', userId)
        .get();

    let total = 0;
    snap.docs.forEach((doc) => {
        const data = doc.data();
        total += data.unreadCount?.[userId] ?? 0;
    });
    return total;
}
