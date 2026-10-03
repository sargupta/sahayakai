/** G.711 μ-law encoding of 16-bit linear PCM (for providers that return PCM WAV rather than μ-law). */

const BIAS = 0x84;
const CLIP = 32635;

export function linearToMulaw(sample: number): number {
    let s = sample;
    const sign = s < 0 ? 0x80 : 0;
    if (s < 0) s = -s;
    if (s > CLIP) s = CLIP;
    s += BIAS;
    let exponent = 7;
    for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; exponent--, mask >>= 1) {
        /* find the segment */
    }
    const mantissa = (s >> (exponent + 3)) & 0x0f;
    return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Little-endian signed 16-bit PCM bytes -> μ-law bytes. */
export function pcm16ToMulaw(pcm: Buffer): Buffer {
    const out = Buffer.alloc(Math.floor(pcm.length / 2));
    for (let i = 0; i < out.length; i++) out[i] = linearToMulaw(pcm.readInt16LE(i * 2));
    return out;
}
