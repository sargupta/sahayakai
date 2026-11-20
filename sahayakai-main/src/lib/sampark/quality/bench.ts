/**
 * Call-quality bench: the same test set through every voice and recogniser, scored the same way.
 *
 *   Voice (TTS)  — each engine speaks each agent line. Measured: time to the first audio byte
 *                  (true only for streaming engines; for request/response engines it equals the
 *                  total), total time, length, loudness. Intelligibility: every recogniser that
 *                  supports the language transcribes it back (word error rate, lost must-hear words).
 *                  The audio is kept for native listeners — their score decides the voice, not
 *                  this number (CONVERSATION_PLAN.md §6.3).
 *   Hearing (STT) — each parent reply is spoken once by a neutral reference voice, passed over an
 *                  8 kHz μ-law phone channel (optionally with noise), and every recogniser
 *                  transcribes it. Measured: time, word error rate, lost must-hear words.
 *
 * Engines are injected, so this module never touches the network; the live adapters are in
 * engines.ts. A failing engine is recorded and the run goes on.
 */

import { mulawDecode, mulawEncode, integratedLoudness } from '@/lib/sampark/speech/dsp';
import { buildMulawWav, mulawSamples, TELEPHONY_SAMPLE_RATE } from '@/lib/sampark/speech/wav';
import type { ParentLanguage } from '@/types/sampark';

import { BENCH_CORPUS, type ParentReply } from './corpus';
import { mean, missingWords, percentile, wordErrorRate } from './metrics';

export interface TtsEngine {
    name: string;
    /** True when firstAudioMs is a real first-byte time (a streaming API). */
    streaming: boolean;
    supports(language: ParentLanguage): boolean;
    /** Returns an 8 kHz mono μ-law WAV. `firstAudioMs` only from streaming engines. */
    synthesize(text: string, language: ParentLanguage): Promise<{ wav: Buffer; firstAudioMs?: number }>;
}

export interface SttEngine {
    name: string;
    supports(language: ParentLanguage): boolean;
    transcribe(wav: Buffer, language: ParentLanguage): Promise<string>;
}

export interface BenchDeps {
    tts: TtsEngine[];
    stt: SttEngine[];
    /** The neutral voice that speaks the parent replies (none for a language → replies are skipped for it). */
    replyVoice(language: ParentLanguage): TtsEngine | null;
    /** Milliseconds, monotonic. */
    now(): number;
}

export interface BenchOptions {
    languages: ParentLanguage[];
    /** Timed runs per item (the first warms connections). Accuracy is scored on the first run. */
    repeats?: number;
    /** Add white noise to the parent replies at this signal-to-noise ratio (dB). */
    noiseSnrDb?: number | null;
    /** Called as items finish, for progress output. */
    onProgress?: (line: string) => void;
}

export interface Heard {
    engine: string;
    transcript: string | null;
    wer: number | null;
    missing: string[];
    error?: string;
}

export interface TtsResult {
    language: ParentLanguage;
    engine: string;
    itemId: string;
    text: string;
    ok: boolean;
    error?: string;
    totalMs: number[];
    firstAudioMs: number[];
    streaming: boolean;
    durationSec: number | null;
    lufs: number | null;
    heardBy: Heard[];
    /** Not serialised into the JSON report; the script writes it to a .wav file. */
    audio?: Buffer;
}

export interface SttResult {
    language: ParentLanguage;
    engine: string;
    itemId: string;
    intent: ParentReply['intent'];
    codeMixed: boolean;
    expected: string;
    ok: boolean;
    error?: string;
    transcript: string | null;
    wer: number | null;
    missing: string[];
    ms: number[];
}

export interface BenchRun {
    startedAt: string;
    languages: ParentLanguage[];
    repeats: number;
    noiseSnrDb: number | null;
    tts: TtsResult[];
    stt: SttResult[];
    /** Reply audio as the recognisers received it, by `${language}/${itemId}`. */
    replyAudio: Record<string, Buffer>;
    skipped: { stage: 'tts' | 'stt' | 'reply'; language: ParentLanguage; engine: string; reason: string }[];
}

function message(err: unknown): string {
    return (err instanceof Error ? err.message : String(err)).replace(/\s+/g, ' ').slice(0, 200);
}

function durationOf(wav: Buffer): number | null {
    try {
        return mulawSamples(wav).length / TELEPHONY_SAMPLE_RATE;
    } catch {
        return null;
    }
}

function loudnessOf(wav: Buffer): number | null {
    try {
        const s = mulawSamples(wav);
        const pcm = new Float32Array(s.length);
        for (let i = 0; i < s.length; i++) pcm[i] = mulawDecode(s[i]) / 32768;
        const l = integratedLoudness(pcm, TELEPHONY_SAMPLE_RATE);
        return Number.isFinite(l) ? Math.round(l * 10) / 10 : null;
    } catch {
        return null;
    }
}

/** Deterministic PRNG (mulberry32), so two runs add the same noise. */
function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Add white Gaussian noise to an 8 kHz μ-law WAV at `snrDb` (signal RMS over the whole clip). */
export function addPhoneNoise(wav: Buffer, snrDb: number, seed = 1): Buffer {
    const s = mulawSamples(wav);
    const pcm = new Float64Array(s.length);
    let power = 0;
    for (let i = 0; i < s.length; i++) {
        pcm[i] = mulawDecode(s[i]);
        power += pcm[i] * pcm[i];
    }
    const rms = Math.sqrt(power / Math.max(1, s.length));
    const sigma = rms / Math.pow(10, snrDb / 20);
    const rand = rng(seed);
    const out = Buffer.alloc(s.length);
    for (let i = 0; i < s.length; i++) {
        // Box–Muller
        const g = Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
        const v = Math.max(-32768, Math.min(32767, Math.round(pcm[i] + g * sigma)));
        out[i] = mulawEncode(v);
    }
    return buildMulawWav(out);
}

async function timed<T>(deps: BenchDeps, fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
    const t0 = deps.now();
    const value = await fn();
    return { value, ms: Math.round(deps.now() - t0) };
}

export async function runBench(deps: BenchDeps, opts: BenchOptions): Promise<BenchRun> {
    const repeats = Math.max(1, opts.repeats ?? 2);
    const noiseSnrDb = opts.noiseSnrDb ?? null;
    const say = opts.onProgress ?? (() => undefined);
    const run: BenchRun = { startedAt: new Date().toISOString(), languages: opts.languages, repeats, noiseSnrDb, tts: [], stt: [], replyAudio: {}, skipped: [] };

    for (const language of opts.languages) {
        const corpus = BENCH_CORPUS[language];
        const recognisers = deps.stt.filter((e) => e.supports(language));
        for (const e of deps.stt) if (!e.supports(language)) run.skipped.push({ stage: 'stt', language, engine: e.name, reason: 'language not supported' });

        // ── Voices ──
        for (const engine of deps.tts) {
            if (!engine.supports(language)) {
                run.skipped.push({ stage: 'tts', language, engine: engine.name, reason: 'language not supported' });
                continue;
            }
            for (const line of corpus.agentLines) {
                const r: TtsResult = { language, engine: engine.name, itemId: line.id, text: line.text, ok: false, totalMs: [], firstAudioMs: [], streaming: engine.streaming, durationSec: null, lufs: null, heardBy: [] };
                try {
                    for (let i = 0; i < repeats; i++) {
                        const { value, ms } = await timed(deps, () => engine.synthesize(line.text, language));
                        r.totalMs.push(ms);
                        r.firstAudioMs.push(engine.streaming && value.firstAudioMs !== undefined ? Math.round(value.firstAudioMs) : ms);
                        if (i === 0) r.audio = value.wav;
                    }
                    r.ok = true;
                    r.durationSec = durationOf(r.audio as Buffer);
                    r.lufs = loudnessOf(r.audio as Buffer);
                    for (const rec of recognisers) {
                        try {
                            const transcript = await rec.transcribe(r.audio as Buffer, language);
                            r.heardBy.push({ engine: rec.name, transcript, wer: wordErrorRate(line.text, transcript, language), missing: missingWords(transcript, line.mustHear, language) });
                        } catch (err) {
                            r.heardBy.push({ engine: rec.name, transcript: null, wer: null, missing: [], error: message(err) });
                        }
                    }
                } catch (err) {
                    r.error = message(err);
                }
                run.tts.push(r);
                say(`tts ${language} ${engine.name} ${line.id}: ${r.ok ? `${r.totalMs.join('/')} ms` : `ERROR ${r.error}`}`);
            }
        }

        // ── Hearing ──
        const voice = deps.replyVoice(language);
        if (!voice) {
            run.skipped.push({ stage: 'reply', language, engine: '-', reason: 'no reference voice for this language' });
            continue;
        }
        for (const [n, reply] of corpus.parentReplies.entries()) {
            let audio: Buffer;
            try {
                audio = (await voice.synthesize(reply.text, language)).wav;
                if (noiseSnrDb !== null) audio = addPhoneNoise(audio, noiseSnrDb, 1000 + n);
                run.replyAudio[`${language}/${reply.id}`] = audio;
            } catch (err) {
                run.skipped.push({ stage: 'reply', language, engine: voice.name, reason: `reply "${reply.id}" could not be spoken: ${message(err)}` });
                continue;
            }
            for (const rec of recognisers) {
                const r: SttResult = { language, engine: rec.name, itemId: reply.id, intent: reply.intent, codeMixed: !!reply.codeMixed, expected: reply.text, ok: false, transcript: null, wer: null, missing: [], ms: [] };
                try {
                    for (let i = 0; i < repeats; i++) {
                        const { value, ms } = await timed(deps, () => rec.transcribe(audio, language));
                        r.ms.push(ms);
                        if (i === 0) r.transcript = value;
                    }
                    r.ok = true;
                    r.wer = wordErrorRate(reply.text, r.transcript ?? '', language);
                    r.missing = missingWords(r.transcript ?? '', reply.mustHear, language);
                } catch (err) {
                    r.error = message(err);
                }
                run.stt.push(r);
                say(`stt ${language} ${rec.name} ${reply.id}: ${r.ok ? `${r.ms.join('/')} ms, WER ${r.wer?.toFixed(2)}` : `ERROR ${r.error}`}`);
            }
        }
    }
    return run;
}

// ── Summary ─────────────────────────────────────────────────────────────────

export interface TtsSummary {
    language: ParentLanguage;
    engine: string;
    items: number;
    failed: number;
    streaming: boolean;
    firstAudioP50: number | null;
    firstAudioP95: number | null;
    totalP50: number | null;
    totalP95: number | null;
    /** Mean word error rate over every recogniser's transcript of every line. */
    meanWerHeardBack: number | null;
    /** Must-hear words lost, over every recogniser and line. */
    missingWords: number;
    meanLufs: number | null;
}

export interface SttSummary {
    language: ParentLanguage;
    engine: string;
    items: number;
    failed: number;
    p50: number | null;
    p95: number | null;
    /** Mean word error rate of the single-language replies (code-mixed shown apart). */
    meanWer: number | null;
    meanWerCodeMixed: number | null;
    /** Replies where every must-hear word came through, of those transcribed. */
    keyWordsOk: number;
    keyWordsOf: number;
}

export function summarise(run: BenchRun): { tts: TtsSummary[]; stt: SttSummary[] } {
    const groups = <T extends { language: ParentLanguage; engine: string }>(rows: T[]) => {
        const m = new Map<string, T[]>();
        for (const r of rows) {
            const k = `${r.language}\u0000${r.engine}`;
            m.set(k, [...(m.get(k) ?? []), r]);
        }
        return [...m.values()];
    };
    const tts = groups(run.tts).map((rows): TtsSummary => {
        const ok = rows.filter((r) => r.ok);
        const first = ok.flatMap((r) => r.firstAudioMs);
        const total = ok.flatMap((r) => r.totalMs);
        const heard = ok.flatMap((r) => r.heardBy.filter((h) => h.wer !== null));
        return {
            language: rows[0].language,
            engine: rows[0].engine,
            items: rows.length,
            failed: rows.length - ok.length,
            streaming: rows[0].streaming,
            firstAudioP50: percentile(first, 50),
            firstAudioP95: percentile(first, 95),
            totalP50: percentile(total, 50),
            totalP95: percentile(total, 95),
            meanWerHeardBack: mean(heard.map((h) => h.wer as number)),
            missingWords: heard.reduce((n, h) => n + h.missing.length, 0),
            meanLufs: mean(ok.map((r) => r.lufs).filter((x): x is number => x !== null)),
        };
    });
    const stt = groups(run.stt).map((rows): SttSummary => {
        const ok = rows.filter((r) => r.ok);
        const ms = ok.flatMap((r) => r.ms);
        return {
            language: rows[0].language,
            engine: rows[0].engine,
            items: rows.length,
            failed: rows.length - ok.length,
            p50: percentile(ms, 50),
            p95: percentile(ms, 95),
            meanWer: mean(ok.filter((r) => !r.codeMixed).map((r) => r.wer as number)),
            meanWerCodeMixed: mean(ok.filter((r) => r.codeMixed).map((r) => r.wer as number)),
            keyWordsOk: ok.filter((r) => r.missing.length === 0).length,
            keyWordsOf: ok.length,
        };
    });
    return { tts, stt };
}
