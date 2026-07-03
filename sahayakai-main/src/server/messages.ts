/**
 * Messages service — logic migrated verbatim from src/app/actions/messages.ts
 * (tranche 5, docs/API_MIGRATION_PATTERN.md). Routes under /api/messages/*
 * derive `callerId` from the middleware-verified `x-user-id` header and pass
 * it in explicitly; this module NEVER trusts a client-supplied identity for
 * authorization.
 *
 * Security invariants preserved from the action module (the forensic tests
 * are the spec):
 *   - caller-identity checks (`callerId !== myUid` → 'Unauthorized')
 *   - F2-02 (P1): participant check before markConversationRead mutations
 *   - F2-03 (P2): participant check before acknowledgeDelivery writes
 *   - F6-09: cursor-paged clearing of message notifications (>200 unread)
 *   - Wave 3 payload validation (audio URL host allowlist, duration bounds,
 *     resource field caps)
 */
import { getDb } from '@/lib/firebase-admin';
import { buildDirectConversationId, SharedResource } from '@/types/messages';
import { dbAdapter } from '@/lib/db/adapter';
import { createTypedNotification } from '@/lib/notifications/create';
import { sendPushToUser } from '@/lib/fcm-server';
import { isBlockedEitherWay } from '@/server/moderation';

// ── getOrCreateDirectConversation ─────────────────────────────────────────────
// Returns the conversation ID for a 1:1 DM, creating it if it doesn't exist.

export async function getOrCreateDirectConversation(
    callerId: string,
    myUid: string,
    otherUid: string,
): Promise<{ conversationId: string }> {
    if (callerId !== myUid) throw new Error('Unauthorized');
    if (myUid === otherUid) throw new Error('Cannot message yourself');

    // Moderation v1: refuse to open a DM when either side has blocked the
    // other. The message is deliberately direction-neutral — never reveal
    // WHO blocked WHOM.
    if (await isBlockedEitherWay(myUid, otherUid)) {
        throw new Error('Cannot message this user');
    }

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

export async function createGroupConversation(
    callerId: string,
    creatorUid: string,
    participantUids: string[],  // must include creatorUid
    name: string,
): Promise<{ conversationId: string }> {
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

export interface SendMessageInput {
    conversationId: string;
    text: string;
    type?: 'text' | 'resource' | 'audio';
    resource?: SharedResource;
    audioUrl?: string;
    audioDuration?: number;
    clientMessageId?: string;
}

export async function sendMessage(
    // Identity always comes from the server boundary — client never supplies senderId
    senderId: string,
    {
        conversationId,
        text,
        type = 'text',
        resource,
        audioUrl,
        audioDuration,
        clientMessageId,
    }: SendMessageInput,
): Promise<{ messageId: string }> {
    const trimmed = text.trim();
    if (!trimmed && type === 'text') throw new Error('Message cannot be empty');
    if (type === 'audio' && !audioUrl) throw new Error('Audio URL is required for voice messages');
    if (trimmed.length > 1000) throw new Error('Message too long (max 1000 chars)');

    // Wave 3: validate non-text payloads too. Previously only text length was
    // capped — a malicious client could send a 10 MB resource.title or a
    // gigabyte-long audioUrl and Firestore would happily store it.
    if (audioUrl) {
        if (typeof audioUrl !== 'string') throw new Error('Invalid audio URL');
        if (audioUrl.length > 1024) throw new Error('Audio URL too long');
        if (!audioUrl.startsWith('https://firebasestorage.googleapis.com/') &&
            !audioUrl.startsWith('https://storage.googleapis.com/')) {
            throw new Error('Audio URL must point to Firebase Storage');
        }
    }
    if (audioDuration !== undefined) {
        if (typeof audioDuration !== 'number' || audioDuration < 0 || audioDuration > 600) {
            throw new Error('Audio duration must be 0-600 seconds');
        }
    }
    if (resource) {
        if (typeof resource !== 'object') throw new Error('Invalid resource payload');
        if (typeof resource.id !== 'string' || resource.id.length > 256) throw new Error('Invalid resource id');
        if (typeof resource.title !== 'string' || resource.title.length > 200) throw new Error('Invalid resource title');
        if (typeof resource.route !== 'string' || resource.route.length > 64) throw new Error('Invalid resource route');
    }

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const convRef = db.collection('conversations').doc(conversationId);

    const convDoc = await convRef.get();
    if (!convDoc.exists) throw new Error('Conversation not found');

    const convData = convDoc.data()!;
    if (!convData.participantIds.includes(senderId)) throw new Error('Not a participant');

    // Moderation v1: block enforcement on the direct-message write path.
    // Rejects when EITHER side has blocked the other; the error string is
    // direction-neutral so the sender can't probe who blocked whom. Group
    // conversations are not gated (a block hides 1:1 contact, not shared
    // group spaces).
    if (convData.type === 'direct') {
        const otherId = (convData.participantIds as string[]).find((id) => id !== senderId);
        if (otherId && (await isBlockedEitherWay(senderId, otherId))) {
            throw new Error('Cannot message this user');
        }
    }

    // Denormalize sender info from conversation snapshot
    const senderSnap = convData.participants?.[senderId];

    // Atomic transaction: add message + update conversation preview + increment unread
    const msgRef = clientMessageId
        ? convRef.collection('messages').doc(clientMessageId)
        : convRef.collection('messages').doc();

    // Idempotency: the check MUST run inside the transaction. Running it as a
    // pre-check outside meant two concurrent retries with the same
    // clientMessageId could both pass and both apply the unreadCount
    // increment(1) + fire duplicate notifications. Inside the transaction the
    // deterministic message doc read serializes the retries: the loser sees the
    // doc already exists and returns early (no increment, no notifications).
    let alreadyExists = false;
    await db.runTransaction(async (tx) => {
        if (clientMessageId) {
            const existing = await tx.get(msgRef);
            if (existing.exists) {
                alreadyExists = true;
                return;
            }
        }

        const messagePayload: Record<string, any> = {
            type,
            text: trimmed,
            senderId,
            senderName: senderSnap?.displayName ?? 'Teacher',
            senderPhotoURL: senderSnap?.photoURL ?? null,
            readBy: [senderId],
            createdAt: FieldValue.serverTimestamp(),
            ...(clientMessageId ? { clientMessageId } : {}),
        };
        if (type === 'resource' && resource) {
            messagePayload.resource = resource;
        }

        if (type === 'audio' && audioUrl) {
            messagePayload.audioUrl = audioUrl;
            if (audioDuration) messagePayload.audioDuration = audioDuration;
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
            : type === 'audio'
            ? 'Voice message'
            : trimmed.slice(0, 80);

        tx.update(convRef, {
            lastMessage: preview,
            lastMessageAt: FieldValue.serverTimestamp(),
            lastMessageSenderId: senderId,
            updatedAt: FieldValue.serverTimestamp(),
            ...unreadUpdates,
        });
    });

    // Duplicate retry (same clientMessageId): the message + increment were
    // already applied by the winning attempt. Skip the notification/push
    // fan-out so the recipient isn't notified twice, and return the stable id.
    if (alreadyExists) {
        return { messageId: msgRef.id };
    }

    // Fire-and-forget notifications to other participants
    const recipients = (convData.participantIds as string[]).filter((uid) => uid !== senderId);
    const conversationName = convData.type === 'group'
        ? convData.name
        : senderSnap?.displayName ?? 'Teacher';

    const previewText = type === 'resource'
        ? `📎 ${resource?.title ?? 'Shared a resource'}`
        : type === 'audio'
        ? 'Voice message'
        : trimmed.slice(0, 80);

    for (const recipientId of recipients) {
        createTypedNotification({
            type: 'MESSAGE',
            recipientId,
            placeholders: {
                senderName: conversationName ?? 'Teacher',
                preview: previewText,
            },
            senderId,
            senderName: senderSnap?.displayName ?? 'Teacher',
            senderPhotoURL: senderSnap?.photoURL ?? undefined,
            link: `/messages?open=${conversationId}`,
            // Stamp the conversation so markConversationRead can clear the
            // matching notification docs (and therefore the Bell badge) when the
            // recipient opens/reads the conversation. Without this, the unread
            // conversation badge cleared but the "N messages" notification badge
            // lingered forever.
            metadata: { conversationId },
        }).catch(() => {});
    }

    // FCM push notifications (fire-and-forget)
    for (const recipientId of recipients) {
        sendPushToUser(recipientId, {
            title: conversationName ?? 'New message',
            body: type === 'resource'
                ? `📎 ${resource?.title ?? 'Shared a resource'}`
                : type === 'audio'
                ? 'Voice message'
                : trimmed.slice(0, 100),
        }, {
            conversationId,
            type: 'message',
            link: `/messages?open=${conversationId}`,
        }).catch(() => {});
    }

    return { messageId: msgRef.id };
}

// ── markConversationRead ──────────────────────────────────────────────────────

export async function markConversationRead(
    callerId: string,
    conversationId: string,
    userId: string,
): Promise<void> {
    if (callerId !== userId) throw new Error('Unauthorized');

    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const convRef = db.collection('conversations').doc(conversationId);

    // F2-02 (P1): verify the caller is actually a participant before mutating
    // any messages. Without this check, knowing a conversation id was enough
    // to taint the readBy audit trail on up to 50 messages of any
    // conversation. Mirrors the check in sendMessage.
    const convAuthDoc = await convRef.get();
    if (!convAuthDoc.exists) throw new Error('Conversation not found');
    const convAuthData = convAuthDoc.data()!;
    const participantIds: string[] = convAuthData.participantIds ?? [];
    if (!participantIds.includes(callerId)) throw new Error('Forbidden: not a participant');

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

    // Also clear the per-message notification docs for this conversation so the
    // sidebar Bell badge ("N messages") drops to zero once the user has actually
    // read the thread.
    //
    // IMPORTANT: we deliberately DO NOT include `where('metadata.conversationId', '==', ...)`
    // in the Firestore query. Three reasons:
    //   1. A 3-way composite index (recipientId + metadata.conversationId + isRead)
    //      almost certainly doesn't exist in prod — the query would silently fail
    //      and the badge would never clear (this was the actual bug QA reported).
    //   2. Legacy notification docs created before sendMessage started stamping
    //      `metadata.conversationId` have no such field at all, so they'd never match
    //      even with a perfect index. Those are the "2 messages" the user can't clear.
    //   3. Equality on a nested map field is brittle across Admin SDK versions.
    //
    // Instead we run a single-where scan (recipientId + isRead==false — this index
    // exists, the sidebar listener uses the same shape) and filter in code by
    // matching either metadata.conversationId OR the link querystring.
    try {
        // F6-09 fix: previously this scan was hard-capped at 200 unread notifs
        // (without orderBy → the kept set was non-deterministic). A user who
        // had accumulated >200 unread notifications never cleared the message
        // notification for this conversation, so the Bell badge stayed pinned.
        //
        // We now page through ALL unread notifications for the recipient using
        // a cursor on doc-id (__name__). The existing (recipientId + isRead)
        // index handles the where clauses and __name__ is a free sort. We cap
        // at MAX_PAGES * PAGE_SIZE = 20 * 500 = 10k of safety — well above any
        // realistic unread count, but bounded so a runaway can never hang.
        const linkNeedle = `open=${conversationId}`;
        const PAGE_SIZE = 500; // Firestore batch.update() per-batch limit
        const MAX_PAGES = 20;
        let scanned = 0;
        let cleared = 0;
        let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
        for (let page = 0; page < MAX_PAGES; page++) {
            let q = db
                .collection('notifications')
                .where('recipientId', '==', userId)
                .where('isRead', '==', false)
                .orderBy('__name__')
                .limit(PAGE_SIZE);
            if (cursor) q = q.startAfter(cursor);
            const snap = await q.get();
            if (snap.empty) break;
            scanned += snap.size;
            const matching = snap.docs.filter((d) => {
                const data = d.data() ?? {};
                const metaMatch = data.metadata?.conversationId === conversationId;
                const linkMatch = typeof data.link === 'string' && data.link.includes(linkNeedle);
                return metaMatch || linkMatch;
            });
            if (matching.length > 0) {
                const notifBatch = db.batch();
                matching.forEach((doc) => notifBatch.update(doc.ref, { isRead: true }));
                await notifBatch.commit();
                cleared += matching.length;
            }
            if (snap.size < PAGE_SIZE) break; // last page reached
            cursor = snap.docs[snap.docs.length - 1];
        }
        console.debug(
            '[markConversationRead] scanned %d unread notifs, cleared %d match conv %s',
            scanned,
            cleared,
            conversationId,
        );
    } catch (err) {
        // Non-fatal: log loudly so we can spot it in Cloud Logging. The
        // conversation badge still clears; only the notification badge lingers.
        console.error('[markConversationRead] failed to clear message notifications', err);
    }
}

// ── getTotalUnreadCount ───────────────────────────────────────────────────────
// Used by the sidebar badge.

export async function getTotalUnreadCount(callerId: string, userId: string): Promise<number> {
    if (callerId !== userId) throw new Error('Unauthorized');

    const db = await getDb();
    // Wave 3: cap at 500 conversations. Without a limit, a power-user with
    // thousands of group conversations would load every doc on every sidebar
    // badge refresh — a perpetual O(N) Firestore read on the hottest path.
    // 500 is well above the 99th-percentile teacher's conversation count.
    const snap = await db
        .collection('conversations')
        .where('participantIds', 'array-contains', userId)
        .limit(500)
        .get();

    let total = 0;
    snap.docs.forEach((doc) => {
        const data = doc.data();
        total += data.unreadCount?.[userId] ?? 0;
    });
    return total;
}

// ── acknowledgeDelivery ─────────────────────────────────────────────────────

export async function acknowledgeDelivery(
    userId: string,
    conversationId: string,
    messageIds: string[],
): Promise<void> {
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');

    const convRef = db.collection('conversations').doc(conversationId);

    // F2-03 (P2): verify the caller is a participant before stamping
    // `deliveredTo`. Without this check, any signed-in caller could write
    // their uid onto any conversation's messages.
    const convAuthDoc = await convRef.get();
    if (!convAuthDoc.exists) throw new Error('Conversation not found');
    const convAuthData = convAuthDoc.data()!;
    const participantIds: string[] = convAuthData.participantIds ?? [];
    if (!participantIds.includes(userId)) throw new Error('Forbidden: not a participant');

    const batch = db.batch();

    for (const msgId of messageIds.slice(0, 50)) {  // cap at 50 per batch
        const msgRef = convRef.collection('messages').doc(msgId);
        batch.update(msgRef, {
            deliveredTo: FieldValue.arrayUnion(userId),
        });
    }

    await batch.commit();
}
