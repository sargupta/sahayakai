/**
 * A Gemini Live talk with VIDYA is retained as a normal conversation
 * (/api/vidya/session → My Library → Conversations), never a Generation,
 * and never for a signed-out visitor.
 */
import { LiveTranscriptLog, createLiveConversationRecorder } from '@/lib/vidya-live/live-conversation';

describe('LiveTranscriptLog', () => {
    it('folds partial chunks into turns; a final frame carries the whole turn', () => {
        const log = new LiveTranscriptLog();
        log.push({ role: 'user', text: 'How many ', final: false });
        log.push({ role: 'user', text: 'are absent?', final: false });
        expect(log.push({ role: 'user', text: 'How many students are absent?', final: true })).toBe(true);
        log.push({ role: 'vidya', text: 'Three students ', final: false });
        log.push({ role: 'vidya', text: 'are absent.', final: false });
        expect(log.messages()).toEqual([
            { role: 'user', parts: [{ text: 'How many students are absent?' }] },
            { role: 'model', parts: [{ text: 'Three students are absent.' }] },
        ]);
    });

    it('a speaker change completes the previous turn', () => {
        const log = new LiveTranscriptLog();
        log.push({ role: 'vidya', text: 'Hello', final: false });
        expect(log.push({ role: 'user', text: 'Hi', final: false })).toBe(true);
        expect(log.messages().map((m) => m.role)).toEqual(['model', 'user']);
    });

    it('ignores malformed frames', () => {
        const log = new LiveTranscriptLog();
        expect(log.push({ role: 'system' as any, text: 'x' })).toBe(false);
        expect(log.push(null as any)).toBe(false);
        expect(log.messages()).toEqual([]);
    });
});

describe('createLiveConversationRecorder', () => {
    const setup = (uid: string | null = 'teacher-uid-123') => {
        const fetchImpl = jest.fn(async () => ({ ok: true } as Response));
        const rec = createLiveConversationRecorder({
            getUid: () => uid,
            getIdToken: async () => (uid ? 'tok' : null),
            getScreenPath: () => '/attendance/8b',
            fetchImpl: fetchImpl as unknown as typeof fetch,
            now: () => 1700000000000,
            debounceMs: 0,
        });
        return { rec, fetchImpl };
    };
    const talk = (rec: ReturnType<typeof setup>['rec']) => {
        rec.onState('connecting');
        rec.onTranscript({ role: 'user', text: 'How many students are absent?', final: true });
        rec.onTranscript({ role: 'vidya', text: 'Three students are absent right now.', final: true });
    };

    it('saves the talk as a conversation through /api/vidya/session (never a content/Generations endpoint)', async () => {
        const { rec, fetchImpl } = setup();
        talk(rec);
        rec.onState('ended');
        await rec.flush();
        await new Promise((r) => setTimeout(r, 0));

        expect(fetchImpl).toHaveBeenCalled();
        for (const [url] of fetchImpl.mock.calls as any[]) expect(url).toBe('/api/vidya/session');
        const bodies = (fetchImpl.mock.calls as any[]).map(([, init]) => JSON.parse(init.body));
        expect(bodies[0]).toMatchObject({ sessionId: 'live_teacher-_1700000000000', isNew: true, screenPath: '/attendance/8b' });
        expect(bodies.at(-1).messages).toEqual([
            { role: 'user', parts: [{ text: 'How many students are absent?' }] },
            { role: 'model', parts: [{ text: 'Three students are absent right now.' }] },
        ]);
        expect(bodies.slice(1).every((b) => b.isNew === false)).toBe(true); // created once, then updated
        expect((fetchImpl.mock.calls as any[])[0][1].headers.Authorization).toBe('Bearer tok');
    });

    it('does not write the same transcript twice', async () => {
        const { rec, fetchImpl } = setup();
        talk(rec);
        await rec.flush();
        await rec.flush();
        rec.onState('ended');
        await rec.flush();
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('a signed-out visitor is never recorded', async () => {
        const { rec, fetchImpl } = setup(null);
        talk(rec);
        rec.onState('ended');
        await rec.flush();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('a session where the teacher said nothing is not a conversation', async () => {
        const { rec, fetchImpl } = setup();
        rec.onState('connecting');
        rec.onTranscript({ role: 'vidya', text: 'Namaste! How can I help?', final: true });
        rec.onState('ended');
        await rec.flush();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('each new Live session becomes its own conversation', async () => {
        let t = 1;
        const fetchImpl = jest.fn(async () => ({ ok: true } as Response));
        const rec = createLiveConversationRecorder({ getUid: () => 'teacher-uid-123', getIdToken: async () => 'tok', fetchImpl: fetchImpl as any, now: () => t++, debounceMs: 0 });
        for (let i = 0; i < 2; i++) {
            rec.onState('connecting');
            rec.onTranscript({ role: 'user', text: `question ${i}`, final: true });
            await rec.flush();
        }
        const ids = (fetchImpl.mock.calls as any[]).map(([, init]) => JSON.parse(init.body).sessionId);
        expect(new Set(ids).size).toBe(2);
    });

    it('a failed write never throws into the voice session', async () => {
        const fetchImpl = jest.fn(async () => { throw new Error('offline'); });
        const rec = createLiveConversationRecorder({ getUid: () => 'teacher-uid-123', getIdToken: async () => 'tok', fetchImpl: fetchImpl as any, debounceMs: 0 });
        rec.onState('connecting');
        rec.onTranscript({ role: 'user', text: 'hello', final: true });
        await expect(rec.flush()).resolves.toBeUndefined();
    });
});
