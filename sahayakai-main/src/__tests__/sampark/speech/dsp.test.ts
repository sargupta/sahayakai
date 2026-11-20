/**
 * @jest-environment node
 *
 * The telephony DSP behind the Bengali voice move and the loudness fix (voice
 * phase, CONVERSATION_PLAN.md §6.1): the G.711 codec is bit-exact, the 8 kHz
 * resampler keeps the speech band and stops aliasing, the BS.1770-4 meter reads
 * the reference levels at every rate we use, and normalisation brings uneven
 * clips to one level without breaking the peak ceiling or the duration.
 */

import {
    integratedLoudness,
    kWeightingBiquads,
    mulawDecode,
    mulawEncode,
    NEAR_SILENCE_LUFS,
    normaliseTelephonyWav,
    resampleTo8k,
    TELEPHONY_PEAK_CEILING_DBFS,
    TELEPHONY_TARGET_LUFS,
} from '@/lib/sampark/speech/dsp';
import { buildMulawWav, mulawSamples, MULAW_SILENCE, parseWav } from '@/lib/sampark/speech/wav';

/** The G.711 μ-law decoding table (as produced independently by ffmpeg's pcm_mulaw and Python's audioop). */
const G711_MULAW_TABLE = [
    -32124, -31100, -30076, -29052, -28028, -27004, -25980, -24956, -23932, -22908, -21884, -20860, -19836, -18812, -17788, -16764,
    -15996, -15484, -14972, -14460, -13948, -13436, -12924, -12412, -11900, -11388, -10876, -10364, -9852, -9340, -8828, -8316,
    -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140, -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
    -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004, -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
    -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436, -1372, -1308, -1244, -1180, -1116, -1052, -988, -924,
    -876, -844, -812, -780, -748, -716, -684, -652, -620, -588, -556, -524, -492, -460, -428, -396,
    -372, -356, -340, -324, -308, -292, -276, -260, -244, -228, -212, -196, -180, -164, -148, -132,
    -120, -112, -104, -96, -88, -80, -72, -64, -56, -48, -40, -32, -24, -16, -8, 0,
    32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956, 23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
    15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412, 11900, 11388, 10876, 10364, 9852, 9340, 8828, 8316,
    7932, 7676, 7420, 7164, 6908, 6652, 6396, 6140, 5884, 5628, 5372, 5116, 4860, 4604, 4348, 4092,
    3900, 3772, 3644, 3516, 3388, 3260, 3132, 3004, 2876, 2748, 2620, 2492, 2364, 2236, 2108, 1980,
    1884, 1820, 1756, 1692, 1628, 1564, 1500, 1436, 1372, 1308, 1244, 1180, 1116, 1052, 988, 924,
    876, 844, 812, 780, 748, 716, 684, 652, 620, 588, 556, 524, 492, 460, 428, 396,
    372, 356, 340, 324, 308, 292, 276, 260, 244, 228, 212, 196, 180, 164, 148, 132,
    120, 112, 104, 96, 88, 80, 72, 64, 56, 48, 40, 32, 24, 16, 8, 0,
];

// ── Signal helpers ──────────────────────────────────────────────────────────

function tone(hz: number, rate: number, seconds: number, amplitude: number, phase = 0): Float64Array {
    const n = Math.round(seconds * rate);
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / rate + phase);
    return out;
}

function toInt16(x: Float64Array): Int16Array {
    return Int16Array.from(x, (v) => Math.max(-32768, Math.min(32767, Math.round(v))));
}

function toFloat32(x: Float64Array): Float32Array {
    return Float32Array.from(x);
}

/** RMS of the middle of a signal, skipping `edge` samples at each end (filter warm-up). */
function rms(x: ArrayLike<number>, edge = 0): number {
    let s = 0;
    for (let i = edge; i < x.length - edge; i++) s += x[i] * x[i];
    return Math.sqrt(s / (x.length - 2 * edge));
}

const db = (ratio: number) => 20 * Math.log10(ratio);

/** A speech-like 8 kHz μ-law WAV: four partials under a 4 Hz syllabic envelope, scaled by `amplitude` (int16 units). */
function speechLikeWav(amplitude: number, seconds = 4): Buffer {
    const rate = 8000;
    const n = Math.round(seconds * rate);
    const codes = Buffer.alloc(n);
    for (let i = 0; i < n; i++) {
        const t = i / rate;
        const envelope = 0.55 + 0.45 * Math.sin(2 * Math.PI * 4 * t);
        const v = 0.4 * Math.sin(2 * Math.PI * 310 * t) + 0.3 * Math.sin(2 * Math.PI * 720 * t + 1) + 0.2 * Math.sin(2 * Math.PI * 1150 * t + 2) + 0.1 * Math.sin(2 * Math.PI * 2300 * t + 3);
        codes[i] = mulawEncode(amplitude * envelope * v);
    }
    return buildMulawWav(codes);
}

function decodedFloat(wav: Buffer): Float32Array {
    return Float32Array.from(mulawSamples(wav), (b) => mulawDecode(b) / 32768);
}

// ── G.711 μ-law ─────────────────────────────────────────────────────────────

describe('G.711 μ-law codec', () => {
    it('decodes every byte exactly as the G.711 table', () => {
        for (let b = 0; b < 256; b++) expect(mulawDecode(b)).toBe(G711_MULAW_TABLE[b]);
        expect(Object.is(mulawDecode(0x7f), 0)).toBe(true); // +0, never −0
    });

    it('round-trips every code (0x7F, the second zero, re-encodes as 0xFF)', () => {
        for (let b = 0; b < 256; b++) expect(mulawEncode(mulawDecode(b))).toBe(b === 0x7f ? 0xff : b);
    });

    it('encodes like the ITU-T G.191 reference at the decision boundaries', () => {
        // Positive: 0..3 → zero, 4..11 → +8, 12 → +16.
        for (const x of [0, 1, 2, 3]) expect(mulawEncode(x)).toBe(0xff);
        expect(mulawEncode(4)).toBe(0xfe);
        expect(mulawEncode(11)).toBe(0xfe);
        expect(mulawEncode(12)).toBe(0xfd);
        // Negative uses one's complement: −1..−4 → zero, −5..−12 → −8, −13 → −16.
        for (const x of [-1, -2, -3, -4]) expect(mulawEncode(x)).toBe(0x7f);
        expect(mulawEncode(-5)).toBe(0x7e);
        expect(mulawEncode(-12)).toBe(0x7e);
        expect(mulawEncode(-13)).toBe(0x7d);
        // Full scale, clamping and rounding.
        expect(mulawEncode(32767)).toBe(0x80);
        expect(mulawEncode(-32768)).toBe(0x00);
        expect(mulawEncode(1e6)).toBe(0x80);
        expect(mulawEncode(-1e6)).toBe(0x00);
        expect(mulawEncode(4.4)).toBe(mulawEncode(4));
        expect(mulawEncode(3.6)).toBe(mulawEncode(4));
    });

    it('is monotonic and within half a step (+ the 14-bit grain) of every in-range sample', () => {
        let previous = -Infinity;
        const faults: string[] = [];
        for (let x = -32124; x <= 32124; x++) {
            const code = mulawEncode(x);
            const y = mulawDecode(code);
            const step = 8 << ((~code & 0x70) >> 4);
            if (y < previous) faults.push(`${x} → ${y}: not monotonic`);
            if (Math.abs(x - y) > step / 2 + 4) faults.push(`${x} → ${y}: beyond half a step (${step})`);
            previous = y;
        }
        expect(faults).toEqual([]);
    });
});

// ── Resampling ──────────────────────────────────────────────────────────────

describe('resampleTo8k', () => {
    const AMPLITUDE = 10_000;

    it.each([24_000, 16_000, 22_050, 48_000])('keeps a 1 kHz tone within 0.5 dB from %i Hz, in phase, for the same duration', (rate) => {
        const input = toInt16(tone(1000, rate, 1, AMPLITUDE));
        const out = resampleTo8k(input, rate);
        expect(out.length).toBe(8000);
        const gain = db(rms(out, 400) / (AMPLITUDE / Math.SQRT2));
        expect(Math.abs(gain)).toBeLessThan(0.5);
        // Zero delay: the output matches the ideal 8 kHz tone sample for sample.
        const ideal = tone(1000, 8000, 1, AMPLITUDE);
        let worst = 0;
        for (let i = 400; i < 7600; i++) worst = Math.max(worst, Math.abs(out[i] - ideal[i]));
        expect(worst).toBeLessThan(0.01 * AMPLITUDE);
    });

    it.each([24_000, 16_000])('attenuates a 5 kHz tone from %i Hz by at least 40 dB (no 3 kHz alias)', (rate) => {
        const out = resampleTo8k(toInt16(tone(5000, rate, 1, AMPLITUDE)), rate);
        expect(db(rms(out, 400) / (AMPLITUDE / Math.SQRT2))).toBeLessThan(-40);
    });

    it('keeps the 300–3300 Hz speech band flat and stops 4–12 kHz from 24 kHz', () => {
        for (const hz of [300, 1000, 2000, 3000, 3300]) {
            const out = resampleTo8k(toInt16(tone(hz, 24_000, 1, AMPLITUDE)), 24_000);
            expect(Math.abs(db(rms(out, 400) / (AMPLITUDE / Math.SQRT2)))).toBeLessThan(0.5);
        }
        for (const hz of [4000, 4500, 7000, 9000, 11_000]) {
            const out = resampleTo8k(toInt16(tone(hz, 24_000, 1, AMPLITUDE)), 24_000);
            expect(db(rms(out, 400) / (AMPLITUDE / Math.SQRT2))).toBeLessThan(-40);
        }
    });

    it('returns a copy at 8 kHz, keeps silence silent and refuses rates below 8 kHz', () => {
        const pcm = Int16Array.from([1, -2, 3]);
        const same = resampleTo8k(pcm, 8000);
        expect(Array.from(same)).toEqual([1, -2, 3]);
        expect(same).not.toBe(pcm);
        expect(resampleTo8k(new Int16Array(2400), 24_000).every((v) => v === 0)).toBe(true);
        expect(resampleTo8k(new Int16Array(0), 24_000)).toHaveLength(0);
        expect(() => resampleTo8k(pcm, 7999)).toThrow(RangeError);
        expect(() => resampleTo8k(pcm, 24_000.5)).toThrow(RangeError);
    });

    it('never wraps around on a full-scale input', () => {
        const square = Int16Array.from({ length: 2400 }, (_, i) => (Math.floor(i / 12) % 2 ? 32767 : -32768));
        const out = resampleTo8k(square, 24_000);
        for (const v of out) expect(Math.abs(v)).toBeLessThanOrEqual(32768);
    });
});

// ── Loudness ────────────────────────────────────────────────────────────────

describe('integratedLoudness (ITU-R BS.1770-4)', () => {
    it('reproduces the BS.1770-4 48 kHz K-weighting table', () => {
        const [shelf, highPass] = kWeightingBiquads(48_000);
        expect(shelf.b0).toBeCloseTo(1.53512485958697, 8);
        expect(shelf.b1).toBeCloseTo(-2.69169618940638, 8);
        expect(shelf.b2).toBeCloseTo(1.19839281085285, 8);
        expect(shelf.a1).toBeCloseTo(-1.69065929318241, 8);
        expect(shelf.a2).toBeCloseTo(0.73248077421585, 8);
        expect(highPass.b0).toBeCloseTo(1, 12);
        expect(highPass.b1).toBeCloseTo(-2, 12);
        expect(highPass.b2).toBeCloseTo(1, 12);
        expect(highPass.a1).toBeCloseTo(-1.99004745483398, 8);
        expect(highPass.a2).toBeCloseTo(0.99007225036621, 8);
    });

    it('computes the K-weighting for the actual rate: at 8 kHz the shelf still applies', () => {
        const [shelf8] = kWeightingBiquads(8000);
        const [shelf48] = kWeightingBiquads(48_000);
        expect(shelf8.b0).not.toBeCloseTo(shelf48.b0, 3);
        // Gain at Nyquist (z = −1) is the full +4 dB shelf.
        const nyquistGain = (shelf8.b0 - shelf8.b1 + shelf8.b2) / (1 - shelf8.a1 + shelf8.a2);
        expect(db(nyquistGain)).toBeCloseTo(4, 1);
    });

    it('reads a 997 Hz sine at −20 dBFS as −23 LUFS at 48 kHz, and the same within 1 LU at 24, 16 and 8 kHz', () => {
        const at48 = integratedLoudness(toFloat32(tone(997, 48_000, 5, 0.1)), 48_000);
        expect(at48).toBeGreaterThan(-23.5);
        expect(at48).toBeLessThan(-22.5);
        for (const rate of [24_000, 16_000, 8000]) {
            expect(Math.abs(integratedLoudness(toFloat32(tone(997, rate, 5, 0.1)), rate) - at48)).toBeLessThan(1);
        }
    });

    it('is −Infinity for silence and for nothing', () => {
        expect(integratedLoudness(new Float32Array(16_000), 8000)).toBe(-Infinity);
        expect(integratedLoudness(new Float32Array(0), 8000)).toBe(-Infinity);
        expect(integratedLoudness(toFloat32(tone(997, 8000, 2, 1e-5)), 8000)).toBe(-Infinity); // −103 LUFS: under the absolute gate
        expect(() => integratedLoudness(new Float32Array(10), 0)).toThrow(RangeError);
    });

    it('applies the −70 LUFS absolute gate: trailing silence does not lower the reading', () => {
        const toneOnly = integratedLoudness(toFloat32(tone(997, 8000, 3, 0.1)), 8000);
        const withSilence = new Float32Array(8000 * 6);
        withSilence.set(toFloat32(tone(997, 8000, 3, 0.1)));
        // Only the three blocks straddling the edge count (−0.22 LU); 3 s of silence averaged in would be −3 LU.
        expect(Math.abs(integratedLoudness(withSilence, 8000) - toneOnly)).toBeLessThan(0.3);
    });

    it('applies the −10 LU relative gate: a long quiet passage is gated out', () => {
        const loud = toFloat32(tone(997, 8000, 3, 0.1)); // ≈ −23 LUFS
        const quiet = toFloat32(tone(997, 8000, 6, 0.01)); // ≈ −43 LUFS, above −70 but 20 LU down
        const mixed = new Float32Array(loud.length + quiet.length);
        mixed.set(loud);
        mixed.set(quiet, loud.length);
        const reading = integratedLoudness(mixed, 8000);
        expect(Math.abs(reading - integratedLoudness(loud, 8000))).toBeLessThan(0.4); // ungated it would read ≈ −27.8
    });

    it('scales 1:1 with level and measures a sub-block clip as one block', () => {
        const a = integratedLoudness(toFloat32(tone(997, 8000, 3, 0.05)), 8000);
        const b = integratedLoudness(toFloat32(tone(997, 8000, 3, 0.1)), 8000);
        expect(b - a).toBeCloseTo(6.02, 1);
        const short = integratedLoudness(toFloat32(tone(997, 8000, 0.3, 0.1)), 8000);
        expect(Math.abs(short - b)).toBeLessThan(0.5);
    });
});

// ── Normalisation ───────────────────────────────────────────────────────────

describe('normaliseTelephonyWav', () => {
    it('brings a quiet clip and a loud clip to the target (−21 LUFS), keeping the duration and the peak ceiling', () => {
        for (const amplitude of [1800, 25_000]) {
            const wav = speechLikeWav(amplitude);
            const r = normaliseTelephonyWav(wav);
            expect(TELEPHONY_TARGET_LUFS).toBe(-21);
            expect(r.beforeLufs).toBeCloseTo(integratedLoudness(decodedFloat(wav), 8000), 6);
            expect(Math.abs(r.afterLufs - TELEPHONY_TARGET_LUFS)).toBeLessThan(0.3);
            expect(r.gainDb).toBeCloseTo(TELEPHONY_TARGET_LUFS - r.beforeLufs, 6);
            expect(r.peakDbfs).toBeLessThanOrEqual(TELEPHONY_PEAK_CEILING_DBFS);
            expect(mulawSamples(r.wav).length).toBe(mulawSamples(wav).length);
            expect(parseWav(r.wav).durationSeconds).toBeCloseTo(4, 6);
            // What it reports is what it returns.
            expect(r.afterLufs).toBeCloseTo(integratedLoudness(decodedFloat(r.wav), 8000), 9);
        }
    });

    it('class gate: clips that were 6 LU apart come out within 0.5 LU of each other', () => {
        const quiet = normaliseTelephonyWav(speechLikeWav(2500));
        const loud = normaliseTelephonyWav(speechLikeWav(5000));
        expect(loud.beforeLufs - quiet.beforeLufs).toBeGreaterThan(5.5);
        expect(Math.abs(loud.afterLufs - quiet.afterLufs)).toBeLessThan(0.5);
    });

    it('lowers the gain to respect the peak ceiling instead of limiting', () => {
        // A quiet tone with one near-full-scale click: the target loudness would push the click past −2 dBFS.
        const codes = Buffer.from(Array.from(toInt16(tone(700, 8000, 3, 900)), (v) => mulawEncode(v)));
        codes[12_000] = mulawEncode(20_000);
        const r = normaliseTelephonyWav(buildMulawWav(codes));
        expect(r.peakDbfs).toBeLessThanOrEqual(TELEPHONY_PEAK_CEILING_DBFS);
        expect(r.peakDbfs).toBeGreaterThan(TELEPHONY_PEAK_CEILING_DBFS - 0.5);
        expect(r.afterLufs).toBeLessThan(TELEPHONY_TARGET_LUFS - 1);
        expect(r.gainDb).toBeLessThan(TELEPHONY_TARGET_LUFS - r.beforeLufs);
    });

    it('holds any ceiling exactly, even where μ-law rounds a peak upward', () => {
        for (const ceiling of [-1, -2, -3, -6]) {
            const r = normaliseTelephonyWav(speechLikeWav(9000), { targetLufs: -6, peakCeilingDbfs: ceiling });
            expect(r.peakDbfs).toBeLessThanOrEqual(ceiling);
            expect(r.peakDbfs).toBeGreaterThan(ceiling - 0.4);
        }
    });

    it('honours a custom target', () => {
        const r = normaliseTelephonyWav(speechLikeWav(3000), { targetLufs: -24 });
        expect(Math.abs(r.afterLufs + 24)).toBeLessThan(0.3);
    });

    it('returns silence, near-silence and an on-target clip unchanged', () => {
        const silence = buildMulawWav(Buffer.alloc(8000 * 2, MULAW_SILENCE));
        const s = normaliseTelephonyWav(silence);
        expect(s.wav).toBe(silence);
        expect(s).toMatchObject({ beforeLufs: -Infinity, afterLufs: -Infinity, gainDb: 0, peakDbfs: -Infinity });

        const hiss = buildMulawWav(Buffer.from(Array.from(toInt16(tone(1000, 8000, 2, 20)), (v) => mulawEncode(v))));
        const h = normaliseTelephonyWav(hiss);
        expect(h.beforeLufs).toBeLessThan(NEAR_SILENCE_LUFS);
        expect(h.wav).toBe(hiss);
        expect(h.gainDb).toBe(0);

        // Within 0.05 dB of the target: not worth a second μ-law quantisation.
        const once = normaliseTelephonyWav(speechLikeWav(3000));
        const twice = normaliseTelephonyWav(once.wav, { targetLufs: once.afterLufs + 0.04 });
        expect(twice.wav).toBe(once.wav);
        expect(twice.gainDb).toBe(0);
        expect(twice.afterLufs).toBe(once.afterLufs);
    });

    it('accepts only 8 kHz mono μ-law', () => {
        const pcm = Buffer.from(speechLikeWav(3000));
        pcm.writeUInt16LE(1, 20); // audioFormat := PCM
        expect(() => normaliseTelephonyWav(pcm)).toThrow(/μ-law/);
    });
});
