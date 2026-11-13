/**
 * Near-silence check for PCM WAV uploads to `/api/ai/voice-to-text`.
 *
 * Why: Gemini does not return nothing for silence. Given a few seconds of a
 * quiet room it invents plausible teacher speech ("Good morning, everyone.
 * Today we will be starting a new chapter on…"), and VIDYA then answers a
 * sentence nobody said. A recording whose loudest 20 ms frame is below
 * {@link SILENCE_DBFS} has no speech in it, so the route answers "nothing
 * heard" without paying for (or risking) a transcription.
 *
 * The threshold sits well under quiet, far-from-the-phone speech (about
 * -42 dBFS frame RMS) and above the near-digital silence a phone's noise
 * suppression produces (about -60 dBFS).
 */

/** Loudest-frame level below which a recording is treated as silent. */
export const SILENCE_DBFS = -52;

const FRAME_MS = 20;

interface PcmView {
    samples: Int16Array;
    sampleRate: number;
    channels: number;
}

/**
 * Reads a RIFF/WAVE buffer holding 16-bit PCM. Returns null for anything
 * else (other encodings, truncated or non-WAV bytes) so callers can fall
 * back to transcribing as before.
 */
function readPcm16(buf: Uint8Array): PcmView | null {
    if (buf.byteLength < 44) return null;
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const tag = (at: number) =>
        String.fromCharCode(buf[at], buf[at + 1], buf[at + 2], buf[at + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;

    let format = 0;
    let channels = 0;
    let sampleRate = 0;
    let bits = 0;
    let offset = 12;
    while (offset + 8 <= buf.byteLength) {
        const id = tag(offset);
        const size = view.getUint32(offset + 4, true);
        const body = offset + 8;
        if (id === 'fmt ' && body + 16 <= buf.byteLength) {
            format = view.getUint16(body, true);
            channels = view.getUint16(body + 2, true);
            sampleRate = view.getUint32(body + 4, true);
            bits = view.getUint16(body + 14, true);
        } else if (id === 'data') {
            if (format !== 1 || bits !== 16 || channels < 1 || sampleRate < 1) return null;
            // A recorder that never patched the header writes 0 or 0xFFFFFFFF:
            // read what is actually there.
            const end = size === 0 || body + size > buf.byteLength ? buf.byteLength : body + size;
            const count = Math.floor((end - body) / 2);
            const samples = new Int16Array(count);
            for (let i = 0; i < count; i++) samples[i] = view.getInt16(body + i * 2, true);
            return { samples, sampleRate, channels };
        }
        offset = body + size + (size % 2); // chunks are word-aligned
    }
    return null;
}

/**
 * The level of the loudest 20 ms frame, in dBFS (0 = full scale), or null
 * when [buf] is not a 16-bit PCM WAV. An empty data chunk is -Infinity.
 */
export function wavLoudestFrameDbfs(buf: Uint8Array): number | null {
    const pcm = readPcm16(buf);
    if (!pcm) return null;
    const frame = Math.max(1, Math.round((pcm.sampleRate * FRAME_MS) / 1000) * pcm.channels);
    let loudest = 0;
    for (let start = 0; start < pcm.samples.length; start += frame) {
        const end = Math.min(pcm.samples.length, start + frame);
        let sum = 0;
        for (let i = start; i < end; i++) sum += pcm.samples[i] * pcm.samples[i];
        const rms = Math.sqrt(sum / (end - start));
        if (rms > loudest) loudest = rms;
    }
    return loudest === 0 ? -Infinity : 20 * Math.log10(loudest / 32768);
}

/**
 * True when [buf] is a 16-bit PCM WAV with no frame louder than
 * [thresholdDbfs]. Anything that cannot be read as such a WAV is NOT called
 * silent: the caller transcribes it as before.
 */
export function wavLooksSilent(buf: Uint8Array, thresholdDbfs: number = SILENCE_DBFS): boolean {
    const level = wavLoudestFrameDbfs(buf);
    return level !== null && level < thresholdDbfs;
}
