/**
 * VidyaLiveSession — connect watchdog + recovery without a page refresh.
 *
 * Regression for "I lost the connection. Tap me to start again." being the
 * only way out, and for CONNECTING spinning forever when the token route or
 * the voice sidecar hangs: after mic permission, the socket must open within
 * CONNECT_TIMEOUT_MS or the attempt fails (mic released), and the very next
 * tap starts a fresh, working session.
 */

import { CONNECT_TIMEOUT_MS, VidyaLiveSession, type VidyaLiveErrorCode, type VidyaLiveState } from '@/lib/vidya-live/live-session';

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


const stopTrack = jest.fn();
beforeEach(() => {
    stopTrack.mockClear();
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockImplementation(async () => ({
        getTracks: () => [{ stop: stopTrack }],
        getAudioTracks: () => [],
    }));
});
afterEach(() => jest.useRealTimers());

function makeSession() {
    const states: VidyaLiveState[] = [];
    const errors: VidyaLiveErrorCode[] = [];
    const session = new VidyaLiveSession({
        scope: 'teacher',
        getIdToken: async () => 'id-token',
        startSessionBody: {},
        setup: { language: 'en' },
        onState: (s) => states.push(s),
        onToolCall: jest.fn(),
        onError: (c) => errors.push(c),
    });
    return { session, states, errors };
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

it('a hung start-session request fails after the watchdog and releases the mic', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch; // never answers
    const { session, states, errors } = makeSession();
    void session.start();
    await flush();
    expect(session.currentState).toBe('connecting');

    jest.advanceTimersByTime(CONNECT_TIMEOUT_MS - 1);
    expect(session.currentState).toBe('connecting');
    jest.advanceTimersByTime(1);

    expect(session.currentState).toBe('error');
    expect(errors).toEqual(['socket_failed']);
    expect(stopTrack).toHaveBeenCalled();
    expect(states).toEqual(['connecting', 'error']);
});

it('a socket that never opens fails after the watchdog', async () => {
    jest.useFakeTimers();
    const { session, errors } = makeSession();
    await session.start();
    expect(FakeSocket.last).not.toBeNull();
    jest.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    expect(session.currentState).toBe('error');
    expect(errors).toEqual(['socket_failed']);
});

it('the watchdog never fires once the socket has opened', async () => {
    jest.useFakeTimers();
    const { session, errors } = makeSession();
    await session.start();
    FakeSocket.last!.open();
    FakeSocket.last!.serve({ ready: true });
    jest.advanceTimersByTime(CONNECT_TIMEOUT_MS * 3);
    expect(errors).toEqual([]);
    expect(session.currentState).toBe('listening');
});

it('after a dropped connection the next tap starts a fresh working session (no refresh)', async () => {
    const { session, errors } = makeSession();
    await session.start();
    const first = FakeSocket.last!;
    first.open();
    first.serve({ ready: true });
    first.onclose?.({ code: 1006 }); // network drop mid-session
    expect(session.currentState).toBe('error');
    expect(errors).toEqual(['upstream_failed']);

    await session.start(); // the tap
    const second = FakeSocket.last!;
    expect(second).not.toBe(first);
    second.open();
    second.serve({ ready: true });
    expect(session.currentState).toBe('listening');
    // Late frames from the dead socket are ignored.
    first.onmessage?.({ data: JSON.stringify({ ready: true }) });
    expect(session.currentState).toBe('listening');
});
