/**
 * VIDYA live voice session — browser side of the hands-free voice agent.
 *
 *   mic ─► AudioWorklet (PCM16 16 kHz, 40 ms chunks) ─► WebSocket {"audio"}
 *        ─► sidecar /v1/vidya-voice/stream (ADK run_live) ─► Gemini Live
 *   Gemini Live native audio ─► sidecar {"audio": PCM16 24 kHz}
 *        ─► AudioWorklet player (flushable FIFO) ─► speakers
 *
 * One click opens ONE persistent session. Turn-taking is Gemini Live's
 * server-side VAD: the mic streams continuously and the model decides when
 * the teacher has finished. Barge-in is the server's `{"interrupted":true}`
 * — on it the player queue is flushed in the same render quantum and the
 * generation id bumps so any in-flight stale chunk is dropped on arrival.
 *
 * Credentials: the browser only ever holds the sidecar's single-use,
 * 120 s HMAC stream token minted by `/api/vidya-voice/start-session`
 * (Firebase-authenticated). No Google credential reaches the client.
 */

export type VidyaLiveState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error'
  | 'ended';

export interface VidyaLiveToolCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export interface VidyaLiveTranscript {
  role: 'user' | 'vidya';
  text: string;
  final: boolean;
}

export interface VidyaLiveMetrics {
  /** click → socket open */
  connectMs?: number;
  /** click → sidecar says the upstream Live session is ready */
  readyMs?: number;
  turns: Array<{
    /** local estimate: teacher went quiet → first model audio chunk arrived */
    endOfSpeechToFirstAudioMs?: number;
    /** first audio sample played → queue drained */
    responseDurationMs?: number;
    interrupted?: boolean;
    /** teacher started talking over VIDYA → server `interrupted` arrived */
    bargeInToInterruptMs?: number;
  }>;
}

export interface VidyaLiveOptions {
  /**
   * `teacher` (default): Firebase-authenticated `/start-session`, full VIDYA
   * with tools + profile. `public`: anonymous `/public-session`, which the
   * sidecar serves with no tools and no account context.
   */
  scope?: 'teacher' | 'public';
  getIdToken: () => Promise<string | null>;
  /** Body for the session route. Teacher: `{teacherProfile, currentScreenContext, detectedLanguage}`; public: `{detectedLanguage}`. */
  startSessionBody: Record<string, unknown>;
  setup: {
    grade?: string;
    subject?: string;
    schoolContext?: string;
    language?: string;
    screenPath?: string;
  };
  onState: (s: VidyaLiveState, detail?: string) => void;
  onToolCall?: (call: VidyaLiveToolCall) => void;
  onTranscript?: (t: VidyaLiveTranscript) => void;
  onLevel?: (level: number) => void;
  onError?: (code: VidyaLiveErrorCode, message: string) => void;
}

export type VidyaLiveErrorCode =
  | 'mic_denied'
  | 'mic_unavailable'
  | 'unavailable' // 503 from start-session (flag / allowlist)
  | 'unauthorized'
  | 'start_failed'
  | 'socket_failed'
  | 'upstream_failed'
  | 'session_limit'
  | 'idle_timeout'
  | 'audio_failed';

const SPEECH_RMS = 0.02; // local "teacher is making sound" threshold (post-AEC)
const QUIET_MS_FOR_THINKING = 450;
const INTERRUPTED_FLASH_MS = 350;
const READY_FALLBACK_MS = 8000;
const TOOL_TURN_AUDIO_GRACE_MS = 4000;

function b64FromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)));
  }
  return btoa(bin);
}

function pcm16B64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const n = bin.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lo = bin.charCodeAt(i * 2);
    const hi = bin.charCodeAt(i * 2 + 1);
    let v = (hi << 8) | lo;
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 0x8000;
  }
  return out;
}

const CLOSE_CODE_ERRORS: Record<number, [VidyaLiveErrorCode, string]> = {
  4401: ['unauthorized', 'Voice session token was rejected.'],
  4409: ['session_limit', 'Another voice session is already active.'],
  4429: ['session_limit', 'Too many voice sessions this hour.'],
  4503: ['session_limit', 'Voice is busy right now.'],
  4408: ['idle_timeout', 'Voice session ended after inactivity.'],
  4410: ['session_limit', 'Voice session reached its time limit.'],
};

export class VidyaLiveSession {
  private opts: VidyaLiveOptions;
  private state: VidyaLiveState = 'idle';
  private ws: WebSocket | null = null;
  /** Latest `{appContext}` payload; re-sent after setup on every connect. */
  private appContext: Record<string, unknown> | null = null;
  private stream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private playCtx: AudioContext | null = null;
  private capture: AudioWorkletNode | null = null;
  private player: AudioWorkletNode | null = null;
  private outAnalyser: AnalyserNode | null = null;
  private outBuf: Uint8Array<ArrayBuffer> | null = null;
  private micLevel = 0;
  private generation = 0;
  private playing = false;
  private turnComplete = false;
  private stopped = false;
  private sessionEpoch = 0;
  private lastLoudAt = 0;
  private userSpokeThisTurn = false;
  private quietTimer: ReturnType<typeof setTimeout> | null = null;
  private interruptedTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private endOfSpeechAt = 0;
  private firstAudioAt = 0;
  private playStartAt = 0;
  private bargeStartAt = 0;
  private framesUp = 0;
  private framesDown = 0;
  readonly metrics: VidyaLiveMetrics = { turns: [] };
  /** Recent non-audio server frames with the client state at arrival (debugging). */
  readonly frameLog: string[] = [];

  constructor(opts: VidyaLiveOptions) {
    this.opts = opts;
  }

  get currentState(): VidyaLiveState {
    return this.state;
  }

  get stats() {
    return { framesUp: this.framesUp, framesDown: this.framesDown, micLive: this.micLive() };
  }

  /** Teacher's mic level, 0–1 (last 40 ms chunk). */
  inputLevel(): number {
    return this.micLevel;
  }

  /** VIDYA's real playback level, 0–1 — read on demand (e.g. from rAF). */
  outputLevel(): number {
    const a = this.outAnalyser;
    const buf = this.outBuf;
    if (!a || !buf || !this.playing) return 0;
    a.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = (buf[i] - 128) / 128;
      sum += x * x;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 3.5);
  }

  /**
   * Latest application context (screen, state, offered actions) for the
   * sidecar's `get_app_context` tool. Not a turn: no state change, no
   * barge-in, nothing spoken. Kept and re-sent on every (re)connect.
   * Returns whether it went out now.
   */
  setAppContext(context: Record<string, unknown> | null): boolean {
    this.appContext = context;
    if (!context || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    if (this.state === 'error' || this.state === 'ended') return false;
    try {
      this.ws.send(JSON.stringify({ appContext: context }));
      return true;
    } catch {
      return false; // context is an enhancement — never break the voice session
    }
  }

  /** Typed fallback: send a text turn into the SAME live session (VIDYA answers by voice). */
  sendText(text: string): boolean {
    const clean = text.trim().slice(0, 2000);
    if (!clean || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    if (this.state === 'connecting' || this.state === 'error' || this.state === 'ended') return false;
    if (this.playing) this.onInterrupted(); // typing over VIDYA is a barge-in too
    this.ws.send(JSON.stringify({ text: clean }));
    this.resetTurn();
    this.userSpokeThisTurn = true;
    this.endOfSpeechAt = performance.now();
    this.set('thinking');
    return true;
  }

  micLive(): boolean {
    return !!this.stream?.getAudioTracks().some((t) => t.readyState === 'live');
  }

  private set(s: VidyaLiveState, detail?: string) {
    if (this.state === s) return;
    this.state = s;
    this.opts.onState(s, detail);
  }

  private fail(code: VidyaLiveErrorCode, message: string) {
    if (this.stopped) return;
    this.opts.onError?.(code, message);
    this.teardown();
    this.set('error', message);
  }

  /** Must be called from a user gesture (click) — unlocks audio output + mic. */
  async start(): Promise<void> {
    if (this.state !== 'idle' && this.state !== 'ended' && this.state !== 'error') return;
    this.stopped = false;
    const epoch = ++this.sessionEpoch;
    this.metrics.turns = [];
    this.frameLog.length = 0;
    this.metrics.connectMs = this.metrics.readyMs = undefined;
    this.framesUp = this.framesDown = 0;
    this.startedAt = performance.now();
    this.set('connecting');

    // 1. Audio contexts inside the gesture so autoplay policy allows output.
    try {
      this.playCtx = new AudioContext({ sampleRate: 24000, latencyHint: 'interactive' });
      this.micCtx = new AudioContext({ latencyHint: 'interactive' });
      await Promise.all([this.playCtx.resume(), this.micCtx.resume()]);
      await Promise.all([
        this.playCtx.audioWorklet.addModule('/worklets/vidya-pcm-player.js'),
        this.micCtx.audioWorklet.addModule('/worklets/vidya-pcm-capture.js'),
      ]);
    } catch (e) {
      return this.fail('audio_failed', `Audio could not start: ${(e as Error).message}`);
    }
    if (epoch !== this.sessionEpoch) return;

    // 2. Microphone (echo cancellation matters: VIDYA must not barge in on herself).
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      return this.fail(
        name === 'NotAllowedError' || name === 'SecurityError' ? 'mic_denied' : 'mic_unavailable',
        name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : `Microphone unavailable (${name ?? 'unknown'}).`,
      );
    }
    if (epoch !== this.sessionEpoch) return this.teardown();

    // 3. Mint the single-use stream token (Firebase-authenticated server route).
    let session: { wsUrl: string; streamToken: string };
    try {
      const idToken = await this.opts.getIdToken();
      const endpoint =
        this.opts.scope === 'public' ? '/api/vidya-voice/public-session' : '/api/vidya-voice/start-session';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify(this.opts.startSessionBody),
      });
      if (res.status === 401) return this.fail('unauthorized', 'Please sign in to use voice.');
      if (res.status === 503) return this.fail('unavailable', 'Live voice is not available right now.');
      if (res.status === 429) return this.fail('session_limit', 'Please try again in a little while.');
      if (!res.ok) return this.fail('start_failed', `Could not start voice (${res.status}).`);
      session = await res.json();
      if (!session?.wsUrl || !session?.streamToken) {
        return this.fail('start_failed', 'Voice session response was malformed.');
      }
    } catch (e) {
      return this.fail('start_failed', `Could not reach the server: ${(e as Error).message}`);
    }
    if (epoch !== this.sessionEpoch) return this.teardown();

    // 4. Audio graph.
    this.player = new AudioWorkletNode(this.playCtx!, 'vidya-pcm-player', { outputChannelCount: [1] });
    // Tap VIDYA's actual output so the visual can move with her real voice.
    this.outAnalyser = this.playCtx!.createAnalyser();
    this.outAnalyser.fftSize = 512;
    this.outAnalyser.smoothingTimeConstant = 0.6;
    this.outBuf = new Uint8Array(this.outAnalyser.fftSize);
    this.player.connect(this.outAnalyser);
    this.outAnalyser.connect(this.playCtx!.destination);
    this.player.port.onmessage = (e) => this.onPlayerMessage(e.data);
    const src = this.micCtx!.createMediaStreamSource(this.stream);
    this.capture = new AudioWorkletNode(this.micCtx!, 'vidya-pcm-capture');
    src.connect(this.capture);
    // Keep the capture node pulled by the graph without making it audible.
    const sink = this.micCtx!.createGain();
    sink.gain.value = 0;
    this.capture.connect(sink).connect(this.micCtx!.destination);
    this.capture.port.onmessage = (e) => this.onMicChunk(e.data);

    // 5. Socket. Browsers cannot set `Authorization` on a WebSocket, so the
    //    token rides in the subprotocol list (never the URL / access logs).
    try {
      this.ws = new WebSocket(session.wsUrl, ['vidya.v1', `bearer.${session.streamToken}`]);
    } catch (e) {
      return this.fail('socket_failed', `Voice connection failed: ${(e as Error).message}`);
    }
    const ws = this.ws;
    ws.onopen = () => {
      if (epoch !== this.sessionEpoch) return;
      this.metrics.connectMs = Math.round(performance.now() - this.startedAt);
      ws.send(JSON.stringify({ setup: this.opts.setup }));
      // Latest app context (if any) right after setup, so a (re)connected
      // session never starts blind. Ignored by sidecars that predate it.
      if (this.appContext) ws.send(JSON.stringify({ appContext: this.appContext }));
      // The ADK engine announces `{"ready":true}` once the upstream Live
      // socket is open. The legacy relay (rollback engine) never does, so
      // don't strand the UI in CONNECTING if we're talking to that one.
      setTimeout(() => {
        if (epoch === this.sessionEpoch && this.state === 'connecting') this.set('listening');
      }, READY_FALLBACK_MS);
    };
    ws.onmessage = (ev) => {
      if (epoch !== this.sessionEpoch) return; // frame from a previous session
      this.onServerFrame(ev.data);
    };
    ws.onerror = () => {
      /* `onclose` carries the code; handled there */
    };
    ws.onclose = (ev) => {
      if (epoch !== this.sessionEpoch || this.stopped) return;
      const mapped = CLOSE_CODE_ERRORS[ev.code];
      if (mapped) return this.fail(mapped[0], mapped[1]);
      if (this.state === 'connecting') {
        return this.fail('socket_failed', `Voice connection closed (${ev.code}).`);
      }
      this.fail('upstream_failed', `Voice session disconnected (${ev.code}).`);
    };
  }

  /** End the session: stop mic, close socket, drop audio. Safe to call repeatedly. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.sessionEpoch++;
    try {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ end: true }));
    } catch {
      /* socket already gone */
    }
    this.teardown();
    this.set('ended');
  }

  private teardown() {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    if (this.interruptedTimer) clearTimeout(this.interruptedTimer);
    this.quietTimer = this.interruptedTimer = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close(1000);
      } catch {
        /* noop */
      }
    }
    this.player?.port.postMessage({ type: 'flush', generation: ++this.generation });
    this.capture?.port.close();
    this.capture?.disconnect();
    this.player?.disconnect();
    this.capture = this.player = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.micCtx?.close().catch(() => {});
    void this.playCtx?.close().catch(() => {});
    this.micCtx = this.playCtx = null;
    this.playing = false;
    this.outAnalyser = null;
    this.outBuf = null;
    this.micLevel = 0;
    this.opts.onLevel?.(0);
  }

  // ---- mic → server -------------------------------------------------------

  private onMicChunk(m: { type: string; pcm: ArrayBuffer; rms: number }) {
    if (m.type !== 'chunk' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.state === 'connecting') return; // don't stream before upstream is ready
    this.ws.send(JSON.stringify({ audio: b64FromBuffer(m.pcm) }));
    this.framesUp++;
    this.micLevel = Math.min(1, m.rms * 8);
    this.opts.onLevel?.(this.micLevel);

    const now = performance.now();
    if (m.rms > SPEECH_RMS) {
      if (this.state === 'speaking' && !this.bargeStartAt) this.bargeStartAt = now;
      this.lastLoudAt = now;
      if (this.state === 'listening') this.userSpokeThisTurn = true;
      if (this.quietTimer) {
        clearTimeout(this.quietTimer);
        this.quietTimer = null;
      }
    } else if (this.state === 'listening' && this.userSpokeThisTurn && !this.quietTimer) {
      // The model's VAD makes the real turn decision; this only drives the
      // THINKING label between the teacher going quiet and the first audio.
      this.quietTimer = setTimeout(() => {
        this.quietTimer = null;
        if (this.state === 'listening' && this.userSpokeThisTurn) {
          this.endOfSpeechAt = this.lastLoudAt;
          this.set('thinking');
        }
      }, QUIET_MS_FOR_THINKING);
    }
  }

  // ---- server → client -----------------------------------------------------

  private onServerFrame(raw: unknown) {
    if (typeof raw !== 'string') return; // protocol is JSON text only
    let f: Record<string, unknown>;
    try {
      f = JSON.parse(raw);
    } catch {
      return; // malformed frame: ignore, keep the session
    }
    if (!f || typeof f !== 'object') return;
    const kind = Object.keys(f)[0] ?? '?';
    if (kind !== 'audio' || !this.firstAudioAt) {
      this.frameLog.push(`${Math.round(performance.now() - this.startedAt)}ms ${kind}${kind === 'toolCall' ? ':' + (f.toolCall as VidyaLiveToolCall)?.name : ''} [${this.state}]`);
      if (this.frameLog.length > 200) this.frameLog.shift();
    }

    if (f.ready) {
      this.metrics.readyMs = Math.round(performance.now() - this.startedAt);
      this.set('listening');
      return;
    }
    if (typeof f.audio === 'string') {
      this.onModelAudio(f.audio);
      return;
    }
    if (f.interrupted) {
      this.onInterrupted();
      return;
    }
    if (f.turnComplete) {
      // Live closes the cut-off turn right after `interrupted`; the flash
      // timer already owns INTERRUPTED → LISTENING.
      if (this.state === 'interrupted') return;
      if (!this.firstAudioAt && this.state === 'thinking') {
        // A tool call closes its own model turn BEFORE the spoken
        // confirmation starts. Stay THINKING rather than flashing LISTENING;
        // fall back if no audio ever follows.
        if (this.quietTimer) clearTimeout(this.quietTimer);
        this.quietTimer = setTimeout(() => {
          this.quietTimer = null;
          if (this.state === 'thinking' && !this.firstAudioAt) this.finishTurn();
        }, TOOL_TURN_AUDIO_GRACE_MS);
        return;
      }
      this.turnComplete = true;
      if (!this.playing) this.finishTurn();
      return;
    }
    if (f.toolCall && typeof f.toolCall === 'object') {
      const tc = f.toolCall as VidyaLiveToolCall;
      if (typeof tc.name === 'string') this.opts.onToolCall?.({ name: tc.name, args: tc.args ?? {}, id: tc.id });
      return;
    }
    if (f.transcript && typeof f.transcript === 'object') {
      const t = f.transcript as VidyaLiveTranscript;
      if (typeof t.text === 'string') this.opts.onTranscript?.(t);
      if (t.role === 'user' && this.state === 'listening') this.userSpokeThisTurn = true;
      // Gemini Live generates faster than real time: an answer can be fully
      // delivered (so the server has nothing left to "interrupt") while most
      // of it is still queued here. If the server transcribes the teacher
      // talking while we are still playing, that is a barge-in too.
      if (t.role === 'user' && t.text.trim() && this.playing) this.onInterrupted();
      return;
    }
    if (typeof f.error === 'string') {
      this.fail('upstream_failed', f.error);
    }
  }

  private onModelAudio(b64: string) {
    let samples: Float32Array;
    try {
      samples = pcm16B64ToFloat32(b64);
    } catch {
      return; // undecodable chunk — skip it rather than end the lesson
    }
    this.framesDown++;
    if (!this.firstAudioAt) {
      this.firstAudioAt = performance.now();
      this.turnComplete = false;
      this.metrics.turns.push({
        endOfSpeechToFirstAudioMs: this.endOfSpeechAt
          ? Math.round(this.firstAudioAt - this.endOfSpeechAt)
          : undefined,
      });
    }
    this.player?.port.postMessage({ type: 'push', samples: samples.buffer, generation: this.generation }, [
      samples.buffer,
    ]);
  }

  private onPlayerMessage(m: { type: string; flushed?: boolean }) {
    if (m.type === 'playing') {
      this.playing = true;
      if (!this.playStartAt) this.playStartAt = performance.now();
      if (this.state !== 'interrupted') this.set('speaking');
    } else if (m.type === 'drained') {
      this.playing = false;
      // A network underrun also drains the FIFO; only a drain AFTER the model
      // said the turn is complete ends VIDYA's turn.
      if (this.turnComplete && !m.flushed) this.finishTurn();
    }
  }

  private currentTurn() {
    return this.metrics.turns[this.metrics.turns.length - 1];
  }

  private finishTurn() {
    const turn = this.currentTurn();
    if (turn && this.playStartAt && turn.responseDurationMs == null) {
      turn.responseDurationMs = Math.round(performance.now() - this.playStartAt);
    }
    this.resetTurn();
    if (this.state !== 'error' && this.state !== 'ended') this.set('listening');
  }

  private resetTurn() {
    this.firstAudioAt = 0;
    this.playStartAt = 0;
    this.endOfSpeechAt = 0;
    this.bargeStartAt = 0;
    this.turnComplete = false;
    this.userSpokeThisTurn = false;
  }

  private onInterrupted() {
    // Gemini Live's VAD heard the teacher over VIDYA: kill queued audio NOW.
    this.player?.port.postMessage({ type: 'flush', generation: ++this.generation });
    // Live also signals `interrupted` when the teacher starts talking with
    // nothing in flight. Nothing was cut off, so there is no state to show.
    if (!this.playing && !this.firstAudioAt) return;
    const turn = this.currentTurn();
    if (turn && this.firstAudioAt) {
      turn.interrupted = true;
      if (this.playStartAt) turn.responseDurationMs = Math.round(performance.now() - this.playStartAt);
      if (this.bargeStartAt) turn.bargeInToInterruptMs = Math.round(performance.now() - this.bargeStartAt);
    }
    this.playing = false;
    this.resetTurn();
    // The teacher is mid-utterance — this IS the next turn.
    this.userSpokeThisTurn = true;
    this.lastLoudAt = performance.now();
    this.set('interrupted');
    if (this.interruptedTimer) clearTimeout(this.interruptedTimer);
    this.interruptedTimer = setTimeout(() => {
      if (this.state === 'interrupted') this.set('listening');
    }, INTERRUPTED_FLASH_MS);
  }
}
