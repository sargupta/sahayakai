/**
 * Fake synthesizer + fake transcriber for the bake-off's dry-run mode and its
 * jest tests. No network, no credentials. The synthesizer renders valid 8 kHz
 * μ-law WAV whose length follows the text length and whose last bytes are a
 * fingerprint of the text; the transcriber reads the fingerprint back, so a
 * dry run exercises the real gates (similarity, runaway, length budget) end to end.
 */

import crypto from 'node:crypto';

import type { SpeechVerifier } from '@/lib/sampark/ports';
import type { Synthesizer } from '@/lib/sampark/speech/synthesizer';
import { buildMulawWav, mulawSamples, TELEPHONY_SAMPLE_RATE } from '@/lib/sampark/speech/wav';

const SIGNATURE_BYTES = 32;

export interface FakeSpeechOptions {
    /** Characters spoken per second (default 14, close to the measured Indic rate). */
    charsPerSecond?: number;
    /** Return a different transcript for texts matching this (to exercise failing gates). */
    garble?: (text: string) => boolean;
    /** Multiply the rendered duration for texts matching this (to exercise the runaway / budget gates). */
    stretch?: (text: string) => number;
    /** Throw for texts matching this (to exercise the error path). */
    fail?: (text: string) => boolean;
    id?: string;
}

export function createFakeSpeech(opts: FakeSpeechOptions = {}): { synth: Synthesizer; verifier: SpeechVerifier; calls: { text: string; provider: string }[] } {
    const cps = opts.charsPerSecond ?? 14;
    const known = new Map<string, string>();
    const calls: { text: string; provider: string }[] = [];
    const signature = (text: string) => {
        const h = crypto.createHash('sha256').update(text, 'utf8').digest();
        return h.subarray(0, SIGNATURE_BYTES);
    };
    const synth: Synthesizer = {
        id: opts.id ?? 'fake',
        async synthesize({ text, profile }) {
            calls.push({ text, provider: profile.provider });
            if (opts.fail?.(text)) throw new Error('fake synthesizer failure');
            const seconds = Math.max(0.5, (Array.from(text).length / cps) * (opts.stretch?.(text) ?? 1));
            const body = Buffer.alloc(Math.round(seconds * TELEPHONY_SAMPLE_RATE), 0x55);
            const sig = signature(text);
            sig.copy(body, body.length - SIGNATURE_BYTES);
            known.set(sig.toString('hex'), text);
            return { audio: buildMulawWav(body), mimeType: 'audio/wav' as const, durationSeconds: body.length / TELEPHONY_SAMPLE_RATE };
        },
    };
    const verifier: SpeechVerifier = {
        async transcribe({ audio }) {
            const samples = mulawSamples(audio);
            const sig = samples.subarray(samples.length - SIGNATURE_BYTES).toString('hex');
            const text = known.get(sig);
            if (text === undefined) return { transcript: '', confidence: 0 };
            return { transcript: opts.garble?.(text) ? 'unrelated words from a different recording' : text, confidence: 0.99 };
        },
    };
    return { synth, verifier, calls };
}
