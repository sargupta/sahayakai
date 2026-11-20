/**
 * Seeded pseudo-random numbers. The generator never touches Math.random or the
 * wall clock, so the same seed always produces byte-identical data (see
 * test/generate.test.ts, which stubs both to throw while generating).
 *
 * cyrb128 turns a string seed into 128 bits; sfc32 is a small, fast, well-mixed
 * 32-bit generator. `fork(label)` derives an independent stream, so adding data
 * to one area (say, incidents) never shifts the values drawn in another.
 */

function cyrb128(input: string): [number, number, number, number] {
    let h1 = 1779033703;
    let h2 = 3144134277;
    let h3 = 1013904242;
    let h4 = 2773480762;
    for (let i = 0; i < input.length; i++) {
        const k = input.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    h1 ^= h2 ^ h3 ^ h4;
    h2 ^= h1;
    h3 ^= h1;
    h4 ^= h1;
    return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
    return () => {
        a >>>= 0;
        b >>>= 0;
        c >>>= 0;
        d >>>= 0;
        let t = (a + b) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        d = (d + 1) | 0;
        t = (t + d) | 0;
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
}

export interface Rng {
    /** Uniform in [0, 1). */
    next(): number;
    /** Uniform integer in [min, max], both inclusive. */
    int(min: number, max: number): number;
    chance(p: number): boolean;
    pick<T>(items: readonly T[]): T;
    weighted<T>(items: readonly (readonly [T, number])[]): T;
    /** Fisher-Yates on a copy. */
    shuffle<T>(items: readonly T[]): T[];
    /** Approximately normal (Irwin-Hall with 6 terms). */
    normal(mean: number, sd: number): number;
    /** An independent stream derived from this seed and a label. */
    fork(label: string): Rng;
}

export function createRng(seed: string): Rng {
    const [a, b, c, d] = cyrb128(seed);
    const raw = sfc32(a, b, c, d);
    // Discard the first outputs; sfc32 needs a few rounds to mix a fresh state.
    for (let i = 0; i < 15; i++) raw();

    const rng: Rng = {
        next: raw,
        int(min, max) {
            return min + Math.floor(raw() * (max - min + 1));
        },
        chance(p) {
            return raw() < p;
        },
        pick(items) {
            if (items.length === 0) throw new Error('pick() from an empty list');
            return items[Math.floor(raw() * items.length)] as (typeof items)[number];
        },
        weighted(items) {
            const total = items.reduce((sum, [, w]) => sum + w, 0);
            let roll = raw() * total;
            for (const [value, weight] of items) {
                roll -= weight;
                if (roll < 0) return value;
            }
            const last = items[items.length - 1];
            if (!last) throw new Error('weighted() from an empty list');
            return last[0];
        },
        shuffle(items) {
            const out = items.slice();
            for (let i = out.length - 1; i > 0; i--) {
                const j = Math.floor(raw() * (i + 1));
                const tmp = out[i] as (typeof out)[number];
                out[i] = out[j] as (typeof out)[number];
                out[j] = tmp;
            }
            return out;
        },
        normal(mean, sd) {
            let sum = 0;
            for (let i = 0; i < 6; i++) sum += raw();
            return mean + (sum - 3) * sd * Math.SQRT2;
        },
        fork(label) {
            return createRng(`${seed}/${label}`);
        },
    };
    return rng;
}
