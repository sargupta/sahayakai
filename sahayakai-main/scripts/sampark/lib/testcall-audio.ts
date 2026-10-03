/**
 * Audio helpers for the one-off Vobiz test call (scripts/sampark/vobiz-test-call.ts).
 *
 * Pure, dependency-free (node:fs / node:path only). Wraps raw G.711 mu-law (the
 * pre-recorded openers in sahayakai-agents) into a WAV file Vobiz can <Play>,
 * and can decode mu-law to 16-bit PCM for the `--pcm` fallback.
 *
 * No audio is invented here: every byte served comes from a repo opener or from
 * a clip directory the operator supplies.
 */

import fs from 'node:fs';
import path from 'node:path';

export const WAV_FORMAT_PCM = 1;
export const WAV_FORMAT_MULAW = 7;
export const SAMPLE_RATE = 8000;

/** Languages the test call accepts. Openers exist for all but Nepali. */
export const SUPPORTED_LANGUAGES = [
    'English', 'Hindi', 'Bengali', 'Nepali', 'Gujarati', 'Kannada',
    'Malayalam', 'Marathi', 'Odia', 'Punjabi', 'Tamil', 'Telugu',
] as const;
export type TestCallLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(s: string): s is TestCallLanguage {
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(s);
}

/** The five clip names the call can play. */
export const CLIP_NAMES = ['notice', 'confirm_1', 'confirm_2', 'opt_out_done', 'no_input'] as const;
export type ClipName = (typeof CLIP_NAMES)[number];

/** Standard G.711 mu-law -> linear 16-bit sample. */
export function mulawToLinear(byte: number): number {
    const u = ~byte & 0xff;
    const sign = u & 0x80;
    const exponent = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    return sign ? -sample : sample;
}

/** mu-law bytes -> little-endian 16-bit PCM bytes. */
export function mulawToPcm16(ulaw: Uint8Array): Buffer {
    const out = Buffer.alloc(ulaw.length * 2);
    for (let i = 0; i < ulaw.length; i++) out.writeInt16LE(mulawToLinear(ulaw[i]), i * 2);
    return out;
}

/**
 * Build a RIFF/WAVE file. For tag 7 (mu-law) the fmt chunk is the 18-byte
 * WAVEFORMATEX form plus a `fact` chunk, as the spec requires for non-PCM data.
 */
export function buildWav(data: Buffer, formatTag: 1 | 7, sampleRate = SAMPLE_RATE): Buffer {
    const channels = 1;
    const bitsPerSample = formatTag === WAV_FORMAT_PCM ? 16 : 8;
    const blockAlign = (channels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const nonPcm = formatTag !== WAV_FORMAT_PCM;

    const fmtSize = nonPcm ? 18 : 16;
    const fmt = Buffer.alloc(8 + fmtSize);
    fmt.write('fmt ', 0, 'ascii');
    fmt.writeUInt32LE(fmtSize, 4);
    fmt.writeUInt16LE(formatTag, 8);
    fmt.writeUInt16LE(channels, 10);
    fmt.writeUInt32LE(sampleRate, 12);
    fmt.writeUInt32LE(byteRate, 16);
    fmt.writeUInt16LE(blockAlign, 20);
    fmt.writeUInt16LE(bitsPerSample, 22);
    if (nonPcm) fmt.writeUInt16LE(0, 24); // cbSize

    const fact = Buffer.alloc(nonPcm ? 12 : 0);
    if (nonPcm) {
        fact.write('fact', 0, 'ascii');
        fact.writeUInt32LE(4, 4);
        fact.writeUInt32LE(data.length / blockAlign, 8); // samples per channel
    }

    const dataHeader = Buffer.alloc(8);
    dataHeader.write('data', 0, 'ascii');
    dataHeader.writeUInt32LE(data.length, 4);

    const pad = data.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
    const body = Buffer.concat([Buffer.from('WAVE', 'ascii'), fmt, fact, dataHeader, data, pad]);
    const riff = Buffer.alloc(8);
    riff.write('RIFF', 0, 'ascii');
    riff.writeUInt32LE(body.length, 4);
    return Buffer.concat([riff, body]);
}

export interface ParsedWav {
    formatTag: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
    data: Buffer;
    /** RIFF size field matches the file length (minus 8). */
    riffSizeOk: boolean;
}

/** Strict-enough RIFF/WAVE parser; throws on anything malformed. */
export function parseWav(buf: Buffer): ParsedWav {
    if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('not a RIFF/WAVE file');
    }
    const riffSizeOk = buf.readUInt32LE(4) === buf.length - 8;
    let off = 12;
    let fmt: Omit<ParsedWav, 'data' | 'riffSizeOk'> | null = null;
    while (off + 8 <= buf.length) {
        const id = buf.toString('ascii', off, off + 4);
        const size = buf.readUInt32LE(off + 4);
        const start = off + 8;
        if (start + size > buf.length) throw new Error(`chunk ${id} overruns file`);
        if (id === 'fmt ') {
            fmt = {
                formatTag: buf.readUInt16LE(start),
                channels: buf.readUInt16LE(start + 2),
                sampleRate: buf.readUInt32LE(start + 4),
                bitsPerSample: buf.readUInt16LE(start + 14),
            };
        } else if (id === 'data') {
            if (!fmt) throw new Error('data chunk before fmt chunk');
            return { ...fmt, data: buf.subarray(start, start + size), riffSizeOk };
        }
        off = start + size + (size % 2);
    }
    throw new Error('no data chunk');
}

/** Wrap raw 8 kHz mono mu-law as a tag-7 WAV, or decode it to a tag-1 PCM WAV. */
export function ulawToWav(ulaw: Buffer, pcm: boolean): Buffer {
    return pcm ? buildWav(mulawToPcm16(ulaw), WAV_FORMAT_PCM) : buildWav(ulaw, WAV_FORMAT_MULAW);
}

/** Default opener folder: sahayakai-agents/.../telephony/openers, relative to this file. */
export function defaultOpenersDir(): string {
    const here = typeof __dirname !== 'undefined' ? __dirname : path.join(process.cwd(), 'scripts/sampark/lib');
    return path.resolve(here, '../../../../sahayakai-agents/src/sahayakai_agents/telephony/openers');
}

/** Find `<Language>*.ulaw` in the openers folder. Throws a helpful error if there is none. */
export function findOpener(language: string, dir = defaultOpenersDir()): string {
    if (!fs.existsSync(dir)) throw new Error(`openers folder not found: ${dir}`);
    const hit = fs.readdirSync(dir).filter((f) => f.startsWith(language) && f.endsWith('.ulaw')).sort()[0];
    if (!hit) {
        const have = fs.readdirSync(dir).filter((f) => f.endsWith('.ulaw')).map((f) => f.replace(/\.ulaw$/, ''));
        throw new Error(`no pre-recorded opener for ${language}. Available: ${have.join(', ')}. Use --clips <dir> instead.`);
    }
    return path.join(dir, hit);
}

export type ClipSet = Map<string, Buffer>;

/** --use-openers: one clip only (notice). Nothing else is invented. */
export function loadOpenerClips(language: string, pcm: boolean, dir?: string): ClipSet {
    const file = findOpener(language, dir);
    return new Map([['notice', ulawToWav(fs.readFileSync(file), pcm)]]);
}

/** --clips <dir>: notice.wav etc. `notice.wav` is required, the rest optional. */
export function loadClipDir(dir: string, pcm: boolean): ClipSet {
    const clips: ClipSet = new Map();
    for (const name of CLIP_NAMES) {
        const file = path.join(dir, `${name}.wav`);
        if (!fs.existsSync(file)) continue;
        let buf: Buffer = fs.readFileSync(file);
        const wav = parseWav(buf); // validates
        if (pcm && wav.formatTag === WAV_FORMAT_MULAW) buf = buildWav(mulawToPcm16(wav.data), WAV_FORMAT_PCM, wav.sampleRate);
        clips.set(name, buf);
    }
    if (!clips.has('notice')) throw new Error(`${path.join(dir, 'notice.wav')} is required`);
    return clips;
}
