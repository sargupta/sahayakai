/**
 * The campaign render step (plan §4⑥; contract §4).
 *
 * For each requested language × variantsFor(purpose), render the notice script
 * and collect every clip it names; clips are content-addressed (clipKey), so a
 * clip shared across variants — the common opt-out / no-input / fallback clips
 * — is rendered once per language. Then, bounded by `maxClips` per step and
 * `concurrency` in flight:
 *   - clips whose audio and metadata already exist and are not failed are skipped;
 *   - the rest are synthesised; a `message` clip gets a short lead-in silence
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
import { audienceLabelFor, COMMON_CLIP_KINDS, renderNoticeScript, variantsFor, type ScriptVariant } from '@/lib/sampark/scripts/render';
import type { ClipKind, ParentLanguage, RenderedClip } from '@/types/sampark';

import { clipKey } from './clip-key';
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
}

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
 * Synthesise one clip exactly as the render job stores it: lead-in silence on
 * `message` clips, transcribe-back on `message` clips (or on every clip with
 * `verifyAll`, which the verify-voice script uses), one retry on a mismatch.
 */
export async function synthesizeClip(
    deps: Pick<RenderStepDeps, 'synth' | 'verifier' | 'clock'>,
    clip: Pick<NeededClip, 'kind' | 'text' | 'language' | 'speech'>,
    opts: { verifyAll?: boolean; retries?: number } = {},
): Promise<ClipAudio> {
    const verify = clip.kind === 'message' || opts.verifyAll === true;
    const attempts = verify ? 1 + (opts.retries ?? 1) : 1;
    let last: ClipAudio | null = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
        const synthesized = await deps.synth.synthesize({ text: clip.text, language: clip.language, speech: clip.speech });
        const audio = clip.kind === 'message' ? prependSilence(synthesized.audio, MESSAGE_LEAD_IN_SECONDS) : synthesized.audio;
        const durationSeconds =
            Math.round((synthesized.durationSeconds + (clip.kind === 'message' ? MESSAGE_LEAD_IN_SECONDS : 0)) * 100) / 100;
        if (!verify) {
            return { audio, durationSeconds, verification: { status: 'skipped', transcript: null, similarity: null, checkedAt: null } };
        }
        const { transcript } = await deps.verifier.transcribe({
            audio,
            mimeType: 'audio/wav',
            language: clip.language,
            sttLanguageCode: clip.speech.sttLanguageCode,
        });
        const similarity = transcriptSimilarity(clip.text, transcript, clip.language);
        const status = similarity >= VERIFY_THRESHOLD ? 'passed' : 'failed';
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

    await mapBounded(queue, opts.concurrency, async (state) => {
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
                state.failure = `${failureLabel(clip)}: similarity ${result.verification.similarity} — heard "${result.verification.transcript ?? ''}"`;
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
