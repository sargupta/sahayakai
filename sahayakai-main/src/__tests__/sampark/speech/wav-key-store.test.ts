/**
 * @jest-environment node
 *
 * WAV parsing (duration from the data chunk, not a fixed 44-byte header),
 * content-addressed clip keys, and the local audio store.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { languageInfo } from '@/lib/sampark/languages';
import { clipKey } from '@/lib/sampark/speech/clip-key';
import { toTelephonyWav } from '@/lib/sampark/speech/google-speech';
import { createLocalAudioStore } from '@/lib/sampark/speech/local-audio-store';
import { buildMulawWav, MULAW_SILENCE, parseWav, prependSilence, WavFormatError } from '@/lib/sampark/speech/wav';

import { fakeMulawWav } from './helpers';

/** The exact header layout Cloud TTS returned for a MULAW request (probed 2026-09-30): fmt 18 bytes, fact, data. */
function googleStyleWav(dataBytes: number): Buffer {
    const header = Buffer.from('524946460000000057415645666d74201200000007000100401f0000401f00000100080000006661637404000000000000006461746100000000', 'hex');
    header.writeUInt32LE(dataBytes, header.length - 4);
    header.writeUInt32LE(dataBytes, 46);
    header.writeUInt32LE(header.length - 8 + dataBytes, 4);
    return Buffer.concat([header, Buffer.alloc(dataBytes, 0x7f)]);
}

describe('WAV', () => {
    it('reads duration from the data chunk of a Cloud-TTS-shaped μ-law WAV', () => {
        const wav = googleStyleWav(21533);
        const info = parseWav(wav);
        expect(info).toMatchObject({ audioFormat: 7, channels: 1, sampleRate: 8000, bitsPerSample: 8, dataOffset: 58, dataBytes: 21533 });
        expect(info.durationSeconds).toBeCloseTo(21533 / 8000, 6);
        expect(toTelephonyWav(wav).durationSeconds).toBeCloseTo(2.6916, 3);
    });

    it('skips unknown chunks and handles odd-sized chunk padding', () => {
        const base = fakeMulawWav(0.5);
        const list = Buffer.concat([Buffer.from('LIST', 'ascii'), Buffer.from([3, 0, 0, 0]), Buffer.from([1, 2, 3, 0])]);
        const withList = Buffer.concat([base.subarray(0, 12), list, base.subarray(12)]);
        expect(parseWav(withList).dataBytes).toBe(4000);
    });

    it('clamps an over-long data size to the bytes present', () => {
        const wav = googleStyleWav(800);
        wav.writeUInt32LE(0xffffffff, 54);
        expect(parseWav(wav).dataBytes).toBe(800);
    });

    it('rejects non-WAV input and a WAV without data', () => {
        expect(() => parseWav(Buffer.from('not audio at all'))).toThrow(WavFormatError);
        expect(() => parseWav(googleStyleWav(0).subarray(0, 50))).toThrow(WavFormatError);
    });

    it('wraps a headerless μ-law stream', () => {
        const out = toTelephonyWav(Buffer.alloc(16000, 0x55));
        expect(out.durationSeconds).toBe(2);
        expect(out.audio.toString('ascii', 0, 4)).toBe('RIFF');
    });

    it('prepends μ-law silence (0xFF) and updates the lengths', () => {
        const wav = fakeMulawWav(1);
        const out = prependSilence(wav, 0.8);
        const info = parseWav(out);
        expect(info.dataBytes).toBe(8000 + 6400);
        expect(info.durationSeconds).toBeCloseTo(1.8, 6);
        expect(out[info.dataOffset]).toBe(MULAW_SILENCE);
        expect(out[info.dataOffset + 6399]).toBe(MULAW_SILENCE);
        expect(out[info.dataOffset + 6400]).toBe(0x55);
        expect(out.readUInt32LE(4)).toBe(out.length - 8);
    });

    it('builds a RIFF size that matches the buffer, padding odd data', () => {
        const odd = buildMulawWav(Buffer.alloc(7, 1));
        expect(odd.readUInt32LE(4)).toBe(odd.length - 8);
        expect(parseWav(odd).dataBytes).toBe(7);
    });
});

describe('clipKey', () => {
    const ne = languageInfo('Nepali').speech;
    it('is 40 hex chars, stable, and NFC-insensitive', () => {
        const k = clipKey(ne, 'नमस्ते');
        expect(k).toMatch(/^[a-f0-9]{40}$/);
        expect(clipKey(ne, 'नमस्ते')).toBe(k);
        expect(clipKey(ne, 'नमस्ते'.normalize('NFD'))).toBe(k);
    });

    it('changes with text, engine, voice, model and language code', () => {
        const k = clipKey(ne, 'नमस्ते');
        expect(clipKey(ne, 'नमस्ते।')).not.toBe(k);
        expect(clipKey({ ...ne, model: 'gemini-2.5-pro-tts' }, 'नमस्ते')).not.toBe(k);
        expect(clipKey({ ...ne, voice: 'Puck' }, 'नमस्ते')).not.toBe(k);
        expect(clipKey({ ...ne, ttsLanguageCode: 'hi-IN' }, 'नमस्ते')).not.toBe(k);
        expect(clipKey({ ...ne, engine: 'chirp3-hd' }, 'नमस्ते')).not.toBe(k);
    });
});

describe('createLocalAudioStore', () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sampark-audio-'));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('round-trips audio under its hex key', async () => {
        const store = createLocalAudioStore(path.join(dir, 'nested'));
        const key = 'a'.repeat(40);
        expect(await store.exists(key)).toBe(false);
        expect(await store.get(key)).toBeNull();
        await store.put(key, Buffer.from([1, 2, 3]), 'audio/wav');
        expect(await store.exists(key)).toBe(true);
        expect(await store.get(key)).toEqual({ audio: Buffer.from([1, 2, 3]), mimeType: 'audio/wav' });
        expect(fs.readdirSync(path.join(dir, 'nested'))).toEqual([`${key}.wav`]); // no temp files left behind
    });

    it('overwrites atomically', async () => {
        const store = createLocalAudioStore(dir);
        const key = 'b'.repeat(40);
        await store.put(key, Buffer.from([1]), 'audio/wav');
        await store.put(key, Buffer.from([2, 2]), 'audio/wav');
        expect((await store.get(key))!.audio).toEqual(Buffer.from([2, 2]));
    });

    it('refuses keys that are not hex, so a key can never escape the directory', async () => {
        const store = createLocalAudioStore(dir);
        await expect(store.put('../../etc/passwd', Buffer.from([1]), 'audio/wav')).rejects.toThrow(/Invalid audio key/);
        await expect(store.put('abc', Buffer.from([1]), 'audio/wav')).rejects.toThrow(/Invalid audio key/);
        expect(await store.get('../../etc/passwd')).toBeNull();
        expect(await store.exists('zz'.repeat(20))).toBe(false);
    });

    it('accepts upper-case hex by lower-casing it', async () => {
        const store = createLocalAudioStore(dir);
        await store.put('ABCDEF0123456789', Buffer.from([9]), 'audio/wav');
        expect(await store.exists('abcdef0123456789')).toBe(true);
    });
});
