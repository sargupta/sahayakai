/**
 * @jest-environment node
 *
 * Class gate (2026-11-13): a recording with no speech must never reach the
 * STT model. Gemini invents plausible teacher speech for silent audio, so the
 * route answers "nothing heard" for any 16-bit PCM WAV whose loudest 20 ms
 * frame is below SILENCE_DBFS, and these tests pin where that line sits:
 * quiet rooms are silent, quiet speech is not, and audio it cannot read is
 * never called silent.
 */
import { SILENCE_DBFS, wavLooksSilent, wavLoudestFrameDbfs } from '@/lib/audio/wav-silence';

function wav(samples: number[], sampleRate = 16000, dataSizeOverride?: number): Uint8Array {
    const data = samples.length * 2;
    const buf = new ArrayBuffer(44 + data);
    const v = new DataView(buf);
    const put = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    put(0, 'RIFF');
    v.setUint32(4, 36 + data, true);
    put(8, 'WAVE');
    put(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    put(36, 'data');
    v.setUint32(40, dataSizeOverride ?? data, true);
    samples.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
    return new Uint8Array(buf);
}

/** Deterministic pseudo-noise in [-amp, amp]. */
function noise(seconds: number, amp: number): number[] {
    let x = 12345;
    return Array.from({ length: Math.round(16000 * seconds) }, () => {
        x = (x * 1103515245 + 12345) & 0x7fffffff;
        return Math.round(((x / 0x7fffffff) * 2 - 1) * amp);
    });
}

/** A sine "voice" whose RMS sits at [dbfs]. */
function tone(seconds: number, dbfs: number): number[] {
    const amp = 32768 * Math.pow(10, dbfs / 20) * Math.SQRT2;
    return Array.from({ length: Math.round(16000 * seconds) }, (_, i) =>
        Math.round(amp * Math.sin((2 * Math.PI * 220 * i) / 16000)));
}

describe('wavLooksSilent', () => {
    it('a quiet room (noise around -60 dBFS) is silent', () => {
        expect(wavLooksSilent(wav(noise(3, 60)))).toBe(true);
    });

    it('digital silence is silent', () => {
        expect(wavLooksSilent(wav(new Array(16000).fill(0)))).toBe(true);
        expect(wavLoudestFrameDbfs(wav(new Array(16000).fill(0)))).toBe(-Infinity);
    });

    it('quiet speech far from the phone (-42 dBFS) is NOT silent', () => {
        expect(wavLooksSilent(wav([...noise(1, 40), ...tone(1, -42), ...noise(1, 40)]))).toBe(false);
    });

    it('a short word in a quiet room is NOT silent', () => {
        expect(wavLooksSilent(wav([...noise(1.5, 60), ...tone(0.25, -30), ...noise(1.5, 60)]))).toBe(false);
    });

    it('sits just under quiet speech', () => {
        expect(wavLooksSilent(wav(tone(1, SILENCE_DBFS + 3)))).toBe(false);
        expect(wavLooksSilent(wav(tone(1, SILENCE_DBFS - 3)))).toBe(true);
    });

    it('reads a header the recorder never patched (data size 0)', () => {
        expect(wavLooksSilent(wav(tone(1, -20), 16000, 0))).toBe(false);
        expect(wavLooksSilent(wav(noise(1, 60), 16000, 0))).toBe(true);
    });

    it('never calls audio it cannot read silent', () => {
        expect(wavLooksSilent(new Uint8Array([1, 2, 3, 4, 5]))).toBe(false);
        expect(wavLooksSilent(new Uint8Array(200))).toBe(false); // zeros, no RIFF header
        const webm = new Uint8Array(100);
        webm.set([0x1a, 0x45, 0xdf, 0xa3]);
        expect(wavLooksSilent(webm)).toBe(false);
        expect(wavLoudestFrameDbfs(webm)).toBeNull();
    });
});
