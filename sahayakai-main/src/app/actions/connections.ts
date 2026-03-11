'use server';

import { getDb } from '@/lib/firebase-admin';
import { headers } from 'next/headers';
import { dbAdapter } from '@/lib/db/adapter';
import { createNotification } from './notifications';
import type { ConnectionRequest, Connection, MyConnectionData } from '@/types';

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthUserId(): Promise<string> {
    const h = await headers();
    const uid = h.get('x-user-id');
    if (!uid) throw new Error('Unauthorized');
    return uid;
}

// ── Deterministic connection ID (same pattern as DMs) ─────────────────────────

function buildConnectionId(uid1: string, uid2: string): string {
    return [uid1, uid2].sort().join('_');
}

// ── sendConnectionRequestAction ───────────────────────────────────────────────
// Creates a pending request doc. Idempotent: if a request already exists in
// either direction (or a connection already exists) it returns the current state.

export async function sendConnectionRequestAction(toUid: string): Promise<{ status: 'sent' | 'already_connected' | 'already_pending' }> {
    const fromUid = await getAuthUserId();
    if (fromUid === toUid) throw new Error('Cannot connect with yourself');

    const db = await getDb();
    const pairId = buildConnectionId(fromUid, toUid); // sorted — same key regardless of direction

    // Parallel pre-flight: check connection + existing request in one round-trip
    const [connSnap, existingReq] = await Promise.all([
        db.collection('connections').doc(pairId).get(),
        db.collection('connection_requests').doc(pairId).get(),
    ]);
    if (connSnap.exists) return { status: 'already_connected' };
    if (existingReq.exists) return { status: 'already_pending' };

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const reqData: Omit<ConnectionRequest, 'id'> = {
        fromUid,
        toUid,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
    };

    await db.collection('connection_requests').doc(pairId).set(reqData);

    // Notify recipient
    try {
        const userSnap = await db.collection('users').doc(fromUid).get();
        const sender = userSnap.data();
        await createNotification({
            recipientId: toUid,
            type: 'CONNECT_REQUEST',
            title: 'New connection request',
            message: `${sender?.displayName ?? 'A teacher'} wants to connect with you.`,
            senderId: fromUid,
            senderName: sender?.displayName,
            senderPhotoURL: sender?.photoURL,
            link: `/profile/${fromUid}`,
            metadata: { requestId: reqId },
        });
    } catch {
        // Notification failure must not block the request
    }

    return { status: 'sent' };
}

// ── acceptConnectionRequestAction ─────────────────────────────────────────────
// Only the recipient (toUid) may accept. Atomically:
//   1. Delete the request doc
//   2. Write the connection doc
//   3. Send notification to the original requester

export async function acceptConnectionRequestAction(requestId: string): Promise<void> {
    const callerId = await getAuthUserId();
    const db = await getDb();

    const reqSnap = await db.collection('connection_requests').doc(requestId).get();
    if (!reqSnap.exists) throw new Error('Request not found');

    const req = reqSnap.data() as Omit<ConnectionRequest, 'id'>;
    if (req.toUid !== callerId) throw new Error('Unauthorized: only recipient can accept');

    const connId = buildConnectionId(req.fromUid, req.toUid);
    const now = new Date().toISOString();

    const connectionData: Omit<Connection, 'id'> = {
        uids: [req.fromUid, req.toUid].sort() as [string, string],
        initiatedBy: req.fromUid,
        connectedAt: now,
    };

    const batch = db.batch();
    batch.delete(db.collection('connection_requests').doc(requestId));
    batch.set(db.collection('connections').doc(connId), connectionData);
    await batch.commit();

    // Notify requester
    try {
        const userSnap = await db.collection('users').doc(callerId).get();
        const accepter = userSnap.data();
        await createNotification({
            recipientId: req.fromUid,
            type: 'CONNECT_ACCEPTED',
            title: 'Connection accepted',
            message: `${accepter?.displayName ?? 'A teacher'} accepted your connection request.`,
            senderId: callerId,
            senderName: accepter?.displayName,
            senderPhotoURL: accepter?.photoURL,
            link: `/profile/${callerId}`,
        });
    } catch {
        // Notification failure must not block acceptance
    }
}

// ── declineConnectionRequestAction ────────────────────────────────────────────
// Either party (sender = withdraw, recipient = decline) may call this.

export async function declineConnectionRequestAction(requestId: string): Promise<void> {
    const callerId = await getAuthUserId();
    const db = await getDb();

    const reqSnap = await db.collection('connection_requests').doc(requestId).get();
    if (!reqSnap.exists) return; // idempotent

    const req = reqSnap.data() as Omit<ConnectionRequest, 'id'>;
    if (req.fromUid !== callerId && req.toUid !== callerId) {
        throw new Error('Unauthorized');
    }

    await db.collection('connection_requests').doc(requestId).delete();
}

// ── disconnectAction ──────────────────────────────────────────────────────────
// Either participant may remove the connection.

export async function disconnectAction(otherUid: string): Promise<void> {
    const callerId = await getAuthUserId();
    const db = await getDb();
    const connId = buildConnectionId(callerId, otherUid);

    const connSnap = await db.collection('connections').doc(connId).get();
    if (!connSnap.exists) return; // idempotent

    const conn = connSnap.data() as Omit<Connection, 'id'>;
    if (!conn.uids.includes(callerId)) throw new Error('Unauthorized');

    await db.collection('connections').doc(connId).delete();
}

// ── getMyConnectionDataAction ─────────────────────────────────────────────────
// Returns all connection data for the current user in a single round-trip.
// Used to render connection state on teacher cards and profiles.

export async function getMyConnectionDataAction(): Promise<MyConnectionData> {
    const callerId = await getAuthUserId();
    const db = await getDb();

    const [connSnap, sentSnap, receivedSnap] = await Promise.all([
        // All accepted connections I'm part of
        db.collection('connections')
            .where('uids', 'array-contains', callerId)
            .get(),

        // Pending requests I sent
        db.collection('connection_requests')
            .where('fromUid', '==', callerId)
            .get(),

        // Pending requests I received
        db.collection('connection_requests')
            .where('toUid', '==', callerId)
            .get(),
    ]);

    const connectedUids = connSnap.docs.flatMap((d) => {
        const uids = d.data().uids as string[];
        return uids.filter((u) => u !== callerId);
    });

    const sentRequestUids = sentSnap.docs.map((d) => d.data().toUid as string);

    const receivedRequests = receivedSnap.docs.map((d) => ({
        uid: d.data().fromUid as string,
        requestId: d.id,
    }));

    return dbAdapter.serialize({ connectedUids, sentRequestUids, receivedRequests }) as MyConnectionData;
}
