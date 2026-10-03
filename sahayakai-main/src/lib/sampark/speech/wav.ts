/**
 * Minimal WAV (RIFF) handling for telephony audio: 8 kHz mono G.711 μ-law.
 *
 * Cloud TTS returns μ-law as a WAV with a WAVE_FORMAT_MULAW (7) fmt chunk of
 * 18 bytes, a `fact` chunk and a `data` chunk — so the header is NOT the fixed
 * 44 bytes and the duration must come from the data chunk's length, found by
 * walking the chunks. One μ-law byte is one sample, so seconds = dataBytes / 8000.
 */

export const MULAW_FORMAT = 7;
export const TELEPHONY_SAMPLE_RATE = 8000;
/** μ-law code for zero amplitude (0xFF and 0x7F both decode to 0). */
export const MULAW_SILENCE = 0xff;

export interface WavInfo {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
    dataOffset: number;
    dataBytes: number;
    durationSeconds: number;
}

export class WavFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WavFormatError';
    }
}

export function isRiffWave(buf: Buffer): boolean {
    return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE';
}

/** Walk the RIFF chunks and describe the audio. Throws WavFormatError when there is no fmt or data chunk. */
export function parseWav(buf: Buffer): WavInfo {
    if (!isRiffWave(buf)) throw new WavFormatError('Not a RIFF/WAVE buffer');
    let offset = 12;
    let fmt: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | null = null;
    while (offset + 8 <= buf.length) {
        const id = buf.toString('ascii', offset, offset + 4);
        const size = buf.readUInt32LE(offset + 4);
        const body = offset + 8;
        if (id === 'fmt ') {
            if (size < 16 || body + 16 > buf.length) throw new WavFormatError('Truncated fmt chunk');
            fmt = {
                audioFormat: buf.readUInt16LE(body),
                channels: buf.readUInt16LE(body + 2),
                sampleRate: buf.readUInt32LE(body + 4),
                bitsPerSample: buf.readUInt16LE(body + 14),
            };
        } else if (id === 'data') {
            if (!fmt) throw new WavFormatError('data chunk before fmt chunk');
            // Streaming writers may leave 0xFFFFFFFF or an over-long size; clamp to what is present.
            const dataBytes = Math.min(size, buf.length - body);
            const bytesPerSecond = fmt.sampleRate * fmt.channels * Math.max(1, fmt.bitsPerSample / 8);
            return { ...fmt, dataOffset: body, dataBytes, durationSeconds: bytesPerSecond > 0 ? dataBytes / bytesPerSecond : 0 };
        }
        offset = body + size + (size % 2); // chunks are word-aligned
    }
    throw new WavFormatError(fmt ? 'No data chunk' : 'No fmt chunk');
}

/** Wrap raw μ-law samples in a WAV container (fmt 7, 18-byte fmt, fact, data) — the same layout Cloud TTS returns. */
export function buildMulawWav(samples: Buffer, sampleRate = TELEPHONY_SAMPLE_RATE): Buffer {
    const fmt = Buffer.alloc(8 + 18);
    fmt.write('fmt ', 0, 'ascii');
    fmt.writeUInt32LE(18, 4);
    fmt.writeUInt16LE(MULAW_FORMAT, 8); // audio format
    fmt.writeUInt16LE(1, 10); // channels
    fmt.writeUInt32LE(sampleRate, 12); // sample rate
    fmt.writeUInt32LE(sampleRate, 16); // byte rate
    fmt.writeUInt16LE(1, 20); // block align
    fmt.writeUInt16LE(8, 22); // bits per sample
    fmt.writeUInt16LE(0, 24); // cbSize
    const fact = Buffer.alloc(12);
    fact.write('fact', 0, 'ascii');
    fact.writeUInt32LE(4, 4);
    fact.writeUInt32LE(samples.length, 8);
    const dataHeader = Buffer.alloc(8);
    dataHeader.write('data', 0, 'ascii');
    dataHeader.writeUInt32LE(samples.length, 4);
    const pad = samples.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0);
    const riff = Buffer.alloc(12);
    riff.write('RIFF', 0, 'ascii');
    riff.writeUInt32LE(4 + fmt.length + fact.length + dataHeader.length + samples.length + pad.length, 4);
    riff.write('WAVE', 8, 'ascii');
    return Buffer.concat([riff, fmt, fact, dataHeader, samples, pad]);
}

/** The μ-law sample bytes of a telephony WAV. Throws unless the audio is 8 kHz mono μ-law. */
export function mulawSamples(wav: Buffer): Buffer {
    const info = parseWav(wav);
    if (info.audioFormat !== MULAW_FORMAT || info.channels !== 1 || info.sampleRate !== TELEPHONY_SAMPLE_RATE) {
        throw new WavFormatError(
            `Expected 8 kHz mono μ-law, got format ${info.audioFormat}, ${info.channels} ch, ${info.sampleRate} Hz`,
        );
    }
    return wav.subarray(info.dataOffset, info.dataOffset + info.dataBytes);
}

/**
 * Prepend silence to a telephony WAV. Used for the `message` clip: Indian
 * callers say "Hello?" before listening, so the message starts after a short
 * pause instead of talking over them (plan §4⑧).
 */
export function prependSilence(wav: Buffer, seconds: number): Buffer {
    const samples = mulawSamples(wav);
    const silence = Buffer.alloc(Math.round(seconds * TELEPHONY_SAMPLE_RATE), MULAW_SILENCE);
    return buildMulawWav(Buffer.concat([silence, samples]));
}
