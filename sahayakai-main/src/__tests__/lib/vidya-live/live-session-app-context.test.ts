/**
 * VidyaLiveSession — app context rides ALONGSIDE the existing voice pipeline.
 *
 * Proves, with faked audio/mic/socket, that the session still initialises and
 * streams exactly as before (setup first, mic audio, ready → listening, tool
 * calls to the handler), and that app context:
 *   - goes out right after setup (and again on every reconnect),
 *   - is never a turn: no state change, no barge-in,
 *   - can never break the session if sending it fails.
 */

import { VIDYA_GREETING_PROMPT, VIDYA_MIC_SILENT_PROMPT, VidyaLiveSession, type VidyaLiveState } from '@/lib/vidya-live/live-session';

// ── fakes ───────────────────────────────────────────────────────────────────
class FakeNode {
    port = { onmessage: null as ((e: { data: unknown }) => void) | null, postMessage: jest.fn(), close: jest.fn() };
    gain = { value: 1 };
    fftSize = 0;
    smoothingTimeConstant = 0;
    connect(next?: unknown) { return next ?? this; }
    disconnect() {}
    getByteTimeDomainData() {}
}
let lastCapture: FakeNode | null = null;
class FakeAudioContext {
    destination = {};
    audioWorklet = { addModule: jest.fn(async () => undefined) };
    resume = jest.fn(async () => undefined);
    close = jest.fn(async () => undefined);
    createAnalyser() { return new FakeNode(); }
    createGain() { return new FakeNode(); }
    createMediaStreamSource() { return new FakeNode(); }
}
class FakeWorkletNode extends FakeNode {
    constructor(_ctx: unknown, name: string) {
        super();
        if (name === 'vidya-pcm-capture') lastCapture = this;
    }
}
class FakeSocket {
    static OPEN = 1;
    static last: FakeSocket | null = null;
    readyState = 0;
    sent: Array<Record<string, unknown>> = [];
    failSends = false;
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: ((e: { code: number }) => void) | null = null;
    constructor(public url: string, public protocols: string[]) { FakeSocket.last = this; }
    send(raw: string) {
        if (this.failSends) throw new Error('socket send failed');
        this.sent.push(JSON.parse(raw));
    }
    close() { this.readyState = 3; }
    open() { this.readyState = FakeSocket.OPEN; this.onopen?.(); }
    serve(frame: Record<string, unknown>) { this.onmessage?.({ data: JSON.stringify(frame) }); }
}

beforeAll(() => {
    Object.assign(globalThis, {
        AudioContext: FakeAudioContext,
        AudioWorkletNode: FakeWorkletNode,
        WebSocket: FakeSocket,
    });
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: jest.fn(async () => ({ getTracks: () => [], getAudioTracks: () => [] })) },
    });
});

beforeEach(() => {
    FakeSocket.last = null;
    lastCapture = null;
    global.fetch = jest.fn(async () => ({
        ok: true, status: 200, json: async () => ({ wsUrl: 'wss://sidecar/v1/vidya-voice/stream', streamToken: 'tok' }),
    })) as unknown as typeof fetch;
});

const CONTEXT = { knowledge: 'SahayakAI sections ...', sections: ['attendance'], screen: { path: '/attendance', fingerprint: 'fp' } };

function makeSession(onToolCall = jest.fn(), extra: Partial<ConstructorParameters<typeof VidyaLiveSession>[0]> = {}) {
    const states: VidyaLiveState[] = [];
    const session = new VidyaLiveSession({
        scope: 'teacher',
        getIdToken: async () => 'id-token',
        startSessionBody: { teacherProfile: {}, currentScreenContext: { path: '/' } },
        setup: { language: 'en', screenPath: '/attendance' },
        onState: (s) => states.push(s),
        onToolCall,
        ...extra,
    });
    return { session, states, onToolCall };
}

async function startAndOpen(session: VidyaLiveSession) {
    await session.start();
    const ws = FakeSocket.last!;
    ws.open();
    ws.serve({ ready: true });
    return ws;
}

it('still initialises: setup first, then the latest app context; ready → listening', async () => {
    const { session, states } = makeSession();
    session.setAppContext(CONTEXT); // pushed before the socket exists — kept

    const ws = await startAndOpen(session);

    expect(ws.protocols).toEqual(['vidya.v1', 'bearer.tok']);
    expect(ws.sent[0]).toEqual({ setup: { language: 'en', screenPath: '/attendance' } });
    expect(ws.sent[1]).toEqual({ appContext: CONTEXT });
    expect(states).toEqual(['connecting', 'listening']);
});

it('a session started without context sends setup only (old behaviour)', async () => {
    const { session } = makeSession();
    const ws = await startAndOpen(session);
    expect(ws.sent).toEqual([{ setup: { language: 'en', screenPath: '/attendance' } }]);
});

it('pushing context mid-session is not a turn: no state change, frame goes out', async () => {
    const { session, states } = makeSession();
    const ws = await startAndOpen(session);
    const before = [...states];

    expect(session.setAppContext({ ...CONTEXT, screen: { path: '/my-library', fingerprint: 'fp2' } })).toBe(true);

    expect(states).toEqual(before);
    expect(session.currentState).toBe('listening');
    expect(ws.sent.at(-1)).toEqual({ appContext: { ...CONTEXT, screen: { path: '/my-library', fingerprint: 'fp2' } } });
});

it('mic audio and tool calls still flow exactly as before', async () => {
    const { session, onToolCall } = makeSession();
    const ws = await startAndOpen(session);

    lastCapture!.port.onmessage!({ data: { type: 'chunk', pcm: new Int16Array([1, 2, 3, 4]).buffer, rms: 0 } });
    expect(ws.sent.some((f) => typeof f.audio === 'string')).toBe(true);

    ws.serve({ toolCall: { name: 'navigate_to', args: { destination: 'my-library' }, id: 'fc1' } });
    expect(onToolCall).toHaveBeenCalledWith({ name: 'navigate_to', args: { destination: 'my-library' }, id: 'fc1' });
});

it('a failing context send never breaks the voice session', async () => {
    const { session } = makeSession();
    const ws = await startAndOpen(session);
    ws.failSends = true;

    expect(() => session.setAppContext(CONTEXT)).not.toThrow();
    expect(session.setAppContext(CONTEXT)).toBe(false);
    expect(session.currentState).toBe('listening');
});

it('a restarted session gets the latest context again right after setup', async () => {
    const { session } = makeSession();
    await startAndOpen(session);
    session.setAppContext(CONTEXT);
    session.stop();

    const ws2 = await startAndOpen(session);
    expect(ws2.sent[0]).toHaveProperty('setup');
    expect(ws2.sent[1]).toEqual({ appContext: CONTEXT });
});

describe('greeting on connect and the silent-mic hint', () => {
    const chunk = (rms: number) => lastCapture!.port.onmessage!({ data: { type: 'chunk', pcm: new Int16Array([0, 0]).buffer, rms } });
    const texts = (ws: FakeSocket) => ws.sent.filter((f) => typeof f.text === 'string').map((f) => f.text);
    let now = 0;
    beforeEach(() => {
        now = 1_000;
        jest.spyOn(performance, 'now').mockImplementation(() => now);
    });
    afterEach(() => jest.restoreAllMocks());

    it('greet: as soon as the session is ready VIDYA is asked to say hello (one text turn → THINKING)', async () => {
        const { session, states } = makeSession(jest.fn(), { greet: true });
        const ws = await startAndOpen(session);
        expect(texts(ws)).toEqual([VIDYA_GREETING_PROMPT]);
        expect(states).toEqual(['connecting', 'listening', 'thinking']);
    });

    it('without greet nothing extra is sent (the default)', async () => {
        const { session } = makeSession();
        const ws = await startAndOpen(session);
        expect(texts(ws)).toEqual([]);
    });

    it('a mic that carries only silence makes VIDYA say she cannot hear — once', async () => {
        const { session } = makeSession(jest.fn(), { micSilenceHintMs: 8000 });
        const ws = await startAndOpen(session);
        now += 7_000;
        chunk(0.001);
        expect(texts(ws)).toEqual([]); // not yet: under the threshold
        now += 1_500;
        chunk(0.001);
        expect(texts(ws)).toEqual([VIDYA_MIC_SILENT_PROMPT]);
        expect(session.currentState).toBe('thinking');
        // Back to listening after her answer: still silent, but the hint is never repeated.
        ws.serve({ turnComplete: true });
        now += 20_000;
        chunk(0.001);
        expect(texts(ws)).toEqual([VIDYA_MIC_SILENT_PROMPT]);
    });

    it('once the teacher has been heard, a quiet pause never triggers the hint', async () => {
        const { session } = makeSession(jest.fn(), { micSilenceHintMs: 8000 });
        const ws = await startAndOpen(session);
        chunk(0.2); // speech
        ws.serve({ turnComplete: true });
        now += 30_000;
        chunk(0.001);
        expect(texts(ws)).toEqual([]);
    });

    it('speech the server transcribed also counts as heard', async () => {
        const { session } = makeSession(jest.fn(), { micSilenceHintMs: 8000 });
        const ws = await startAndOpen(session);
        ws.serve({ transcript: { role: 'user', text: 'hello', final: true } });
        now += 30_000;
        chunk(0.001);
        expect(texts(ws)).toEqual([]);
    });
});

describe('failures and the audio path', () => {
    function withErrors() {
        const errors: string[] = [];
        const states: VidyaLiveState[] = [];
        const players: FakeNode[] = [];
        const Orig = globalThis.AudioWorkletNode as unknown as typeof FakeWorkletNode;
        Object.assign(globalThis, {
            AudioWorkletNode: class extends Orig {
                constructor(ctx: unknown, name: string) {
                    super(ctx, name);
                    if (name === 'vidya-pcm-player') players.push(this);
                }
            },
        });
        const session = new VidyaLiveSession({
            scope: 'teacher',
            getIdToken: async () => 'id-token',
            startSessionBody: {},
            setup: { language: 'kn' },
            onState: (s) => states.push(s),
            onError: (code) => errors.push(code),
        });
        return { session, errors, states, players, restore: () => Object.assign(globalThis, { AudioWorkletNode: Orig }) };
    }

    it('an upstream error before `ready` is "unavailable" (model access/credentials), not a lost connection', async () => {
        const { session, errors, states, restore } = withErrors();
        await session.start();
        FakeSocket.last!.open();
        FakeSocket.last!.serve({ error: 'live session failed' });
        expect(errors).toEqual(['unavailable']);
        expect(states.at(-1)).toBe('error');
        restore();
    });

    it('an upstream error after `ready` is a lost connection', async () => {
        const { session, errors, restore } = withErrors();
        await startAndOpen(session);
        FakeSocket.last!.serve({ error: 'live session failed' });
        expect(errors).toEqual(['upstream_failed']);
        restore();
    });

    it("VIDYA's audio reaches the player, and a barge-in flushes it with a new generation", async () => {
        const { session, states, players, restore } = withErrors();
        const ws = await startAndOpen(session);
        const player = players[0];
        const pcm = btoa(String.fromCharCode(0, 16, 0, 240)); // two PCM16 samples
        ws.serve({ audio: pcm });
        const push = player.port.postMessage.mock.calls.find(([m]) => (m as { type: string }).type === 'push');
        expect(push?.[0]).toMatchObject({ type: 'push', generation: 0 });
        expect(new Float32Array((push![0] as { samples: ArrayBuffer }).samples)).toHaveLength(2);

        player.port.onmessage!({ data: { type: 'playing' } });
        expect(session.currentState).toBe('speaking');
        ws.serve({ interrupted: true });
        expect(player.port.postMessage).toHaveBeenLastCalledWith({ type: 'flush', generation: 1 });
        expect(states).toContain('interrupted');
        restore();
    });
});
