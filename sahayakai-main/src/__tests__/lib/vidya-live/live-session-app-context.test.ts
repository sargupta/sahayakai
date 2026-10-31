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

import { VidyaLiveSession, type VidyaLiveState } from '@/lib/vidya-live/live-session';

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

function makeSession(onToolCall = jest.fn()) {
    const states: VidyaLiveState[] = [];
    const session = new VidyaLiveSession({
        scope: 'teacher',
        getIdToken: async () => 'id-token',
        startSessionBody: { teacherProfile: {}, currentScreenContext: { path: '/' } },
        setup: { language: 'en', screenPath: '/attendance' },
        onState: (s) => states.push(s),
        onToolCall,
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
