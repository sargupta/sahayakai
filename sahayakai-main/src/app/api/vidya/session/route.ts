import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

/**
 * VIDYA Conversation Session Persistence
 *
 * GET  /api/vidya/session  — fetch the most recent session (messages + sessionId)
 * POST /api/vidya/session  — create or update a session with latest message turns
 *
 * Session document schema (users/{uid}/vidya_sessions/{sessionId}):
 * {
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp,
 *   messages:  [{ role, parts: [{ text }] }]  — capped at 50 entries
 *   actionsTriggered: [{ flow, params, ts }]   — NAVIGATE_AND_FILL events
 *   screenPaths: string[]                      — pages visited in this session
 * }
 *
 * Max 10 sessions retained per user (older ones pruned asynchronously).
 *
 * Auth: middleware verifies the Firebase ID token and injects x-user-id.
 */

export async function GET(request: NextRequest) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = await getDb();
        const snapshot = await db
            .collection('users').doc(uid)
            .collection('vidya_sessions')
            .orderBy('updatedAt', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) return NextResponse.json({ sessionId: null, messages: [] });

        const doc = snapshot.docs[0];
        const data = doc.data();
        return NextResponse.json({
            sessionId: doc.id,
            messages: data.messages ?? [],
        });
    } catch (error) {
        logger.error('Failed to fetch VIDYA session', error, 'VIDYA');
        return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { sessionId, messages, actionTriggered, screenPath, isNew } = body;

        if (!sessionId || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'sessionId and messages[] required' }, { status: 400 });
        }

        const db = await getDb();
        const sessionRef = db
            .collection('users').doc(uid)
            .collection('vidya_sessions').doc(sessionId);

        const updates: Record<string, any> = {
            // Only write createdAt on document creation to preserve the original timestamp
            ...(isNew ? { createdAt: FieldValue.serverTimestamp() } : {}),
            updatedAt: FieldValue.serverTimestamp(),
            // Cap at 50 messages to stay well under Firestore's 1 MB document limit
            messages: messages.slice(-50),
        };

        if (actionTriggered) {
            updates.actionsTriggered = FieldValue.arrayUnion({
                ...actionTriggered,
                ts: Date.now(),
            });
        }

        if (screenPath) {
            updates.screenPaths = FieldValue.arrayUnion(screenPath);
        }

        await sessionRef.set(updates, { merge: true });

        // Prune sessions beyond 10 asynchronously — do not await, non-blocking
        pruneOldSessions(db, uid).catch(console.warn);

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('Failed to save VIDYA session', error, 'VIDYA');
        return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }
}

/** Retain only the 10 most recent sessions; silently delete anything older.
 *  Reads at most 15 documents (10 to keep + 5 buffer) to avoid an unbounded
 *  full-collection scan that grows linearly with a teacher's session history.
 */
async function pruneOldSessions(db: any, uid: string) {
    const snapshot = await db
        .collection('users').doc(uid)
        .collection('vidya_sessions')
        .orderBy('updatedAt', 'desc')
        .limit(15)   // read only top 15 — delete docs beyond index 10
        .get();

    const toDelete = snapshot.docs.slice(10);
    if (toDelete.length === 0) return;

    const batch = db.batch();
    toDelete.forEach((doc: any) => batch.delete(doc.ref));
    await batch.commit();
}
