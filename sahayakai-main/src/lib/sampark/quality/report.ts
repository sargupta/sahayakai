/**
 * The bench's outputs: a markdown report, a listening sheet for native speakers, and the raw
 * JSON (without audio). Pure string building.
 */

import type { BenchRun, SttSummary, TtsSummary } from './bench';
import { BENCH_CORPUS_VERSION } from './corpus';

const ms = (v: number | null) => (v === null ? '—' : `${Math.round(v)}`);
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ');

/** File name for a voice clip, shared by the script (which writes it) and the listening sheet. */
export function clipFileName(language: string, engine: string, itemId: string): string {
    return `${language}-${engine}-${itemId}.wav`.toLowerCase().replace(/[^a-z0-9.-]+/g, '_');
}

export function replyFileName(language: string, itemId: string): string {
    return `reply-${language}-${itemId}.wav`.toLowerCase().replace(/[^a-z0-9.-]+/g, '_');
}

export function renderReport(run: BenchRun, summary: { tts: TtsSummary[]; stt: SttSummary[] }, context: { measuredFrom: string; notes?: string[] }): string {
    const out: string[] = [];
    out.push('# Sampark call-quality bench');
    out.push('');
    out.push(`Run ${run.startedAt} · corpus v${BENCH_CORPUS_VERSION} · ${run.languages.join(', ')} · ${run.repeats} timed run(s) per item · replies ${run.noiseSnrDb === null ? 'clean 8 kHz μ-law' : `8 kHz μ-law + white noise at ${run.noiseSnrDb} dB SNR`}`);
    out.push('');
    out.push('**Read this first**');
    out.push(`- Times were measured from **${context.measuredFrom}**, not from where calls run (asia-south1). Network distance is in every number; compare engines with each other, not with a vendor's claim.`);
    out.push('- "First audio" is a real first-byte time only for streaming engines (marked ✓). For the others it is the whole request.');
    out.push('- Parent replies are spoken by a synthetic voice, which is easier to recognise than a real parent on a real phone. Treat recognition scores as an upper bound. Record real (consented) replies to tighten them.');
    out.push('- WER = word error rate (lower is better). It is scored after the same normalisation the render gate uses. A voice\'s WER here means intelligibility to machines; **which voice sounds native is decided by the listening sheet**, not by this table.');
    out.push('- The non-English test sentences were drafted without native review.');
    for (const n of context.notes ?? []) out.push(`- ${n}`);
    out.push('');

    out.push('## Voices (what parents hear)');
    out.push('');
    out.push('| Language | Engine | Streams | First audio p50 / p95 ms | Total p50 / p95 ms | Heard-back WER | Key words lost | Loudness LUFS | Failed |');
    out.push('|---|---|---|---|---|---|---|---|---|');
    for (const s of summary.tts) {
        out.push(`| ${s.language} | ${s.engine} | ${s.streaming ? '✓' : ''} | ${ms(s.firstAudioP50)} / ${ms(s.firstAudioP95)} | ${ms(s.totalP50)} / ${ms(s.totalP95)} | ${pct(s.meanWerHeardBack)} | ${s.missingWords} | ${s.meanLufs === null ? '—' : s.meanLufs.toFixed(1)} | ${s.failed}/${s.items} |`);
    }
    out.push('');

    out.push('## Recognition (what we hear from parents)');
    out.push('');
    out.push('| Language | Recogniser | p50 / p95 ms | WER | WER code-mixed | Key words all heard | Failed |');
    out.push('|---|---|---|---|---|---|---|');
    for (const s of summary.stt) {
        out.push(`| ${s.language} | ${s.engine} | ${ms(s.p50)} / ${ms(s.p95)} | ${pct(s.meanWer)} | ${pct(s.meanWerCodeMixed)} | ${s.keyWordsOk}/${s.keyWordsOf} | ${s.failed}/${s.items} |`);
    }
    out.push('');

    if (run.skipped.length) {
        out.push('## Not measured');
        out.push('');
        const seen = new Set<string>();
        for (const s of run.skipped) {
            const line = `- ${s.stage} · ${s.language} · ${s.engine}: ${s.reason}`;
            if (!seen.has(line)) out.push(line);
            seen.add(line);
        }
        out.push('');
    }

    out.push('## Every transcript');
    out.push('');
    out.push('### Voices, heard back');
    out.push('');
    out.push('| Language | Voice | Line | Recogniser | WER | Lost | Heard |');
    out.push('|---|---|---|---|---|---|---|');
    for (const r of run.tts) {
        if (!r.ok) {
            out.push(`| ${r.language} | ${r.engine} | ${r.itemId} | — | — | — | ERROR: ${cell(r.error ?? '')} |`);
            continue;
        }
        for (const h of r.heardBy) {
            out.push(`| ${r.language} | ${r.engine} | ${r.itemId} | ${h.engine} | ${pct(h.wer)} | ${cell(h.missing.join(', ') || '—')} | ${cell(h.error ? `ERROR: ${h.error}` : h.transcript ?? '')} |`);
        }
    }
    out.push('');
    out.push('### Parent replies');
    out.push('');
    out.push('| Language | Reply | Recogniser | WER | Lost | Said | Heard |');
    out.push('|---|---|---|---|---|---|---|');
    for (const r of run.stt) {
        out.push(`| ${r.language} | ${r.itemId}${r.codeMixed ? ' (mixed)' : ''} | ${r.engine} | ${pct(r.wer)} | ${cell(r.missing.join(', ') || '—')} | ${cell(r.expected)} | ${cell(r.ok ? r.transcript ?? '' : `ERROR: ${r.error}`)} |`);
    }
    out.push('');
    return out.join('\n');
}

/**
 * One row per clip; native listeners fill the score columns blind. Clips are renamed C001.wav…
 * (the script copies each into listening/), and the engine behind each id is only in the key file.
 */
export function renderListeningSheet(run: BenchRun): { sheet: string; key: string; clips: { id: string; result: BenchRun['tts'][number] }[] } {
    const clips = run.tts.filter((r) => r.ok);
    // Stable shuffle so the listener cannot infer the engine from the order.
    const order = clips
        .map((r, i) => ({ r, k: ((i + 1) * 2654435761) % 4294967296 }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.r);
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const sheet = ['clip_id,language,line,text,natural_1to5,pronunciation_1to5,would_listen_to_end_yes_no,notes'];
    const key = ['clip_id,file,engine'];
    const out: { id: string; result: BenchRun['tts'][number] }[] = [];
    order.forEach((r, i) => {
        const id = `C${String(i + 1).padStart(3, '0')}`;
        sheet.push([id, r.language, r.itemId, esc(r.text), '', '', '', ''].join(','));
        key.push([id, clipFileName(r.language, r.engine, r.itemId), esc(r.engine)].join(','));
        out.push({ id, result: r });
    });
    return { sheet: sheet.join('\n') + '\n', key: key.join('\n') + '\n', clips: out };
}

/** The run without audio buffers. */
export function runToJson(run: BenchRun, summary: { tts: TtsSummary[]; stt: SttSummary[] }): string {
    const tts = run.tts.map(({ audio: _audio, ...rest }) => rest);
    return JSON.stringify({ corpusVersion: BENCH_CORPUS_VERSION, ...run, tts, replyAudio: Object.keys(run.replyAudio), summary }, null, 2);
}
