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
 *   saved?:   boolean   — teacher bookmarked it (kept forever, starred in My Library)
 *   savedAt?: Timestamp
 *   title?:   string    — the teacher's first message, trimmed
 * }
 *
 * Every VIDYA conversation (text, turn-based voice and Live Voice) is retained
 * here AUTOMATICALLY and listed under My Library → Conversations — no bookmark
 * needed. The 10 most recent UNSAVED sessions are kept (older ones pruned
 * asynchronously); bookmarked conversations are never pruned.
 *
 * A conversation stays a conversation: it lives here, never in
 * `users/{uid}/content` (the artifacts / Generations store).
 *
 * GET   /api/vidya/session?list=1  — all of the teacher's conversations (summaries)
 * GET   /api/vidya/session?saved=1 — only the bookmarked ones (summaries)
 * GET   /api/vidya/session?id=X    — one of the teacher's own sessions (messages)
 * PATCH /api/vidya/session         — { sessionId, saved } bookmark / un-bookmark
 *
 * Auth: middleware verifies the Firebase ID token and injects x-user-id.
 * Every read/write is under users/{uid}, so a teacher can only ever reach
 * their own sessions.
 */

const MAX_TITLE = 120;

function titleFrom(messages: unknown): string {
    const list = Array.isArray(messages) ? messages : [];
    const first = list.find((m) => m?.role === 'user');
    const text = String(first?.parts?.map((p: { text?: string }) => p?.text ?? '').join(' ') ?? '').trim();
    return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1)}…` : text;
}

function toIso(value: unknown): string | null {
    const v = value as { toDate?: () => Date } | null;
    return v && typeof v.toDate === 'function' ? v.toDate().toISOString() : null;
}

export async function GET(request: NextRequest) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    try {
        const db = await getDb();
        const sessions = db.collection('users').doc(uid).collection('vidya_sessions');

        const listAll = params.get('list') === '1';
        if (listAll || params.get('saved') === '1') {
            // Retention keeps this small (10 unsaved + bookmarked), so no
            // composite index: plain read / single-field filter, sorted here.
            const snap = listAll
                ? await sessions.limit(200).get()
                : await sessions.where('saved', '==', true).limit(100).get();
            const items = snap.docs
                .map((doc) => {
                    const data = doc.data();
                    const messages = Array.isArray(data.messages) ? data.messages : [];
                    return {
                        id: doc.id,
                        title: data.title || titleFrom(messages),
                        saved: data.saved === true,
                        savedAt: toIso(data.savedAt),
                        updatedAt: toIso(data.updatedAt),
                        messageCount: messages.length,
                    };
                })
                // A session with no teacher message yet is not a conversation.
                .filter((item) => item.messageCount > 0 && item.title !== '')
                .sort((a, b) => listAll
                    ? String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
                    : String(b.savedAt ?? '').localeCompare(String(a.savedAt ?? '')));
            return NextResponse.json({ items });
        }

        const id = params.get('id');
        if (id) {
            const doc = await sessions.doc(id).get();
            if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
            const data = doc.data() ?? {};
            return NextResponse.json({
                sessionId: doc.id,
                title: data.title || titleFrom(data.messages),
                saved: data.saved === true,
                messages: data.messages ?? [],
            });
        }

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

/**
 * Bookmark / un-bookmark one of the teacher's own conversations.
 * Body: { sessionId: string, saved: boolean }. Only an existing session can
 * be saved; the title is derived from its first teacher message.
 */
export async function PATCH(request: NextRequest) {
    const uid = request.headers.get('x-user-id');
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json().catch(() => ({}));
        const { sessionId, saved } = body ?? {};
        if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 200 || typeof saved !== 'boolean') {
            return NextResponse.json({ error: 'sessionId and saved:boolean required' }, { status: 400 });
        }
        const db = await getDb();
        const ref = db.collection('users').doc(uid).collection('vidya_sessions').doc(sessionId);
        const doc = await ref.get();
        if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await ref.set(saved
            ? { saved: true, savedAt: FieldValue.serverTimestamp(), title: titleFrom(doc.data()?.messages) }
            : { saved: false, savedAt: FieldValue.delete() },
        { merge: true });
        return NextResponse.json({ success: true, saved });
    } catch (error) {
        logger.error('Failed to update VIDYA session bookmark', error, 'VIDYA');
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }
}

/** Retain only the 10 most recent UNSAVED sessions; silently delete older
 *  unsaved ones. Saved conversations are never pruned. Reads at most 15
 *  documents to avoid an unbounded full-collection scan.
 */
async function pruneOldSessions(db: any, uid: string) {
    const snapshot = await db
        .collection('users').doc(uid)
        .collection('vidya_sessions')
        .orderBy('updatedAt', 'desc')
        .limit(15)   // read only top 15 — delete unsaved docs beyond the 10th
        .get();

    const toDelete = snapshot.docs.filter((doc: any) => doc.data()?.saved !== true).slice(10);
    if (toDelete.length === 0) return;

    const batch = db.batch();
    toDelete.forEach((doc: any) => batch.delete(doc.ref));
    await batch.commit();
}
