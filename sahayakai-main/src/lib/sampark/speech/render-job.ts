/**
 * The campaign render step (plan §4⑥; contract §4).
 *
 * For each requested language × variantsFor(purpose), render the notice script
 * and collect every clip it names; clips are content-addressed (clipKey), so a
 * clip shared across variants — the common opt-out / no-input / fallback clips
 * — is rendered once per language. Then, bounded by `maxClips` per step and
 * `concurrency` in flight:
 *   - clips whose audio and metadata already exist and are not failed are skipped;
 *   - before anything is synthesised in a language, its voice must pass the hard-word probe
 *     (two independent recognisers hear a fixed sentence of known-hard words exactly);
 *     a voice that fails makes every clip in that language fail with the words it missed;
 *   - the rest are synthesised and loudness-normalised; a `message` clip gets a short lead-in silence
 *     and is transcribed back (number-normalised similarity ≥ 0.85), retried
 *     once on a mismatch (TTS is not deterministic), and recorded as failed
 *     with its transcript if it still does not match;
 *   - audio goes to the AudioStore, metadata to repo.saveClip, and
 *     campaign.renderProgress is updated.
 * Idempotent: a second run over a finished campaign synthesises nothing.
 * It never changes campaign.status — the job route decides what happens next.
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import { languageInfo, type SpeechEngineConfig } from '@/lib/sampark/languages';
import type { AudioStore, Clock, SamparkRepo, SpeechSynthesizer, SpeechVerifier } from '@/lib/sampark/ports';
import { audienceLabelFor, COMMON_CLIP_KINDS, estimateSeconds, renderNoticeScript, variantsFor, type ScriptVariant } from '@/lib/sampark/scripts/render';
import type { ClipKind, ParentLanguage, RenderedClip } from '@/types/sampark';

import { clipKey } from './clip-key';
import { normaliseTelephonyWav } from './dsp';
import { ensureVoiceProbe } from './probe';
import { transcriptSimilarity, VERIFY_THRESHOLD } from './verify';
import { prependSilence } from './wav';

/** Lead-in before the message (callers say "Hello?" first, plan §4⑧). */
export const MESSAGE_LEAD_IN_SECONDS = 0.8;

export interface RenderStepDeps {
    repo: SamparkRepo;
    synth: SpeechSynthesizer;
    verifier: SpeechVerifier;
    store: AudioStore;
    clock: Clock;
    /** Loudness normalisation of every clip; defaults to normaliseTelephonyWav. Tests whose fake audio is not speech inject identity. */
    normalise?: (wav: Buffer) => Buffer;
    /**
     * The hard-word probe (speech/probe.ts) — required, never optional: no audio is rendered
     * for a language until its voice passes. `synth` defaults to the render synthesizer.
     */
    voiceCheck: VoiceCheckDeps;
}

export interface VoiceCheckDeps {
    synth?: SpeechSynthesizer;
    primary: { name: string; verifier: SpeechVerifier };
    secondaryFor(language: ParentLanguage): { name: string; verifier: SpeechVerifier };
}

const defaultNormalise = (wav: Buffer): Buffer => normaliseTelephonyWav(wav).wav;

export interface RenderStepResult {
    done: number;
    total: number;
    failures: string[];
    finished: boolean;
}

export interface NeededClip {
    key: string;
    language: ParentLanguage;
    variant: ScriptVariant;
    kind: ClipKind;
    text: string;
    speech: SpeechEngineConfig;
}

export interface ClipAudio {
    audio: Buffer;
    durationSeconds: number;
    verification: RenderedClip['verification'];
}

function failureLabel(c: Pick<NeededClip, 'language' | 'variant' | 'kind'>): string {
    return `${c.language} ${c.variant} ${c.kind}`;
}

/**
 * A clip whose audio runs this far past its estimate has almost certainly had
 * words added or repeated by the voice model (seen live: a Nepali confirmation
 * that invented a date ran 15.5 s against a 9 s estimate). Estimates use the
 * slowest measured speaking rate, so real speech normally lands UNDER them.
 */
export const RUNAWAY_FACTOR = 1.5;
export const RUNAWAY_GRACE_SECONDS = 1;

export function isRunaway(spokenSeconds: number, text: string, language: ParentLanguage): boolean {
    return spokenSeconds > estimateSeconds(text, language) * RUNAWAY_FACTOR + RUNAWAY_GRACE_SECONDS;
}

/**
 * Synthesise one clip exactly as the render job stores it: lead-in silence on
 * `message` clips, then EVERY clip is transcribed back and length-checked,
 * with one re-render on a mismatch. Confirmations, the opt-out step and the
 * goodbye are all heard by parents, so none of them is exempt (class gate:
 * no clip may carry words that are not in its reviewed template).
 */
export async function synthesizeClip(
    deps: Pick<RenderStepDeps, 'synth' | 'verifier' | 'clock' | 'normalise'>,
    clip: Pick<NeededClip, 'kind' | 'text' | 'language' | 'speech'>,
    opts: { retries?: number } = {},
): Promise<ClipAudio> {
    // Two re-renders: voice-model slips (a repeated line, a leaked instruction) are
    // random, so a fresh render usually comes back clean.
    const attempts = 1 + (opts.retries ?? 2);
    let last: ClipAudio | null = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const synthesized = await deps.synth.synthesize({
            text: clip.text,
            language: clip.language,
            speech: clip.speech,
            delivery: clip.kind === 'message' ? 'styled' : 'plain',
        });
        // Every clip is brought to the same loudness BEFORE it is verified and stored, so the
        // parent hears what was checked and no language is quieter than another (it was: −20.7
        // to −15.2 LUFS across the four languages on 7 Oct 2026).
        const levelled = (deps.normalise ?? defaultNormalise)(synthesized.audio);
        const audio = clip.kind === 'message' ? prependSilence(levelled, MESSAGE_LEAD_IN_SECONDS) : levelled;
        const durationSeconds =
            Math.round((synthesized.durationSeconds + (clip.kind === 'message' ? MESSAGE_LEAD_IN_SECONDS : 0)) * 100) / 100;
        const { transcript } = await deps.verifier.transcribe({
            audio,
            mimeType: 'audio/wav',
            language: clip.language,
            sttLanguageCode: clip.speech.sttLanguageCode,
        });
        const similarity = transcriptSimilarity(clip.text, transcript, clip.language);
        const runaway = isRunaway(synthesized.durationSeconds, clip.text, clip.language);
        const status = similarity >= VERIFY_THRESHOLD && !runaway ? 'passed' : 'failed';
        last = { audio, durationSeconds, verification: { status, transcript, similarity, checkedAt: deps.clock.now().toISOString() } };
        if (status === 'passed') return last;
    }
    return last!;
}

/** Every clip a campaign needs in the given languages, de-duplicated by key (first occurrence wins). */
export function neededClips(
    purpose: Parameters<typeof renderNoticeScript>[0]['purpose'],
    facts: Parameters<typeof renderNoticeScript>[0]['facts'],
    school: Parameters<typeof renderNoticeScript>[0]['school'],
    audience: Parameters<typeof renderNoticeScript>[0]['audience'],
    languages: readonly ParentLanguage[],
): NeededClip[] {
    const byKey = new Map<string, NeededClip>();
    for (const language of [...new Set(languages)]) {
        const speech = languageInfo(language).speech;
        for (const variant of variantsFor(purpose)) {
            const script = renderNoticeScript({ purpose, facts, school, language, variant, audience });
            for (const clip of script.clips) {
                const key = clipKey(speech, clip.text);
                if (byKey.has(key)) continue;
                // Common clips are the same in every variant: record them once, as 'default'.
                const clipVariant: ScriptVariant = COMMON_CLIP_KINDS.includes(clip.kind) ? 'default' : variant;
                byKey.set(key, { key, language, variant: clipVariant, kind: clip.kind, text: clip.text, speech });
            }
        }
    }
    return [...byKey.values()];
}

async function mapBounded<T>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            await fn(item);
        }
    });
    await Promise.all(workers);
}

export async function runRenderStep(
    deps: RenderStepDeps,
    orgId: string,
    campaignId: string,
    languages: ParentLanguage[],
    opts: { maxClips: number; concurrency: number },
): Promise<RenderStepResult> {
    const campaign = await deps.repo.getCampaign(orgId, campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found for ${orgId}`);
    const school = await deps.repo.getSchool(orgId);
    if (!school) throw new Error(`Sampark school ${orgId} not found`);
    purposeSpec(campaign.purpose); // throws on an unknown purpose

    const needed = neededClips(campaign.purpose, campaign.facts, school, audienceLabelFor(campaign), languages);

    // Classify against what already exists.
    type State = { clip: NeededClip; status: 'ok' | 'failed' | 'pending'; failure?: string };
    const states: State[] = [];
    for (const clip of needed) {
        const [meta, hasAudio] = await Promise.all([deps.repo.getClip(orgId, clip.key), deps.store.exists(clip.key)]);
        if (meta && hasAudio && meta.verification.status !== 'failed') states.push({ clip, status: 'ok' });
        else if (meta && hasAudio) {
            states.push({
                clip,
                status: 'failed',
                failure: `${failureLabel(clip)}: similarity ${meta.verification.similarity ?? 'n/a'} — heard "${meta.verification.transcript ?? ''}"`,
            });
        } else states.push({ clip, status: 'pending' });
    }

    // Never-rendered clips first, then previously failed ones (re-attempted), up to maxClips.
    const queue = [...states.filter((s) => s.status === 'pending'), ...states.filter((s) => s.status === 'failed')].slice(
        0,
        Math.max(0, opts.maxClips),
    );
    const attempted = new Set<State>(queue);

    // Class gate (founder-observed bug, 7 Oct 2026): no clip is rendered in a language until
    // its voice passes the hard-word probe — a fixed sentence of known-hard words heard back
    // exactly by two independent recognisers. Transcribe-back alone passed a Bengali voice
    // that mispronounced সকাল and আটই (similarity 0.954).
    const refused = new Map<ParentLanguage, string>();
    for (const language of [...new Set(queue.map((s) => s.clip.language))]) {
        const speech = queue.find((s) => s.clip.language === language)!.clip.speech;
        try {
            const record = await ensureVoiceProbe(
                {
                    repo: deps.repo,
                    synth: deps.voiceCheck.synth ?? deps.synth,
                    primary: deps.voiceCheck.primary,
                    secondary: deps.voiceCheck.secondaryFor(language),
                    clock: deps.clock,
                    normalise: deps.normalise ?? defaultNormalise,
                },
                language,
                speech,
            );
            if (record.status !== 'passed') {
                const heard = record.recognizers
                    .filter((r) => r.missing.length > 0)
                    .map((r) => `${r.name} did not hear ${r.missing.join(', ')}`)
                    .join('; ');
                refused.set(language, `the ${language} voice failed the hard-word check (${heard}); no ${language} audio is made until a voice passes`);
            }
        } catch (err) {
            refused.set(language, `the ${language} voice check could not run (${err instanceof Error ? err.message.slice(0, 160) : String(err)}); try preparing the audio again`);
        }
    }
    for (const state of queue) {
        const why = refused.get(state.clip.language);
        if (why) {
            state.status = 'failed';
            state.failure = `${failureLabel(state.clip)}: ${why}`;
        }
    }

    await mapBounded(queue.filter((s) => !refused.has(s.clip.language)), opts.concurrency, async (state) => {
        const { clip } = state;
        try {
            const result = await synthesizeClip(deps, clip);
            await deps.store.put(clip.key, result.audio, 'audio/wav');
            const record: RenderedClip = {
                key: clip.key,
                orgId,
                campaignId: campaign.id,
                purpose: campaign.purpose,
                language: clip.language,
                variant: clip.variant,
                kind: clip.kind,
                text: clip.text,
                engine: clip.speech.engine,
                voice: clip.speech.voice,
                model: clip.speech.model ?? clip.speech.engine,
                languageCode: clip.speech.ttsLanguageCode,
                durationSeconds: result.durationSeconds,
                verification: result.verification,
                createdAt: deps.clock.now().toISOString(),
            };
            await deps.repo.saveClip(record);
            if (result.verification.status === 'failed') {
                state.status = 'failed';
                state.failure = `${failureLabel(clip)}: similarity ${result.verification.similarity}, ${result.durationSeconds} s spoken — heard "${result.verification.transcript ?? ''}"`;
            } else {
                state.status = 'ok';
                state.failure = undefined;
            }
        } catch (err) {
            state.status = 'failed';
            state.failure = `${failureLabel(clip)}: ${err instanceof Error ? err.message : String(err)}`;
        }
    });

    const done = states.filter((s) => s.status === 'ok').length;
    const failures = states.filter((s) => s.status === 'failed').map((s) => s.failure ?? failureLabel(s.clip));
    // Finished = every clip has been decided: nothing never-rendered is left, and every failure was (re)attempted in this step.
    const finished = states.every((s) => s.status === 'ok' || (s.status === 'failed' && attempted.has(s)));
    const total = needed.length;

    await deps.repo.updateCampaign(orgId, campaignId, {
        renderProgress: { done, total, failures },
        updatedAt: deps.clock.now().toISOString(),
    });
    return { done, total, failures, finished };
}
