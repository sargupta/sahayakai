/**
 * Browser-playable copies of telephony clips.
 *
 * Clips are stored exactly as the carrier will play them: 8 kHz G.711 μ-law in
 * a WAV container (WAVE format tag 7). Telephony wants that; browsers do not
 * reliably decode it (Firefox refuses format 7 outright). The console asks for
 * `?format=pcm` and gets the same samples expanded to 16-bit linear PCM — the
 * sound is identical, only the encoding changes, so the principal still hears
 * exactly what a parent will hear.
 */

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_MULAW = 7;

interface WavLayout {
    formatTag: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
    dataOffset: number;
    dataLength: number;
}

/** Walk the RIFF chunks; tolerate extra chunks (LIST, fact) between fmt and data. */
export function parseWav(buf: Buffer): WavLayout {
    if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('not a RIFF/WAVE file');
    }
    let offset = 12;
    let fmt: Omit<WavLayout, 'dataOffset' | 'dataLength'> | null = null;
    while (offset + 8 <= buf.length) {
        const id = buf.toString('ascii', offset, offset + 4);
        const size = buf.readUInt32LE(offset + 4);
        const body = offset + 8;
        if (id === 'fmt ') {
            fmt = {
                formatTag: buf.readUInt16LE(body),
                channels: buf.readUInt16LE(body + 2),
                sampleRate: buf.readUInt32LE(body + 4),
                bitsPerSample: buf.readUInt16LE(body + 14),
            };
        } else if (id === 'data') {
            if (!fmt) throw new Error('data chunk before fmt chunk');
            // Some encoders write 0xFFFFFFFF or an over-long size for streamed data; clamp to the buffer.
            const dataLength = Math.min(size, buf.length - body);
            return { ...fmt, dataOffset: body, dataLength };
        }
        offset = body + size + (size % 2); // chunks are word-aligned
    }
    throw new Error('no data chunk');
}

/** ITU-T G.711 μ-law → 16-bit linear. */
function ulawToLinear(value: number): number {
    const u = ~value & 0xff;
    let t = ((u & 0x0f) << 3) + 0x84;
    t <<= (u & 0x70) >> 4;
    return u & 0x80 ? 0x84 - t : t - 0x84;
}

function pcmHeader(dataLength: number, sampleRate: number, channels: number): Buffer {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0, 'ascii');
    h.writeUInt32LE(36 + dataLength, 4);
    h.write('WAVE', 8, 'ascii');
    h.write('fmt ', 12, 'ascii');
    h.writeUInt32LE(16, 16);
    h.writeUInt16LE(WAVE_FORMAT_PCM, 20);
    h.writeUInt16LE(channels, 22);
    h.writeUInt32LE(sampleRate, 24);
    h.writeUInt32LE(sampleRate * channels * 2, 28);
    h.writeUInt16LE(channels * 2, 32);
    h.writeUInt16LE(16, 34);
    h.write('data', 36, 'ascii');
    h.writeUInt32LE(dataLength, 40);
    return h;
}

/** μ-law WAV → 16-bit PCM WAV. PCM input is returned unchanged; anything else throws. */
export function toPcm16Wav(buf: Buffer): Buffer {
    const wav = parseWav(buf);
    if (wav.formatTag === WAVE_FORMAT_PCM) return buf;
    if (wav.formatTag !== WAVE_FORMAT_MULAW || wav.bitsPerSample !== 8) {
        throw new Error(`unsupported WAV format tag ${wav.formatTag}`);
    }
    const out = Buffer.alloc(wav.dataLength * 2);
    for (let i = 0; i < wav.dataLength; i++) {
        out.writeInt16LE(ulawToLinear(buf[wav.dataOffset + i]), i * 2);
    }
    return Buffer.concat([pcmHeader(out.length, wav.sampleRate, wav.channels), out]);
}
