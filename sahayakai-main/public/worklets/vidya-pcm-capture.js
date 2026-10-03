/**
 * VIDYA live voice — microphone capture worklet.
 *
 * Runs on the audio rendering thread. Takes the mic at the AudioContext's
 * native rate (typically 48 kHz), low-pass averages + resamples to 16 kHz
 * mono, converts to PCM16LE and posts ~40 ms chunks (640 samples) to the
 * main thread, which base64-encodes them into `{"audio": ...}` frames for
 * the sidecar (`audio/pcm;rate=16000`, what Gemini Live expects).
 *
 * Also posts the chunk RMS so the UI can show mic level and infer when the
 * teacher has stopped talking. Turn-taking itself is decided server-side by
 * Gemini Live's VAD — this RMS is presentation only.
 */
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 640; // 40 ms @ 16 kHz

class VidyaPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / TARGET_RATE; // e.g. 3 for 48 kHz
    this.pos = 0; // fractional read position into the incoming stream
    this.carry = new Float32Array(0);
    this.out = new Int16Array(CHUNK_SAMPLES);
    this.outLen = 0;
    this.sumSq = 0;
    this.muted = false;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'mute') this.muted = !!e.data.value;
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;
    const ch0 = input[0];

    // Join carry-over with this render quantum.
    const buf = new Float32Array(this.carry.length + ch0.length);
    buf.set(this.carry, 0);
    buf.set(ch0, this.carry.length);

    const ratio = this.ratio;
    let pos = this.pos;
    // Box-filter average over each output sample's window (cheap anti-alias).
    while (pos + ratio <= buf.length) {
      const start = Math.floor(pos);
      const end = Math.min(buf.length, Math.floor(pos + ratio));
      let acc = 0;
      for (let i = start; i < end; i++) acc += buf[i];
      let s = end > start ? acc / (end - start) : buf[start];
      if (this.muted) s = 0;
      if (s > 1) s = 1; else if (s < -1) s = -1;
      this.sumSq += s * s;
      this.out[this.outLen++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.outLen === CHUNK_SAMPLES) {
        const rms = Math.sqrt(this.sumSq / CHUNK_SAMPLES);
        const chunk = this.out.slice(0);
        this.port.postMessage({ type: 'chunk', pcm: chunk.buffer, rms }, [chunk.buffer]);
        this.outLen = 0;
        this.sumSq = 0;
      }
      pos += ratio;
    }
    const consumed = Math.floor(pos);
    this.carry = buf.slice(consumed);
    this.pos = pos - consumed;
    return true;
  }
}

registerProcessor('vidya-pcm-capture', VidyaPcmCapture);
