/**
 * VIDYA live voice — streamed model-audio player worklet.
 *
 * The sidecar relays Gemini Live's native audio as PCM16LE 24 kHz mono
 * chunks. The main thread converts each to Float32 and posts it here; this
 * processor plays them gap-free from a growable FIFO.
 *
 * Barge-in: `{type:'flush'}` drops EVERYTHING queued in the same render
 * quantum (≤ 2.7 ms at 48 kHz), so stale audio from an interrupted answer
 * can never keep playing. Chunks carry the generation id they belong to;
 * anything tagged with an older generation than the latest flush is dropped
 * on arrival, which closes the race where a stale chunk is already in the
 * MessagePort queue when the flush lands.
 *
 * Posts `{type:'playing'}` on the first sample after silence and
 * `{type:'drained'}` when the queue runs dry, which drives SPEAKING ↔
 * LISTENING in the UI.
 */
class VidyaPcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = []; // Float32Array chunks
    this.head = 0; // read offset into queue[0]
    this.queued = 0; // total samples queued
    this.playing = false;
    this.generation = 0;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (!m) return;
      if (m.type === 'push') {
        if (m.generation < this.generation) return; // stale — interrupted answer
        const samples = new Float32Array(m.samples);
        this.queue.push(samples);
        this.queued += samples.length;
      } else if (m.type === 'flush') {
        this.generation = m.generation;
        this.queue = [];
        this.head = 0;
        this.queued = 0;
        if (this.playing) {
          this.playing = false;
          this.port.postMessage({ type: 'drained', flushed: true });
        }
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    let i = 0;
    while (i < out.length && this.queue.length > 0) {
      const cur = this.queue[0];
      const n = Math.min(out.length - i, cur.length - this.head);
      out.set(cur.subarray(this.head, this.head + n), i);
      i += n;
      this.head += n;
      this.queued -= n;
      if (this.head >= cur.length) {
        this.queue.shift();
        this.head = 0;
      }
    }
    if (i > 0 && !this.playing) {
      this.playing = true;
      this.port.postMessage({ type: 'playing' });
    }
    for (; i < out.length; i++) out[i] = 0;
    if (this.playing && this.queue.length === 0) {
      this.playing = false;
      this.port.postMessage({ type: 'drained', flushed: false });
    }
    // Mirror to any extra output channels.
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    return true;
  }
}

registerProcessor('vidya-pcm-player', VidyaPcmPlayer);
