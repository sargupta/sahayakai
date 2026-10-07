/**
 * Telephony DSP for Sampark call audio, in plain TypeScript.
 *
 * Why this file exists (voice phase, 7 Oct 2026, CONVERSATION_PLAN.md §6.1):
 *   - Bengali moves to Gemini-TTS through Vertex AI, which returns 24 kHz 16-bit
 *     PCM, not the 8 kHz μ-law the carrier plays. Cloud Run has no ffmpeg, so the
 *     conversion (low-pass, decimate, G.711 encode) is done here.
 *   - The first real calls were uneven in loudness (−20.7 to −15.2 LUFS, peaks
 *     near full scale). Every clip is now measured with ITU-R BS.1770-4 and
 *     brought to one telephony level before it is verified and stored.
 *
 * Everything is pure and dependency-free so it runs the same in jest, in a
 * local script and on Cloud Run, and so it can be checked against reference
 * tools (ffmpeg's ebur128 and pcm_mulaw) without becoming a runtime dependency.
 */

import { buildMulawWav, mulawSamples, TELEPHONY_SAMPLE_RATE } from './wav';

// ── G.711 μ-law ─────────────────────────────────────────────────────────────

/** Bias of the μ-law segment curve in 16-bit units (33 in the 14-bit domain of G.711). */
const MULAW_BIAS = 0x84;
/** Largest biased 14-bit magnitude G.711 can code. */
const MULAW_MAX_MAGNITUDE = 0x1fff;

/**
 * One μ-law byte → a 16-bit linear sample, exactly the G.711 decoding table
 * (0x00 → −32124, 0x80 → +32124, 0x7F and 0xFF → 0).
 */
export function mulawDecode(byte: number): number {
    const u = ~byte & 0xff;
    const t = (((u & 0x0f) << 3) + MULAW_BIAS) << ((u & 0x70) >> 4);
    // Written as BIAS − t (not −(t − BIAS)) so code 0x7F decodes to +0, never −0.
    return u & 0x80 ? MULAW_BIAS - t : t - MULAW_BIAS;
}

/**
 * A 16-bit linear sample → one μ-law byte, bit-exact with the ITU-T G.191
 * reference encoder (`ulaw_compress`): the 14-bit magnitude of a negative
 * sample is taken by one's complement, so the coder is symmetric about −½ and
 * `mulawEncode(mulawDecode(b)) === b` for every byte except 0x7F (the second
 * code for zero, which re-encodes as 0xFF). Non-integers are rounded and
 * out-of-range input is clamped to the int16 range.
 */
export function mulawEncode(sample: number): number {
    const s = Math.max(-32768, Math.min(32767, Math.round(sample)));
    let magnitude = (s < 0 ? ~s >> 2 : s >> 2) + (MULAW_BIAS >> 2);
    if (magnitude > MULAW_MAX_MAGNITUDE) magnitude = MULAW_MAX_MAGNITUDE;
    let segment = 1;
    for (let i = magnitude >> 6; i !== 0; i >>= 1) segment++;
    const code = ((0x08 - segment) << 4) | (0x0f - ((magnitude >> segment) & 0x0f));
    return s >= 0 ? code | 0x80 : code;
}

// ── Resampling to 8 kHz ─────────────────────────────────────────────────────

/**
 * Anti-alias filter for the 8 kHz telephone channel: −6 dB at 3.6 kHz, flat to
 * 3.3 kHz and at least 80 dB down from 3.9 kHz, so nothing above the 4 kHz
 * Nyquist folds back into the speech band (a 5 kHz component would otherwise
 * come back as a 3 kHz whistle).
 */
const RESAMPLE_CUTOFF_HZ = 3600;
const RESAMPLE_TRANSITION_HZ = 600;
const RESAMPLE_STOPBAND_DB = 80;

interface ResampleKernel {
    /** Output rate / input rate = up / down, in lowest terms. */
    up: number;
    down: number;
    /** Taps per phase run from input index i − half + 1 to i + half. */
    half: number;
    /** One tap set per fractional output position p / up (polyphase). */
    phases: Float64Array[];
}

const kernelCache = new Map<number, ResampleKernel>();

function gcd(a: number, b: number): number {
    while (b) [a, b] = [b, a % b];
    return a;
}

/** Zeroth-order modified Bessel function of the first kind (power series; converges fast for β ≤ 10). */
function besselI0(x: number): number {
    const q = (x / 2) ** 2;
    let sum = 1;
    let term = 1;
    for (let k = 1; k < 64; k++) {
        term *= q / (k * k);
        sum += term;
        if (term < sum * 1e-16) break;
    }
    return sum;
}

/**
 * Kaiser-windowed sinc, tabulated per polyphase phase. The kernel is centred
 * on the output instant (zero delay), and every phase is scaled to unity DC
 * gain so the level does not wobble between phases of a fractional ratio.
 */
function resampleKernel(fromRate: number): ResampleKernel {
    const cached = kernelCache.get(fromRate);
    if (cached) return cached;
    const g = gcd(fromRate, TELEPHONY_SAMPLE_RATE);
    const up = TELEPHONY_SAMPLE_RATE / g;
    const down = fromRate / g;
    const fc = RESAMPLE_CUTOFF_HZ / fromRate; // cycles per input sample
    const transition = (2 * Math.PI * RESAMPLE_TRANSITION_HZ) / fromRate; // radians per input sample
    const taps = Math.ceil((RESAMPLE_STOPBAND_DB - 8) / (2.285 * transition)); // Kaiser's length estimate
    const half = Math.ceil(taps / 2);
    const beta = 0.1102 * (RESAMPLE_STOPBAND_DB - 8.7);
    const i0Beta = besselI0(beta);
    const phases: Float64Array[] = [];
    for (let p = 0; p < up; p++) {
        const frac = p / up;
        const h = new Float64Array(2 * half);
        let sum = 0;
        for (let k = -half + 1; k <= half; k++) {
            const tau = k - frac;
            const r = tau / half;
            if (Math.abs(r) > 1) continue;
            const x = 2 * fc * tau;
            const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
            const v = 2 * fc * sinc * (besselI0(beta * Math.sqrt(1 - r * r)) / i0Beta);
            h[k + half - 1] = v;
            sum += v;
        }
        for (let j = 0; j < h.length; j++) h[j] /= sum;
        phases.push(h);
    }
    const kernel = { up, down, half, phases };
    kernelCache.set(fromRate, kernel);
    return kernel;
}

/**
 * 16-bit PCM at `fromRate` (any integer rate ≥ 8000) → 16-bit PCM at 8 kHz:
 * windowed-sinc low-pass at ~3.6 kHz and decimation in one polyphase pass
 * (24 kHz and 16 kHz are integer ratios; 22.05 kHz and other rates work too).
 * The output covers the same span of time; 8 kHz input is returned as a copy.
 */
export function resampleTo8k(pcm: Int16Array, fromRate: number): Int16Array {
    if (!Number.isInteger(fromRate) || fromRate < TELEPHONY_SAMPLE_RATE) {
        throw new RangeError(`resampleTo8k needs an integer rate ≥ ${TELEPHONY_SAMPLE_RATE} Hz, got ${fromRate}`);
    }
    if (fromRate === TELEPHONY_SAMPLE_RATE) return Int16Array.from(pcm);
    const { up, down, half, phases } = resampleKernel(fromRate);
    const outLength = Math.floor((pcm.length * up) / down);
    const out = new Int16Array(outLength);
    const last = pcm.length - 1;
    for (let n = 0; n < outLength; n++) {
        const pos = n * down;
        const i = Math.floor(pos / up);
        const h = phases[pos % up];
        const first = i - half + 1;
        let acc = 0;
        if (first >= 0 && i + half <= last) {
            for (let j = 0; j < h.length; j++) acc += h[j] * pcm[first + j];
        } else {
            // Edges: samples outside the clip count as silence.
            for (let j = 0; j < h.length; j++) {
                const idx = first + j;
                if (idx >= 0 && idx <= last) acc += h[j] * pcm[idx];
            }
        }
        out[n] = Math.max(-32768, Math.min(32767, Math.round(acc)));
    }
    return out;
}

// ── Loudness (ITU-R BS.1770-4) ──────────────────────────────────────────────

export interface Biquad {
    b0: number;
    b1: number;
    b2: number;
    a1: number;
    a2: number;
}

/**
 * The two K-weighting stages (high shelf, then RLB high-pass), computed for the
 * actual sample rate by the bilinear transform with pre-warping. BS.1770 only
 * tabulates 48 kHz; using those numbers at 8 kHz would put the shelf at the
 * wrong frequency. The analogue parameters are the ones libebur128 (and so
 * ffmpeg's ebur128) fitted to reproduce the 48 kHz table to ~1e-9; pyloudnorm
 * uses the same construction with rounder parameters. The RLB numerator keeps
 * the table's gain (1, −2, 1 at 48 kHz) at every rate, so a sine reads the same
 * level at 8 kHz as at 48 kHz. At 8 kHz the +4 dB shelf still applies: its
 * 1.68 kHz corner is well inside the band.
 */
export function kWeightingBiquads(sampleRate: number): [Biquad, Biquad] {
    let f0 = 1681.974450955533;
    const gainDb = 3.999843853973347;
    let q = 0.7071752369554196;
    let k = Math.tan((Math.PI * f0) / sampleRate);
    const vh = 10 ** (gainDb / 20);
    const vb = vh ** 0.4996667741545416;
    let a0 = 1 + k / q + k * k;
    const shelf: Biquad = {
        b0: (vh + (vb * k) / q + k * k) / a0,
        b1: (2 * (k * k - vh)) / a0,
        b2: (vh - (vb * k) / q + k * k) / a0,
        a1: (2 * (k * k - 1)) / a0,
        a2: (1 - k / q + k * k) / a0,
    };
    f0 = 38.13547087602444;
    q = 0.5003270373238773;
    const rlbA0 = (rate: number) => {
        const kk = Math.tan((Math.PI * f0) / rate);
        return 1 + kk / q + kk * kk;
    };
    k = Math.tan((Math.PI * f0) / sampleRate);
    a0 = rlbA0(sampleRate);
    // High-frequency gain of (1, −2, 1) over this denominator is a0; scale to the 48 kHz table's gain.
    const g = rlbA0(48_000) / a0;
    const highPass: Biquad = { b0: g, b1: -2 * g, b2: g, a1: (2 * (k * k - 1)) / a0, a2: (1 - k / q + k * k) / a0 };
    return [shelf, highPass];
}

function applyBiquad(x: Float64Array, f: Biquad): Float64Array {
    const y = new Float64Array(x.length);
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    for (let n = 0; n < x.length; n++) {
        const x0 = x[n];
        const y0 = f.b0 * x0 + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2;
        x2 = x1;
        x1 = x0;
        y2 = y1;
        y1 = y0;
        y[n] = y0;
    }
    return y;
}

const LOUDNESS_OFFSET = -0.691;
const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_LU = -10;

/**
 * Integrated loudness of mono audio (full scale ±1.0) in LUFS, per
 * ITU-R BS.1770-4: K-weighting for this sample rate, 400 ms blocks with 75 %
 * overlap, the −70 LUFS absolute gate, then the −10 LU relative gate.
 * Silence (no block above −70 LUFS) is −Infinity. A clip shorter than one
 * block is measured as a single block so a short telephony prompt still gets
 * a level (BS.1770 itself defines no value there).
 */
export function integratedLoudness(pcm: Float32Array, sampleRate: number): number {
    if (!(sampleRate > 0)) throw new RangeError(`Invalid sample rate ${sampleRate}`);
    if (pcm.length === 0) return -Infinity;
    const [shelf, highPass] = kWeightingBiquads(sampleRate);
    const weighted = applyBiquad(applyBiquad(Float64Array.from(pcm), shelf), highPass);
    const energy = new Float64Array(weighted.length + 1); // prefix sums of squares
    for (let i = 0; i < weighted.length; i++) energy[i + 1] = energy[i] + weighted[i] * weighted[i];

    const blockLength = Math.min(Math.round(0.4 * sampleRate), weighted.length);
    const hop = Math.max(1, Math.round(0.1 * sampleRate));
    const blocks: number[] = [];
    for (let start = 0; start + blockLength <= weighted.length; start += hop) {
        blocks.push((energy[start + blockLength] - energy[start]) / blockLength);
    }
    const loudnessOf = (z: number) => LOUDNESS_OFFSET + 10 * Math.log10(z);
    const mean = (zs: number[]) => zs.reduce((s, z) => s + z, 0) / zs.length;

    const aboveAbsolute = blocks.filter((z) => loudnessOf(z) > ABSOLUTE_GATE_LUFS);
    if (aboveAbsolute.length === 0) return -Infinity;
    const relativeGate = loudnessOf(mean(aboveAbsolute)) + RELATIVE_GATE_LU;
    const gated = aboveAbsolute.filter((z) => loudnessOf(z) > relativeGate);
    return gated.length ? loudnessOf(mean(gated)) : -Infinity;
}

// ── Telephony loudness normalisation ────────────────────────────────────────

/**
 * Every clip a parent hears is brought to this integrated loudness.
 * −21, not −18: real TTS clips peak at or near μ-law full scale, so with the −2 dBFS
 * ceiling and no limiter a −18 target was reached by only 2 of 10 production-config clips
 * (spread after 3.0 LU); at −21 all 10 reach it (spread 0.10 LU). Measured 7 Oct 2026.
 */
export const TELEPHONY_TARGET_LUFS = -21;
/** Sample-peak ceiling; the gain is lowered to respect it (no limiter, so no pumping). */
export const TELEPHONY_PEAK_CEILING_DBFS = -2;
/**
 * Quieter than this is treated as silence and left alone: raising it would only
 * raise the noise floor, and the transcribe-back check rejects it anyway.
 */
export const NEAR_SILENCE_LUFS = -60;
/** Below this the change is inaudible and not worth a second μ-law quantisation. */
const NEGLIGIBLE_GAIN_DB = 0.05;

export interface NormaliseResult {
    wav: Buffer;
    beforeLufs: number;
    afterLufs: number;
    gainDb: number;
    /** Sample peak of the returned audio, dBFS (int16 full scale). */
    peakDbfs: number;
}

function samplePeakDbfs(pcm: Int16Array): number {
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
    return 20 * Math.log10(peak / 32768);
}

function decodeAll(codes: Buffer): Int16Array {
    const pcm = new Int16Array(codes.length);
    for (let i = 0; i < codes.length; i++) pcm[i] = mulawDecode(codes[i]);
    return pcm;
}

function toUnitFloat(pcm: Int16Array): Float32Array {
    const out = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32768;
    return out;
}

/**
 * Bring an 8 kHz mono μ-law WAV to the telephony loudness: one static gain to
 * `targetLufs` (default −18 LUFS), lowered if needed so the sample peak stays at
 * or below `peakCeilingDbfs` (default −2 dBFS). Silence and near-silence, and
 * clips already within 0.05 dB, are returned unchanged. The sample count, and so
 * the duration, never changes. `afterLufs` and `peakDbfs` are measured on the
 * audio actually returned (after re-quantisation to μ-law).
 */
export function normaliseTelephonyWav(wav: Buffer, opts: { targetLufs?: number; peakCeilingDbfs?: number } = {}): NormaliseResult {
    const targetLufs = opts.targetLufs ?? TELEPHONY_TARGET_LUFS;
    const ceilingDbfs = opts.peakCeilingDbfs ?? TELEPHONY_PEAK_CEILING_DBFS;
    const codes = mulawSamples(wav); // throws unless 8 kHz mono μ-law
    const pcm = decodeAll(codes);
    const beforeLufs = integratedLoudness(toUnitFloat(pcm), TELEPHONY_SAMPLE_RATE);
    const beforePeak = samplePeakDbfs(pcm);
    const unchanged: NormaliseResult = { wav, beforeLufs, afterLufs: beforeLufs, gainDb: 0, peakDbfs: beforePeak };
    if (!(beforeLufs > NEAR_SILENCE_LUFS)) return unchanged;

    let gainDb = targetLufs - beforeLufs;
    if (beforePeak + gainDb > ceilingDbfs) gainDb = ceilingDbfs - beforePeak;
    if (Math.abs(gainDb) < NEGLIGIBLE_GAIN_DB) return unchanged;

    const gain = 10 ** (gainDb / 20);
    const ceiling = 32768 * 10 ** (ceilingDbfs / 20);
    const out = Buffer.alloc(codes.length);
    for (let i = 0; i < pcm.length; i++) {
        let code = mulawEncode(pcm[i] * gain);
        // μ-law rounds to the nearest level, which near the top can be ~0.3 dB above the
        // scaled sample; step one level toward zero so the ceiling is a guarantee.
        while (Math.abs(mulawDecode(code)) > ceiling && (code & 0x7f) !== 0x7f) code += 1;
        out[i] = code;
    }
    const after = decodeAll(out);
    return {
        wav: buildMulawWav(out),
        beforeLufs,
        afterLufs: integratedLoudness(toUnitFloat(after), TELEPHONY_SAMPLE_RATE),
        gainDb,
        peakDbfs: samplePeakDbfs(after),
    };
}
