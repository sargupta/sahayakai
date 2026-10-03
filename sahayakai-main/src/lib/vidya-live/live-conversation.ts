/**
 * Live Voice → conversation history.
 *
 * A Gemini Live talk with VIDYA is a normal VIDYA conversation: it is retained
 * in `users/{uid}/vidya_sessions` (My Library → Conversations) through the
 * SAME `/api/vidya/session` endpoint text chat uses — never in
 * `users/{uid}/content` (Generations). Only transcripts are kept; audio is
 * never persisted.
 *
 * Transcript frames from the sidecar: partial chunks arrive with
 * `final: false` and are appended; a `final: true` frame carries the turn's
 * complete text. A turn ends on `final`, or when the speaker changes.
 *
 * Purely additive to the voice pipeline: it only observes the existing
 * `onTranscript` / state callbacks.
 */

import type { VidyaLiveState } from './live-session';

export interface LiveTranscriptFrame {
    role: 'user' | 'vidya';
    text: string;
    final?: boolean;
}

export interface SessionMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

interface Turn {
    role: 'user' | 'vidya';
    text: string;
    done: boolean;
}

/** Folds transcript frames into whole turns. */
export class LiveTranscriptLog {
    private turns: Turn[] = [];

    /** Returns true when this frame completed a turn. */
    push(frame: LiveTranscriptFrame): boolean {
        if (!frame || (frame.role !== 'user' && frame.role !== 'vidya') || typeof frame.text !== 'string') return false;
        const last = this.turns[this.turns.length - 1];
        let completed = false;
        let turn = last;
        if (!turn || turn.done || turn.role !== frame.role) {
            if (turn && !turn.done) {
                turn.done = true; // speaker changed: the previous turn is over
                completed = true;
            }
            turn = { role: frame.role, text: '', done: false };
            this.turns.push(turn);
        }
        if (frame.final) {
            turn.text = frame.text; // the final frame carries the whole turn
            turn.done = true;
            return true;
        }
        turn.text += frame.text;
        return completed;
    }

    messages(): SessionMessage[] {
        return this.turns
            .filter((t) => t.text.trim() !== '')
            .map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text.trim() }] }));
    }
}

export interface LiveConversationRecorderOptions {
    /** The signed-in teacher; null = do not persist (signed out). */
    getUid: () => string | null;
    getIdToken: () => Promise<string | null>;
    getScreenPath?: () => string | undefined;
    fetchImpl?: typeof fetch;
    now?: () => number;
    debounceMs?: number;
}

/** One recorder per app; each Live session becomes one conversation. */
export function createLiveConversationRecorder(opts: LiveConversationRecorderOptions) {
    const fetchImpl = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
    const now = opts.now ?? Date.now;
    const debounceMs = opts.debounceMs ?? 1500;
    let log: LiveTranscriptLog | null = null;
    let sessionId: string | null = null;
    let isNew = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSent = '';

    const flush = async () => {
        if (timer) { clearTimeout(timer); timer = null; }
        if (!log || !sessionId) return;
        const messages = log.messages();
        // No teacher turn yet → not a conversation; nothing changed → no write.
        if (!messages.some((m) => m.role === 'user')) return;
        const body = JSON.stringify(messages);
        if (body === lastSent) return;
        const token = await opts.getIdToken();
        if (!token) return;
        const first = isNew;
        isNew = false;
        lastSent = body;
        try {
            await fetchImpl('/api/vidya/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ sessionId, messages, isNew: first, screenPath: opts.getScreenPath?.() }),
            });
        } catch {
            // History is best-effort; never disturb the live conversation.
            isNew = first;
            lastSent = '';
        }
    };

    return {
        /** Feed every VidyaLiveSession state change. */
        onState(state: VidyaLiveState) {
            if (state === 'connecting') {
                const uid = opts.getUid();
                log = uid ? new LiveTranscriptLog() : null;
                sessionId = uid ? `live_${uid.slice(0, 8)}_${now()}` : null;
                isNew = true;
                lastSent = '';
            } else if (state === 'ended' || state === 'error' || state === 'idle') {
                void flush();
            }
        },
        /** Feed every transcript frame. */
        onTranscript(frame: LiveTranscriptFrame) {
            if (!log) return;
            if (log.push(frame)) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(() => { void flush(); }, debounceMs);
            }
        },
        flush,
    };
}
